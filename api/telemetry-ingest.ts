interface ApiReq {
  method?: string;
  body?: unknown;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const FIRESTORE_DOC_PREFIX =
  'projects/studio-de-beleza-8045a/databases/(default)/documents';
const FIRESTORE_COMMIT_URL = `https://firestore.googleapis.com/v1/${FIRESTORE_DOC_PREFIX}:commit`;
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/${FIRESTORE_DOC_PREFIX}`;

function todaySP(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function safeStr(val: unknown, max = 160): string {
  if (typeof val !== 'string') return '';
  // Remove dígitos longos (ex.: telefones) e e-mails por segurança LGPD
  return val
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]')
    .replace(/\d{8,}/g, '[num]')
    .trim()
    .slice(0, max);
}

function safeInt(val: unknown, max = 1_000_000): number {
  const n = Math.round(Number(val) || 0);
  if (n < 0) return 0;
  return Math.min(n, max);
}

async function incrementDailyFields(
  dateISO: string,
  increments: Record<string, number>,
): Promise<boolean> {
  const fieldTransforms = Object.entries(increments)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .map(([fieldPath, val]) => ({
      fieldPath,
      increment: { integerValue: String(Math.round(val)) },
    }));

  if (fieldTransforms.length === 0) return true;

  const resp = await fetch(FIRESTORE_COMMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: `${FIRESTORE_DOC_PREFIX}/telemetry_daily/${dateISO}`,
            fieldTransforms,
          },
        },
      ],
    }),
  });
  return resp.ok;
}

export default async function handler(req: ApiReq, res: ApiRes) {
  res.setHeader('Cache-Control', 'no-store');
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

  const type = safeStr(body.type, 32);
  const dateISO = todaySP();
  const inc: Record<string, number> = {};

  if (type === 'funnel') {
    const step = safeStr(body.step, 32);
    if (step === 'visit') inc.funnel_visit = 1;
    else if (step === 'service_selected') inc.funnel_service = 1;
    else if (step === 'slot_selected') inc.funnel_slot = 1;
    else if (step === 'booking_confirmed') {
      inc.funnel_confirmed = 1;
      const dur = safeInt(body.durationSec, 3600);
      if (dur > 0) {
        inc.booking_duration_sum_sec = dur;
        inc.booking_duration_count = 1;
      }
    } else if (step === 'booking_failed') {
      inc.funnel_failed = 1;
    }

    const dev = safeStr(body.deviceType, 16);
    if (dev === 'mobile') inc.device_mobile = 1;
    else if (dev === 'desktop') inc.device_desktop = 1;

    const src = safeStr(body.referrerSource, 16);
    if (src === 'instagram') inc.src_instagram = 1;
    else if (src === 'whatsapp') inc.src_whatsapp = 1;
    else if (src === 'direct') inc.src_direct = 1;
    else if (src) inc.src_other = 1;
  } else if (type === 'web_vitals') {
    const metric = safeStr(body.metric, 16);
    const val = safeInt(body.value, 60_000);
    if (metric === 'LCP' && val > 0) {
      inc.lcp_sum_ms = val;
      inc.lcp_count = 1;
    } else if (metric === 'INP' && val > 0) {
      inc.inp_sum_ms = val;
      inc.inp_count = 1;
    } else if (metric === 'CLS') {
      // CLS multiplicado por 1000 para armazenar como inteiro (ex.: 0.05 -> 50)
      inc.cls_sum_milli = val;
      inc.cls_count = 1;
    }
    const conn = safeStr(body.connectionType, 16);
    if (conn === '4g') inc.conn_4g = 1;
    else if (conn === '3g' || conn === '2g' || conn === 'slow-2g') inc.conn_slow = 1;
    else if (conn) inc.conn_other = 1;
  } else if (type === 'pwa') {
    const event = safeStr(body.event, 24);
    if (event === 'installed') inc.pwa_installs = 1;
    else if (event === 'offline') inc.offline_events = 1;
  } else if (type === 'auth_failure') {
    const route = safeStr(body.route, 24);
    if (route === 'owner') inc.auth_fail_owner = 1;
    else inc.auth_fail_painel = 1;
  } else if (type === 'error') {
    inc.errors_total = 1;
    const msg = safeStr(body.message, 220) || 'Erro desconhecido';
    const route = safeStr(body.route, 40) || '/';
    const appVersion = safeStr(body.appVersion, 32) || 'unknown';
    const deviceType = safeStr(body.deviceType, 16) || 'unknown';
    const connectionType = safeStr(body.connectionType, 16) || 'unknown';
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await fetch(`${FIRESTORE_BASE_URL}/telemetry_errors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          message: { stringValue: msg },
          route: { stringValue: route },
          appVersion: { stringValue: appVersion },
          deviceType: { stringValue: deviceType },
          connectionType: { stringValue: connectionType },
          createdAt: { stringValue: new Date().toISOString() },
        },
      }),
    }).catch(() => {});
  } else {
    return res.status(400).json({ error: 'Unknown telemetry type' });
  }

  await incrementDailyFields(dateISO, inc);
  return res.status(200).json({ ok: true });
}
