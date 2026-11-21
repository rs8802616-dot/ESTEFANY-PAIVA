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

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const domain = parts[1];
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

async function countCollectionDocs(collectionName: string): Promise<number | null> {
  try {
    const resp = await fetch(`${FIRESTORE_BASE}/${collectionName}?pageSize=300`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { documents?: unknown[] };
    return Array.isArray(data.documents) ? data.documents.length : 0;
  } catch {
    return null;
  }
}

export default async function handler(req: ApiReq, res: ApiRes) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();

  // 1. Firestore server-side latency & collection counts (zero PII)
  const fsStart = Date.now();
  const [servicesCount, categoriesCount, slotsCount, blocksCount] =
    await Promise.all([
      countCollectionDocs('services'),
      countCollectionDocs('categories'),
      countCollectionDocs('availability_slots'),
      countCollectionDocs('personal_blocks'),
    ]);
  const firestoreServerLatencyMs = Date.now() - fsStart;

  // 2. Google Calendar integration health (zero tokens exposed)
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  const configured = Boolean(clientId && clientSecret);

  let gcalConnected = false;
  let gcalTokenValid = false;
  let gcalScopeOk = false;
  let gcalLatencyMs: number | null = null;
  let gcalUpdatedAt: string | null = null;
  let gcalAccountMasked: string | null = null;

  try {
    const gcalDocResp = await fetch(
      `${FIRESTORE_BASE}/integrations/google_calendar`,
    );
    if (gcalDocResp.ok) {
      const docData = (await gcalDocResp.json()) as {
        fields?: Record<
          string,
          { stringValue?: string; booleanValue?: boolean }
        >;
      };
      const fields = docData.fields || {};
      gcalConnected = Boolean(fields.connected?.booleanValue);
      gcalUpdatedAt = fields.updatedAt?.stringValue || null;
      const rawEmail = fields.email?.stringValue || '';
      gcalAccountMasked = rawEmail ? maskEmail(rawEmail) : null;
      const token = fields.accessToken?.stringValue || '';

      if (gcalConnected && token) {
        const gStart = Date.now();
        const calResp = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        gcalLatencyMs = Date.now() - gStart;
        gcalTokenValid = calResp.ok;
        gcalScopeOk = calResp.ok;
      }
    }
  } catch {
    // ignore
  }

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
      reachable: servicesCount !== null,
      latencyMs: firestoreServerLatencyMs,
      counts: {
        services: servicesCount,
        categories: categoriesCount,
        availabilitySlots: slotsCount,
        personalBlocks: blocksCount,
      },
    },
    googleCalendar: {
      configured,
      connected: gcalConnected,
      tokenValid: gcalTokenValid,
      scopeOk: gcalScopeOk,
      latencyMs: gcalLatencyMs,
      accountMasked: gcalAccountMasked,
      updatedAt: gcalUpdatedAt,
    },
  });
}
