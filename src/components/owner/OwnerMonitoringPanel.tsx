import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Database,
  Download,
  Flame,
  Gauge,
  Globe,
  HardDrive,
  Lock,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Terminal,
  Trash2,
  TrendingUp,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import {
  clearOwnerGateSession,
  getOwnerSessionToken,
  getVaultOwnerEmail,
  isVaultOwnerAuthenticated,
  verifyOwnerVaultCredentials,
} from '../../lib/adminRoute';
import { subscribeAllAppointmentsAdmin } from '../../lib/db';
import { trackAuthFailure } from '../../lib/telemetry';
import {
  addDaysISO,
  formatBRL,
  formatDateBR,
  generateTimeSlotsForDate,
  timeToMinutes,
  todayISO,
} from '../../lib/utils';
import type {
  Appointment,
  AvailabilitySlot,
  SalonSettings,
  Service,
} from '../../types/salon';

interface OwnerMonitoringPanelProps {
  settings: SalonSettings;
  services: Service[];
  busySlots: AvailabilitySlot[];
  isFirebaseAdmin: boolean;
}

type OwnerSection =
  | 'status'
  | 'realtime'
  | 'issues'
  | 'screens'
  | 'incidents'
  | 'funnel'
  | 'simulator'
  | 'quotas'
  | 'logs'
  | 'lgpd';

type LogLevel = 'info' | 'ok' | 'warn' | 'err';

interface EndpointProbe {
  id: string;
  name: string;
  target: string;
  ok: boolean;
  statusCode: number | string;
  latencyMs: number;
  detail: string;
}

interface MonitorCheckRow {
  timestamp?: string;
  service?: string;
  ok?: boolean;
  latencyMs?: number;
  statusCode?: number;
}

interface DailyTelemetryRow {
  date: string;
  funnel_visit?: number;
  funnel_service?: number;
  funnel_slot?: number;
  funnel_confirmed?: number;
  funnel_failed?: number;
  booking_duration_sum_sec?: number;
  booking_duration_count?: number;
  device_mobile?: number;
  device_desktop?: number;
  src_instagram?: number;
  src_whatsapp?: number;
  src_direct?: number;
  src_other?: number;
  lcp_sum_ms?: number;
  lcp_count?: number;
  inp_sum_ms?: number;
  inp_count?: number;
  cls_sum_milli?: number;
  cls_count?: number;
  pwa_installs?: number;
  offline_events?: number;
  errors_total?: number;
  auth_fail_painel?: number;
  auth_fail_owner?: number;
}

interface IssueRecord {
  id: string;
  fingerprint?: string;
  message?: string;
  route?: string;
  screen?: string;
  status?: 'new' | 'investigating' | 'resolved' | 'ignored' | 'regression';
  count?: number;
  firstSeen?: string;
  lastSeen?: string;
  appVersion?: string;
  deviceType?: string;
  connectionType?: string;
  componentStack?: string;
  sampleBreadcrumbs?: string;
}

interface ScreenHealthRow {
  screen: string;
  views: number;
  errors: number;
  apiFailures: number;
  longTasks: number;
  rageClicks: number;
}

interface ReleaseRow {
  version: string;
  sessions: number;
  crashes: number;
  crashFreePct: number;
}

interface ServerErrorRecord {
  id: string;
  message?: string;
  route?: string;
  appVersion?: string;
  deviceType?: string;
  connectionType?: string;
  createdAt?: string;
}

interface ServerIncidentRecord {
  id: string;
  service?: string;
  label?: string;
  severity?: 'critical' | 'warning';
  title?: string;
  detail?: string;
  status?: string;
  startedAt?: string;
  resolvedAt?: string;
  durationMinutes?: number;
}

interface ServerTelemetryPayload {
  ok: boolean;
  serverTimestamp: string;
  totalDurationMs: number;
  runtime: {
    nodeVersion: string;
    vercelEnv: string;
    vercelRegion: string;
    commitSha: string | null;
  };
  firestore: {
    reachable: boolean;
    latencyMs: number;
    counts: {
      services: number | null;
      categories: number | null;
      availabilitySlots: number | null;
      personalBlocks: number | null;
    };
    quotaEstimate?: {
      estimatedReadsToday: number;
      freeReadsLimit: number;
      readsPct: number;
      estimatedWritesToday: number;
      freeWritesLimit: number;
      writesPct: number;
    };
  };
  googleCalendar: {
    configured: boolean;
    connected: boolean;
    tokenValid: boolean;
    scopeOk: boolean;
    latencyMs: number | null;
    accountMasked: string | null;
    updatedAt: string | null;
    futureAppointmentsCount?: number;
    syncedToGoogleCount?: number;
    divergentCount?: number;
  };
  dailyTelemetry?: DailyTelemetryRow[];
  recentErrors?: ServerErrorRecord[];
  issues?: IssueRecord[];
  screens?: ScreenHealthRow[];
  releases?: ReleaseRow[];
  realtime?: {
    onlineNow: number;
    onlineClientLink: number;
    onlineAdminLink: number;
    onlineOwnerLink: number;
    onlineMobile: number;
    onlineDesktop: number;
    visitsToday: number;
    visits7d: number;
    avgDwellSecToday: number | null;
    avgDwellSec7d: number | null;
    activeSessions: Array<{
      idShort: string;
      role: string;
      screen: string;
      deviceType: string;
      deviceLabel: string;
      referrerSource: string;
      dwellSec: number;
      lastSeenAt: string;
    }>;
  };
  slo?: {
    targetPct: number;
    monthlyBudgetMin: number;
    consumedMin: number;
    remainingBudgetMin: number;
    remainingBudgetPct: number;
  };
  incidents?: ServerIncidentRecord[];
  recentChecks?: MonitorCheckRow[];
  serverMonitorStats?: {
    totalChecks: number;
    serverUptimePct: number | null;
    serverP95Ms: number | null;
    mttrMinutes: number | null;
    alertsMuted: boolean;
    mutedUntil: string | null;
    telegramConfigured: boolean;
  };
  latestProbe?: Record<string, unknown> | null;
}

interface HealthCheckResult {
  firestoreOk: boolean;
  firestoreLatencyMs: number | null;
  gcalConfigured: boolean;
  gcalConnected: boolean;
  gcalLatencyMs: number | null;
  swActive: boolean;
  storageUsedMB: string | null;
  storageQuotaMB: string | null;
  probes: EndpointProbe[];
  serverTelemetry: ServerTelemetryPayload | null;
  checkedAt: string;
}

interface LatencySample {
  time: string;
  firestoreMs: number;
  gcalMs: number;
  ok: boolean;
}

interface TechnicalLogEntry {
  id: string;
  time: string;
  level: LogLevel;
  source: string;
  message: string;
}

const APP_VERSION = 'v87-presence-split';

function formatDwell(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
const TELEMETRY_HISTORY_KEY = 'epn_owner_telemetry_history_v1';

function loadSavedTelemetry(): LatencySample[] {
  try {
    const raw = localStorage.getItem(TELEMETRY_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-24) : [];
  } catch {
    return [];
  }
}

export const OwnerMonitoringPanel: React.FC<OwnerMonitoringPanelProps> = ({
  settings,
  services,
  busySlots,
  isFirebaseAdmin,
}) => {
  const [authenticated, setAuthenticated] = useState<boolean>(() =>
    isVaultOwnerAuthenticated(),
  );
  const [ownerEmail, setOwnerEmail] = useState<string>(
    () => getVaultOwnerEmail() || '',
  );
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);

  const [section, setSection] = useState<OwnerSection>('status');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [logFilter, setLogFilter] = useState<'all' | LogLevel>('all');
  const [copiedReport, setCopiedReport] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<string>('all');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  const [simDate, setSimDate] = useState<string>(() => todayISO());
  const [simDuration, setSimDuration] = useState<number>(120);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<LatencySample[]>(() =>
    loadSavedTelemetry(),
  );
  const [logs, setLogs] = useState<TechnicalLogEntry[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(
    null,
  );

  const pushLog = useCallback(
    (level: LogLevel, source: string, message: string) => {
      const entry: TechnicalLogEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString('pt-BR'),
        level,
        source,
        message,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 80));
    },
    [],
  );

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      pushLog('ok', 'NET', 'Conexão restaurada.');
    };
    const onOffline = () => {
      setIsOnline(false);
      pushLog('warn', 'NET', 'Dispositivo offline.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [pushLog]);

  useEffect(() => {
    if (!authenticated || !isFirebaseAdmin) {
      setStatusCounts(null);
      return;
    }
    const unsub = subscribeAllAppointmentsAdmin((apts: Appointment[]) => {
      const counts: Record<string, number> = {
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
      };
      for (const apt of apts) {
        counts[apt.status] = (counts[apt.status] || 0) + 1;
      }
      setStatusCounts(counts);
    });
    return () => unsub();
  }, [authenticated, isFirebaseAdmin]);

  const runHealthCheck = useCallback(async () => {
    setCheckingHealth(true);
    setCountdown(30);
    const probes: EndpointProbe[] = [];
    const ownerToken = getOwnerSessionToken();

    let firestoreOk = false;
    let firestoreLatencyMs: number | null = null;
    try {
      const t0 = performance.now();
      const resp = await fetch(
        'https://firestore.googleapis.com/v1/projects/studio-de-beleza-8045a/databases/(default)/documents/salon_settings/main',
      );
      firestoreLatencyMs = Math.round(performance.now() - t0);
      firestoreOk = resp.ok;
      probes.push({
        id: 'firestore_settings',
        name: 'Firestore Config',
        target: '/salon_settings/main',
        ok: resp.ok,
        statusCode: resp.status,
        latencyMs: firestoreLatencyMs,
        detail: resp.ok ? 'Leitura pública OK' : 'Falha na leitura',
      });
    } catch {
      probes.push({
        id: 'firestore_settings',
        name: 'Firestore Config',
        target: '/salon_settings/main',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Sem resposta',
      });
    }

    let serverTelemetry: ServerTelemetryPayload | null = null;
    try {
      const t0 = performance.now();
      const resp = await fetch('/api/owner-telemetry', {
        headers: ownerToken ? { 'x-owner-auth': ownerToken } : {},
      });
      const ms = Math.round(performance.now() - t0);
      if (resp.ok) {
        serverTelemetry = (await resp.json()) as ServerTelemetryPayload;
        probes.push({
          id: 'owner_telemetry',
          name: 'Owner Telemetry API',
          target: '/api/owner-telemetry',
          ok: true,
          statusCode: resp.status,
          latencyMs: ms,
          detail: `${serverTelemetry.runtime.vercelRegion} · Auth OK`,
        });
        pushLog('ok', 'API', `Telemetria servidor atualizada (${ms}ms)`);
      } else {
        probes.push({
          id: 'owner_telemetry',
          name: 'Owner Telemetry API',
          target: '/api/owner-telemetry',
          ok: false,
          statusCode: resp.status,
          latencyMs: ms,
          detail: 'HTTP ' + resp.status,
        });
      }
    } catch {
      probes.push({
        id: 'owner_telemetry',
        name: 'Owner Telemetry API',
        target: '/api/owner-telemetry',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Inacessível',
      });
    }

    let gcalConfigured = false;
    let gcalConnected = false;
    let gcalLatencyMs: number | null = null;
    try {
      const t0 = performance.now();
      const resp = await fetch('/api/google-calendar?action=status');
      gcalLatencyMs = Math.round(performance.now() - t0);
      if (resp.ok) {
        const data = (await resp.json()) as {
          configured?: boolean;
          connected?: boolean;
        };
        gcalConfigured = Boolean(data.configured);
        gcalConnected = Boolean(data.connected);
        probes.push({
          id: 'gcal_api',
          name: 'Google Calendar API',
          target: '/api/google-calendar?action=status',
          ok: gcalConfigured,
          statusCode: resp.status,
          latencyMs: gcalLatencyMs,
          detail: gcalConnected ? 'OAuth conectado' : 'Aguardando vínculo',
        });
      }
    } catch {
      probes.push({
        id: 'gcal_api',
        name: 'Google Calendar API',
        target: '/api/google-calendar?action=status',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Inacessível',
      });
    }

    try {
      const t0 = performance.now();
      const resp = await fetch('/manifest.webmanifest');
      const ms = Math.round(performance.now() - t0);
      probes.push({
        id: 'pwa_manifest',
        name: 'PWA Manifest',
        target: '/manifest.webmanifest',
        ok: resp.ok,
        statusCode: resp.status,
        latencyMs: ms,
        detail: resp.ok ? 'Instalável' : 'Ausente',
      });
    } catch {
      probes.push({
        id: 'pwa_manifest',
        name: 'PWA Manifest',
        target: '/manifest.webmanifest',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Erro',
      });
    }

    let swActive = false;
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        swActive = Boolean(reg?.active);
      } catch {
        swActive = false;
      }
    }

    let storageUsedMB: string | null = null;
    let storageQuotaMB: string | null = null;
    if (navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === 'number') {
          storageUsedMB = (est.usage / (1024 * 1024)).toFixed(2);
        }
        if (typeof est.quota === 'number') {
          storageQuotaMB = (est.quota / (1024 * 1024)).toFixed(0);
        }
      } catch {
        storageUsedMB = null;
      }
    }

    const nowTime = new Date().toLocaleTimeString('pt-BR');
    setHealth({
      firestoreOk,
      firestoreLatencyMs,
      gcalConfigured,
      gcalConnected,
      gcalLatencyMs,
      swActive,
      storageUsedMB,
      storageQuotaMB,
      probes,
      serverTelemetry,
      checkedAt: nowTime,
    });

    const sample: LatencySample = {
      time: nowTime.slice(0, 5),
      firestoreMs: firestoreLatencyMs ?? 0,
      gcalMs: gcalLatencyMs ?? 0,
      ok: firestoreOk && gcalConfigured,
    };
    setLatencyHistory((prev) => {
      const next = [...prev, sample].slice(-24);
      try {
        localStorage.setItem(TELEMETRY_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    setCheckingHealth(false);
  }, [pushLog]);

  useEffect(() => {
    if (authenticated) void runHealthCheck();
  }, [authenticated, runHealthCheck]);

  useEffect(() => {
    if (!authenticated || !autoRefresh) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void runHealthCheck();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [authenticated, autoRefresh, runHealthCheck]);

  const handleUpdateIssueStatus = async (
    fingerprint: string,
    status: 'new' | 'investigating' | 'resolved' | 'ignored',
  ) => {
    const ownerToken = getOwnerSessionToken();
    try {
      const resp = await fetch('/api/owner-telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ownerToken ? { 'x-owner-auth': ownerToken } : {}),
        },
        body: JSON.stringify({ action: 'update_issue', fingerprint, status }),
      });
      if (resp.ok) {
        pushLog('ok', 'ISSUE', `Issue ${fingerprint} marcada como ${status}.`);
        await runHealthCheck();
      }
    } catch {
      pushLog('warn', 'ISSUE', 'Falha ao atualizar status da issue.');
    }
  };

  const handleToggleMuteAlerts = async (muteMinutes: number) => {
    const ownerToken = getOwnerSessionToken();
    try {
      const resp = await fetch('/api/owner-telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ownerToken ? { 'x-owner-auth': ownerToken } : {}),
        },
        body: JSON.stringify({ muteMinutes }),
      });
      if (resp.ok) {
        pushLog(
          'info',
          'ALERTS',
          muteMinutes > 0
            ? `Alertas silenciados por ${muteMinutes} min.`
            : 'Alertas reativados.',
        );
        await runHealthCheck();
      }
    } catch {
      pushLog('warn', 'ALERTS', 'Erro ao alternar silenciamento.');
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramFeedback(null);
    const ownerToken = getOwnerSessionToken();
    try {
      const resp = await fetch('/api/owner-telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ownerToken ? { 'x-owner-auth': ownerToken } : {}),
        },
        body: JSON.stringify({ action: 'test_telegram' }),
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (resp.ok && data.ok) {
        setTelegramFeedback('Mensagem de teste enviada no Telegram!');
        pushLog('ok', 'TELEGRAM', 'Teste de alerta enviado com sucesso.');
      } else {
        setTelegramFeedback(
          data.error || 'Falha ao enviar teste (verifique variáveis na Vercel).',
        );
        pushLog('warn', 'TELEGRAM', data.error || 'Não configurado.');
      }
    } catch {
      setTelegramFeedback('Erro de rede ao testar Telegram.');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleRunServerCronAudit = async () => {
    setRunningCron(true);
    pushLog('info', 'CRON', 'Rodando auditoria de incidentes no servidor...');
    try {
      const resp = await fetch('/api/cron-monitor');
      if (resp.ok) {
        pushLog('ok', 'CRON', 'Checagem gravada em monitor_checks.');
        await runHealthCheck();
      }
    } catch {
      pushLog('err', 'CRON', 'Falha ao chamar /api/cron-monitor.');
    } finally {
      setRunningCron(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockUntil) {
      const secs = Math.ceil((lockUntil - Date.now()) / 1000);
      setLoginError(`Bloqueado por segurança. Aguarde ${secs}s.`);
      return;
    }
    setLoginError('');
    setLoggingIn(true);
    try {
      const ok = await verifyOwnerVaultCredentials(loginEmail, loginPassword);
      if (!ok) {
        const nextFails = failedAttempts + 1;
        setFailedAttempts(nextFails);
        trackAuthFailure('owner');
        if (nextFails >= 5) {
          setLockUntil(Date.now() + 60_000);
          setFailedAttempts(0);
          setLoginError('5 falhas seguidas. Bloqueado por 60 segundos.');
        } else {
          setLoginError('Credenciais inválidas.');
        }
        return;
      }
      setFailedAttempts(0);
      setAuthenticated(true);
      setOwnerEmail(getVaultOwnerEmail() || loginEmail.trim().toLowerCase());
      setLoginPassword('');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearOwnerGateSession();
    setAuthenticated(false);
    window.location.href = '/';
  };

  const today = todayISO();
  const next14Days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDaysISO(today, i)),
    [today],
  );

  const funnelAndVitals = useMemo(() => {
    const rows = health?.serverTelemetry?.dailyTelemetry || [];
    const sum = (key: keyof DailyTelemetryRow) =>
      rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

    const visits = sum('funnel_visit');
    const servicesChosen = sum('funnel_service');
    const slotsChosen = sum('funnel_slot');
    const confirmed = sum('funnel_confirmed');
    const failedBookings = sum('funnel_failed');
    const conversionRate =
      visits > 0 ? Math.round((confirmed / visits) * 1000) / 10 : 0;

    const durSum = sum('booking_duration_sum_sec');
    const durCnt = sum('booking_duration_count');
    const avgBookingSec = durCnt > 0 ? Math.round(durSum / durCnt) : null;

    const lcpSum = sum('lcp_sum_ms');
    const lcpCnt = sum('lcp_count');
    const avgLcpMs = lcpCnt > 0 ? Math.round(lcpSum / lcpCnt) : null;

    const inpSum = sum('inp_sum_ms');
    const inpCnt = sum('inp_count');
    const avgInpMs = inpCnt > 0 ? Math.round(inpSum / inpCnt) : null;

    const clsSum = sum('cls_sum_milli');
    const clsCnt = sum('cls_count');
    const avgCls = clsCnt > 0 ? (clsSum / clsCnt / 1000).toFixed(3) : null;

    return {
      visits,
      servicesChosen,
      slotsChosen,
      confirmed,
      failedBookings,
      conversionRate,
      avgBookingSec,
      mobile: sum('device_mobile'),
      desktop: sum('device_desktop'),
      ig: sum('src_instagram'),
      wa: sum('src_whatsapp'),
      direct: sum('src_direct'),
      avgLcpMs,
      avgInpMs,
      avgCls,
      pwaInstalls: sum('pwa_installs'),
      offlineEvents: sum('offline_events'),
      clientErrors7d: sum('errors_total'),
      authFailPainel: sum('auth_fail_painel'),
      authFailOwner: sum('auth_fail_owner'),
    };
  }, [health?.serverTelemetry?.dailyTelemetry]);

  const metrics = useMemo(() => {
    const activeAppointments = busySlots.filter(
      (s) => s.active && s.kind === 'appointment',
    );
    const activeBlocks = busySlots.filter(
      (s) => s.active && s.kind === 'block',
    );
    const todayCount = activeAppointments.filter((s) => s.date === today).length;
    const next7Set = new Set(next14Days.slice(0, 7));
    const next7Count = activeAppointments.filter((s) =>
      next7Set.has(s.date),
    ).length;
    const next14Set = new Set(next14Days);
    const next14Count = activeAppointments.filter((s) =>
      next14Set.has(s.date),
    ).length;

    const byDay14 = next14Days.map((date) => ({
      date,
      label: formatDateBR(date).slice(0, 5),
      appointments: activeAppointments.filter((s) => s.date === date).length,
      blocks: activeBlocks.filter((s) => s.date === date).length,
      availableSlots: generateTimeSlotsForDate(
        date,
        60,
        settings,
        busySlots,
      ).filter((sl) => sl.available).length,
    }));

    const daysWithZeroFreeSlots = byDay14.filter(
      (d) => d.availableSlots === 0,
    ).length;

    const maxDaily = Math.max(
      1,
      ...byDay14.map((d) => d.appointments + d.blocks),
    );

    const hourBuckets = [
      { label: '08h–10h', min: 480, max: 600, count: 0 },
      { label: '10h–12h', min: 600, max: 720, count: 0 },
      { label: '12h–14h', min: 720, max: 840, count: 0 },
      { label: '14h–16h', min: 840, max: 960, count: 0 },
      { label: '16h–18h', min: 960, max: 1080, count: 0 },
      { label: '18h+', min: 1080, max: 1440, count: 0 },
    ];
    for (const apt of activeAppointments) {
      const m = timeToMinutes(apt.startTime);
      const bucket = hourBuckets.find((b) => m >= b.min && m < b.max);
      if (bucket) bucket.count += 1;
    }
    const maxHourBucket = Math.max(1, ...hourBuckets.map((b) => b.count));

    const avgServicePrice =
      services.length > 0
        ? services.reduce((acc, s) => acc + (s.price || 0), 0) / services.length
        : 0;
    const avgServiceDuration =
      services.length > 0
        ? Math.round(
            services.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) /
              services.length,
          )
        : 0;

    const dbLatencies = latencyHistory
      .map((s) => s.firestoreMs)
      .filter((n) => n > 0);
    const minDbMs = dbLatencies.length > 0 ? Math.min(...dbLatencies) : null;
    const maxDbMs = dbLatencies.length > 0 ? Math.max(...dbLatencies) : null;
    const avgDbMs =
      dbLatencies.length > 0
        ? Math.round(dbLatencies.reduce((a, b) => a + b, 0) / dbLatencies.length)
        : health?.firestoreLatencyMs ?? null;

    const uptimePct =
      latencyHistory.length > 0
        ? Math.round(
            (latencyHistory.filter((s) => s.ok).length / latencyHistory.length) *
              1000,
          ) / 10
        : health?.firestoreOk
          ? 100
          : 0;

    return {
      totalActiveAppointments: activeAppointments.length,
      totalActiveBlocks: activeBlocks.length,
      todayCount,
      next7Count,
      next14Count,
      byDay14,
      daysWithZeroFreeSlots,
      maxDaily,
      hourBuckets,
      maxHourBucket,
      avgServicePrice,
      avgServiceDuration,
      minDbMs,
      maxDbMs,
      avgDbMs,
      uptimePct,
      scheduleMode:
        settings.configuredSlots && settings.configuredSlots.length > 0
          ? `Horários Fixos (${settings.configuredSlots.length})`
          : `Intervalo (${settings.slotIntervalMinutes || 30}m)`,
    };
  }, [
    busySlots,
    health?.firestoreLatencyMs,
    health?.firestoreOk,
    latencyHistory,
    next14Days,
    services,
    settings,
    today,
  ]);

  const simulatedSlots = useMemo(
    () => generateTimeSlotsForDate(simDate, simDuration, settings, busySlots),
    [simDate, simDuration, settings, busySlots],
  );

  // StatusPage check bars grouped by service from monitor_checks
  const checksByService = useMemo(() => {
    const all = health?.serverTelemetry?.recentChecks || [];
    const defs = [
      { id: 'firestore', label: 'Firestore Database' },
      { id: 'site_root', label: 'Site Principal (Vercel)' },
      { id: 'google_calendar', label: 'Google Agenda API' },
      { id: 'pwa_manifest', label: 'PWA Manifest' },
    ];
    return defs.map((def) => {
      const items = all
        .filter((c) => c.service === def.id)
        .slice(0, 24)
        .reverse();
      const okCount = items.filter((i) => i.ok).length;
      const pct =
        items.length > 0 ? Math.round((okCount / items.length) * 1000) / 10 : null;
      return { ...def, items, pct };
    });
  }, [health?.serverTelemetry?.recentChecks]);

  const alerts = useMemo(() => {
    const list: { level: 'warn' | 'err'; title: string; detail: string }[] = [];
    if (!isOnline) {
      list.push({
        level: 'err',
        title: 'Dispositivo Offline',
        detail: 'Sem conexão com a internet.',
      });
    }
    if (health && !health.firestoreOk) {
      list.push({
        level: 'err',
        title: 'Firestore Inacessível',
        detail: 'Falha na leitura do banco.',
      });
    }
    const gcalDiv = health?.serverTelemetry?.googleCalendar.divergentCount || 0;
    if (gcalDiv > 0) {
      list.push({
        level: 'warn',
        title: `Divergência Firestore ↔ Google Agenda (${gcalDiv})`,
        detail: `${gcalDiv} agendamento(s) futuro(s) sem evento sincronizado.`,
      });
    }
    return list;
  }, [health, isOnline]);

  const allSystemsHealthy =
    isOnline && alerts.length === 0 && Boolean(health?.firestoreOk);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((l) => l.level === logFilter);
  }, [logs, logFilter]);

  const handleExportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      lgpdCompliance: 'NO_PII_INCLUDED',
      health,
      funnelAndVitals,
      alerts,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noc-report-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyDiagnostic = async () => {
    const srv = health?.serverTelemetry;
    const summary = [
      `NOC ${APP_VERSION} (${today}) | Uptime: ${srv?.serverMonitorStats?.serverUptimePct ?? metrics.uptimePct}%`,
      `DB Server: ${srv?.firestore.latencyMs ?? '—'}ms | P95: ${srv?.serverMonitorStats?.serverP95Ms ?? '—'}ms | MTTR: ${srv?.serverMonitorStats?.mttrMinutes ?? '—'}m`,
      `GCal: ${srv?.googleCalendar.syncedToGoogleCount ?? 0}/${srv?.googleCalendar.futureAppointmentsCount ?? 0} sincronizados (Divergentes: ${srv?.googleCalendar.divergentCount ?? 0})`,
      `Funil 7d: ${funnelAndVitals.visits} visitas -> ${funnelAndVitals.confirmed} confirmados (${funnelAndVitals.conversionRate}%)`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleForceRefreshPWA = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      window.location.reload();
    } catch {
      // ignore
    }
  };

  const sparkline = useMemo(() => {
    if (latencyHistory.length < 2) return null;
    const width = 640;
    const height = 140;
    const pad = 12;
    const maxVal = Math.max(
      120,
      ...latencyHistory.map((s) => Math.max(s.firestoreMs, s.gcalMs)),
    );
    const stepX = (width - pad * 2) / Math.max(1, latencyHistory.length - 1);
    const toPoints = (getter: (s: LatencySample) => number) =>
      latencyHistory
        .map((s, i) => {
          const x = pad + i * stepX;
          const y = height - pad - (getter(s) / maxVal) * (height - pad * 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    const dbPts = toPoints((s) => s.firestoreMs);
    const areaPts = `${pad},${height - pad} ${dbPts} ${pad + (latencyHistory.length - 1) * stepX},${height - pad}`;
    return {
      width,
      height,
      maxVal,
      dbPoints: dbPts,
      dbAreaPoints: areaPts,
      gcalPoints: toPoints((s) => s.gcalMs),
    };
  }, [latencyHistory]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#111114] border border-zinc-800 p-7 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 text-emerald-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Observability Console
              </div>
              <h1 className="text-lg font-semibold text-white">
                Acesso do Proprietário
              </h1>
            </div>
          </div>

          <div className="mb-5 rounded-xl bg-zinc-950 border border-zinc-800 p-3.5 text-xs text-zinc-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Painel técnico isolado em conformidade <strong>LGPD</strong>.
              Zero dados pessoais de clientes são exibidos.
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="seu-email@dominio.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-400 font-medium">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full min-h-[42px] rounded-xl bg-zinc-100 text-zinc-950 font-semibold text-sm hover:bg-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? 'Autenticando...' : 'Entrar no Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const srv = health?.serverTelemetry;
  const effectiveUptimePct =
    srv?.serverMonitorStats?.serverUptimePct ?? metrics.uptimePct;

  const navItems: Array<{
    id: OwnerSection;
    label: string;
    group: string;
    icon: React.FC<{ className?: string }>;
    badge?: string | number;
  }> = [
    { id: 'status', label: 'Status & Uptime', group: 'Monitoramento', icon: Gauge },
    {
      id: 'realtime',
      label: 'Ao Vivo (Visitantes)',
      group: 'Monitoramento',
      icon: Activity,
      badge: srv?.realtime?.onlineNow || undefined,
    },
    {
      id: 'issues',
      label: 'Issues (Erros)',
      group: 'Monitoramento',
      icon: AlertTriangle,
      badge:
        (srv?.issues || []).filter(
          (i) => i.status === 'new' || i.status === 'regression',
        ).length || undefined,
    },
    {
      id: 'screens',
      label: 'Telas & Releases',
      group: 'Monitoramento',
      icon: BarChart3,
    },
    {
      id: 'incidents',
      label: 'Incidentes & Alertas',
      group: 'Monitoramento',
      icon: Bell,
      badge:
        (srv?.incidents || []).filter((i) => i.status === 'open').length ||
        undefined,
    },
    {
      id: 'funnel',
      label: 'Funil & Web Vitals',
      group: 'Telemetria',
      icon: TrendingUp,
    },
    {
      id: 'simulator',
      label: 'Simulador Agenda',
      group: 'Telemetria',
      icon: Compass,
    },
    { id: 'quotas', label: 'Cotas & Infra', group: 'Telemetria', icon: HardDrive },
    {
      id: 'logs',
      label: 'Erros & Logs',
      group: 'Auditoria',
      icon: Terminal,
      badge: srv?.recentErrors?.length || undefined,
    },
    { id: 'lgpd', label: 'Segurança & LGPD', group: 'Auditoria', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#111114] border-r border-zinc-800/80">
        <div className="h-14 px-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-semibold text-sm tracking-tight">
              EPN Observability
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
            {APP_VERSION.split('-')[0]}
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {['Monitoramento', 'Telemetria', 'Auditoria'].map((group) => (
            <div key={group}>
              <div className="px-2.5 mb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {group}
              </div>
              <div className="space-y-0.5">
                {navItems
                  .filter((n) => n.group === group)
                  .map((item) => {
                    const Icon = item.icon;
                    const active = section === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSection(item.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-zinc-800/90 text-white'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon
                            className={`w-4 h-4 ${
                              active ? 'text-emerald-400' : 'text-zinc-500'
                            }`}
                          />
                          {item.label}
                        </span>
                        {item.badge !== undefined && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-500/15 text-amber-300">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-800/80 space-y-2">
          <div className="px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1">
            <div className="flex justify-between">
              <span>Env</span>
              <span className="text-zinc-200">
                {srv?.runtime.vercelEnv || 'prod'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Região</span>
              <span className="text-zinc-200">
                {srv?.runtime.vercelRegion || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Commit</span>
              <span className="text-zinc-200">
                {srv?.runtime.commitSha || '—'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-rose-500/15 text-zinc-300 hover:text-rose-300 border border-zinc-800 text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Action Bar */}
        <header className="sticky top-0 z-20 h-auto min-h-[56px] bg-[#09090B]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  allSystemsHealthy ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-sm font-semibold">
                {allSystemsHealthy
                  ? 'Sistemas Operacionais'
                  : `${alerts.length} Alerta(s) Ativo(s)`}
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LGPD ZERO-PII
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRunServerCronAudit()}
              disabled={runningCron}
              className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-50"
            >
              <Server className="w-3.5 h-3.5 text-sky-400" />
              <span>{runningCron ? 'Auditando...' : 'Gravar Check'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-mono cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              {autoRefresh ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              <span>{autoRefresh ? `${countdown}s` : 'Pausado'}</span>
            </button>

            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={checkingHealth}
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`}
              />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyDiagnostic()}
              className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 cursor-pointer"
            >
              {copiedReport ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleExportReport}
              className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 cursor-pointer"
              title="Exportar JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Nav */}
          <div className="w-full flex lg:hidden items-center gap-1.5 overflow-x-auto pt-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                  section === item.id
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:px-8 max-w-[1680px] w-full mx-auto space-y-6">
          {section === 'status' && (
            <>
              {/* 4 Compact NOC KPIs */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400">
                    Uptime Servidor
                  </div>
                  <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                    {effectiveUptimePct}%
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {srv?.serverMonitorStats?.totalChecks || 0} checks gravados
                  </div>
                </div>

                <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400">
                    Latência P95 / MTTR
                  </div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">
                    {srv?.serverMonitorStats?.serverP95Ms ??
                      health?.firestoreLatencyMs ??
                      '—'}
                    ms
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    MTTR:{' '}
                    {srv?.serverMonitorStats?.mttrMinutes !== null &&
                    srv?.serverMonitorStats?.mttrMinutes !== undefined
                      ? `${srv.serverMonitorStats.mttrMinutes} min`
                      : '0 incidentes'}
                  </div>
                </div>

                <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400">
                    Google Agenda Sync
                  </div>
                  <div
                    className={`text-2xl font-mono font-bold mt-1 ${
                      (srv?.googleCalendar.divergentCount || 0) === 0
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {srv?.googleCalendar.syncedToGoogleCount ?? 0}/
                    {srv?.googleCalendar.futureAppointmentsCount ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1 truncate">
                    {srv?.googleCalendar.accountMasked || 'Não vinculada'}
                  </div>
                </div>

                <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center justify-between">
                    <span>Online Agora (Total)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                    {srv?.realtime?.onlineNow ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Clientes: {srv?.realtime?.onlineClientLink ?? 0} · Admin:{' '}
                    {srv?.realtime?.onlineAdminLink ?? 0} · Dono:{' '}
                    {srv?.realtime?.onlineOwnerLink ?? 0}
                  </div>
                </div>
              </section>

              {/* StatusPage Bars per Service */}
              <section className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Histórico de Disponibilidade por Serviço (monitor_checks)
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Cada barra representa uma sondagem real gravada no servidor
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Últimas 24 checagens / serviço
                  </span>
                </div>

                <div className="space-y-3">
                  {checksByService.map((svc) => (
                    <div
                      key={svc.id}
                      className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-200">
                          {svc.label}
                        </span>
                        <span className="font-mono text-emerald-400">
                          {svc.pct !== null ? `${svc.pct}%` : 'Sem histórico'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 h-5">
                        {svc.items.length === 0 ? (
                          <div className="text-[11px] text-zinc-500">
                            Clique em &quot;Gravar Check&quot; para iniciar o
                            histórico.
                          </div>
                        ) : (
                          svc.items.map((chk, idx) => (
                            <div
                              key={idx}
                              title={`${chk.timestamp?.slice(11, 19) || ''} · ${chk.ok ? 'OK' : 'FALHA'} · ${chk.latencyMs ?? 0}ms`}
                              className={`flex-1 max-w-[14px] h-full rounded-[3px] ${
                                chk.ok ? 'bg-emerald-500/85' : 'bg-rose-500/85'
                              }`}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Latency Area Chart */}
              <section className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Latência de Resposta (ms)
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Min: {metrics.minDbMs ?? '—'}ms · Média:{' '}
                      {metrics.avgDbMs ?? '—'}ms · Máx: {metrics.maxDbMs ?? '—'}
                      ms
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Firestore
                    </span>
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      GCal API
                    </span>
                  </div>
                </div>

                {sparkline ? (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3">
                    <svg
                      viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                      className="w-full h-36"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="dbGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <line
                        x1="12"
                        y1={sparkline.height * 0.33}
                        x2={sparkline.width - 12}
                        y2={sparkline.height * 0.33}
                        stroke="rgba(255,255,255,0.05)"
                        strokeDasharray="3 3"
                      />
                      <line
                        x1="12"
                        y1={sparkline.height * 0.66}
                        x2={sparkline.width - 12}
                        y2={sparkline.height * 0.66}
                        stroke="rgba(255,255,255,0.05)"
                        strokeDasharray="3 3"
                      />
                      <polygon fill="url(#dbGrad)" points={sparkline.dbAreaPoints} />
                      <polyline
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2"
                        points={sparkline.dbPoints}
                      />
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        points={sparkline.gcalPoints}
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-8 text-center text-xs text-zinc-500">
                    Aguardando 2 medições para traçar o gráfico...
                  </div>
                )}
              </section>
            </>
          )}

          {section === 'realtime' && (
            <section className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="rounded-xl bg-[#111114] border border-emerald-500/30 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center justify-between">
                    <span>Link Clientes</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-3xl font-mono font-bold text-emerald-400 mt-1">
                    {srv?.realtime?.onlineClientLink ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    online agora no site
                  </div>
                </div>

                <div className="rounded-xl bg-[#111114] border border-sky-500/30 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400">
                    Link Admin (/painel)
                  </div>
                  <div className="text-3xl font-mono font-bold text-sky-400 mt-1">
                    {srv?.realtime?.onlineAdminLink ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    conectados no painel
                  </div>
                </div>

                <div className="rounded-xl bg-[#111114] border border-amber-500/30 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400">
                    Link Dono (/owner)
                  </div>
                  <div className="text-3xl font-mono font-bold text-amber-400 mt-1">
                    {srv?.realtime?.onlineOwnerLink ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    conectados no NOC
                  </div>
                </div>

                <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400">
                    Entraram Hoje
                  </div>
                  <div className="text-3xl font-mono font-bold text-white mt-1">
                    {srv?.realtime?.visitsToday ?? 0}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    7 dias: {srv?.realtime?.visits7d ?? 0} visitas
                  </div>
                </div>

                <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-4">
                  <div className="text-[11px] font-mono uppercase text-zinc-400">
                    Tempo Médio Site
                  </div>
                  <div className="text-3xl font-mono font-bold text-zinc-100 mt-1">
                    {formatDwell(
                      srv?.realtime?.avgDwellSecToday ??
                        srv?.realtime?.avgDwellSec7d,
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    7d: {formatDwell(srv?.realtime?.avgDwellSec7d)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Aparelhos Conectados Agora (Clientes · Admin · Dono)
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Heartbeat a cada 20s com janela de 2 min · ID anônimo do
                      aparelho e navegador, sem PII.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    {srv?.realtime?.activeSessions.length ?? 0} aparelho(s)
                    online
                  </span>
                </div>

                {(srv?.realtime?.activeSessions || []).length === 0 ? (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-8 text-center text-xs text-zinc-500">
                    Nenhum aparelho conectado no momento.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/80 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    {(srv?.realtime?.activeSessions || []).map((sess, idx) => (
                      <div
                        key={`${sess.idShort}_${sess.role}_${idx}`}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-zinc-100 font-bold">
                            ID #{sess.idShort}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                              sess.role === 'admin'
                                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                                : sess.role === 'owner'
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            {sess.role === 'admin'
                              ? 'Link Admin'
                              : sess.role === 'owner'
                                ? 'Link Dono'
                                : 'Link Clientes'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200">
                            {sess.deviceLabel}
                          </span>
                          {sess.role === 'client' && (
                            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                              origem: {sess.referrerSource}
                            </span>
                          )}
                        </div>
                        <div className="text-emerald-400 font-semibold">
                          {formatDwell(sess.dwellSec)} online
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {section === 'issues' && (
            <section className="space-y-4">
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Issues Agrupadas por Fingerprint (Sentry-Style)
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Erros idênticos são agrupados automaticamente com
                      breadcrumbs (últimos 20 passos sem PII).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'Todas' },
                        { id: 'new', label: 'Novas' },
                        { id: 'regression', label: 'Regressão' },
                        { id: 'investigating', label: 'Investigando' },
                        { id: 'resolved', label: 'Resolvidas' },
                        { id: 'ignored', label: 'Ignoradas' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setIssueFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono cursor-pointer ${
                          issueFilter === f.id
                            ? 'bg-zinc-100 text-zinc-950 font-bold'
                            : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const list = (srv?.issues || []).filter(
                    (i) => issueFilter === 'all' || i.status === issueFilter,
                  );
                  if (list.length === 0) {
                    return (
                      <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-6 text-center text-xs text-zinc-500">
                        Nenhuma issue encontrada neste filtro.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2.5">
                      {list.map((iss) => {
                        const fp = iss.fingerprint || iss.id;
                        const expanded = expandedIssueId === fp;
                        let crumbs: Array<{ t: string; cat: string; msg: string }> =
                          [];
                        try {
                          crumbs = JSON.parse(iss.sampleBreadcrumbs || '[]');
                        } catch {
                          crumbs = [];
                        }
                        return (
                          <div
                            key={fp}
                            className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                                      iss.status === 'regression'
                                        ? 'bg-rose-500/20 text-rose-300'
                                        : iss.status === 'resolved'
                                          ? 'bg-emerald-500/15 text-emerald-300'
                                          : iss.status === 'investigating'
                                            ? 'bg-sky-500/15 text-sky-300'
                                            : 'bg-amber-500/15 text-amber-300'
                                    }`}
                                  >
                                    {iss.status || 'new'}
                                  </span>
                                  <span className="font-mono text-[11px] text-zinc-500">
                                    {fp}
                                  </span>
                                  <span className="font-semibold text-sm text-rose-300">
                                    {iss.message}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500">
                                  Rota: {iss.route} · Ocorrências:{' '}
                                  <strong className="text-zinc-200">
                                    {iss.count || 1}
                                  </strong>{' '}
                                  · Versão: {iss.appVersion} · {iss.deviceType} (
                                  {iss.connectionType})
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedIssueId(expanded ? null : fp)
                                  }
                                  className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 cursor-pointer"
                                >
                                  {expanded
                                    ? 'Ocultar Trilha'
                                    : `Breadcrumbs (${crumbs.length})`}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateIssueStatus(
                                      fp,
                                      'investigating',
                                    )
                                  }
                                  className="px-2 py-1 rounded bg-sky-500/15 text-sky-300 text-[11px] cursor-pointer"
                                >
                                  Investigar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateIssueStatus(fp, 'resolved')
                                  }
                                  className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-[11px] cursor-pointer"
                                >
                                  Resolver
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateIssueStatus(fp, 'ignored')
                                  }
                                  className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-[11px] cursor-pointer"
                                >
                                  Ignorar
                                </button>
                              </div>
                            </div>

                            {expanded && (
                              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                                {iss.componentStack && (
                                  <pre className="text-[11px] font-mono text-zinc-400 bg-[#09090B] p-2.5 rounded overflow-x-auto">
                                    {iss.componentStack}
                                  </pre>
                                )}
                                <div className="text-[11px] font-mono text-zinc-400 space-y-1">
                                  {crumbs.length === 0 ? (
                                    <div>Sem breadcrumbs registrados.</div>
                                  ) : (
                                    crumbs.map((c, idx) => (
                                      <div key={idx} className="flex gap-2">
                                        <span className="text-zinc-500">
                                          {c.t}
                                        </span>
                                        <span className="text-sky-400">
                                          [{c.cat}]
                                        </span>
                                        <span className="text-zinc-200">
                                          {c.msg}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {section === 'screens' && (
            <section className="space-y-4">
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Saúde por Tela (Erros, APIs, Long Tasks & Rage Clicks)
                </h2>
                {(srv?.screens || []).length === 0 ? (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-6 text-center text-xs text-zinc-500">
                    Aguardando acessos para popular métricas por tela.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(srv?.screens || []).map((sc) => {
                      const errRate =
                        sc.views > 0
                          ? Math.round((sc.errors / sc.views) * 1000) / 10
                          : 0;
                      const healthLabel =
                        errRate >= 3 || sc.errors >= 5
                          ? 'Crítica'
                          : errRate > 0 || sc.apiFailures > 0
                            ? 'Atenção'
                            : 'Saudável';
                      return (
                        <div
                          key={sc.screen}
                          className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-4 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-zinc-100">
                              {sc.screen}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                healthLabel === 'Saudável'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : healthLabel === 'Atenção'
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {healthLabel}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-zinc-400">
                            <div>
                              Views: <strong className="text-white">{sc.views}</strong>
                            </div>
                            <div>
                              Erros:{' '}
                              <strong className="text-rose-300">
                                {sc.errors} ({errRate}%)
                              </strong>
                            </div>
                            <div>
                              APIs Falhas:{' '}
                              <strong className="text-amber-300">
                                {sc.apiFailures}
                              </strong>
                            </div>
                            <div>
                              Long Tasks:{' '}
                              <strong className="text-zinc-200">
                                {sc.longTasks}
                              </strong>
                            </div>
                            <div>
                              Rage Clicks:{' '}
                              <strong className="text-zinc-200">
                                {sc.rageClicks}
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Releases & Crash-Free Sessions (Crashlytics-Style)
                </h2>
                {(srv?.releases || []).length === 0 ? (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-6 text-center text-xs text-zinc-500">
                    Nenhuma sessão de release registrada ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/80 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    {(srv?.releases || []).map((rel) => (
                      <div
                        key={rel.version}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                      >
                        <span className="font-semibold text-zinc-100">
                          {rel.version}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-400">
                            Sessões: <strong className="text-white">{rel.sessions}</strong>
                          </span>
                          <span className="text-zinc-400">
                            Crashes: <strong className="text-rose-300">{rel.crashes}</strong>
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {rel.crashFreePct}% Crash-Free
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {section === 'incidents' && (
            <section className="space-y-4">
              {/* Alert Controls + Telegram Tester */}
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Alertas Externos (Telegram Bot) & Manutenção
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Status:{' '}
                    {srv?.serverMonitorStats?.telegramConfigured
                      ? 'Bot configurado'
                      : 'Configure TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID na Vercel'}
                  </p>
                  {telegramFeedback && (
                    <p className="text-xs text-sky-400 mt-1.5 font-medium">
                      {telegramFeedback}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTestTelegram()}
                    disabled={testingTelegram}
                    className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-medium cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {testingTelegram ? 'Enviando...' : 'Testar Telegram'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleToggleMuteAlerts(
                        srv?.serverMonitorStats?.alertsMuted ? 0 : 120,
                      )
                    }
                    className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border text-xs font-medium cursor-pointer ${
                      srv?.serverMonitorStats?.alertsMuted
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    <span>
                      {srv?.serverMonitorStats?.alertsMuted
                        ? 'Reativar Alertas'
                        : 'Silenciar 2h'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Incidents Table */}
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Linha do Tempo de Incidentes (monitor_incidents)
                </h2>
                {(srv?.incidents || []).length === 0 ? (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-6 text-center text-xs text-zinc-500">
                    Nenhum incidente registrado no servidor.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/80 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    {(srv?.incidents || []).map((inc) => (
                      <div
                        key={inc.id}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                                inc.status === 'open'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/15 text-emerald-300'
                              }`}
                            >
                              {inc.status === 'open' ? 'ABERTO' : 'RESOLVIDO'}
                            </span>
                            <span className="font-semibold text-zinc-100">
                              {inc.title}
                            </span>
                          </div>
                          <div className="text-zinc-400">{inc.detail}</div>
                        </div>
                        <div className="text-right font-mono text-[11px] text-zinc-500">
                          <div>{inc.startedAt?.slice(0, 16).replace('T', ' ')}</div>
                          <div>
                            {inc.durationMinutes
                              ? `Duração: ${inc.durationMinutes}m`
                              : 'Em andamento'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {section === 'funnel' && (
            <section className="space-y-4">
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    Funil de Conversão & Web Vitals Reais (7 dias)
                  </h2>
                  <span className="text-xs font-mono text-zinc-400">
                    Tempo médio: {funnelAndVitals.avgBookingSec ?? '—'}s
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Visitas', val: funnelAndVitals.visits },
                    { label: 'Serviço', val: funnelAndVitals.servicesChosen },
                    { label: 'Horário', val: funnelAndVitals.slotsChosen },
                    { label: 'Confirmados', val: funnelAndVitals.confirmed },
                    { label: 'Falhas', val: funnelAndVitals.failedBookings },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3.5"
                    >
                      <div className="text-[11px] text-zinc-400">{s.label}</div>
                      <div className="text-xl font-mono font-bold text-white mt-1">
                        {s.val}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3.5 flex justify-between">
                    <span className="text-zinc-400">LCP / INP / CLS</span>
                    <span className="font-mono text-emerald-400">
                      {funnelAndVitals.avgLcpMs ?? '—'}ms /{' '}
                      {funnelAndVitals.avgInpMs ?? '—'}ms /{' '}
                      {funnelAndVitals.avgCls ?? '—'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3.5 flex justify-between">
                    <span className="text-zinc-400">Mobile / Desktop</span>
                    <span className="font-mono text-zinc-200">
                      {funnelAndVitals.mobile} / {funnelAndVitals.desktop}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3.5 flex justify-between">
                    <span className="text-zinc-400">IG / WA / Direto</span>
                    <span className="font-mono text-zinc-200">
                      {funnelAndVitals.ig} / {funnelAndVitals.wa} /{' '}
                      {funnelAndVitals.direct}
                    </span>
                  </div>
                </div>
              </div>

              {/* 14-day demand */}
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-white">
                    Ocupação Próximos 14 Dias
                  </span>
                  <span className="font-mono text-zinc-400">
                    Dias lotados: {metrics.daysWithZeroFreeSlots}/14
                  </span>
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 items-end h-36 pt-2">
                  {metrics.byDay14.map((d) => {
                    const total = d.appointments + d.blocks;
                    const pct = Math.max(
                      8,
                      Math.round((total / metrics.maxDaily) * 100),
                    );
                    return (
                      <div
                        key={d.date}
                        className="flex flex-col items-center justify-end h-full gap-1"
                      >
                        <span className="text-[10px] font-mono text-zinc-300">
                          {d.appointments}
                        </span>
                        <div className="w-full flex-1 bg-zinc-950 rounded border border-zinc-800/80 flex items-end p-0.5">
                          <div
                            style={{ height: `${total === 0 ? 6 : pct}%` }}
                            className={`w-full rounded-sm ${
                              d.appointments > 0
                                ? 'bg-emerald-400'
                                : 'bg-zinc-800'
                            }`}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500">
                          {d.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {section === 'simulator' && (
            <section className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Simulador Técnico de Disponibilidade (Zero PII)
                </h2>
                <p className="text-xs text-zinc-400">
                  Audite os horários livres/bloqueados para qualquer data e
                  duração ({metrics.scheduleMode}).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  className="px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[30, 60, 90, 120, 150, 180].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setSimDuration(min)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono border cursor-pointer ${
                        simDuration === min
                          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {simulatedSlots.map((slot) => (
                  <div
                    key={slot.startTime}
                    className={`rounded-lg p-2.5 border text-xs ${
                      slot.available
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div className="font-mono font-semibold">
                      {slot.startTime}–{slot.endTime}
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {slot.available ? 'Livre' : slot.reason || 'Bloqueado'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === 'quotas' && (
            <section className="space-y-4">
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Consumo Estimado & Cotas (Plano Gratuito Spark / Vercel)
                  </h2>
                  <button
                    type="button"
                    onClick={() => void handleForceRefreshPWA()}
                    className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Limpar Cache PWA</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    {
                      label: 'Firestore Leituras / dia (limite 50.000)',
                      val: srv?.firestore.quotaEstimate?.estimatedReadsToday || 0,
                      pct: srv?.firestore.quotaEstimate?.readsPct || 0,
                    },
                    {
                      label: 'Firestore Escritas / dia (limite 20.000)',
                      val: srv?.firestore.quotaEstimate?.estimatedWritesToday || 0,
                      pct: srv?.firestore.quotaEstimate?.writesPct || 0,
                    },
                  ].map((q) => (
                    <div key={q.label} className="space-y-1.5">
                      <div className="flex justify-between font-mono">
                        <span className="text-zinc-300">{q.label}</span>
                        <span className="text-emerald-400">
                          {q.val} ({q.pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-950 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(2, q.pct)}%` }}
                          className={`h-full rounded-full ${
                            q.pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-2.5">
                <h3 className="text-sm font-semibold text-white">
                  Endpoints Monitorados
                </h3>
                {(health?.probes || []).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg bg-zinc-950 border border-zinc-800/80 px-3.5 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-zinc-200">{p.name}</span>
                      <span className="ml-2 font-mono text-zinc-500">
                        {p.target}
                      </span>
                    </div>
                    <div className="font-mono flex items-center gap-2">
                      <span
                        className={p.ok ? 'text-emerald-400' : 'text-rose-400'}
                      >
                        HTTP {p.statusCode}
                      </span>
                      <span className="text-zinc-400">{p.latencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === 'logs' && (
            <section className="space-y-4">
              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Erros Reais dos Clientes (telemetry_errors)
                </h2>
                {(srv?.recentErrors || []).length === 0 ? (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-6 text-center text-xs text-zinc-500">
                    Nenhum erro de cliente registrado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(srv?.recentErrors || []).map((e) => (
                      <div
                        key={e.id}
                        className="rounded-lg bg-zinc-950 border border-rose-500/20 p-3 text-xs font-mono"
                      >
                        <div className="text-rose-300 font-semibold">
                          {e.message}
                        </div>
                        <div className="text-zinc-500 mt-1">
                          {e.createdAt} · {e.route} · {e.deviceType} ·{' '}
                          {e.connectionType}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-[#111114] border border-zinc-800/80 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Console da Sessão
                  </h2>
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
                <div className="space-y-1 max-h-[520px] overflow-y-auto font-mono text-xs">
                  {filteredLogs.map((l) => (
                    <div
                      key={l.id}
                      className="rounded bg-zinc-950 px-3 py-1.5 border border-zinc-800/70 flex gap-2"
                    >
                      <span className="text-zinc-500">{l.time}</span>
                      <span className="text-emerald-400">[{l.source}]</span>
                      <span className="text-zinc-200">{l.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {section === 'lgpd' && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#111114] border border-emerald-500/20 p-5 space-y-2.5 text-xs text-zinc-300">
                <h2 className="text-sm font-semibold text-emerald-400">
                  Permitido ao Dono (Telemetria)
                </h2>
                <p>• Uptime, P95, MTTR e histórico em monitor_checks</p>
                <p>• Funil agregado, Web Vitals e instalações PWA</p>
                <p>• Divergência Firestore ↔ Google Agenda (sem nomes)</p>
                <p>• Simulador técnico de disponibilidade e cotas</p>
              </div>
              <div className="rounded-xl bg-[#111114] border border-rose-500/20 p-5 space-y-2.5 text-xs text-zinc-300">
                <h2 className="text-sm font-semibold text-rose-400">
                  Bloqueado por Lei (LGPD)
                </h2>
                <p>• Nomes, e-mails, telefones/WhatsApp de clientes</p>
                <p>• Notas técnicas individuais e histórico financeiro/Pix</p>
                <p>• Edição/criação manual de agendamentos</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
