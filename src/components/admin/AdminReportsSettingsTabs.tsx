import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarOff,
  Clock,
  Download,
  ImagePlus,
  Plus,
  Printer,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { SafeImage } from '../SafeImage';
import { useToast } from '../Toast';
import { LuxuryDonutChart } from '../ui/LuxuryDesignSystem';
import { adminSaveSettings } from '../../lib/db';
import { STUDIO_IMAGES, STUDIO_IMAGE_PRESETS } from '../../lib/defaults';
import {
  compressImageToDataUrl,
  daysBetween,
  downloadCSVReport,
  formatBRL,
  formatDateBR,
  minutesToTime,
  statusLabelPT,
  timeToMinutes,
  todayISO,
} from '../../lib/utils';
import type { Appointment, SalonSettings } from '../../types/salon';

const WEEKDAY_OPTS = [
  { day: 0, label: 'Dom' },
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
  { day: 6, label: 'Sáb' },
];

type ReportPeriod = '7d' | '30d' | '6m' | 'all';

export const AdminReportsTab: React.FC<{ appointments: Appointment[] }> = ({ appointments }) => {
  const [period, setPeriod] = useState<ReportPeriod>('30d');
  const today = todayISO();

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      if (period === 'all') return true;
      const diff = daysBetween(a.date, today);
      if (period === '7d') return diff >= -1 && diff <= 7;
      if (period === '30d') return diff >= -7 && diff <= 30;
      if (period === '6m') return diff >= -14 && diff <= 183;
      return true;
    });
  }, [appointments, period, today]);

  const validRevenueApts = useMemo(
    () => filtered.filter((a) => a.status === 'confirmed' || a.status === 'completed'),
    [filtered],
  );

  const cancelledApts = useMemo(
    () => filtered.filter((a) => a.status === 'cancelled'),
    [filtered],
  );

  const totalRevenue = useMemo(
    () => validRevenueApts.reduce((sum, a) => sum + a.totalPrice, 0),
    [validRevenueApts],
  );

  const completedRevenue = useMemo(
    () =>
      filtered
        .filter((a) => a.status === 'completed')
        .reduce((sum, a) => sum + a.totalPrice, 0),
    [filtered],
  );

  const avgTicket = validRevenueApts.length > 0 ? totalRevenue / validRevenueApts.length : 0;

  const byService = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    validRevenueApts.forEach((a) => {
      const share = a.serviceNames.length > 0 ? a.totalPrice / a.serviceNames.length : 0;
      a.serviceNames.forEach((name) => {
        const prev = map.get(name) || { count: 0, revenue: 0 };
        map.set(name, { count: prev.count + 1, revenue: prev.revenue + share });
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [validRevenueApts]);

  const byPaymentMethodSlices = useMemo(() => {
    let pixTotal = 0;
    let presencialTotal = 0;
    validRevenueApts.forEach((a) => {
      if (a.paymentMethod === 'pix') pixTotal += a.totalPrice;
      else presencialTotal += a.totalPrice;
    });
    return [
      { label: 'Pix Online', value: pixTotal, color: '#C4A477' },
      { label: 'Presencial no Studio', value: presencialTotal, color: '#594943' },
    ];
  }, [validRevenueApts]);

  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; visits: number; total: number }>();
    validRevenueApts.forEach((a) => {
      const key = a.clientPhone || a.clientName;
      const cur = map.get(key) || { name: a.clientName, visits: 0, total: 0 };
      cur.visits += 1;
      cur.total += a.totalPrice;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [validRevenueApts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#594943]">
            Relatórios Financeiros
          </h1>
          <p className="text-sm text-[#95847C]">
            Indicadores 100% reais calculados sobre os agendamentos registrados no Firestore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCSVReport(filtered, `estefany-nails-relatorio-${period}-${today}.csv`)
            }
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#E8D6CB] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#594943] hover:border-[#C4A477]"
          >
            <Download className="w-4 h-4 text-[#C4A477]" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#594943] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#433631]"
          >
            <Printer className="w-4 h-4 text-[#C4A477]" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Period Filter (PRD v36: 7 dias, 30 dias, 6 meses, Todo o período) */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white border border-[#E8D6CB] no-print">
        {(
          [
            { id: '7d', label: '7 dias' },
            { id: '30d', label: '30 dias' },
            { id: '6m', label: '6 meses' },
            { id: 'all', label: 'Todo o período' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPeriod(item.id)}
            className={`min-h-[38px] rounded-lg px-3.5 text-xs font-medium transition-colors ${
              period === item.id
                ? 'bg-[#594943] text-white'
                : 'text-[#95847C] hover:text-[#594943]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* KPI Strip (PRD v36: Faturamento, Atendimentos, Ticket Médio, Cancelados) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4">
          <div className="text-xs text-[#95847C]">Faturamento</div>
          <div className="mt-1 text-2xl font-semibold text-[#594943] tabular-nums">
            {formatBRL(totalRevenue)}
          </div>
          <div className="mt-0.5 text-[11px] text-emerald-700 tabular-nums">
            {formatBRL(completedRevenue)} concluído
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4">
          <div className="text-xs text-[#95847C]">Atendimentos</div>
          <div className="mt-1 text-2xl font-semibold text-[#594943] tabular-nums">
            {validRevenueApts.length}
          </div>
          <div className="mt-0.5 text-[11px] text-[#95847C]">Confirmados e concluídos</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4">
          <div className="text-xs text-[#95847C]">Ticket Médio</div>
          <div className="mt-1 text-2xl font-semibold text-[#594943] tabular-nums">
            {formatBRL(avgTicket)}
          </div>
          <div className="mt-0.5 text-[11px] text-[#95847C]">Média por reserva válida</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4">
          <div className="text-xs text-[#95847C]">Cancelados</div>
          <div className="mt-1 text-2xl font-semibold text-[#C4A477] tabular-nums">
            {cancelledApts.length}
          </div>
          <div className="mt-0.5 text-[11px] text-[#95847C]">
            {filtered.length > 0
              ? `${Math.round((cancelledApts.length / filtered.length) * 100)}% do período`
              : 'Sem registros'}
          </div>
        </div>
      </div>

      {/* Gráficos de Rosca: Forma de Pagamento + Ranking de Clientes VIP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LuxuryDonutChart
          title="Faturamento por Forma de Pagamento"
          subtitle="Comparativo entre reservas Pix e pagamento presencial"
          centerLabel="Pagamentos"
          slices={byPaymentMethodSlices}
        />

        <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-3 shadow-2xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
              Fidelidade & LTV
            </span>
            <h2 className="font-editorial text-xl font-semibold text-[#594943]">
              Top Clientes VIP do Período
            </h2>
          </div>
          {topClients.length === 0 ? (
            <p className="text-xs text-[#95847C] py-6 text-center">
              Nenhuma cliente com atendimento confirmado neste período.
            </p>
          ) : (
            <div className="divide-y divide-[#E8D6CB]/70">
              {topClients.map((c, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#594943] text-[#FAF6F1] text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#594943] truncate">{c.name}</div>
                      <div className="text-[11px] text-[#95847C]">{c.visits} visita(s)</div>
                    </div>
                  </div>
                  <strong className="text-sm text-[#594943] tabular-nums shrink-0">
                    {formatBRL(c.total)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Procedure Ranking */}
      {byService.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-3">
          <h2 className="font-editorial text-2xl font-semibold text-[#594943]">
            Ranking de Procedimentos
          </h2>
          <div className="divide-y divide-[#E8D6CB]">
            {byService.map(([name, stat], idx) => (
              <div key={name} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-semibold text-[#C4A477] w-5 shrink-0 tabular-nums">
                    {idx + 1}.
                  </span>
                  <span className="text-[#594943] truncate">{name}</span>
                </div>
                <span className="font-mono text-xs font-semibold text-[#594943] tabular-nums shrink-0">
                  {stat.count} {stat.count === 1 ? 'atendimento' : 'atendimentos'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Ledger Table */}
      <div className="bg-white rounded-2xl border border-[#E8D6CB] overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[#E8D6CB] text-[#95847C]">
              <th className="py-3 px-4 font-medium">Data</th>
              <th className="py-3 px-4 font-medium">Cliente</th>
              <th className="py-3 px-4 font-medium">Procedimentos</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8D6CB]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#95847C]">
                  Sem registros neste período.
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="hover:bg-[#FAF6F1]/50">
                  <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                    {formatDateBR(a.date)} {a.startTime}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#594943]">{a.clientName}</td>
                  <td className="py-3 px-4 text-[#95847C]">{a.serviceNames.join(' + ')}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{statusLabelPT(a.status)}</td>
                  <td className="py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap">
                    {formatBRL(a.totalPrice)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminSettingsTab: React.FC<{ settings: SalonSettings }> = ({ settings }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<SalonSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('18:30');
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const toggleWorkDay = (day: number) => {
    setForm((prev) => {
      const exists = prev.workDays.includes(day);
      if (exists && prev.workDays.length <= 1) return prev;
      return {
        ...prev,
        workDays: exists
          ? prev.workDays.filter((d) => d !== day)
          : [...prev.workDays, day].sort((a, b) => a - b),
      };
    });
  };

  const handleAddConfiguredSlot = () => {
    if (!/^\d{2}:\d{2}$/.test(newSlotTime)) return;
    setForm((prev) => {
      const current = prev.configuredSlots || [];
      if (current.includes(newSlotTime)) return prev;
      return {
        ...prev,
        configuredSlots: [...current, newSlotTime].sort(),
      };
    });
  };

  const handleRemoveConfiguredSlot = (slot: string) => {
    setForm((prev) => ({
      ...prev,
      configuredSlots: (prev.configuredSlots || []).filter((s) => s !== slot),
    }));
  };

  const handleRegenerateSlotsFromHours = () => {
    const start = timeToMinutes(form.openTime);
    const end = timeToMinutes(form.closeTime);
    const step = Math.max(15, form.slotIntervalMinutes || 30);
    const generated: string[] = [];
    for (let m = start; m < end; m += step) {
      generated.push(minutesToTime(m));
    }
    setForm((prev) => ({ ...prev, configuredSlots: generated.slice(0, 48) }));
    showToast('Grade de horários gerada conforme expediente.');
  };

  const handleAddBlockedDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newBlockedDate)) return;
    setForm((prev) => {
      const current = prev.blockedDates || [];
      if (current.includes(newBlockedDate)) return prev;
      return {
        ...prev,
        blockedDates: [...current, newBlockedDate].sort(),
      };
    });
    setNewBlockedDate('');
  };

  const handleRemoveBlockedDate = (dateISO: string) => {
    setForm((prev) => ({
      ...prev,
      blockedDates: (prev.blockedDates || []).filter((d) => d !== dateISO),
    }));
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'avatarImage' | 'heroImageUrl',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const maxWidth = field === 'avatarImage' ? 480 : 1080;
      const compressed = await compressImageToDataUrl(file, maxWidth, 0.8);
      setForm((prev) => ({ ...prev, [field]: compressed }));
      showToast('Foto otimizada! Clique em "Salvar ajustes" para publicar.');
    } catch {
      showToast('Não foi possível processar a imagem selecionada.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminSaveSettings(form);
      showToast('Configurações do estúdio salvas na nuvem.');
    } catch {
      showToast('Erro ao salvar configurações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-editorial text-3xl font-semibold text-[#594943]">
          Ajustes do Estúdio
        </h1>
        <p className="text-sm text-[#95847C]">
          Perfil profissional, fotos, chave Pix, meta mensal, regra de remarcação, grade de horários e dias de folga.
        </p>
      </div>

      {/* Identity & Professional Bio */}
      <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
        <h2 className="font-editorial text-2xl font-semibold text-[#594943]">
          Identidade & Perfil Profissional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="st-name" className="block text-xs font-medium text-[#95847C] mb-1">
              Nome do estúdio
            </label>
            <input
              id="st-name"
              type="text"
              required
              maxLength={80}
              value={form.studioName}
              onChange={(e) => setForm({ ...form, studioName: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="st-owner" className="block text-xs font-medium text-[#95847C] mb-1">
              Nome da profissional
            </label>
            <input
              id="st-owner"
              type="text"
              maxLength={80}
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="st-ig" className="block text-xs font-medium text-[#95847C] mb-1">
              Instagram
            </label>
            <input
              id="st-ig"
              type="text"
              maxLength={60}
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="st-wa" className="block text-xs font-medium text-[#95847C] mb-1">
              WhatsApp (DDI 55 + DDD)
            </label>
            <input
              id="st-wa"
              type="text"
              maxLength={30}
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm tabular-nums"
            />
          </div>
        </div>

        <div>
          <label htmlFor="st-bio" className="block text-xs font-medium text-[#95847C] mb-1">
            Bio curta do topo do Portal da Cliente
          </label>
          <textarea
            id="st-bio"
            rows={2}
            maxLength={260}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 p-3 text-sm"
          />
        </div>

        <div>
          <label htmlFor="st-addr" className="block text-xs font-medium text-[#95847C] mb-1">
            Endereço completo
          </label>
          <input
            id="st-addr"
            type="text"
            maxLength={200}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="st-hero" className="block text-xs font-medium text-[#95847C] mb-1">
            Título editorial da capa
          </label>
          <input
            id="st-hero"
            type="text"
            maxLength={120}
            value={form.heroTitle}
            onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
            className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm"
          />
        </div>
      </div>

      {/* Profile Photo & Hero Banner Photo (PRD v36) */}
      <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-5">
        <h2 className="font-editorial text-2xl font-semibold text-[#594943]">
          Fotos do Estúdio (Perfil & Capa)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Avatar */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-[#95847C]">Foto de Perfil (Avatar)</div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C4A477]/40 bg-[#FAF6F1] shrink-0">
                <SafeImage
                  src={form.avatarImage}
                  alt="Prévia do perfil"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handlePhotoUpload(e, 'avatarImage')}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#594943] px-3.5 text-xs font-semibold text-white hover:bg-[#433631]"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>Enviar foto</span>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, avatarImage: STUDIO_IMAGES.ownerPortrait }))
                    }
                    className="text-[11px] font-medium text-[#95847C] hover:text-[#C4A477] underline"
                  >
                    Usar retrato padrão
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Banner */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-[#95847C]">Banner Principal do Portal</div>
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#E8D6CB] bg-[#FAF6F1]">
              <SafeImage
                src={form.heroImageUrl}
                alt="Prévia do banner"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={heroInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handlePhotoUpload(e, 'heroImageUrl')}
              />
              <button
                type="button"
                onClick={() => heroInputRef.current?.click()}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#594943] px-3.5 text-xs font-semibold text-white hover:bg-[#433631]"
              >
                <ImagePlus className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Enviar banner</span>
              </button>
              <select
                aria-label="Escolher imagem padrão do banner"
                value={
                  STUDIO_IMAGE_PRESETS.some((p) => p.url === form.heroImageUrl)
                    ? form.heroImageUrl
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) {
                    setForm((prev) => ({ ...prev, heroImageUrl: e.target.value }));
                  }
                }}
                className="min-h-[40px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-xs text-[#594943]"
              >
                <option value="">Galeria do estúdio...</option>
                {STUDIO_IMAGE_PRESETS.map((preset) => (
                  <option key={preset.url} value={preset.url}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Pix, Financial Goal & Reschedule Policy */}
      <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
        <h2 className="font-editorial text-2xl font-semibold text-[#594943]">
          Pix, Meta Mensal & Remarcação
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="st-pixkey" className="block text-xs font-medium text-[#95847C] mb-1">
              Chave Pix (CPF, CNPJ, E-mail, Celular ou Aleatória)
            </label>
            <input
              id="st-pixkey"
              type="text"
              maxLength={120}
              value={form.pixKey}
              onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="st-pixname" className="block text-xs font-medium text-[#95847C] mb-1">
              Nome do recebedor (sem acentos)
            </label>
            <input
              id="st-pixname"
              type="text"
              maxLength={80}
              value={form.pixName}
              onChange={(e) => setForm({ ...form, pixName: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="st-pixcity" className="block text-xs font-medium text-[#95847C] mb-1">
              Cidade Pix
            </label>
            <input
              id="st-pixcity"
              type="text"
              maxLength={60}
              value={form.pixCity}
              onChange={(e) => setForm({ ...form, pixCity: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="st-deposit" className="block text-xs font-medium text-[#95847C] mb-1">
              Sinal Pix (%) — 100 para valor integral
            </label>
            <input
              id="st-deposit"
              type="number"
              min={0}
              max={100}
              value={form.depositPercent}
              onChange={(e) => setForm({ ...form, depositPercent: Number(e.target.value) })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="st-goal" className="block text-xs font-medium text-[#95847C] mb-1">
              Meta mensal de faturamento (R$)
            </label>
            <input
              id="st-goal"
              type="number"
              min={0}
              max={500000}
              step={100}
              value={form.monthlyGoal}
              onChange={(e) => setForm({ ...form, monthlyGoal: Number(e.target.value) })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="st-resched" className="block text-xs font-medium text-[#95847C] mb-1">
              Antecedência mínima para remarcação (horas)
            </label>
            <input
              id="st-resched"
              type="number"
              min={0}
              max={168}
              value={form.rescheduleMinHours}
              onChange={(e) => setForm({ ...form, rescheduleMinHours: Number(e.target.value) })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3.5 text-sm tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Working Hours, Configured Slots Grid & Blocked Dates (Folgas) */}
      <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-5">
        <h2 className="font-editorial text-2xl font-semibold text-[#594943]">
          Expediente, Grade de Horários & Folgas
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="st-open" className="block text-xs font-medium text-[#95847C] mb-1">
              Abertura
            </label>
            <input
              id="st-open"
              type="time"
              value={form.openTime}
              onChange={(e) => setForm({ ...form, openTime: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3 text-sm tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="st-close" className="block text-xs font-medium text-[#95847C] mb-1">
              Fechamento
            </label>
            <input
              id="st-close"
              type="time"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3 text-sm tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="st-step" className="block text-xs font-medium text-[#95847C] mb-1">
              Intervalo (min)
            </label>
            <select
              id="st-step"
              value={form.slotIntervalMinutes}
              onChange={(e) => setForm({ ...form, slotIntervalMinutes: Number(e.target.value) })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3 text-sm tabular-nums"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
          <div>
            <label htmlFor="st-ret" className="block text-xs font-medium text-[#95847C] mb-1">
              Alerta retorno (dias)
            </label>
            <input
              id="st-ret"
              type="number"
              min={7}
              max={90}
              value={form.returnAlertDays}
              onChange={(e) => setForm({ ...form, returnAlertDays: Number(e.target.value) })}
              className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3 text-sm tabular-nums"
            />
          </div>
        </div>

        {/* Workdays */}
        <div>
          <div className="text-xs font-medium text-[#95847C] mb-2">Dias de atendimento</div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTS.map((wd) => {
              const active = form.workDays.includes(wd.day);
              return (
                <button
                  key={wd.day}
                  type="button"
                  onClick={() => toggleWorkDay(wd.day)}
                  className={`min-h-[42px] min-w-[50px] rounded-xl px-3 text-xs font-semibold transition-colors border ${
                    active
                      ? 'bg-[#594943] text-white border-[#594943]'
                      : 'bg-white text-[#95847C] border-[#E8D6CB]'
                  }`}
                >
                  {wd.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Explicit Configured Slots Manager (PRD v36) */}
        <div className="pt-4 border-t border-[#E8D6CB] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-[#594943] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Grade de Horários Liberados ({form.configuredSlots?.length || 0})</span>
              </div>
              <p className="text-[11px] text-[#95847C]">
                Defina exatamente quais horários de início aparecem no Portal da Cliente (ex.: pule o almoço).
              </p>
            </div>
            <button
              type="button"
              onClick={handleRegenerateSlotsFromHours}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-xs font-medium text-[#594943] hover:border-[#C4A477] shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Gerar do expediente</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label="Novo horário na grade"
              value={newSlotTime}
              onChange={(e) => setNewSlotTime(e.target.value)}
              className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={handleAddConfiguredSlot}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[#594943] px-3.5 text-xs font-semibold text-white hover:bg-[#433631]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar horário</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(form.configuredSlots || []).map((slot) => (
              <span
                key={slot}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] pl-3 pr-1.5 py-1.5 text-xs font-semibold text-[#594943] tabular-nums"
              >
                <span>{slot}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveConfiguredSlot(slot)}
                  aria-label={`Remover horário ${slot}`}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[#95847C] hover:text-[#C4A477] hover:bg-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Blocked Dates / Folgas Manager (PRD v36) */}
        <div className="pt-4 border-t border-[#E8D6CB] space-y-3">
          <div>
            <div className="text-xs font-semibold text-[#594943] flex items-center gap-1.5">
              <CalendarOff className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Dias de Folga & Feriados ({form.blockedDates?.length || 0})</span>
            </div>
            <p className="text-[11px] text-[#95847C]">
              Datas cadastradas aqui ficam indisponíveis no calendário das clientes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Adicionar data de folga"
              value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
              className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/50 px-3 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={handleAddBlockedDate}
              disabled={!newBlockedDate}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[#594943] px-3.5 text-xs font-semibold text-white hover:bg-[#433631] disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bloquear data</span>
            </button>
          </div>

          {(form.blockedDates || []).length === 0 ? (
            <p className="text-xs text-[#95847C]">Nenhuma data de folga cadastrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(form.blockedDates || []).map((dateISO) => (
                <span
                  key={dateISO}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#C4A477]/30 bg-[#F2EAE4]/50 pl-3 pr-1.5 py-1.5 text-xs font-semibold text-[#594943] tabular-nums"
                >
                  <span>{formatDateBR(dateISO)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlockedDate(dateISO)}
                    aria-label={`Desbloquear ${formatDateBR(dateISO)}`}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[#95847C] hover:text-[#C4A477] hover:bg-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-[#C4A477] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#BE9293] disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        <span>{saving ? 'Salvando alterações...' : 'Salvar ajustes do estúdio'}</span>
      </button>
    </form>
  );
};
