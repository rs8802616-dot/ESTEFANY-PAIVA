import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Calendar,
  CalendarClock,
  Check,
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react';
import { BookingSheet } from './BookingSheet';
import { ClientAppointmentsView } from './ClientAppointmentsSheet';
import { PWAInstallButton } from '../PWAInstallButton';
import { SafeImage } from '../SafeImage';
import { useToast } from '../Toast';
import {
  buildWhatsAppUrl,
  formatBRL,
  formatDateLongBR,
  formatDuration,
  hoursUntilAppointment,
} from '../../lib/utils';
import type {
  Appointment,
  AvailabilitySlot,
  Category,
  SalonSettings,
  Service,
} from '../../types/salon';

interface ClientPortalProps {
  settings: SalonSettings;
  categories: Category[];
  services: Service[];
  busySlots: AvailabilitySlot[];
  user: User | null;
  clientAppointments: Appointment[];
  onAppointmentCreated: (apt: Appointment) => void;
  onAppointmentUpdated: (apt: Appointment) => void;
}

type ClientTab = 'catalog' | 'appointments' | 'studio';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const ClientPortal: React.FC<ClientPortalProps> = ({
  settings,
  categories,
  services,
  busySlots,
  user,
  clientAppointments,
  onAppointmentCreated,
  onAppointmentUpdated,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ClientTab>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [comboIds, setComboIds] = useState<string[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);

  const comboServices = useMemo(
    () =>
      comboIds
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is Service => Boolean(s)),
    [comboIds, services],
  );

  const comboTotal = useMemo(
    () => comboServices.reduce((sum, s) => sum + s.price, 0),
    [comboServices],
  );
  const comboDuration = useMemo(
    () => comboServices.reduce((sum, s) => sum + s.durationMinutes, 0),
    [comboServices],
  );

  // Next active future appointment for the top "Faixa de Próximo Agendamento"
  const nextUpcomingAppointment = useMemo(() => {
    const activeFuture = clientAppointments
      .filter(
        (apt) =>
          (apt.status === 'pending' || apt.status === 'confirmed') &&
          hoursUntilAppointment(apt.date, apt.startTime) > 0,
      )
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    return activeFuture[0] || null;
  }, [clientAppointments]);

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return services.filter((svc) => {
      if (selectedCategory !== 'all' && svc.categoryId !== selectedCategory) return false;
      if (q && !`${svc.name} ${svc.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, selectedCategory, searchTerm]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const toggleComboService = (svc: Service) => {
    setComboIds((prev) => {
      if (prev.includes(svc.id)) {
        showToast(`${svc.name} removido do combo.`, 'info');
        return prev.filter((id) => id !== svc.id);
      }
      showToast(`${svc.name} adicionado ao combo.`);
      return [...prev, svc.id];
    });
  };

  const quickBookService = (svc: Service) => {
    setComboIds((prev) => (prev.includes(svc.id) ? prev : [...prev, svc.id]));
    setBookingOpen(true);
  };

  const workDaysLabel = useMemo(() => {
    const sorted = [...settings.workDays].sort((a, b) => a - b);
    return sorted.map((d) => DAY_LABELS[d]).join(', ');
  }, [settings.workDays]);

  return (
    <div className="min-h-screen bg-[#FAF6F1] text-[#594943] pb-24 md:pb-16">
      {/* Desktop & Tablet Top Bar Contract (3 zones separated by gap-8) */}
      <header className="hidden md:block sticky top-0 z-40 bg-[#FAF6F1]/90 backdrop-blur-md border-b border-[#E8D6CB]">
        <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className="font-editorial text-2xl font-semibold tracking-tight text-[#594943] whitespace-nowrap shrink-0"
          >
            {settings.studioName}
          </button>

          {/* Zone 2: 4 clean single-line text nav links */}
          <nav className="flex items-center gap-7 text-sm font-medium text-[#95847C]">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#594943] ${
                activeTab === 'catalog'
                  ? 'text-[#594943] underline underline-offset-8 decoration-[#C4A477] decoration-2'
                  : ''
              }`}
            >
              Procedimentos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('appointments')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#594943] ${
                activeTab === 'appointments'
                  ? 'text-[#594943] underline underline-offset-8 decoration-[#C4A477] decoration-2'
                  : ''
              }`}
            >
              Meus Horários
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#594943] ${
                activeTab === 'studio'
                  ? 'text-[#594943] underline underline-offset-8 decoration-[#C4A477] decoration-2'
                  : ''
              }`}
            >
              O Estúdio
            </button>
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#594943] px-4 py-2 text-xs font-semibold text-white hover:bg-[#433631] transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>
                {comboServices.length > 0
                  ? `Agendar Combo (${comboServices.length})`
                  : 'Agendar Agora'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact App Bar (< md) */}
      <header className="md:hidden sticky top-0 z-40 bg-[#FAF6F1]/95 backdrop-blur-md border-b border-[#E8D6CB] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-[#C4A477]/40 bg-[#594943] shrink-0">
            <SafeImage
              src={settings.avatarImage}
              alt={settings.studioName}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-editorial text-lg font-semibold text-[#594943] truncate">
            {settings.studioName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setBookingOpen(true)}
          className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-[#594943] px-3.5 py-1.5 text-xs font-semibold text-white shrink-0"
        >
          <span>{comboServices.length > 0 ? `Combo (${comboServices.length})` : 'Agendar'}</span>
        </button>
      </header>

      {/* Main Viewport */}
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 space-y-5 sm:space-y-7 pt-4 sm:pt-6">

        {/* Faixa de Próximo Agendamento (PRD v36) */}
        {nextUpcomingAppointment && activeTab === 'catalog' && (
          <section
            aria-label="Próximo agendamento"
            className="bg-white rounded-2xl border border-[#C4A477]/40 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#F2EAE4] text-[#C4A477] flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#C4A477] tabular-nums">
                  Próximo agendamento · {formatDateLongBR(nextUpcomingAppointment.date)} às{' '}
                  {nextUpcomingAppointment.startTime}
                </div>
                <div className="text-sm font-semibold text-[#594943] truncate">
                  {nextUpcomingAppointment.serviceNames.join(' + ')}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('appointments')}
              className="min-h-[40px] rounded-xl bg-[#594943] px-4 py-2 text-xs font-semibold text-white hover:bg-[#433631] transition-colors whitespace-nowrap shrink-0"
            >
              Ver / Remarcar
            </button>
          </section>
        )}

        {activeTab === 'catalog' && (
          <>
            {/* Clean Luxury Hero Banner */}
            <section className="relative overflow-hidden rounded-3xl bg-[#594943] min-h-[190px] sm:min-h-[260px] lg:min-h-[300px] flex items-end">
              <SafeImage
                src={settings.heroImageUrl}
                alt={settings.studioName}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#433631]/90 via-[#594943]/45 to-transparent" />

              <div className="relative z-10 w-full p-5 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <h1 className="font-editorial text-2xl sm:text-4xl font-semibold text-white leading-tight max-w-lg">
                  {settings.heroTitle}
                </h1>
                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-[#C4A477] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#BE9293] transition-colors whitespace-nowrap shrink-0 self-start sm:self-end"
                >
                  Agendar Horário
                </button>
              </div>
            </section>

            {/* Catalog Section */}
            <section id="catalogo" className="space-y-4 scroll-mt-20">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#594943]">
                  Procedimentos
                </h2>

                <div className="relative w-44 sm:w-64">
                  <Search className="w-4 h-4 text-[#95847C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar..."
                    aria-label="Buscar procedimento"
                    className="w-full min-h-[38px] rounded-xl border border-[#E8D6CB] bg-white pl-9 pr-3 text-xs sm:text-sm text-[#594943] placeholder:text-[#95847C]/70 focus:border-[#C4A477] focus:outline-none"
                  />
                </div>
              </div>

              {/* Interactive Category Filter Buttons (smooth horizontal swipe) */}
              <div
                role="tablist"
                aria-label="Filtrar por categoria"
                className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  className={`min-h-[40px] rounded-xl px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-[#594943] text-white'
                      : 'bg-white text-[#95847C] border border-[#E8D6CB] hover:text-[#594943]'
                  }`}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`min-h-[40px] rounded-xl px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-[#594943] text-white'
                        : 'bg-white text-[#95847C] border border-[#E8D6CB] hover:text-[#594943]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Active Combo Inline Banner */}
              {comboServices.length > 0 && (
                <div className="bg-[#594943] text-[#FAF6F1] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs text-[#F2EAE4]/80 tabular-nums">
                      Combo selecionado · {comboServices.length}{' '}
                      {comboServices.length === 1 ? 'serviço' : 'serviços'} ·{' '}
                      {formatDuration(comboDuration)}
                    </div>
                    <div className="text-sm font-medium truncate">
                      {comboServices.map((s) => s.name).join(' + ')}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span className="text-lg font-semibold tabular-nums">
                      {formatBRL(comboTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBookingOpen(true)}
                      className="min-h-[42px] rounded-xl bg-[#C4A477] px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#BE9293] transition-colors whitespace-nowrap"
                    >
                      Escolher horário
                    </button>
                  </div>
                </div>
              )}

              {/* Services List: Horizontal Compact Cards on Mobile & 2-3 Col Luxury Grid on Tablet/Desktop */}
              {filteredServices.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#E8D6CB] p-10 text-center">
                  <p className="text-sm text-[#95847C]">
                    Nenhum procedimento encontrado para esse filtro.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchTerm('');
                    }}
                    className="mt-4 min-h-[42px] rounded-xl border border-[#E8D6CB] px-4 py-2 text-xs font-medium text-[#594943]"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                  {filteredServices.map((svc) => {
                    const inCombo = comboIds.includes(svc.id);

                    return (
                      <article
                        key={svc.id}
                        className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-row sm:flex-col ${
                          inCombo
                            ? 'border-[#C4A477] ring-1 ring-[#C4A477]/25'
                            : 'border-[#E8D6CB] hover:border-[#594943]/25'
                        }`}
                      >
                        <div
                          onClick={() => quickBookService(svc)}
                          className="w-24 sm:w-full sm:aspect-[16/10] shrink-0 overflow-hidden bg-[#FAF6F1] cursor-pointer"
                        >
                          <SafeImage
                            src={svc.imageUrl}
                            alt={svc.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            {categoryMap.get(svc.categoryId) && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C4A477] block mb-0.5">
                                {categoryMap.get(svc.categoryId)}
                              </span>
                            )}
                            <h3 className="text-sm sm:text-base font-semibold text-[#594943] leading-snug line-clamp-2">
                              {svc.name}
                            </h3>
                            {svc.description && (
                              <p className="mt-0.5 text-xs text-[#95847C] line-clamp-2 leading-relaxed">
                                {svc.description}
                              </p>
                            )}
                            <span className="mt-1 inline-block text-[11px] sm:text-xs font-medium text-[#95847C] tabular-nums">
                              {formatDuration(svc.durationMinutes)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 sm:pt-2.5 sm:border-t sm:border-[#E8D6CB]/70">
                            <span className="text-sm sm:text-base font-bold text-[#594943] tabular-nums">
                              {formatBRL(svc.price)}
                            </span>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleComboService(svc)}
                                aria-label={
                                  inCombo
                                    ? `Remover ${svc.name} do combo`
                                    : `Adicionar ${svc.name} ao combo`
                                }
                                title={inCombo ? 'No combo' : 'Adicionar ao combo'}
                                className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-xs font-medium transition-colors border ${
                                  inCombo
                                    ? 'bg-[#F2EAE4] border-[#C4A477] text-[#594943]'
                                    : 'bg-white border-[#E8D6CB] text-[#594943] hover:border-[#C4A477]'
                                }`}
                              >
                                {inCombo ? (
                                  <Check className="w-3.5 h-3.5 text-[#C4A477]" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => quickBookService(svc)}
                                className="min-h-[36px] rounded-xl bg-[#594943] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#433631] transition-colors whitespace-nowrap"
                              >
                                Agendar
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'appointments' && (
          <ClientAppointmentsView
            user={user}
            appointments={clientAppointments}
            settings={settings}
            busySlots={busySlots}
            onAppointmentUpdated={onAppointmentUpdated}
          />
        )}

        {activeTab === 'studio' && (
          <section className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#594943]">
                Sobre {settings.ownerName || settings.studioName}
              </h2>
              <p className="mt-1 text-sm text-[#95847C]">{settings.bio || settings.tagline}</p>
            </div>

            <div className="bg-white rounded-3xl border border-[#E8D6CB] divide-y divide-[#E8D6CB]">
              <div className="p-5 flex items-start gap-4">
                <Clock className="w-5 h-5 text-[#C4A477] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[#594943]">
                    Horário de funcionamento
                  </div>
                  <div className="mt-0.5 text-sm text-[#95847C] tabular-nums">
                    {workDaysLabel} · {settings.openTime} às {settings.closeTime}
                  </div>
                </div>
              </div>

              <div className="p-5 flex items-start gap-4">
                <MapPin className="w-5 h-5 text-[#C4A477] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[#594943]">Endereço</div>
                  <div className="mt-0.5 text-sm text-[#95847C]">{settings.address}</div>
                </div>
              </div>

              <div className="p-5 flex items-start gap-4">
                <Instagram className="w-5 h-5 text-[#C4A477] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[#594943]">Instagram oficial</div>
                  <div className="mt-0.5 text-sm text-[#95847C]">{settings.instagram}</div>
                </div>
              </div>

              <div className="p-5 flex items-start gap-4">
                <Sparkles className="w-5 h-5 text-[#C4A477] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[#594943]">
                    Política de reserva, remarcação e manutenção
                  </div>
                  <div className="mt-0.5 text-sm text-[#95847C] leading-relaxed">
                    {settings.depositPercent > 0 && settings.depositPercent < 100
                      ? `Para agendamentos via Pix, o sinal é de ${settings.depositPercent}% do valor total. `
                      : ''}
                    Remarcações online são aceitas com até {settings.rescheduleMinHours}h de antecedência. Recomendamos retorno para manutenção a cada {settings.returnAlertDays} dias.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={buildWhatsAppUrl(
                  settings.whatsapp,
                  `Olá! Gostaria de tirar uma dúvida sobre os procedimentos do ${settings.studioName}.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#594943] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#433631] transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-[#C4A477]" />
                <span>Falar no WhatsApp</span>
              </a>

              <PWAInstallButton />
            </div>
          </section>
        )}
      </main>

      {/* Quiet Desktop Footer */}
      <footer className="hidden md:block max-w-7xl mx-auto px-6 lg:px-8 mt-16 pt-8 border-t border-[#E8D6CB] text-xs text-[#95847C]">
        <div className="flex items-center justify-between gap-4">
          <span>
            {settings.studioName} · {settings.address}
          </span>
          <span>© {new Date().getFullYear()} {settings.studioName}</span>
        </div>
      </footer>

      {/* Mobile Floating Glassmorphic Bottom Tab Bar (v36) */}
      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-3 left-3 right-3 z-50 mb-safe"
      >
        <div className="glass-nav rounded-2xl border border-white/15 shadow-xl px-2 py-1.5 grid grid-cols-4 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
              activeTab === 'catalog' ? 'text-[#C4A477] bg-white/10' : 'text-[#FAF6F1]/75'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-medium">Catálogo</span>
          </button>

          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className={`min-h-[48px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
              comboServices.length > 0 ? 'text-white bg-[#C4A477]' : 'text-[#FAF6F1]/75'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px] font-medium tabular-nums">
              {comboServices.length > 0 ? `Combo (${comboServices.length})` : 'Agendar'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
              activeTab === 'appointments' ? 'text-[#C4A477] bg-white/10' : 'text-[#FAF6F1]/75'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-medium">Horários</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
              activeTab === 'studio' ? 'text-[#C4A477] bg-white/10' : 'text-[#FAF6F1]/75'
            }`}
          >
            <Store className="w-5 h-5" />
            <span className="text-[10px] font-medium">Estúdio</span>
          </button>
        </div>
      </nav>

      {/* Booking & Combo Native Bottom Sheet */}
      <BookingSheet
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        combo={comboServices}
        allServices={services}
        onToggleService={toggleComboService}
        onRemoveService={(id) => setComboIds((prev) => prev.filter((x) => x !== id))}
        onClearCombo={() => setComboIds([])}
        onAppointmentCreated={onAppointmentCreated}
        settings={settings}
        busySlots={busySlots}
        user={user}
      />
    </div>
  );
};
