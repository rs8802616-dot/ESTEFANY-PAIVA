import React, { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import type { Appointment, PersonalBlock, SalonSettings } from '../../types/salon';
import { formatBRL, formatDateBR, statusLabelPT, todayISO } from '../../lib/utils';

interface AdminGoogleCalendarProps {
  appointments: Appointment[];
  blocks: PersonalBlock[];
  settings: SalonSettings;
  onSelectAppointment: (appointmentId: string) => void;
  onNewAppointmentForDate: (dateISO?: string) => void;
}

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const AdminGoogleCalendar: React.FC<AdminGoogleCalendarProps> = ({
  appointments,
  blocks,
  settings,
  onSelectAppointment,
  onNewAppointmentForDate,
}) => {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedDate, setSelectedDate] = useState(today);

  const monthCells = useMemo(() => {
    const firstDay = new Date(cursor.year, cursor.month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: Array<{ dateISO: string; day: number } | null> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(cursor.month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({
        dateISO: `${cursor.year}-${mm}-${dd}`,
        day: d,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [cursor]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((apt) => {
      if (apt.status === 'cancelled') return;
      const list = map.get(apt.date) || [];
      list.push(apt);
      map.set(apt.date, list);
    });
    map.forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [appointments]);

  const blocksByDate = useMemo(() => {
    const map = new Map<string, PersonalBlock[]>();
    blocks.forEach((b) => {
      const list = map.get(b.date) || [];
      list.push(b);
      map.set(b.date, list);
    });
    return map;
  }, [blocks]);

  const goPrevMonth = () => {
    setCursor((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 },
    );
  };

  const goNextMonth = () => {
    setCursor((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 },
    );
  };

  const goToday = () => {
    const [y, m] = today.split('-').map(Number);
    setCursor({ year: y, month: m - 1 });
    setSelectedDate(today);
  };

  const selectedDayAppointments = appointmentsByDate.get(selectedDate) || [];
  const selectedDayBlocks = blocksByDate.get(selectedDate) || [];
  const isMonthClosed = (settings.closedMonths || []).includes(
    `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`,
  );

  return (
    <section className="w-full bg-white rounded-3xl border border-[#E8D6CB] overflow-hidden shadow-2xs">
      {/* Calendar Header (Google Calendar Style) */}
      <div className="px-4 sm:px-6 py-4 border-b border-[#E8D6CB] flex flex-wrap items-center justify-between gap-3 bg-[#FAF6F1]/70">
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-lg sm:text-xl font-semibold text-[#594943]">
            {MONTHS_PT[cursor.month]} {cursor.year}
          </h2>
          {isMonthClosed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F2EAE4] border border-[#E8D6CB] text-[11px] font-semibold text-[#95847C]">
              <Lock className="w-3 h-3" />
              Mês fechado p/ clientes
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={goToday}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-[#E8D6CB] text-xs font-semibold text-[#594943] hover:border-[#C4A477] transition-colors cursor-pointer"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="Mês anterior"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-white border border-[#E8D6CB] text-[#594943] hover:border-[#C4A477] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="Próximo mês"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-white border border-[#E8D6CB] text-[#594943] hover:border-[#C4A477] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7-Column Weekday Header */}
      <div className="grid grid-cols-7 border-b border-[#E8D6CB] bg-[#FAF6F1]/40">
        {WEEKDAYS_SHORT.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-[11px] sm:text-xs font-semibold text-[#95847C] uppercase tracking-wider"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Full-Width Calendar Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-[#E8D6CB]/70">
        {monthCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="min-h-[68px] sm:min-h-[108px] bg-[#FAF6F1]/30" />;
          }

          const dayApts = appointmentsByDate.get(cell.dateISO) || [];
          const dayBlks = blocksByDate.get(cell.dateISO) || [];
          const isToday = cell.dateISO === today;
          const isSelected = cell.dateISO === selectedDate;
          const isBlockedDay = (settings.blockedDates || []).includes(cell.dateISO);

          return (
            <button
              key={cell.dateISO}
              type="button"
              onClick={() => setSelectedDate(cell.dateISO)}
              className={`min-h-[68px] sm:min-h-[108px] p-1 sm:p-2 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#F2EAE4]/80 ring-2 ring-inset ring-[#C4A477]'
                  : 'bg-white hover:bg-[#FAF6F1]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums ${
                    isToday
                      ? 'bg-[#594943] text-white'
                      : isSelected
                        ? 'bg-[#C4A477] text-white'
                        : 'text-[#594943]'
                  }`}
                >
                  {cell.day}
                </span>
                {isBlockedDay && (
                  <span className="text-[9px] font-bold text-[#BE9293] uppercase hidden sm:inline">
                    Folga
                  </span>
                )}
              </div>

              {/* Desktop / Tablet Event Pills */}
              <div className="hidden sm:flex flex-col gap-1 mt-1.5 w-full overflow-hidden">
                {dayApts.slice(0, 3).map((apt) => {
                  const chipColor =
                    apt.status === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                      : apt.status === 'completed'
                        ? 'bg-[#E8D6CB] text-[#594943] border-[#C4A477]/40'
                        : 'bg-amber-100 text-amber-900 border-amber-200';
                  return (
                    <div
                      key={apt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAppointment(apt.id);
                      }}
                      className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold truncate ${chipColor}`}
                    >
                      {apt.startTime} {apt.clientName.split(' ')[0]}
                    </div>
                  );
                })}
                {dayApts.length > 3 && (
                  <span className="text-[10px] font-semibold text-[#95847C] pl-1">
                    +{dayApts.length - 3} mais
                  </span>
                )}
                {dayApts.length === 0 && dayBlks.length > 0 && (
                  <div className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] truncate">
                    {dayBlks[0].title}
                  </div>
                )}
              </div>

              {/* Mobile Compact Dots */}
              <div className="sm:hidden flex items-center justify-center gap-0.5 mt-1 min-h-[12px]">
                {dayApts.slice(0, 3).map((apt) => (
                  <span
                    key={apt.id}
                    className={`w-1.5 h-1.5 rounded-full ${
                      apt.status === 'confirmed'
                        ? 'bg-emerald-600'
                        : apt.status === 'completed'
                          ? 'bg-[#594943]'
                          : 'bg-amber-500'
                    }`}
                  />
                ))}
                {dayApts.length > 3 && (
                  <span className="text-[9px] font-bold text-[#594943] ml-0.5">
                    +{dayApts.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Agenda Bar */}
      <div className="p-4 sm:p-5 bg-[#FAF6F1]/70 border-t border-[#E8D6CB] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-[#95847C]">
              {selectedDate === today ? 'Hoje' : formatDateBR(selectedDate)}
            </span>
            <h3 className="text-base font-semibold text-[#594943]">
              {selectedDayAppointments.length === 0
                ? 'Nenhum horário marcado neste dia'
                : `${selectedDayAppointments.length} ${
                    selectedDayAppointments.length === 1 ? 'atendimento' : 'atendimentos'
                  }`}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNewAppointmentForDate(selectedDate)}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#594943] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#433631] transition-colors cursor-pointer"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-[#C4A477]" />
            <span>Agendar neste dia</span>
          </button>
        </div>

        {selectedDayBlocks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedDayBlocks.map((b) => (
              <span
                key={b.id}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#E8D6CB] text-xs text-[#95847C]"
              >
                Bloqueio: {b.title} ({b.allDay ? 'Dia todo' : `${b.startTime}–${b.endTime}`})
              </span>
            ))}
          </div>
        )}

        {selectedDayAppointments.length > 0 && (
          <div className="divide-y divide-[#E8D6CB] bg-white rounded-2xl border border-[#E8D6CB] overflow-hidden">
            {selectedDayAppointments.map((apt) => (
              <button
                key={apt.id}
                type="button"
                onClick={() => onSelectAppointment(apt.id)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#FAF6F1]/60 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#594943] tabular-nums">
                      {apt.startTime}–{apt.endTime}
                    </span>
                    <span className="text-xs font-medium text-[#95847C]">
                      · {statusLabelPT(apt.status)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#594943] truncate">
                    {apt.clientName} — {(apt.serviceNames || []).join(' + ') || 'Procedimento'}
                  </div>
                </div>
                <span className="text-sm font-semibold text-[#594943] tabular-nums shrink-0">
                  {formatBRL(apt.totalPrice)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
