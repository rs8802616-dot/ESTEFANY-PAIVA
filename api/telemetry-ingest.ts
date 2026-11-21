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

function computeFingerprint(message: string, route: string): string {
  const normalized = `${route}|${message}`
    .toLowerCase()
    .replace(/\d+/g, '#')
    .slice(0, 120);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp_${(hash >>> 0).toString(16)}`;
}

async function incrementDocFields(
  collection: string,
  docId: string,
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
            document: `${FIRESTORE_DOC_PREFIX}/${collection}/${docId}`,
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
  const appVersion = safeStr(body.appVersion, 32) || 'unknown';
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
      inc.cls_sum_milli = val;
      inc.cls_count = 1;
    }
    const conn = safeStr(body.connectionType, 16);
    if (conn === '4g') inc.conn_4g = 1;
    else if (conn === '3g' || conn === '2g' || conn === 'slow-2g')
      inc.conn_slow = 1;
    else if (conn) inc.conn_other = 1;
  } else if (type === 'pwa') {
    const event = safeStr(body.event, 24);
    if (event === 'installed') inc.pwa_installs = 1;
    else if (event === 'offline') inc.offline_events = 1;
  } else if (type === 'auth_failure') {
    const route = safeStr(body.route, 24);
    if (route === 'owner') inc.auth_fail_owner = 1;
    else inc.auth_fail_painel = 1;
  } else if (type === 'presence_ping' || type === 'presence_leave') {
    const anonId = safeStr(body.anonDeviceId, 40) || 'dev_anon';
    const screen = safeStr(body.screen, 40) || 'client_home';
    const dwellSec = safeInt(body.dwellSec, 7200);
    const deviceType = safeStr(body.deviceType, 16) || 'mobile';
    const referrerSource = safeStr(body.referrerSource, 16) || 'direct';
    const active = type === 'presence_ping';

    await fetch(`${FIRESTORE_BASE_URL}/telemetry_presence/${anonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          anonId: { stringValue: anonId },
          screen: { stringValue: screen },
          deviceType: { stringValue: deviceType },
          referrerSource: { stringValue: referrerSource },
          dwellSec: { integerValue: String(dwellSec) },
          active: { booleanValue: active },
          lastSeenAt: { stringValue: new Date().toISOString() },
        },
      }),
    }).catch(() => {});

    if (type === 'presence_leave' && dwellSec > 0) {
      inc.dwell_sum_sec = dwellSec;
      inc.dwell_count = 1;
    } else {
      return res.status(200).json({ ok: true });
    }
  } else if (type === 'release_session') {
    await incrementDocFields('telemetry_releases', appVersion, { sessions: 1 });
    return res.status(200).json({ ok: true });
  } else if (type === 'screen_metric') {
    const screen = safeStr(body.screen, 40) || 'client_home';
    const event = safeStr(body.event, 24);
    const count = Math.max(1, safeInt(body.count, 100));
    const screenInc: Record<string, number> = {};
    if (event === 'view') screenInc.views = 1;
    else if (event === 'api_error') screenInc.apiFailures = 1;
    else if (event === 'long_task') screenInc.longTasks = count;
    else if (event === 'rage_click') screenInc.rageClicks = 1;
    await incrementDocFields('telemetry_screens', screen, screenInc);
    return res.status(200).json({ ok: true });
  } else if (type === 'error') {
    inc.errors_total = 1;
    const msg = safeStr(body.message, 220) || 'Erro desconhecido';
    const route = safeStr(body.route, 40) || '/';
    const screen = safeStr(body.screen, 40) || 'client_home';
    const deviceType = safeStr(body.deviceType, 16) || 'unknown';
    const connectionType = safeStr(body.connectionType, 16) || 'unknown';
    const componentStack = safeStr(body.componentStack, 350);
    const nowIso = new Date().toISOString();

    const breadcrumbsJson = Array.isArray(body.breadcrumbs)
      ? JSON.stringify(body.breadcrumbs.slice(-20)).slice(0, 2200)
      : '[]';

    const fp = computeFingerprint(msg, route);

    // 1. Update grouped Issue (telemetry_issues/{fingerprint})
    try {
      const existingResp = await fetch(
        `${FIRESTORE_BASE_URL}/telemetry_issues/${fp}`,
      );
      let prevStatus = 'new';
      let prevCount = 0;
      let firstSeen = nowIso;
      if (existingResp.ok) {
        const ex = (await existingResp.json()) as {
          fields?: {
            status?: { stringValue?: string };
            count?: { integerValue?: string };
            firstSeen?: { stringValue?: string };
          };
        };
        prevStatus = ex.fields?.status?.stringValue || 'new';
        prevCount = Number(ex.fields?.count?.integerValue || 0);
        firstSeen = ex.fields?.firstSeen?.stringValue || nowIso;
      }

      const nextStatus =
        prevStatus === 'resolved' ? 'regression' : prevStatus;

      await fetch(`${FIRESTORE_BASE_URL}/telemetry_issues/${fp}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            fingerprint: { stringValue: fp },
            message: { stringValue: msg },
            route: { stringValue: route },
            screen: { stringValue: screen },
            status: { stringValue: nextStatus },
            count: { integerValue: String(prevCount + 1) },
            firstSeen: { stringValue: firstSeen },
            lastSeen: { stringValue: nowIso },
            appVersion: { stringValue: appVersion },
            deviceType: { stringValue: deviceType },
            connectionType: { stringValue: connectionType },
            componentStack: { stringValue: componentStack },
            sampleBreadcrumbs: { stringValue: breadcrumbsJson },
          },
        }),
      });
    } catch {
      // ignore
    }

    // 2. Increment screen error + release crash
    await Promise.all([
      incrementDocFields('telemetry_screens', screen, { errors: 1 }),
      incrementDocFields('telemetry_releases', appVersion, { crashes: 1 }),
    ]);

    // 3. Keep raw error event
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await fetch(`${FIRESTORE_BASE_URL}/telemetry_errors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          fingerprint: { stringValue: fp },
          message: { stringValue: msg },
          route: { stringValue: route },
          appVersion: { stringValue: appVersion },
          deviceType: { stringValue: deviceType },
          connectionType: { stringValue: connectionType },
          createdAt: { stringValue: nowIso },
        },
      }),
    }).catch(() => {});
  } else {
    return res.status(400).json({ error: 'Unknown telemetry type' });
  }

  await incrementDocFields('telemetry_daily', dateISO, inc);
  return res.status(200).json({ ok: true });
}
