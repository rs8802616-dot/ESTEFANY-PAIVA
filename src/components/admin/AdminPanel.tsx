import React, { useEffect, useMemo, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Camera,
  DollarSign,
  Eye,
  EyeOff,
  Home,
  Layers,
  Lock,
  LogOut,
  MessageCircle,
  Scissors,
  Target,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AdminAgendaTab } from './AdminAgendaTab';
import { AdminGoogleCalendar } from './AdminGoogleCalendar';
import { AdminClientsTab } from './AdminClientsTab';
import { AdminCatalogTab } from './AdminCatalogTab';
import { AdminFinanceSuite, type FinanceSubScreen } from './AdminFinanceSuite';
import { AdminProfileSuite, type ProfileScreenId } from './AdminProfileSuite';
import { useToast } from '../Toast';
import {
  seedInitialStudioDataIfEmpty,
  subscribeAllAppointmentsAdmin,
  subscribeAllCategoriesAdmin,
  subscribeAllServicesAdmin,
  subscribeClientTechNotesAdmin,
  subscribePersonalBlocksAdmin,
  syncPendingLocalChangesToCloud,
} from '../../lib/db';
import {
  ensureEmailUserSignedIn,
  resendVerificationEmail,
  resetAdminPassword,
  signInWithEmail,
  signOutUser,
} from '../../lib/firebase';
import {
  clearAdminGateSession,
  getVaultAdminEmail,
  verifyAdminVaultCredentials,
} from '../../lib/adminRoute';
import {
  buildReturnAlertWhatsAppUrl,
  buildUpcomingMaintenanceWhatsAppUrl,
  daysBetween,
  formatBRL,
  formatDateBR,
  sanitizePhone,
  statusLabelPT,
  todayISO,
} from '../../lib/utils';
import { MANDATORY_SCREENS_33 } from '../../theme/luxuryNudeTheme';
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
  user: FirebaseUser | null;
  isAdmin: boolean;
  authReady: boolean;
  settings: SalonSettings;
  onExitAdmin: () => void;
}

/**
 * Menu Inferior Oficial de 5 Itens do Prompt:
 * 1. Início (Telas 2 e 3)
 * 2. Agenda (Telas 4, 5 e 6)
 * 3. Clientes (Telas 12 a 16)
 * 4. Financeiro (Telas 17 a 24)
 * 5. Perfil (Telas 25 a 33)
 */
type AdminTab = 'inicio' | 'agenda' | 'clientes' | 'financeiro' | 'perfil';

const NAV_ITEMS: Array<{
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'perfil', label: 'Perfil', icon: User },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  isAdmin,
  authReady,
  settings,
  onExitAdmin,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSplashScreen2, setShowSplashScreen2] = useState(false);
  const [show33Explorer, setShow33Explorer] = useState(false);
  const [clientsSubView, setClientsSubView] = useState<'crm' | 'catalog'>('crm');
  const [financeSubScreen, setFinanceSubScreen] = useState<FinanceSubScreen>('resumo_financeiro');
  const [profileSubScreen, setProfileSubScreen] = useState<ProfileScreenId>(28);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [blocks, setBlocks] = useState<PersonalBlock[]>([]);
  const [techNotes, setTechNotes] = useState<ClientTechNote[]>([]);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [vaultEmail, setVaultEmail] = useState<string | null>(() => getVaultAdminEmail());
  const [walkInSignal, setWalkInSignal] = useState(0);
  const [newClientSignal, setNewClientSignal] = useState(0);
  const [firstProfileSignal, setFirstProfileSignal] = useState(0);
  const [newServiceSignal, setNewServiceSignal] = useState(0);
  const [pendingDetailId, setPendingDetailId] = useState<string | null>(null);

  const effectiveAdmin = Boolean((user && isAdmin) || vaultEmail);
  const effectiveEmail = user?.email || vaultEmail || '';

  useEffect(() => {
    if (!authReady || !effectiveAdmin) return;

    void seedInitialStudioDataIfEmpty();
    void syncPendingLocalChangesToCloud();

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
  }, [authReady, effectiveAdmin]);

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

    const hasFutureAppointmentKeys = new Set<string>();
    appointments.forEach((apt) => {
      if (apt.status === 'cancelled') return;
      const phoneDigits = sanitizePhone(apt.clientPhone);
      const key = phoneDigits || apt.clientEmail || apt.clientName.toLowerCase();
      if (apt.date > today && (apt.status === 'pending' || apt.status === 'confirmed')) {
        hasFutureAppointmentKeys.add(key);
      }
    });

    const getCycleDaysForApt = (apt: Appointment) => {
      const ids = Array.isArray(apt.serviceIds) ? apt.serviceIds : [];
      const matched = services.find((s) => ids.includes(s.id));
      if (matched?.maintenanceDays !== undefined && matched.maintenanceDays > 0) {
        return matched.maintenanceDays;
      }
      return settings.returnAlertDays || 21;
    };

    appointments.forEach((apt) => {
      if (apt.status === 'cancelled') return;
      const phoneDigits = sanitizePhone(apt.clientPhone);
      const key = phoneDigits || apt.clientEmail || apt.clientName.toLowerCase();
      const existing = map.get(key);
      const hasUpcoming = hasFutureAppointmentKeys.has(key);
      const cycleDays = getCycleDaysForApt(apt);

      if (!existing) {
        const diff = apt.date <= today ? daysBetween(apt.date, today) : null;
        const until = diff !== null ? cycleDays - diff : null;
        map.set(key, {
          key,
          clientName: apt.clientName,
          clientPhone: apt.clientPhone,
          clientEmail: apt.clientEmail,
          totalVisits: 1,
          totalSpent: apt.totalPrice,
          lastVisitDate: apt.date <= today ? apt.date : null,
          daysSinceLastVisit: diff,
          needsReturnAlert: !hasUpcoming && diff !== null && diff >= cycleDays,
          daysUntilMaintenance: until,
          needsUpcomingMaintenance: !hasUpcoming && until !== null && until >= 0 && until <= 5,
          maintenanceCycleDays: cycleDays,
          lastServices: Array.isArray(apt.serviceNames) ? apt.serviceNames : [],
          techNote: noteByPhone.get(phoneDigits),
        });
      } else {
        existing.totalVisits += 1;
        existing.totalSpent += apt.totalPrice;
        if (apt.date <= today && (!existing.lastVisitDate || apt.date > existing.lastVisitDate)) {
          const diff = daysBetween(apt.date, today);
          const until = cycleDays - diff;
          existing.lastVisitDate = apt.date;
          existing.daysSinceLastVisit = diff;
          existing.needsReturnAlert = !hasUpcoming && diff >= cycleDays;
          existing.daysUntilMaintenance = until;
          existing.needsUpcomingMaintenance = !hasUpcoming && until >= 0 && until <= 5;
          existing.maintenanceCycleDays = cycleDays;
          existing.lastServices = Array.isArray(apt.serviceNames) ? apt.serviceNames : [];
        }
      }
    });

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
    () => clientProfiles.filter((c) => c.needsReturnAlert || c.needsUpcomingMaintenance),
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

  /**
   * Navegador Direto para qualquer uma das 33 Telas Obrigatórias
   */
  const handleJumpToScreen = (screenId: number) => {
    setSidebarOpen(false);
    setShow33Explorer(false);
    setShowSplashScreen2(false);

    if (screenId === 1) {
      showToast('Tela 1 (Login): exibida quando a sessão está desconectada.', 'info');
      return;
    }
    if (screenId === 2) {
      setActiveTab('inicio');
      setShowSplashScreen2(true);
      return;
    }
    if (screenId === 3) {
      setActiveTab('inicio');
      return;
    }
    if (screenId === 4) {
      setActiveTab('agenda');
      return;
    }
    if (screenId === 5) {
      handleOpenNewWalkIn();
      return;
    }
    if (screenId === 6) {
      setActiveTab('agenda');
      if (appointments[0]) {
        setPendingDetailId(appointments[0].id);
      } else {
        showToast('Crie ou selecione um agendamento na Agenda para abrir a Tela 6.', 'info');
      }
      return;
    }
    if (screenId >= 7 && screenId <= 11) {
      onExitAdmin();
      return;
    }
    if (screenId === 12) {
      setActiveTab('clientes');
      setClientsSubView('crm');
      return;
    }
    if (screenId === 13) {
      setActiveTab('clientes');
      setClientsSubView('crm');
      setNewClientSignal((n) => n + 1);
      return;
    }
    if (screenId === 14) {
      setActiveTab('clientes');
      setClientsSubView('crm');
      setFirstProfileSignal((n) => n + 1);
      return;
    }
    if (screenId === 15) {
      setActiveTab('clientes');
      setClientsSubView('catalog');
      return;
    }
    if (screenId === 16) {
      setActiveTab('clientes');
      setClientsSubView('catalog');
      setNewServiceSignal((n) => n + 1);
      return;
    }
    if (screenId >= 17 && screenId <= 24) {
      const map: Record<number, FinanceSubScreen> = {
        17: 'resumo_financeiro',
        18: 'receitas',
        19: 'despesas',
        20: 'fluxo_caixa',
        21: 'contas_pagar_receber',
        22: 'fechamento_mensal',
        23: 'relatorios_gerais',
        24: 'relatorios_desempenho',
      };
      setActiveTab('financeiro');
      setFinanceSubScreen(map[screenId] || 'resumo_financeiro');
      return;
    }
    if (screenId >= 25 && screenId <= 33) {
      setActiveTab('perfil');
      setProfileSubScreen(screenId as ProfileScreenId);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      showToast('Informe seu e-mail e sua senha.', 'error');
      return;
    }
    setLoginBusy(true);
    try {
      // 1. Verifica via PBKDF2-HMAC-SHA256 (250.000 iterações Web Crypto API)
      const vaultOk = await verifyAdminVaultCredentials(loginEmail, loginPassword);
      if (vaultOk) {
        setVaultEmail(getVaultAdminEmail());
        setLoginPassword('');
        // Autentica no Firebase Auth em background (ou cria o usuário no novo projeto) e sincroniza as fotos pendentes
        void ensureEmailUserSignedIn(loginEmail, loginPassword).then((u) => {
          if (u) void syncPendingLocalChangesToCloud();
        });
        showToast('Acesso ao painel liberado!', 'success');
        return;
      }

      // 2. Fallback para contas adicionais cadastradas no Firebase Auth
      await signInWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        showToast('E-mail ou senha incorretos.', 'error');
      } else if (code === 'auth/too-many-requests') {
        showToast('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 'error');
      } else {
        showToast('E-mail ou senha incorretos.', 'error');
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
    setVaultEmail(null);
    await signOutUser().catch(() => {});
    window.location.replace('/');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-6">
        <div className="text-sm text-[#95847C]">Conferindo seu acesso...</div>
      </div>
    );
  }

  // TELA 1: LOGIN (Luxury Nude)
  if (!effectiveAdmin) {
    return (
      <div className="min-h-screen bg-[#594943] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[#FAF6F1] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border border-[#E8D6CB]">
          <div className="space-y-2 text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-[#F2EAE4] text-[#C4A477] text-[10px] font-bold uppercase tracking-widest border border-[#E8D6CB]">
              Tela 1 • Login Exclusivo
            </span>
            <div className="w-12 h-12 rounded-2xl bg-[#594943] text-[#C4A477] flex items-center justify-center mx-auto shadow-md">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#594943]">
              Painel Administrativo
            </h1>
            <p className="text-xs sm:text-sm text-[#95847C] leading-relaxed">
              {user
                ? !user.emailVerified
                  ? `Sua conta (${user.email}) ainda precisa confirmar o e-mail para liberar acesso.`
                  : `A conta ${user.email} não possui permissão de administradora.`
                : 'Entre com seu e-mail e senha para abrir a agenda do estúdio.'}
            </p>
          </div>

          {!user ? (
            <form onSubmit={handleLogin} className="space-y-3.5" autoComplete="on">
              <div>
                <label className="block text-xs font-semibold text-[#594943] mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full min-h-[46px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm text-[#594943] focus:border-[#C4A477] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#594943] mb-1.5">
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
                    className="w-full min-h-[46px] rounded-xl border border-[#E8D6CB] bg-white pl-3.5 pr-11 text-sm text-[#594943] focus:border-[#C4A477] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#95847C] hover:text-[#594943]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full min-h-[48px] rounded-xl bg-[#594943] text-white text-sm font-semibold hover:bg-[#433631] transition-colors disabled:opacity-60"
              >
                {loginBusy ? 'Entrando...' : 'Entrar no Painel'}
              </button>

              <button
                type="button"
                onClick={handleResetPassword}
                className="w-full py-1.5 text-xs font-medium text-[#95847C] hover:text-[#C4A477] transition-colors"
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
                  className="w-full min-h-[48px] rounded-xl bg-[#594943] text-white text-sm font-semibold hover:bg-[#433631] transition-colors"
                >
                  Enviar e-mail de confirmação
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSignOutAdmin()}
                className="w-full min-h-[48px] rounded-xl bg-[#BE9293] text-white text-sm font-semibold hover:bg-[#A87C7D] transition-colors"
              >
                Sair desta conta
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8D6CB] bg-white text-sm font-medium text-[#594943] hover:border-[#C4A477] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir para a Página Pública (Tela 7)</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#FAF6F1] text-[#594943] flex flex-col">
      {/* Backdrop escuro suave quando o Menu 2 Traços (Aba Lateral) está aberto */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[#594943]/45 backdrop-blur-xs transition-opacity no-print"
          aria-hidden="true"
        />
      )}

      {/* Aba Lateral Recolhível (Drawer acionado pelo botão Menu 2 Traços) */}
      <aside
        aria-label="Menu lateral retrátil"
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#594943] text-[#FAF6F1] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A477] block mb-1">
              Luxury Nude Edition
            </span>
            <div className="font-editorial text-2xl font-semibold leading-tight truncate">
              {settings.studioName}
            </div>
            <div className="mt-1 text-xs text-[#E8D6CB]/75 truncate">{effectiveEmail}</div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Recolher menu lateral"
            className="p-2 rounded-xl bg-white/10 text-[#FAF6F1] hover:bg-white/20 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full min-h-[46px] flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#C4A477] text-[#594943] font-semibold shadow-sm'
                    : 'text-[#FAF6F1]/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-white/10 space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('clientes');
                setClientsSubView('catalog');
                setSidebarOpen(false);
              }}
              className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'clientes' && clientsSubView === 'catalog'
                  ? 'bg-[#C4A477] text-[#594943] font-semibold'
                  : 'text-[#FAF6F1]/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Scissors className="w-4 h-4 shrink-0 text-[#C4A477]" />
              <span className="truncate">Procedimentos e Fotos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileSubScreen(31);
                setActiveTab('perfil');
                setSidebarOpen(false);
              }}
              className="w-full min-h-[44px] flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[#FAF6F1]/85 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 shrink-0 text-[#C4A477]" />
              <span className="truncate">Capa e Foto do Studio</span>
            </button>
          </div>
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1.5">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              onExitAdmin();
            }}
            className="w-full min-h-[42px] flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[#FAF6F1]/85 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#C4A477]" />
            <span>Ver Site da Cliente</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSignOutAdmin()}
            className="w-full min-h-[42px] flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[#FAF6F1]/65 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area — 100% Expansivo no Tablet Horizontal & Desktop */}
      <div className="flex-1 w-full min-w-0 pb-24 lg:pb-12">
        {/* Top Header Universal com Botão "Menu 2 Traços" */}
        <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-3 border-b border-[#E8D6CB] bg-white/95 backdrop-blur-md no-print">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botão Menu 2 Traços para Abrir/Recolher a Aba Lateral */}
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Abrir ou recolher menu lateral"
              className="min-h-[42px] inline-flex items-center gap-2.5 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] px-3.5 py-2 text-xs font-semibold text-[#594943] transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <svg
                className="w-5 h-5 text-[#594943]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
              >
                <line x1="3" y1="8.5" x2="21" y2="8.5" />
                <line x1="3" y1="15.5" x2="15" y2="15.5" />
              </svg>
              <span className="hidden sm:inline">Menu</span>
            </button>

            <div className="min-w-0">
              <div className="font-editorial text-lg sm:text-xl font-semibold text-[#594943] truncate">
                {settings.studioName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#594943] hover:bg-[#433631] px-3.5 py-1.5 text-xs font-semibold text-[#FAF6F1] transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#C4A477]" />
              <span className="hidden sm:inline">Ver Site da Cliente</span>
              <span className="sm:hidden">Site</span>
            </button>
          </div>
        </header>

        <main className="w-full max-w-[1600px] min-w-0 mx-auto px-3 sm:px-6 lg:px-10 py-5 sm:py-8 space-y-6 overflow-x-hidden">
          {/* Interactive 33-Screen Quick Jumper (Sem scroll interno cortando cards e sem duplicar na Tela 33) */}
          {show33Explorer && !(activeTab === 'perfil' && profileSubScreen === 33) && (
            <section className="bg-white rounded-3xl border border-[#C4A477] p-5 sm:p-6 shadow-lg space-y-4 no-print">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                    Protótipo Navegável de Alta Fidelidade
                  </span>
                  <h2 className="font-editorial text-xl font-semibold text-[#594943]">
                    Navegação Rápida — 33 Telas Obrigatórias
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShow33Explorer(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] text-xs font-semibold text-[#594943] cursor-pointer"
                >
                  Fechar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {MANDATORY_SCREENS_33.map((scr) => (
                  <button
                    key={scr.number}
                    type="button"
                    onClick={() => handleJumpToScreen(scr.number)}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] text-left transition-colors cursor-pointer"
                  >
                    <span className="w-6 h-6 rounded-lg bg-[#594943] text-[#FAF6F1] text-[11px] font-bold flex items-center justify-center shrink-0">
                      {scr.number}
                    </span>
                    <span className="text-xs font-semibold text-[#594943] truncate">
                      {scr.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* TAB 1: INÍCIO — SOMENTE CALENDÁRIO EM TELA TODA */}
          {activeTab === 'inicio' && (
            <AdminGoogleCalendar
              appointments={appointments}
              blocks={blocks}
              settings={settings}
              onSelectAppointment={handleOpenAppointmentDetail}
              onNewAppointmentForDate={() => handleOpenNewWalkIn()}
            />
          )}

          {/* TAB 2: AGENDA (TELAS 4, 5 E 6) */}
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

          {/* TAB 3: CLIENTES & CATÁLOGO DE SERVIÇOS (TELAS 12 A 16) */}
          {activeTab === 'clientes' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-[#E8D6CB]">
                <button
                  type="button"
                  onClick={() => setClientsSubView('crm')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    clientsSubView === 'crm'
                      ? 'bg-[#594943] text-white'
                      : 'bg-[#FAF6F1] text-[#95847C] hover:text-[#594943]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>Clientes e Ficha</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClientsSubView('catalog')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    clientsSubView === 'catalog'
                      ? 'bg-[#594943] text-white'
                      : 'bg-[#FAF6F1] text-[#95847C] hover:text-[#594943]'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>Procedimentos e Fotos (Catálogo)</span>
                </button>
              </div>

              {clientsSubView === 'crm' ? (
                <AdminClientsTab
                  clients={clientProfiles}
                  settings={settings}
                  openNewClientSignal={newClientSignal}
                  openFirstProfileSignal={firstProfileSignal}
                />
              ) : (
                <AdminCatalogTab
                  categories={categories}
                  services={services}
                  openNewServiceSignal={newServiceSignal}
                />
              )}
            </div>
          )}

          {/* TAB 4: FINANCEIRO (TELAS 17 A 24) */}
          {activeTab === 'financeiro' && (
            <AdminFinanceSuite
              appointments={appointments}
              settings={settings}
              initialSubScreen={financeSubScreen}
              onSelectSubScreen={setFinanceSubScreen}
            />
          )}

          {/* TAB 5: PERFIL, GALERIA, COMUNICAÇÃO & AJUSTES (TELAS 25 A 33) */}
          {activeTab === 'perfil' && (
            <AdminProfileSuite
              settings={settings}
              clients={clientProfiles}
              appointments={appointments}
              services={services}
              activeSubScreen={profileSubScreen}
              onSelectSubScreen={setProfileSubScreen}
              onJumpToAnyScreen={handleJumpToScreen}
              adminEmail={
                effectiveEmail === 'admin@estefanypaiva.com'
                  ? 'rs8802616@gmail.com'
                  : effectiveEmail || 'rs8802616@gmail.com'
              }
            />
          )}
        </main>
      </div>

      {/* Mobile & Tablet Docked Bottom Navigation — 5 Official Tabs */}
      <nav
        aria-label="Menu inferior principal"
        className="xl:hidden fixed bottom-0 inset-x-0 z-40 glass-nav border-t border-white/15 pb-[env(safe-area-inset-bottom)] no-print"
      >
        <div className="max-w-xl mx-auto px-2 py-1 grid grid-cols-5 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[42px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                  active ? 'text-[#C4A477] bg-white/10 font-semibold' : 'text-[#FAF6F1]/75'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] leading-none truncate max-w-full px-1">
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
