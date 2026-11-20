import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  DollarSign,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageCircle,
  Scissors,
  Settings,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AdminAgendaTab } from './AdminAgendaTab';
import { AdminClientsTab } from './AdminClientsTab';
import { AdminCatalogTab } from './AdminCatalogTab';
import { AdminReportsTab, AdminSettingsTab } from './AdminReportsSettingsTabs';
import { useToast } from '../Toast';
import {
  seedInitialStudioDataIfEmpty,
  subscribeAllAppointmentsAdmin,
  subscribeAllCategoriesAdmin,
  subscribeAllServicesAdmin,
  subscribeClientTechNotesAdmin,
  subscribePersonalBlocksAdmin,
} from '../../lib/db';
import {
  resendVerificationEmail,
  resetAdminPassword,
  signInWithEmail,
  signOutUser,
} from '../../lib/firebase';
import { clearAdminGateSession } from '../../lib/adminRoute';
import {
  buildReturnAlertWhatsAppUrl,
  daysBetween,
  formatBRL,
  formatDateBR,
  sanitizePhone,
  statusLabelPT,
  todayISO,
} from '../../lib/utils';
import type {
  Appointment,
  Category,
  ClientProfileSummary,
  ClientTechNote,
  PersonalBlock,
  SalonSettings,
  Service,
} from '../../types/salon';

interface AdminPanelProps {
  user: User | null;
  isAdmin: boolean;
  authReady: boolean;
  settings: SalonSettings;
  onExitAdmin: () => void;
}

type AdminTab = 'dashboard' | 'agenda' | 'clients' | 'catalog' | 'reports' | 'settings';

const NAV_ITEMS: Array<{
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'catalog', label: 'Serviços', icon: Scissors },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  isAdmin,
  authReady,
  settings,
  onExitAdmin,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [blocks, setBlocks] = useState<PersonalBlock[]>([]);
  const [techNotes, setTechNotes] = useState<ClientTechNote[]>([]);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [walkInSignal, setWalkInSignal] = useState(0);
  const [pendingDetailId, setPendingDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;

    void seedInitialStudioDataIfEmpty();

    const unsubs = [
      subscribeAllAppointmentsAdmin(setAppointments),
      subscribeAllCategoriesAdmin(setCategories),
      subscribeAllServicesAdmin(setServices),
      subscribePersonalBlocksAdmin(setBlocks),
      subscribeClientTechNotesAdmin(setTechNotes),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, user, isAdmin]);

  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  // Build real aggregated Client Profiles + 21+ day return alerts
  const clientProfiles = useMemo<ClientProfileSummary[]>(() => {
    const map = new Map<string, ClientProfileSummary>();

    const noteByPhone = new Map<string, ClientTechNote>();
    techNotes.forEach((n) => {
      const key = sanitizePhone(n.clientPhone) || n.id;
      noteByPhone.set(key, n);
    });

    appointments.forEach((apt) => {
      if (apt.status === 'cancelled') return;
      const phoneDigits = sanitizePhone(apt.clientPhone);
      const key = phoneDigits || apt.clientEmail || apt.clientName.toLowerCase();
      const existing = map.get(key);

      if (!existing) {
        const diff = apt.date <= today ? daysBetween(apt.date, today) : null;
        map.set(key, {
          key,
          clientName: apt.clientName,
          clientPhone: apt.clientPhone,
          clientEmail: apt.clientEmail,
          totalVisits: 1,
          totalSpent: apt.totalPrice,
          lastVisitDate: apt.date <= today ? apt.date : null,
          daysSinceLastVisit: diff,
          needsReturnAlert: diff !== null && diff >= settings.returnAlertDays,
          lastServices: apt.serviceNames,
          techNote: noteByPhone.get(phoneDigits),
        });
      } else {
        existing.totalVisits += 1;
        existing.totalSpent += apt.totalPrice;
        if (apt.date <= today && (!existing.lastVisitDate || apt.date > existing.lastVisitDate)) {
          existing.lastVisitDate = apt.date;
          existing.daysSinceLastVisit = daysBetween(apt.date, today);
          existing.needsReturnAlert = existing.daysSinceLastVisit >= settings.returnAlertDays;
          existing.lastServices = apt.serviceNames;
        }
      }
    });

    // Include tech notes for clients who don't have online appointments yet
    techNotes.forEach((note) => {
      const key = sanitizePhone(note.clientPhone) || note.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          clientName: note.clientName,
          clientPhone: note.clientPhone,
          clientEmail: '',
          totalVisits: 0,
          totalSpent: 0,
          lastVisitDate: null,
          daysSinceLastVisit: null,
          needsReturnAlert: false,
          lastServices: [],
          techNote: note,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.needsReturnAlert !== b.needsReturnAlert) return a.needsReturnAlert ? -1 : 1;
      return b.totalVisits - a.totalVisits;
    });
  }, [appointments, techNotes, today, settings.returnAlertDays]);

  const activeAppointmentsCount = useMemo(
    () =>
      appointments.filter(
        (a) => (a.status === 'pending' || a.status === 'confirmed') && a.date >= today,
      ).length,
    [appointments, today],
  );

  const monthValidAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.date.startsWith(currentMonth) &&
          (a.status === 'confirmed' || a.status === 'completed'),
      ),
    [appointments, currentMonth],
  );

  const monthRevenue = useMemo(
    () => monthValidAppointments.reduce((sum, a) => sum + a.totalPrice, 0),
    [monthValidAppointments],
  );

  const avgTicket = useMemo(() => {
    const validAll = appointments.filter(
      (a) => a.status === 'confirmed' || a.status === 'completed',
    );
    const base = monthValidAppointments.length > 0 ? monthValidAppointments : validAll;
    if (base.length === 0) return 0;
    const sum = base.reduce((acc, a) => acc + a.totalPrice, 0);
    return sum / base.length;
  }, [appointments, monthValidAppointments]);

  const monthlyGoal = Math.max(0, Number(settings.monthlyGoal) || 0);
  const goalPercent = monthlyGoal > 0 ? Math.round((monthRevenue / monthlyGoal) * 100) : 0;
  const goalBarWidth = Math.min(100, Math.max(0, goalPercent));
  const goalRemaining = Math.max(0, monthlyGoal - monthRevenue);

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.date >= today && a.status !== 'cancelled' && a.status !== 'completed')
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [appointments, today],
  );

  const returnAlerts = useMemo(
    () => clientProfiles.filter((c) => c.needsReturnAlert),
    [clientProfiles],
  );

  const handleOpenNewWalkIn = () => {
    setActiveTab('agenda');
    setWalkInSignal((n) => n + 1);
  };

  const handleOpenAppointmentDetail = (aptId: string) => {
    setPendingDetailId(aptId);
    setActiveTab('agenda');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      showToast('Informe seu e-mail e sua senha.', 'error');
      return;
    }
    setLoginBusy(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        showToast('E-mail ou senha incorretos.', 'error');
      } else if (code === 'auth/too-many-requests') {
        showToast('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 'error');
      } else {
        showToast('Não foi possível entrar. Verifique e-mail e senha.', 'error');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!loginEmail.trim()) {
      showToast('Digite seu e-mail acima para receber o link de redefinição.', 'error');
      return;
    }
    try {
      await resetAdminPassword(loginEmail);
      showToast('Link de redefinição enviado para o seu e-mail.', 'success');
    } catch {
      showToast('Não foi possível enviar o e-mail de recuperação.', 'error');
    }
  };

  const handleSignOutAdmin = async () => {
    clearAdminGateSession();
    await signOutUser();
  };

  // Secure Login Gate (Firebase Auth Email/Password — criptografia scrypt no servidor)
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF4F5] flex items-center justify-center p-6">
        <div className="text-sm text-[#6E4F59]">Verificando credenciais...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#350B19] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[#FAF4F5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#350B19] text-[#D83F79] flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#350B19]">
              Painel Administrativo
            </h1>
            <p className="text-xs sm:text-sm text-[#6E4F59] leading-relaxed">
              {user
                ? !user.emailVerified
                  ? `Sua conta (${user.email}) ainda precisa confirmar o e-mail para liberar acesso.`
                  : `A conta ${user.email} não possui permissão de administradora.`
                : 'Acesso criptografado com e-mail e senha.'}
            </p>
          </div>

          {!user ? (
            <form onSubmit={handleLogin} className="space-y-3.5" autoComplete="on">
              <div>
                <label className="block text-xs font-semibold text-[#350B19] mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full min-h-[46px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm text-[#2A0E17] focus:border-[#D83F79] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#350B19] mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[46px] rounded-xl border border-[#EBDCE0] bg-white pl-3.5 pr-11 text-sm text-[#2A0E17] focus:border-[#D83F79] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#6E4F59] hover:text-[#350B19]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full min-h-[48px] rounded-xl bg-[#350B19] text-white text-sm font-semibold hover:bg-[#4F172A] transition-colors disabled:opacity-60"
              >
                {loginBusy ? 'Entrando...' : 'Entrar no Painel'}
              </button>

              <button
                type="button"
                onClick={handleResetPassword}
                className="w-full py-1.5 text-xs font-medium text-[#6E4F59] hover:text-[#D83F79] transition-colors"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <div className="space-y-2.5">
              {!user.emailVerified && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await resendVerificationEmail(user);
                      showToast('E-mail de confirmação enviado! Verifique sua caixa de entrada.', 'success');
                    } catch {
                      showToast('Aguarde um instante antes de reenviar.', 'error');
                    }
                  }}
                  className="w-full min-h-[48px] rounded-xl bg-[#350B19] text-white text-sm font-semibold hover:bg-[#4F172A] transition-colors"
                >
                  Enviar e-mail de confirmação
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSignOutAdmin()}
                className="w-full min-h-[48px] rounded-xl bg-[#D83F79] text-white text-sm font-semibold hover:bg-[#BD2D65] transition-colors"
              >
                Sair desta conta
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#EBDCE0] bg-white text-sm font-medium text-[#350B19] hover:border-[#D83F79] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir para o Site da Cliente</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF4F5] text-[#2A0E17] flex">
      {/* Fixed iPadOS Luxury Sidebar (>= 768px, v36) */}
      <aside className="hidden md:flex md:flex-col md:w-64 lg:w-68 bg-[#350B19] text-[#FAF4F5] fixed inset-y-0 left-0 z-40 no-print">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="font-editorial text-2xl font-semibold leading-tight">
            {settings.studioName}
          </div>
          <div className="mt-1 text-xs text-[#F7E2EA]/65 truncate">{user.email}</div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#D83F79] text-white'
                    : 'text-[#FAF4F5]/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1.5">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full min-h-[42px] flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[#FAF4F5]/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Portal da Cliente</span>
          </button>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="w-full min-h-[42px] flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[#FAF4F5]/65 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 lg:pl-68 min-w-0 pb-24 md:pb-12">
        {/* Mobile Admin Header */}
        <header className="md:hidden px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-[#EBDCE0] bg-white no-print">
          <div className="min-w-0">
            <div className="font-editorial text-xl font-semibold text-[#350B19] truncate">
              Gestão · {settings.studioName}
            </div>
          </div>
          <button
            type="button"
            onClick={onExitAdmin}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#EBDCE0] px-3 py-1.5 text-xs font-medium text-[#350B19] shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Portal</span>
          </button>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 sm:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#350B19]">
                    Visão Geral do Estúdio
                  </h1>
                  <p className="mt-1 text-sm text-[#6E4F59]">
                    Métricas 100% reais sincronizadas com o Cloud Firestore — {formatDateBR(today)}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenNewWalkIn}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#350B19] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#4F172A] transition-colors shrink-0"
                >
                  <CalendarPlus className="w-4 h-4 text-[#D83F79]" />
                  <span>+ Novo Horário</span>
                </button>
              </div>

              {/* 4 Exact PRD v36 KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F7E2EA] text-[#D83F79] flex items-center justify-center">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6E4F59]">Agendamentos Ativos</div>
                    <div className="mt-0.5 text-xl sm:text-2xl font-semibold text-[#350B19] tabular-nums">
                      {activeAppointmentsCount}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F7E2EA] text-[#D83F79] flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6E4F59]">Clientes Únicas</div>
                    <div className="mt-0.5 text-xl sm:text-2xl font-semibold text-[#350B19] tabular-nums">
                      {clientProfiles.length}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F7E2EA] text-[#D83F79] flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6E4F59]">Faturamento do Mês</div>
                    <div className="mt-0.5 text-xl sm:text-2xl font-semibold text-[#350B19] tabular-nums">
                      {formatBRL(monthRevenue)}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#350B19] text-[#D83F79] flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6E4F59]">Ticket Médio</div>
                    <div className="mt-0.5 text-xl sm:text-2xl font-semibold text-[#350B19] tabular-nums">
                      {formatBRL(avgTicket)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de Meta Mensal (PRD v36) */}
              <section className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#350B19] text-[#D83F79] flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-editorial text-xl font-semibold text-[#350B19]">
                        Meta Mensal de Faturamento
                      </h2>
                      <p className="text-xs text-[#6E4F59] tabular-nums">
                        {monthlyGoal > 0
                          ? goalRemaining > 0
                            ? `Faltam ${formatBRL(goalRemaining)} para atingir a meta de ${formatBRL(monthlyGoal)}`
                            : `Meta de ${formatBRL(monthlyGoal)} atingida neste mês!`
                          : 'Defina sua meta mensal em Ajustes.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-[#D83F79] tabular-nums">
                      {goalPercent}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="text-xs font-semibold text-[#350B19] underline hover:text-[#D83F79]"
                    >
                      Editar meta
                    </button>
                  </div>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={goalPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso da meta mensal"
                  className="w-full h-3 rounded-full bg-[#FAF4F5] border border-[#EBDCE0] overflow-hidden"
                >
                  <svg
                    className="w-full h-full block"
                    viewBox="0 0 100 12"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="goalBarGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#350B19" />
                        <stop offset="100%" stopColor="#D83F79" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width={goalBarWidth}
                      height="12"
                      rx="6"
                      fill="url(#goalBarGrad)"
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between text-xs text-[#6E4F59] tabular-nums">
                  <span>Realizado: {formatBRL(monthRevenue)}</span>
                  <span>Meta: {formatBRL(monthlyGoal)}</span>
                </div>
              </section>

              {/* Upcoming Appointments + Return Alerts Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-editorial text-2xl font-semibold text-[#350B19]">
                      Próximos Atendimentos
                    </h2>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleOpenNewWalkIn}
                        className="text-xs font-semibold text-[#350B19] hover:text-[#D83F79]"
                      >
                        + Novo Horário
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('agenda')}
                        className="text-xs font-semibold text-[#D83F79] hover:underline"
                      >
                        Ver agenda
                      </button>
                    </div>
                  </div>

                  {upcomingAppointments.length === 0 ? (
                    <p className="text-sm text-[#6E4F59] py-6 text-center">
                      Nenhum horário futuro agendado até o momento.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EBDCE0]">
                      {upcomingAppointments.slice(0, 6).map((apt) => (
                        <button
                          key={apt.id}
                          type="button"
                          onClick={() => handleOpenAppointmentDetail(apt.id)}
                          className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-[#FAF4F5]/60 rounded-xl px-2 -mx-2 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#350B19] truncate">
                              <span className="font-mono text-xs text-[#D83F79] mr-2 tabular-nums">
                                {apt.date === today ? 'Hoje' : formatDateBR(apt.date)} {apt.startTime}
                              </span>
                              {apt.clientName}
                            </div>
                            <div className="text-xs text-[#6E4F59] truncate">
                              {apt.serviceNames.join(' + ')} · {statusLabelPT(apt.status)}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-[#350B19] tabular-nums shrink-0">
                            {formatBRL(apt.totalPrice)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-editorial text-2xl font-semibold text-[#350B19]">
                      Alertas de Retorno ({settings.returnAlertDays}+ dias)
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('clients')}
                      className="text-xs font-semibold text-[#D83F79] hover:underline"
                    >
                      Ver clientes
                    </button>
                  </div>

                  {returnAlerts.length === 0 ? (
                    <p className="text-sm text-[#6E4F59] py-6 text-center">
                      Nenhuma cliente passou de {settings.returnAlertDays} dias sem manutenção.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EBDCE0]">
                      {returnAlerts.slice(0, 5).map((client) => (
                        <div
                          key={client.key}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#350B19] truncate">
                              {client.clientName}
                            </div>
                            <div className="text-xs text-[#D83F79] tabular-nums">
                              {client.daysSinceLastVisit} dias desde o último atendimento
                            </div>
                          </div>
                          <a
                            href={buildReturnAlertWhatsAppUrl(
                              client.clientName,
                              client.clientPhone,
                              client.daysSinceLastVisit ?? settings.returnAlertDays,
                              settings,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#F7E2EA] px-3 py-1.5 text-xs font-semibold text-[#350B19] hover:bg-[#D83F79] hover:text-white transition-colors shrink-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chamar</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {activeTab === 'agenda' && (
            <AdminAgendaTab
              appointments={appointments}
              blocks={blocks}
              services={services}
              settings={settings}
              openWalkInSignal={walkInSignal}
              initialDetailAppointmentId={pendingDetailId}
              onClearInitialDetail={() => setPendingDetailId(null)}
            />
          )}

          {activeTab === 'clients' && (
            <AdminClientsTab clients={clientProfiles} settings={settings} />
          )}

          {activeTab === 'catalog' && (
            <AdminCatalogTab categories={categories} services={services} />
          )}

          {activeTab === 'reports' && <AdminReportsTab appointments={appointments} />}

          {activeTab === 'settings' && <AdminSettingsTab settings={settings} />}
        </main>
      </div>

      {/* Mobile Floating Glassmorphic Admin Tab Bar */}
      <nav
        aria-label="Navegação administrativa"
        className="md:hidden fixed bottom-3 left-3 right-3 z-50 mb-safe no-print"
      >
        <div className="glass-nav rounded-2xl border border-white/15 shadow-xl px-1.5 py-1.5 grid grid-cols-6 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                  active ? 'text-[#D83F79] bg-white/10' : 'text-[#FAF4F5]/75'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium truncate max-w-full px-0.5">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
