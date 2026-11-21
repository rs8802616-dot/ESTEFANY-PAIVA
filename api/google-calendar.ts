interface ApiReq {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiRes {
  status: (code: number) => ApiRes;
  json: (data: unknown) => void;
  redirect: (statusOrUrl: number | string, url?: string) => void;
  setHeader: (name: string, value: string) => void;
}

const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/studio-de-beleza-8045a/databases/(default)/documents';

function getEnv(name: string): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return (proc?.env?.[name] || '').trim();
}

function getBaseUrl(req: ApiReq): string {
  const rawProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
  const rawHost = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  const proto = rawProto || 'https';
  const host = rawHost || 'estefany-paiva-nails.vercel.app';
  return `${proto}://${host}`;
}

function getQueryParam(req: ApiReq, key: string): string {
  const val = req.query?.[key];
  if (Array.isArray(val)) return String(val[0] || '');
  return String(val || '');
}

async function readFirestoreDoc(path: string): Promise<Record<string, string | number | boolean> | null> {
  const resp = await fetch(`${FIRESTORE_BASE}/${path}`);
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    fields?: Record<string, { stringValue?: string; integerValue?: string; booleanValue?: boolean }>;
  };
  if (!data.fields) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(data.fields)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
  }
  return out;
}

async function writeFirestoreDoc(
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

async function getValidAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; email: string } | null> {
  const stored = await readFirestoreDoc('integrations/google_calendar');
  if (!stored || !stored.connected || !stored.refreshToken) return null;

  const refreshToken = String(stored.refreshToken);
  const currentToken = String(stored.accessToken || '');
  const expiresAt = Number(stored.expiresAt || 0);
  const email = String(stored.email || '');

  if (currentToken && expiresAt > Date.now() + 60_000) {
    return { accessToken: currentToken, email };
  }

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!tokenResp.ok) return null;
  const tokenData = (await tokenResp.json()) as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) return null;

  await writeFirestoreDoc('integrations/google_calendar', {
    connected: true,
    email,
    refreshToken,
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + Number(tokenData.expires_in || 3500) * 1000,
    updatedAt: new Date().toISOString(),
  });

  return { accessToken: tokenData.access_token, email };
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  const action = getQueryParam(req, 'action');
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  const configured = Boolean(clientId && clientSecret);
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/api/google-calendar?action=callback`;

  if (action === 'status') {
    const stored = await readFirestoreDoc('integrations/google_calendar').catch(() => null);
    res.status(200).json({
      configured,
      connected: Boolean(stored?.connected && stored?.refreshToken),
      email: stored?.connected ? String(stored.email || '') : null,
    });
    return;
  }

  if (action === 'auth-url') {
    if (!configured) {
      res.redirect(302, '/painel?gcal=missing_env');
      return;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'select_account consent',
      include_granted_scopes: 'true',
    });
    res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    return;
  }

  if (action === 'callback') {
    const code = getQueryParam(req, 'code');
    if (!code || !configured) {
      res.redirect(302, '/painel?gcal=error');
      return;
    }

    try {
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tokenData = (await tokenResp.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        error?: string;
      };
      if (!tokenResp.ok || !tokenData.access_token) {
        res.redirect(302, `/painel?gcal=error&reason=${encodeURIComponent(tokenData.error || 'token_failed')}`);
        return;
      }

      if (!String(tokenData.scope || '').includes('calendar')) {
        res.redirect(302, '/painel?gcal=error&reason=marque_a_caixinha_do_google_agenda');
        return;
      }

      const existing = await readFirestoreDoc('integrations/google_calendar').catch(() => null);
      const refreshToken = tokenData.refresh_token || String(existing?.refreshToken || '');
      if (!refreshToken) {
        res.redirect(302, '/painel?gcal=error&reason=no_refresh_token');
        return;
      }

      const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = (await userResp.json().catch(() => ({}))) as { email?: string };

      const savedOk = await writeFirestoreDoc('integrations/google_calendar', {
        connected: true,
        email: String(userData.email || ''),
        refreshToken,
        accessToken: tokenData.access_token,
        expiresAt: Date.now() + Number(tokenData.expires_in || 3500) * 1000,
        updatedAt: new Date().toISOString(),
      });

      if (!savedOk) {
        res.redirect(302, '/painel?gcal=error&reason=firestore_save_failed');
        return;
      }

      res.redirect(302, '/painel?gcal=connected');
    } catch {
      res.redirect(302, '/painel?gcal=error');
    }
    return;
  }

  if (action === 'disconnect' && req.method === 'POST') {
    await writeFirestoreDoc('integrations/google_calendar', {
      connected: false,
      email: '',
      refreshToken: '',
      accessToken: '',
      expiresAt: 0,
      updatedAt: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
    return;
  }

  if (action === 'sync-event' && req.method === 'POST') {
    if (!configured) {
      res.status(200).json({ ok: false, skipped: true, reason: 'missing_env' });
      return;
    }

    const authToken = await getValidAccessToken(clientId, clientSecret);
    if (!authToken) {
      res.status(200).json({ ok: false, skipped: true, reason: 'not_connected' });
      return;
    }

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as {
      appointmentId?: string;
      clientName?: string;
      clientPhone?: string;
      serviceNames?: string[];
      date?: string;
      startTime?: string;
      endTime?: string;
      totalPrice?: number;
      status?: string;
      notes?: string;
      studioName?: string;
      address?: string;
    };

    const appointmentId = String(body.appointmentId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!appointmentId || !body.date || !body.startTime) {
      res.status(400).json({ ok: false, error: 'invalid_payload' });
      return;
    }

    const mappingDoc = await readFirestoreDoc(`google_calendar_events/${appointmentId}`).catch(() => null);
    const existingEventId = mappingDoc?.googleEventId ? String(mappingDoc.googleEventId) : '';

    if (body.status === 'cancelled') {
      if (existingEventId) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken.accessToken}` },
          },
        );
      }
      res.status(200).json({ ok: true, deleted: true });
      return;
    }

    const servicesLabel = Array.isArray(body.serviceNames) && body.serviceNames.length > 0
      ? body.serviceNames.join(' + ')
      : 'Atendimento';
    const endTime = body.endTime || body.startTime;

    const eventPayload = {
      summary: `${body.clientName || 'Cliente'} — ${servicesLabel}`,
      location: body.address || body.studioName || '',
      description: [
        `Cliente: ${body.clientName || 'Cliente'}`,
        `WhatsApp: ${body.clientPhone || '-'}`,
        `Serviços: ${servicesLabel}`,
        `Valor: R$ ${Number(body.totalPrice || 0).toFixed(2).replace('.', ',')}`,
        `Status: ${body.status || 'pending'}`,
        body.notes ? `Obs: ${body.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      start: {
        dateTime: `${body.date}T${body.startTime}:00-03:00`,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: `${body.date}T${endTime}:00-03:00`,
        timeZone: 'America/Sao_Paulo',
      },
    };

    const targetUrl = existingEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const gcalResp = await fetch(targetUrl, {
      method: existingEventId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${authToken.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!gcalResp.ok) {
      res.status(200).json({ ok: false, error: 'gcal_api_error' });
      return;
    }

    const created = (await gcalResp.json()) as { id?: string };
    if (created.id) {
      await writeFirestoreDoc(`google_calendar_events/${appointmentId}`, {
        googleEventId: created.id,
        updatedAt: new Date().toISOString(),
      });
    }

    res.status(200).json({ ok: true, googleEventId: created.id || existingEventId });
    return;
  }

  res.status(400).json({ ok: false, error: 'unknown_action' });
}
