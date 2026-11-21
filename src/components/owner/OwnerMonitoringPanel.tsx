import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Download,
  Globe,
  Lock,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  clearOwnerGateSession,
  getVaultOwnerEmail,
  isVaultOwnerAuthenticated,
  verifyOwnerVaultCredentials,
} from '../../lib/adminRoute';
import { subscribeAllAppointmentsAdmin } from '../../lib/db';
import { addDaysISO, formatDateBR, todayISO } from '../../lib/utils';
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

type OwnerTab = 'overview' | 'metrics' | 'compliance' | 'logs';
type LogLevel = 'info' | 'ok' | 'warn' | 'err';

interface HealthCheckResult {
  firestoreOk: boolean;
  firestoreLatencyMs: number | null;
  gcalConfigured: boolean;
  gcalConnected: boolean;
  gcalLatencyMs: number | null;
  swActive: boolean;
  storageUsedMB: string | null;
  checkedAt: string;
}

interface LatencySample {
  time: string;
  firestoreMs: number;
  gcalMs: number;
}

interface TechnicalLogEntry {
  id: string;
  time: string;
  level: LogLevel;
  source: string;
  message: string;
}

const APP_VERSION = 'v79.1-pro';

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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | LogLevel>('all');

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<LatencySample[]>([]);
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
      setLogs((prev) => [entry, ...prev].slice(0, 60));
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
      pushLog('err', 'RUNTIME', event.message || 'Erro de execução capturado.');
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
    pushLog('info', 'HEALTH', 'Executando bateria de verificação dos serviços...');

    let firestoreOk = false;
    let firestoreLatencyMs: number | null = null;
    try {
      const t0 = performance.now();
      const resp = await fetch(
        'https://firestore.googleapis.com/v1/projects/studio-de-beleza-8045a/databases/(default)/documents/salon_settings/main',
      );
      firestoreLatencyMs = Math.round(performance.now() - t0);
      firestoreOk = resp.ok;
      pushLog(
        resp.ok ? 'ok' : 'warn',
        'FIRESTORE',
        `HTTP ${resp.status} em ${firestoreLatencyMs}ms.`,
      );
    } catch {
      pushLog('err', 'FIRESTORE', 'Falha de conexão com Firestore REST.');
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
        pushLog(
          gcalConnected ? 'ok' : 'warn',
          'GCAL_API',
          `configurada=${gcalConfigured ? 'sim' : 'não'}, conectada=${gcalConnected ? 'sim' : 'não'} (${gcalLatencyMs}ms).`,
        );
      } else {
        pushLog('warn', 'GCAL_API', `Retornou HTTP ${resp.status}.`);
      }
    } catch {
      pushLog('err', 'GCAL_API', 'Endpoint /api/google-calendar inacessível.');
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
    if (navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === 'number') {
          storageUsedMB = (est.usage / (1024 * 1024)).toFixed(2);
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
      checkedAt: nowTime,
    });

    if (firestoreLatencyMs !== null || gcalLatencyMs !== null) {
      setLatencyHistory((prev) =>
        [
          ...prev,
          {
            time: nowTime.slice(0, 5),
            firestoreMs: firestoreLatencyMs ?? 0,
            gcalMs: gcalLatencyMs ?? 0,
          },
        ].slice(-10),
      );
    }

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
      void runHealthCheck();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [authenticated, autoRefresh, runHealthCheck]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const ok = await verifyOwnerVaultCredentials(loginEmail, loginPassword);
      if (!ok) {
        setLoginError('Credenciais inválidas para a Área do Dono.');
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
  const next7Days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(today, i)),
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
    const next7Set = new Set(next7Days);
    const next7Count = activeAppointments.filter((s) =>
      next7Set.has(s.date),
    ).length;

    const byDay = next7Days.map((date) => ({
      date,
      label: formatDateBR(date).slice(0, 5),
      appointments: activeAppointments.filter((s) => s.date === date).length,
      blocks: activeBlocks.filter((s) => s.date === date).length,
    }));

    const maxDaily = Math.max(1, ...byDay.map((d) => d.appointments));

    const durationBuckets = {
      short: services.filter((s) => s.durationMinutes <= 45).length,
      medium: services.filter(
        (s) => s.durationMinutes > 45 && s.durationMinutes <= 90,
      ).length,
      long: services.filter((s) => s.durationMinutes > 90).length,
    };

    const avgLatencyFirestore =
      latencyHistory.length > 0
        ? Math.round(
            latencyHistory.reduce((acc, s) => acc + s.firestoreMs, 0) /
              latencyHistory.length,
          )
        : health?.firestoreLatencyMs ?? null;

    return {
      totalActiveAppointments: activeAppointments.length,
      totalActiveBlocks: activeBlocks.length,
      todayCount,
      next7Count,
      byDay,
      maxDaily,
      durationBuckets,
      avgLatencyFirestore,
      scheduleMode:
        settings.configuredSlots && settings.configuredSlots.length > 0
          ? `Horários Fixos (${settings.configuredSlots.length} slots)`
          : `Horários Corridos (${settings.slotIntervalMinutes || 30} min)`,
    };
  }, [busySlots, health?.firestoreLatencyMs, latencyHistory, next7Days, services, settings, today]);

  const allSystemsHealthy = Boolean(
    isOnline && health?.firestoreOk && health?.gcalConfigured,
  );

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((l) => l.level === logFilter);
  }, [logs, logFilter]);

  const handleExportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      lgpdCompliance: 'NO_PII_INCLUDED',
      environment: {
        host: typeof window !== 'undefined' ? window.location.host : '',
        online: isOnline,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      },
      health,
      latencyHistory,
      aggregatedMetrics: {
        activeServices: services.length,
        durationBuckets: metrics.durationBuckets,
        activeAppointmentsInAgenda: metrics.totalActiveAppointments,
        activePersonalBlocks: metrics.totalActiveBlocks,
        appointmentsToday: metrics.todayCount,
        appointmentsNext7Days: metrics.next7Count,
        scheduleMode: metrics.scheduleMode,
        workDaysCount: settings.workDays?.length || 0,
        closedMonthsCount: settings.closedMonths?.length || 0,
        blockedDatesCount: settings.blockedDates?.length || 0,
        statusCounts: statusCounts || 'requires_firebase_admin_session',
      },
      recentTechnicalLogs: logs,
    };
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

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#120F0E] text-[#FAF6F1] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-[#1C1715] border border-[#C4A477]/30 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C4A477]/30 to-[#C4A477]/10 border border-[#C4A477]/30 text-[#C4A477] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477]">
                Console do Proprietário
              </span>
              <h1 className="text-xl font-bold tracking-tight">
                Monitoramento & Telemetria
              </h1>
            </div>
          </div>

          <div className="mb-5 rounded-2xl bg-[#120F0E] border border-emerald-500/20 p-3.5 text-xs text-[#E8D6CB]/85 leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Acesso restrito ao dono da plataforma. Por conformidade{' '}
              <strong>LGPD</strong>, este ambiente exibe apenas saúde técnica
              e métricas agregadas (sem dados pessoais de clientes).
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#E8D6CB] mb-1.5">
                E-mail do Desenvolvedor / Dono
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="seu-email@dominio.com"
                className="w-full px-4 py-3 rounded-xl bg-[#120F0E] border border-white/10 text-sm text-white focus:border-[#C4A477] focus:outline-none"
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
                className="w-full px-4 py-3 rounded-xl bg-[#120F0E] border border-white/10 text-sm text-white focus:border-[#C4A477] focus:outline-none"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-400 font-medium">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full min-h-[46px] rounded-xl bg-[#C4A477] text-[#120F0E] font-bold text-sm hover:bg-[#E8D6CB] transition-colors cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? 'Validando credenciais...' : 'Acessar Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#120F0E] text-[#FAF6F1] pb-14">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#1C1715]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4A477]/30 to-[#C4A477]/10 border border-[#C4A477]/30 text-[#C4A477] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight">
                  Console do Dono · Estefany Paiva Nails
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C4A477]/15 text-[#C4A477] border border-[#C4A477]/30">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#E8D6CB]/65">
                {ownerEmail || 'Proprietário'} · Host:{' '}
                {typeof window !== 'undefined' ? window.location.host : 'web'}
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
              title="Atualizar diagnósticos automaticamente a cada 30 segundos"
            >
              {autoRefresh ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{autoRefresh ? 'Ao Vivo (30s)' : 'Auto-Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={checkingHealth}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#C4A477] text-[#120F0E] text-xs font-bold hover:bg-[#E8D6CB] transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`}
              />
              <span>Testar Serviços</span>
            </button>

            <button
              type="button"
              onClick={handleExportReport}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[#FAF6F1] text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Exportar JSON</span>
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
        <div className="max-w-6xl mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              { id: 'overview', label: 'Visão Geral & Saúde', icon: Server },
              { id: 'metrics', label: 'Métricas & Ocupação', icon: BarChart3 },
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Status Banner */}
        <section
          className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3 ${
            allSystemsHealthy
              ? 'bg-emerald-950/35 border-emerald-500/30'
              : 'bg-amber-950/35 border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                allSystemsHealthy
                  ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]'
                  : 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]'
              }`}
            />
            <div>
              <div className="text-sm font-bold">
                {allSystemsHealthy
                  ? 'Todos os sistemas principais operacionais'
                  : health
                    ? 'Atenção detectada em um ou mais serviços'
                    : 'Executando verificação inicial dos serviços...'}
              </div>
              <div className="text-xs text-[#E8D6CB]/70">
                Última checagem: {health?.checkedAt || 'em andamento'} · Modo
                LGPD ativo (zero dados pessoais expostos)
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-black/30 border border-white/10 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            LGPD Compliant
          </span>
        </section>

        {activeTab === 'overview' && (
          <>
            {/* 4 Infrastructure Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4 space-y-2">
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
                  Média sessão:{' '}
                  {metrics.avgLatencyFirestore !== null
                    ? `${metrics.avgLatencyFirestore} ms`
                    : '—'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-[#C4A477]" />
                    Google Agenda API
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      health?.gcalConnected
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {health?.gcalConnected
                      ? 'Conectada'
                      : health?.gcalConfigured
                        ? 'Desconectada'
                        : 'Pendente'}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {health?.gcalLatencyMs !== null &&
                  health?.gcalLatencyMs !== undefined
                    ? `${health.gcalLatencyMs} ms`
                    : '—'}
                </div>
                <p className="text-[11px] text-[#E8D6CB]/55">
                  OAuth:{' '}
                  {health?.gcalConfigured ? 'Configurado' : 'Não configurado'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                    {isOnline ? (
                      <Wifi className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-rose-400" />
                    )}
                    Rede & PWA
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      isOnline ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="text-xl font-bold">
                  {health?.swActive ? 'SW Ativo' : 'Web Padrão'}
                </div>
                <p className="text-[11px] text-[#E8D6CB]/55">
                  Cache local:{' '}
                  {health?.storageUsedMB ? `${health.storageUsedMB} MB` : 'n/d'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-[#C4A477]" />
                    Motor da Agenda
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400">
                    Ativo
                  </span>
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {metrics.totalActiveAppointments} ativos
                </div>
                <p className="text-[11px] text-[#E8D6CB]/55 truncate">
                  {metrics.scheduleMode}
                </p>
              </div>
            </section>

            {/* Latency History */}
            <section className="rounded-2xl bg-[#1C1715] border border-white/10 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#C4A477]" />
                  <span>Histórico de Latência da Sessão (ms)</span>
                </h2>
                <span className="text-[11px] text-[#E8D6CB]/60">
                  Últimas {latencyHistory.length} medições
                </span>
              </div>

              {latencyHistory.length === 0 ? (
                <p className="text-xs text-[#E8D6CB]/60">
                  Aguardando medições...
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {latencyHistory.map((sample, idx) => (
                    <div
                      key={`${sample.time}_${idx}`}
                      className="rounded-xl bg-[#120F0E] border border-white/5 p-3 space-y-1"
                    >
                      <div className="text-[10px] text-[#E8D6CB]/50 tabular-nums">
                        {sample.time}
                      </div>
                      <div className="text-xs font-semibold text-emerald-300 tabular-nums">
                        DB: {sample.firestoreMs}ms
                      </div>
                      <div className="text-xs font-semibold text-[#C4A477] tabular-nums">
                        GCal: {sample.gcalMs}ms
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'metrics' && (
          <section className="space-y-6">
            {/* Aggregated KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">Hoje</div>
                <div className="text-3xl font-bold tabular-nums mt-1 text-[#C4A477]">
                  {metrics.todayCount}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  agendamentos ativos
                </div>
              </div>
              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">Próximos 7 dias</div>
                <div className="text-3xl font-bold tabular-nums mt-1">
                  {metrics.next7Count}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  reservas futuras
                </div>
              </div>
              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">
                  Bloqueios Pessoais
                </div>
                <div className="text-3xl font-bold tabular-nums mt-1">
                  {metrics.totalActiveBlocks}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  datas fechadas: {settings.blockedDates?.length || 0}
                </div>
              </div>
              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-4">
                <div className="text-xs text-[#E8D6CB]/65">
                  Catálogo de Serviços
                </div>
                <div className="text-3xl font-bold tabular-nums mt-1">
                  {services.length}
                </div>
                <div className="text-[11px] text-[#E8D6CB]/50 mt-1">
                  {metrics.durationBuckets.short} curtos ·{' '}
                  {metrics.durationBuckets.medium} médios ·{' '}
                  {metrics.durationBuckets.long} longos
                </div>
              </div>
            </div>

            {/* 7-Day Bar Chart */}
            <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#C4A477]" />
                  <span>Ocupação nos Próximos 7 Dias (Contagem Anonimizada)</span>
                </h2>
                <span className="text-xs text-[#E8D6CB]/60">
                  Expediente: {settings.openTime} às {settings.closeTime}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2.5 items-end h-44 pt-4">
                {metrics.byDay.map((day) => {
                  const pct = Math.max(
                    10,
                    Math.round((day.appointments / metrics.maxDaily) * 100),
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center justify-end h-full gap-2"
                    >
                      <span className="text-xs font-bold tabular-nums text-[#C4A477]">
                        {day.appointments}
                      </span>
                      <div className="w-full max-w-[44px] flex-1 bg-[#120F0E] rounded-xl border border-white/5 flex items-end overflow-hidden p-1">
                        <div
                          style={{ height: `${day.appointments === 0 ? 6 : pct}%` }}
                          className={`w-full rounded-lg transition-all ${
                            day.appointments > 0
                              ? 'bg-gradient-to-t from-[#C4A477] to-[#E8D6CB]'
                              : 'bg-white/10'
                          }`}
                        />
                      </div>
                      <span className="text-[11px] text-[#E8D6CB]/75 tabular-nums">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Distribution (when Firebase Admin session present) */}
            {statusCounts && (
              <div className="rounded-2xl bg-[#1C1715] border border-white/10 p-5 space-y-3">
                <h2 className="text-sm font-bold">
                  Distribuição Geral por Status (Totais Históricos)
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Pendentes</span>
                    <div className="text-xl font-bold mt-1">
                      {statusCounts.pending || 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Confirmados</span>
                    <div className="text-xl font-bold mt-1 text-emerald-400">
                      {statusCounts.confirmed || 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Concluídos</span>
                    <div className="text-xl font-bold mt-1 text-[#C4A477]">
                      {statusCounts.completed || 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5">
                    <span className="text-[#E8D6CB]/65">Cancelados</span>
                    <div className="text-xl font-bold mt-1 text-rose-400">
                      {statusCounts.cancelled || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'compliance' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#1C1715] border border-emerald-500/25 p-5 space-y-3">
              <h2 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Permitido ao Dono do App (Telemetria)</span>
              </h2>
              <ul className="space-y-2 text-xs text-[#E8D6CB]/85">
                <li>• Monitorar disponibilidade e latência do Firestore e Vercel</li>
                <li>• Verificar status OAuth da integração Google Agenda</li>
                <li>• Acompanhar contagens agregadas de agendamentos e ocupação</li>
                <li>• Capturar erros técnicos de runtime e exportar logs sem PII</li>
                <li>• Validar versão publicada ({APP_VERSION}) e cache PWA</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-[#1C1715] border border-rose-500/25 p-5 space-y-3">
              <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Bloqueado por Lei (LGPD / Privacidade)</span>
              </h2>
              <ul className="space-y-2 text-xs text-[#E8D6CB]/85">
                <li>• Nomes completos, e-mails ou dados cadastrais de clientes</li>
                <li>• Números de telefone / WhatsApp e histórico de mensagens</li>
                <li>• Anotações técnicas individuais de atendimento</li>
                <li>• Chaves Pix, comprovantes ou dados financeiros detalhados</li>
                <li>• Alteração ou criação manual de agendamentos da profissional</li>
              </ul>
            </div>

            <div className="md:col-span-2 rounded-2xl bg-[#1C1715] border border-white/10 p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#C4A477]" />
                <span>Controles Técnicos Ativos na Plataforma</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5 flex items-center justify-between">
                  <span>Rota Admin (/painel) com SHA-256 + PBKDF2</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
                <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5 flex items-center justify-between">
                  <span>Rota Dono (/owner) isolada e sem PII</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
                <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5 flex items-center justify-between">
                  <span>Validação de escopo calendar no OAuth Google</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
                <div className="rounded-xl bg-[#120F0E] p-3 border border-white/5 flex items-center justify-between">
                  <span>Ocultação de slots incompatíveis na agenda</span>
                  <span className="text-emerald-400 font-bold">Ativo</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="rounded-2xl bg-[#1C1715] border border-white/10 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#C4A477]" />
                <span>Console de Logs Técnicos</span>
              </h2>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'ok', 'info', 'warn', 'err'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLogFilter(lvl)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase cursor-pointer ${
                      logFilter === lvl
                        ? 'bg-[#C4A477] text-[#120F0E]'
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
              <div className="rounded-xl bg-[#120F0E] border border-white/5 p-6 text-center text-xs text-[#E8D6CB]/55">
                Nenhum registro encontrado para este filtro.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {filteredLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="text-xs font-mono bg-[#120F0E] rounded-xl px-3 py-2 border border-white/5 flex flex-wrap items-start gap-2"
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
