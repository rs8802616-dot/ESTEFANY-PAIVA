import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageCircle,
  Phone,
  Plus,
  QrCode,
  Trash2,
  XCircle,
} from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { useToast } from '../Toast';
import {
  adminCreatePersonalBlock,
  adminDeleteAppointment,
  adminDeletePersonalBlock,
  adminUpdateAppointmentStatus,
  createAppointmentAtomic,
} from '../../lib/db';
import { auth } from '../../lib/firebase';
import {
  buildGoogleCalendarUrl,
  buildWhatsAppUrl,
  calculatePixChargeAmount,
  formatBRL,
  formatDateBR,
  formatDuration,
  getAdminWhatsAppTemplates,
  maskPhoneBR,
  statusLabelPT,
  todayISO,
} from '../../lib/utils';
import type {
  Appointment,
  AppointmentStatus,
  PersonalBlock,
  SalonSettings,
  Service,
} from '../../types/salon';

interface AdminAgendaTabProps {
  appointments: Appointment[];
  blocks: PersonalBlock[];
  services: Service[];
  settings: SalonSettings;
  openWalkInSignal?: number;
  initialDetailAppointmentId?: string | null;
  onClearInitialDetail?: () => void;
}

export const AdminAgendaTab: React.FC<AdminAgendaTabProps> = ({
  appointments,
  blocks,
  services,
  settings,
  openWalkInSignal = 0,
  initialDetailAppointmentId = null,
  onClearInitialDetail,
}) => {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [detailAppointmentId, setDetailAppointmentId] = useState<string | null>(null);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Personal block form state
  const [blkTitle, setBlkTitle] = useState('Horário de Almoço');
  const [blkDate, setBlkDate] = useState(todayISO());
  const [blkStart, setBlkStart] = useState('12:00');
  const [blkEnd, setBlkEnd] = useState('13:30');
  const [blkAllDay, setBlkAllDay] = useState(false);

  // Walk-in manual booking form state
  const [wiName, setWiName] = useState('');
  const [wiPhone, setWiPhone] = useState('');
  const [wiDate, setWiDate] = useState(todayISO());
  const [wiStart, setWiStart] = useState('10:00');
  const [wiServiceIds, setWiServiceIds] = useState<string[]>([]);
  const [wiNotes, setWiNotes] = useState('');

  useEffect(() => {
    if (openWalkInSignal > 0) {
      setWalkInOpen(true);
    }
  }, [openWalkInSignal]);

  useEffect(() => {
    if (initialDetailAppointmentId) {
      setDetailAppointmentId(initialDetailAppointmentId);
      onClearInitialDetail?.();
    }
  }, [initialDetailAppointmentId, onClearInitialDetail]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
      if (dateFilter && apt.date !== dateFilter) return false;
      return true;
    });
  }, [appointments, statusFilter, dateFilter]);

  const selectedAppointment = useMemo(
    () => appointments.find((a) => a.id === detailAppointmentId) || null,
    [appointments, detailAppointmentId],
  );

  const selectedTemplates = useMemo(
    () => (selectedAppointment ? getAdminWhatsAppTemplates(selectedAppointment, settings) : []),
    [selectedAppointment, settings],
  );

  const handleStatusChange = async (
    apt: Appointment,
    patch: { status?: AppointmentStatus; pixPaid?: boolean },
    msg: string,
  ) => {
    try {
      await adminUpdateAppointmentStatus(apt, patch);
      showToast(msg);
    } catch {
      showToast('Erro ao atualizar agendamento.', 'error');
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blkTitle.trim() || !blkDate) return;
    setSaving(true);
    try {
      await adminCreatePersonalBlock({
        title: blkTitle.trim(),
        date: blkDate,
        startTime: blkStart,
        endTime: blkEnd,
        allDay: blkAllDay,
      });
      showToast('Bloqueio salvo e sincronizado com o calendário.');
      setBlockSheetOpen(false);
    } catch {
      showToast('Erro ao criar bloqueio.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await adminDeletePersonalBlock(blockId);
      showToast('Bloqueio removido da agenda.');
    } catch {
      showToast('Erro ao remover bloqueio.', 'error');
    }
  };

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = services.filter((s) => wiServiceIds.includes(s.id));
    if (wiName.trim().length < 2 || wiPhone.replace(/\D/g, '').length < 8 || chosen.length === 0) {
      showToast('Preencha nome, WhatsApp e ao menos um procedimento.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAppointmentAtomic({
        clientUid: auth.currentUser?.uid || 'admin',
        clientName: wiName.trim(),
        clientPhone: wiPhone.trim(),
        clientEmail: '',
        services: chosen,
        date: wiDate,
        startTime: wiStart,
        paymentMethod: 'presencial',
        notes: wiNotes.trim(),
        asAdminStatus: 'confirmed',
      });
      showToast('Novo horário confirmado na agenda.');
      setWalkInOpen(false);
      setWiName('');
      setWiPhone('');
      setWiServiceIds([]);
      setWiNotes('');
    } catch {
      showToast('Erro ao registrar encaixe.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#350B19]">Agenda</h1>
          <p className="text-sm text-[#6E4F59]">
            Toque em qualquer atendimento para ver detalhes, atualizar status e disparar mensagens de 1 clique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setBlockSheetOpen(true)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#EBDCE0] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#350B19] hover:border-[#D83F79] transition-colors whitespace-nowrap"
          >
            <Ban className="w-4 h-4 text-[#D83F79]" />
            <span>Bloquear Horário</span>
          </button>

          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#350B19] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#4F172A] transition-colors whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4 text-[#D83F79]" />
            <span>Novo Horário</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-2xl border border-[#EBDCE0] p-3.5">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                statusFilter === st
                  ? 'bg-[#350B19] text-white'
                  : 'text-[#6E4F59] hover:bg-[#FAF4F5] hover:text-[#350B19]'
              }`}
            >
              {st === 'all' ? 'Todos' : statusLabelPT(st)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filtrar por data"
            className="min-h-[40px] rounded-xl border border-[#EBDCE0] bg-[#FAF4F5] px-3 text-xs text-[#350B19] tabular-nums focus:border-[#D83F79] focus:outline-none"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="min-h-[40px] text-xs text-[#D83F79] font-semibold px-2"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EBDCE0] p-10 text-center">
          <p className="text-sm text-[#6E4F59]">
            Nenhum agendamento encontrado para os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((apt) => (
            <article
              key={apt.id}
              className="bg-white rounded-2xl border border-[#EBDCE0] hover:border-[#D83F79]/60 transition-colors overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setDetailAppointmentId(apt.id)}
                className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-[#FAF4F5]/40 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#6E4F59] tabular-nums">
                    <span className="font-semibold text-[#350B19]">
                      {formatDateBR(apt.date)} · {apt.startTime}–{apt.endTime}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDuration(apt.totalDurationMinutes)}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        apt.status === 'confirmed'
                          ? 'text-emerald-700'
                          : apt.status === 'completed'
                            ? 'text-[#350B19]'
                            : apt.status === 'cancelled'
                              ? 'text-[#6E4F59]'
                              : 'text-[#D83F79]'
                      }`}
                    >
                      {statusLabelPT(apt.status)}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-[#350B19] flex items-center gap-2">
                    <span className="truncate">{apt.clientName}</span>
                    <span className="text-xs font-normal text-[#6E4F59] tabular-nums shrink-0">
                      {apt.clientPhone}
                    </span>
                  </h3>

                  <p className="text-sm text-[#2A0E17]">{apt.serviceNames.join(' + ')}</p>

                  {apt.notes && (
                    <p className="text-xs text-[#6E4F59] italic line-clamp-1">Obs.: {apt.notes}</p>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                  <span className="text-lg font-semibold text-[#350B19] tabular-nums">
                    {formatBRL(apt.totalPrice)}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-[#6E4F59]">
                    <span>
                      {apt.paymentMethod === 'pix'
                        ? apt.pixPaid
                          ? 'Pix pago'
                          : 'Pix pendente'
                        : 'Presencial'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#D83F79]" />
                  </div>
                </div>
              </button>

              {/* Compact Quick Action Strip */}
              <div className="px-4 sm:px-5 py-2.5 bg-[#FAF4F5]/60 border-t border-[#EBDCE0] flex flex-wrap items-center gap-2">
                {apt.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleStatusChange(
                        apt,
                        { status: 'confirmed' },
                        'Agendamento confirmado.',
                      )
                    }
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#350B19] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4F172A] transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar</span>
                  </button>
                )}

                {(apt.status === 'pending' || apt.status === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleStatusChange(
                        apt,
                        { status: 'completed' },
                        'Atendimento concluído.',
                      )
                    }
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Concluir</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDetailAppointmentId(apt.id)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#EBDCE0] bg-white px-3 py-1.5 text-xs font-medium text-[#350B19] hover:border-[#D83F79] transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#D83F79]" />
                  <span>Detalhes & WhatsApp</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Personal Schedule Blocks Section */}
      <div className="bg-white rounded-2xl border border-[#EBDCE0] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#350B19]">
              Bloqueios Pessoais da Agenda
            </h2>
            <p className="text-xs text-[#6E4F59]">
              Almoços, cursos ou compromissos que bloqueiam horários específicos em tempo real.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBlockSheetOpen(true)}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[#FAF4F5] border border-[#EBDCE0] px-3.5 py-1.5 text-xs font-medium text-[#350B19] hover:border-[#D83F79]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </div>

        {blocks.length === 0 ? (
          <p className="text-sm text-[#6E4F59]">Nenhum bloqueio pessoal ativo.</p>
        ) : (
          <div className="divide-y divide-[#EBDCE0]">
            {blocks.map((blk) => (
              <div key={blk.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#350B19]">{blk.title}</div>
                  <div className="text-xs text-[#6E4F59] tabular-nums">
                    {formatDateBR(blk.date)} ·{' '}
                    {blk.allDay ? 'Dia inteiro' : `${blk.startTime} às ${blk.endTime}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteBlock(blk.id)}
                  aria-label={`Remover bloqueio ${blk.title}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#6E4F59] hover:text-[#D83F79] hover:bg-[#FAF4F5]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Details BottomSheet (PRD v36) */}
      <BottomSheet
        open={Boolean(selectedAppointment)}
        onClose={() => setDetailAppointmentId(null)}
        title={selectedAppointment ? selectedAppointment.clientName : 'Detalhes do Atendimento'}
        subtitle={
          selectedAppointment
            ? `${formatDateBR(selectedAppointment.date)} · ${selectedAppointment.startTime} às ${selectedAppointment.endTime}`
            : undefined
        }
      >
        {selectedAppointment && (
          <div className="space-y-5">
            {/* Summary Card */}
            <div className="rounded-2xl bg-white border border-[#EBDCE0] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-[#6E4F59] font-medium">
                    Status atual
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      selectedAppointment.status === 'confirmed'
                        ? 'text-emerald-700'
                        : selectedAppointment.status === 'completed'
                          ? 'text-[#350B19]'
                          : selectedAppointment.status === 'cancelled'
                            ? 'text-[#6E4F59]'
                            : 'text-[#D83F79]'
                    }`}
                  >
                    {statusLabelPT(selectedAppointment.status)}
                    {selectedAppointment.rescheduleCount > 0 &&
                      ` · Remarcado ${selectedAppointment.rescheduleCount}x`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-[#6E4F59] font-medium">
                    Valor total
                  </div>
                  <div className="text-xl font-semibold text-[#350B19] tabular-nums">
                    {formatBRL(selectedAppointment.totalPrice)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EBDCE0] space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-[#2A0E17]">
                  <Phone className="w-4 h-4 text-[#D83F79] shrink-0" />
                  <span className="tabular-nums">{selectedAppointment.clientPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-[#2A0E17]">
                  <Clock className="w-4 h-4 text-[#D83F79] shrink-0" />
                  <span className="tabular-nums">
                    Duração total: {formatDuration(selectedAppointment.totalDurationMinutes)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#2A0E17]">
                  <QrCode className="w-4 h-4 text-[#D83F79] shrink-0" />
                  <span>
                    {selectedAppointment.paymentMethod === 'pix'
                      ? selectedAppointment.pixPaid
                        ? 'Pix sinal/integral confirmado'
                        : `Pix pendente (${formatBRL(
                            calculatePixChargeAmount(
                              selectedAppointment.totalPrice,
                              settings.depositPercent,
                            ),
                          )})`
                      : 'Pagamento presencial no estúdio'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EBDCE0]">
                <div className="text-xs font-medium text-[#6E4F59] mb-1">Procedimentos</div>
                <div className="text-sm font-medium text-[#350B19]">
                  {selectedAppointment.serviceNames.join(' + ')}
                </div>
                {selectedAppointment.notes && (
                  <p className="mt-2 text-xs text-[#6E4F59] bg-[#FAF4F5] rounded-xl p-2.5">
                    Obs.: {selectedAppointment.notes}
                  </p>
                )}
              </div>
            </div>

            {/* 1-Click WhatsApp Messages (Lembrete, Enviar Pix, Pós-Atendimento) */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6E4F59]">
                Mensagens Prontas de 1 Clique (WhatsApp)
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {selectedTemplates.map((tpl) => (
                  <a
                    key={tpl.id}
                    href={buildWhatsAppUrl(selectedAppointment.clientPhone, tpl.text)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[48px] flex items-center justify-between gap-3 rounded-2xl bg-white border border-[#EBDCE0] px-4 py-3 hover:border-[#D83F79] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#350B19]">{tpl.label}</div>
                      <div className="text-xs text-[#6E4F59] truncate">{tpl.description}</div>
                    </div>
                    <MessageCircle className="w-4 h-4 text-[#D83F79] shrink-0" />
                  </a>
                ))}
              </div>
            </div>

            {/* Status & Calendar Actions */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6E4F59]">
                Ações do Atendimento
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedAppointment.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleStatusChange(
                        selectedAppointment,
                        { status: 'confirmed' },
                        'Agendamento confirmado.',
                      )
                    }
                    className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#350B19] px-4 text-sm font-semibold text-white hover:bg-[#4F172A] transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar horário</span>
                  </button>
                )}

                {(selectedAppointment.status === 'pending' ||
                  selectedAppointment.status === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleStatusChange(
                        selectedAppointment,
                        { status: 'completed' },
                        'Atendimento concluído.',
                      )
                    }
                    className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Concluir atendimento</span>
                  </button>
                )}

                {selectedAppointment.paymentMethod === 'pix' &&
                  !selectedAppointment.pixPaid &&
                  selectedAppointment.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleStatusChange(
                          selectedAppointment,
                          {
                            pixPaid: true,
                            status:
                              selectedAppointment.status === 'pending'
                                ? 'confirmed'
                                : selectedAppointment.status,
                          },
                          'Pagamento Pix marcado como recebido.',
                        )
                      }
                      className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7E2EA] px-4 text-sm font-semibold text-[#350B19] hover:bg-[#D83F79] hover:text-white transition-colors"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Marcar Pix Pago</span>
                    </button>
                  )}

                <a
                  href={buildGoogleCalendarUrl(selectedAppointment, settings)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#EBDCE0] bg-white px-4 text-sm font-medium text-[#350B19] hover:border-[#D83F79] transition-colors"
                >
                  <Calendar className="w-4 h-4 text-[#D83F79]" />
                  <span>Google Agenda</span>
                </a>

                {selectedAppointment.status !== 'cancelled' &&
                  selectedAppointment.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleStatusChange(
                          selectedAppointment,
                          { status: 'cancelled' },
                          'Horário cancelado e liberado.',
                        )
                      }
                      className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#EBDCE0] bg-white px-4 text-sm font-medium text-[#6E4F59] hover:text-[#D83F79] transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancelar horário</span>
                    </button>
                  )}

                {selectedAppointment.status === 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = selectedAppointment.id;
                      void adminDeleteAppointment(targetId)
                        .then(() => {
                          setDetailAppointmentId(null);
                          showToast('Registro excluído permanentemente.');
                        })
                        .catch(() => showToast('Erro ao excluir registro.', 'error'));
                    }}
                    className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir registro</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Block Sheet */}
      <BottomSheet
        open={blockSheetOpen}
        onClose={() => setBlockSheetOpen(false)}
        title="Novo Bloqueio Pessoal"
        subtitle="Almoço, curso, folga ou feriado — sincronizado na hora com as clientes."
      >
        <form onSubmit={handleCreateBlock} className="space-y-4">
          <div>
            <label htmlFor="blk-title" className="block text-xs font-medium text-[#6E4F59] mb-1">
              Motivo do bloqueio
            </label>
            <input
              id="blk-title"
              type="text"
              required
              maxLength={100}
              value={blkTitle}
              onChange={(e) => setBlkTitle(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="blk-date" className="block text-xs font-medium text-[#6E4F59] mb-1">
              Data
            </label>
            <input
              id="blk-date"
              type="date"
              required
              value={blkDate}
              onChange={(e) => setBlkDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm tabular-nums"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-[#350B19]">
            <input
              type="checkbox"
              checked={blkAllDay}
              onChange={(e) => setBlkAllDay(e.target.checked)}
              className="w-4 h-4 accent-[#D83F79]"
            />
            <span>Bloquear o dia inteiro</span>
          </label>

          {!blkAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="blk-start" className="block text-xs font-medium text-[#6E4F59] mb-1">
                  Início
                </label>
                <input
                  id="blk-start"
                  type="time"
                  required
                  value={blkStart}
                  onChange={(e) => setBlkStart(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="blk-end" className="block text-xs font-medium text-[#6E4F59] mb-1">
                  Término
                </label>
                <input
                  id="blk-end"
                  type="time"
                  required
                  value={blkEnd}
                  onChange={(e) => setBlkEnd(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm tabular-nums"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[46px] rounded-xl bg-[#350B19] text-white text-sm font-semibold hover:bg-[#4F172A] disabled:opacity-50"
          >
            {saving ? 'Salvando bloqueio...' : 'Salvar bloqueio na agenda'}
          </button>
        </form>
      </BottomSheet>

      {/* Manual Walk-In Booking Sheet */}
      <BottomSheet
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        title="Novo Horário / Encaixe"
        subtitle="Registre agendamentos fechados por WhatsApp ou presencialmente."
      >
        <form onSubmit={handleCreateWalkIn} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wi-name" className="block text-xs font-medium text-[#6E4F59] mb-1">
                Nome da cliente
              </label>
              <input
                id="wi-name"
                type="text"
                required
                value={wiName}
                onChange={(e) => setWiName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="wi-phone" className="block text-xs font-medium text-[#6E4F59] mb-1">
                WhatsApp
              </label>
              <input
                id="wi-phone"
                type="tel"
                required
                value={wiPhone}
                onChange={(e) => setWiPhone(maskPhoneBR(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wi-date" className="block text-xs font-medium text-[#6E4F59] mb-1">
                Data
              </label>
              <input
                id="wi-date"
                type="date"
                required
                value={wiDate}
                onChange={(e) => setWiDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="wi-start" className="block text-xs font-medium text-[#6E4F59] mb-1">
                Horário início
              </label>
              <input
                id="wi-start"
                type="time"
                required
                value={wiStart}
                onChange={(e) => setWiStart(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm tabular-nums"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-[#6E4F59] mb-2">Procedimentos</div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto bg-white border border-[#EBDCE0] rounded-xl p-2.5">
              {services.map((svc) => {
                const checked = wiServiceIds.includes(svc.id);
                return (
                  <label
                    key={svc.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#FAF4F5] text-sm"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setWiServiceIds((prev) =>
                            prev.includes(svc.id)
                              ? prev.filter((x) => x !== svc.id)
                              : [...prev, svc.id],
                          )
                        }
                        className="w-4 h-4 accent-[#D83F79]"
                      />
                      <span className="truncate">{svc.name}</span>
                    </span>
                    <span className="text-xs text-[#6E4F59] tabular-nums shrink-0">
                      {formatBRL(svc.price)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="wi-notes" className="block text-xs font-medium text-[#6E4F59] mb-1">
              Observações
            </label>
            <input
              id="wi-notes"
              type="text"
              maxLength={400}
              value={wiNotes}
              onChange={(e) => setWiNotes(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[#EBDCE0] bg-white px-3.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[46px] rounded-xl bg-[#D83F79] text-white text-sm font-semibold hover:bg-[#BD2D65] disabled:opacity-50"
          >
            {saving ? 'Confirmando horário...' : 'Confirmar horário na agenda'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
};
