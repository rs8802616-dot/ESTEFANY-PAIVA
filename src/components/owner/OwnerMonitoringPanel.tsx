import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  Compass,
  Copy,
  Cpu,
  Database,
  Download,
  Flame,
  Gauge,
  Globe,
  HardDrive,
  Layers,
  Lock,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  clearOwnerGateSession,
  getVaultOwnerEmail,
  isVaultOwnerAuthenticated,
  verifyOwnerVaultCredentials,
} from '../../lib/adminRoute';
import { subscribeAllAppointmentsAdmin } from '../../lib/db';
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

type OwnerTab =
  | 'overview'
  | 'analytics'
  | 'simulator'
  | 'endpoints'
  | 'compliance'
  | 'logs';
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
  };
  googleCalendar: {
    configured: boolean;
    connected: boolean;
    tokenValid: boolean;
    scopeOk: boolean;
    latencyMs: number | null;
    accountMasked: string | null;
    updatedAt: string | null;
  };
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

const APP_VERSION = 'v81-noc-suite';
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

  const [activeTab, setActiveTab] = useState<OwnerTab>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [logFilter, setLogFilter] = useState<'all' | LogLevel>('all');
  const [copiedReport, setCopiedReport] = useState(false);

  // Simulator state (Zero PII)
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

  // Apenas contagens agregadas (NUNCA armazena PII: nome, telefone, notas)
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
      pushLog('ok', 'NETWORK', 'Conexão de rede restaurada.');
    };
    const onOffline = () => {
      setIsOnline(false);
      pushLog('warn', 'NETWORK', 'Dispositivo entrou em modo offline.');
    };
    const onRuntimeError = (event: ErrorEvent) => {
      pushLog('err', 'RUNTIME', event.message || 'Erro JS capturado.');
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason || 'Promise rejeitada');
      pushLog('err', 'PROMISE', reason);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('error', onRuntimeError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('error', onRuntimeError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
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
    pushLog('info', 'PROBE', 'Executando varredura completa (Client + Server)...');

    const probes: EndpointProbe[] = [];

    // 1. Firestore Settings
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
        name: 'Firestore Config (salon_settings)',
        target: 'firestore.googleapis.com/.../salon_settings/main',
        ok: resp.ok,
        statusCode: resp.status,
        latencyMs: firestoreLatencyMs,
        detail: resp.ok ? 'Leitura pública íntegra' : 'Falha na leitura',
      });
      pushLog(
        resp.ok ? 'ok' : 'warn',
        'FIRESTORE',
        `salon_settings/main -> HTTP ${resp.status} (${firestoreLatencyMs}ms)`,
      );
    } catch {
      probes.push({
        id: 'firestore_settings',
        name: 'Firestore Config (salon_settings)',
        target: 'firestore.googleapis.com/.../salon_settings/main',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Timeout ou erro de rede',
      });
      pushLog('err', 'FIRESTORE', 'Erro de rede em salon_settings/main');
    }

    // 2. Owner Server Telemetry API
    let serverTelemetry: ServerTelemetryPayload | null = null;
    try {
      const t0 = performance.now();
      const resp = await fetch('/api/owner-telemetry');
      const ms = Math.round(performance.now() - t0);
      if (resp.ok) {
        serverTelemetry = (await resp.json()) as ServerTelemetryPayload;
        probes.push({
          id: 'owner_telemetry',
          name: 'Vercel Telemetry (/api/owner-telemetry)',
          target: '/api/owner-telemetry',
          ok: true,
          statusCode: resp.status,
          latencyMs: ms,
          detail: `Região ${serverTelemetry.runtime.vercelRegion} · Node ${serverTelemetry.runtime.nodeVersion}`,
        });
        pushLog(
          'ok',
          'SERVER',
          `Telemetria servidor OK (${ms}ms) · Região: ${serverTelemetry.runtime.vercelRegion}`,
        );
      } else {
        probes.push({
          id: 'owner_telemetry',
          name: 'Vercel Telemetry (/api/owner-telemetry)',
          target: '/api/owner-telemetry',
          ok: false,
          statusCode: resp.status,
          latencyMs: ms,
          detail: 'Endpoint de telemetria indisponível',
        });
        pushLog('warn', 'SERVER', `/api/owner-telemetry HTTP ${resp.status}`);
      }
    } catch {
      probes.push({
        id: 'owner_telemetry',
        name: 'Vercel Telemetry (/api/owner-telemetry)',
        target: '/api/owner-telemetry',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Sem resposta do servidor',
      });
    }

    // 3. Google Calendar Serverless API
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
          name: 'Google Calendar API (/api/google-calendar)',
          target: '/api/google-calendar?action=status',
          ok: gcalConfigured,
          statusCode: resp.status,
          latencyMs: gcalLatencyMs,
          detail: gcalConnected
            ? 'OAuth ativo e conectado'
            : gcalConfigured
              ? 'OAuth configurado (aguardando vínculo)'
              : 'Credenciais ausentes no servidor',
        });
        pushLog(
          gcalConnected ? 'ok' : 'warn',
          'GCAL_API',
          `status=${resp.status}, configurada=${gcalConfigured}, conectada=${gcalConnected} (${gcalLatencyMs}ms)`,
        );
      } else {
        probes.push({
          id: 'gcal_api',
          name: 'Google Calendar API (/api/google-calendar)',
          target: '/api/google-calendar?action=status',
          ok: false,
          statusCode: resp.status,
          latencyMs: gcalLatencyMs,
          detail: 'Endpoint retornou erro HTTP',
        });
      }
    } catch {
      probes.push({
        id: 'gcal_api',
        name: 'Google Calendar API (/api/google-calendar)',
        target: '/api/google-calendar?action=status',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Endpoint inacessível',
      });
    }

    // 4. PWA Manifest
    try {
      const t0 = performance.now();
      const resp = await fetch('/manifest.webmanifest');
      const ms = Math.round(performance.now() - t0);
      probes.push({
        id: 'pwa_manifest',
        name: 'Manifesto PWA (/manifest.webmanifest)',
        target: '/manifest.webmanifest',
        ok: resp.ok,
        statusCode: resp.status,
        latencyMs: ms,
        detail: resp.ok ? 'Instalável (Android/iOS/Desktop)' : 'Manifesto ausente',
      });
    } catch {
      probes.push({
        id: 'pwa_manifest',
        name: 'Manifesto PWA (/manifest.webmanifest)',
        target: '/manifest.webmanifest',
        ok: false,
        statusCode: 'ERR',
        latencyMs: 0,
        detail: 'Erro ao carregar manifesto',
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
        // ignore storage quota errors
      }
      return next;
    });

    setCheckingHealth(false);
  }, [pushLog]);

  useEffect(() => {
    if (authenticated) {
      void runHealthCheck();
    }
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const ok = await verifyOwnerVaultCredentials(loginEmail, loginPassword);
      if (!ok) {
        setLoginError('Credenciais inválidas para o Console do Dono.');
        return;
      }
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
    }));

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

    const durationBuckets = {
      short: services.filter((s) => s.durationMinutes <= 45).length,
      medium: services.filter(
        (s) => s.durationMinutes > 45 && s.durationMinutes <= 90,
      ).length,
      long: services.filter((s) => s.durationMinutes > 90).length,
    };

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
    const avgDbMs =
      dbLatencies.length > 0
        ? Math.round(dbLatencies.reduce((a, b) => a + b, 0) / dbLatencies.length)
        : health?.firestoreLatencyMs ?? null;
    const sortedDb = [...dbLatencies].sort((a, b) => a - b);
    const p95DbMs =
      sortedDb.length > 0
        ? sortedDb[
            Math.min(sortedDb.length - 1, Math.floor(sortedDb.length * 0.95))
          ]
        : null;

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
      maxDaily,
      hourBuckets,
      maxHourBucket,
      durationBuckets,
      avgServicePrice,
      avgServiceDuration,
      avgDbMs,
      p95DbMs,
      uptimePct,
      scheduleMode:
        settings.configuredSlots && settings.configuredSlots.length > 0
          ? `Horários Fixos (${settings.configuredSlots.length} slots)`
          : `Horários Corridos (${settings.slotIntervalMinutes || 30} min)`,
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
    () =>
      generateTimeSlotsForDate(simDate, simDuration, settings, busySlots),
    [simDate, simDuration, settings, busySlots],
  );

  const alerts = useMemo(() => {
    const list: { level: 'warn' | 'err' | 'info'; title: string; detail: string }[] = [];
    if (!isOnline) {
      list.push({
        level: 'err',
        title: 'Dispositivo Offline',
        detail: 'Sem conexão com a internet no momento.',
      });
    }
    if (health && !health.firestoreOk) {
      list.push({
        level: 'err',
        title: 'Falha de Leitura no Firestore',
        detail: 'A consulta ao banco de dados retornou erro.',
      });
    }
    if (health?.firestoreLatencyMs && health.firestoreLatencyMs > 600) {
      list.push({
        level: 'warn',
        title: 'Latência Elevada no Banco',
        detail: `Firestore respondeu em ${health.firestoreLatencyMs}ms (ideal < 400ms).`,
      });
    }
    if (health && !health.gcalConnected) {
      list.push({
        level: 'warn',
        title: 'Google Agenda Desconectado',
        detail:
          'A sincronização automática aguarda vínculo Google no /painel.',
      });
    }
    if (
      health?.serverTelemetry?.googleCalendar.connected &&
      !health.serverTelemetry.googleCalendar.tokenValid
    ) {
      list.push({
        level: 'warn',
        title: 'Token Google Agenda Expirado/Pendente Renovação',
        detail:
          'Será renovado automaticamente no próximo evento via refresh_token.',
      });
    }
    if ((settings.workDays?.length || 0) === 0) {
      list.push({
        level: 'warn',
        title: 'Nenhum dia útil configurado',
        detail: 'A agenda pública não exibirá horários disponíveis.',
      });
    }
    return list;
  }, [health, isOnline, settings.workDays]);

  const allSystemsHealthy =
    isOnline && alerts.length === 0 && Boolean(health?.firestoreOk);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((l) => l.level === logFilter);
  }, [logs, logFilter]);

  const buildReportPayload = () => ({
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    lgpdCompliance: 'NO_PII_INCLUDED',
    environment: {
      host: typeof window !== 'undefined' ? window.location.host : '',
      online: isOnline,
      platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
    },
    health,
    uptimePct: metrics.uptimePct,
    latencyStats: {
      avgFirestoreMs: metrics.avgDbMs,
      p95FirestoreMs: metrics.p95DbMs,
      samplesCount: latencyHistory.length,
    },
    activeAlerts: alerts,
    aggregatedMetrics: {
      activeServices: services.length,
      avgServiceDurationMin: metrics.avgServiceDuration,
      durationBuckets: metrics.durationBuckets,
      activeAppointmentsInAgenda: metrics.totalActiveAppointments,
      activePersonalBlocks: metrics.totalActiveBlocks,
      appointmentsToday: metrics.todayCount,
      appointmentsNext7Days: metrics.next7Count,
      appointmentsNext14Days: metrics.next14Count,
      peakHoursDistribution: metrics.hourBuckets.map((b) => ({
        window: b.label,
        count: b.count,
      })),
      scheduleMode: metrics.scheduleMode,
      workDaysCount: settings.workDays?.length || 0,
      closedMonthsCount: settings.closedMonths?.length || 0,
      blockedDatesCount: settings.blockedDates?.length || 0,
      statusCounts: statusCounts || 'requires_firebase_admin_session',
    },
    recentTechnicalLogs: logs.slice(0, 30),
  });

  const handleExportReport = () => {
    const report = buildReportPayload();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `owner-telemetry-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushLog('ok', 'EXPORT', 'Relatório técnico JSON (sem PII) exportado.');
  };

  const handleCopyDiagnostic = async () => {
    const srv = health?.serverTelemetry;
    const summary = [
      `=== TELEMETRIA ${APP_VERSION} (${today}) ===`,
      `Host: ${window.location.host} | Env: ${srv?.runtime.vercelEnv ?? 'web'} | Região: ${srv?.runtime.vercelRegion ?? '—'} | Commit: ${srv?.runtime.commitSha ?? '—'}`,
      `Uptime: ${metrics.uptimePct}% | DB Client: ${health?.firestoreLatencyMs ?? '—'}ms (Média ${metrics.avgDbMs ?? '—'}ms / P95 ${metrics.p95DbMs ?? '—'}ms) | DB Server: ${srv?.firestore.latencyMs ?? '—'}ms`,
      `Google Agenda: ${health?.gcalConnected ? 'Conectada' : 'Desconectada'} | Token Válido: ${srv?.googleCalendar.tokenValid ? 'Sim' : 'Não'} (${srv?.googleCalendar.accountMasked ?? '—'})`,
      `Agenda: ${metrics.totalActiveAppointments} ativos | Hoje: ${metrics.todayCount} | 7d: ${metrics.next7Count} | 14d: ${metrics.next14Count}`,
      `Modelo: ${metrics.scheduleMode} | Serviços: ${services.length}`,
      `Alertas: ${alerts.length === 0 ? 'Nenhum' : alerts.map((a) => a.title).join('; ')}`,
      `LGPD: ZERO PII`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedReport(true);
      pushLog('ok', 'CLIPBOARD', 'Resumo técnico copiado.');
      window.setTimeout(() => setCopiedReport(false), 2200);
    } catch {
      pushLog('warn', 'CLIPBOARD', 'Falha ao copiar automaticamente.');
    }
  };

  const handleForceRefreshPWA = async () => {
    pushLog('info', 'PWA', 'Limpando caches do Service Worker...');
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
      pushLog('warn', 'PWA', 'Não foi possível limpar o cache.');
    }
  };

  const handleClearTelemetryHistory = () => {
    localStorage.removeItem(TELEMETRY_HISTORY_KEY);
    setLatencyHistory([]);
    pushLog('info', 'STORAGE', 'Histórico local de latência reiniciado.');
  };

  const sparkline = useMemo(() => {
    if (latencyHistory.length < 2) return null;
    const width = 560;
    const height = 110;
    const pad = 10;
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

    return {
      width,
      height,
      maxVal,
      dbPoints: toPoints((s) => s.firestoreMs),
      gcalPoints: toPoints((s) => s.gcalMs),
    };
  }, [latencyHistory]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0D0B0A] text-[#FAF6F1] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-[#181412] border border-[#C4A477]/30 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C4A477]/30 to-[#C4A477]/5 border border-[#C4A477]/35 text-[#C4A477] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477]">
                NOC & Observability Suite
              </span>
              <h1 className="text-xl font-bold tracking-tight">
                Área Exclusiva do Dono
              </h1>
            </div>
          </div>

          <div className="mb-5 rounded-2xl bg-[#0D0B0A] border border-emerald-500/20 p-3.5 text-xs text-[#E8D6CB]/85 leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Console técnico para monitoramento de SLA, servidor Vercel, APIs e
              diagnóstico de agenda. Conformidade total{' '}
              <strong>LGPD (Zero PII)</strong>.
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#E8D6CB] mb-1.5">
                E-mail do Proprietário / Dev
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="seu-email@dominio.com"
                className="w-full px-4 py-3 rounded-xl bg-[#0D0B0A] border border-white/10 text-sm text-white focus:border-[#C4A477] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E8D6CB] mb-1.5">
                Senha de Acesso
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-[#0D0B0A] border border-white/10 text-sm text-white focus:border-[#C4A477] focus:outline-none"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-400 font-medium">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full min-h-[46px] rounded-xl bg-[#C4A477] text-[#0D0B0A] font-bold text-sm hover:bg-[#E8D6CB] transition-colors cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? 'Autenticando...' : 'Abrir NOC Command Center'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const srv = health?.serverTelemetry;
  const ringRadius = 28;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference - (metrics.uptimePct / 100) * ringCircumference;

  return (
    <div className="min-h-screen bg-[#0D0B0A] text-[#FAF6F1] pb-16">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-[#151210]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4A477]/30 to-[#C4A477]/5 border border-[#C4A477]/35 text-[#C4A477] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight">
                  NOC Command Center · Estefany Paiva Nails
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C4A477]/15 text-[#C4A477] border border-[#C4A477]/30">
                  {APP_VERSION}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" /> LGPD Zero-PII
                </span>
              </div>
              <p className="text-xs text-[#E8D6CB]/60">
                Operador: {ownerEmail || 'Dono'} · Env:{' '}
                {srv?.runtime.vercelEnv || 'web'} · Região:{' '}
                {srv?.runtime.vercelRegion || '—'}
                {srv?.runtime.commitSha ? ` · #${srv.runtime.commitSha}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/5 text-[#E8D6CB]/80 border-white/10 hover:bg-white/10'
              }`}
            >
              {autoRefresh ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{autoRefresh ? `Ao Vivo (${countdown}s)` : 'Pausado'}</span>
            </button>

            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={checkingHealth}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#C4A477] text-[#0D0B0A] text-xs font-bold hover:bg-[#E8D6CB] transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`}
              />
              <span>Sondar Agora</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyDiagnostic()}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[#FAF6F1] text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
            >
              {copiedReport ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#C4A477]" />
              )}
              <span>{copiedReport ? 'Copiado' : 'Copiar Resumo'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportReport}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[#FAF6F1] text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              { id: 'overview', label: 'Visão Geral & Servidor', icon: Gauge },
              {
                id: 'analytics',
                label: 'Demanda & Ocupação',
                icon: BarChart3,
              },
              {
                id: 'simulator',
                label: 'Simulador de Agenda',
                icon: Compass,
              },
              {
                id: 'endpoints',
                label: `Endpoints (${health?.probes.length || 4})`,
                icon: Zap,
              },
              {
                id: 'compliance',
                label: 'Segurança & LGPD',
                icon: ShieldCheck,
              },
              {
                id: 'logs',
                label: `Logs (${logs.length})`,
                icon: Terminal,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#C4A477]/20 text-[#C4A477] border border-[#C4A477]/40'
                    : 'text-[#E8D6CB]/70 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Global Status + SVG SLA Ring */}
        <section
          className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-4 ${
            allSystemsHealthy
              ? 'bg-emerald-950/30 border-emerald-500/30'
              : 'bg-amber-950/30 border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 68 68">
                <circle
                  cx="34"
                  cy="34"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="6"
                />
                <circle
                  cx="34"
                  cy="34"
                  r={ringRadius}
                  fill="none"
                  stroke={allSystemsHealthy ? '#34d399' : '#fbbf24'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className="absolute text-xs font-bold tabular-nums">
                {metrics.uptimePct}%
              </span>
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold">
                {allSystemsHealthy
                  ? 'Todos os subsistemas operando normalmente'
                  : `${alerts.length} alerta(s) operacional(is) detectado(s)`}
              </div>
              <div className="text-xs text-[#E8D6CB]/70 mt-0.5">
                Última sondagem: {health?.checkedAt || 'executando...'} ·
                Servidor: {srv?.runtime.vercelRegion || 'local'} (Node{' '}
                {srv?.runtime.nodeVersion || '—'})
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-[#E8D6CB]">
              DB Client: <strong>{metrics.avgDbMs ?? '—'}ms</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-[#E8D6CB]">
              DB Server: <strong>{srv?.firestore.latencyMs ?? '—'}ms</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-[#E8D6CB]">
              P95: <strong>{metrics.p95DbMs ?? '—'}ms</strong>
            </span>
          </div>
        </section>

        {activeTab === 'overview' && (
          <>
            {/* 4 Executive KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[#C4A477]" />
                    Firestore DB
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      health?.firestoreOk
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {health?.firestoreOk ? 'Online' : 'Verificando'}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {health?.firestoreLatencyMs !== null &&
                  health?.firestoreLatencyMs !== undefined
                    ? `${health.firestoreLatencyMs} ms`
                    : '—'}
                </div>
                <p className="text-[11px] text-[#E8D6CB]/55">
                  Docs: {srv?.firestore.counts.availabilitySlots ?? '—'} slots ·{' '}
                  {srv?.firestore.counts.services ?? '—'} serviços
                </p>
              </div>

              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-[#C4A477]" />
                    Google Agenda API
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      srv?.googleCalendar.tokenValid || health?.gcalConnected
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {srv?.googleCalendar.tokenValid
                      ? 'Token Válido'
                      : health?.gcalConnected
                        ? 'Conectada'
                        : 'Desconectada'}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {srv?.googleCalendar.latencyMs ?? health?.gcalLatencyMs ?? '—'}{' '}
                  ms
                </div>
                <p className="text-[11px] text-[#E8D6CB]/55 truncate">
                  Conta: {srv?.googleCalendar.accountMasked || 'Não vinculada'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-[#C4A477]" />
                    Vercel Serverless
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400">
                    {srv?.ok ? 'Operacional' : 'Verificando'}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {srv ? `${srv.totalDurationMs} ms` : '—'}
                </div>
                <p className="text-[11px] text-[#E8D6CB]/55 truncate">
                  {srv?.runtime.vercelRegion || 'local'} ·{' '}
                  {srv?.runtime.nodeVersion || 'Node'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                    {isOnline ? (
                      <Wifi className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-rose-400" />
                    )}
                    PWA & Motor
                  </span>
                  <span className="text-[11px] font-bold text-[#C4A477]">
                    {metrics.todayCount} hoje
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {health?.storageUsedMB ? `${health.storageUsedMB} MB` : 'Web'}
                </div>
                <p className="text-[11px] text-[#E8D6CB]/55 truncate">
                  {metrics.scheduleMode}
                </p>
              </div>
            </section>

            {/* Latency Sparkline + Active Alerts & Maintenance */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#C4A477]" />
                      <span>Telemetria de Latência em Tempo Real (ms)</span>
                    </h2>
                    <p className="text-[11px] text-[#E8D6CB]/60">
                      Últimas {latencyHistory.length} medições salvas
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-emerald-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      Firestore
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#C4A477]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#C4A477]" />
                      Google Agenda API
                    </span>
                    {latencyHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearTelemetryHistory}
                        className="text-[#E8D6CB]/50 hover:text-white underline cursor-pointer"
                      >
                        Zerar
                      </button>
                    )}
                  </div>
                </div>

                {sparkline ? (
                  <div className="w-full overflow-hidden rounded-xl bg-[#0D0B0A] border border-white/5 p-3">
                    <svg
                      viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                      className="w-full h-36"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1="10"
                        y1={sparkline.height / 2}
                        x2={sparkline.width - 10}
                        y2={sparkline.height / 2}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="4 4"
                      />
                      <polyline
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={sparkline.dbPoints}
                      />
                      <polyline
                        fill="none"
                        stroke="#C4A477"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={sparkline.gcalPoints}
                      />
                    </svg>
                    <div className="flex justify-between text-[10px] text-[#E8D6CB]/50 tabular-nums mt-1">
                      <span>{latencyHistory[0]?.time}</span>
                      <span>Escala máx: {sparkline.maxVal}ms</span>
                      <span>
                        {latencyHistory[latencyHistory.length - 1]?.time}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#0D0B0A] border border-white/5 p-8 text-center text-xs text-[#E8D6CB]/55">
                    Aguardando 2 medições para traçar o gráfico de latência...
                  </div>
                )}
              </div>

              {/* Alerts & Maintenance */}
              <div className="rounded-2xl bg-[#181412] border border-white/10 p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#C4A477]" />
                    <span>Detector de Anomalias</span>
                  </h2>
                  {alerts.length === 0 ? (
                    <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">0 incidentes ativos</div>
                        <p className="text-emerald-200/75 mt-0.5">
                          Banco, Vercel e Google Agenda operando normalmente.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map((al, i) => (
                        <div
                          key={i}
                          className={`rounded-xl p-3 border text-xs flex items-start gap-2 ${
                            al.level === 'err'
                              ? 'bg-rose-950/35 border-rose-500/30 text-rose-200'
                              : 'bg-amber-950/35 border-amber-500/30 text-amber-100'
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">{al.title}</div>
                            <div className="opacity-80 mt-0.5">{al.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-[11px] font-semibold text-[#E8D6CB]/65 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-[#C4A477]" />
                    <span>Manutenção Rápida</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleForceRefreshPWA()}
                    className="w-full min-h-[36px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#FAF6F1] transition-colors cursor-pointer"
                  >
                    Limpar Cache PWA & Recarregar App
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'analytics' && (
          <section className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">Hoje / 7 dias</div>
                <div className="text-2xl font-bold tabular-nums mt-1 text-[#C4A477]">
                  {metrics.todayCount} / {metrics.next7Count}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  14 dias: {metrics.next14Count} reservas
                </div>
              </div>

              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">
                  Bloqueios & Folgas
                </div>
                <div className="text-2xl font-bold tabular-nums mt-1">
                  {metrics.totalActiveBlocks}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  Datas fechadas: {settings.blockedDates?.length || 0} · Meses:{' '}
                  {settings.closedMonths?.length || 0}
                </div>
              </div>

              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">
                  Serviços no Catálogo
                </div>
                <div className="text-2xl font-bold tabular-nums mt-1">
                  {services.length}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  Duração média: {metrics.avgServiceDuration} min
                </div>
              </div>

              <div className="rounded-2xl bg-[#181412] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">
                  Ticket Médio Catálogo
                </div>
                <div className="text-2xl font-bold tabular-nums mt-1 text-emerald-400">
                  {formatBRL(metrics.avgServicePrice)}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  Média agregada de serviços
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#C4A477]" />
                    <span>Projeção de Demanda · Próximos 14 Dias</span>
                  </h2>
                  <span className="text-[11px] text-[#E8D6CB]/60">
                    Expediente {settings.openTime}–{settings.closeTime}
                  </span>
                </div>

                <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 items-end h-44 pt-4">
                  {metrics.byDay14.map((day) => {
                    const total = day.appointments + day.blocks;
                    const pct = Math.max(
                      8,
                      Math.round((total / metrics.maxDaily) * 100),
                    );
                    return (
                      <div
                        key={day.date}
                        title={`${day.label}: ${day.appointments} atend., ${day.blocks} bloq.`}
                        className="flex flex-col items-center justify-end h-full gap-1.5"
                      >
                        <span className="text-[10px] font-bold tabular-nums text-[#C4A477]">
                          {day.appointments}
                        </span>
                        <div className="w-full flex-1 bg-[#0D0B0A] rounded-lg border border-white/5 flex items-end overflow-hidden p-0.5">
                          <div
                            style={{
                              height: `${total === 0 ? 6 : pct}%`,
                            }}
                            className={`w-full rounded-md ${
                              day.appointments > 0
                                ? 'bg-gradient-to-t from-[#C4A477] to-[#E8D6CB]'
                                : day.blocks > 0
                                  ? 'bg-amber-500/50'
                                  : 'bg-white/10'
                            }`}
                          />
                        </div>
                        <span className="text-[9px] text-[#E8D6CB]/65 tabular-nums">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#C4A477]" />
                  <span>Mapa de Horários de Pico</span>
                </h2>
                <div className="space-y-2.5">
                  {metrics.hourBuckets.map((b) => {
                    const pct = Math.round(
                      (b.count / metrics.maxHourBucket) * 100,
                    );
                    return (
                      <div key={b.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#E8D6CB]/80 tabular-nums">
                            {b.label}
                          </span>
                          <span className="font-bold text-[#C4A477] tabular-nums">
                            {b.count}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#0D0B0A] overflow-hidden">
                          <div
                            style={{
                              width: `${b.count === 0 ? 0 : Math.max(8, pct)}%`,
                            }}
                            className="h-full rounded-full bg-gradient-to-r from-[#C4A477] to-amber-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {statusCounts && (
              <div className="rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#C4A477]" />
                  <span>Totais Históricos por Status (Anonimizado)</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Pendentes</span>
                    <div className="text-2xl font-bold mt-1">
                      {statusCounts.pending || 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Confirmados</span>
                    <div className="text-2xl font-bold mt-1 text-emerald-400">
                      {statusCounts.confirmed || 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Concluídos</span>
                    <div className="text-2xl font-bold mt-1 text-[#C4A477]">
                      {statusCounts.completed || 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Cancelados</span>
                    <div className="text-2xl font-bold mt-1 text-rose-400">
                      {statusCounts.cancelled || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'simulator' && (
          <section className="rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#C4A477]" />
                  <span>Simulador Técnico de Disponibilidade (Sem PII)</span>
                </h2>
                <p className="text-xs text-[#E8D6CB]/60 mt-0.5">
                  Audite exatamente quais horários o algoritmo libera ou bloqueia
                  para qualquer data e duração, sem exibir dados de clientes.
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-lg bg-[#0D0B0A] border border-white/10 text-[#C4A477] font-semibold">
                {metrics.scheduleMode}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#E8D6CB] mb-1.5">
                  Data para Simulação
                </label>
                <input
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0D0B0A] border border-white/10 text-sm text-white focus:border-[#C4A477] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E8D6CB] mb-1.5">
                  Duração Simulada do Procedimento
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 90, 120, 150, 180].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setSimDuration(min)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        simDuration === min
                          ? 'bg-[#C4A477] text-[#0D0B0A] border-[#C4A477]'
                          : 'bg-[#0D0B0A] text-[#E8D6CB]/80 border-white/10 hover:border-[#C4A477]/50'
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {simulatedSlots.length === 0 ? (
              <div className="rounded-xl bg-[#0D0B0A] border border-white/5 p-6 text-center text-xs text-[#E8D6CB]/65">
                Dia fechado ou sem atendimento configurado para{' '}
                {formatDateBR(simDate)}.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {simulatedSlots.map((slot) => (
                  <div
                    key={slot.startTime}
                    className={`rounded-xl p-3 border text-xs ${
                      slot.available
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                        : 'bg-[#0D0B0A] border-white/10 text-[#E8D6CB]/55'
                    }`}
                  >
                    <div className="font-bold tabular-nums text-sm">
                      {slot.startTime} → {slot.endTime}
                    </div>
                    <div className="text-[11px] mt-1 font-medium">
                      {slot.available ? 'Livre no site' : slot.reason || 'Bloqueado'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'endpoints' && (
          <section className="rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#C4A477]" />
                  <span>Monitoramento de Endpoints & Infraestrutura</span>
                </h2>
                <p className="text-xs text-[#E8D6CB]/60">
                  Sondagem ao vivo contra Firestore, Vercel Telemetry, Google
                  Agenda e PWA.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runHealthCheck()}
                disabled={checkingHealth}
                className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C4A477]/20 text-[#C4A477] border border-[#C4A477]/35 text-xs font-bold hover:bg-[#C4A477]/30 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`}
                />
                <span>Re-testar Todos</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {(health?.probes || []).map((probe) => (
                <div
                  key={probe.id}
                  className="rounded-xl bg-[#0D0B0A] border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          probe.ok ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span className="text-sm font-bold">{probe.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-[#E8D6CB]/55 mt-1 truncate">
                      {probe.target}
                    </div>
                    <div className="text-xs text-[#E8D6CB]/80 mt-1">
                      {probe.detail}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 border border-white/10">
                      HTTP {probe.statusCode}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums bg-[#C4A477]/15 text-[#C4A477] border border-[#C4A477]/30">
                      {probe.latencyMs} ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'compliance' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#181412] border border-emerald-500/25 p-5 space-y-3">
              <h2 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Permitido ao Dono do App (Telemetria)</span>
              </h2>
              <ul className="space-y-2 text-xs text-[#E8D6CB]/85">
                <li>• Monitorar disponibilidade, SLA e latência Client/Server</li>
                <li>• Auditar status OAuth e validade do token Google Agenda</li>
                <li>• Simular disponibilidade técnica da agenda sem PII</li>
                <li>• Acompanhar contagens agregadas e horários de pico</li>
                <li>• Capturar erros de runtime e exportar logs sem PII</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-[#181412] border border-rose-500/25 p-5 space-y-3">
              <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Bloqueado por Lei (LGPD / Privacidade)</span>
              </h2>
              <ul className="space-y-2 text-xs text-[#E8D6CB]/85">
                <li>• Nomes completos, e-mails ou dados cadastrais de clientes</li>
                <li>• Números de telefone / WhatsApp e histórico de mensagens</li>
                <li>• Anotações técnicas individuais de atendimento</li>
                <li>• Chaves Pix, comprovantes ou dados financeiros individuais</li>
                <li>• Alteração ou criação manual de agendamentos da profissional</li>
              </ul>
            </div>

            <div className="md:col-span-2 rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#C4A477]" />
                <span>Controles Técnicos de Segurança Ativos</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5 flex items-center justify-between">
                  <span>Rota Admin (/painel) com SHA-256 + PBKDF2</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
                <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5 flex items-center justify-between">
                  <span>Rota Dono (/owner) isolada e sem PII</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
                <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5 flex items-center justify-between">
                  <span>Endpoint /api/owner-telemetry mascarado (Zero PII)</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
                <div className="rounded-xl bg-[#0D0B0A] p-3.5 border border-white/5 flex items-center justify-between">
                  <span>Validação de escopo calendar no OAuth Google</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="rounded-2xl bg-[#181412] border border-white/10 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#C4A477]" />
                <span>Console de Logs & Erros de Runtime</span>
              </h2>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'ok', 'info', 'warn', 'err'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLogFilter(lvl)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase cursor-pointer ${
                      logFilter === lvl
                        ? 'bg-[#C4A477] text-[#0D0B0A]'
                        : 'bg-white/5 text-[#E8D6CB]/70 hover:bg-white/10'
                    }`}
                  >
                    {lvl === 'all' ? 'Todos' : lvl}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpar
                </button>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="rounded-xl bg-[#0D0B0A] border border-white/5 p-6 text-center text-xs text-[#E8D6CB]/55">
                Nenhum registro encontrado para este filtro.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {filteredLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="text-xs font-mono bg-[#0D0B0A] rounded-xl px-3 py-2 border border-white/5 flex flex-wrap items-start gap-2"
                  >
                    <span className="text-[#E8D6CB]/45 shrink-0">
                      {entry.time}
                    </span>
                    <span
                      className={
                        entry.level === 'ok'
                          ? 'text-emerald-400 font-bold'
                          : entry.level === 'warn'
                            ? 'text-amber-400 font-bold'
                            : entry.level === 'err'
                              ? 'text-rose-400 font-bold'
                              : 'text-[#C4A477] font-bold'
                      }
                    >
                      [{entry.level.toUpperCase()}]
                    </span>
                    <span className="text-sky-300/80">[{entry.source}]</span>
                    <span className="text-[#FAF6F1]/90">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
