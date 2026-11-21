const APP_VERSION = 'v86-realtime-noc';
const ANON_DEVICE_KEY = 'epn_anon_device_id_v1';

let telemetryInitialized = false;
let funnelStartTs = 0;

export interface Breadcrumb {
  t: string;
  cat: 'nav' | 'ui' | 'net' | 'console' | 'perf';
  msg: string;
}

const breadcrumbs: Breadcrumb[] = [];

function pushBreadcrumb(cat: Breadcrumb['cat'], msg: string): void {
  breadcrumbs.push({
    t: new Date().toISOString().slice(11, 19),
    cat,
    msg: msg.slice(0, 120),
  });
  if (breadcrumbs.length > 20) {
    breadcrumbs.shift();
  }
}

function getAnonDeviceId(): string {
  try {
    let id = localStorage.getItem(ANON_DEVICE_KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      localStorage.setItem(ANON_DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_anon';
  }
}

function getDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? 'mobile'
    : 'desktop';
}

function getConnectionType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
  };
  return nav.connection?.effectiveType || 'unknown';
}

function getReferrerSource(): 'instagram' | 'whatsapp' | 'direct' | 'other' {
  if (typeof document === 'undefined') return 'direct';
  const ref = (document.referrer || '').toLowerCase();
  const search = (window.location.search || '').toLowerCase();
  if (
    ref.includes('instagram') ||
    ref.includes('l.instagram') ||
    search.includes('utm_source=ig') ||
    search.includes('instagram')
  ) {
    return 'instagram';
  }
  if (
    ref.includes('whatsapp') ||
    ref.includes('wa.me') ||
    search.includes('utm_source=whatsapp') ||
    search.includes('whatsapp')
  ) {
    return 'whatsapp';
  }
  if (!ref || ref.includes(window.location.host)) {
    return 'direct';
  }
  return 'other';
}

function sanitizeScreenName(raw?: string): string {
  const path = raw || (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (path.startsWith('/painel')) return 'painel_admin';
  if (path.startsWith('/owner')) return 'owner_console';
  if (path.startsWith('/booking')) return 'booking_flow';
  return 'client_home';
}

function sendTelemetry(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    ...payload,
    appVersion: APP_VERSION,
    anonDeviceId: getAnonDeviceId(),
    deviceType: getDeviceType(),
    connectionType: getConnectionType(),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const queued = navigator.sendBeacon('/api/telemetry-ingest', blob);
      if (queued) return;
    }
    void fetch('/api/telemetry-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore transport errors
  }
}

export function trackScreenView(screen: string): void {
  pushBreadcrumb('nav', `Tela: ${screen}`);
  sendTelemetry({
    type: 'screen_metric',
    screen,
    event: 'view',
  });
}

export function trackFunnelStep(
  step:
    | 'visit'
    | 'service_selected'
    | 'slot_selected'
    | 'booking_confirmed'
    | 'booking_failed',
): void {
  pushBreadcrumb('nav', `Funnel: ${step}`);
  if (step === 'service_selected' && funnelStartTs === 0) {
    funnelStartTs = Date.now();
  }
  let durationSec = 0;
  if (step === 'booking_confirmed' && funnelStartTs > 0) {
    durationSec = Math.max(1, Math.round((Date.now() - funnelStartTs) / 1000));
    funnelStartTs = 0;
  }
  sendTelemetry({
    type: 'funnel',
    step,
    durationSec,
    referrerSource: getReferrerSource(),
  });
}

export function trackClientError(
  message: string,
  route?: string,
  componentStack?: string,
): void {
  const screen = sanitizeScreenName(route);
  const cleanMsg = String(message || 'Erro desconhecido').slice(0, 220);
  pushBreadcrumb('console', `ERR: ${cleanMsg}`);
  sendTelemetry({
    type: 'error',
    message: cleanMsg,
    route: route || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    screen,
    componentStack: componentStack ? componentStack.slice(0, 350) : '',
    breadcrumbs: [...breadcrumbs],
  });
}

export function trackAuthFailure(route: 'painel' | 'owner'): void {
  pushBreadcrumb('nav', `Auth fail: ${route}`);
  sendTelemetry({
    type: 'auth_failure',
    route,
  });
}

export function initClientTelemetry(mode: 'client' | 'admin' | 'owner'): void {
  if (typeof window === 'undefined' || telemetryInitialized) return;
  telemetryInitialized = true;

  const initialScreen =
    mode === 'admin'
      ? 'painel_admin'
      : mode === 'owner'
        ? 'owner_console'
        : 'client_home';

  // 1. Track release session + screen view once per session
  const sessionKey = `epn_rel_sess_${APP_VERSION}`;
  if (!sessionStorage.getItem(sessionKey)) {
    sessionStorage.setItem(sessionKey, '1');
    sendTelemetry({ type: 'release_session' });
    trackScreenView(initialScreen);
  }

  if (mode === 'client') {
    const visitedKey = 'epn_telemetry_visit_sent';
    if (!sessionStorage.getItem(visitedKey)) {
      sessionStorage.setItem(visitedKey, '1');
      trackFunnelStep('visit');
    }

    // 1b. Real-Time Presence Heartbeat & Dwell Time (Zero PII)
    const sessionStartMs = Date.now();
    const sendPresence = (leaving: boolean) => {
      const dwellSec = Math.max(1, Math.round((Date.now() - sessionStartMs) / 1000));
      sendTelemetry({
        type: leaving ? 'presence_leave' : 'presence_ping',
        screen: sanitizeScreenName(),
        dwellSec,
        referrerSource: getReferrerSource(),
      });
    };

    sendPresence(false);
    const pingTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendPresence(false);
      }
    }, 25_000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendPresence(true);
      } else {
        sendPresence(false);
      }
    });
    window.addEventListener('pagehide', () => {
      window.clearInterval(pingTimer);
      sendPresence(true);
    });
  }

  // 2. Global errors + Resource load errors (capture phase)
  window.addEventListener(
    'error',
    (event: Event) => {
      if (event instanceof ErrorEvent) {
        trackClientError(event.message || 'Erro de runtime');
      } else {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
          const tag = target.tagName.toLowerCase();
          pushBreadcrumb('net', `Falha recurso <${tag}>`);
          trackClientError(`Falha ao carregar recurso <${tag}>`);
        }
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', (event) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason || 'Promise rejeitada');
    trackClientError(msg);
  });

  // 3. UI Clicks + Rage Click Detector (Zero PII: never reads input values)
  let lastClickTarget: EventTarget | null = null;
  let lastClickTs = 0;
  let rapidClicks = 0;

  document.addEventListener(
    'click',
    (ev) => {
      const el = (ev.target as HTMLElement | null)?.closest('button, a, [role="button"]');
      if (el) {
        const label =
          el.getAttribute('aria-label') ||
          el.tagName.toLowerCase();
        pushBreadcrumb('ui', `Click <${label.slice(0, 32)}>`);
      }
      const now = Date.now();
      if (ev.target === lastClickTarget && now - lastClickTs < 750) {
        rapidClicks += 1;
        if (rapidClicks === 3) {
          pushBreadcrumb('ui', 'Rage click detectado');
          sendTelemetry({
            type: 'screen_metric',
            screen: sanitizeScreenName(),
            event: 'rage_click',
          });
        }
      } else {
        rapidClicks = 1;
      }
      lastClickTarget = ev.target;
      lastClickTs = now;
    },
    { passive: true },
  );

  // 4. Lightweight fetch failure interceptor (only records failed API calls, no bodies)
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
    if (url.includes('/api/telemetry-ingest')) {
      return origFetch(...args);
    }
    const t0 = performance.now();
    try {
      const resp = await origFetch(...args);
      if (!resp.ok && url.startsWith('/api/')) {
        const ms = Math.round(performance.now() - t0);
        pushBreadcrumb('net', `API ${url.split('?')[0]} -> ${resp.status} (${ms}ms)`);
        sendTelemetry({
          type: 'screen_metric',
          screen: sanitizeScreenName(),
          event: 'api_error',
        });
      }
      return resp;
    } catch (err) {
      if (url.startsWith('/api/')) {
        pushBreadcrumb('net', `API FAIL ${url.split('?')[0]}`);
        sendTelemetry({
          type: 'screen_metric',
          screen: sanitizeScreenName(),
          event: 'api_error',
        });
      }
      throw err;
    }
  };

  // 5. PWA install & offline usage
  window.addEventListener('appinstalled', () => {
    sendTelemetry({ type: 'pwa', event: 'installed' });
  });
  window.addEventListener('offline', () => {
    sendTelemetry({ type: 'pwa', event: 'offline' });
  });

  // 6. Native Web Vitals (LCP, CLS, INP) + Long Tasks (>50ms)
  if ('PerformanceObserver' in window) {
    let lcpValue = 0;
    let clsValue = 0;
    let inpValue = 0;
    let longTasksCount = 0;
    let vitalsSent = false;

    try {
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) lcpValue = Math.round(last.startTime);
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // unsupported
    }

    try {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { hadRecentInput?: boolean; value?: number }
        >) {
          if (!entry.hadRecentInput && typeof entry.value === 'number') {
            clsValue += entry.value;
          }
        }
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // unsupported
    }

    try {
      const inpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { duration?: number }
        >) {
          if (typeof entry.duration === 'number' && entry.duration > inpValue) {
            inpValue = Math.round(entry.duration);
          }
        }
      });
      inpObs.observe({ type: 'event', buffered: true });
    } catch {
      // unsupported
    }

    try {
      const ltObs = new PerformanceObserver((list) => {
        longTasksCount += list.getEntries().length;
      });
      ltObs.observe({ type: 'longtask', buffered: true });
    } catch {
      // unsupported
    }

    const flushVitals = () => {
      if (vitalsSent) return;
      vitalsSent = true;
      if (lcpValue > 0) {
        sendTelemetry({ type: 'web_vitals', metric: 'LCP', value: lcpValue });
      }
      if (inpValue > 0) {
        sendTelemetry({ type: 'web_vitals', metric: 'INP', value: inpValue });
      }
      sendTelemetry({
        type: 'web_vitals',
        metric: 'CLS',
        value: Math.round(clsValue * 1000),
      });
      if (longTasksCount > 0) {
        sendTelemetry({
          type: 'screen_metric',
          screen: sanitizeScreenName(),
          event: 'long_task',
          count: longTasksCount,
        });
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushVitals();
      }
    });
    window.setTimeout(flushVitals, 8000);
  }
}
