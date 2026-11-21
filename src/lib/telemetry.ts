const APP_VERSION = 'v82-observability-pro';

let telemetryInitialized = false;
let funnelStartTs = 0;

function getDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
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
  if (ref.includes('instagram') || ref.includes('l.instagram') || search.includes('utm_source=ig') || search.includes('instagram')) {
    return 'instagram';
  }
  if (ref.includes('whatsapp') || ref.includes('wa.me') || search.includes('utm_source=whatsapp') || search.includes('whatsapp')) {
    return 'whatsapp';
  }
  if (!ref || ref.includes(window.location.host)) {
    return 'direct';
  }
  return 'other';
}

function sendTelemetry(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    ...payload,
    appVersion: APP_VERSION,
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
    // ignore telemetry transport errors
  }
}

export function trackFunnelStep(
  step:
    | 'visit'
    | 'service_selected'
    | 'slot_selected'
    | 'booking_confirmed'
    | 'booking_failed',
): void {
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

export function trackClientError(message: string, route?: string): void {
  sendTelemetry({
    type: 'error',
    message: String(message || 'Erro desconhecido').slice(0, 220),
    route: route || (typeof window !== 'undefined' ? window.location.pathname : '/'),
  });
}

export function trackAuthFailure(route: 'painel' | 'owner'): void {
  sendTelemetry({
    type: 'auth_failure',
    route,
  });
}

export function initClientTelemetry(mode: 'client' | 'admin' | 'owner'): void {
  if (typeof window === 'undefined' || telemetryInitialized) return;
  telemetryInitialized = true;

  // 1. Track public client visit once per session
  if (mode === 'client') {
    const visitedKey = 'epn_telemetry_visit_sent';
    if (!sessionStorage.getItem(visitedKey)) {
      sessionStorage.setItem(visitedKey, '1');
      trackFunnelStep('visit');
    }
  }

  // 2. Global client errors (Zero PII)
  window.addEventListener('error', (event) => {
    trackClientError(event.message || 'Erro de runtime');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason || 'Promise rejeitada');
    trackClientError(msg);
  });

  // 3. PWA install & offline usage
  window.addEventListener('appinstalled', () => {
    sendTelemetry({ type: 'pwa', event: 'installed' });
  });
  window.addEventListener('offline', () => {
    sendTelemetry({ type: 'pwa', event: 'offline' });
  });

  // 4. Native Web Vitals (LCP, CLS, INP) via PerformanceObserver
  if ('PerformanceObserver' in window) {
    let lcpValue = 0;
    let clsValue = 0;
    let inpValue = 0;
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
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushVitals();
      }
    });
    window.setTimeout(flushVitals, 8000);
  }
}
