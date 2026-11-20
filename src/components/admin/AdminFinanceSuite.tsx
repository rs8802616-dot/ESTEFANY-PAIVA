import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Banknote,
  Calculator,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  LuxuryGaugeCard,
  LuxuryKpiCard,
  LuxuryStateView,
  type ScreenUiState,
} from '../ui/LuxuryDesignSystem';
import {
  adminUpdateAppointmentStatus,
} from '../../lib/db';
import {
  downloadCSVReport,
  formatBRL,
  formatDateBR,
  statusLabelPT,
  todayISO,
} from '../../lib/utils';
import type { Appointment, SalonSettings } from '../../types/salon';

export type FinanceSubScreen =
  | 'resumo_financeiro'      // 17
  | 'receitas'               // 18
  | 'despesas'               // 19
  | 'fluxo_caixa'            // 20
  | 'contas_pagar_receber'   // 21
  | 'fechamento_mensal'      // 22
  | 'relatorios_gerais'      // 23
  | 'relatorios_desempenho'; // 24

type PeriodFilter = 'weekly' | 'monthly_weeks' | 'semester' | 'all';
type MainChartType = 'area' | 'bar' | 'line';
type DonutMode = 'revenues' | 'expenses';
type ServiceMetric = 'revenue' | 'count';
type EntryKind = 'in' | 'out';

interface ExpenseItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  paid: boolean;
  weekdayOverride?: number;
}

interface ManualRevenueItem {
  id: string;
  description: string;
  category?: string;
  paymentMethod?: string;
  amount: number;
  date: string;
  received: boolean;
  weekdayOverride?: number;
}

const EXPENSES_KEY = 'epn_luxury_expenses_v45';
const REVENUES_KEY = 'epn_luxury_manual_revenues_v45';
const DONUT_PALETTE = ['#594943', '#C4A477', '#BE9293', '#95847C', '#D6B99B', '#7D675E'];

function getRecentWeekdayISO(targetWeekday: number): string {
  const now = new Date();
  const currentDay = now.getDay();
  const diff = targetWeekday - currentDay;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const INITIAL_EXPENSES: ExpenseItem[] = [
  { id: 'exp_1', description: 'Kit Gel Construtor Nude & Top Coat', category: 'Insumos', amount: 245, date: getRecentWeekdayISO(1), paid: true, weekdayOverride: 1 },
  { id: 'exp_2', description: 'Lixas, Brocas Diamantadas e Descartáveis', category: 'Materiais', amount: 130, date: getRecentWeekdayISO(2), paid: true, weekdayOverride: 2 },
  { id: 'exp_3', description: 'Energia & Internet do Studio', category: 'Estrutura', amount: 190, date: getRecentWeekdayISO(3), paid: true, weekdayOverride: 3 },
  { id: 'exp_4', description: 'Embalagens Luxury & Mimos Clientes', category: 'Marketing', amount: 95, date: getRecentWeekdayISO(5), paid: true, weekdayOverride: 5 },
  { id: 'exp_5', description: 'Reposição Fibra de Vidro Premium', category: 'Insumos', amount: 180, date: getRecentWeekdayISO(6), paid: false, weekdayOverride: 6 },
];

const INITIAL_MANUAL_REVENUES: ManualRevenueItem[] = [
  { id: 'rev_1', description: 'Alongamento Fibra de Vidro — Cliente VIP', category: 'Procedimento', paymentMethod: 'Pix', amount: 220, date: getRecentWeekdayISO(1), received: true, weekdayOverride: 1 },
  { id: 'rev_2', description: 'Banho de Gel + Blindagem Diamante', category: 'Procedimento', paymentMethod: 'Pix', amount: 280, date: getRecentWeekdayISO(2), received: true, weekdayOverride: 2 },
  { id: 'rev_3', description: 'Manutenção Fibra + Esmaltação em Gel', category: 'Procedimento', paymentMethod: 'Cartão', amount: 340, date: getRecentWeekdayISO(3), received: true, weekdayOverride: 3 },
  { id: 'rev_4', description: 'Combo Alongamento + Spa das Mãos', category: 'Procedimento', paymentMethod: 'Pix', amount: 410, date: getRecentWeekdayISO(4), received: true, weekdayOverride: 4 },
  { id: 'rev_5', description: 'Dia da Noiva & Madrinhas Luxury Nude', category: 'Procedimento', paymentMethod: 'Pix', amount: 620, date: getRecentWeekdayISO(5), received: true, weekdayOverride: 5 },
  { id: 'rev_6', description: 'Sábado Premium — 4 Atendimentos', category: 'Procedimento', paymentMethod: 'Pix', amount: 740, date: getRecentWeekdayISO(6), received: true, weekdayOverride: 6 },
];

function loadExpenses(): ExpenseItem[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    return raw ? (JSON.parse(raw) as ExpenseItem[]) : INITIAL_EXPENSES;
  } catch {
    return INITIAL_EXPENSES;
  }
}

function loadManualRevenues(): ManualRevenueItem[] {
  try {
    const raw = localStorage.getItem(REVENUES_KEY);
    return raw ? (JSON.parse(raw) as ManualRevenueItem[]) : INITIAL_MANUAL_REVENUES;
  } catch {
    return INITIAL_MANUAL_REVENUES;
  }
}

const LuxuryRechartsTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-2xl bg-[#594943] text-[#FAF6F1] px-3.5 py-2.5 shadow-xl border border-[#C4A477]/40 text-xs space-y-1">
      {label && <div className="font-bold text-[#C4A477]">{label}</div>}
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color || '#C4A477' }}
            />
            {entry.name}:
          </span>
          <strong>
            {String(entry.name || '').includes('Qtd')
              ? `${entry.value ?? 0} un`
              : formatBRL(Number(entry.value || 0))}
          </strong>
        </div>
      ))}
    </div>
  );
};

export const AdminFinanceSuite: React.FC<{
  appointments: Appointment[];
  settings: SalonSettings;
  initialSubScreen?: FinanceSubScreen;
  onSelectSubScreen?: (sub: FinanceSubScreen) => void;
}> = ({ appointments, settings, initialSubScreen }) => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => loadExpenses());
  const [manualRevenues, setManualRevenues] = useState<ManualRevenueItem[]>(() => loadManualRevenues());
  const [uiState, setUiState] = useState<ScreenUiState>('idle');

  // Controles únicos de gráficos
  const [period, setPeriod] = useState<PeriodFilter>('weekly');
  const [mainChartType, setMainChartType] = useState<MainChartType>('area');
  const [donutMode, setDonutMode] = useState<DonutMode>('revenues');
  const [serviceMetric, setServiceMetric] = useState<ServiceMetric>('revenue');
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  // Formulário único unificado (Receita ou Despesa)
  const [entryKind, setEntryKind] = useState<EntryKind>('in');
  const [entryDesc, setEntryDesc] = useState('');
  const [entryCat, setEntryCat] = useState('Procedimento');
  const [entryPayOrStatus, setEntryPayOrStatus] = useState('Pix');
  const [entryVal, setEntryVal] = useState('');
  const [entryDate, setEntryDate] = useState(todayISO());

  // Calculadora de Precificação & Ganho por Hora
  const [calcServiceName, setCalcServiceName] = useState('Alongamento em Fibra de Vidro');
  const [calcPrice, setCalcPrice] = useState(180);
  const [calcMaterialCost, setCalcMaterialCost] = useState(28);
  const [calcDurationMin, setCalcDurationMin] = useState(120);
  const [calcFeePercent, setCalcFeePercent] = useState(4);

  // Scroll suave caso o usuário venha do Mapa das 33 Telas
  useEffect(() => {
    if (!initialSubScreen) return;
    const anchorMap: Record<FinanceSubScreen, string> = {
      resumo_financeiro: 'fin-kpis',
      receitas: 'fin-lancamentos',
      despesas: 'fin-lancamentos',
      fluxo_caixa: 'fin-graficos',
      contas_pagar_receber: 'fin-pendencias',
      fechamento_mensal: 'fin-fechamento',
      relatorios_gerais: 'fin-extrato',
      relatorios_desempenho: 'fin-desempenho',
    };
    const el = document.getElementById(anchorMap[initialSubScreen]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [initialSubScreen]);

  const saveExpensesList = (next: ExpenseItem[]) => {
    setExpenses(next);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(next));
  };

  const saveRevenuesList = (next: ManualRevenueItem[]) => {
    setManualRevenues(next);
    localStorage.setItem(REVENUES_KEY, JSON.stringify(next));
  };

  const handleRestoreSampleData = () => {
    saveExpensesList(INITIAL_EXPENSES);
    saveRevenuesList(INITIAL_MANUAL_REVENUES);
    setUiState('success');
    setTimeout(() => setUiState('idle'), 2000);
  };

  const handleClearManualData = () => {
    saveExpensesList([]);
    saveRevenuesList([]);
  };

  const realizedAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'confirmed' || a.status === 'completed'),
    [appointments],
  );

  const pendingAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'pending'),
    [appointments],
  );

  const totalAppRevenue = useMemo(
    () => realizedAppointments.reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0),
    [realizedAppointments],
  );

  const totalManualRevenue = useMemo(
    () => manualRevenues.filter((r) => r.received).reduce((acc, r) => acc + r.amount, 0),
    [manualRevenues],
  );

  const totalRevenue = totalAppRevenue + totalManualRevenue;

  const totalPaidExpenses = useMemo(
    () => expenses.filter((e) => e.paid).reduce((acc, e) => acc + e.amount, 0),
    [expenses],
  );

  const totalPendingExpenses = useMemo(
    () => expenses.filter((e) => !e.paid).reduce((acc, e) => acc + e.amount, 0),
    [expenses],
  );

  const pendingReceivables = useMemo(
    () => pendingAppointments.reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0),
    [pendingAppointments],
  );

  const netProfit = totalRevenue - totalPaidExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const goalPct =
    settings.monthlyGoal > 0
      ? Math.min(100, Math.round((totalRevenue / settings.monthlyGoal) * 100))
      : 0;

  const totalServicesCount = realizedAppointments.length + manualRevenues.length;
  const avgTicket = totalServicesCount > 0 ? totalRevenue / totalServicesCount : 165;

  // Dados para Recharts (Curva de Área, Barras, Linha)
  const timelineData = useMemo(() => {
    if (period === 'weekly') {
      const days = [
        { day: 1, label: 'Seg' },
        { day: 2, label: 'Ter' },
        { day: 3, label: 'Qua' },
        { day: 4, label: 'Qui' },
        { day: 5, label: 'Sex' },
        { day: 6, label: 'Sáb' },
      ];
      const revByDay = new Map<number, number>();
      const expByDay = new Map<number, number>();

      realizedAppointments.forEach((apt) => {
        const [y, m, d] = apt.date.split('-').map(Number);
        if (!y || !m || !d) return;
        const wd = new Date(y, m - 1, d).getDay();
        revByDay.set(wd, (revByDay.get(wd) || 0) + (Number(apt.totalPrice) || 0));
      });

      manualRevenues.forEach((rev) => {
        if (!rev.received) return;
        let wd = rev.weekdayOverride;
        if (!wd) {
          const [y, m, d] = rev.date.split('-').map(Number);
          if (y && m && d) wd = new Date(y, m - 1, d).getDay();
        }
        if (wd) revByDay.set(wd, (revByDay.get(wd) || 0) + rev.amount);
      });

      expenses.forEach((ex) => {
        if (!ex.paid) return;
        let wd = ex.weekdayOverride;
        if (!wd) {
          const [y, m, d] = ex.date.split('-').map(Number);
          if (y && m && d) wd = new Date(y, m - 1, d).getDay();
        }
        if (wd) expByDay.set(wd, (expByDay.get(wd) || 0) + ex.amount);
      });

      return days.map(({ day, label }) => {
        const entradas = Math.round(revByDay.get(day) || 0);
        const saidas = Math.round(expByDay.get(day) || 0);
        return { label, entradas, saidas, saldo: entradas - saidas };
      });
    }

    if (period === 'monthly_weeks') {
      const weeks = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
      const revW = [0, 0, 0, 0];
      const expW = [0, 0, 0, 0];

      realizedAppointments.forEach((apt) => {
        const dayNum = Number(apt.date.split('-')[2]) || 1;
        const wIdx = Math.min(3, Math.floor((dayNum - 1) / 7));
        revW[wIdx] += Number(apt.totalPrice) || 0;
      });
      manualRevenues.forEach((rev, idx) => {
        if (!rev.received) return;
        revW[idx % 4] += rev.amount;
      });
      expenses.forEach((ex, idx) => {
        if (!ex.paid) return;
        expW[idx % 4] += ex.amount;
      });

      return weeks.map((label, i) => ({
        label,
        entradas: Math.round(revW[i]),
        saidas: Math.round(expW[i]),
        saldo: Math.round(revW[i] - expW[i]),
      }));
    }

    const months = ['Mês -5', 'Mês -4', 'Mês -3', 'Mês -2', 'Anterior', 'Atual'];
    const baseRev = Math.max(totalRevenue, 1200);
    const baseExp = Math.max(totalPaidExpenses, 350);
    const factors = [0.62, 0.71, 0.78, 0.85, 0.93, 1.0];
    return months.map((label, idx) => {
      const entradas = idx === 5 ? Math.round(totalRevenue) : Math.round(baseRev * factors[idx]);
      const saidas = idx === 5 ? Math.round(totalPaidExpenses) : Math.round(baseExp * factors[idx]);
      return { label, entradas, saidas, saldo: entradas - saidas };
    });
  }, [period, realizedAppointments, manualRevenues, expenses, totalRevenue, totalPaidExpenses]);

  // Ranking Horizontal de Procedimentos para Recharts BarChart (layout="vertical")
  const servicePerformance = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    realizedAppointments.forEach((apt) => {
      const name = (apt.serviceNames || []).join(' + ') || 'Procedimento';
      const cur = map.get(name) || { name, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(apt.totalPrice) || 0;
      map.set(name, cur);
    });
    manualRevenues.forEach((rev) => {
      if (!rev.received) return;
      const name = rev.description.split('—')[0].trim();
      const cur = map.get(name) || { name, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += rev.amount;
      map.set(name, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => (serviceMetric === 'revenue' ? b.revenue - a.revenue : b.count - a.count))
      .slice(0, 7);
  }, [realizedAppointments, manualRevenues, serviceMetric]);

  // Donut Slices para Recharts PieChart
  const donutData = useMemo(() => {
    if (donutMode === 'expenses') {
      const map = new Map<string, number>();
      expenses.forEach((ex) => {
        map.set(ex.category, (map.get(ex.category) || 0) + ex.amount);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }

    const map = new Map<string, number>();
    if (totalAppRevenue > 0) map.set('Agenda Online', totalAppRevenue);
    manualRevenues.forEach((r) => {
      if (!r.received) return;
      const key = `${r.paymentMethod || 'Pix'}`;
      map.set(key, (map.get(key) || 0) + r.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [donutMode, expenses, totalAppRevenue, manualRevenues]);

  const donutTotal = useMemo(
    () => donutData.reduce((acc, d) => acc + d.value, 0),
    [donutData],
  );

  // Horários de Pico do Studio (Estilo AtendeJá)
  const hourlyPeakData = useMemo(() => {
    const hours = ['08h', '09h', '10h', '11h', '13h', '14h', '15h', '16h', '17h', '18h'];
    const counts = new Map<string, number>();
    hours.forEach((h) => counts.set(h, 0));

    realizedAppointments.forEach((a) => {
      const hh = `${a.startTime.slice(0, 2)}h`;
      if (counts.has(hh)) {
        counts.set(hh, (counts.get(hh) || 0) + 1);
      } else {
        // Agrupa 12h em 11h ou 19h em 18h para manter faixa limpa
        const num = Number(a.startTime.slice(0, 2));
        const nearest = num <= 12 ? '11h' : '18h';
        counts.set(nearest, (counts.get(nearest) || 0) + 1);
      }
    });

    return hours.map((hora) => ({
      hora,
      atendimentos: counts.get(hora) || 0,
    }));
  }, [realizedAppointments]);

  const peakHourObj = useMemo(() => {
    const sorted = [...hourlyPeakData].sort((a, b) => b.atendimentos - a.atendimentos);
    return sorted[0] || { hora: '14h', atendimentos: 0 };
  }, [hourlyPeakData]);

  // Vendas por Forma de Pagamento com Barras de Progresso (Estilo AtendeJá)
  const paymentMethodsBreakdown = useMemo(() => {
    let pixVal = 0;
    let cardVal = 0;
    let cashVal = 0;

    realizedAppointments.forEach((a) => {
      if (a.paymentMethod === 'pix') pixVal += a.totalPrice;
      else cashVal += a.totalPrice;
    });
    manualRevenues.forEach((r) => {
      if (!r.received) return;
      if (r.paymentMethod === 'Cartão') cardVal += r.amount;
      else if (r.paymentMethod === 'Dinheiro') cashVal += r.amount;
      else pixVal += r.amount;
    });

    const total = Math.max(1, pixVal + cardVal + cashVal);
    return [
      {
        name: 'Pix (Imediato)',
        valor: pixVal,
        percent: Math.round((pixVal / total) * 100),
        color: '#C4A477',
        icon: QrCode,
      },
      {
        name: 'Cartão Crédito / Débito',
        valor: cardVal,
        percent: Math.round((cardVal / total) * 100),
        color: '#594943',
        icon: CreditCard,
      },
      {
        name: 'Presencial / Dinheiro',
        valor: cashVal,
        percent: Math.round((cashVal / total) * 100),
        color: '#BE9293',
        icon: Banknote,
      },
    ];
  }, [realizedAppointments, manualRevenues]);

  const searchedServices = useMemo(() => {
    const q = searchTableQuery.trim().toLowerCase();
    if (!q) return servicePerformance;
    return servicePerformance.filter((s) => s.name.toLowerCase().includes(q));
  }, [servicePerformance, searchTableQuery]);

  const handleCopyReport = () => {
    const topSvc = servicePerformance[0];
    const summary = [
      `📊 *RELATÓRIO EXECUTIVO — ${settings.studioName}*`,
      `📅 Período: ${period === 'weekly' ? 'Semana (Seg–Sáb)' : period === 'monthly_weeks' ? 'Mensal (4 Semanas)' : 'Semestre'}`,
      `💰 Receita Realizada: ${formatBRL(totalRevenue)}`,
      `💸 Despesas Pagas: ${formatBRL(totalPaidExpenses)}`,
      `✨ Lucro Líquido: ${formatBRL(netProfit)} (Margem ${profitMargin}%)`,
      `🎫 Ticket Médio: ${formatBRL(avgTicket)}`,
      topSvc ? `🏆 Serviço Líder: ${topSvc.name} (${formatBRL(topSvc.revenue)})` : '',
    ]
      .filter(Boolean)
      .join('\n');
    void navigator.clipboard.writeText(summary);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Top Clientes VIP
  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; visits: number; total: number }>();
    realizedAppointments.forEach((a) => {
      const key = a.clientPhone || a.clientName;
      const cur = map.get(key) || { name: a.clientName, visits: 0, total: 0 };
      cur.visits += 1;
      cur.total += a.totalPrice;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [realizedAppointments]);

  const handleUnifiedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(entryVal);
    if (!entryDesc.trim() || !amount || amount <= 0) {
      setUiState('error');
      return;
    }
    const targetDate = entryDate || todayISO();

    if (entryKind === 'in') {
      const item: ManualRevenueItem = {
        id: `rev_${Date.now()}`,
        description: entryDesc.trim(),
        category: entryCat,
        paymentMethod: entryPayOrStatus,
        amount,
        date: targetDate,
        received: true,
      };
      saveRevenuesList([item, ...manualRevenues]);
    } else {
      const item: ExpenseItem = {
        id: `exp_${Date.now()}`,
        description: entryDesc.trim(),
        category: entryCat,
        amount,
        date: targetDate,
        paid: entryPayOrStatus !== 'pending',
      };
      saveExpensesList([item, ...expenses]);
    }
    setEntryDesc('');
    setEntryVal('');
    setUiState('success');
    setTimeout(() => setUiState('idle'), 2200);
  };

  const exportConsolidatedCSV = () => {
    const rows = [
      ['Tipo', 'Data', 'Descricao', 'Valor (R$)', 'Status'],
      ...realizedAppointments.map((a) => [
        'Receita Atendimento',
        a.date,
        `${a.clientName} - ${a.serviceNames.join(' + ')}`,
        String(a.totalPrice),
        a.status,
      ]),
      ...manualRevenues.map((r) => [
        `Receita (${r.category || 'Procedimento'})`,
        r.date,
        r.description,
        String(r.amount),
        'Recebido',
      ]),
      ...expenses.map((ex) => [
        'Despesa',
        ex.date,
        `${ex.category}: ${ex.description}`,
        String(-ex.amount),
        ex.paid ? 'Pago' : 'Pendente',
      ]),
    ];
    const csv =
      '\uFEFF' +
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-luxury-nude-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculadora
  const calcFeeAmount = (calcPrice * calcFeePercent) / 100;
  const calcNetPerService = calcPrice - calcMaterialCost - calcFeeAmount;
  const calcMarginPct = calcPrice > 0 ? Math.round((calcNetPerService / calcPrice) * 100) : 0;
  const calcNetPerHour = calcDurationMin > 0 ? (calcNetPerService / calcDurationMin) * 60 : 0;
  const calcSuggested75Price =
    Math.ceil((calcMaterialCost / Math.max(0.1, 1 - 0.75 - calcFeePercent / 100)) / 5) * 5;

  return (
    <div className="space-y-6">
      {/* BARRA ÚNICA DE CONTROLE DO FINANCEIRO & RELATÓRIOS (SEM POLUIÇÃO) */}
      <div className="bg-white rounded-3xl border border-[#E8D6CB] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print shadow-2xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A477] block">
            Central Financeira Unificada • Telas 17 a 24
          </span>
          <h2 className="font-editorial text-2xl font-bold text-[#594943]">
            Financeiro, Gráficos & Relatórios
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Período */}
          <div className="inline-flex items-center rounded-xl bg-[#FAF6F1] p-1 border border-[#E8D6CB]">
            {(
              [
                { id: 'weekly', label: 'Seg–Sáb' },
                { id: 'monthly_weeks', label: 'Semanas' },
                { id: 'semester', label: '6 Meses' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  period === p.id ? 'bg-[#594943] text-white' : 'text-[#95847C] hover:text-[#594943]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRestoreSampleData}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F2EAE4] hover:bg-[#E8D6CB] text-[#594943] text-xs font-semibold border border-[#E8D6CB] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C4A477]" />
            <span>Exemplo</span>
          </button>

          {(manualRevenues.length > 0 || expenses.length > 0) && (
            <button
              type="button"
              onClick={handleClearManualData}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6F1] text-[#95847C] text-xs font-semibold border border-[#E8D6CB] cursor-pointer"
            >
              Zerar Manuais
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyReport}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] text-xs font-semibold text-[#594943] border border-[#E8D6CB] cursor-pointer"
          >
            {copiedReport ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4E7D5B]" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Copiar Resumo</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={exportConsolidatedCSV}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8D6CB] bg-white text-xs font-semibold text-[#594943] hover:border-[#C4A477] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#C4A477]" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#594943] text-xs font-semibold text-white hover:bg-[#433631] cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#C4A477]" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      <LuxuryStateView state={uiState} />

      {/* BLOCO 1: 4 KPIs EXECUTIVOS ÚNICOS */}
      <div id="fin-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <LuxuryKpiCard
          label="Receita Realizada"
          value={formatBRL(totalRevenue)}
          subtitle={`${totalServicesCount} atendimentos/lançamentos`}
          trend={`Ticket ${formatBRL(avgTicket)}`}
          trendPositive={true}
          accent="gold"
          icon={<ArrowUpRight className="w-4 h-4" />}
        />
        <LuxuryKpiCard
          label="Despesas Pagas"
          value={formatBRL(totalPaidExpenses)}
          subtitle={`${expenses.filter((e) => e.paid).length} custos quitados`}
          trend={
            totalRevenue > 0
              ? `${Math.round((totalPaidExpenses / totalRevenue) * 100)}% da receita`
              : '0%'
          }
          trendPositive={false}
          accent="rose"
          icon={<ArrowDownRight className="w-4 h-4" />}
        />
        <LuxuryKpiCard
          label="Lucro Líquido Real"
          value={formatBRL(netProfit)}
          subtitle={`A receber: +${formatBRL(pendingReceivables)}`}
          trend={`Margem ${profitMargin}%`}
          trendPositive={netProfit >= 0}
          accent="brown"
          icon={<Wallet className="w-4 h-4" />}
        />
        <LuxuryKpiCard
          label="Meta Mensal"
          value={`${goalPct}%`}
          subtitle={`Alvo: ${formatBRL(settings.monthlyGoal)}`}
          trend={goalPct >= 100 ? 'Meta Batida!' : `Faltam ${100 - goalPct}%`}
          trendPositive={goalPct >= 50}
          accent="nude"
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* BLOCO 2: GRÁFICO PRINCIPAL RECHARTS (ESTILO DELIVERY: ÁREA / BARRAS / LINHA) */}
      <div id="fin-graficos" className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8D6CB]/70 pb-4">
          <div>
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">
              Curva Financeira & Fluxo de Caixa (Entradas x Saídas)
            </h3>
            <p className="text-xs text-[#95847C]">
              Passe o dedo ou mouse sobre o gráfico para inspecionar os valores exatos.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl bg-[#FAF6F1] p-1 border border-[#E8D6CB] self-start sm:self-auto">
            {(
              [
                { id: 'area', label: 'Área' },
                { id: 'bar', label: 'Barras' },
                { id: 'line', label: 'Linha' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMainChartType(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  mainChartType === t.id
                    ? 'bg-[#594943] text-white'
                    : 'text-[#95847C] hover:text-[#594943]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-[300px] sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            {mainChartType === 'area' ? (
              <AreaChart data={timelineData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C4A477" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#C4A477" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#BE9293" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#BE9293" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D6CB" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#95847C"
                  tick={{ fill: '#594943', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  stroke="#95847C"
                  tick={{ fill: '#95847C', fontSize: 11 }}
                  tickFormatter={(v) => `R$${v}`}
                />
                <Tooltip content={<LuxuryRechartsTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="entradas"
                  name="Entradas (R$)"
                  stroke="#594943"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradEntradas)"
                  activeDot={{ r: 6, fill: '#C4A477', stroke: '#594943', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="saidas"
                  name="Saídas (R$)"
                  stroke="#BE9293"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradSaidas)"
                />
              </AreaChart>
            ) : mainChartType === 'bar' ? (
              <BarChart data={timelineData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D6CB" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#95847C"
                  tick={{ fill: '#594943', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  stroke="#95847C"
                  tick={{ fill: '#95847C', fontSize: 11 }}
                  tickFormatter={(v) => `R$${v}`}
                />
                <Tooltip content={<LuxuryRechartsTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '12px' }} />
                <Bar dataKey="entradas" name="Entradas (R$)" fill="#C4A477" radius={[8, 8, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas (R$)" fill="#BE9293" radius={[8, 8, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={timelineData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D6CB" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#95847C"
                  tick={{ fill: '#594943', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  stroke="#95847C"
                  tick={{ fill: '#95847C', fontSize: 11 }}
                  tickFormatter={(v) => `R$${v}`}
                />
                <Tooltip content={<LuxuryRechartsTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="entradas"
                  name="Entradas (R$)"
                  stroke="#594943"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#C4A477', stroke: '#594943', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="saidas"
                  name="Saídas (R$)"
                  stroke="#BE9293"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#BE9293' }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* BLOCO 3: TOP PROCEDIMENTOS HORIZONTAL (RECHARTS) + ROSCA (RECHARTS) */}
      <div id="fin-desempenho" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Procedimentos (7 colunas) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8D6CB]/70 pb-3">
            <div>
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                Top Procedimentos do Studio
              </h3>
              <p className="text-xs text-[#95847C]">Ranking horizontal por faturamento ou volume</p>
            </div>
            <div className="inline-flex rounded-xl bg-[#FAF6F1] p-1 border border-[#E8D6CB]">
              <button
                type="button"
                onClick={() => setServiceMetric('revenue')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  serviceMetric === 'revenue' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                }`}
              >
                R$ Faturamento
              </button>
              <button
                type="button"
                onClick={() => setServiceMetric('count')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  serviceMetric === 'count' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                }`}
              >
                Qtd
              </button>
            </div>
          </div>

          <div className="w-full h-[290px]">
            {servicePerformance.length === 0 ? (
              <LuxuryStateView state="empty" title="Sem procedimentos registrados ainda" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={servicePerformance}
                  margin={{ top: 5, right: 24, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8D6CB" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#95847C"
                    tick={{ fill: '#95847C', fontSize: 11 }}
                    tickFormatter={(v) => (serviceMetric === 'revenue' ? `R$${v}` : `${v}`)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={145}
                    stroke="#594943"
                    tick={{ fill: '#594943', fontSize: 11, fontWeight: 600 }}
                    tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
                  />
                  <Tooltip content={<LuxuryRechartsTooltip />} />
                  <Bar
                    dataKey={serviceMetric}
                    name={serviceMetric === 'revenue' ? 'Faturamento (R$)' : 'Qtd Atendimentos'}
                    fill="#C4A477"
                    radius={[0, 8, 8, 0]}
                  >
                    {servicePerformance.map((_, idx) => (
                      <Cell key={idx} fill={DONUT_PALETTE[idx % DONUT_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico de Rosca Recharts (5 colunas) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8D6CB]/70 pb-3">
            <div>
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                Composição em Rosca
              </h3>
              <p className="text-xs text-[#95847C]">Divisão por meio de pagamento ou custos</p>
            </div>
            <div className="inline-flex rounded-xl bg-[#FAF6F1] p-1 border border-[#E8D6CB]">
              <button
                type="button"
                onClick={() => setDonutMode('revenues')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  donutMode === 'revenues' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                }`}
              >
                Receitas
              </button>
              <button
                type="button"
                onClick={() => setDonutMode('expenses')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  donutMode === 'expenses' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                }`}
              >
                Despesas
              </button>
            </div>
          </div>

          <div className="relative w-full h-[220px]">
            {donutData.length === 0 ? (
              <LuxuryStateView state="empty" title="Sem dados nesta categoria" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={84}
                      paddingAngle={4}
                    >
                      {donutData.map((_, idx) => (
                        <Cell key={idx} fill={DONUT_PALETTE[idx % DONUT_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<LuxuryRechartsTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#95847C]">
                    Total Mix
                  </span>
                  <span className="text-sm font-bold text-[#594943] tabular-nums">
                    {formatBRL(donutTotal)}
                  </span>
                </div>
              </>
            )}
          </div>

          {donutData.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#E8D6CB]/70">
              {donutData.map((item, idx) => {
                const pct = donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0;
                const color = DONUT_PALETTE[idx % DONUT_PALETTE.length];
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-[#FAF6F1]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-[#594943] truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                      <span className="text-[#95847C] font-medium">{pct}%</span>
                      <strong className="text-[#594943]">{formatBRL(item.value)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* BLOCO 3B (ESTILO ATENDEJÁ): HORÁRIOS DE PICO DO STUDIO + VENDAS POR FORMA DE PAGAMENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8D6CB]/70">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#C4A477]" />
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                Horários de Pico do Studio
              </h3>
            </div>
            <span className="text-[11px] font-bold bg-[#F2EAE4] text-[#594943] px-2.5 py-1 rounded-full border border-[#E8D6CB]">
              Pico {peakHourObj.hora} ({peakHourObj.atendimentos} atend.)
            </span>
          </div>
          <p className="text-xs text-[#95847C]">
            Distribuição dos atendimentos por faixa horária para planejar sua agenda.
          </p>
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyPeakData} margin={{ top: 10, right: 10, left: -16, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D6CB" vertical={false} />
                <XAxis
                  dataKey="hora"
                  stroke="#95847C"
                  tick={{ fill: '#594943', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#95847C"
                  tick={{ fill: '#95847C', fontSize: 11 }}
                />
                <Tooltip content={<LuxuryRechartsTooltip />} />
                <Bar dataKey="atendimentos" name="Qtd Atendimentos" radius={[6, 6, 0, 0]}>
                  {hourlyPeakData.map((entry, idx) => (
                    <Cell
                      key={`hr-${idx}`}
                      fill={
                        entry.atendimentos >= 2
                          ? '#594943'
                          : entry.atendimentos === 1
                            ? '#C4A477'
                            : '#E8D6CB'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8D6CB]/70">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#C4A477]" />
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                Receitas por Forma de Pagamento
              </h3>
            </div>
            <span className="text-[11px] font-bold bg-[#F2EAE4] text-[#594943] px-2.5 py-1 rounded-full border border-[#E8D6CB]">
              Pix ({paymentMethodsBreakdown[0]?.percent || 0}%)
            </span>
          </div>
          <p className="text-xs text-[#95847C]">
            Resumo do que entrou pelos agendamentos e lançamentos manuais do caixa.
          </p>
          <div className="space-y-4 pt-1">
            {paymentMethodsBreakdown.map((item) => {
              const IconComp = item.icon;
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <IconComp className="w-4 h-4" style={{ color: item.color }} />
                      <span className="font-semibold text-[#594943]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 tabular-nums">
                      <span className="font-bold text-[#95847C]">{item.percent}%</span>
                      <strong className="text-[#594943]">{formatBRL(item.valor)}</strong>
                    </div>
                  </div>
                  <div className="w-full h-3 rounded-full bg-[#FAF6F1] border border-[#E8D6CB] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(item.valor > 0 ? 4 : 0, item.percent)}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BLOCO 3C (ESTILO ATENDEJÁ): TABELA ANALÍTICA DE PERFORMANCE COM BUSCA & RANK */}
      <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8D6CB]/70">
          <div>
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">
              Tabela Analítica de Performance de Serviços
            </h3>
            <p className="text-xs text-[#95847C]">
              Auditoria de faturamento individual por procedimento com ranking e participação.
            </p>
          </div>
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#95847C]" />
            <input
              type="text"
              value={searchTableQuery}
              onChange={(e) => setSearchTableQuery(e.target.value)}
              placeholder="Buscar serviço no ranking..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] text-[#594943]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#594943] text-[#FAF6F1] uppercase text-[11px]">
              <tr>
                <th className="p-3 rounded-tl-xl">Rank</th>
                <th className="p-3">Procedimento</th>
                <th className="p-3 text-right">Preço Médio</th>
                <th className="p-3 text-right">Qtd</th>
                <th className="p-3 text-right">Faturamento</th>
                <th className="p-3 text-right rounded-tr-xl">% do Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8D6CB]/60 tabular-nums">
              {searchedServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#95847C]">
                    Nenhum procedimento encontrado.
                  </td>
                </tr>
              ) : (
                searchedServices.map((srv, idx) => {
                  const pct = totalRevenue > 0 ? (srv.revenue / totalRevenue) * 100 : 0;
                  const avg = srv.count > 0 ? srv.revenue / srv.count : 0;
                  return (
                    <tr key={srv.name} className="hover:bg-[#FAF6F1]/70">
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-bold text-xs ${
                            idx === 0
                              ? 'bg-[#C4A477] text-[#594943]'
                              : idx === 1
                                ? 'bg-[#E8D6CB] text-[#594943]'
                                : idx === 2
                                  ? 'bg-[#BE9293] text-white'
                                  : 'bg-[#FAF6F1] text-[#95847C] border border-[#E8D6CB]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-[#594943]">{srv.name}</td>
                      <td className="p-3 text-right text-[#95847C]">{formatBRL(avg)}</td>
                      <td className="p-3 text-right font-bold text-[#594943]">{srv.count} un</td>
                      <td className="p-3 text-right font-bold text-[#4E7D5B]">
                        {formatBRL(srv.revenue)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold text-[#594943]">{pct.toFixed(1)}%</span>
                          <div className="w-16 h-2 rounded-full bg-[#FAF6F1] border border-[#E8D6CB] overflow-hidden">
                            <div
                              className="h-full bg-[#C4A477] rounded-full"
                              style={{ width: `${Math.min(100, pct * 2.5)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCO 4: TERMÔMETRO DA META + TOP CLIENTES VIP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LuxuryGaugeCard
          currentRevenue={totalRevenue}
          monthlyGoal={settings.monthlyGoal}
          totalExpenses={totalPaidExpenses}
          avgTicket={avgTicket}
        />

        <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#C4A477]" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                Fidelidade & Retorno
              </span>
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                Top Clientes VIP (Agenda)
              </h3>
            </div>
          </div>
          {topClients.length === 0 ? (
            <p className="text-xs text-[#95847C] py-6 text-center">
              Nenhuma cliente com atendimento confirmado ainda.
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

      {/* BLOCO 5: LANÇAMENTO UNIFICADO (RECEITA OU DESPESA) + HISTÓRICO LIMPO */}
      <div id="fin-lancamentos" className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8D6CB]/70 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
              Entradas & Saídas em Um Único Local
            </span>
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">
              Novo Lançamento Financeiro
            </h3>
          </div>

          <div className="inline-flex rounded-xl bg-[#FAF6F1] p-1 border border-[#E8D6CB]">
            <button
              type="button"
              onClick={() => {
                setEntryKind('in');
                setEntryCat('Procedimento');
                setEntryPayOrStatus('Pix');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                entryKind === 'in' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
              }`}
            >
              (+) Receita
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryKind('out');
                setEntryCat('Insumos');
                setEntryPayOrStatus('paid');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                entryKind === 'out' ? 'bg-[#BE9293] text-white' : 'text-[#95847C]'
              }`}
            >
              (-) Despesa
            </button>
          </div>
        </div>

        <form onSubmit={handleUnifiedSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input
            type="text"
            value={entryDesc}
            onChange={(e) => setEntryDesc(e.target.value)}
            placeholder={
              entryKind === 'in'
                ? 'Ex: Alongamento Fibra — Cliente'
                : 'Ex: Gel Nude / Lixas / Aluguel'
            }
            className="lg:col-span-2 min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
          />

          <select
            value={entryCat}
            onChange={(e) => setEntryCat(e.target.value)}
            className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
          >
            {entryKind === 'in' ? (
              <>
                <option value="Procedimento">Procedimento</option>
                <option value="Sinal Pix">Sinal Pix</option>
                <option value="Curso VIP">Curso VIP</option>
                <option value="Home Care">Produto Care</option>
              </>
            ) : (
              <>
                <option value="Insumos">Insumos & Géis</option>
                <option value="Materiais">Descartáveis</option>
                <option value="Estrutura">Estrutura & Aluguel</option>
                <option value="Marketing">Marketing</option>
              </>
            )}
          </select>

          <select
            value={entryPayOrStatus}
            onChange={(e) => setEntryPayOrStatus(e.target.value)}
            className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
          >
            {entryKind === 'in' ? (
              <>
                <option value="Pix">Pix</option>
                <option value="Cartão">Cartão</option>
                <option value="Dinheiro">Dinheiro</option>
              </>
            ) : (
              <>
                <option value="paid">Pago</option>
                <option value="pending">A pagar</option>
              </>
            )}
          </select>

          <input
            type="number"
            step="0.01"
            value={entryVal}
            onChange={(e) => setEntryVal(e.target.value)}
            placeholder="Valor R$"
            className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
          />

          <div className="flex gap-2">
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-xs text-[#594943]"
            />
            <button
              type="submit"
              className="min-h-[42px] rounded-xl bg-[#594943] hover:bg-[#433631] px-4 text-xs font-semibold text-white inline-flex items-center justify-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-[#C4A477]" />
              <span>Salvar</span>
            </button>
          </div>
        </form>

        {/* Listas Lado a Lado: Últimas Receitas Manuais & Despesas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#95847C]">
              Receitas Extras ({manualRevenues.length})
            </h4>
            {manualRevenues.length === 0 ? (
              <p className="text-xs text-[#95847C] py-3">Nenhuma receita extra lançada.</p>
            ) : (
              <div className="divide-y divide-[#E8D6CB]/60 max-h-64 overflow-y-auto pr-1">
                {manualRevenues.map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#594943] truncate">{r.description}</div>
                      <div className="text-[#95847C]">
                        {formatDateBR(r.date)} · {r.paymentMethod || 'Pix'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[#4E7D5B] tabular-nums">
                        +{formatBRL(r.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          saveRevenuesList(manualRevenues.filter((i) => i.id !== r.id))
                        }
                        className="p-1 text-[#95847C] hover:text-[#B45353] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#95847C]">
              Despesas ({expenses.length})
            </h4>
            {expenses.length === 0 ? (
              <p className="text-xs text-[#95847C] py-3">Nenhuma despesa lançada.</p>
            ) : (
              <div className="divide-y divide-[#E8D6CB]/60 max-h-64 overflow-y-auto pr-1">
                {expenses.map((ex) => (
                  <div key={ex.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#594943] truncate">{ex.description}</div>
                      <div className="text-[#95847C]">
                        {ex.category} · {formatDateBR(ex.date)} ·{' '}
                        <button
                          type="button"
                          onClick={() =>
                            saveExpensesList(
                              expenses.map((i) => (i.id === ex.id ? { ...i, paid: !i.paid } : i)),
                            )
                          }
                          className={`underline font-semibold cursor-pointer ${
                            ex.paid ? 'text-[#4E7D5B]' : 'text-[#BE9293]'
                          }`}
                        >
                          {ex.paid ? 'Pago' : 'A pagar'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[#BE9293] tabular-nums">
                        -{formatBRL(ex.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => saveExpensesList(expenses.filter((i) => i.id !== ex.id))}
                        className="p-1 text-[#95847C] hover:text-[#594943] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BLOCO 6: CONTAS A PAGAR & RECEBER (PENDÊNCIAS) */}
      <div id="fin-pendencias" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">Contas a Pagar</h3>
            <span className="text-xs font-bold text-[#BE9293] tabular-nums">
              {formatBRL(totalPendingExpenses)}
            </span>
          </div>
          {expenses.filter((e) => !e.paid).length === 0 ? (
            <p className="text-xs text-[#95847C] py-4 text-center">Todas as despesas estão quitadas.</p>
          ) : (
            expenses
              .filter((e) => !e.paid)
              .map((ex) => (
                <div
                  key={ex.id}
                  className="p-3 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#594943]">{ex.description}</div>
                    <div className="text-[11px] text-[#95847C]">
                      {formatDateBR(ex.date)} · {formatBRL(ex.amount)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      saveExpensesList(
                        expenses.map((i) => (i.id === ex.id ? { ...i, paid: true } : i)),
                      )
                    }
                    className="min-h-[32px] rounded-lg bg-[#594943] px-3 text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C4A477]" />
                    <span>Dar Baixa</span>
                  </button>
                </div>
              ))
          )}
        </div>

        <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">Valores a Receber</h3>
            <span className="text-xs font-bold text-[#C4A477] tabular-nums">
              {formatBRL(pendingReceivables)}
            </span>
          </div>
          {pendingAppointments.length === 0 ? (
            <p className="text-xs text-[#95847C] py-4 text-center">
              Nenhum agendamento pendente de recebimento.
            </p>
          ) : (
            pendingAppointments.map((a) => (
              <div
                key={a.id}
                className="p-3 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-semibold text-[#594943]">{a.clientName}</div>
                  <div className="text-[11px] text-[#95847C]">
                    {formatDateBR(a.date)} {a.startTime} · {formatBRL(a.totalPrice)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void adminUpdateAppointmentStatus(a, { status: 'confirmed', pixPaid: true })
                  }
                  className="min-h-[32px] rounded-lg bg-[#594943] px-3 text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>Confirmar</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* BLOCO 7: FECHAMENTO MENSAL (DRE) + CALCULADORA DE LUCRO POR HORA */}
      <div id="fin-fechamento" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
          <h3 className="font-editorial text-xl font-semibold text-[#594943]">
            Fechamento Consolidado (DRE)
          </h3>
          <div className="w-full h-3.5 rounded-full bg-[#F2EAE4] overflow-hidden flex border border-[#E8D6CB]">
            <div
              style={{ width: `${Math.max(0, Math.min(100, profitMargin))}%` }}
              className="h-full bg-[#C4A477]"
            />
            <div
              style={{ width: `${Math.max(0, 100 - Math.max(0, Math.min(100, profitMargin)))}%` }}
              className="h-full bg-[#BE9293]"
            />
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between py-1.5 border-b border-[#E8D6CB]/60">
              <span className="text-[#95847C]">(+) Agenda Online Confirmada</span>
              <strong className="text-[#594943] tabular-nums">{formatBRL(totalAppRevenue)}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E8D6CB]/60">
              <span className="text-[#95847C]">(+) Receitas Lançadas / Extras</span>
              <strong className="text-[#594943] tabular-nums">{formatBRL(totalManualRevenue)}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E8D6CB]/60">
              <span className="text-[#95847C]">(-) Despesas Pagas</span>
              <strong className="text-[#BE9293] tabular-nums">-{formatBRL(totalPaidExpenses)}</strong>
            </div>
            <div className="flex justify-between py-3 px-4 rounded-2xl bg-[#F2EAE4] border border-[#C4A477]/40 text-base">
              <strong className="text-[#594943]">(=) Lucro Líquido</strong>
              <strong className="text-[#594943] tabular-nums">
                {formatBRL(netProfit)} ({profitMargin}%)
              </strong>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#C4A477]/60 p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-[#C4A477]" />
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">
              Calculadora de Lucro por Hora
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="col-span-2 sm:col-span-4">
              <input
                type="text"
                value={calcServiceName}
                onChange={(e) => setCalcServiceName(e.target.value)}
                className="w-full min-h-[38px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-xs font-semibold text-[#594943]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#95847C]">Preço (R$)</label>
              <input
                type="number"
                value={calcPrice}
                onChange={(e) => setCalcPrice(Number(e.target.value))}
                className="w-full min-h-[38px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#95847C]">Insumo (R$)</label>
              <input
                type="number"
                value={calcMaterialCost}
                onChange={(e) => setCalcMaterialCost(Number(e.target.value))}
                className="w-full min-h-[38px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#95847C]">Tempo (min)</label>
              <input
                type="number"
                value={calcDurationMin}
                onChange={(e) => setCalcDurationMin(Number(e.target.value))}
                className="w-full min-h-[38px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#95847C]">Taxa (%)</label>
              <input
                type="number"
                value={calcFeePercent}
                onChange={(e) => setCalcFeePercent(Number(e.target.value))}
                className="w-full min-h-[38px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-sm text-[#594943]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
            <div className="p-2.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB]">
              <span className="text-[10px] text-[#95847C] block">Lucro/Cliente</span>
              <strong className="text-sm text-[#4E7D5B] tabular-nums">
                {formatBRL(calcNetPerService)}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB]">
              <span className="text-[10px] text-[#95847C] block">Ganho/Hora</span>
              <strong className="text-sm text-[#594943] tabular-nums">
                {formatBRL(calcNetPerHour)}/h
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#594943] text-[#FAF6F1]">
              <span className="text-[10px] text-[#E8D6CB] block">Ideal (75%)</span>
              <strong className="text-sm text-[#C4A477] tabular-nums">
                {formatBRL(calcSuggested75Price)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 8: EXTRATO ÚNICO DE ATENDIMENTOS DA AGENDA */}
      <div id="fin-extrato" className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="font-editorial text-xl font-semibold text-[#594943]">
            Extrato de Atendimentos ({appointments.length})
          </h3>
          <button
            type="button"
            onClick={() => downloadCSVReport(appointments, `agenda-financeiro-${todayISO()}.csv`)}
            className="text-xs font-semibold text-[#C4A477] hover:underline cursor-pointer"
          >
            Baixar Agenda CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#E8D6CB] text-[#95847C]">
                <th className="py-2.5 px-3 font-medium">Data</th>
                <th className="py-2.5 px-3 font-medium">Cliente</th>
                <th className="py-2.5 px-3 font-medium">Procedimentos</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8D6CB]/60">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#95847C]">
                    Nenhum agendamento registrado.
                  </td>
                </tr>
              ) : (
                appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-[#FAF6F1]/50">
                    <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                      {formatDateBR(a.date)} {a.startTime}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#594943]">{a.clientName}</td>
                    <td className="py-2.5 px-3 text-[#95847C]">{(a.serviceNames || []).join(' + ')}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{statusLabelPT(a.status)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatBRL(a.totalPrice)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
