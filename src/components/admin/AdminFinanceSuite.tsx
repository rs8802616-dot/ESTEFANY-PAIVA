import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  Download,
  FileBarChart,
  Layers,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  LuxuryAreaLineChart,
  LuxuryBarChart,
  LuxuryDonutChart,
  LuxuryGaugeCard,
  LuxuryKpiCard,
  LuxuryStateView,
  type ChartPoint,
  type ScreenUiState,
} from '../ui/LuxuryDesignSystem';
import { AdminReportsTab } from './AdminReportsSettingsTabs';
import { adminUpdateAppointmentStatus } from '../../lib/db';
import { formatBRL, formatDateBR, todayISO } from '../../lib/utils';
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

type ChartPeriodGrouping = 'weekly' | 'monthly_weeks' | 'semester';
type ChartVisualStyle = 'both' | 'bars' | 'area';

interface ExpenseItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  paid: boolean;
  weekdayOverride?: number; // 1=Seg..6=Sáb for sample distribution
}

interface ManualRevenueItem {
  id: string;
  description: string;
  category?: string;
  paymentMethod?: string;
  amount: number;
  date: string;
  received: boolean;
  weekdayOverride?: number; // 1=Seg..6=Sáb for sample distribution
}

const EXPENSES_KEY = 'epn_luxury_expenses_v45';
const REVENUES_KEY = 'epn_luxury_manual_revenues_v45';

function getRecentWeekdayISO(targetWeekday: number): string {
  const now = new Date();
  const currentDay = now.getDay(); // 0..6
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

export const AdminFinanceSuite: React.FC<{
  appointments: Appointment[];
  settings: SalonSettings;
  initialSubScreen?: FinanceSubScreen;
  onSelectSubScreen?: (sub: FinanceSubScreen) => void;
}> = ({ appointments, settings, initialSubScreen = 'resumo_financeiro', onSelectSubScreen }) => {
  const [subScreen, setSubScreen] = useState<FinanceSubScreen>(initialSubScreen);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => loadExpenses());
  const [manualRevenues, setManualRevenues] = useState<ManualRevenueItem[]>(() => loadManualRevenues());
  const [uiState, setUiState] = useState<ScreenUiState>('idle');

  // Chart Interactive Controls
  const [periodGrouping, setPeriodGrouping] = useState<ChartPeriodGrouping>('weekly');
  const [chartStyle, setChartStyle] = useState<ChartVisualStyle>('both');

  // Expense Form State
  const [expDesc, setExpDesc] = useState('');
  const [expCat, setExpCat] = useState('Insumos');
  const [expVal, setExpVal] = useState('');
  const [expDate, setExpDate] = useState(todayISO());
  const [expPaid, setExpPaid] = useState(true);

  // Revenue Form State
  const [revDesc, setRevDesc] = useState('');
  const [revCat, setRevCat] = useState('Procedimento');
  const [revPayMethod, setRevPayMethod] = useState('Pix');
  const [revVal, setRevVal] = useState('');
  const [revDate, setRevDate] = useState(todayISO());

  // Quick Cash Flow Entry State (Tela 20)
  const [quickType, setQuickType] = useState<'in' | 'out'>('in');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDay, setQuickDay] = useState<number>(new Date().getDay() || 5);

  // Pricing & Hourly Profit Calculator State (Tela 24)
  const [calcServiceName, setCalcServiceName] = useState('Alongamento em Fibra de Vidro');
  const [calcPrice, setCalcPrice] = useState(180);
  const [calcMaterialCost, setCalcMaterialCost] = useState(28);
  const [calcDurationMin, setCalcDurationMin] = useState(120);
  const [calcFeePercent, setCalcFeePercent] = useState(4);

  useEffect(() => {
    setSubScreen(initialSubScreen);
  }, [initialSubScreen]);

  const handleSelectSubScreen = (next: FinanceSubScreen) => {
    setUiState('idle');
    setSubScreen(next);
    onSelectSubScreen?.(next);
  };

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
  const projectedBalance = netProfit + pendingReceivables - totalPendingExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const goalPct =
    settings.monthlyGoal > 0
      ? Math.min(100, Math.round((totalRevenue / settings.monthlyGoal) * 100))
      : 0;

  const totalServicesCount = realizedAppointments.length + manualRevenues.length;
  const avgTicket = totalServicesCount > 0 ? totalRevenue / totalServicesCount : 165;

  // Dynamic Chart Series based on Period Grouping (Seg-Sáb, Semanas do Mês, Semestre)
  const chartData = useMemo<ChartPoint[]>(() => {
    if (periodGrouping === 'weekly') {
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

      let running = 0;
      return days.map(({ day, label }) => {
        const p = Math.round(revByDay.get(day) || 0);
        const s = Math.round(expByDay.get(day) || 0);
        running += p - s;
        return { label, primary: p, secondary: s, balance: running };
      });
    }

    if (periodGrouping === 'monthly_weeks') {
      const weeks = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
      const revW = [0, 0, 0, 0];
      const expW = [0, 0, 0, 0];

      realizedAppointments.forEach((apt, idx) => {
        const dayNum = Number(apt.date.split('-')[2]) || 1;
        const wIdx = Math.min(3, Math.floor((dayNum - 1) / 7));
        revW[wIdx] += Number(apt.totalPrice) || 0;
        if (idx === 0) revW[wIdx] += 0;
      });
      manualRevenues.forEach((rev, idx) => {
        if (!rev.received) return;
        revW[idx % 4] += rev.amount;
      });
      expenses.forEach((ex, idx) => {
        if (!ex.paid) return;
        expW[idx % 4] += ex.amount;
      });

      let running = 0;
      return weeks.map((label, i) => {
        const p = Math.round(revW[i]);
        const s = Math.round(expW[i]);
        running += p - s;
        return { label, primary: p, secondary: s, balance: running };
      });
    }

    // Semester view
    const months = ['Mês -5', 'Mês -4', 'Mês -3', 'Mês -2', 'Mês Anterior', 'Mês Atual'];
    const baseRev = Math.max(totalRevenue, 1200);
    const baseExp = Math.max(totalPaidExpenses, 350);
    const factors = [0.62, 0.71, 0.78, 0.85, 0.93, 1.0];
    let running = 0;
    return months.map((label, idx) => {
      const p = idx === 5 ? Math.round(totalRevenue) : Math.round(baseRev * factors[idx]);
      const s = idx === 5 ? Math.round(totalPaidExpenses) : Math.round(baseExp * factors[idx]);
      running += p - s;
      return { label, primary: p, secondary: s, balance: running };
    });
  }, [periodGrouping, realizedAppointments, manualRevenues, expenses, totalRevenue, totalPaidExpenses]);

  // Cumulative Cash Flow Curve Series (for Area Chart in Tela 20)
  const cumulativeChartData = useMemo<ChartPoint[]>(() => {
    return chartData.map((pt) => ({
      label: pt.label,
      primary: Math.max(0, pt.balance ?? pt.primary - (pt.secondary || 0)),
      secondary: pt.secondary,
    }));
  }, [chartData]);

  // Donut Chart Slices: Expenses by Category
  const expensesByCategorySlices = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((ex) => {
      map.set(ex.category, (map.get(ex.category) || 0) + ex.amount);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [expenses]);

  // Donut Chart Slices: Revenues by Source/Category
  const revenuesBySourceSlices = useMemo(() => {
    const map = new Map<string, number>();
    if (totalAppRevenue > 0) {
      map.set('Agenda Online', totalAppRevenue);
    }
    manualRevenues.forEach((r) => {
      if (!r.received) return;
      const key = `${r.category || 'Procedimento'} (${r.paymentMethod || 'Pix'})`;
      map.set(key, (map.get(key) || 0) + r.amount);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [totalAppRevenue, manualRevenues]);

  const servicePerformance = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    realizedAppointments.forEach((apt) => {
      const name = apt.serviceNames.join(' + ') || 'Procedimento';
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
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [realizedAppointments, manualRevenues]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expVal);
    if (!expDesc.trim() || !amount || amount <= 0) {
      setUiState('error');
      return;
    }
    const item: ExpenseItem = {
      id: `exp_${Date.now()}`,
      description: expDesc.trim(),
      category: expCat,
      amount,
      date: expDate || todayISO(),
      paid: expPaid,
    };
    saveExpensesList([item, ...expenses]);
    setExpDesc('');
    setExpVal('');
    setUiState('success');
    setTimeout(() => setUiState('idle'), 2500);
  };

  const handleAddRevenue = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(revVal);
    if (!revDesc.trim() || !amount || amount <= 0) {
      setUiState('error');
      return;
    }
    const item: ManualRevenueItem = {
      id: `rev_${Date.now()}`,
      description: revDesc.trim(),
      category: revCat,
      paymentMethod: revPayMethod,
      amount,
      date: revDate || todayISO(),
      received: true,
    };
    saveRevenuesList([item, ...manualRevenues]);
    setRevDesc('');
    setRevVal('');
    setUiState('success');
    setTimeout(() => setUiState('idle'), 2500);
  };

  const handleQuickCashFlowAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(quickAmount);
    if (!quickDesc.trim() || !amount || amount <= 0) return;

    if (quickType === 'in') {
      const item: ManualRevenueItem = {
        id: `rev_${Date.now()}`,
        description: quickDesc.trim(),
        category: 'Procedimento',
        paymentMethod: 'Pix',
        amount,
        date: getRecentWeekdayISO(quickDay),
        received: true,
        weekdayOverride: quickDay,
      };
      saveRevenuesList([item, ...manualRevenues]);
    } else {
      const item: ExpenseItem = {
        id: `exp_${Date.now()}`,
        description: quickDesc.trim(),
        category: 'Insumos',
        amount,
        date: getRecentWeekdayISO(quickDay),
        paid: true,
        weekdayOverride: quickDay,
      };
      saveExpensesList([item, ...expenses]);
    }
    setQuickDesc('');
    setQuickAmount('');
  };

  const exportMonthlyClosingCSV = () => {
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
    a.download = `fechamento-luxury-nude-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculator Metrics (Tela 24)
  const calcFeeAmount = (calcPrice * calcFeePercent) / 100;
  const calcNetPerService = calcPrice - calcMaterialCost - calcFeeAmount;
  const calcMarginPct = calcPrice > 0 ? Math.round((calcNetPerService / calcPrice) * 100) : 0;
  const calcNetPerHour = calcDurationMin > 0 ? (calcNetPerService / calcDurationMin) * 60 : 0;
  const calcSuggested75Price = Math.ceil((calcMaterialCost / Math.max(0.1, 1 - 0.75 - calcFeePercent / 100)) / 5) * 5;

  const NAV_ITEMS: { id: FinanceSubScreen; num: number; label: string }[] = [
    { id: 'resumo_financeiro', num: 17, label: '17. Resumo' },
    { id: 'receitas', num: 18, label: '18. Receitas' },
    { id: 'despesas', num: 19, label: '19. Despesas' },
    { id: 'fluxo_caixa', num: 20, label: '20. Fluxo de Caixa' },
    { id: 'contas_pagar_receber', num: 21, label: '21. Contas Pagar/Receber' },
    { id: 'fechamento_mensal', num: 22, label: '22. Fechamento Mensal' },
    { id: 'relatorios_gerais', num: 23, label: '23. Relatórios Gerais' },
    { id: 'relatorios_desempenho', num: 24, label: '24. Desempenho' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navegação das 8 Telas Financeiras (Telas 17 a 24) */}
      <div className="bg-white rounded-3xl border border-[#E8D6CB] p-4 space-y-3 no-print shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A477] block">
              Inteligência Financeira & Gráficos Interativos • Telas 17 a 24
            </span>
            <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[#594943]">
              Gestão Financeira Luxury Nude
            </h2>
          </div>

          {/* Controles Rápidos de Gráficos & Dados */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center rounded-xl bg-[#FAF6F1] p-1 border border-[#E8D6CB]">
              <button
                type="button"
                onClick={() => setPeriodGrouping('weekly')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  periodGrouping === 'weekly' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                }`}
              >
                Seg–Sáb
              </button>
              <button
                type="button"
                onClick={() => setPeriodGrouping('monthly_weeks')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  periodGrouping === 'monthly_weeks' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                }`}
              >
                Semanas
              </button>
              <button
                type="button"
                onClick={() => setPeriodGrouping('semester')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  periodGrouping === 'semester' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                }`}
              >
                6 Meses
              </button>
            </div>

            <button
              type="button"
              onClick={handleRestoreSampleData}
              title="Preencher com movimentação realista de exemplo para visualizar todos os gráficos"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F2EAE4] hover:bg-[#E8D6CB] text-[#594943] text-[11px] font-semibold border border-[#E8D6CB] cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-[#C4A477]" />
              <span>Carregar Exemplo</span>
            </button>
            {(manualRevenues.length > 0 || expenses.length > 0) && (
              <button
                type="button"
                onClick={handleClearManualData}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF6F1] text-[#95847C] hover:text-[#594943] text-[11px] font-semibold border border-[#E8D6CB] cursor-pointer"
              >
                <span>Zerar Manuais</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectSubScreen(item.id)}
              className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-semibold truncate transition-colors cursor-pointer ${
                subScreen === item.id
                  ? 'bg-[#594943] text-white shadow-2xs'
                  : 'bg-[#FAF6F1] border border-[#E8D6CB] text-[#95847C] hover:text-[#594943]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <LuxuryStateView state={uiState} />

      {/* TELA 17: RESUMO FINANCEIRO */}
      {subScreen === 'resumo_financeiro' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <LuxuryKpiCard
              label="Receita Realizada"
              value={formatBRL(totalRevenue)}
              subtitle={`${totalServicesCount} lançamentos confirmados`}
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
              subtitle={`Projetado: ${formatBRL(projectedBalance)}`}
              trend={`Margem ${profitMargin}%`}
              trendPositive={netProfit >= 0}
              accent="brown"
              icon={<Wallet className="w-4 h-4" />}
            />
            <LuxuryKpiCard
              label="Atingimento da Meta"
              value={`${goalPct}%`}
              subtitle={`Meta: ${formatBRL(settings.monthlyGoal)}`}
              trend={goalPct >= 100 ? 'Meta Batida!' : `Faltam ${100 - goalPct}%`}
              trendPositive={goalPct >= 50}
              accent="nude"
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>

          {/* Linha 2: Velocímetro da Meta + Rosca de Composição */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LuxuryGaugeCard
              currentRevenue={totalRevenue}
              monthlyGoal={settings.monthlyGoal}
              totalExpenses={totalPaidExpenses}
              avgTicket={avgTicket}
            />
            <LuxuryDonutChart
              title="Distribuição de Receitas por Origem"
              subtitle="Toque nas fatias do gráfico para inspecionar valores e percentuais"
              centerLabel="Receita Total"
              slices={revenuesBySourceSlices}
            />
          </div>

          {/* Linha 3: Gráfico de Barras Interativo + Curva de Evolução */}
          <LuxuryBarChart
            title="17. Balanço Comparativo — Receitas x Despesas"
            subtitle="Clique em qualquer coluna para abrir o raio-x completo do período"
            data={chartData}
          />
        </div>
      )}

      {/* TELA 18: RECEITAS */}
      {subScreen === 'receitas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleAddRevenue}
              className="lg:col-span-2 bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Tela 18 • Controle de Entradas
                </span>
                <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                  Lançar Nova Receita no Caixa
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#594943] mb-1">
                    Descrição do Atendimento ou Venda
                  </label>
                  <input
                    type="text"
                    value={revDesc}
                    onChange={(e) => setRevDesc(e.target.value)}
                    placeholder="Ex: Alongamento Fibra de Vidro — Cliente Mariana"
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">Categoria</label>
                  <select
                    value={revCat}
                    onChange={(e) => setRevCat(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
                  >
                    <option value="Procedimento">Procedimento no Studio</option>
                    <option value="Sinal Pix">Sinal / Reserva Pix</option>
                    <option value="Curso VIP">Curso VIP / Mentoria</option>
                    <option value="Home Care">Venda Produto / Kit Care</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={revPayMethod}
                    onChange={(e) => setRevPayMethod(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
                  >
                    <option value="Pix">Pix Imediato</option>
                    <option value="Cartão">Cartão de Crédito / Débito</option>
                    <option value="Dinheiro">Espécie (Dinheiro)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={revVal}
                    onChange={(e) => setRevVal(e.target.value)}
                    placeholder="180.00"
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">Data</label>
                  <input
                    type="date"
                    value={revDate}
                    onChange={(e) => setRevDate(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#594943] hover:bg-[#433631] px-5 text-xs font-semibold text-white inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-[#C4A477]" />
                <span>Registrar Entrada no Caixa</span>
              </button>
            </form>

            <LuxuryDonutChart
              title="Receitas por Modalidade"
              subtitle="Participação por categoria e meio de pagamento"
              centerLabel="Entradas"
              slices={revenuesBySourceSlices}
            />
          </div>

          <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="font-editorial text-lg font-semibold text-[#594943]">
                Histórico de Entradas ({manualRevenues.length + realizedAppointments.length})
              </h4>
              <span className="text-sm font-bold text-[#4E7D5B] tabular-nums">
                Total: {formatBRL(totalRevenue)}
              </span>
            </div>

            {realizedAppointments.length === 0 && manualRevenues.length === 0 ? (
              <LuxuryStateView state="empty" title="Nenhuma receita registrada" />
            ) : (
              <div className="divide-y divide-[#E8D6CB]/60">
                {manualRevenues.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">{r.description}</div>
                      <div className="text-xs text-[#95847C]">
                        {formatDateBR(r.date)} · {r.category || 'Procedimento'} ·{' '}
                        <span className="font-semibold text-[#594943]">{r.paymentMethod || 'Pix'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#4E7D5B] tabular-nums">
                        +{formatBRL(r.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          saveRevenuesList(manualRevenues.filter((item) => item.id !== r.id))
                        }
                        className="p-1.5 text-[#95847C] hover:text-[#B45353] cursor-pointer"
                        aria-label="Excluir receita manual"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {realizedAppointments.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">
                        {a.clientName} — {a.serviceNames.join(' + ')}
                      </div>
                      <div className="text-xs text-[#95847C]">
                        {formatDateBR(a.date)} às {a.startTime} · Agenda Online ({a.paymentMethod.toUpperCase()})
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#4E7D5B] tabular-nums">
                      +{formatBRL(a.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TELA 19: DESPESAS */}
      {subScreen === 'despesas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleAddExpense}
              className="lg:col-span-2 bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Tela 19 • Controle de Custos & Insumos
                </span>
                <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                  Registrar Despesa do Atelier
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#594943] mb-1">
                    Descrição da Despesa / Fornecedor
                  </label>
                  <input
                    type="text"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    placeholder="Ex: Gel Construtor Nude / Cabine LED / Aluguel"
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">Categoria</label>
                  <select
                    value={expCat}
                    onChange={(e) => setExpCat(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
                  >
                    <option value="Insumos">Insumos & Géis</option>
                    <option value="Materiais">Descartáveis & Lixas</option>
                    <option value="Estrutura">Aluguel, Energia & Internet</option>
                    <option value="Marketing">Marketing & Embalagens</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expVal}
                    onChange={(e) => setExpVal(e.target.value)}
                    placeholder="150.00"
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">Data</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">Situação</label>
                  <select
                    value={expPaid ? 'paid' : 'pending'}
                    onChange={(e) => setExpPaid(e.target.value === 'paid')}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm font-semibold text-[#594943]"
                  >
                    <option value="paid">Pago (Quitado)</option>
                    <option value="pending">A pagar (Vai p/ Tela 21)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#594943] hover:bg-[#433631] px-5 text-xs font-semibold text-white inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-[#C4A477]" />
                <span>Adicionar Despesa</span>
              </button>
            </form>

            <LuxuryDonutChart
              title="Despesas por Categoria"
              subtitle="Para onde vão os recursos operacionais do studio"
              centerLabel="Custos"
              slices={expensesByCategorySlices}
            />
          </div>

          <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-3 shadow-2xs">
            <h4 className="font-editorial text-lg font-semibold text-[#594943]">
              Histórico de Despesas ({expenses.length})
            </h4>
            {expenses.length === 0 ? (
              <LuxuryStateView state="empty" title="Nenhuma despesa cadastrada" />
            ) : (
              <div className="divide-y divide-[#E8D6CB]/60">
                {expenses.map((ex) => (
                  <div key={ex.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">{ex.description}</div>
                      <div className="text-xs text-[#95847C]">
                        {ex.category} · {formatDateBR(ex.date)} ·{' '}
                        <button
                          type="button"
                          onClick={() =>
                            saveExpensesList(
                              expenses.map((i) => (i.id === ex.id ? { ...i, paid: !i.paid } : i)),
                            )
                          }
                          className={`underline font-semibold cursor-pointer ${
                            ex.paid ? 'text-emerald-700' : 'text-[#BE9293]'
                          }`}
                        >
                          {ex.paid ? 'Pago (alterar)' : 'A pagar (dar baixa)'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#BE9293] tabular-nums">
                        -{formatBRL(ex.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => saveExpensesList(expenses.filter((i) => i.id !== ex.id))}
                        className="p-1.5 text-[#95847C] hover:text-[#594943] cursor-pointer"
                        aria-label="Excluir despesa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TELA 20: FLUXO DE CAIXA CONSOLIDADO (COM CURVA DE ÁREA, BARRAS, LANÇAMENTO RÁPIDO E EXTRATO) */}
      {subScreen === 'fluxo_caixa' && (
        <div className="space-y-6">
          {/* 4 KPIs de Fluxo de Caixa */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <LuxuryKpiCard
              label="Entradas Realizadas"
              value={formatBRL(totalRevenue)}
              subtitle={`${totalServicesCount} entradas confirmadas`}
              trend="+ Caixa"
              trendPositive={true}
              accent="gold"
              icon={<ArrowUpRight className="w-4 h-4" />}
            />
            <LuxuryKpiCard
              label="Saídas Realizadas"
              value={formatBRL(totalPaidExpenses)}
              subtitle={`${expenses.filter((e) => e.paid).length} saídas pagas`}
              trend="- Caixa"
              trendPositive={false}
              accent="rose"
              icon={<ArrowDownRight className="w-4 h-4" />}
            />
            <LuxuryKpiCard
              label="Saldo em Caixa"
              value={formatBRL(netProfit)}
              subtitle={`Margem líquida: ${profitMargin}%`}
              trend={netProfit >= 0 ? 'Superávit' : 'Déficit'}
              trendPositive={netProfit >= 0}
              accent="brown"
              icon={<Wallet className="w-4 h-4" />}
            />
            <LuxuryKpiCard
              label="Saldo Projetado (c/ Pendentes)"
              value={formatBRL(projectedBalance)}
              subtitle={`+${formatBRL(pendingReceivables)} a receber`}
              trend="Previsão"
              trendPositive={projectedBalance >= 0}
              accent="nude"
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>

          {/* Barra de Lançamento Rápido no Fluxo + Seletor de Visualização dos Gráficos */}
          <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Movimentação Instantânea & Modo de Gráfico
                </span>
                <h3 className="font-editorial text-lg font-semibold text-[#594943]">
                  Lançamento Rápido no Fluxo de Caixa
                </h3>
              </div>

              {/* Seletor de Estilo de Gráfico */}
              <div className="inline-flex items-center gap-1 rounded-xl bg-[#FAF6F1] p-1 border border-[#E8D6CB]">
                <button
                  type="button"
                  onClick={() => setChartStyle('both')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    chartStyle === 'both' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                  }`}
                >
                  Barras + Curva
                </button>
                <button
                  type="button"
                  onClick={() => setChartStyle('bars')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    chartStyle === 'bars' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                  }`}
                >
                  Só Barras
                </button>
                <button
                  type="button"
                  onClick={() => setChartStyle('area')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    chartStyle === 'area' ? 'bg-[#594943] text-white' : 'text-[#95847C]'
                  }`}
                >
                  Só Curva SVG
                </button>
              </div>
            </div>

            <form
              onSubmit={handleQuickCashFlowAdd}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5"
            >
              <select
                value={quickType}
                onChange={(e) => setQuickType(e.target.value as 'in' | 'out')}
                className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-xs font-bold text-[#594943]"
              >
                <option value="in">(+) Nova Entrada Rápida</option>
                <option value="out">(-) Nova Saída Rápida</option>
              </select>

              <input
                type="text"
                value={quickDesc}
                onChange={(e) => setQuickDesc(e.target.value)}
                placeholder="Descrição (ex: Fibra de Vidro / Gel)"
                className="lg:col-span-2 min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
              />

              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  placeholder="R$ Valor"
                  className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
                />
                <select
                  value={quickDay}
                  onChange={(e) => setQuickDay(Number(e.target.value))}
                  className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-xs font-semibold text-[#594943]"
                >
                  <option value={1}>Seg</option>
                  <option value={2}>Ter</option>
                  <option value={3}>Qua</option>
                  <option value={4}>Qui</option>
                  <option value={5}>Sex</option>
                  <option value={6}>Sáb</option>
                </select>
              </div>

              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-[#594943] hover:bg-[#433631] px-4 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-[#C4A477]" />
                <span>Lançar no Gráfico</span>
              </button>
            </form>
          </div>

          {/* Gráficos de Fluxo de Caixa (Barras + Curva de Saldo Acumulado) */}
          {(chartStyle === 'both' || chartStyle === 'bars') && (
            <LuxuryBarChart
              title="20. Fluxo de Caixa Consolidado — Entradas x Saídas"
              subtitle="Toque em qualquer coluna (Seg a Sáb / Semanas / Meses) para inspecionar o saldo líquido"
              data={chartData}
              primaryLabel="Entradas"
              secondaryLabel="Saídas"
            />
          )}

          {(chartStyle === 'both' || chartStyle === 'area') && (
            <LuxuryAreaLineChart
              title="Curva de Evolução do Saldo Acumulado em Caixa"
              subtitle="Progressão contínua do caixa líquido ao longo do período selecionado"
              data={cumulativeChartData}
              primaryLabel="Saldo Acumulado"
              secondaryLabel="Saídas do Período"
            />
          )}

          {/* Tabela Analítica de Extrato Diário / Semanal do Fluxo de Caixa */}
          <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Demonstrativo Analítico
                </span>
                <h4 className="font-editorial text-xl font-semibold text-[#594943]">
                  Extrato Detalhado por Período
                </h4>
              </div>
              <button
                type="button"
                onClick={exportMonthlyClosingCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] text-xs font-semibold text-[#594943] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Baixar Planilha</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E8D6CB] text-[11px] uppercase tracking-wider text-[#95847C]">
                    <th className="py-2.5 px-3">Período</th>
                    <th className="py-2.5 px-3">Entradas (+)</th>
                    <th className="py-2.5 px-3">Saídas (-)</th>
                    <th className="py-2.5 px-3">Resultado do Dia</th>
                    <th className="py-2.5 px-3 text-right">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8D6CB]/60 tabular-nums">
                  {chartData.map((row, idx) => {
                    const dayNet = row.primary - (row.secondary || 0);
                    return (
                      <tr key={idx} className="hover:bg-[#FAF6F1]/70">
                        <td className="py-3 px-3 font-semibold text-[#594943]">{row.label}</td>
                        <td className="py-3 px-3 font-semibold text-[#4E7D5B]">
                          +{formatBRL(row.primary)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#BE9293]">
                          -{formatBRL(row.secondary || 0)}
                        </td>
                        <td
                          className={`py-3 px-3 font-bold ${
                            dayNet >= 0 ? 'text-[#594943]' : 'text-[#B45353]'
                          }`}
                        >
                          {dayNet >= 0 ? `+${formatBRL(dayNet)}` : formatBRL(dayNet)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#594943]">
                          {formatBRL(row.balance ?? dayNet)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TELA 21: CONTAS A PAGAR E RECEBER */}
      {subScreen === 'contas_pagar_receber' && (
        <div className="space-y-6">
          {/* Barra Visual Comparativa A Receber x A Pagar */}
          <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                21. Balanço de Pendências Futuras
              </h3>
              <span className="text-xs font-bold text-[#594943]">
                Impacto Líquido Previsto:{' '}
                <strong
                  className={
                    pendingReceivables - totalPendingExpenses >= 0
                      ? 'text-[#4E7D5B]'
                      : 'text-[#B45353]'
                  }
                >
                  {formatBRL(pendingReceivables - totalPendingExpenses)}
                </strong>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between">
                <span className="text-[#95847C]">Total a Receber (Agendamentos Pendentes):</span>
                <strong className="text-sm text-[#4E7D5B] tabular-nums">
                  +{formatBRL(pendingReceivables)}
                </strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between">
                <span className="text-[#95847C]">Total de Contas a Pagar (Fornecedores):</span>
                <strong className="text-sm text-[#BE9293] tabular-nums">
                  -{formatBRL(totalPendingExpenses)}
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="font-editorial text-xl font-semibold text-[#594943]">Contas a Pagar</h3>
                <span className="text-xs font-semibold text-[#BE9293]">
                  {formatBRL(totalPendingExpenses)}
                </span>
              </div>
              {expenses.filter((e) => !e.paid).length === 0 ? (
                <LuxuryStateView
                  state="empty"
                  title="Nenhuma conta pendente"
                  message="Todas as despesas estão quitadas."
                />
              ) : (
                expenses
                  .filter((e) => !e.paid)
                  .map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#594943]">{ex.description}</div>
                        <div className="text-xs text-[#95847C]">
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
                        className="min-h-[34px] rounded-lg bg-[#594943] px-3 text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C4A477]" />
                        <span>Dar Baixa</span>
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                  Valores a Receber
                </h3>
                <span className="text-xs font-semibold text-[#C4A477]">
                  {formatBRL(pendingReceivables)}
                </span>
              </div>
              {pendingAppointments.length === 0 ? (
                <LuxuryStateView
                  state="empty"
                  title="Nenhum recebimento pendente"
                  message="Todos os agendamentos ativos estão confirmados."
                />
              ) : (
                pendingAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">{a.clientName}</div>
                      <div className="text-xs text-[#95847C]">
                        {formatDateBR(a.date)} às {a.startTime} · {a.serviceNames.join(' + ')} ·{' '}
                        {formatBRL(a.totalPrice)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void adminUpdateAppointmentStatus(a, { status: 'confirmed', pixPaid: true })
                      }
                      className="min-h-[34px] rounded-lg bg-[#594943] px-3 text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C4A477]" />
                      <span>Confirmar</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TELA 22: FECHAMENTO MENSAL (DRE + GRÁFICO DE COMPOSIÇÃO DE MARGEM) */}
      {subScreen === 'fechamento_mensal' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-[#E8D6CB] p-6 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8D6CB] pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Demonstrativo de Resultado do Exercício (DRE)
                </span>
                <h3 className="font-editorial text-2xl font-semibold text-[#594943]">
                  22. Fechamento Mensal do Atelier
                </h3>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={exportMonthlyClosingCSV}
                  className="min-h-[38px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-xs font-semibold text-[#594943] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>Exportar CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[38px] rounded-xl bg-[#594943] px-3.5 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>Imprimir PDF</span>
                </button>
              </div>
            </div>

            {/* Gráfico Horizontal de Composição do Resultado */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#594943]">
                <span>Proporção Lucro Líquido ({profitMargin}%) vs Custos ({100 - profitMargin}%)</span>
                <span className="tabular-nums">Receita Bruta: {formatBRL(totalRevenue)}</span>
              </div>
              <div className="w-full h-4 rounded-full bg-[#F2EAE4] overflow-hidden flex border border-[#E8D6CB]">
                <div
                  style={{ width: `${Math.max(0, Math.min(100, profitMargin))}%` }}
                  className="h-full bg-[#C4A477] transition-all"
                  title={`Lucro: ${profitMargin}%`}
                />
                <div
                  style={{ width: `${Math.max(0, 100 - Math.max(0, Math.min(100, profitMargin)))}%` }}
                  className="h-full bg-[#BE9293] transition-all"
                  title="Custos"
                />
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#E8D6CB]/60">
                <span className="text-[#95847C]">(+) Receita de Agenda Online Confirmada</span>
                <strong className="text-[#594943] tabular-nums">{formatBRL(totalAppRevenue)}</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E8D6CB]/60">
                <span className="text-[#95847C]">(+) Receitas Lançadas no Caixa / Cursos</span>
                <strong className="text-[#594943] tabular-nums">{formatBRL(totalManualRevenue)}</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E8D6CB]/60">
                <span className="text-[#594943] font-semibold">(=) Receita Bruta Total</span>
                <strong className="text-[#594943] tabular-nums">{formatBRL(totalRevenue)}</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E8D6CB]/60">
                <span className="text-[#95847C]">(-) Custos de Insumos, Materiais & Estrutura</span>
                <strong className="text-[#BE9293] tabular-nums">-{formatBRL(totalPaidExpenses)}</strong>
              </div>
              <div className="flex justify-between py-3.5 px-4 rounded-2xl bg-[#F2EAE4] border border-[#C4A477]/40 text-base">
                <strong className="text-[#594943]">(=) Lucro Líquido Consolidado</strong>
                <strong className="text-[#594943] tabular-nums">
                  {formatBRL(netProfit)} ({profitMargin}% margem)
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LuxuryDonutChart
              title="Composição das Entradas do Mês"
              subtitle="Fontes de receita consolidadas no fechamento"
              centerLabel="Bruto"
              slices={revenuesBySourceSlices}
            />
            <LuxuryDonutChart
              title="Composição das Saídas do Mês"
              subtitle="Distribuição dos custos por centro de despesa"
              centerLabel="Despesas"
              slices={expensesByCategorySlices}
            />
          </div>
        </div>
      )}

      {/* TELA 23: RELATÓRIOS GERAIS */}
      {subScreen === 'relatorios_gerais' && <AdminReportsTab appointments={appointments} />}

      {/* TELA 24: RELATÓRIOS DE DESEMPENHO + CALCULADORA DE PRECIFICAÇÃO & GANHO POR HORA */}
      {subScreen === 'relatorios_desempenho' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking de Procedimentos */}
            <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-[#C4A477]" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                    Tela 24 • Ranking de Procedimentos
                  </span>
                  <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                    Desempenho por Procedimento
                  </h3>
                </div>
              </div>
              {servicePerformance.length === 0 ? (
                <LuxuryStateView state="empty" title="Sem dados de desempenho ainda" />
              ) : (
                <div className="space-y-3">
                  {servicePerformance.map((item, idx) => {
                    const share =
                      totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0;
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB] space-y-2"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <strong className="text-[#594943] truncate pr-2">{item.name}</strong>
                          <span className="font-bold text-[#594943] tabular-nums shrink-0">
                            {formatBRL(item.revenue)} ({share}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-[#E8D6CB] overflow-hidden">
                          <div
                            style={{ width: `${Math.max(8, share)}%` }}
                            className="h-full bg-gradient-to-r from-[#594943] to-[#C4A477] rounded-full"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#95847C]">
                          <span>{item.count} atendimento(s)</span>
                          <span>Ticket médio: {formatBRL(item.revenue / Math.max(1, item.count))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gráfico de Rosca de Procedimentos */}
            <LuxuryDonutChart
              title="Share de Faturamento por Serviço"
              subtitle="Participação percentual de cada técnica na receita total"
              centerLabel="Serviços"
              slices={servicePerformance.map((s) => ({ label: s.name, value: s.revenue }))}
            />
          </div>

          {/* NOVA FUNÇÃO: CALCULADORA DE PRECIFICAÇÃO & LUCRO POR HORA TRABALHADA */}
          <div className="bg-white rounded-3xl border border-[#C4A477] p-5 sm:p-6 space-y-5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#594943] text-[#C4A477] flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Nova Função Exclusiva • Engenharia de Preços Nail Designer
                </span>
                <h3 className="font-editorial text-xl font-semibold text-[#594943]">
                  Calculadora de Lucratividade Real & Ganho por Hora
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-[#594943] mb-1">
                  Nome do Procedimento
                </label>
                <input
                  type="text"
                  value={calcServiceName}
                  onChange={(e) => setCalcServiceName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#594943] mb-1">
                  Preço Cobrado (R$)
                </label>
                <input
                  type="number"
                  value={calcPrice}
                  onChange={(e) => setCalcPrice(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#594943] mb-1">
                  Custo Material (Gel/Fibra)
                </label>
                <input
                  type="number"
                  value={calcMaterialCost}
                  onChange={(e) => setCalcMaterialCost(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">
                    Tempo (min)
                  </label>
                  <input
                    type="number"
                    value={calcDurationMin}
                    onChange={(e) => setCalcDurationMin(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-sm text-[#594943]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#594943] mb-1">
                    Taxa (%)
                  </label>
                  <input
                    type="number"
                    value={calcFeePercent}
                    onChange={(e) => setCalcFeePercent(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-2.5 text-sm text-[#594943]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB]">
                <span className="text-xs text-[#95847C] block">Lucro Líquido / Cliente</span>
                <strong className="font-editorial text-xl font-bold text-[#4E7D5B] tabular-nums">
                  {formatBRL(calcNetPerService)}
                </strong>
                <span className="block text-[11px] text-[#95847C] mt-0.5">
                  Livre de insumos e taxas
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB]">
                <span className="text-xs text-[#95847C] block">Ganho por Hora Trabalhada</span>
                <strong className="font-editorial text-xl font-bold text-[#594943] tabular-nums">
                  {formatBRL(calcNetPerHour)}/h
                </strong>
                <span className="block text-[11px] text-[#95847C] mt-0.5">
                  Em {calcDurationMin} min de mesa
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB]">
                <span className="text-xs text-[#95847C] block">Margem Real de Lucro</span>
                <strong className="font-editorial text-xl font-bold text-[#C4A477] tabular-nums">
                  {calcMarginPct}%
                </strong>
                <span className="block text-[11px] text-[#95847C] mt-0.5">
                  {calcMarginPct >= 70 ? 'Excelente rentabilidade' : 'Atenção aos custos'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#594943] text-[#FAF6F1]">
                <span className="text-xs text-[#E8D6CB] block">Preço Ideal (Alvo 75% Margem)</span>
                <strong className="font-editorial text-xl font-bold text-[#C4A477] tabular-nums">
                  {formatBRL(calcSuggested75Price)}
                </strong>
                <span className="block text-[11px] text-[#E8D6CB]/80 mt-0.5">
                  Sugestão Luxury Nude
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
