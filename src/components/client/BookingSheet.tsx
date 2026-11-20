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
      if (!signedUser) return;
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
      ? 'Seu Combo e Horário'
      : step === 'details'
        ? 'Seus Dados e Confirmação'
        : 'Agendamento Confirmado';

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
      closeOnBackdrop={false}
      title={title}
      subtitle={subtitle}
      footer={
        step === 'schedule' ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#95847C]">Total estimado</div>
              <div className="text-lg font-semibold text-[#594943] tabular-nums">
                {formatBRL(totalPrice)}
              </div>
            </div>
            <button
              type="button"
              disabled={combo.length === 0 || !selectedDate || !selectedTime}
              onClick={() => setStep('details')}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#594943] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#433631] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E8D6CB] bg-white px-4 py-2.5 text-sm font-medium text-[#594943] hover:bg-[#FAF6F1] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmBooking}
              className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C4A477] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#BE9293] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[46px] rounded-xl bg-[#594943] text-white text-sm font-semibold hover:bg-[#433631] transition-colors"
          >
            Concluir e voltar ao catálogo
          </button>
        )
      }
    >
      {step === 'schedule' && (
        <div className="space-y-5">
          {combo.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4 sm:p-5 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Tela 8 • Escolha de Serviços
                </span>
                <h3 className="font-editorial text-lg font-semibold text-[#594943]">
                  Selecione o procedimento desejado
                </h3>
                <p className="text-xs text-[#95847C]">
                  Toque em um ou mais serviços abaixo para montar seu horário:
                </p>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {allServices.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      onToggleService(svc);
                      setSelectedTime('');
                    }}
                    className="w-full min-h-[48px] flex items-center justify-between gap-3 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] px-3.5 py-2.5 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#594943] truncate">
                        {svc.name}
                      </div>
                      <div className="text-xs text-[#95847C] tabular-nums">
                        {formatDuration(svc.durationMinutes)} · {formatBRL(svc.price)}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#594943] px-2.5 py-1 text-xs font-semibold text-white shrink-0">
                      <Plus className="w-3.5 h-3.5 text-[#C4A477]" />
                      <span>Escolher</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Selected Combo List + In-Modal "+ Combo" */}
              <div className="bg-white rounded-2xl border border-[#E8D6CB] overflow-hidden">
                <div className="divide-y divide-[#E8D6CB]">
                  {combo.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#594943] truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#95847C] tabular-nums">
                          {formatDuration(item.durationMinutes)} · {formatBRL(item.price)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveService(item.id)}
                        aria-label={`Remover ${item.name}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#95847C] hover:text-[#C4A477] hover:bg-[#FAF6F1] transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {extraServices.length > 0 && (
                  <div className="border-t border-[#E8D6CB] bg-[#FAF6F1] p-3">
                    <button
                      type="button"
                      onClick={() => setShowAddCombo((v) => !v)}
                      className="w-full min-h-[44px] flex items-center justify-between gap-2 rounded-xl bg-[#F2EAE4] hover:bg-[#E8D6CB]/80 border border-[#C4A477]/70 px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#594943] transition-colors shadow-2xs"
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-[#594943] text-[#C4A477] flex items-center justify-center shrink-0">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                        <span>
                          {showAddCombo ? 'Fechar lista de serviços' : 'Adicionar outro serviço (Combo)'}
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-[#C4A477] uppercase tracking-wider">
                        {showAddCombo ? 'Ocultar' : '+ Combo'}
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
                            className="w-full min-h-[42px] flex items-center justify-between gap-2 rounded-xl bg-white border border-[#E8D6CB] px-3 py-2 text-left hover:border-[#C4A477] transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#594943] truncate">
                                {extra.name}
                              </div>
                              <div className="text-[11px] text-[#95847C] tabular-nums">
                                +{formatDuration(extra.durationMinutes)} · {formatBRL(extra.price)}
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-[#C4A477] shrink-0" />
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
          <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4 space-y-4">
            <div>
              <label htmlFor="bk-name" className="block text-xs font-medium text-[#95847C] mb-1.5">
                Nome completo
              </label>
              <input
                id="bk-name"
                type="text"
                maxLength={100}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex.: Mariana Oliveira"
                className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/60 px-3.5 text-sm text-[#594943] focus:border-[#C4A477] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="bk-phone" className="block text-xs font-medium text-[#95847C] mb-1.5">
                WhatsApp com DDD
              </label>
              <input
                id="bk-phone"
                type="tel"
                maxLength={20}
                value={clientPhone}
                onChange={(e) => setClientPhone(maskPhoneBR(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/60 px-3.5 text-sm text-[#594943] tabular-nums focus:border-[#C4A477] focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#95847C]">
                Usamos apenas seu nome e WhatsApp para confirmar e permitir remarcações online.
              </p>
            </div>

            <div>
              <label htmlFor="bk-notes" className="block text-xs font-medium text-[#95847C] mb-1.5">
                Observações ou referência (opcional)
              </label>
              <textarea
                id="bk-notes"
                rows={2}
                maxLength={400}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Formato amendoado curto, francesinha delicada..."
                className="w-full rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/60 p-3 text-sm text-[#594943] focus:border-[#C4A477] focus:bg-white focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Payment Preference */}
          <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4 space-y-3">
            <div className="text-xs font-medium text-[#95847C]">Forma de pagamento</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`min-h-[56px] rounded-xl border p-3 text-left transition-colors ${
                  paymentMethod === 'pix'
                    ? 'border-[#C4A477] bg-[#F2EAE4]/40 text-[#594943]'
                    : 'border-[#E8D6CB] bg-white text-[#95847C] hover:border-[#594943]/30'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#594943]">
                  <QrCode className="w-4 h-4 text-[#C4A477]" />
                  <span>Pix Copia e Cola</span>
                </div>
                <div className="mt-1 text-xs text-[#95847C] tabular-nums">
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
                    ? 'border-[#C4A477] bg-[#F2EAE4]/40 text-[#594943]'
                    : 'border-[#E8D6CB] bg-white text-[#95847C] hover:border-[#594943]/30'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#594943]">
                  <Store className="w-4 h-4 text-[#C4A477]" />
                  <span>No Estúdio</span>
                </div>
                <div className="mt-1 text-xs text-[#95847C]">Cartão, dinheiro ou Pix</div>
              </button>
            </div>
          </div>

          {/* Optional Google Sync Card */}
          <div className="bg-white rounded-2xl border border-[#E8D6CB] px-4 py-3 flex items-center justify-between gap-3">
            {user ? (
              <>
                <div className="min-w-0">
                  <div className="text-xs text-[#95847C]">Sincronização Google ativa</div>
                  <div className="text-xs font-medium text-[#594943] truncate">{user.email}</div>
                </div>
                <Check className="w-4 h-4 text-[#C4A477] shrink-0" />
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#594943]">
                    Login Google (opcional)
                  </div>
                  <div className="text-[11px] text-[#95847C]">
                    Conecte se quiser ver este horário em outros dispositivos.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleOptionalGoogleLogin}
                  className="min-h-[36px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-xs font-semibold text-[#594943] hover:border-[#C4A477] whitespace-nowrap shrink-0"
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
          <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F2EAE4] text-[#C4A477] flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#594943]">
                  Seu horário está reservado
                </h3>
                <p className="text-xs text-[#95847C] tabular-nums">
                  {formatDateBR(confirmedApt.date)} · {confirmedApt.startTime} às{' '}
                  {confirmedApt.endTime} · {formatDuration(confirmedApt.totalDurationMinutes)}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8D6CB] text-sm text-[#594943] space-y-1">
              <div>{confirmedApt.serviceNames.join(' + ')}</div>
              <div className="font-semibold text-[#594943] tabular-nums">
                Total: {formatBRL(confirmedApt.totalPrice)}
              </div>
            </div>
          </div>

          {/* Pix Copia e Cola */}
          {confirmedApt.paymentMethod === 'pix' && pixPayload && (
            <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#594943]">Pix Copia e Cola</span>
                <span className="text-xs font-mono text-[#C4A477] tabular-nums">
                  {settings.depositPercent > 0 && settings.depositPercent < 100
                    ? `Sinal ${settings.depositPercent}% · ${formatBRL(
                        calculatePixChargeAmount(confirmedApt.totalPrice, settings.depositPercent),
                      )}`
                    : formatBRL(confirmedApt.totalPrice)}
                </span>
              </div>
              <p className="text-xs text-[#95847C] leading-relaxed">
                Copie o código abaixo e cole no aplicativo do seu banco na opção{' '}
                <strong>Pix Copia e Cola</strong>.
              </p>
              <div className="rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] p-3 font-mono text-[11px] text-[#594943] break-all select-all">
                {pixPayload}
              </div>
              <button
                type="button"
                onClick={handleCopyPix}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C4A477] text-white text-sm font-semibold hover:bg-[#BE9293] transition-colors"
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
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8D6CB] bg-white px-4 py-2.5 text-sm font-medium text-[#594943] hover:border-[#C4A477] transition-colors"
            >
              <CalendarPlus className="w-4 h-4 text-[#C4A477]" />
              <span>Salvar no Google Agenda</span>
            </a>

            <button
              type="button"
              onClick={() => downloadICSFile(confirmedApt, settings)}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8D6CB] bg-white px-4 py-2.5 text-sm font-medium text-[#594943] hover:border-[#C4A477] transition-colors"
            >
              <Download className="w-4 h-4 text-[#C4A477]" />
              <span>Baixar .ics (iPhone)</span>
            </button>

            <a
              href={buildWhatsAppUrl(
                settings.whatsapp,
                `Olá! Acabei de agendar no ${settings.studioName}: ${confirmedApt.serviceNames.join(' + ')} para ${formatDateBR(confirmedApt.date)} às ${confirmedApt.startTime}. Nome: ${confirmedApt.clientName}.${confirmedApt.paymentMethod === 'pix' ? ' Segue meu comprovante do Pix!' : ''}`,
              )}
              target="_blank"
              rel="noreferrer"
              className="sm:col-span-2 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#594943] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#433631] transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-[#C4A477]" />
              <span>Confirmar / Enviar Comprovante no WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
