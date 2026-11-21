interface ApiReq {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/studio-de-beleza-8045a/databases/(default)/documents';

const DEFAULT_PBKDF2_HASHES = [
  '5abb7ec1e005098371ade6e7cf70bf6fba27195c9fe41c174c4ff9be28c15c43',
  'faba1bf7b3d55bc4fde03575c9d711c7f1a6210f9451b090e8b071032b0e4323',
];

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

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
): Promise<boolean> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: String(Math.round(v)) };
    else fields[k] = { stringValue: String(v) };
  }
  const resp = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return resp.ok;
}

function normalizeTarget(raw: unknown): 'painel' | 'owner' {
  return String(raw || '').toLowerCase() === 'owner' ? 'owner' : 'painel';
}

function getLockState(lockDoc: Record<string, unknown> | null) {
  const attempts = Number(lockDoc?.attempts || 0);
  const lockedUntil = Number(lockDoc?.lockedUntil || 0);
  const now = Date.now();
  const locked = lockedUntil > now;
  const remainingSeconds = locked ? Math.ceil((lockedUntil - now) / 1000) : 0;
  return {
    locked,
    remainingSeconds,
    attempts: locked ? MAX_ATTEMPTS : attempts,
  };
}

export default async function handler(req: ApiReq, res: ApiRes) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const target = normalizeTarget(req.query?.target);
    const lockDoc = await readDoc(`telemetry_meta/lock_${target}`);
    return res.status(200).json(getLockState(lockDoc));
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body: Record<string, unknown> = {};
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as Record<string, unknown>)
        : ((req.body as Record<string, unknown>) || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const action = String(body.action || '');
  const target = normalizeTarget(body.target);
  const vaultKey = target === 'owner' ? 'vault_owner' : 'vault_admin';

  if (action === 'verify') {
    const lockDoc = await readDoc(`telemetry_meta/lock_${target}`);
    const lockState = getLockState(lockDoc);
    if (lockState.locked) {
      return res.status(429).json({ ok: false, ...lockState });
    }

    const derivedHash = String(body.derivedHash || '').trim().toLowerCase();
    const derivedTrimmed = String(body.derivedTrimmed || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();

    const customVault = await readDoc(`telemetry_meta/${vaultKey}`);
    const customHash = String(customVault?.hash || '').trim().toLowerCase();

    let matchedHash = '';
    if (customHash) {
      if (derivedHash && derivedHash === customHash) matchedHash = derivedHash;
      else if (derivedTrimmed && derivedTrimmed === customHash)
        matchedHash = derivedTrimmed;
    } else {
      if (DEFAULT_PBKDF2_HASHES.includes(derivedHash)) matchedHash = derivedHash;
      else if (derivedTrimmed && DEFAULT_PBKDF2_HASHES.includes(derivedTrimmed))
        matchedHash = derivedTrimmed;
    }

    if (matchedHash) {
      await writeDoc(`telemetry_meta/lock_${target}`, {
        attempts: 0,
        lockedUntil: 0,
        updatedAt: new Date().toISOString(),
      });
      if (email && !customVault?.email) {
        await writeDoc(`telemetry_meta/${vaultKey}`, {
          email,
          hash: matchedHash,
          updatedAt: new Date().toISOString(),
        });
      }
      return res.status(200).json({ ok: true, matchedHash });
    }

    // Increment failed attempts
    const prevAttempts = lockDoc && Number(lockDoc.lockedUntil || 0) <= Date.now()
      ? Number(lockDoc.attempts || 0)
      : 0;
    const nextAttempts = prevAttempts + 1;
    const shouldLock = nextAttempts >= MAX_ATTEMPTS;
    const lockedUntil = shouldLock ? Date.now() + LOCK_DURATION_MS : 0;

    await writeDoc(`telemetry_meta/lock_${target}`, {
      attempts: shouldLock ? MAX_ATTEMPTS : nextAttempts,
      lockedUntil,
      updatedAt: new Date().toISOString(),
    });

    return res.status(shouldLock ? 429 : 401).json({
      ok: false,
      locked: shouldLock,
      remainingSeconds: shouldLock ? Math.ceil(LOCK_DURATION_MS / 1000) : 0,
      attempts: shouldLock ? MAX_ATTEMPTS : nextAttempts,
    });
  }

  if (action === 'update_credentials') {
    const callerAuth = String(body.callerAuthHash || '').trim().toLowerCase();
    const newEmail = String(body.newEmail || '').trim().toLowerCase();
    const newHash = String(body.newHash || '').trim().toLowerCase();

    if (!newEmail || !newEmail.includes('@') || !/^[a-f0-9]{64}$/.test(newHash)) {
      return res.status(400).json({ ok: false, error: 'E-mail ou hash inválido.' });
    }

    // Verify caller is authorized (either Owner or Admin when updating painel)
    const [ownerVault, adminVault] = await Promise.all([
      readDoc('telemetry_meta/vault_owner'),
      readDoc('telemetry_meta/vault_admin'),
    ]);

    const validOwnerHashes = [
      ...DEFAULT_PBKDF2_HASHES,
      ...(ownerVault?.hash ? [String(ownerVault.hash).toLowerCase()] : []),
    ];
    const validAdminHashes = [
      ...DEFAULT_PBKDF2_HASHES,
      ...(adminVault?.hash ? [String(adminVault.hash).toLowerCase()] : []),
    ];

    const isOwnerCaller = validOwnerHashes.includes(callerAuth);
    const isAdminCaller = validAdminHashes.includes(callerAuth);

    if (target === 'owner' && !isOwnerCaller) {
      return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    }
    if (target === 'painel' && !isOwnerCaller && !isAdminCaller) {
      return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    }

    const ok = await writeDoc(`telemetry_meta/${vaultKey}`, {
      email: newEmail,
      hash: newHash,
      updatedAt: new Date().toISOString(),
    });
    return res.status(ok ? 200 : 500).json({ ok, newHash });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
