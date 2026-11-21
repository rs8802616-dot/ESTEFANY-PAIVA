import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Database,
  Download,
  Lock,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
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

interface HealthCheckResult {
  firestoreOk: boolean;
  firestoreLatencyMs: number | null;
  gcalConfigured: boolean;
  gcalConnected: boolean;
  gcalLatencyMs: number | null;
  swActive: boolean;
  checkedAt: string;
}

interface TechnicalLogEntry {
  id: string;
  time: string;
  level: 'info' | 'ok' | 'warn';
  message: string;
}

const APP_VERSION = 'v79-owner-monitoring';

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

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [logs, setLogs] = useState<TechnicalLogEntry[]>([]);

  // Apenas contagens agregadas (NUNCA armazena PII: nome, telefone, notas)
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(
    null,
  );

  const pushLog = useCallback(
    (level: TechnicalLogEntry['level'], message: string) => {
      const entry: TechnicalLogEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString('pt-BR'),
        level,
        message,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 25));
    },
    [],
  );

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      pushLog('ok', 'Conexão de rede restaurada.');
    };
    const onOffline = () => {
      setIsOnline(false);
      pushLog('warn', 'Dispositivo ficou offline.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [pushLog]);

  // Se o Firebase Auth também estiver como admin, agrega apenas contagens por status (descarta PII imediatamente)
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
    pushLog('info', 'Iniciando diagnóstico técnico dos serviços...');

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
        `Firestore respondeu HTTP ${resp.status} em ${firestoreLatencyMs}ms.`,
      );
    } catch {
      pushLog('warn', 'Falha ao consultar Firestore REST.');
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
          `API Google Agenda: configurada=${gcalConfigured ? 'sim' : 'não'}, conectada=${gcalConnected ? 'sim' : 'não'} (${gcalLatencyMs}ms).`,
        );
      } else {
        pushLog('warn', `API Google Agenda retornou HTTP ${resp.status}.`);
      }
    } catch {
      pushLog('warn', 'Não foi possível contactar /api/google-calendar.');
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

    setHealth({
      firestoreOk,
      firestoreLatencyMs,
      gcalConfigured,
      gcalConnected,
      gcalLatencyMs,
      swActive,
      checkedAt: new Date().toLocaleTimeString('pt-BR'),
    });
    setCheckingHealth(false);
  }, [pushLog]);

  useEffect(() => {
    if (authenticated) {
      void runHealthCheck();
    }
  }, [authenticated, runHealthCheck]);

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

    return {
      totalActiveAppointments: activeAppointments.length,
      totalActiveBlocks: activeBlocks.length,
      todayCount,
      next7Count,
      byDay,
      scheduleMode:
        settings.configuredSlots && settings.configuredSlots.length > 0
          ? `Horários Fixos (${settings.configuredSlots.length})`
          : `Intervalo (${settings.slotIntervalMinutes || 30} min)`,
    };
  }, [busySlots, next7Days, settings, today]);

  const handleExportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      lgpdCompliance: 'NO_PII_INCLUDED',
      host: window.location.host,
      online: isOnline,
      health,
      aggregatedMetrics: {
        activeServices: services.length,
        activeAppointmentsInAgenda: metrics.totalActiveAppointments,
        activePersonalBlocks: metrics.totalActiveBlocks,
        appointmentsToday: metrics.todayCount,
        appointmentsNext7Days: metrics.next7Count,
        scheduleMode: metrics.scheduleMode,
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
    pushLog('ok', 'Relatório técnico (sem dados pessoais) exportado em JSON.');
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#181412] text-[#FAF6F1] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-[#231D1A] border border-[#C4A477]/30 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-[#C4A477]/20 text-[#C4A477] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Área do Dono do App
              </h1>
              <p className="text-xs text-[#C4A477]">
                Monitoramento Técnico · Conformidade LGPD
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-2xl bg-[#181412] border border-[#C4A477]/20 p-3.5 text-xs text-[#E8D6CB]/80 leading-relaxed">
            Acesso exclusivo para telemetria, saúde das APIs e métricas
            agregadas. Dados pessoais de clientes não são exibidos neste painel.
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
                className="w-full px-4 py-3 rounded-xl bg-[#181412] border border-[#E8D6CB]/20 text-sm text-white focus:border-[#C4A477] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E8D6CB] mb-1.5">
                Senha
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-[#181412] border border-[#E8D6CB]/20 text-sm text-white focus:border-[#C4A477] focus:outline-none"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-400 font-medium">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full min-h-[46px] rounded-xl bg-[#C4A477] text-[#181412] font-bold text-sm hover:bg-[#E8D6CB] transition-colors cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? 'Validando acesso...' : 'Entrar no Monitoramento'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#181412] text-[#FAF6F1] pb-12">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-[#231D1A]/95 backdrop-blur-md border-b border-[#C4A477]/25 px-4 sm:px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C4A477]/20 text-[#C4A477] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold">
                  Monitoramento do Dono
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C4A477]/20 text-[#C4A477] border border-[#C4A477]/30">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#E8D6CB]/70">
                Operador: {ownerEmail || 'Dono da Plataforma'} · Telemetria sem
                PII
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={checkingHealth}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C4A477] text-[#181412] text-xs font-bold hover:bg-[#E8D6CB] transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`}
              />
              <span>Testar Agora</span>
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-[#FAF6F1] text-xs font-semibold hover:bg-white/15 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Exportar JSON</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Banner Legal / LGPD */}
        <section className="rounded-2xl bg-emerald-950/40 border border-emerald-500/30 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            <strong className="text-emerald-300">
              Modo Conformidade Legal (LGPD):
            </strong>{' '}
            Este link é exclusivo para monitoramento técnico, estabilidade das
            APIs e estatísticas agregadas de uso. Nomes de clientes, telefones,
            WhatsApp, anotações privadas e chaves Pix são{' '}
            <strong>bloqueados</strong> nesta visualização.
          </div>
        </section>

        {/* Saúde da Infraestrutura */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-[#231D1A] border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-[#C4A477]" />
                Banco Firestore
              </span>
              {health?.firestoreOk ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />{' '}
                  {health ? 'Instável' : 'Testando...'}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {health?.firestoreLatencyMs !== null &&
              health?.firestoreLatencyMs !== undefined
                ? `${health.firestoreLatencyMs} ms`
                : '—'}
            </div>
            <p className="text-[11px] text-[#E8D6CB]/60">
              Projeto: studio-de-beleza-8045a
            </p>
          </div>

          <div className="rounded-2xl bg-[#231D1A] border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-[#C4A477]" />
                API Google Agenda
              </span>
              {health?.gcalConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />{' '}
                  {health
                    ? health.gcalConfigured
                      ? 'Desconectada'
                      : 'Não configurada'
                    : 'Testando...'}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {health?.gcalLatencyMs !== null &&
              health?.gcalLatencyMs !== undefined
                ? `${health.gcalLatencyMs} ms`
                : '—'}
            </div>
            <p className="text-[11px] text-[#E8D6CB]/60">
              Endpoint: /api/google-calendar
            </p>
          </div>

          <div className="rounded-2xl bg-[#231D1A] border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#E8D6CB]/75 flex items-center gap-1.5">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )}
                PWA & Rede
              </span>
              <span
                className={`text-[11px] font-bold ${
                  isOnline ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="text-lg font-bold">
              {health?.swActive ? 'Service Worker Ativo' : 'Modo Web Direto'}
            </div>
            <p className="text-[11px] text-[#E8D6CB]/60">
              Última checagem: {health?.checkedAt || '—'}
            </p>
          </div>
        </section>

        {/* Métricas Agregadas */}
        <section className="rounded-2xl bg-[#231D1A] border border-white/10 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C4A477]" />
              <span>Telemetria Operacional Agregada (Sem Dados Pessoais)</span>
            </h2>
            <span className="text-xs text-[#C4A477] font-medium">
              Modelo de agenda: {metrics.scheduleMode}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#181412] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#E8D6CB]/65">
                Atendimentos Hoje
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {metrics.todayCount}
              </div>
            </div>
            <div className="rounded-xl bg-[#181412] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#E8D6CB]/65">
                Próximos 7 Dias
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {metrics.next7Count}
              </div>
            </div>
            <div className="rounded-xl bg-[#181412] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#E8D6CB]/65">
                Ativos na Agenda
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {metrics.totalActiveAppointments}
              </div>
            </div>
            <div className="rounded-xl bg-[#181412] p-3.5 border border-white/5">
              <div className="text-[11px] text-[#E8D6CB]/65">
                Serviços Ativos
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {services.length}
              </div>
            </div>
          </div>

          {/* Volume próximos 7 dias (apenas quantidades) */}
          <div className="pt-2 space-y-2">
            <div className="text-xs font-semibold text-[#E8D6CB]/80">
              Volume de ocupação nos próximos 7 dias (somente contagens)
            </div>
            <div className="grid grid-cols-7 gap-2">
              {metrics.byDay.map((d) => (
                <div
                  key={d.date}
                  className="rounded-xl bg-[#181412] border border-white/5 p-2.5 text-center"
                >
                  <div className="text-[11px] text-[#E8D6CB]/70 tabular-nums">
                    {d.label}
                  </div>
                  <div className="text-lg font-bold tabular-nums text-[#C4A477] mt-0.5">
                    {d.appointments}
                  </div>
                  <div className="text-[10px] text-[#E8D6CB]/50">
                    {d.blocks > 0 ? `${d.blocks} bloq.` : 'livre/ok'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {statusCounts && (
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                Pendentes: <strong>{statusCounts.pending || 0}</strong>
              </div>
              <div>
                Confirmados: <strong>{statusCounts.confirmed || 0}</strong>
              </div>
              <div>
                Concluídos: <strong>{statusCounts.completed || 0}</strong>
              </div>
              <div>
                Cancelados: <strong>{statusCounts.cancelled || 0}</strong>
              </div>
            </div>
          )}
        </section>

        {/* Logs Técnicos da Sessão */}
        <section className="rounded-2xl bg-[#231D1A] border border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-bold">Log Técnico de Diagnóstico</h2>
          {logs.length === 0 ? (
            <p className="text-xs text-[#E8D6CB]/60">
              Nenhum evento registrado ainda.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="text-xs font-mono bg-[#181412] rounded-xl px-3 py-2 border border-white/5 flex items-start gap-2.5"
                >
                  <span className="text-[#E8D6CB]/50 shrink-0">
                    {entry.time}
                  </span>
                  <span
                    className={
                      entry.level === 'ok'
                        ? 'text-emerald-400'
                        : entry.level === 'warn'
                          ? 'text-amber-400'
                          : 'text-[#C4A477]'
                    }
                  >
                    [{entry.level.toUpperCase()}]
                  </span>
                  <span className="text-[#FAF6F1]/90">{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
