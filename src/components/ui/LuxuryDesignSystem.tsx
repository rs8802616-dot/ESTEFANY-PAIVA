import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Flame,
  Inbox,
  LayoutGrid,
  Loader2,
  SlidersHorizontal,
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
// HELPER: Geração de Curva Suave Cubic Bezier (Catmull-Rom / Monotone Spline)
// ------------------------------------------------------------------
function buildSmoothBezierPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

// ------------------------------------------------------------------
// 3. SUPER-COMPONENTE DE GRÁFICOS MODERNOS (4 ESTILOS INTERATIVOS)
// 1) Barras Horizontais Estilo Nubank/Apple
// 2) Colunas em Cápsula Preenchida (com valor colado na barra)
// 3) Ondas Suaves Spline (Bezier)
// 4) Cards de Mapa de Calor & Performance
// ------------------------------------------------------------------
export interface ChartPoint {
  label: string;
  primary: number;
  secondary?: number;
  balance?: number;
  count?: number;
}

type ModernChartMode = 'horizontal' | 'capsules' | 'spline' | 'heatmap';

const CHART_MODE_STORAGE_KEY = 'ep_nails_preferred_chart_mode_v46';

function loadPreferredChartMode(fallback: ModernChartMode): ModernChartMode {
  try {
    const saved = localStorage.getItem(CHART_MODE_STORAGE_KEY) as ModernChartMode | null;
    if (saved && ['horizontal', 'capsules', 'spline', 'heatmap'].includes(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export const LuxuryBarChart: React.FC<{
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
  defaultMode?: ModernChartMode;
}> = ({
  title,
  subtitle,
  data,
  primaryLabel = 'Entradas',
  secondaryLabel = 'Saídas',
  defaultMode = 'horizontal',
}) => {
  const [mode, setMode] = useState<ModernChartMode>(() => loadPreferredChartMode(defaultMode));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const changeMode = (next: ModernChartMode) => {
    setMode(next);
    try {
      localStorage.setItem(CHART_MODE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const maxVal = Math.max(
    100,
    ...data.flatMap((d) => [d.primary, d.secondary || 0]),
  );

  const totalPrimary = data.reduce((acc, d) => acc + d.primary, 0);
  const totalSecondary = data.reduce((acc, d) => acc + (d.secondary || 0), 0);
  const hasSecondary = data.some((d) => d.secondary !== undefined);
  const bestPoint = [...data].sort((a, b) => b.primary - a.primary)[0];

  // Spline coordinates for mode === 'spline'
  const svgW = 860;
  const svgH = 210;
  const padX = 32;
  const padY = 26;
  const innerW = svgW - padX * 2;
  const innerH = svgH - padY * 2;

  const splinePrimaryPts = data.map((d, idx) => {
    const x = data.length <= 1 ? padX + innerW / 2 : padX + (idx / (data.length - 1)) * innerW;
    const y = padY + innerH - (Math.max(0, d.primary) / maxVal) * innerH;
    return { x, y, val: d.primary, label: d.label };
  });

  const splineSecondaryPts = data.map((d, idx) => {
    const x = data.length <= 1 ? padX + innerW / 2 : padX + (idx / (data.length - 1)) * innerW;
    const y = padY + innerH - (Math.max(0, d.secondary || 0) / maxVal) * innerH;
    return { x, y, val: d.secondary || 0, label: d.label };
  });

  const smoothPrimaryLine = buildSmoothBezierPath(splinePrimaryPts);
  const smoothPrimaryArea =
    splinePrimaryPts.length > 0
      ? `${smoothPrimaryLine} L ${splinePrimaryPts[splinePrimaryPts.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${splinePrimaryPts[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
      : '';
  const smoothSecondaryLine = hasSecondary ? buildSmoothBezierPath(splineSecondaryPts) : '';

  return (
    <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-5 shadow-2xs">
      {/* Top Header + Seletor de 4 Modelos de Gráficos */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E8D6CB]/70 pb-4">
        <div>
          <h4 className="font-editorial text-xl sm:text-2xl font-semibold text-[#594943]">
            {title}
          </h4>
          {subtitle && <p className="text-xs text-[#95847C] mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 4-Style Chart Switcher */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl bg-[#FAF6F1] p-1 border border-[#E8D6CB]">
            <button
              type="button"
              onClick={() => changeMode('horizontal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'horizontal'
                  ? 'bg-[#594943] text-white shadow-2xs'
                  : 'text-[#95847C] hover:text-[#594943]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Barras Horizontais</span>
            </button>
            <button
              type="button"
              onClick={() => changeMode('capsules')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'capsules'
                  ? 'bg-[#594943] text-white shadow-2xs'
                  : 'text-[#95847C] hover:text-[#594943]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Cápsulas</span>
            </button>
            <button
              type="button"
              onClick={() => changeMode('spline')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'spline'
                  ? 'bg-[#594943] text-white shadow-2xs'
                  : 'text-[#95847C] hover:text-[#594943]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Ondas Suaves</span>
            </button>
            <button
              type="button"
              onClick={() => changeMode('heatmap')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'heatmap'
                  ? 'bg-[#594943] text-white shadow-2xs'
                  : 'text-[#95847C] hover:text-[#594943]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#C4A477]" />
              <span>Cards de Calor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Resumo de Legenda no Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB]">
            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-[#594943] to-[#C4A477]" />
            <span className="text-[#95847C]">{primaryLabel}:</span>
            <strong className="text-[#594943] tabular-nums">{formatBRL(totalPrimary)}</strong>
          </span>
          {hasSecondary && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF6F1] border border-[#E8D6CB]">
              <span className="w-3 h-3 rounded-full bg-[#BE9293]" />
              <span className="text-[#95847C]">{secondaryLabel}:</span>
              <strong className="text-[#BE9293] tabular-nums">{formatBRL(totalSecondary)}</strong>
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F2EAE4] text-[#594943] font-semibold">
          <span>Saldo do Período:</span>
          <strong
            className={`tabular-nums ${
              totalPrimary - totalSecondary >= 0 ? 'text-[#4E7D5B]' : 'text-[#B45353]'
            }`}
          >
            {formatBRL(totalPrimary - totalSecondary)}
          </strong>
        </span>
      </div>

      {/* MODELO 1: BARRAS HORIZONTAIS EXECUTIVAS ESTILO NUBANK / APPLE HEALTH */}
      {mode === 'horizontal' && (
        <div className="space-y-3">
          {data.map((pt, idx) => {
            const pct1 = Math.min(100, Math.round((pt.primary / maxVal) * 100));
            const pct2 =
              pt.secondary !== undefined
                ? Math.min(100, Math.round((pt.secondary / maxVal) * 100))
                : 0;
            const net = pt.primary - (pt.secondary || 0);
            const isSelected = selectedIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => setSelectedIndex(isSelected ? null : idx)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#F2EAE4]/80 border-[#C4A477] shadow-2xs'
                    : 'bg-[#FAF6F1]/75 border-[#E8D6CB] hover:border-[#C4A477]/60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-[#594943] text-[#FAF6F1] text-xs font-bold min-w-[48px] text-center">
                      {pt.label}
                    </span>
                    {pt.primary === bestPoint?.primary && pt.primary > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C4A477]/20 text-[#594943] text-[10px] font-bold">
                        <Flame className="w-3 h-3 text-[#C4A477]" />
                        Recorde
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                    <span className="text-[#594943]">
                      {primaryLabel}: <strong className="text-[#4E7D5B]">{formatBRL(pt.primary)}</strong>
                    </span>
                    {pt.secondary !== undefined && (
                      <span className="text-[#95847C]">
                        {secondaryLabel}: <strong className="text-[#BE9293]">{formatBRL(pt.secondary)}</strong>
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-lg font-bold ${
                        net >= 0
                          ? 'bg-[#4E7D5B]/15 text-[#4E7D5B]'
                          : 'bg-[#B45353]/15 text-[#B45353]'
                      }`}
                    >
                      Saldo: {net >= 0 ? `+${formatBRL(net)}` : formatBRL(net)}
                    </span>
                  </div>
                </div>

                {/* Trilhos Horizontais Duplos */}
                <div className="space-y-1.5">
                  <div className="w-full h-3.5 rounded-full bg-white border border-[#E8D6CB] overflow-hidden p-0.5">
                    <div
                      style={{ width: `${pt.primary > 0 ? Math.max(4, pct1) : 0}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-[#594943] via-[#8C6D53] to-[#C4A477] transition-all duration-500"
                    />
                  </div>
                  {pt.secondary !== undefined && pt.secondary > 0 && (
                    <div className="w-full h-2 rounded-full bg-white/80 border border-[#E8D6CB]/60 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(3, pct2)}%` }}
                        className="h-full rounded-full bg-[#BE9293] transition-all duration-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODELO 2: COLUNAS EM CÁPSULAS PREENCHIDAS (COM RÓTULO COLADO NA BARRA) */}
      {mode === 'capsules' && (
        <div
          className="grid gap-3 pt-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`,
          }}
        >
          {data.map((pt, idx) => {
            const pct1 = pt.primary > 0 ? Math.max(12, Math.round((pt.primary / maxVal) * 100)) : 4;
            const pct2 =
              pt.secondary !== undefined && pt.secondary > 0
                ? Math.max(10, Math.round((pt.secondary / maxVal) * 100))
                : 0;
            const net = pt.primary - (pt.secondary || 0);

            return (
              <div
                key={idx}
                className="bg-[#FAF6F1] rounded-2xl border border-[#E8D6CB] p-2.5 sm:p-3 flex flex-col justify-between gap-2.5 hover:border-[#C4A477] transition-all"
              >
                {/* Topo da cápsula: Dia + Valor principal */}
                <div className="text-center">
                  <span className="text-xs font-bold text-[#594943] block">{pt.label}</span>
                  <span className="text-[11px] font-bold text-[#4E7D5B] tabular-nums block mt-0.5">
                    {formatBRL(pt.primary)}
                  </span>
                </div>

                {/* Trilho vertical com barra preenchida e valor colado */}
                <div className="h-44 w-full rounded-xl bg-white border border-[#E8D6CB]/70 p-2 flex items-end justify-center gap-1.5">
                  <div className="h-full flex-1 flex flex-col justify-end items-center">
                    <div
                      style={{ height: `${pct1}%` }}
                      title={`${primaryLabel}: ${formatBRL(pt.primary)}`}
                      className="w-full max-w-[28px] rounded-xl bg-gradient-to-t from-[#594943] to-[#C4A477] shadow-2xs transition-all duration-500"
                    />
                  </div>
                  {pt.secondary !== undefined && (
                    <div className="h-full flex-1 flex flex-col justify-end items-center">
                      <div
                        style={{ height: `${Math.max(4, pct2)}%` }}
                        title={`${secondaryLabel}: ${formatBRL(pt.secondary)}`}
                        className={`w-full max-w-[22px] rounded-xl transition-all duration-500 ${
                          pt.secondary > 0 ? 'bg-[#BE9293]' : 'bg-[#E8D6CB]/40'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Rodapé da cápsula: Saldo Líquido */}
                <div className="text-center pt-1 border-t border-[#E8D6CB]/70">
                  <span className="text-[10px] text-[#95847C] block">Saldo</span>
                  <strong
                    className={`text-[11px] tabular-nums ${
                      net >= 0 ? 'text-[#594943]' : 'text-[#B45353]'
                    }`}
                  >
                    {formatBRL(net)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODELO 3: ONDAS SUAVES SPLINE (CUBIC BEZIER) */}
      {mode === 'spline' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB] p-3 sm:p-4">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-52 sm:h-60 overflow-visible"
              role="img"
              aria-label={title}
            >
              <defs>
                <linearGradient id="luxurySplineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C4A477" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#C4A477" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {[0, 0.33, 0.66, 1].map((s, i) => {
                const y = padY + s * innerH;
                return (
                  <line
                    key={i}
                    x1={padX}
                    y1={y}
                    x2={svgW - padX}
                    y2={y}
                    stroke="#E8D6CB"
                    strokeDasharray={s === 1 ? undefined : '5 5'}
                    strokeWidth="1"
                  />
                );
              })}

              {smoothPrimaryArea && <path d={smoothPrimaryArea} fill="url(#luxurySplineGrad)" />}
              {smoothPrimaryLine && (
                <path
                  d={smoothPrimaryLine}
                  fill="none"
                  stroke="#594943"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              )}
              {smoothSecondaryLine && (
                <path
                  d={smoothSecondaryLine}
                  fill="none"
                  stroke="#BE9293"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                />
              )}

              {splinePrimaryPts.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="6"
                    fill="#FAF6F1"
                    stroke="#594943"
                    strokeWidth="3"
                  />
                  <rect
                    x={pt.x - 32}
                    y={Math.max(2, pt.y - 28)}
                    width="64"
                    height="18"
                    rx="6"
                    fill="#594943"
                  />
                  <text
                    x={pt.x}
                    y={Math.max(14, pt.y - 16)}
                    textAnchor="middle"
                    className="fill-[#FAF6F1] text-[10px] font-bold"
                  >
                    R$ {Math.round(pt.val)}
                  </text>
                </g>
              ))}
            </svg>

            {/* Rótulos HTML Nítidos Abaixo da Curva */}
            <div
              className="grid gap-2 pt-2 border-t border-[#E8D6CB]"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))`,
              }}
            >
              {data.map((pt, idx) => (
                <div key={idx} className="text-center">
                  <span className="text-xs font-bold text-[#594943] block">{pt.label}</span>
                  <span className="text-[11px] text-[#95847C] tabular-nums">
                    {formatBRL(pt.primary)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODELO 4: CARDS DE MAPA DE CALOR & EFICIÊNCIA */}
      {mode === 'heatmap' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {data.map((pt, idx) => {
            const intensity = maxVal > 0 ? pt.primary / maxVal : 0;
            const net = pt.primary - (pt.secondary || 0);
            const badge =
              intensity >= 0.75
                ? { text: 'Alta Demanda', cls: 'bg-[#594943] text-[#C4A477]' }
                : intensity >= 0.4
                  ? { text: 'Bom Ritmo', cls: 'bg-[#C4A477]/25 text-[#594943]' }
                  : { text: 'Estável', cls: 'bg-[#F2EAE4] text-[#95847C]' };

            return (
              <div
                key={idx}
                className="rounded-2xl border border-[#E8D6CB] bg-[#FAF6F1] p-4 flex flex-col justify-between gap-3 hover:border-[#C4A477] transition-all"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-editorial text-lg font-bold text-[#594943]">
                    {pt.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>

                <div className="space-y-1 text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-[#95847C]">Entradas:</span>
                    <strong className="text-[#4E7D5B]">+{formatBRL(pt.primary)}</strong>
                  </div>
                  {pt.secondary !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-[#95847C]">Saídas:</span>
                      <strong className="text-[#BE9293]">-{formatBRL(pt.secondary)}</strong>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#E8D6CB] flex items-center justify-between text-xs">
                  <span className="text-[#95847C]">Líquido:</span>
                  <strong className={net >= 0 ? 'text-[#594943]' : 'text-[#B45353]'}>
                    {formatBRL(net)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
// 4. GRÁFICO DE CURVA SUAVE SPLINE DE EVOLUÇÃO DE SALDO (LuxuryAreaLineChart)
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
  primaryLabel = 'Saldo Acumulado',
  secondaryLabel = 'Saídas',
}) => {
  return (
    <LuxuryBarChart
      title={title}
      subtitle={subtitle}
      data={data}
      primaryLabel={primaryLabel}
      secondaryLabel={secondaryLabel}
      defaultMode="spline"
    />
  );
};

// ------------------------------------------------------------------
// 5. GRÁFICO DE ROSCA / DONUT MODERNO COM BARRAS DE PROGRESSO (LuxuryDonutChart)
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

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPct = 0;

  return (
    <div className="bg-white rounded-3xl border border-[#E8D6CB] p-5 sm:p-6 space-y-4 shadow-2xs">
      <div>
        <h4 className="font-editorial text-xl font-semibold text-[#594943]">{title}</h4>
        {subtitle && <p className="text-xs text-[#95847C] mt-0.5">{subtitle}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
        {/* SVG Donut Moderno */}
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#FAF6F1"
              strokeWidth="22"
            />
            {total > 0 &&
              positiveSlices.map((slice, idx) => {
                const pct = slice.value / total;
                const dash = Math.max(0, pct * circumference - 2);
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
                    strokeWidth={isSelected ? '25' : '21'}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-300 cursor-pointer"
                    onClick={() => setActiveSlice(isSelected ? null : idx)}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#95847C] truncate max-w-[110px]">
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

        {/* Lista de Categorias com Barra de Progresso Integrada */}
        <div className="space-y-2.5">
          {positiveSlices.length === 0 ? (
            <p className="text-xs text-[#95847C]">
              Sem valores lançados nesta categoria.
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
                  className={`w-full p-2.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-[#F2EAE4] border-[#C4A477]'
                      : 'bg-[#FAF6F1] border-[#E8D6CB]/80 hover:bg-[#F2EAE4]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
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
                      <span className="px-1.5 py-0.5 rounded-md bg-white text-[10px] font-bold text-[#594943] border border-[#E8D6CB]">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, pct)}%`, backgroundColor: color }}
                      className="h-full rounded-full transition-all duration-500"
                    />
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
