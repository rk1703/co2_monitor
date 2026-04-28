'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { TimelinePoint, Plant, EmissionUnit } from '@/types';
import { fmtDate } from '@/lib/utils';
import { ChartSkeleton } from '@/components/ui/Skeleton';

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-4 py-3 text-xs"
      style={{ background: 'var(--card3)', borderColor: 'var(--border2)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', minWidth: 160 }}>
      <div className="font-medium mb-2" style={{ color: 'var(--text3)' }}>{label ? fmtDate(label) : ''}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span style={{ color: 'var(--text3)' }}>{p.name}</span>
          <span className="ml-auto font-bold font-display" style={{ color: p.color || p.fill }}>{p.value?.toFixed(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function TimelineChart({ data, plant, unit, loading }: {
  data: TimelinePoint[]; plant: Plant; unit: EmissionUnit; loading: boolean;
}) {
  const isAll  = plant === 'All Plants';
  const uLabel = unit === 'per_crude_steel' ? 'tCO₂/tCS' : 'tCO₂/tP';
  const seriesLabel = isAll ? 'Overall Plant Intensity' : `${plant} Emission Intensity`;
  const avg    = data.length ? data.reduce((s, d) => s + d.value, 0) / data.length : 0;
  const display = data.length > 60 ? data.filter((_, i) => i % Math.ceil(data.length / 60) === 0) : data;
  const tickFmt = (d: string) => { try { return fmtDate(d); } catch { return d; } };
  const tickInt = Math.max(0, Math.floor(display.length / 8) - 1);

  if (loading) return <ChartSkeleton height={290} />;
  if (!data.length) return (
    <div className="glass flex items-center justify-center" style={{ height: 290 }}>
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>No timeline data</span>
    </div>
  );

  return (
    <div className="glass fade-up flex flex-col gap-3 p-5" style={{ animationDelay: '340ms' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Emission Intensity — Timeline
          {plant !== 'All Plants' && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--accent)' }}>({plant})</span>}
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: 'var(--text3)' }}>
            Avg: <span className="font-bold font-display" style={{ color: 'var(--accent2)' }}>{avg.toFixed(5)} {uLabel}</span>
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-lg font-medium"
            style={{ background: 'var(--accent2-dim)', color: 'var(--accent2)', border: '1px solid rgba(59,130,246,0.2)' }}>
            {uLabel}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={225}>
        <AreaChart data={display} margin={{ top: 8, right: 16, left: -12, bottom: 5 }}>
          <defs>
            <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={{ stroke: 'var(--border2)' }} tickLine={false} tickFormatter={tickFmt} interval={tickInt} />
          <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(3)} domain={['auto','auto']} />
          <Tooltip content={<Tip />} />
          {avg > 0 && <ReferenceLine y={avg} stroke="var(--accent2)" strokeDasharray="4 3" strokeWidth={1} label={{ value: `avg ${avg.toFixed(3)}`, fill: 'var(--accent2)', fontSize: 9, position: 'insideTopRight' }} />}
          <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#ag)" dot={false} name={seriesLabel} activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
