import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, CalendarRange, Files, TrendingUp } from 'lucide-react';
import type { PawchivePostSummary, PawchiveTag } from '../types/spacex';

interface CreatorStatsPanelProps {
  posts: PawchivePostSummary[];
  tags: PawchiveTag[];
  loading: boolean;
}

interface MonthlyBucket {
  key: string;
  label: string;
  fullLabel: string;
  publicacoes: number;
  anexos: number;
}

const SHORT_MONTH_FMT = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
});

const FULL_MONTH_FMT = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

export function CreatorStatsPanel({ posts, tags, loading }: CreatorStatsPanelProps) {
  const [chartMode, setChartMode] = useState<'area' | 'bar'>('area');
  const [metric, setMetric] = useState<'publicacoes' | 'anexos'>('publicacoes');

  const { series, totalPosts, totalAttachments, avgPerMonth, peakMonth } = useMemo(() => {
    const map = new Map<string, { year: number; month: number; publicacoes: number; anexos: number }>();
    let attachmentsSum = 0;

    for (const post of posts) {
      const rawDate = post.published || post.added;
      const fileCount =
        (post.file?.path || post.file?.temp_url || post.file?.temp_download_url ? 1 : 0) +
        (post.attachments?.length || 0);
      attachmentsSum += fileCount;

      if (!rawDate) continue;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) continue;

      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const existing = map.get(key) || { year: y, month: m, publicacoes: 0, anexos: 0 };
      existing.publicacoes += 1;
      existing.anexos += fileCount;
      map.set(key, existing);
    }

    const sortedKeys = Array.from(map.keys()).sort();
    const last12Keys = sortedKeys.slice(-12);

    const buckets: MonthlyBucket[] = last12Keys.map((key) => {
      const entry = map.get(key)!;
      const refDate = new Date(Date.UTC(entry.year, entry.month, 15));
      const rawShort = SHORT_MONTH_FMT.format(refDate).replace('.', '').replace(' de ', '/');
      const fullLabel = FULL_MONTH_FMT.format(refDate);
      return {
        key,
        label: rawShort,
        fullLabel: fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1),
        publicacoes: entry.publicacoes,
        anexos: entry.anexos,
      };
    });

    const activeMonths = sortedKeys.length || 1;
    const avg = posts.length > 0 ? (posts.length / activeMonths).toFixed(1) : '0';

    let peak: MonthlyBucket | null = null;
    for (const b of buckets) {
      if (!peak || b.publicacoes > peak.publicacoes) {
        peak = b;
      }
    }

    return {
      series: buckets,
      totalPosts: posts.length,
      totalAttachments: attachmentsSum,
      avgPerMonth: avg,
      peakMonth: peak,
    };
  }, [posts]);

  return (
    <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-base sm:text-lg font-semibold text-white">
              Estatísticas de Publicação ao Longo do Tempo
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Distribuição mensal real calculada a partir das publicações indexadas deste criador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-white/10 bg-black/50 p-1">
            <button
              type="button"
              onClick={() => setMetric('publicacoes')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                metric === 'publicacoes' ? 'bg-white text-black' : 'text-slate-300 hover:text-white'
              }`}
            >
              Publicações/mês
            </button>
            <button
              type="button"
              onClick={() => setMetric('anexos')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                metric === 'anexos' ? 'bg-white text-black' : 'text-slate-300 hover:text-white'
              }`}
            >
              Mídias/anexos
            </button>
          </div>

          <div className="flex items-center rounded-xl border border-white/10 bg-black/50 p-1">
            <button
              type="button"
              onClick={() => setChartMode('area')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                chartMode === 'area' ? 'bg-sky-400 text-black' : 'text-slate-300 hover:text-white'
              }`}
            >
              Área
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                chartMode === 'bar' ? 'bg-sky-400 text-black' : 'text-slate-300 hover:text-white'
              }`}
            >
              Barras
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
            Posts analisados
          </p>
          <p className="mt-1 font-mono-tabular text-lg font-semibold text-white">
            {loading && totalPosts === 0 ? '—' : new Intl.NumberFormat('pt-BR').format(totalPosts)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CalendarRange className="h-3.5 w-3.5 text-sky-400" />
            Média mensal
          </p>
          <p className="mt-1 font-mono-tabular text-lg font-semibold text-white">
            {loading && totalPosts === 0 ? '—' : `${avgPerMonth} / mês`}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Files className="h-3.5 w-3.5 text-sky-400" />
            Anexos no período
          </p>
          <p className="mt-1 font-mono-tabular text-lg font-semibold text-white">
            {loading && totalPosts === 0 ? '—' : new Intl.NumberFormat('pt-BR').format(totalAttachments)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <p className="text-[11px] text-slate-400">Pico de atividade</p>
          <p className="mt-1 truncate font-mono-tabular text-sm sm:text-base font-semibold text-white">
            {peakMonth
              ? `${peakMonth.label} (${peakMonth.publicacoes})`
              : tags.length > 0
                ? `${tags.length} tags`
                : '—'}
          </p>
        </div>
      </div>

      {/* Recharts Visualization */}
      {loading && series.length === 0 ? (
        <div className="skeleton-glass h-[220px] w-full rounded-2xl" />
      ) : series.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center rounded-2xl border border-white/[0.07] bg-black/40 text-xs text-slate-400">
          Nenhuma publicação com data disponível para gerar o gráfico mensal.
        </div>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'area' ? (
              <AreaChart data={series} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="spacexAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(56, 189, 248, 0.45)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as MonthlyBucket;
                    return (
                      <div className="liquid-glass rounded-xl px-3 py-2 text-xs shadow-xl">
                        <p className="font-semibold text-white">{item.fullLabel}</p>
                        <p className="mt-1 font-mono-tabular text-sky-300">
                          Publicações: <span className="text-white">{item.publicacoes}</span>
                        </p>
                        <p className="font-mono-tabular text-slate-300">
                          Arquivos/anexos: <span className="text-white">{item.anexos}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="#38BDF8"
                  strokeWidth={2.25}
                  fill="url(#spacexAreaFill)"
                  activeDot={{ r: 5, fill: '#38BDF8', stroke: '#020203', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <BarChart data={series} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as MonthlyBucket;
                    return (
                      <div className="liquid-glass rounded-xl px-3 py-2 text-xs shadow-xl">
                        <p className="font-semibold text-white">{item.fullLabel}</p>
                        <p className="mt-1 font-mono-tabular text-sky-300">
                          Publicações: <span className="text-white">{item.publicacoes}</span>
                        </p>
                        <p className="font-mono-tabular text-slate-300">
                          Arquivos/anexos: <span className="text-white">{item.anexos}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={metric}
                  fill="#38BDF8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
