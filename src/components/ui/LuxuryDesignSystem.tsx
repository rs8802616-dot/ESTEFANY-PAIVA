import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
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
          className="min-h-[38px] rounded-xl bg-[#594943] px-4 py-2 text-xs font-semibold text-white hover:bg-[#433631] transition-colors shrink-0 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// 2. INDICADORES FINANCEIROS (Luxury KPI Card com Tendência e Badge)
// ------------------------------------------------------------------
export const LuxuryKpiCard: React.FC<{
  label: string;
  value: string;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  accent?: 'gold' | 'rose' | 'brown' | 'nude';
  icon?: React.ReactNode;
}> = ({ label, value, subtitle, trend, trendPositive = true, accent = 'gold', icon }) => {
  const accentMap = {
    gold: 'bg-[#FAF6F1] text-[#C4A477] border-[#C4A477]/30',
    rose: 'bg-[#F2EAE4] text-[#BE9293] border-[#BE9293]/30',
    brown: 'bg-[#594943] text-[#FAF6F1] border-[#594943]',
    nude: 'bg-[#E8D6CB]/40 text-[#594943] border-[#E8D6CB]',
  }[accent];

  return (
    <div className="bg-white rounded-2xl border border-[#E8D6CB] p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-2xs hover:border-[#C4A477] transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#95847C]">{label}</span>
        <span className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${accentMap}`}>
          {icon || <Sparkles className="w-4 h-4" />}
        </span>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="font-editorial text-xl sm:text-2xl font-semibold text-[#594943] tabular-nums">
            {value}
          </div>
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                trendPositive
                  ? 'bg-[#4E7D5B]/15 text-[#4E7D5B]'
                  : 'bg-[#BE9293]/20 text-[#594943]'
              }`}
            >
              {trendPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-[#95847C] mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 3. GRÁFICO INTERATIVO DE BARRAS COMPARATIVAS COM ESCALA, RÓTULOS E DETALHE
// ------------------------------------------------------------------
export interface ChartPoint {
  label: string;
  primary: number;
  secondary?: number;
  balance?: number;
  count?: number;
}

export const LuxuryBarChart: React.FC<{
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}> = ({ title, subtitle, data, primaryLabel = 'Receitas', secondaryLabel = 'Despesas' }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const maxVal = Math.max(
    100,
    ...data.flatMap((d) => [d.primary, d.secondary || 0]),
  );

  const totalPrimary = data.reduce((acc, d) => acc + d.primary, 0);
  const totalSecondary = data.reduce((acc, d) => acc + (d.secondary || 0), 0);
  const bestPoint = [...data].sort((a, b) => b.primary - a.primary)[0];
  const activePoint = selectedIndex !== null ? data[selectedIndex] : null;

  const gridLevels = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-editorial text-xl font-semibold text-[#594943]">{title}</h4>
          {subtitle && <p className="text-xs text-[#95847C] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#594943]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF6F1] border border-[#E8D6CB]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C4A477]" />
            <span>{primaryLabel}:</span>
            <strong className="tabular-nums">{formatBRL(totalPrimary)}</strong>
          </span>
          {data.some((d) => d.secondary !== undefined) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF6F1] border border-[#E8D6CB]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#BE9293]" />
              <span>{secondaryLabel}:</span>
              <strong className="tabular-nums">{formatBRL(totalSecondary)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Painel de inspeção do ponto clicado */}
      {activePoint && (
        <div className="rounded-2xl bg-[#FAF6F1] border border-[#C4A477] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#594943] text-[#FAF6F1] font-bold">
              {activePoint.label}
            </span>
            <span className="text-[#95847C]">Detalhes do período selecionado</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <span>
              {primaryLabel}: <strong className="text-[#594943]">{formatBRL(activePoint.primary)}</strong>
            </span>
            {activePoint.secondary !== undefined && (
              <span>
                {secondaryLabel}: <strong className="text-[#BE9293]">{formatBRL(activePoint.secondary)}</strong>
              </span>
            )}
            {activePoint.secondary !== undefined && (
              <span>
                Saldo:{' '}
                <strong
                  className={
                    activePoint.primary - activePoint.secondary >= 0
                      ? 'text-[#4E7D5B]'
                      : 'text-[#B45353]'
                  }
                >
                  {formatBRL(activePoint.primary - activePoint.secondary)}
                </strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Área do Gráfico com Linhas de Grade Y e Barras Largas */}
      <div className="relative pt-4">
        <div className="flex">
          {/* Eixo Y */}
          <div className="hidden sm:flex flex-col justify-between h-56 pr-3 text-[10px] font-medium text-[#95847C] tabular-nums select-none">
            {gridLevels.map((lvl, i) => (
              <span key={i}>{formatBRL(Math.round(maxVal * lvl))}</span>
            ))}
          </div>

          {/* Grade + Colunas */}
          <div className="relative flex-1 h-56">
            {/* Linhas horizontais de referência */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {gridLevels.map((_, i) => (
                <div
                  key={i}
                  className={`w-full border-b ${
                    i === gridLevels.length - 1
                      ? 'border-[#594943]/30'
                      : 'border-dashed border-[#E8D6CB]'
                  }`}
                />
              ))}
            </div>

            {/* Colunas interativas */}
            <div
              className="relative z-10 grid h-full items-end gap-2 sm:gap-3 px-1"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`,
              }}
            >
              {data.map((pt, idx) => {
                const pct1 = pt.primary > 0 ? Math.max(8, Math.round((pt.primary / maxVal) * 100)) : 3;
                const pct2 =
                  pt.secondary !== undefined
                    ? pt.secondary > 0
                      ? Math.max(8, Math.round((pt.secondary / maxVal) * 100))
                      : 3
                    : 0;
                const isSelected = selectedIndex === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIndex(isSelected ? null : idx)}
                    className={`group h-full flex flex-col items-center justify-end rounded-xl px-1 pt-6 pb-0 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#F2EAE4]/70 ring-1 ring-[#C4A477]' : 'hover:bg-[#FAF6F1]/60'
                    }`}
                  >
                    {/* Rótulo de valor no topo da barra */}
                    <span className="text-[10px] font-bold text-[#594943] tabular-nums mb-1 opacity-85 group-hover:opacity-100 truncate max-w-full">
                      {pt.primary > 0 ? `R$${Math.round(pt.primary)}` : 'R$0'}
                    </span>

                    <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                      <div
                        style={{ height: `${pct1}%` }}
                        title={`${primaryLabel}: ${formatBRL(pt.primary)}`}
                        className={`w-4 sm:w-6 md:w-7 rounded-t-xl transition-all duration-300 ${
                          pt.primary > 0
                            ? 'bg-gradient-to-t from-[#594943] to-[#C4A477] shadow-2xs'
                            : 'bg-[#E8D6CB]/60'
                        }`}
                      />
                      {pt.secondary !== undefined && (
                        <div
                          style={{ height: `${pct2}%` }}
                          title={`${secondaryLabel}: ${formatBRL(pt.secondary)}`}
                          className={`w-3.5 sm:w-5 md:w-6 rounded-t-xl transition-all duration-300 ${
                            pt.secondary > 0
                              ? 'bg-gradient-to-t from-[#BE9293] to-[#E8D6CB]'
                              : 'bg-[#E8D6CB]/40'
                          }`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rótulos do Eixo X */}
        <div className="flex mt-2">
          <div className="hidden sm:block w-16 pr-3" />
          <div
            className="flex-1 grid gap-2 sm:gap-3 text-center"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`,
            }}
          >
            {data.map((pt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIndex(selectedIndex === idx ? null : idx)}
                className={`text-[11px] font-semibold truncate py-1 rounded-lg cursor-pointer transition-colors ${
                  selectedIndex === idx
                    ? 'bg-[#594943] text-[#FAF6F1]'
                    : 'text-[#594943] hover:bg-[#FAF6F1]'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rodapé Analítico Rápido */}
      <div className="pt-3 border-t border-[#E8D6CB] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB]/70 flex items-center justify-between">
          <span className="text-[#95847C]">Maior pico ({bestPoint?.label || '-'}):</span>
          <strong className="text-[#594943] tabular-nums">{formatBRL(bestPoint?.primary || 0)}</strong>
        </div>
        <div className="p-3 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB]/70 flex items-center justify-between">
          <span className="text-[#95847C]">Média por período:</span>
          <strong className="text-[#594943] tabular-nums">
            {formatBRL(data.length > 0 ? totalPrimary / data.length : 0)}
          </strong>
        </div>
        <div className="p-3 rounded-xl bg-[#F2EAE4] border border-[#E8D6CB] flex items-center justify-between">
          <span className="text-[#594943] font-medium">Resultado Líquido:</span>
          <strong
            className={`tabular-nums ${
              totalPrimary - totalSecondary >= 0 ? 'text-[#4E7D5B]' : 'text-[#B45353]'
            }`}
          >
            {formatBRL(totalPrimary - totalSecondary)}
          </strong>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 4. GRÁFICO DE CURVA DE ÁREA & EVOLUÇÃO DE SALDO EM SVG (LuxuryAreaLineChart)
// ------------------------------------------------------------------
export const LuxuryAreaLineChart: React.FC<{
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}> = ({
  title,
  subtitle,
  data,
  primaryLabel = 'Entradas / Saldo',
  secondaryLabel = 'Saídas',
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const safeData = data.length > 0 ? data : [{ label: 'Hoje', primary: 0, secondary: 0 }];
  const maxVal = Math.max(
    100,
    ...safeData.flatMap((d) => [Math.max(0, d.primary), Math.max(0, d.secondary || 0)]),
  );

  const width = 720;
  const height = 220;
  const padX = 36;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const getCoords = (values: number[]) =>
    values.map((val, idx) => {
      const x =
        safeData.length === 1
          ? padX + innerW / 2
          : padX + (idx / (safeData.length - 1)) * innerW;
      const clamped = Math.max(0, val);
      const y = padY + innerH - (clamped / maxVal) * innerH;
      return { x, y, val };
    });

  const primaryPts = getCoords(safeData.map((d) => d.primary));
  const hasSecondary = safeData.some((d) => d.secondary !== undefined);
  const secondaryPts = hasSecondary ? getCoords(safeData.map((d) => d.secondary || 0)) : [];

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const primaryLine = buildPath(primaryPts);
  const primaryArea =
    primaryPts.length > 0
      ? `${primaryLine} L ${primaryPts[primaryPts.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${primaryPts[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
      : '';

  const secondaryLine = hasSecondary ? buildPath(secondaryPts) : '';

  return (
    <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="font-editorial text-xl font-semibold text-[#594943]">{title}</h4>
          {subtitle && <p className="text-xs text-[#95847C] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-[#594943]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#C4A477]" />
            {primaryLabel}
          </span>
          {hasSecondary && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-[#BE9293]" />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height + 26}`}
          className="w-full h-56 sm:h-64 select-none"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id="luxuryGoldArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C4A477" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#C4A477" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Linhas de grade horizontais */}
          {[0, 0.25, 0.5, 0.75, 1].map((step, i) => {
            const y = padY + step * innerH;
            const labelVal = Math.round(maxVal * (1 - step));
            return (
              <g key={i}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="#E8D6CB"
                  strokeDasharray={step === 1 ? undefined : '4 4'}
                  strokeWidth={step === 1 ? '1.5' : '1'}
                />
                <text
                  x={padX - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#95847C] text-[9px]"
                >
                  {labelVal}
                </text>
              </g>
            );
          })}

          {/* Área preenchida e linha principal */}
          {primaryArea && <path d={primaryArea} fill="url(#luxuryGoldArea)" />}
          {primaryLine && (
            <path
              d={primaryLine}
              fill="none"
              stroke="#594943"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Linha secundária (Despesas) */}
          {secondaryLine && (
            <path
              d={secondaryLine}
              fill="none"
              stroke="#BE9293"
              strokeWidth="2.4"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Pontos interativos */}
          {primaryPts.map((pt, idx) => {
            const active = hoverIdx === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                onClick={() => setHoverIdx(active ? null : idx)}
                onMouseEnter={() => setHoverIdx(idx)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={active ? 7 : 5}
                  fill="#FAF6F1"
                  stroke="#594943"
                  strokeWidth="2.5"
                />
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  className="fill-[#594943] text-[10px] font-bold"
                >
                  R${Math.round(pt.val)}
                </text>
                <text
                  x={pt.x}
                  y={height + 16}
                  textAnchor="middle"
                  className="fill-[#95847C] text-[11px] font-semibold"
                >
                  {safeData[idx].label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 5. GRÁFICO DE ROSCA / DONUT SVG INTERATIVO (LuxuryDonutChart)
// ------------------------------------------------------------------
export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

const LUXURY_DONUT_COLORS = ['#594943', '#C4A477', '#BE9293', '#95847C', '#D6B99B', '#7D675E'];

export const LuxuryDonutChart: React.FC<{
  title: string;
  subtitle?: string;
  centerLabel?: string;
  slices: DonutSlice[];
}> = ({ title, subtitle, centerLabel = 'Total', slices }) => {
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  const positiveSlices = slices.filter((s) => s.value > 0);
  const total = positiveSlices.reduce((acc, s) => acc + s.value, 0);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPct = 0;

  return (
    <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
      <div>
        <h4 className="font-editorial text-xl font-semibold text-[#594943]">{title}</h4>
        {subtitle && <p className="text-xs text-[#95847C] mt-0.5">{subtitle}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
        {/* SVG Donut */}
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#F2EAE4"
              strokeWidth="20"
            />
            {total > 0 &&
              positiveSlices.map((slice, idx) => {
                const pct = slice.value / total;
                const dash = pct * circumference;
                const offset = -accumulatedPct * circumference;
                accumulatedPct += pct;
                const color = slice.color || LUXURY_DONUT_COLORS[idx % LUXURY_DONUT_COLORS.length];
                const isSelected = activeSlice === idx;

                return (
                  <circle
                    key={idx}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected ? '24' : '20'}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-300 cursor-pointer"
                    onClick={() => setActiveSlice(isSelected ? null : idx)}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#95847C]">
              {activeSlice !== null && positiveSlices[activeSlice]
                ? positiveSlices[activeSlice].label
                : centerLabel}
            </span>
            <span className="font-editorial text-base sm:text-lg font-bold text-[#594943] tabular-nums">
              {activeSlice !== null && positiveSlices[activeSlice]
                ? formatBRL(positiveSlices[activeSlice].value)
                : formatBRL(total)}
            </span>
          </div>
        </div>

        {/* Legenda Detalhada com Percentuais */}
        <div className="space-y-2">
          {positiveSlices.length === 0 ? (
            <p className="text-xs text-[#95847C]">
              Sem valores lançados nesta categoria. Adicione registros ou carregue os dados de exemplo.
            </p>
          ) : (
            positiveSlices.map((slice, idx) => {
              const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
              const color = slice.color || LUXURY_DONUT_COLORS[idx % LUXURY_DONUT_COLORS.length];
              const isSelected = activeSlice === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlice(isSelected ? null : idx)}
                  className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#F2EAE4] border-[#C4A477]'
                      : 'bg-[#FAF6F1] border-[#E8D6CB]/70 hover:bg-[#F2EAE4]/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-semibold text-[#594943] truncate">
                      {slice.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="text-xs font-bold text-[#594943]">
                      {formatBRL(slice.value)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-white text-[10px] font-bold text-[#C4A477] border border-[#E8D6CB]">
                      {pct}%
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 6. VELOCÍMETRO DE META, PROJEÇÃO E PONTO DE EQUILÍBRIO (LuxuryGaugeCard)
// ------------------------------------------------------------------
export const LuxuryGaugeCard: React.FC<{
  currentRevenue: number;
  monthlyGoal: number;
  totalExpenses: number;
  avgTicket: number;
}> = ({ currentRevenue, monthlyGoal, totalExpenses, avgTicket }) => {
  const safeGoal = Math.max(1, monthlyGoal || 5000);
  const pct = Math.min(100, Math.max(0, Math.round((currentRevenue / safeGoal) * 100)));
  const remainingGoal = Math.max(0, safeGoal - currentRevenue);
  const effectiveTicket = avgTicket > 0 ? avgTicket : 140;
  const appointmentsNeededForGoal = Math.ceil(remainingGoal / effectiveTicket);
  const breakEvenRemaining = Math.max(0, totalExpenses - currentRevenue);
  const isBreakEvenReached = currentRevenue >= totalExpenses;

  // Semi-circle gauge arc
  const radius = 66;
  const arcLength = Math.PI * radius;
  const filledArc = (pct / 100) * arcLength;

  return (
    <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs flex flex-col justify-between">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
          Inteligência Financeira & Metas
        </span>
        <h4 className="font-editorial text-xl font-semibold text-[#594943]">
          Termômetro da Meta & Ponto de Equilíbrio
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* SVG Semi-Circular Gauge */}
        <div className="relative w-48 h-28 mx-auto flex flex-col items-center justify-end">
          <svg viewBox="0 0 160 95" className="w-full h-full">
            <path
              d="M 14 80 A 66 66 0 0 1 146 80"
              fill="none"
              stroke="#F2EAE4"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              d="M 14 80 A 66 66 0 0 1 146 80"
              fill="none"
              stroke="#C4A477"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${filledArc} ${arcLength}`}
            />
          </svg>
          <div className="absolute bottom-1 text-center">
            <span className="font-editorial text-2xl font-bold text-[#594943] tabular-nums">
              {pct}%
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-[#95847C]">
              da Meta Mensal
            </span>
          </div>
        </div>

        {/* Insights Acionáveis */}
        <div className="space-y-2.5 text-xs">
          <div className="p-3 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB]">
            <span className="text-[#95847C] block">Faltam para a Meta ({formatBRL(safeGoal)}):</span>
            <strong className="text-sm text-[#594943] tabular-nums">
              {remainingGoal > 0
                ? `${formatBRL(remainingGoal)} (~${appointmentsNeededForGoal} atendimentos)`
                : 'Meta 100% atingida! 🎉'}
            </strong>
          </div>

          <div className="p-3 rounded-2xl bg-[#F2EAE4] border border-[#E8D6CB]">
            <span className="text-[#594943] font-medium block">Ponto de Equilíbrio (Custos):</span>
            <strong
              className={`text-sm tabular-nums ${
                isBreakEvenReached ? 'text-[#4E7D5B]' : 'text-[#BE9293]'
              }`}
            >
              {isBreakEvenReached
                ? `Custos cobertos (+${formatBRL(currentRevenue - totalExpenses)} lucro)`
                : `Faltam ${formatBRL(breakEvenRemaining)} p/ cobrir despesas`}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
