import React, { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import type { Appointment, PersonalBlock, SalonSettings } from '../../types/salon';
import {
  formatBRL,
  formatDateBR,
  minutesToTime,
  statusLabelPT,
  timeToMinutes,
  todayISO,
} from '../../lib/utils';

interface AdminGoogleCalendarProps {
  appointments: Appointment[];
  blocks: PersonalBlock[];
  settings: SalonSettings;
  onSelectAppointment: (appointmentId: string) => void;
  onNewAppointmentForDate: (dateISO?: string) => void;
}

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const WEEKDAYS_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const WEEKDAYS_INITIAL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PASTEL_STYLES = [
  'bg-[#DCEBFF] border-[#B4D2FA] text-[#1E3A5F]',
  'bg-[#FFF0C2] border-[#F2D680] text-[#5C4409]',
  'bg-[#FAD9EE] border-[#EEB0D7] text-[#5E2349]',
  'bg-[#D7F5E5] border-[#A7E4C4] text-[#194D33]',
  'bg-[#FDE2C8] border-[#F4C294] text-[#5F3712]',
  'bg-[#E7E0FF] border-[#C9BBFA] text-[#352666]',
];

function addDays(dateISO: string, delta: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

function formatLongDateHeader(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS_FULL[dt.getDay()]}, ${d} de ${MONTHS_PT[m - 1]} de ${y}`;
}

export const AdminGoogleCalendar: React.FC<AdminGoogleCalendarProps> = ({
  appointments,
  blocks,
  settings,
  onSelectAppointment,
  onNewAppointmentForDate,
}) => {
  const today = todayISO();
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthCursor, setMonthCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });

  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const sundayOffset = -dt.getDay();
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(selectedDate, sundayOffset + i);
      const dayNum = Number(iso.split('-')[2]);
      return { iso, dayNum, initial: WEEKDAYS_INITIAL[i] };
    });
  }, [selectedDate]);

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

  const monthCells = useMemo(() => {
    const firstDay = new Date(monthCursor.year, monthCursor.month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(monthCursor.year, monthCursor.month + 1, 0).getDate();
    const cells: Array<{ dateISO: string; day: number } | null> = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(monthCursor.month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ dateISO: `${monthCursor.year}-${mm}-${dd}`, day: d });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor]);

  const timelineHours = useMemo(() => {
    const startH = Math.max(6, Math.floor(timeToMinutes(settings.openTime || '08:00') / 60));
    const endH = Math.min(22, Math.ceil(timeToMinutes(settings.closeTime || '20:00') / 60));
    const hours: number[] = [];
    for (let h = startH; h <= endH; h++) hours.push(h);
    return hours;
  }, [settings.openTime, settings.closeTime]);

  const selectedDayAppointments = appointmentsByDate.get(selectedDate) || [];
  const selectedDayBlocks = blocksByDate.get(selectedDate) || [];

  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const firstHourMin = (timelineHours[0] ?? 8) * 60;
  const lastHourMin = ((timelineHours[timelineHours.length - 1] ?? 20) + 1) * 60;
  const showNowLine =
    selectedDate === today && currentMinutes >= firstHourMin && currentMinutes <= lastHourMin;
  const ROW_HEIGHT = 64;
  const nowTopPx = ((currentMinutes - firstHourMin) / 60) * ROW_HEIGHT;

  const shiftWeek = (deltaDays: number) => {
    const next = addDays(selectedDate, deltaDays);
    setSelectedDate(next);
    const [ny, nm] = next.split('-').map(Number);
    setMonthCursor({ year: ny, month: nm - 1 });
  };

  const goToday = () => {
    setSelectedDate(today);
    const [y, m] = today.split('-').map(Number);
    setMonthCursor({ year: y, month: m - 1 });
  };

  const isMonthClosed = (settings.closedMonths || []).includes(selectedDate.slice(0, 7));

  return (
    <section className="w-full bg-white rounded-3xl border border-[#E8D6CB] overflow-hidden shadow-2xs relative">
      {/* Top Date Header + View Switcher */}
      <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-[#E8D6CB]/80 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-semibold text-[#594943] capitalize">
              {viewMode === 'day'
                ? formatLongDateHeader(selectedDate)
                : `${MONTHS_PT[monthCursor.month]} de ${monthCursor.year}`}
            </h2>
            {isMonthClosed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F2EAE4] text-[10px] font-semibold text-[#95847C]">
                <Lock className="w-3 h-3" />
                Mês fechado
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="inline-flex rounded-xl bg-[#FAF6F1] p-0.5 border border-[#E8D6CB]">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                viewMode === 'day' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                viewMode === 'month' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
              }`}
            >
              Mês
            </button>
          </div>

          <button
            type="button"
            onClick={goToday}
            className="min-h-[32px] px-2.5 py-1 rounded-xl bg-white border border-[#E8D6CB] text-xs font-semibold text-[#594943] hover:border-[#C4A477] cursor-pointer"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={() =>
              viewMode === 'day'
                ? shiftWeek(-7)
                : setMonthCursor((p) =>
                    p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 },
                  )
            }
            aria-label="Anterior"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-xl bg-white border border-[#E8D6CB] text-[#594943] hover:border-[#C4A477] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              viewMode === 'day'
                ? shiftWeek(7)
                : setMonthCursor((p) =>
                    p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 },
                  )
            }
            aria-label="Próximo"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-xl bg-white border border-[#E8D6CB] text-[#594943] hover:border-[#C4A477] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === 'day' ? (
        <>
          {/* 7-Day Week Strip (D S T Q Q S S) */}
          <div className="grid grid-cols-7 border-b border-[#E8D6CB] bg-[#FAF6F1]/40 py-2 px-2 sm:px-4">
            {weekDays.map((wd) => {
              const isSelected = wd.iso === selectedDate;
              const isToday = wd.iso === today;
              const hasApts = (appointmentsByDate.get(wd.iso) || []).length > 0;
              return (
                <button
                  key={wd.iso}
                  type="button"
                  onClick={() => setSelectedDate(wd.iso)}
                  className="flex flex-col items-center justify-center gap-1 py-1 cursor-pointer group"
                >
                  <span
                    className={`text-[11px] font-semibold ${
                      isSelected ? 'text-[#594943]' : 'text-[#95847C]'
                    }`}
                  >
                    {wd.initial}
                  </span>
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold tabular-nums transition-colors ${
                      isSelected
                        ? 'bg-[#594943] text-white shadow-xs'
                        : isToday
                          ? 'bg-[#F2EAE4] text-[#594943] ring-1 ring-[#C4A477]'
                          : 'text-[#594943] group-hover:bg-[#FAF6F1]'
                    }`}
                  >
                    {wd.dayNum}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      hasApts ? 'bg-[#C4A477]' : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Full-Screen Hourly Timeline (08:00 - 20:00) with Pastel Cards */}
          <div className="relative overflow-y-auto min-h-[62dvh] max-h-[76dvh] px-2 sm:px-5 py-3">
            <div
              className="relative"
              style={{ height: `${timelineHours.length * ROW_HEIGHT}px` }}
            >
              {/* Hourly Grid Rows */}
              {timelineHours.map((h, i) => {
                const label = `${String(h).padStart(2, '0')}:00`;
                return (
                  <div
                    key={h}
                    style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                    className="absolute inset-x-0 flex items-start"
                  >
                    <span className="w-12 sm:w-14 -mt-2 text-[11px] font-medium text-[#95847C] tabular-nums shrink-0">
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNewAppointmentForDate(selectedDate)}
                      title={`Agendar às ${label}`}
                      className="flex-1 h-full border-t border-[#E8D6CB]/70 hover:bg-[#FAF6F1]/50 transition-colors cursor-pointer text-left"
                    />
                  </div>
                );
              })}

              {/* Current Time Red Line */}
              {showNowLine && (
                <div
                  style={{ top: `${nowTopPx}px` }}
                  className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                >
                  <span className="w-12 sm:w-14 text-[10px] font-bold text-[#BE3B45] tabular-nums pr-1">
                    {currentTimeStr}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#BE3B45] -ml-1 shrink-0" />
                  <div className="flex-1 h-[2px] bg-[#BE3B45]" />
                </div>
              )}

              {/* Appointment Pastel Cards Positioned on Timeline */}
              {selectedDayAppointments.map((apt, idx) => {
                const startMin = timeToMinutes(apt.startTime);
                const endMin = Math.max(startMin + 30, timeToMinutes(apt.endTime || minutesToTime(startMin + 60)));
                const topPx = Math.max(0, ((startMin - firstHourMin) / 60) * ROW_HEIGHT);
                const heightPx = Math.max(46, ((endMin - startMin) / 60) * ROW_HEIGHT - 4);
                const palette = PASTEL_STYLES[idx % PASTEL_STYLES.length];
                return (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => onSelectAppointment(apt.id)}
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                    className={`absolute left-13 sm:left-16 right-2 z-10 rounded-xl border px-3 py-1.5 text-left shadow-xs hover:brightness-97 transition-all cursor-pointer overflow-hidden flex flex-col justify-center ${palette}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold truncate">
                        {apt.clientName}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums shrink-0 opacity-85">
                        {apt.startTime} · {formatBRL(apt.totalPrice)}
                      </span>
                    </div>
                    <div className="text-[11px] truncate opacity-90">
                      {(apt.serviceNames || []).join(' + ') || 'Procedimento'} · {statusLabelPT(apt.status)}
                    </div>
                  </button>
                );
              })}

              {/* Personal Blocks */}
              {selectedDayBlocks.map((blk) => {
                const startMin = blk.allDay ? firstHourMin : timeToMinutes(blk.startTime);
                const endMin = blk.allDay ? lastHourMin : Math.max(startMin + 30, timeToMinutes(blk.endTime));
                const topPx = Math.max(0, ((startMin - firstHourMin) / 60) * ROW_HEIGHT);
                const heightPx = Math.max(38, ((endMin - startMin) / 60) * ROW_HEIGHT - 4);
                return (
                  <div
                    key={blk.id}
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                    className="absolute left-13 sm:left-16 right-2 z-10 rounded-xl border border-[#E8D6CB] bg-[#F2EAE4]/90 px-3 py-1.5 text-xs text-[#594943] flex items-center justify-between"
                  >
                    <span className="font-semibold truncate">Bloqueio: {blk.title}</span>
                    <span className="text-[11px] text-[#95847C] tabular-nums shrink-0">
                      {blk.allDay ? 'Dia todo' : `${blk.startTime}–${blk.endTime}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating + Button (Bottom Right like mobile Google Calendar) */}
          <div className="px-4 py-3 border-t border-[#E8D6CB] bg-[#FAF6F1]/50 flex items-center justify-between gap-3">
            <span className="text-xs text-[#95847C]">
              {selectedDayAppointments.length === 0
                ? 'Toque em qualquer horário acima para agendar'
                : `${selectedDayAppointments.length} ${
                    selectedDayAppointments.length === 1 ? 'atendimento' : 'atendimentos'
                  } em ${formatDateBR(selectedDate)}`}
            </span>
            <button
              type="button"
              onClick={() => onNewAppointmentForDate(selectedDate)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[#594943] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#433631] transition-colors cursor-pointer shrink-0"
            >
              <CalendarPlus className="w-4 h-4 text-[#C4A477]" />
              <span>Novo Horário</span>
            </button>
          </div>
        </>
      ) : (
        /* Month Overview Grid */
        <div>
          <div className="grid grid-cols-7 border-b border-[#E8D6CB] bg-[#FAF6F1]/40">
            {WEEKDAYS_SHORT.map((w) => (
              <div
                key={w}
                className="py-2 text-center text-[11px] font-semibold text-[#95847C] uppercase"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[#E8D6CB]/70">
            {monthCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`m-empty-${idx}`} className="min-h-[68px] sm:min-h-[92px] bg-[#FAF6F1]/30" />;
              }
              const dayApts = appointmentsByDate.get(cell.dateISO) || [];
              const isToday = cell.dateISO === today;
              const isSelected = cell.dateISO === selectedDate;
              return (
                <button
                  key={cell.dateISO}
                  type="button"
                  onClick={() => {
                    setSelectedDate(cell.dateISO);
                    setViewMode('day');
                  }}
                  className={`min-h-[68px] sm:min-h-[92px] p-1.5 text-left flex flex-col justify-between cursor-pointer ${
                    isSelected ? 'bg-[#F2EAE4]/80' : 'bg-white hover:bg-[#FAF6F1]/60'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums ${
                      isToday ? 'bg-[#594943] text-white' : 'text-[#594943]'
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="hidden sm:flex flex-col gap-0.5 mt-1 w-full overflow-hidden">
                    {dayApts.slice(0, 2).map((apt, i) => (
                      <div
                        key={apt.id}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border ${
                          PASTEL_STYLES[i % PASTEL_STYLES.length]
                        }`}
                      >
                        {apt.startTime} {apt.clientName.split(' ')[0]}
                      </div>
                    ))}
                    {dayApts.length > 2 && (
                      <span className="text-[10px] text-[#95847C] font-semibold">
                        +{dayApts.length - 2}
                      </span>
                    )}
                  </div>
                  <div className="sm:hidden flex items-center justify-center gap-0.5">
                    {dayApts.slice(0, 3).map((apt) => (
                      <span key={apt.id} className="w-1.5 h-1.5 rounded-full bg-[#C4A477]" />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
