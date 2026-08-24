'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieSlice, PieView } from '@/types';
import { useDashboardStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import { ChartSkeleton } from '@/components/ui/Skeleton';

function Tip({ active, payload, unitLabel }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const total = d.payload.total > 0 ? d.payload.total : 1;
  return (
    <div className="rounded-xl border px-4 py-3 text-xs"
      style={{ background: 'var(--card2)', borderColor: 'var(--border2)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
      <div className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>{d.name}</div>
      <div className="font-bold text-sm" style={{ color: d.payload.fill }}>{fmt(d.value, 0)} tCO₂</div>
      <div style={{ color: 'var(--text2)' }}>
        {(d.payload.intensity ?? 0).toFixed(5)} {unitLabel}
      </div>
      <div style={{ color: 'var(--text3)' }}>{((d.value / total) * 100).toFixed(1)}% of emitters</div>
    </div>
  );
}

export default function PieChartPanel({ data, loading }: { data: PieSlice[]; loading: boolean }) {
  const { pieView, setPieView, unit } = useDashboardStore();

  const emitters = data.filter(d => d.value > 0);
  const credits  = data.filter(d => d.value < 0);

  const emitterTotal = emitters.reduce((s, d) => s + d.value, 0);
  const creditTotal  = credits.reduce((s, d) => s + d.value, 0);
  const netTotal     = emitterTotal + creditTotal;

  const divisor = emitterTotal > 0 ? emitterTotal : 1;
  const unitLabel = unit === 'per_crude_steel' ? 'tCO₂/tCS' : 'tCO₂/tP';

  const richEmitters = emitters.map(d => ({ ...d, total: emitterTotal }));

  if (loading) return <ChartSkeleton height={420} />;
  if (!data.length) return (
    <div className="glass flex items-center justify-center" style={{ height: 420 }}>
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>No data</span>
    </div>
  );

  return (
    <div className="glass h-full fade-up flex flex-col gap-3 p-5" style={{ animationDelay: '280ms' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>Emission Share</h3>
        <div className="flex rounded-lg overflow-hidden text-[11px]" style={{ border: '1px solid var(--border2)' }}>
          {(['category', 'subcategory'] as PieView[]).map(v => (
            <button key={v} onClick={() => setPieView(v)}
              className="px-2.5 py-1 transition-all duration-150 font-medium"
              style={{ background: pieView === v ? 'var(--accent2)' : 'transparent', color: pieView === v ? '#fff' : 'var(--text3)' }}>
              {v === 'category' ? 'Category' : 'Sub-cat'}
            </button>
          ))}
        </div>
      </div>

      {/* Donut */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={richEmitters} cx="50%" cy="50%" innerRadius={58} outerRadius={90}
              dataKey="value" paddingAngle={2} strokeWidth={0}>
              {richEmitters.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip content={<Tip unitLabel={unitLabel} />} wrapperStyle={{ zIndex: 50 }} />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px]" style={{ color: 'var(--text3)' }}>Net CO₂</div>
          <div className="font-display font-bold text-base" style={{ color: 'var(--accent)' }}>{fmt(netTotal, 0)}</div>
          <div className="text-[10px]" style={{ color: 'var(--text3)' }}>tCO₂</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 flex-1" style={{ maxHeight: 160 }}>
        {/* Emitters */}
        <div className="flex flex-col gap-1.5">
          {emitters.map((d, i) => (
            <div key={`emit-${i}`} className="flex items-center gap-2 text-xs min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.fill }} />
              <span className="flex-1 truncate" style={{ color: 'var(--text2)' }} title={d.name}>{d.name}</span>
              <span className="font-semibold font-display flex-shrink-0" style={{ color: 'var(--text)' }}>
                {((d.value / divisor) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* Credits */}
        {credits.length > 0 && (
          <>
            <div className="h-px my-1" style={{ background: 'var(--border2)' }} />
            <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Credits & Offsets</div>
            <div className="flex flex-col gap-1.5">
              {credits.map((d, i) => (
                <div key={`cred-${i}`} className="flex items-center gap-2 text-xs min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.fill }} />
                  <span className="flex-1 truncate" style={{ color: 'var(--text3)' }} title={d.name}>{d.name}</span>
                  <span className="font-semibold font-display flex-shrink-0 text-green-500">
                    {((d.value / divisor) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Net Total Summary */}
        <div className="h-px my-1" style={{ background: 'var(--border2)' }} />
        <div className="flex items-center justify-between text-xs font-semibold">
          <span style={{ color: 'var(--text)' }}>Net Total</span>
          <span className="font-display font-bold" style={{ color: 'var(--accent)' }}>
            {((netTotal / divisor) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
