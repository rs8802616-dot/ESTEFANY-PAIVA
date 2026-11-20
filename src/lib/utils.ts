import type { Appointment, AvailabilitySlot, SalonSettings } from '../types/salon';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateBR(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateLongBR(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(dt);
}

export function daysBetween(earlierISO: string, laterISO: string): number {
  const [y1, m1, d1] = earlierISO.split('-').map(Number);
  const [y2, m2, d2] = laterISO.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((t2 - t1) / 86_400_000);
}

export function hoursUntilAppointment(dateISO: string, startTime: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = startTime.split(':').map(Number);
  const target = new Date(y, m - 1, d, hh || 0, mm || 0, 0);
  return (target.getTime() - Date.now()) / 3_600_000;
}

export function canRescheduleAppointment(
  appointment: Appointment,
  rescheduleMinHours: number,
): { allowed: boolean; hoursLeft: number; reason?: string } {
  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    return { allowed: false, hoursLeft: 0, reason: 'Atendimento já encerrado.' };
  }
  if ((appointment.rescheduleCount || 0) >= 10) {
    return { allowed: false, hoursLeft: 0, reason: 'Limite máximo de remarcações atingido.' };
  }
  const hoursLeft = hoursUntilAppointment(appointment.date, appointment.startTime);
  if (hoursLeft <= 0) {
    return { allowed: false, hoursLeft: 0, reason: 'Horário já iniciado ou passado.' };
  }
  const minHours = Math.max(0, Number(rescheduleMinHours) || 0);
  if (hoursLeft < minHours) {
    return {
      allowed: false,
      hoursLeft,
      reason: `Remarcação online permitida com no mínimo ${minHours}h de antecedência.`,
    };
  }
  return { allowed: true, hoursLeft };
}

export function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function maskPhoneBR(raw: string): string {
  const digits = sanitizePhone(raw).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface TimeSlotOption {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

/**
 * Intelligent duration-aware slot calculator.
 * Checks blockedDates (folgas), workingDays, configuredSlots (or open/close interval),
 * current time buffer (if today), and every busy slot (active appointments + personal blocks).
 */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return todayISO();
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function generateTimeSlotsForDate(
  dateISO: string,
  durationMinutes: number,
  settings: SalonSettings,
  busySlots: AvailabilitySlot[],
  ignoreSlotId?: string,
): TimeSlotOption[] {
  if (settings.closedMonths?.includes(dateISO.slice(0, 7))) {
    return [];
  }
  if (settings.blockedDates?.includes(dateISO)) {
    return [];
  }

  const [y, m, d] = dateISO.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  const weekday = targetDate.getDay();

  if (!(settings.workDays || []).includes(weekday)) {
    return [];
  }

  const openMin = timeToMinutes(settings.openTime);
  const closeMin = timeToMinutes(settings.closeTime);
  const step = Math.max(15, settings.slotIntervalMinutes || 30);
  const required = Math.max(15, durationMinutes);

  const now = new Date();
  const isToday = dateISO === todayISO();
  const currentMinWithBuffer = now.getHours() * 60 + now.getMinutes() + 30;

  const dayBusy = busySlots
    .filter((slot) => slot.active && slot.date === dateISO && slot.id !== ignoreSlotId)
    .map((slot) => ({
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime),
      kind: slot.kind,
    }));

  // Candidate start minutes: use explicit configuredSlots when defined, else openTime..closeTime step
  const candidateStarts: number[] =
    settings.configuredSlots && settings.configuredSlots.length > 0
      ? [...settings.configuredSlots]
          .filter((s) => /^\d{2}:\d{2}$/.test(s))
          .map(timeToMinutes)
          .filter((start) => start + required <= closeMin)
          .sort((a, b) => a - b)
      : (() => {
          const list: number[] = [];
          for (let start = openMin; start + required <= closeMin; start += step) {
            list.push(start);
          }
          return list;
        })();

  const uniqueStarts = Array.from(new Set(candidateStarts));

  return uniqueStarts.map((start) => {
    const end = start + required;
    let available = true;
    let reason: string | undefined;

    if (isToday && start < currentMinWithBuffer) {
      available = false;
      reason = 'Horário encerrado';
    } else {
      for (const busy of dayBusy) {
        if (start < busy.end && end > busy.start) {
          available = false;
          reason = busy.kind === 'block' ? 'Bloqueio agenda' : 'Ocupado';
          break;
        }
      }
    }

    return {
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      available,
      reason,
    };
  });
}

function formatEMVField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function normalizeAscii(text: string, maxLen: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 .\-@]/g, '')
    .trim()
    .slice(0, maxLen);
}

function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function normalizePixKeyBACEN(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const digits = trimmed.replace(/\D/g, '');
  // Se contém parênteses ou espaço (ex: "(61) 98554-3452") ou 10/11 dígitos de telefone celular
  if (trimmed.startsWith('+') || trimmed.includes('(') || digits.length === 10) {
    const cleanPhone = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
    return `+${cleanPhone}`;
  }
  if (digits.length === 11) {
    // 11 dígitos com 3º dígito 9 e DDD válido (11..99) sem pontos de CPF -> Telefone celular
    if (!trimmed.includes('.') && digits[2] === '9') {
      return `+55${digits}`;
    }
    return digits;
  }
  if (digits.length === 14) {
    return digits;
  }
  return trimmed;
}

export function generatePixPayload(params: {
  pixKey: string;
  pixName: string;
  pixCity: string;
  amount: number;
  txid?: string;
}): string {
  const key = normalizePixKeyBACEN(params.pixKey);
  if (!key) return '';
  const merchantName = normalizeAscii(params.pixName || 'ESTEFANY PAIVA', 25).toUpperCase();
  const merchantCity = normalizeAscii(params.pixCity || 'SAO PAULO', 15).toUpperCase();
  const txid = normalizeAscii(params.txid || 'EPNAILS', 25).replace(/\s+/g, '') || 'EPNAILS';

  const merchantAccount =
    formatEMVField('00', 'br.gov.bcb.pix') + formatEMVField('01', key);

  const amountStr = params.amount > 0 ? params.amount.toFixed(2) : '';

  const base =
    formatEMVField('00', '01') +
    formatEMVField('26', merchantAccount) +
    formatEMVField('52', '0000') +
    formatEMVField('53', '986') +
    (amountStr ? formatEMVField('54', amountStr) : '') +
    formatEMVField('58', 'BR') +
    formatEMVField('59', merchantName) +
    formatEMVField('60', merchantCity) +
    formatEMVField('62', formatEMVField('05', txid)) +
    '6304';

  return base + crc16ccitt(base);
}

export function calculatePixChargeAmount(totalPrice: number, depositPercent: number): number {
  const pct = Number(depositPercent) || 0;
  if (pct > 0 && pct < 100) {
    return Math.round(totalPrice * (pct / 100) * 100) / 100;
  }
  return totalPrice;
}

export function buildWhatsAppUrl(rawPhone: string, message: string): string {
  const digits = sanitizePhone(rawPhone);
  const full = digits.startsWith('55') || digits.length > 11 ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export function getAdminWhatsAppTemplates(appointment: Appointment, settings: SalonSettings) {
  const dateLabel = formatDateBR(appointment.date);
  const servicesLabel = appointment.serviceNames.join(' + ');
  const chargeAmount = calculatePixChargeAmount(appointment.totalPrice, settings.depositPercent);

  return [
    {
      id: 'reminder',
      label: 'Lembrete',
      description: 'Confirma data, hora e procedimento',
      text: `Oi, ${appointment.clientName}! Passando só pra confirmar seu horário aqui no ${settings.studioName} no dia ${dateLabel}, às ${appointment.startTime} (${servicesLabel}). Endereço: ${settings.address}. Te espero!`,
    },
    {
      id: 'pix',
      label: 'Enviar Pix',
      description: 'Envia chave Pix e valor do sinal/serviço',
      text: `Oi, ${appointment.clientName}! Pra confirmar seu horário de ${dateLabel} às ${appointment.startTime}, segue a chave Pix (${settings.pixKey}) no valor de ${formatBRL(chargeAmount)}. Assim que fizer, me manda o comprovante por aqui.`,
    },
    {
      id: 'thanks',
      label: 'Pós-Atendimento',
      description: 'Agradece a visita e pede feedback',
      text: `Oi, ${appointment.clientName}! Obrigada por vir hoje no ${settings.studioName}. Gostou do resultado? Depois me conta! E lembra de marcar sua manutenção em uns ${settings.returnAlertDays} dias.`,
    },
  ];
}

export function buildReturnAlertWhatsAppUrl(
  clientName: string,
  clientPhone: string,
  daysSince: number,
  settings: SalonSettings,
): string {
  const msg = `Oi, ${clientName}! Tudo bem? Vi aqui que já faz ${daysSince} dias desde a sua última vez no ${settings.studioName}. Vamos marcar sua manutenção pra deixar as unhas em dia?`;
  return buildWhatsAppUrl(clientPhone, msg);
}

export function buildUpcomingMaintenanceWhatsAppUrl(
  clientName: string,
  clientPhone: string,
  daysRemaining: number,
  serviceName: string,
  settings: SalonSettings,
): string {
  const whenText =
    daysRemaining <= 0
      ? 'já tá na hora'
      : daysRemaining === 1
        ? 'falta 1 dia'
        : `faltam ${daysRemaining} dias`;
  const msg = `Oi, ${clientName}! Tudo bem? Só passando pra avisar que ${whenText} pra sua manutenção de ${serviceName} aqui no ${settings.studioName}. Quer que eu já deixe um horário separado pra você?`;
  return buildWhatsAppUrl(clientPhone, msg);
}

export function buildGoogleCalendarUrl(appointment: Appointment, settings: SalonSettings): string {
  const [y, m, d] = appointment.date.split('-');
  const startClean = appointment.startTime.replace(':', '') + '00';
  const endClean = appointment.endTime.replace(':', '') + '00';
  const dates = `${y}${m}${d}T${startClean}/${y}${m}${d}T${endClean}`;
  const title = `${settings.studioName} — ${appointment.serviceNames.join(' + ')}`;
  const details = `Agendamento em ${settings.studioName}. Valor total: ${formatBRL(appointment.totalPrice)}.`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details,
    location: settings.address,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadICSFile(appointment: Appointment, settings: SalonSettings): void {
  const [y, m, d] = appointment.date.split('-');
  const startClean = appointment.startTime.replace(':', '') + '00';
  const endClean = appointment.endTime.replace(':', '') + '00';
  const uid = `${appointment.id}@estefanypaivanails`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Estefany Paiva Nails//Agenda//PT',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${y}${m}${d}T${startClean}`,
    `DTEND:${y}${m}${d}T${endClean}`,
    `SUMMARY:${settings.studioName} - ${appointment.serviceNames.join(' + ')}`,
    `DESCRIPTION:Procedimentos: ${appointment.serviceNames.join(', ')} | Total: ${formatBRL(appointment.totalPrice)}`,
    `LOCATION:${settings.address}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `estefany-nails-${appointment.date}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSVReport(appointments: Appointment[], filename: string): void {
  const headers = [
    'Data',
    'Início',
    'Fim',
    'Cliente',
    'Telefone',
    'Procedimentos',
    'Duração (min)',
    'Valor (BRL)',
    'Pagamento',
    'Pix Pago',
    'Status',
  ];
  const escapeCell = (val: string | number | boolean) =>
    `"${String(val).replace(/"/g, '""')}"`;

  const rows = appointments.map((a) =>
    [
      formatDateBR(a.date),
      a.startTime,
      a.endTime,
      a.clientName,
      a.clientPhone,
      a.serviceNames.join(' + '),
      a.totalDurationMinutes,
      a.totalPrice.toFixed(2).replace('.', ','),
      a.paymentMethod === 'pix' ? 'Pix' : 'Presencial',
      a.pixPaid ? 'Sim' : 'Não',
      statusLabelPT(a.status),
    ]
      .map(escapeCell)
      .join(';'),
  );

  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function compressImageToDataUrl(
  file: File,
  maxWidth = 720,
  quality = 0.78,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponível.'));
          return;
        }
        const tryEncode = (scaleFactor: number, q: number): string => {
          const w = Math.max(1, Math.round(img.width * scale * scaleFactor));
          const h = Math.max(1, Math.round(img.height * scale * scaleFactor));
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL('image/jpeg', q);
        };

        let dataUrl = tryEncode(1, quality);
        const attempts: Array<[number, number]> = [
          [1, 0.62],
          [0.8, 0.55],
          [0.65, 0.5],
          [0.5, 0.45],
        ];
        for (const [sf, q] of attempts) {
          if (dataUrl.length <= 220_000) break;
          dataUrl = tryEncode(sf, q);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function statusLabelPT(status: Appointment['status']): string {
  switch (status) {
    case 'pending':
      return 'Pendente';
    case 'confirmed':
      return 'Confirmado';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
  }
}

export function makeSafeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function generateSecureToken(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
  const bytes = new Uint8Array(28);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function makeClientNoteId(phone: string): string {
  const digits = sanitizePhone(phone);
  return `cli_${digits || 'sem_tel'}`.slice(0, 64);
}
