'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { BarItem, Plant, EmissionUnit } from '@/types';
import { ChartSkeleton } from '@/components/ui/Skeleton';

const PLANT_C = [
  '#f97316', '#60a5fa', '#22c55e', '#a855f7',
  '#eab308', '#06b6d4', '#ef4444', '#ec4899',
  '#14b8a6', '#8b5cf6', '#f59e0b', '#10b981',
  '#3b82f6', '#f43f5e', '#84cc16', '#64748b',
];
const SUB_C = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#eab308', '#06b6d4', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6', '#f59e0b', '#10b981'];

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-4 py-3 text-xs"
      style={{ background: 'var(--card3)', borderColor: 'var(--border2)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', fontFamily: 'inherit' }}>
      <div className="font-display font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="font-bold text-sm" style={{ color: payload[0]?.fill }}>{payload[0]?.value?.toFixed(5)}</div>
      <div style={{ color: 'var(--text3)' }}>{payload[0]?.name}</div>
    </div>
  );
}

function CustomLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value === undefined || value === null) return null;
  const isPositive = value >= 0;
  const labelY = isPositive ? y - 6 : y + 15;
  return (
    <text x={x + width / 2} y={labelY} fill="var(--text3)" fontSize={9} textAnchor="middle">
      {value.toFixed(3)}
    </text>
  );
}

export default function BarChartPanel({ data, plant, unit, loading }: {
  data: BarItem[]; plant: Plant; unit: EmissionUnit; loading: boolean;
}) {
  const isAll = plant === 'All Plants';
  const uLabel = isAll ? 'tCO₂/tCS' : unit === 'per_product' ? 'tCO₂/tP' : 'tCO₂/tCS';
  const title = isAll ? 'Plant CO₂ Intensity — Descending' : `Subcategory Breakdown — ${plant}`;
  const angled = data.length > 5;

  if (loading) return <ChartSkeleton height={420} />;
  if (!data.length) return (
    <div className="rounded-2xl border flex items-center justify-center" style={{ background: 'var(--card)', borderColor: 'var(--border2)', height: 420 }}>
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>No data for selected range</span>
    </div>
  );

  return (
    <div className="glass h-full fade-up flex flex-col gap-3 p-5" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
        <span className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(249,115,22,0.2)' }}>
          {uLabel}
        </span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 16, left: -12, bottom: angled ? 60 : 8 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={{ stroke: 'var(--border2)' }}
            tickLine={false} angle={angled ? -38 : 0} textAnchor={angled ? 'end' : 'middle'} interval={0} />
          <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => v.toFixed(3)} />
          <Tooltip content={<Tip />} cursor={{ fill: 'rgba(249,115,22,0.05)' }} />
          <ReferenceLine y={0} stroke="var(--border2)" />
          <Bar dataKey="value" name={uLabel} radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((entry, i) => (
              <Cell key={i} fill={isAll ? PLANT_C[i % PLANT_C.length] : SUB_C[i % SUB_C.length]} />
            ))}
            <LabelList dataKey="value" content={<CustomLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
