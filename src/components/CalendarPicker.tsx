import React, { useMemo, useState } from 'react';
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

  const blockedDateSet = useMemo(
    () => new Set(settings.blockedDates || []),
    [settings.blockedDates],
  );

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
      cells.push({
        iso,
        day,
        disabled: isPast || isClosedDay || isBlocked,
        isBlocked,
      });
    }
    return cells;
  }, [viewYear, viewMonth, today, settings.workDays, blockedDateSet]);

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
      <div className="bg-white rounded-2xl border border-[#EBDCE0] p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#350B19] hover:bg-[#FAF4F5] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-[#350B19]">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Próximo mês"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#350B19] hover:bg-[#FAF4F5] transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-[11px] font-medium text-[#6E4F59] py-1">
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
                    ? 'bg-[#350B19] text-white shadow-sm'
                    : cell.disabled
                      ? 'text-[#6E4F59]/30 cursor-not-allowed'
                      : isToday
                        ? 'bg-[#F7E2EA] text-[#350B19] font-semibold hover:bg-[#D83F79]/20'
                        : 'text-[#2A0E17] hover:bg-[#FAF4F5]'
                }`}
              >
                <span>{cell.day}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration-Aware Time Slots */}
      <div className="bg-white rounded-2xl border border-[#EBDCE0] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#350B19]">
            <Clock className="w-4 h-4 text-[#D83F79]" />
            <span>Horários disponíveis</span>
          </div>
          <span className="text-xs text-[#6E4F59] tabular-nums">
            Duração {formatDuration(durationMinutes)} · {availableCount} livres
          </span>
        </div>

        {!selectedDate ? (
          <p className="text-sm text-[#6E4F59] py-4 text-center">
            Selecione uma data no calendário acima.
          </p>
        ) : isSelectedBlocked ? (
          <p className="text-sm text-[#6E4F59] py-4 text-center">
            Data marcada como folga na agenda do estúdio. Escolha outro dia disponível.
          </p>
        ) : timeSlots.length === 0 ? (
          <p className="text-sm text-[#6E4F59] py-4 text-center">
            O estúdio não atende neste dia da semana. Escolha outra data.
          </p>
        ) : availableCount === 0 ? (
          <p className="text-sm text-[#6E4F59] py-4 text-center">
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
                      ? 'bg-[#D83F79] text-white border-[#D83F79] shadow-sm'
                      : slot.available
                        ? 'bg-[#FAF4F5] text-[#350B19] border-[#EBDCE0] hover:border-[#D83F79] hover:bg-white'
                        : 'bg-[#FAF4F5]/60 text-[#6E4F59]/35 border-transparent line-through cursor-not-allowed'
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
