interface ApiReq {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
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
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Server-side owner session verification
  const rawAuthHeader = req.headers['x-owner-auth'];
  const ownerAuth = Array.isArray(rawAuthHeader)
    ? rawAuthHeader[0]
    : rawAuthHeader || '';
  if (!ALLOWED_OWNER_HASHES.includes(ownerAuth.trim())) {
    return res.status(401).json({ error: 'Unauthorized owner telemetry request' });
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
    incidentDocs,
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
    listCollectionDocs('telemetry_incidents', 30),
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
      String((b as { updatedAt?: string }).updatedAt || '').localeCompare(
        String((a as { updatedAt?: string }).updatedAt || ''),
      ),
    );

  // Estimated daily Firestore usage vs Spark free quota (50,000 reads / 20,000 writes)
  const todayStats = dailyTelemetry.find((d) => d.date === today) as
    | Record<string, number | string>
    | undefined;
  const visitsToday = Number(todayStats?.funnel_visit || 0);
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
    incidents,
    latestProbe,
  });
}
