import React from 'react';
import { AlertCircle, CheckCircle2, Inbox, Loader2, Sparkles } from 'lucide-react';
import { formatBRL } from '../../lib/utils';

// ------------------------------------------------------------------
// 1. ESTADOS OBRIGATÓRIOS (Carregamento, Sucesso, Erro, Ausência de Dados)
// ------------------------------------------------------------------
export type ScreenUiState = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export const LuxuryStateView: React.FC<{
  state: ScreenUiState;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ state, title, message, actionLabel, onAction }) => {
  if (state === 'idle') return null;

  const config = {
    loading: {
      icon: <Loader2 className="w-6 h-6 text-[#C4A477] animate-spin" />,
      bg: 'bg-[#FAF6F1] border-[#E8D6CB]',
      defaultTitle: 'Carregando informações...',
      defaultMsg: 'Sincronizando dados do atelier.',
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6 text-[#594943]" />,
      bg: 'bg-[#F2EAE4] border-[#C4A477]',
      defaultTitle: 'Operação concluída com sucesso',
      defaultMsg: 'Os dados foram atualizados e salvos.',
    },
    error: {
      icon: <AlertCircle className="w-6 h-6 text-[#BE9293]" />,
      bg: 'bg-[#FAF6F1] border-[#BE9293]',
      defaultTitle: 'Não foi possível concluir a ação',
      defaultMsg: 'Verifique os dados informados e tente novamente.',
    },
    empty: {
      icon: <Inbox className="w-6 h-6 text-[#95847C]" />,
      bg: 'bg-white border-[#E8D6CB]',
      defaultTitle: 'Nenhum registro encontrado',
      defaultMsg: 'Adicione um novo item para começar a visualizar os dados.',
    },
  }[state];

  return (
    <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${config.bg}`}>
      <div className="flex items-center gap-3.5 text-center sm:text-left flex-col sm:flex-row">
        <div className="w-11 h-11 rounded-xl bg-white border border-[#E8D6CB] flex items-center justify-center shrink-0">
          {config.icon}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-[#594943]">{title || config.defaultTitle}</h4>
          <p className="text-xs text-[#95847C] mt-0.5">{message || config.defaultMsg}</p>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-[38px] rounded-xl bg-[#594943] px-4 py-2 text-xs font-semibold text-white hover:bg-[#433631] transition-colors shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// 2. INDICADORES FINANCEIROS (Luxury KPI Card)
// ------------------------------------------------------------------
export const LuxuryKpiCard: React.FC<{
  label: string;
  value: string;
  subtitle?: string;
  accent?: 'gold' | 'rose' | 'brown' | 'nude';
  icon?: React.ReactNode;
}> = ({ label, value, subtitle, accent = 'gold', icon }) => {
  const accentMap = {
    gold: 'bg-[#FAF6F1] text-[#C4A477] border-[#C4A477]/30',
    rose: 'bg-[#F2EAE4] text-[#BE9293] border-[#BE9293]/30',
    brown: 'bg-[#594943] text-[#FAF6F1] border-[#594943]',
    nude: 'bg-[#E8D6CB]/40 text-[#594943] border-[#E8D6CB]',
  }[accent];

  return (
    <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4 sm:p-5 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#95847C]">{label}</span>
        <span className={`w-8 h-8 rounded-xl border flex items-center justify-center ${accentMap}`}>
          {icon || <Sparkles className="w-4 h-4" />}
        </span>
      </div>
      <div>
        <div className="font-editorial text-xl sm:text-2xl font-semibold text-[#594943] tabular-nums">
          {value}
        </div>
        {subtitle && <p className="text-[11px] text-[#95847C] mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 3. GRÁFICO MODERNO DE BARRAS LUXURY NUDE (Receitas x Despesas / Desempenho)
// ------------------------------------------------------------------
export interface ChartPoint {
  label: string;
  primary: number;
  secondary?: number;
}

export const LuxuryBarChart: React.FC<{
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}> = ({ title, subtitle, data, primaryLabel = 'Receitas', secondaryLabel = 'Despesas' }) => {
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.primary, d.secondary || 0]),
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="font-editorial text-lg font-semibold text-[#594943]">{title}</h4>
          {subtitle && <p className="text-xs text-[#95847C]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-xs text-[#95847C]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C4A477]" />
            {primaryLabel}
          </span>
          {data.some((d) => d.secondary !== undefined) && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#BE9293]" />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-7 gap-2.5 items-end h-40 pt-4 pb-1 border-b border-[#E8D6CB]">
        {data.map((pt, idx) => {
          const h1 = Math.max(8, Math.round((pt.primary / maxVal) * 100));
          const h2 = pt.secondary !== undefined ? Math.max(6, Math.round((pt.secondary / maxVal) * 100)) : 0;
          return (
            <div key={idx} className="flex flex-col items-center justify-end h-full gap-1.5">
              <div className="w-full flex items-end justify-center gap-1 h-full">
                <div
                  style={{ height: `${h1}%` }}
                  title={`${primaryLabel}: ${formatBRL(pt.primary)}`}
                  className="w-3 sm:w-4 rounded-t-lg bg-[#C4A477] transition-all"
                />
                {pt.secondary !== undefined && (
                  <div
                    style={{ height: `${h2}%` }}
                    title={`${secondaryLabel}: ${formatBRL(pt.secondary)}`}
                    className="w-3 sm:w-4 rounded-t-lg bg-[#BE9293] transition-all"
                  />
                )}
              </div>
              <span className="text-[11px] font-medium text-[#95847C] truncate max-w-full">
                {pt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
