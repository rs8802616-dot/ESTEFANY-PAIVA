import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  Copy,
  Download,
  MessageCircle,
  Plus,
  QrCode,
  Store,
  Trash2,
} from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { CalendarPicker } from '../CalendarPicker';
import { useToast } from '../Toast';
import { createAppointmentAtomic } from '../../lib/db';
import { signInWithGoogle } from '../../lib/firebase';
import { loadSavedClientIdentity, saveClientIdentity } from '../../lib/localClientStore';
import {
  buildGoogleCalendarUrl,
  buildWhatsAppUrl,
  calculatePixChargeAmount,
  downloadICSFile,
  formatBRL,
  formatDateBR,
  formatDuration,
  generatePixPayload,
  maskPhoneBR,
  minutesToTime,
  sanitizePhone,
  timeToMinutes,
  todayISO,
} from '../../lib/utils';
import type {
  Appointment,
  AvailabilitySlot,
  PaymentMethod,
  SalonSettings,
  Service,
} from '../../types/salon';

interface BookingSheetProps {
  open: boolean;
  onClose: () => void;
  combo: Service[];
  allServices: Service[];
  onToggleService: (svc: Service) => void;
  onRemoveService: (serviceId: string) => void;
  onClearCombo: () => void;
  onAppointmentCreated: (appointment: Appointment) => void;
  settings: SalonSettings;
  busySlots: AvailabilitySlot[];
  user: User | null;
}

type BookingStep = 'schedule' | 'details' | 'confirmed';

export const BookingSheet: React.FC<BookingSheetProps> = ({
  open,
  onClose,
  combo,
  allServices,
  onToggleService,
  onRemoveService,
  onClearCombo,
  onAppointmentCreated,
  settings,
  busySlots,
  user,
}) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<BookingStep>('schedule');
  const [showAddCombo, setShowAddCombo] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clientName, setClientName] = useState(() => loadSavedClientIdentity().name);
  const [clientPhone, setClientPhone] = useState(() => loadSavedClientIdentity().phone);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [confirmedApt, setConfirmedApt] = useState<Appointment | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    if (user?.displayName && !clientName) {
      setClientName(user.displayName);
    }
  }, [user, clientName]);

  useEffect(() => {
    if (!open) {
      setStep('schedule');
      setShowAddCombo(false);
      setConfirmedApt(null);
      setPixCopied(false);
    } else {
      const saved = loadSavedClientIdentity();
      if (saved.name && !clientName) setClientName(saved.name);
      if (saved.phone && !clientPhone) setClientPhone(saved.phone);
    }
  }, [open, clientName, clientPhone]);

  const totalPrice = useMemo(
    () => combo.reduce((sum, item) => sum + item.price, 0),
    [combo],
  );
  const totalDuration = useMemo(
    () => combo.reduce((sum, item) => sum + item.durationMinutes, 0),
    [combo],
  );

  const chargeAmount = useMemo(
    () => calculatePixChargeAmount(totalPrice, settings.depositPercent),
    [totalPrice, settings.depositPercent],
  );

  const extraServices = useMemo(() => {
    const selectedIds = new Set(combo.map((c) => c.id));
    return allServices.filter((s) => !selectedIds.has(s.id));
  }, [allServices, combo]);

  const pixPayload = useMemo(() => {
    if (!confirmedApt || !settings.pixKey.trim()) return '';
    const amount = calculatePixChargeAmount(confirmedApt.totalPrice, settings.depositPercent);
    return generatePixPayload({
      pixKey: settings.pixKey,
      pixName: settings.pixName,
      pixCity: settings.pixCity,
      amount,
      txid: confirmedApt.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20),
    });
  }, [confirmedApt, settings]);

  const handleOptionalGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const signedUser = await signInWithGoogle();
      if (signedUser.displayName && !clientName) {
        setClientName(signedUser.displayName);
      }
      showToast('Conta Google vinculada para sincronizar em outros aparelhos.');
    } catch {
      showToast('Não foi possível conectar com o Google.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (combo.length === 0) {
      showToast('Adicione pelo menos um procedimento ao combo.', 'info');
      return;
    }
    if (!selectedDate || !selectedTime) {
      showToast('Escolha data e horário disponíveis.', 'info');
      return;
    }
    const cleanPhone = sanitizePhone(clientPhone);
    if (clientName.trim().length < 2 || cleanPhone.length < 10) {
      showToast('Informe seu nome completo e WhatsApp com DDD.', 'error');
      return;
    }

    const formattedPhone = maskPhoneBR(cleanPhone);
    setSubmitting(true);
    try {
      const created = await createAppointmentAtomic({
        clientUid: user?.uid,
        clientName: clientName.trim(),
        clientPhone: formattedPhone,
        clientEmail: user?.email || '',
        services: combo,
        date: selectedDate,
        startTime: selectedTime,
        paymentMethod,
        notes: notes.trim(),
      });

      saveClientIdentity({ name: clientName.trim(), phone: formattedPhone });
      onAppointmentCreated(created);
      setConfirmedApt(created);
      onClearCombo();
      setStep('confirmed');
      showToast('Agendamento confirmado na agenda do estúdio.');
    } catch {
      showToast('Erro ao gravar agendamento. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setPixCopied(true);
      showToast('Código Pix Copia e Cola copiado.');
      window.setTimeout(() => setPixCopied(false), 2500);
    } catch {
      showToast('Não foi possível copiar automaticamente.', 'error');
    }
  };

  const title =
    step === 'schedule'
      ? 'Seu Combo & Horário'
      : step === 'details'
        ? 'Seus Dados & Confirmação'
        : 'Reserva Confirmada';

  const subtitle =
    step === 'schedule'
      ? combo.length > 0
        ? `${combo.length} ${combo.length === 1 ? 'procedimento' : 'procedimentos'} · ${formatDuration(totalDuration)} · ${formatBRL(totalPrice)}`
        : 'Selecione procedimentos no catálogo para montar seu combo'
      : step === 'details'
        ? `${formatDateBR(selectedDate)} · ${selectedTime} às ${minutesToTime(timeToMinutes(selectedTime) + totalDuration)}`
        : confirmedApt
          ? `${formatDateBR(confirmedApt.date)} às ${confirmedApt.startTime} · ${settings.studioName}`
          : '';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        step === 'schedule' ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#6E4F59]">Total estimado</div>
              <div className="text-lg font-semibold text-[#350B19] tabular-nums">
                {formatBRL(totalPrice)}
              </div>
            </div>
            <button
              type="button"
              disabled={combo.length === 0 || !selectedDate || !selectedTime}
              onClick={() => setStep('details')}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#350B19] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#4F172A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : step === 'details' ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('schedule')}
              className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#EBDCE0] bg-white px-4 py-2.5 text-sm font-medium text-[#350B19] hover:bg-[#FAF4F5] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmBooking}
              className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#D83F79] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#BD2D65] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[46px] rounded-xl bg-[#350B19] text-white text-sm font-semibold hover:bg-[#4F172A] transition-colors"
          >
            Concluir e voltar ao catálogo
          </button>
        )
      }
    >
      {step === 'schedule' && (
        <div className="space-y-5">
          {combo.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#EBDCE0] p-6 text-center">
              <p className="text-sm text-[#6E4F59]">
                Seu combo está vazio. Escolha um ou mais procedimentos no catálogo para ver os horários compatíveis.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 min-h-[44px] rounded-xl bg-[#350B19] px-5 py-2 text-sm font-medium text-white"
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <>
              {/* Selected Combo List + In-Modal "+ Combo" */}
              <div className="bg-white rounded-2xl border border-[#EBDCE0] overflow-hidden">
                <div className="divide-y divide-[#EBDCE0]">
                  {combo.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#350B19] truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#6E4F59] tabular-nums">
                          {formatDuration(item.durationMinutes)} · {formatBRL(item.price)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveService(item.id)}
                        aria-label={`Remover ${item.name}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#6E4F59] hover:text-[#D83F79] hover:bg-[#FAF4F5] transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {extraServices.length > 0 && (
                  <div className="border-t border-[#EBDCE0] bg-[#FAF4F5]/60 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setShowAddCombo((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D83F79] hover:text-[#350B19] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {showAddCombo ? 'Ocultar adicionais' : '+ Combo (adicionar outro serviço)'}
                      </span>
                    </button>

                    {showAddCombo && (
                      <div className="mt-2.5 space-y-1.5">
                        {extraServices.map((extra) => (
                          <button
                            key={extra.id}
                            type="button"
                            onClick={() => {
                              onToggleService(extra);
                              setSelectedTime('');
                            }}
                            className="w-full min-h-[42px] flex items-center justify-between gap-2 rounded-xl bg-white border border-[#EBDCE0] px-3 py-2 text-left hover:border-[#D83F79] transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#350B19] truncate">
                                {extra.name}
                              </div>
                              <div className="text-[11px] text-[#6E4F59] tabular-nums">
                                +{formatDuration(extra.durationMinutes)} · {formatBRL(extra.price)}
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-[#D83F79] shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 7-Column Calendar & Duration Slots */}
              <CalendarPicker
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onSelectDate={setSelectedDate}
                onSelectTime={setSelectedTime}
                durationMinutes={totalDuration}
                settings={settings}
                busySlots={busySlots}
              />
            </>
          )}
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-4">
          {/* Lean LGPD Identification Form (No login required!) */}
          <div className="bg-white rounded-2xl border border-[#EBDCE0] p-4 space-y-4">
            <div>
              <label htmlFor="bk-name" className="block text-xs font-medium text-[#6E4F59] mb-1.5">
                Nome completo
              </label>
              <input
                id="bk-name"
                type="text"
                maxLength={100}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex.: Mariana Oliveira"
                className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-[#FAF4F5]/60 px-3.5 text-sm text-[#2A0E17] focus:border-[#D83F79] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="bk-phone" className="block text-xs font-medium text-[#6E4F59] mb-1.5">
                WhatsApp com DDD
              </label>
              <input
                id="bk-phone"
                type="tel"
                maxLength={20}
                value={clientPhone}
                onChange={(e) => setClientPhone(maskPhoneBR(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-[#FAF4F5]/60 px-3.5 text-sm text-[#2A0E17] tabular-nums focus:border-[#D83F79] focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#6E4F59]">
                Usamos apenas seu nome e WhatsApp para confirmar e permitir remarcações online.
              </p>
            </div>

            <div>
              <label htmlFor="bk-notes" className="block text-xs font-medium text-[#6E4F59] mb-1.5">
                Observações ou referência (opcional)
              </label>
              <textarea
                id="bk-notes"
                rows={2}
                maxLength={400}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Formato amendoado curto, francesinha delicada..."
                className="w-full rounded-xl border border-[#EBDCE0] bg-[#FAF4F5]/60 p-3 text-sm text-[#2A0E17] focus:border-[#D83F79] focus:bg-white focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Payment Preference */}
          <div className="bg-white rounded-2xl border border-[#EBDCE0] p-4 space-y-3">
            <div className="text-xs font-medium text-[#6E4F59]">Forma de pagamento</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`min-h-[56px] rounded-xl border p-3 text-left transition-colors ${
                  paymentMethod === 'pix'
                    ? 'border-[#D83F79] bg-[#F7E2EA]/40 text-[#350B19]'
                    : 'border-[#EBDCE0] bg-white text-[#6E4F59] hover:border-[#350B19]/30'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#350B19]">
                  <QrCode className="w-4 h-4 text-[#D83F79]" />
                  <span>Pix Copia e Cola</span>
                </div>
                <div className="mt-1 text-xs text-[#6E4F59] tabular-nums">
                  {settings.depositPercent > 0 && settings.depositPercent < 100
                    ? `Sinal ${settings.depositPercent}% (${formatBRL(chargeAmount)})`
                    : `Valor total (${formatBRL(totalPrice)})`}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('presencial')}
                className={`min-h-[56px] rounded-xl border p-3 text-left transition-colors ${
                  paymentMethod === 'presencial'
                    ? 'border-[#D83F79] bg-[#F7E2EA]/40 text-[#350B19]'
                    : 'border-[#EBDCE0] bg-white text-[#6E4F59] hover:border-[#350B19]/30'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#350B19]">
                  <Store className="w-4 h-4 text-[#D83F79]" />
                  <span>No Estúdio</span>
                </div>
                <div className="mt-1 text-xs text-[#6E4F59]">Cartão, dinheiro ou Pix</div>
              </button>
            </div>
          </div>

          {/* Optional Google Sync Card */}
          <div className="bg-white rounded-2xl border border-[#EBDCE0] px-4 py-3 flex items-center justify-between gap-3">
            {user ? (
              <>
                <div className="min-w-0">
                  <div className="text-xs text-[#6E4F59]">Sincronização Google ativa</div>
                  <div className="text-xs font-medium text-[#350B19] truncate">{user.email}</div>
                </div>
                <Check className="w-4 h-4 text-[#D83F79] shrink-0" />
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#350B19]">
                    Login Google (opcional)
                  </div>
                  <div className="text-[11px] text-[#6E4F59]">
                    Conecte se quiser ver este horário em outros dispositivos.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleOptionalGoogleLogin}
                  className="min-h-[36px] rounded-xl border border-[#EBDCE0] bg-[#FAF4F5] px-3 text-xs font-semibold text-[#350B19] hover:border-[#D83F79] whitespace-nowrap shrink-0"
                >
                  {authLoading ? '...' : 'Conectar'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === 'confirmed' && confirmedApt && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F7E2EA] text-[#D83F79] flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#350B19]">
                  Seu horário está reservado
                </h3>
                <p className="text-xs text-[#6E4F59] tabular-nums">
                  {formatDateBR(confirmedApt.date)} · {confirmedApt.startTime} às{' '}
                  {confirmedApt.endTime} · {formatDuration(confirmedApt.totalDurationMinutes)}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#EBDCE0] text-sm text-[#2A0E17] space-y-1">
              <div>{confirmedApt.serviceNames.join(' + ')}</div>
              <div className="font-semibold text-[#350B19] tabular-nums">
                Total: {formatBRL(confirmedApt.totalPrice)}
              </div>
            </div>
          </div>

          {/* Pix Copia e Cola */}
          {confirmedApt.paymentMethod === 'pix' && pixPayload && (
            <div className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#350B19]">Pix Copia e Cola</span>
                <span className="text-xs font-mono text-[#D83F79] tabular-nums">
                  {settings.depositPercent > 0 && settings.depositPercent < 100
                    ? `Sinal ${settings.depositPercent}% · ${formatBRL(
                        calculatePixChargeAmount(confirmedApt.totalPrice, settings.depositPercent),
                      )}`
                    : formatBRL(confirmedApt.totalPrice)}
                </span>
              </div>
              <p className="text-xs text-[#6E4F59] leading-relaxed">
                Copie o código abaixo e cole no aplicativo do seu banco na opção{' '}
                <strong>Pix Copia e Cola</strong>.
              </p>
              <div className="rounded-xl bg-[#FAF4F5] border border-[#EBDCE0] p-3 font-mono text-[11px] text-[#350B19] break-all select-all">
                {pixPayload}
              </div>
              <button
                type="button"
                onClick={handleCopyPix}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#D83F79] text-white text-sm font-semibold hover:bg-[#BD2D65] transition-colors"
              >
                {pixCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{pixCopied ? 'Código Pix copiado' : 'Copiar código Pix'}</span>
              </button>
            </div>
          )}

          {/* Calendar & WhatsApp Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href={buildGoogleCalendarUrl(confirmedApt, settings)}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#EBDCE0] bg-white px-4 py-2.5 text-sm font-medium text-[#350B19] hover:border-[#D83F79] transition-colors"
            >
              <CalendarPlus className="w-4 h-4 text-[#D83F79]" />
              <span>Salvar no Google Agenda</span>
            </a>

            <button
              type="button"
              onClick={() => downloadICSFile(confirmedApt, settings)}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#EBDCE0] bg-white px-4 py-2.5 text-sm font-medium text-[#350B19] hover:border-[#D83F79] transition-colors"
            >
              <Download className="w-4 h-4 text-[#D83F79]" />
              <span>Baixar .ics (iPhone)</span>
            </button>

            <a
              href={buildWhatsAppUrl(
                settings.whatsapp,
                `Olá! Acabei de agendar no ${settings.studioName}: ${confirmedApt.serviceNames.join(' + ')} para ${formatDateBR(confirmedApt.date)} às ${confirmedApt.startTime}. Nome: ${confirmedApt.clientName}.${confirmedApt.paymentMethod === 'pix' ? ' Segue meu comprovante do Pix!' : ''}`,
              )}
              target="_blank"
              rel="noreferrer"
              className="sm:col-span-2 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#350B19] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4F172A] transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-[#D83F79]" />
              <span>Confirmar / Enviar Comprovante no WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
