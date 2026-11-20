import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileBarChart,
  Plus,
  Printer,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { LuxuryBarChart, LuxuryKpiCard, LuxuryStateView, type ScreenUiState } from '../ui/LuxuryDesignSystem';
import { AdminReportsTab } from './AdminReportsSettingsTabs';
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

interface ExpenseItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  paid: boolean;
}

interface ManualRevenueItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  received: boolean;
}

const EXPENSES_KEY = 'epn_luxury_expenses_v1';
const REVENUES_KEY = 'epn_luxury_manual_revenues_v1';

const INITIAL_EXPENSES: ExpenseItem[] = [
  { id: 'exp_1', description: 'Kit Gel Construtor & Top Coat', category: 'Insumos', amount: 245, date: todayISO(), paid: true },
  { id: 'exp_2', description: 'Lixas, Brocas e Descartáveis', category: 'Materiais', amount: 130, date: todayISO(), paid: true },
  { id: 'exp_3', description: 'Reposição Fibra de Vidro Premium', category: 'Insumos', amount: 180, date: todayISO(), paid: false },
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
    return raw ? (JSON.parse(raw) as ManualRevenueItem[]) : [];
  } catch {
    return [];
  }
}

export const AdminFinanceSuite: React.FC<{
  appointments: Appointment[];
  settings: SalonSettings;
  initialSubScreen?: FinanceSubScreen;
}> = ({ appointments, settings, initialSubScreen = 'resumo_financeiro' }) => {
  const [subScreen, setSubScreen] = useState<FinanceSubScreen>(initialSubScreen);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => loadExpenses());
  const [manualRevenues, setManualRevenues] = useState<ManualRevenueItem[]>(() => loadManualRevenues());
  const [uiState, setUiState] = useState<ScreenUiState>('idle');

  // Form states
  const [expDesc, setExpDesc] = useState('');
  const [expCat, setExpCat] = useState('Insumos');
  const [expVal, setExpVal] = useState('');
  const [expDate, setExpDate] = useState(todayISO());
  const [expPaid, setExpPaid] = useState(true);

  const [revDesc, setRevDesc] = useState('');
  const [revVal, setRevVal] = useState('');
  const [revDate, setRevDate] = useState(todayISO());

  React.useEffect(() => {
    setSubScreen(initialSubScreen);
  }, [initialSubScreen]);

  const saveExpensesList = (next: ExpenseItem[]) => {
    setExpenses(next);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(next));
  };

  const saveRevenuesList = (next: ManualRevenueItem[]) => {
    setManualRevenues(next);
    localStorage.setItem(REVENUES_KEY, JSON.stringify(next));
  };

  const validAppointments = useMemo(
    () => appointments.filter((a) => a.status !== 'cancelled'),
    [appointments],
  );

  const totalAppRevenue = useMemo(
    () => validAppointments.reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0),
    [validAppointments],
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
    () =>
      validAppointments
        .filter((a) => a.status === 'pending')
        .reduce((acc, a) => acc + (Number(a.totalPrice) || 0), 0),
    [validAppointments],
  );

  const netProfit = totalRevenue - totalPaidExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const goalPct = settings.monthlyGoal > 0 ? Math.min(100, Math.round((totalRevenue / settings.monthlyGoal) * 100)) : 0;

  const chartData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const baseRev = Math.max(180, Math.round(totalRevenue / 6));
    const baseExp = Math.max(45, Math.round(totalPaidExpenses / 6));
    return labels.map((label, idx) => ({
      label,
      primary: Math.round(baseRev * (0.75 + (idx % 3) * 0.25)),
      secondary: Math.round(baseExp * (0.6 + (idx % 2) * 0.3)),
    }));
  }, [totalRevenue, totalPaidExpenses]);

  const servicePerformance = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    validAppointments.forEach((apt) => {
      const name = apt.serviceNames.join(' + ') || 'Procedimento';
      const cur = map.get(name) || { name, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(apt.totalPrice) || 0;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [validAppointments]);

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

  const exportMonthlyClosingCSV = () => {
    const rows = [
      ['Tipo', 'Data', 'Descricao', 'Valor (R$)', 'Status'],
      ...validAppointments.map((a) => [
        'Receita Atendimento',
        a.date,
        `${a.clientName} - ${a.serviceNames.join(' + ')}`,
        String(a.totalPrice),
        a.status,
      ]),
      ...manualRevenues.map((r) => ['Receita Extra', r.date, r.description, String(r.amount), 'Recebido']),
      ...expenses.map((ex) => ['Despesa', ex.date, `${ex.category}: ${ex.description}`, String(-ex.amount), ex.paid ? 'Pago' : 'Pendente']),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fechamento-luxury-nude-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-print">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setUiState('idle');
              setSubScreen(item.id);
            }}
            className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              subScreen === item.id
                ? 'bg-[#594943] text-white'
                : 'bg-white border border-[#E8D6CB] text-[#95847C] hover:text-[#594943]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <LuxuryStateView state={uiState} />

      {/* TELA 17: RESUMO FINANCEIRO */}
      {subScreen === 'resumo_financeiro' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <LuxuryKpiCard
              label="Receita Total"
              value={formatBRL(totalRevenue)}
              subtitle={`${validAppointments.length} atendimentos`}
              accent="gold"
              icon={<ArrowUpRight className="w-4 h-4" />}
            />
            <LuxuryKpiCard
              label="Despesas Pagas"
              value={formatBRL(totalPaidExpenses)}
              subtitle={`${expenses.length} lançamentos`}
              accent="rose"
              icon={<ArrowDownRight className="w-4 h-4" />}
            />
            <LuxuryKpiCard
              label="Lucro Líquido"
              value={formatBRL(netProfit)}
              subtitle={`Margem de ${profitMargin}%`}
              accent="brown"
              icon={<Wallet className="w-4 h-4" />}
            />
            <LuxuryKpiCard
              label="Meta Mensal"
              value={`${goalPct}%`}
              subtitle={`Alvo: ${formatBRL(settings.monthlyGoal)}`}
              accent="nude"
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>

          <LuxuryBarChart
            title="Balanço Semanal — Luxury Nude"
            subtitle="Comparativo entre entradas de procedimentos e custos operacionais"
            data={chartData}
          />
        </div>
      )}

      {/* TELA 18: RECEITAS */}
      {subScreen === 'receitas' && (
        <div className="space-y-5">
          <form onSubmit={handleAddRevenue} className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">18. Lançar Nova Receita</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={revDesc}
                onChange={(e) => setRevDesc(e.target.value)}
                placeholder="Descrição (ex: Curso / Produto)"
                className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
              />
              <input
                type="number"
                step="0.01"
                value={revVal}
                onChange={(e) => setRevVal(e.target.value)}
                placeholder="Valor R$"
                className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={revDate}
                  onChange={(e) => setRevDate(e.target.value)}
                  className="flex-1 min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
                />
                <button
                  type="submit"
                  className="min-h-[42px] rounded-xl bg-[#594943] px-4 text-xs font-semibold text-white inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-[#C4A477]" />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-3">
            <h4 className="font-editorial text-lg font-semibold text-[#594943]">Entradas Registradas</h4>
            {validAppointments.length === 0 && manualRevenues.length === 0 ? (
              <LuxuryStateView state="empty" title="Nenhuma receita registrada" />
            ) : (
              <div className="divide-y divide-[#E8D6CB]/60">
                {manualRevenues.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">{r.description}</div>
                      <div className="text-xs text-[#95847C]">{formatDateBR(r.date)} · Receita Extra</div>
                    </div>
                    <span className="text-sm font-bold text-[#594943] tabular-nums">+{formatBRL(r.amount)}</span>
                  </div>
                ))}
                {validAppointments.slice(0, 12).map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">
                        {a.clientName} — {a.serviceNames.join(' + ')}
                      </div>
                      <div className="text-xs text-[#95847C]">
                        {formatDateBR(a.date)} às {a.startTime} · {a.paymentMethod.toUpperCase()}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#594943] tabular-nums">+{formatBRL(a.totalPrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TELA 19: DESPESAS */}
      {subScreen === 'despesas' && (
        <div className="space-y-5">
          <form onSubmit={handleAddExpense} className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">19. Registrar Despesa do Atelier</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Ex: Gel Nude / Cabine / Aluguel"
                className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
              />
              <select
                value={expCat}
                onChange={(e) => setExpCat(e.target.value)}
                className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3 text-sm text-[#594943]"
              >
                <option value="Insumos">Insumos & Géis</option>
                <option value="Materiais">Descartáveis & Lixas</option>
                <option value="Estrutura">Aluguel & Energia</option>
                <option value="Marketing">Marketing & Embalagens</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={expVal}
                onChange={(e) => setExpVal(e.target.value)}
                placeholder="Valor R$"
                className="min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-sm text-[#594943]"
              />
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-[#594943] px-4 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-[#C4A477]" />
                <span>Adicionar Despesa</span>
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-3">
            <h4 className="font-editorial text-lg font-semibold text-[#594943]">Histórico de Despesas</h4>
            {expenses.length === 0 ? (
              <LuxuryStateView state="empty" title="Nenhuma despesa cadastrada" />
            ) : (
              <div className="divide-y divide-[#E8D6CB]/60">
                {expenses.map((ex) => (
                  <div key={ex.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">{ex.description}</div>
                      <div className="text-xs text-[#95847C]">
                        {ex.category} · {formatDateBR(ex.date)} · {ex.paid ? 'Pago' : 'A pagar'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#BE9293] tabular-nums">-{formatBRL(ex.amount)}</span>
                      <button
                        type="button"
                        onClick={() => saveExpensesList(expenses.filter((i) => i.id !== ex.id))}
                        className="p-1.5 text-[#95847C] hover:text-[#594943]"
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

      {/* TELA 20: FLUXO DE CAIXA */}
      {subScreen === 'fluxo_caixa' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <LuxuryKpiCard label="Entradas Realizadas" value={formatBRL(totalRevenue)} accent="gold" />
            <LuxuryKpiCard label="Saídas Realizadas" value={formatBRL(totalPaidExpenses)} accent="rose" />
            <LuxuryKpiCard label="Saldo em Caixa" value={formatBRL(netProfit)} accent="brown" />
          </div>
          <LuxuryBarChart
            title="20. Fluxo de Caixa Consolidado"
            subtitle="Evolução diária de entradas e saídas de recursos do atelier"
            data={chartData}
          />
        </div>
      )}

      {/* TELA 21: CONTAS A PAGAR E RECEBER */}
      {subScreen === 'contas_pagar_receber' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">Contas a Pagar</h3>
              <span className="text-xs font-semibold text-[#BE9293]">{formatBRL(totalPendingExpenses)}</span>
            </div>
            {expenses.filter((e) => !e.paid).length === 0 ? (
              <LuxuryStateView state="empty" title="Nenhuma conta pendente" message="Todas as despesas estão quitadas." />
            ) : (
              expenses
                .filter((e) => !e.paid)
                .map((ex) => (
                  <div key={ex.id} className="p-3.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">{ex.description}</div>
                      <div className="text-xs text-[#95847C]">{formatDateBR(ex.date)} · {formatBRL(ex.amount)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        saveExpensesList(expenses.map((i) => (i.id === ex.id ? { ...i, paid: true } : i)))
                      }
                      className="min-h-[34px] rounded-lg bg-[#594943] px-3 text-xs font-semibold text-white inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C4A477]" />
                      <span>Dar Baixa</span>
                    </button>
                  </div>
                ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-xl font-semibold text-[#594943]">Valores a Receber</h3>
              <span className="text-xs font-semibold text-[#C4A477]">{formatBRL(pendingReceivables)}</span>
            </div>
            {validAppointments.filter((a) => a.status === 'pending').length === 0 ? (
              <LuxuryStateView state="empty" title="Nenhum recebimento pendente" message="Todos os agendamentos ativos estão confirmados." />
            ) : (
              validAppointments
                .filter((a) => a.status === 'pending')
                .map((a) => (
                  <div key={a.id} className="p-3.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#594943]">{a.clientName}</div>
                      <div className="text-xs text-[#95847C]">{formatDateBR(a.date)} · {a.serviceNames.join(' + ')}</div>
                    </div>
                    <span className="text-sm font-bold text-[#594943]">{formatBRL(a.totalPrice)}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* TELA 22: FECHAMENTO MENSAL */}
      {subScreen === 'fechamento_mensal' && (
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8D6CB] pb-4">
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-[#594943]">22. Fechamento Mensal do Atelier</h3>
              <p className="text-xs text-[#95847C]">Demonstrativo consolidado de resultados (DRE Luxury Nude)</p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={exportMonthlyClosingCSV}
                className="min-h-[38px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] px-3.5 text-xs font-semibold text-[#594943] inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Exportar CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[38px] rounded-xl bg-[#594943] px-3.5 text-xs font-semibold text-white inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Imprimir PDF</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-[#E8D6CB]/60">
              <span className="text-[#95847C]">(+) Receita de Procedimentos</span>
              <strong className="text-[#594943]">{formatBRL(totalAppRevenue)}</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-[#E8D6CB]/60">
              <span className="text-[#95847C]">(+) Receitas Extras</span>
              <strong className="text-[#594943]">{formatBRL(totalManualRevenue)}</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-[#E8D6CB]/60">
              <span className="text-[#95847C]">(-) Despesas Operacionais & Insumos</span>
              <strong className="text-[#BE9293]">-{formatBRL(totalPaidExpenses)}</strong>
            </div>
            <div className="flex justify-between py-3 px-4 rounded-xl bg-[#F2EAE4] text-base">
              <strong className="text-[#594943]">(=) Resultado Líquido do Mês</strong>
              <strong className="text-[#594943]">{formatBRL(netProfit)} ({profitMargin}% margem)</strong>
            </div>
          </div>
        </div>
      )}

      {/* TELA 23: RELATÓRIOS GERAIS */}
      {subScreen === 'relatorios_gerais' && <AdminReportsTab appointments={appointments} />}

      {/* TELA 24: RELATÓRIOS DE DESEMPENHO */}
      {subScreen === 'relatorios_desempenho' && (
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-[#C4A477]" />
            <h3 className="font-editorial text-xl font-semibold text-[#594943]">24. Desempenho por Procedimento</h3>
          </div>
          {servicePerformance.length === 0 ? (
            <LuxuryStateView state="empty" title="Sem dados de desempenho ainda" />
          ) : (
            <div className="space-y-3">
              {servicePerformance.map((item, idx) => {
                const share = totalAppRevenue > 0 ? Math.round((item.revenue / totalAppRevenue) * 100) : 0;
                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB] space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <strong className="text-[#594943]">{item.name}</strong>
                      <span className="font-bold text-[#594943]">{formatBRL(item.revenue)} ({share}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E8D6CB] overflow-hidden">
                      <div style={{ width: `${Math.max(6, share)}%` }} className="h-full bg-[#C4A477] rounded-full" />
                    </div>
                    <div className="text-xs text-[#95847C]">{item.count} atendimento(s) concluídos/confirmados</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
