import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { AvailabilitySlot, SalonSettings } from '../types/salon';
import { formatDuration, generateTimeSlotsForDate, todayISO } from '../lib/utils';

interface CalendarPickerProps {
  selectedDate: string;
  selectedTime: string;
  onSelectDate: (isoDate: string) => void;
  onSelectTime: (hhmm: string) => void;
  durationMinutes: number;
  settings: SalonSettings;
  busySlots: AvailabilitySlot[];
  ignoreSlotId?: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
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

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  durationMinutes,
  settings,
  busySlots,
  ignoreSlotId,
}) => {
  const today = todayISO();
  const [initY, initM] = (selectedDate || today).split('-').map(Number);
  const [viewYear, setViewYear] = useState(initY);
  const [viewMonth, setViewMonth] = useState(initM - 1);

  useEffect(() => {
    if (!selectedDate) return;
    const [y, m] = selectedDate.split('-').map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [selectedDate]);

  const blockedDateSet = useMemo(
    () => new Set(settings.blockedDates || []),
    [settings.blockedDates],
  );

  const closedMonthSet = useMemo(
    () => new Set(settings.closedMonths || []),
    [settings.closedMonths],
  );

  const viewMonthISO = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const isViewMonthClosed = closedMonthSet.has(viewMonthISO);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number; disabled: boolean; isBlocked: boolean } | null> =
      [];

    for (let i = 0; i < firstDay; i++) cells.push(null);

    for (let day = 1; day <= totalDays; day++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const weekday = new Date(viewYear, viewMonth, day).getDay();
      const isPast = iso < today;
      const isClosedDay = !settings.workDays.includes(weekday);
      const isBlocked = blockedDateSet.has(iso);
      const isClosedMonth = closedMonthSet.has(iso.slice(0, 7));
      cells.push({
        iso,
        day,
        disabled: isPast || isClosedDay || isBlocked || isClosedMonth,
        isBlocked: isBlocked || isClosedMonth,
      });
    }
    return cells;
  }, [viewYear, viewMonth, today, settings.workDays, blockedDateSet, closedMonthSet]);

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return generateTimeSlotsForDate(
      selectedDate,
      durationMinutes,
      settings,
      busySlots,
      ignoreSlotId,
    );
  }, [selectedDate, durationMinutes, settings, busySlots, ignoreSlotId]);

  const availableCount = useMemo(
    () => timeSlots.filter((s) => s.available).length,
    [timeSlots],
  );

  useEffect(() => {
    if (!selectedTime) return;
    const stillValid = timeSlots.some((s) => s.startTime === selectedTime && s.available);
    if (!stillValid) {
      onSelectTime('');
    }
  }, [selectedTime, timeSlots, onSelectTime]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isSelectedBlocked = selectedDate ? blockedDateSet.has(selectedDate) : false;

  return (
    <div className="space-y-5">
      {/* 7-Column Calendar Card */}
      <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#594943] hover:bg-[#FAF6F1] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-[#594943]">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Próximo mês"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#594943] hover:bg-[#FAF6F1] transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {isViewMonthClosed && (
          <div className="mb-3 rounded-xl bg-[#F2EAE4] border border-[#C4A477]/50 px-3 py-2 text-xs font-medium text-[#594943] text-center">
            A agenda de <strong>{MONTH_NAMES[viewMonth]} de {viewYear}</strong> ainda não foi aberta pela profissional.
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-[11px] font-medium text-[#95847C] py-1">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell) return <div key={`empty_${idx}`} />;
            const isSelected = cell.iso === selectedDate;
            const isToday = cell.iso === today;
            return (
              <button
                key={cell.iso}
                type="button"
                disabled={cell.disabled}
                title={cell.isBlocked ? 'Dia de folga / agenda fechada' : undefined}
                onClick={() => {
                  onSelectDate(cell.iso);
                  onSelectTime('');
                }}
                className={`min-h-[42px] rounded-xl text-sm tabular-nums font-medium transition-colors flex flex-col items-center justify-center ${
                  isSelected
                    ? 'bg-[#594943] text-white shadow-sm'
                    : cell.disabled
                      ? 'text-[#95847C]/30 cursor-not-allowed'
                      : isToday
                        ? 'bg-[#F2EAE4] text-[#594943] font-semibold hover:bg-[#C4A477]/20'
                        : 'text-[#594943] hover:bg-[#FAF6F1]'
                }`}
              >
                <span>{cell.day}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration-Aware Time Slots */}
      <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#594943]">
            <Clock className="w-4 h-4 text-[#C4A477]" />
            <span>Horários disponíveis</span>
          </div>
          <span className="text-xs text-[#95847C] tabular-nums">
            Duração {formatDuration(durationMinutes)} · {availableCount} livres
          </span>
        </div>

        {!selectedDate ? (
          <p className="text-sm text-[#95847C] py-4 text-center">
            Selecione uma data no calendário acima.
          </p>
        ) : isSelectedBlocked ? (
          <p className="text-sm text-[#95847C] py-4 text-center">
            Data marcada como folga na agenda do estúdio. Escolha outro dia disponível.
          </p>
        ) : timeSlots.length === 0 ? (
          <p className="text-sm text-[#95847C] py-4 text-center">
            O estúdio não atende neste dia da semana. Escolha outra data.
          </p>
        ) : availableCount === 0 ? (
          <p className="text-sm text-[#95847C] py-4 text-center">
            Sem horários livres compatíveis com {formatDuration(durationMinutes)} nesta data.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {timeSlots.map((slot) => {
              const isChosen = selectedTime === slot.startTime;
              return (
                <button
                  key={slot.startTime}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onSelectTime(slot.startTime)}
                  title={slot.available ? `${slot.startTime} até ${slot.endTime}` : slot.reason}
                  className={`min-h-[44px] rounded-xl px-2 py-2 text-sm font-medium tabular-nums transition-colors border ${
                    isChosen
                      ? 'bg-[#C4A477] text-white border-[#C4A477] shadow-sm'
                      : slot.available
                        ? 'bg-[#FAF6F1] text-[#594943] border-[#E8D6CB] hover:border-[#C4A477] hover:bg-white'
                        : 'bg-[#FAF6F1]/60 text-[#95847C]/35 border-transparent line-through cursor-not-allowed'
                  }`}
                >
                  {slot.startTime}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
