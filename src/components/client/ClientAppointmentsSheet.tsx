import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CalendarPlus,
  Clock,
  Copy,
  Download,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { CalendarPicker } from '../CalendarPicker';
import { useToast } from '../Toast';
import { cancelAppointmentAtomic, rescheduleAppointmentAtomic } from '../../lib/db';
import { signInWithGoogle, signOutUser } from '../../lib/firebase';
import { loadSavedClientIdentity, saveClientIdentity } from '../../lib/localClientStore';
import {
  buildGoogleCalendarUrl,
  buildWhatsAppUrl,
  calculatePixChargeAmount,
  canRescheduleAppointment,
  downloadICSFile,
  formatBRL,
  formatDateBR,
  formatDuration,
  generatePixPayload,
  maskPhoneBR,
  sanitizePhone,
  statusLabelPT,
} from '../../lib/utils';
import type { Appointment, AvailabilitySlot, SalonSettings } from '../../types/salon';

interface ClientAppointmentsViewProps {
  user: User | null;
  appointments: Appointment[];
  settings: SalonSettings;
  busySlots: AvailabilitySlot[];
  onAppointmentUpdated: (appointment: Appointment) => void;
}

export const ClientAppointmentsView: React.FC<ClientAppointmentsViewProps> = ({
  user,
  appointments,
  settings,
  busySlots,
  onAppointmentUpdated,
}) => {
  const { showToast } = useToast();
  const [phoneQuery, setPhoneQuery] = useState(() => loadSavedClientIdentity().phone);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const visibleAppointments = useMemo(() => {
    const queryDigits = sanitizePhone(phoneQuery);
    if (!queryDigits) return appointments;
    return appointments.filter((apt) => {
      if (user && apt.clientUid === user.uid) return true;
      return sanitizePhone(apt.clientPhone).includes(queryDigits);
    });
  }, [appointments, phoneQuery, user]);

  const openReschedule = (apt: Appointment) => {
    const check = canRescheduleAppointment(apt, settings.rescheduleMinHours);
    if (!check.allowed) {
      showToast(check.reason || 'Remarcação indisponível para este horário.', 'info');
      return;
    }
    setRescheduleTarget(apt);
    setNewDate(apt.date);
    setNewTime('');
  };

  const handleSaveReschedule = async () => {
    if (!rescheduleTarget || !newDate || !newTime) return;
    setSaving(true);
    try {
      const updated = await rescheduleAppointmentAtomic(rescheduleTarget, newDate, newTime);
      onAppointmentUpdated(updated);
      showToast(
        `Horário remarcado para ${formatDateBR(newDate)} às ${newTime}. O horário anterior foi liberado.`,
      );
      setRescheduleTarget(null);
    } catch {
      showToast('Não foi possível remarcar este horário.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (apt: Appointment) => {
    setSaving(true);
    try {
      const updated = await cancelAppointmentAtomic(apt);
      onAppointmentUpdated(updated);
      setCancelConfirmId(null);
      showToast('Agendamento cancelado e horário liberado automaticamente.');
    } catch {
      showToast('Erro ao cancelar agendamento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyPix = async (apt: Appointment) => {
    const amount = calculatePixChargeAmount(apt.totalPrice, settings.depositPercent);
    const payload = generatePixPayload({
      pixKey: settings.pixKey,
      pixName: settings.pixName,
      pixCity: settings.pixCity,
      amount,
      txid: apt.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20),
    });
    try {
      await navigator.clipboard.writeText(payload);
      showToast('Pix Copia e Cola copiado.');
    } catch {
      showToast('Erro ao copiar código Pix.', 'error');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#350B19]">
            Meus Horários
          </h2>
          <p className="mt-1 text-sm text-[#6E4F59]">
            Consulte seus agendamentos pelo WhatsApp ou conecte sua conta Google. Remarcações online permitidas com até{' '}
            <strong className="text-[#350B19]">{settings.rescheduleMinHours}h</strong> de antecedência.
          </p>
        </div>

        {user ? (
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[#EBDCE0] bg-white px-3.5 py-2 text-xs font-medium text-[#6E4F59] hover:text-[#350B19] transition-colors self-start sm:self-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair ({user.email?.split('@')[0]})</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              void signInWithGoogle().catch(() =>
                showToast('Login cancelado ou bloqueado.', 'error'),
              );
            }}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[#EBDCE0] bg-white px-4 py-2 text-xs font-semibold text-[#350B19] hover:border-[#D83F79] transition-colors self-start sm:self-auto whitespace-nowrap"
          >
            <span>Sincronizar com Google (opcional)</span>
          </button>
        )}
      </div>

      {/* WhatsApp Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#EBDCE0] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6E4F59] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="tel"
            value={phoneQuery}
            onChange={(e) => {
              const masked = maskPhoneBR(e.target.value);
              setPhoneQuery(masked);
              const existing = loadSavedClientIdentity();
              saveClientIdentity({ ...existing, phone: masked });
            }}
            placeholder="Filtrar pelo seu WhatsApp com DDD..."
            aria-label="Buscar agendamentos pelo WhatsApp"
            className="w-full min-h-[42px] rounded-xl border border-[#EBDCE0] bg-[#FAF4F5]/70 pl-10 pr-4 text-sm tabular-nums focus:border-[#D83F79] focus:bg-white focus:outline-none"
          />
        </div>
        {phoneQuery && (
          <button
            type="button"
            onClick={() => setPhoneQuery('')}
            className="text-xs font-medium text-[#D83F79] px-2 self-end sm:self-center"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {visibleAppointments.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#EBDCE0] p-8 text-center space-y-3">
          <p className="text-sm text-[#6E4F59]">
            Nenhum agendamento encontrado neste aparelho para o WhatsApp informado.
          </p>
          {!user && (
            <p className="text-xs text-[#6E4F59]">
              Agendou em outro celular usando sua conta Google? Toque em{' '}
              <strong>Sincronizar com Google</strong> acima para carregar seu histórico.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleAppointments.map((apt) => {
            const isActive = apt.status === 'pending' || apt.status === 'confirmed';
            const rescheduleCheck = canRescheduleAppointment(apt, settings.rescheduleMinHours);
            const statusColor =
              apt.status === 'confirmed'
                ? 'text-emerald-700'
                : apt.status === 'completed'
                  ? 'text-[#350B19]'
                  : apt.status === 'cancelled'
                    ? 'text-[#6E4F59]'
                    : 'text-[#D83F79]';

            return (
              <article
                key={apt.id}
                className="bg-white rounded-2xl border border-[#EBDCE0] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[#6E4F59] tabular-nums">
                      {formatDateBR(apt.date)} · {apt.startTime}–{apt.endTime}
                    </span>
                    <span className={`font-semibold ${statusColor}`}>
                      {statusLabelPT(apt.status)}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-[#350B19] leading-snug">
                    {apt.serviceNames.join(' + ')}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#6E4F59] tabular-nums">
                    <span>{formatDuration(apt.totalDurationMinutes)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#350B19]">
                      {formatBRL(apt.totalPrice)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {apt.paymentMethod === 'pix'
                        ? apt.pixPaid
                          ? 'Pix confirmado'
                          : 'Pix aguardando'
                        : 'Pagamento presencial'}
                    </span>
                  </div>
                </div>

                {isActive && (
                  <div className="pt-3 border-t border-[#EBDCE0] space-y-2.5">
                    {/* 12h Rule Notice when within restricted window */}
                    {!rescheduleCheck.allowed && rescheduleCheck.hoursLeft > 0 && (
                      <div className="rounded-xl bg-[#FAF4F5] border border-[#EBDCE0] px-3 py-2 flex items-start gap-2 text-xs text-[#6E4F59]">
                        <Clock className="w-3.5 h-3.5 text-[#D83F79] mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <p>{rescheduleCheck.reason}</p>
                          <a
                            href={buildWhatsAppUrl(
                              settings.whatsapp,
                              `Olá! Preciso alterar meu horário de ${formatDateBR(apt.date)} às ${apt.startTime} (${apt.serviceNames.join(' + ')}).`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#350B19] hover:text-[#D83F79]"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Falar com o estúdio no WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {rescheduleCheck.allowed && (
                        <button
                          type="button"
                          onClick={() => openReschedule(apt)}
                          className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#350B19] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4F172A] transition-colors whitespace-nowrap"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Remarcar</span>
                        </button>
                      )}

                      {apt.paymentMethod === 'pix' && !apt.pixPaid && settings.pixKey.trim() && (
                        <button
                          type="button"
                          onClick={() => void copyPix(apt)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#F7E2EA] px-3 py-2 text-xs font-semibold text-[#350B19] hover:bg-[#D83F79] hover:text-white transition-colors whitespace-nowrap"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Pix</span>
                        </button>
                      )}

                      <a
                        href={buildGoogleCalendarUrl(apt, settings)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Adicionar ao Google Agenda"
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-[#EBDCE0] text-[#350B19] hover:border-[#D83F79] transition-colors"
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => downloadICSFile(apt, settings)}
                        aria-label="Baixar arquivo .ics"
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-[#EBDCE0] text-[#350B19] hover:border-[#D83F79] transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>

                    {cancelConfirmId === apt.id ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FAF4F5] px-3 py-2 text-xs">
                        <span className="text-[#350B19] font-medium">Confirmar cancelamento?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCancelConfirmId(null)}
                            className="px-2.5 py-1 rounded-lg text-[#6E4F59] hover:text-[#350B19]"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleCancel(apt)}
                            className="px-3 py-1 rounded-lg bg-[#D83F79] text-white font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCancelConfirmId(apt.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-[#6E4F59] hover:text-[#D83F79] transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancelar agendamento</span>
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Online Reschedule Bottom Sheet */}
      <BottomSheet
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title="Remarcar Horário"
        subtitle={
          rescheduleTarget
            ? `${rescheduleTarget.serviceNames.join(' + ')} · ${formatDuration(rescheduleTarget.totalDurationMinutes)}`
            : ''
        }
        footer={
          <button
            type="button"
            disabled={saving || !newDate || !newTime}
            onClick={handleSaveReschedule}
            className="w-full min-h-[46px] rounded-xl bg-[#D83F79] text-white text-sm font-semibold hover:bg-[#BD2D65] disabled:opacity-45 transition-colors"
          >
            {saving ? 'Atualizando horário...' : 'Confirmar nova data e horário'}
          </button>
        }
      >
        {rescheduleTarget && (
          <CalendarPicker
            selectedDate={newDate}
            selectedTime={newTime}
            onSelectDate={setNewDate}
            onSelectTime={setNewTime}
            durationMinutes={rescheduleTarget.totalDurationMinutes}
            settings={settings}
            busySlots={busySlots}
            ignoreSlotId={rescheduleTarget.id}
          />
        )}
      </BottomSheet>
    </section>
  );
};
