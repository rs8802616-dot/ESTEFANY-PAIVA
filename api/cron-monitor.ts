interface ApiReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/studio-de-beleza-8045a/databases/(default)/documents';
const SITE_BASE = 'https://estefany-paiva-nails.vercel.app';

type Severity = 'critical' | 'warning';

function getEnv(name: string): string {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return (proc?.env?.[name] || '').trim();
}

function todaySP(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function currentHourSP(): number {
  try {
    const h = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
    return Number(h) || 12;
  } catch {
    return new Date().getUTCHours();
  }
}

type FirestoreFields = Record<
  string,
  { stringValue?: string; booleanValue?: boolean; integerValue?: string }
>;

function parseFields(fields?: FirestoreFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
  }
  return out;
}

async function readDoc(path: string): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(`${FIRESTORE_BASE}/${path}`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { fields?: FirestoreFields };
    return parseFields(data.fields);
  } catch {
    return null;
  }
}

async function writeDoc(
  path: string,
  values: Record<string, string | number | boolean>,
): Promise<void> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: String(Math.round(v)) };
    else fields[k] = { stringValue: String(v) };
  }
  await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  }).catch(() => {});
}

async function sendTelegramAlert(text: string): Promise<boolean> {
  const botToken = getEnv('TELEGRAM_BOT_TOKEN').replace(/^bot/i, '').trim();
  const chatId = getEnv('TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) return false;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

async function runProbe(
  service: string,
  url: string,
  severity: Severity,
): Promise<{
  service: string;
  ok: boolean;
  latencyMs: number;
  statusCode: number;
  severity: Severity;
}> {
  const start = Date.now();
  let ok = false;
  let statusCode = 0;
  try {
    const resp = await fetch(url);
    statusCode = resp.status;
    ok = resp.ok;
  } catch {
    ok = false;
    statusCode = 0;
  }
  return {
    service,
    ok,
    latencyMs: Date.now() - start,
    statusCode,
    severity,
  };
}

async function processServiceIncident(params: {
  service: string;
  label: string;
  ok: boolean;
  severity: Severity;
  detail: string;
  muted: boolean;
}): Promise<void> {
  const { service, label, ok, severity, detail, muted } = params;
  const nowIso = new Date().toISOString();
  const statePath = `monitor_state/${service}`;
  const state = (await readDoc(statePath)) || {};
  const prevFails = Number(state.consecutiveFailures || 0);
  const activeIncidentId = String(state.activeIncidentId || '');

  const hourSP = currentHourSP();
  const isQuietHours = hourSP >= 22 || hourSP < 7;
  const allowTelegram = !muted && (severity === 'critical' || !isQuietHours);

  if (!ok) {
    const nextFails = prevFails + 1;
    // Regra: abre incidente após 2 falhas consecutivas para evitar falso positivo
    if (nextFails >= 2 && !activeIncidentId) {
      const incidentId = `inc_${service}_${Date.now()}`;
      await writeDoc(`monitor_incidents/${incidentId}`, {
        service,
        label,
        severity,
        status: 'open',
        title: `${label} indisponível`,
        detail,
        startedAt: nowIso,
        resolvedAt: '',
        durationMinutes: 0,
        lastNotifiedAt: nowIso,
      });
      await writeDoc(statePath, {
        consecutiveFailures: nextFails,
        activeIncidentId: incidentId,
        updatedAt: nowIso,
      });
      if (allowTelegram) {
        const icon = severity === 'critical' ? '🚨' : '⚠️';
        await sendTelegramAlert(
          `${icon} <b>[INCIDENTE ${severity.toUpperCase()}]</b>\nServiço: <b>${label}</b>\nDetalhe: ${detail}\nInício: ${nowIso}`,
        );
      }
    } else if (activeIncidentId) {
      // Anti-spam: lembrete apenas se continuar aberto há >= 60 minutos
      const inc = await readDoc(`monitor_incidents/${activeIncidentId}`);
      const lastNotif = inc?.lastNotifiedAt
        ? Date.parse(String(inc.lastNotifiedAt))
        : 0;
      const elapsedMin = Math.round((Date.now() - lastNotif) / 60_000);
      if (allowTelegram && lastNotif > 0 && elapsedMin >= 60) {
        await writeDoc(`monitor_incidents/${activeIncidentId}`, {
          service,
          label,
          severity,
          status: 'open',
          title: String(inc?.title || `${label} indisponível`),
          detail,
          startedAt: String(inc?.startedAt || nowIso),
          resolvedAt: '',
          durationMinutes: Math.max(
            1,
            Math.round((Date.now() - Date.parse(String(inc?.startedAt || nowIso))) / 60_000),
          ),
          lastNotifiedAt: nowIso,
        });
        await sendTelegramAlert(
          `⏳ <b>[LEMBRETE INCIDENTE]</b>\n<b>${label}</b> segue fora do ar há ${elapsedMin}+ min.`,
        );
      }
      await writeDoc(statePath, {
        consecutiveFailures: nextFails,
        activeIncidentId,
        updatedAt: nowIso,
      });
    } else {
      await writeDoc(statePath, {
        consecutiveFailures: nextFails,
        activeIncidentId: '',
        updatedAt: nowIso,
      });
    }
  } else {
    // Serviço voltou ao normal
    if (activeIncidentId) {
      const inc = await readDoc(`monitor_incidents/${activeIncidentId}`);
      const startedMs = inc?.startedAt
        ? Date.parse(String(inc.startedAt))
        : Date.now();
      const durationMinutes = Math.max(
        1,
        Math.round((Date.now() - startedMs) / 60_000),
      );
      await writeDoc(`monitor_incidents/${activeIncidentId}`, {
        service,
        label,
        severity,
        status: 'resolved',
        title: String(inc?.title || `${label} indisponível`),
        detail: `Recuperado automaticamente em ${durationMinutes} min.`,
        startedAt: String(inc?.startedAt || nowIso),
        resolvedAt: nowIso,
        durationMinutes,
        lastNotifiedAt: nowIso,
      });
      if (!muted) {
        await sendTelegramAlert(
          `✅ <b>[RESOLVIDO]</b>\nServiço: <b>${label}</b>\nDuração total: <b>${durationMinutes} min</b>`,
        );
      }
    }
    if (prevFails > 0 || activeIncidentId) {
      await writeDoc(statePath, {
        consecutiveFailures: 0,
        activeIncidentId: '',
        updatedAt: nowIso,
      });
    }
  }
}

export default async function handler(req: ApiReq, res: ApiRes) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const today = todaySP();
  const nowIso = new Date().toISOString();

  // Check if alerts are temporarily muted for maintenance
  const alertCfg = await readDoc('telemetry_meta/alert_config');
  const mutedUntil = alertCfg?.mutedUntil ? Date.parse(String(alertCfg.mutedUntil)) : 0;
  const alertsMuted = mutedUntil > Date.now();

  // 1. Run parallel infrastructure probes
  const [fsProbe, gcalApiProbe, manifestProbe, siteProbe] = await Promise.all([
    runProbe(
      'firestore',
      `${FIRESTORE_BASE}/availability_slots?pageSize=300`,
      'critical',
    ),
    runProbe(
      'google_calendar',
      `${SITE_BASE}/api/google-calendar?action=status`,
      'warning',
    ),
    runProbe('pwa_manifest', `${SITE_BASE}/manifest.webmanifest`, 'warning'),
    runProbe('site_root', `${SITE_BASE}/`, 'critical'),
  ]);

  const probes = [fsProbe, gcalApiProbe, manifestProbe, siteProbe];

  // Persist individual check records in monitor_checks
  const checkBatchTs = Date.now();
  await Promise.all(
    probes.map((p) =>
      writeDoc(`monitor_checks/chk_${checkBatchTs}_${p.service}`, {
        timestamp: nowIso,
        service: p.service,
        ok: p.ok,
        latencyMs: p.latencyMs,
        statusCode: p.statusCode,
        severity: p.severity,
      }),
    ),
  );

  // 2. Agenda consistency checks (divergences + duplicates/overlaps)
  const futureAptIds: string[] = [];
  const slotsByDate: Record<string, Array<{ start: string; end: string }>> = {};
  try {
    const slotsResp = await fetch(`${FIRESTORE_BASE}/availability_slots?pageSize=300`);
    if (slotsResp.ok) {
      const data = (await slotsResp.json()) as {
        documents?: Array<{
          name: string;
          fields?: {
            active?: { booleanValue?: boolean };
            kind?: { stringValue?: string };
            date?: { stringValue?: string };
            startTime?: { stringValue?: string };
            endTime?: { stringValue?: string };
          };
        }>;
      };
      for (const doc of data.documents || []) {
        const f = doc.fields;
        const date = f?.date?.stringValue || '';
        if (
          f?.active?.booleanValue === true &&
          f?.kind?.stringValue === 'appointment' &&
          date >= today
        ) {
          futureAptIds.push(doc.name.split('/').pop() || '');
          if (!slotsByDate[date]) slotsByDate[date] = [];
          slotsByDate[date].push({
            start: f?.startTime?.stringValue || '00:00',
            end: f?.endTime?.stringValue || '00:00',
          });
        }
      }
    }
  } catch {
    // ignore
  }

  let overlappingCount = 0;
  for (const list of Object.values(slotsByDate)) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) {
        overlappingCount += 1;
      }
    }
  }

  const gcalDoc = await readDoc('integrations/google_calendar');
  const gcalConnected = Boolean(gcalDoc?.connected);
  let gcalTokenValid = false;
  if (gcalConnected && gcalDoc?.accessToken) {
    try {
      const calResp = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
        { headers: { Authorization: `Bearer ${String(gcalDoc.accessToken)}` } },
      );
      gcalTokenValid = calResp.ok;
    } catch {
      gcalTokenValid = false;
    }
  }

  const eventsMap = (await readDoc('integrations/google_calendar_events')) || {};
  let syncedToGoogleCount = 0;
  for (const id of futureAptIds) {
    if (id && eventsMap[id]) syncedToGoogleCount += 1;
  }
  const divergentCount = Math.max(0, futureAptIds.length - syncedToGoogleCount);

  // 3. Process incident engine (2 consecutive failures + Telegram)
  await Promise.all([
    processServiceIncident({
      service: 'firestore',
      label: 'Firestore Database',
      ok: fsProbe.ok,
      severity: 'critical',
      detail: `HTTP ${fsProbe.statusCode} (${fsProbe.latencyMs}ms)`,
      muted: alertsMuted,
    }),
    processServiceIncident({
      service: 'site_root',
      label: 'Site Principal',
      ok: siteProbe.ok,
      severity: 'critical',
      detail: `HTTP ${siteProbe.statusCode} (${siteProbe.latencyMs}ms)`,
      muted: alertsMuted,
    }),
    processServiceIncident({
      service: 'google_calendar',
      label: 'Google Agenda Sync',
      ok: gcalApiProbe.ok && (!gcalConnected || gcalTokenValid),
      severity: 'warning',
      detail: !gcalApiProbe.ok
        ? `API HTTP ${gcalApiProbe.statusCode}`
        : gcalConnected && !gcalTokenValid
          ? 'Token OAuth expirado/inválido'
          : 'OK',
      muted: alertsMuted,
    }),
  ]);

  await writeDoc('telemetry_meta/latest_probe', {
    checkedAt: nowIso,
    firestoreOk: fsProbe.ok,
    firestoreLatencyMs: fsProbe.latencyMs,
    gcalConnected,
    gcalTokenValid,
    gcalLatencyMs: gcalApiProbe.latencyMs,
    futureAppointmentsCount: futureAptIds.length,
    syncedToGoogleCount,
    divergentCount,
    overlappingCount,
    alertsMuted,
  });

  return res.status(200).json({
    ok: true,
    checkedAt: nowIso,
    alertsMuted,
    probes,
    consistency: {
      futureAppointmentsCount: futureAptIds.length,
      syncedToGoogleCount,
      divergentCount,
      overlappingCount,
    },
  });
}
