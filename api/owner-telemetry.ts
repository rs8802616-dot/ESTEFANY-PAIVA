interface ApiReq {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/studio-de-beleza-8045a/databases/(default)/documents';

const ALLOWED_OWNER_HASHES = [
  '5abb7ec1e005098371ade6e7cf70bf6fba27195c9fe41c174c4ff9be28c15c43',
  'faba1bf7b3d55bc4fde03575c9d711c7f1a6210f9451b090e8b071032b0e4323',
];

function getEnv(name: string): string {
  const proc = (
    globalThis as {
      process?: { env?: Record<string, string | undefined>; version?: string };
    }
  ).process;
  return (proc?.env?.[name] || '').trim();
}

function getNodeVersion(): string {
  const proc = (globalThis as { process?: { version?: string } }).process;
  return proc?.version || 'unknown';
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

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  return `${parts[0].slice(0, 2)}***@${parts[1]}`;
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

async function listCollectionDocs(
  collectionName: string,
  pageSize = 100,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  try {
    const resp = await fetch(
      `${FIRESTORE_BASE}/${collectionName}?pageSize=${pageSize}`,
    );
    if (!resp.ok) return [];
    const payload = (await resp.json()) as {
      documents?: Array<{ name: string; fields?: FirestoreFields }>;
    };
    return (payload.documents || []).map((d) => ({
      id: d.name.split('/').pop() || '',
      data: parseFields(d.fields),
    }));
  } catch {
    return [];
  }
}

async function readDoc(path: string): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(`${FIRESTORE_BASE}/${path}`);
    if (!resp.ok) return null;
    const payload = (await resp.json()) as { fields?: FirestoreFields };
    return parseFields(payload.fields);
  } catch {
    return null;
  }
}

export default async function handler(req: ApiReq, res: ApiRes) {
  res.setHeader('Cache-Control', 'no-store');

  // Server-side owner session verification
  const rawAuthHeader = req.headers['x-owner-auth'];
  const ownerAuth = Array.isArray(rawAuthHeader)
    ? rawAuthHeader[0]
    : rawAuthHeader || '';
  if (!ALLOWED_OWNER_HASHES.includes(ownerAuth.trim())) {
    return res.status(401).json({ error: 'Unauthorized owner telemetry request' });
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown> = {};
    try {
      body =
        typeof req.body === 'string'
          ? (JSON.parse(req.body) as Record<string, unknown>)
          : ((req.body as Record<string, unknown>) || {});
    } catch {
      body = {};
    }
    if (body.action === 'update_issue') {
      const fp = String(body.fingerprint || '').trim();
      const status = String(body.status || '').trim();
      const allowed = ['new', 'investigating', 'resolved', 'ignored', 'regression'];
      if (!fp || !allowed.includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid issue update' });
      }
      const patchResp = await fetch(
        `${FIRESTORE_BASE}/telemetry_issues/${fp}?updateMask.fieldPaths=status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { status: { stringValue: status } },
          }),
        },
      );
      return res.status(patchResp.ok ? 200 : 500).json({ ok: patchResp.ok });
    }

    if (body.action === 'test_telegram') {
      const botToken = getEnv('TELEGRAM_BOT_TOKEN');
      const chatId = getEnv('TELEGRAM_CHAT_ID');
      if (!botToken || !chatId) {
        return res.status(400).json({
          ok: false,
          error: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados na Vercel.',
        });
      }
      const tgResp = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ <b>[TESTE NOC]</b>\nAlerta de teste disparado pelo Console do Dono em ${new Date().toISOString()}.`,
            parse_mode: 'HTML',
          }),
        },
      );
      return res.status(tgResp.ok ? 200 : 502).json({ ok: tgResp.ok });
    }

    const minutes = Math.max(0, Math.min(1440, Number(body.muteMinutes || 0)));
    const mutedUntil =
      minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : '';
    await fetch(`${FIRESTORE_BASE}/telemetry_meta/alert_config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          mutedUntil: { stringValue: mutedUntil },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });
    return res.status(200).json({ ok: true, mutedUntil });
  }

  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  const today = todaySP();

  const fsStart = Date.now();
  const [
    servicesDocs,
    categoriesDocs,
    slotsDocs,
    blocksDocs,
    dailyDocs,
    errorDocs,
    issueDocs,
    screenDocs,
    releaseDocs,
    presenceDocs,
    incidentDocs,
    monitorChecksDocs,
    alertConfigDoc,
    latestProbe,
    gcalDoc,
    eventsMapDoc,
  ] = await Promise.all([
    listCollectionDocs('services', 200),
    listCollectionDocs('categories', 100),
    listCollectionDocs('availability_slots', 300),
    listCollectionDocs('personal_blocks', 200),
    listCollectionDocs('telemetry_daily', 30),
    listCollectionDocs('telemetry_errors', 30),
    listCollectionDocs('telemetry_issues', 50),
    listCollectionDocs('telemetry_screens', 30),
    listCollectionDocs('telemetry_releases', 20),
    listCollectionDocs('telemetry_presence', 100),
    listCollectionDocs('monitor_incidents', 40),
    listCollectionDocs('monitor_checks', 200),
    readDoc('telemetry_meta/alert_config'),
    readDoc('telemetry_meta/latest_probe'),
    readDoc('integrations/google_calendar'),
    readDoc('integrations/google_calendar_events'),
  ]);
  const firestoreServerLatencyMs = Date.now() - fsStart;

  // Divergence Firestore <-> Google Calendar (future active appointments)
  const futureAptIds = slotsDocs
    .filter(
      (s) =>
        s.data.active === true &&
        s.data.kind === 'appointment' &&
        String(s.data.date || '') >= today,
    )
    .map((s) => s.id);

  const eventsMap = eventsMapDoc || {};
  let syncedToGoogleCount = 0;
  for (const id of futureAptIds) {
    if (id && eventsMap[id]) syncedToGoogleCount += 1;
  }
  const divergentCount = Math.max(0, futureAptIds.length - syncedToGoogleCount);

  // Google Calendar token check
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  const configured = Boolean(clientId && clientSecret);
  const gcalConnected = Boolean(gcalDoc?.connected);
  const gcalUpdatedAt = gcalDoc?.updatedAt ? String(gcalDoc.updatedAt) : null;
  const gcalAccountMasked = gcalDoc?.email
    ? maskEmail(String(gcalDoc.email))
    : null;
  let gcalTokenValid = false;
  let gcalLatencyMs: number | null = null;

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

  const dailyTelemetry = dailyDocs
    .map((d) => ({ date: d.id, ...d.data }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const recentErrors = errorDocs
    .map((e) => ({ id: e.id, ...e.data }))
    .sort((a, b) =>
      String((b as { createdAt?: string }).createdAt || '').localeCompare(
        String((a as { createdAt?: string }).createdAt || ''),
      ),
    )
    .slice(0, 15);

  const incidents = incidentDocs
    .map((inc) => ({ id: inc.id, ...inc.data }))
    .sort((a, b) =>
      String((b as { startedAt?: string }).startedAt || '').localeCompare(
        String((a as { startedAt?: string }).startedAt || ''),
      ),
    );

  // Server-side Uptime %, P95 Latency & MTTR from monitor_checks + monitor_incidents
  const sortedChecks = monitorChecksDocs
    .map((c) => c.data)
    .sort((a, b) =>
      String(b.timestamp || '').localeCompare(String(a.timestamp || '')),
    );
  const totalChecks = sortedChecks.length;
  const okChecks = sortedChecks.filter((c) => c.ok === true).length;
  const serverUptimePct =
    totalChecks > 0 ? Math.round((okChecks / totalChecks) * 1000) / 10 : null;

  const fsCheckLatencies = sortedChecks
    .filter((c) => c.service === 'firestore' && Number(c.latencyMs) > 0)
    .map((c) => Number(c.latencyMs))
    .sort((a, b) => a - b);
  const serverP95Ms =
    fsCheckLatencies.length > 0
      ? fsCheckLatencies[
          Math.min(
            fsCheckLatencies.length - 1,
            Math.floor(fsCheckLatencies.length * 0.95),
          )
        ]
      : null;

  const resolvedIncidents = incidents.filter(
    (inc) =>
      (inc as { status?: string }).status === 'resolved' &&
      Number((inc as { durationMinutes?: number }).durationMinutes || 0) > 0,
  );
  const mttrMinutes =
    resolvedIncidents.length > 0
      ? Math.round(
          resolvedIncidents.reduce(
            (acc, inc) =>
              acc + Number((inc as { durationMinutes?: number }).durationMinutes || 0),
            0,
          ) / resolvedIncidents.length,
        )
      : null;

  const mutedUntilStr = alertConfigDoc?.mutedUntil
    ? String(alertConfigDoc.mutedUntil)
    : '';
  const alertsMuted = mutedUntilStr ? Date.parse(mutedUntilStr) > Date.now() : false;

  const issues = issueDocs
    .map((d) => ({ id: d.id, ...d.data }))
    .sort((a, b) =>
      String((b as { lastSeen?: string }).lastSeen || '').localeCompare(
        String((a as { lastSeen?: string }).lastSeen || ''),
      ),
    );

  const screens = screenDocs.map((d) => ({
    screen: d.id,
    views: Number(d.data.views || 0),
    errors: Number(d.data.errors || 0),
    apiFailures: Number(d.data.apiFailures || 0),
    longTasks: Number(d.data.longTasks || 0),
    rageClicks: Number(d.data.rageClicks || 0),
  }));

  const releases = releaseDocs
    .map((d) => {
      const sessions = Number(d.data.sessions || 0);
      const crashes = Number(d.data.crashes || 0);
      const crashFreePct =
        sessions > 0
          ? Math.max(0, Math.round(((sessions - crashes) / sessions) * 1000) / 10)
          : 100;
      return {
        version: d.id,
        sessions,
        crashes,
        crashFreePct,
      };
    })
    .sort((a, b) => b.version.localeCompare(a.version));

  // SLO 99.9% (43.2 min monthly error budget)
  const monthPrefix = today.slice(0, 7);
  const monthlyDowntimeMin = incidents
    .filter(
      (inc) =>
        (inc as { severity?: string }).severity === 'critical' &&
        String((inc as { startedAt?: string }).startedAt || '').startsWith(monthPrefix),
    )
    .reduce(
      (acc, inc) => acc + Number((inc as { durationMinutes?: number }).durationMinutes || 0),
      0,
    );
  const monthlyBudgetMin = 43.2;
  const remainingBudgetMin = Math.max(0, Math.round((monthlyBudgetMin - monthlyDowntimeMin) * 10) / 10);
  const remainingBudgetPct = Math.max(
    0,
    Math.round((remainingBudgetMin / monthlyBudgetMin) * 1000) / 10,
  );

  // Real-Time Presence & Dwell Time (active within last 120 seconds, Zero PII)
  const nowMs = Date.now();
  const activeSessions = presenceDocs
    .map((d) => {
      const screen = String(d.data.screen || 'client_home');
      const inferredRole =
        String(d.data.role || '') ||
        (screen === 'painel_admin'
          ? 'admin'
          : screen === 'owner_console'
            ? 'owner'
            : 'client');
      return {
        idShort: String(d.data.anonId || d.id).slice(-6),
        role: inferredRole,
        screen,
        deviceType: String(d.data.deviceType || 'mobile'),
        deviceLabel: String(d.data.deviceLabel || d.data.deviceType || 'mobile'),
        referrerSource: String(d.data.referrerSource || 'direct'),
        dwellSec: Number(d.data.dwellSec || 0),
        active: d.data.active !== false,
        lastSeenAt: String(d.data.lastSeenAt || ''),
      };
    })
    .filter((s) => {
      const ts = s.lastSeenAt ? Date.parse(s.lastSeenAt) : 0;
      return s.active && nowMs - ts <= 120_000;
    })
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  const onlineNow = activeSessions.length;
  const onlineClientLink = activeSessions.filter((s) => s.role === 'client').length;
  const onlineAdminLink = activeSessions.filter((s) => s.role === 'admin').length;
  const onlineOwnerLink = activeSessions.filter((s) => s.role === 'owner').length;
  const onlineMobile = activeSessions.filter((s) => s.deviceType === 'mobile').length;
  const onlineDesktop = activeSessions.filter((s) => s.deviceType === 'desktop').length;

  const todayStats = dailyTelemetry.find((d) => d.date === today) as
    | Record<string, number | string>
    | undefined;
  const visitsToday = Number(todayStats?.funnel_visit || 0);
  const visits7d = dailyTelemetry.reduce(
    (acc, r) => acc + Number((r as Record<string, unknown>).funnel_visit || 0),
    0,
  );
  const dwellSumToday = Number(todayStats?.dwell_sum_sec || 0);
  const dwellCntToday = Number(todayStats?.dwell_count || 0);
  const avgDwellSecToday =
    dwellCntToday > 0 ? Math.round(dwellSumToday / dwellCntToday) : null;

  const dwellSum7d = dailyTelemetry.reduce(
    (acc, r) => acc + Number((r as Record<string, unknown>).dwell_sum_sec || 0),
    0,
  );
  const dwellCnt7d = dailyTelemetry.reduce(
    (acc, r) => acc + Number((r as Record<string, unknown>).dwell_count || 0),
    0,
  );
  const avgDwellSec7d =
    dwellCnt7d > 0 ? Math.round(dwellSum7d / dwellCnt7d) : null;

  // Estimated daily Firestore usage vs Spark free quota (50,000 reads / 20,000 writes)
  const bookingsToday = Number(todayStats?.funnel_confirmed || 0);
  const estimatedReadsToday = Math.max(
    50,
    visitsToday * 18 + bookingsToday * 12 + 40,
  );
  const estimatedWritesToday = Math.max(
    10,
    visitsToday * 2 + bookingsToday * 6,
  );

  return res.status(200).json({
    ok: true,
    lgpdMode: 'ZERO_PII_SERVER_TELEMETRY',
    serverTimestamp: new Date().toISOString(),
    totalDurationMs: Date.now() - startedAt,
    runtime: {
      nodeVersion: getNodeVersion(),
      vercelEnv: getEnv('VERCEL_ENV') || 'development',
      vercelRegion: getEnv('VERCEL_REGION') || 'local',
      commitSha: (getEnv('VERCEL_GIT_COMMIT_SHA') || '').slice(0, 7) || null,
    },
    firestore: {
      reachable: true,
      latencyMs: firestoreServerLatencyMs,
      counts: {
        services: servicesDocs.length,
        categories: categoriesDocs.length,
        availabilitySlots: slotsDocs.length,
        personalBlocks: blocksDocs.length,
      },
      quotaEstimate: {
        estimatedReadsToday,
        freeReadsLimit: 50_000,
        readsPct: Math.min(100, Math.round((estimatedReadsToday / 50_000) * 1000) / 10),
        estimatedWritesToday,
        freeWritesLimit: 20_000,
        writesPct: Math.min(100, Math.round((estimatedWritesToday / 20_000) * 1000) / 10),
      },
    },
    googleCalendar: {
      configured,
      connected: gcalConnected,
      tokenValid: gcalTokenValid,
      scopeOk: gcalTokenValid,
      latencyMs: gcalLatencyMs,
      accountMasked: gcalAccountMasked,
      updatedAt: gcalUpdatedAt,
      futureAppointmentsCount: futureAptIds.length,
      syncedToGoogleCount,
      divergentCount,
    },
    dailyTelemetry,
    recentErrors,
    issues,
    screens,
    releases,
    realtime: {
      onlineNow,
      onlineClientLink,
      onlineAdminLink,
      onlineOwnerLink,
      onlineMobile,
      onlineDesktop,
      visitsToday,
      visits7d,
      avgDwellSecToday,
      avgDwellSec7d,
      activeSessions: activeSessions.slice(0, 30),
    },
    slo: {
      targetPct: 99.9,
      monthlyBudgetMin,
      consumedMin: monthlyDowntimeMin,
      remainingBudgetMin,
      remainingBudgetPct,
    },
    incidents,
    recentChecks: sortedChecks.slice(0, 80),
    serverMonitorStats: {
      totalChecks,
      serverUptimePct,
      serverP95Ms,
      mttrMinutes,
      alertsMuted,
      mutedUntil: mutedUntilStr || null,
      telegramConfigured: Boolean(
        getEnv('TELEGRAM_BOT_TOKEN') && getEnv('TELEGRAM_CHAT_ID'),
      ),
    },
    latestProbe,
  });
}
