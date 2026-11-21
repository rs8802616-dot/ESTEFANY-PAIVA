interface ApiReq {
  method?: string;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/studio-de-beleza-8045a/databases/(default)/documents';

function todaySP(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function readDoc(path: string): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(`${FIRESTORE_BASE}/${path}`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      fields?: Record<
        string,
        { stringValue?: string; booleanValue?: boolean; integerValue?: string }
      >;
    };
    if (!data.fields) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.fields)) {
      if (v.stringValue !== undefined) out[k] = v.stringValue;
      else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
      else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
    }
    return out;
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

async function syncIncident(
  incidentId: string,
  hasProblem: boolean,
  title: string,
  detail: string,
): Promise<void> {
  const existing = await readDoc(`telemetry_incidents/${incidentId}`);
  const nowIso = new Date().toISOString();

  if (hasProblem) {
    if (!existing || existing.status !== 'open') {
      await writeDoc(`telemetry_incidents/${incidentId}`, {
        title,
        detail,
        status: 'open',
        startedAt: nowIso,
        resolvedAt: '',
        updatedAt: nowIso,
      });
    } else {
      await writeDoc(`telemetry_incidents/${incidentId}`, {
        title,
        detail,
        status: 'open',
        startedAt: String(existing.startedAt || nowIso),
        resolvedAt: '',
        updatedAt: nowIso,
      });
    }
  } else if (existing && existing.status === 'open') {
    await writeDoc(`telemetry_incidents/${incidentId}`, {
      title: String(existing.title || title),
      detail: 'Normalizado automaticamente na sondagem do servidor.',
      status: 'resolved',
      startedAt: String(existing.startedAt || nowIso),
      resolvedAt: nowIso,
      updatedAt: nowIso,
    });
  }
}

export default async function handler(req: ApiReq, res: ApiRes) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const today = todaySP();
  const nowIso = new Date().toISOString();

  // 1. Firestore probe + future active appointments
  const fsStart = Date.now();
  let firestoreOk = false;
  const futureAptIds: string[] = [];
  try {
    const slotsResp = await fetch(`${FIRESTORE_BASE}/availability_slots?pageSize=300`);
    firestoreOk = slotsResp.ok;
    if (slotsResp.ok) {
      const data = (await slotsResp.json()) as {
        documents?: Array<{
          name: string;
          fields?: {
            active?: { booleanValue?: boolean };
            kind?: { stringValue?: string };
            date?: { stringValue?: string };
          };
        }>;
      };
      for (const doc of data.documents || []) {
        const f = doc.fields;
        if (
          f?.active?.booleanValue === true &&
          f?.kind?.stringValue === 'appointment' &&
          (f?.date?.stringValue || '') >= today
        ) {
          futureAptIds.push(doc.name.split('/').pop() || '');
        }
      }
    }
  } catch {
    firestoreOk = false;
  }
  const firestoreLatencyMs = Date.now() - fsStart;

  // 2. Google Calendar divergence & token check
  const gcalDoc = await readDoc('integrations/google_calendar');
  const gcalConnected = Boolean(gcalDoc?.connected);
  let gcalTokenValid = false;
  let gcalLatencyMs = 0;

  if (gcalConnected && gcalDoc?.accessToken) {
    try {
      const gStart = Date.now();
      const calResp = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
        {
          headers: { Authorization: `Bearer ${String(gcalDoc.accessToken)}` },
        },
      );
      gcalLatencyMs = Date.now() - gStart;
      gcalTokenValid = calResp.ok;
    } catch {
      gcalTokenValid = false;
    }
  }

  const eventsMap = (await readDoc('integrations/google_calendar_events')) || {};
  let syncedToGoogleCount = 0;
  for (const id of futureAptIds) {
    if (id && eventsMap[id]) {
      syncedToGoogleCount += 1;
    }
  }
  const divergentCount = Math.max(0, futureAptIds.length - syncedToGoogleCount);

  // 3. Persist server probe & update incidents
  await writeDoc('telemetry_meta/latest_probe', {
    checkedAt: nowIso,
    firestoreOk,
    firestoreLatencyMs,
    gcalConnected,
    gcalTokenValid,
    gcalLatencyMs,
    futureAppointmentsCount: futureAptIds.length,
    syncedToGoogleCount,
    divergentCount,
  });

  await Promise.all([
    syncIncident(
      'inc_firestore',
      !firestoreOk,
      'Falha de conexão com Firestore',
      'A sondagem automática do servidor não conseguiu ler availability_slots.',
    ),
    syncIncident(
      'inc_gcal_auth',
      !gcalConnected,
      'Google Agenda desconectado',
      'Sincronização automática pausada até reconexão no /painel.',
    ),
    syncIncident(
      'inc_gcal_divergence',
      gcalConnected && divergentCount > 0,
      'Divergência Firestore ↔ Google Agenda',
      `${divergentCount} agendamento(s) futuro(s) no Firestore ainda sem evento correspondente no Google Agenda.`,
    ),
  ]);

  return res.status(200).json({
    ok: true,
    checkedAt: nowIso,
    firestoreOk,
    firestoreLatencyMs,
    gcalConnected,
    gcalTokenValid,
    gcalLatencyMs,
    futureAppointmentsCount: futureAptIds.length,
    syncedToGoogleCount,
    divergentCount,
  });
}
