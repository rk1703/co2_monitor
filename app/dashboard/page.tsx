'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useDashboardStore } from '@/lib/store';
import { computeKPI, computePlantBar, computeSubCategoryBar, computePieData, computeTimeline } from '@/lib/compute';
import FilterBar    from '@/components/dashboard/FilterBar';
import KPICards     from '@/components/dashboard/KPICards';
import BarChartPanel from '@/components/dashboard/BarChartPanel';
import PieChartPanel from '@/components/dashboard/PieChartPanel';
import TimelineChart from '@/components/dashboard/TimelineChart';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { DataProvider, ThemeWrapper } from '@/components/ui/Providers';
import { BarChart2, ExternalLink } from 'lucide-react';

function Content() {
  const { bundle, isLoading, error, dateRange, plant, unit, pieView } = useDashboardStore();
  const [start, end] = dateRange;
  const ok = !!bundle && bundle.emissions.length > 0;

  const kpi     = useMemo(() => ok ? computeKPI(bundle!, start, end, plant) : null, [bundle, start, end, plant, ok]);
  const barData = useMemo(() => ok ? (plant === 'All Plants' ? computePlantBar(bundle!, start, end) : computeSubCategoryBar(bundle!, start, end, plant, unit)) : [], [bundle, start, end, plant, unit, ok]);
  const pieData = useMemo(() => ok ? computePieData(bundle!, start, end, plant, pieView, unit) : [], [bundle, start, end, plant, pieView, unit, ok]);
  const tl      = useMemo(() => ok ? computeTimeline(bundle!, start, end, plant, unit) : [], [bundle, start, end, plant, unit, ok]);

  if (error && !ok) return (
    <div className="flex items-center justify-center h-64 fade-up">
      <div className="text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <div className="font-display font-semibold text-sm mb-1" style={{ color: 'var(--red)' }}>Could not load data</div>
        <div className="text-xs max-w-xs" style={{ color: 'var(--text3)' }}>{error}</div>
        <div className="text mt-2" style={{ color: 'var(--text2)' }}>Make sure you are connected to the JSW Intranet</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 min-h-full pb-10">
      <div className="relative lg:sticky lg:top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-0 pb-3" >
        <ErrorBoundary label="Filter bar error"><FilterBar /></ErrorBoundary>
      </div>
      <ErrorBoundary label="KPI error"><KPICards kpi={kpi} plant={plant} unit={unit} loading={isLoading} /></ErrorBoundary>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        <div className="lg:col-span-3 h-full">
          <ErrorBoundary label="Bar chart error"><BarChartPanel data={barData} plant={plant} unit={unit} loading={isLoading} /></ErrorBoundary>
        </div>
        <div className="lg:col-span-1 h-full">
          <ErrorBoundary label="Pie chart error"><PieChartPanel data={pieData} loading={isLoading} /></ErrorBoundary>
        </div>
      </div>

      <ErrorBoundary label="Timeline error"><TimelineChart data={tl} plant={plant} unit={unit} loading={isLoading} /></ErrorBoundary>

      {/* Navigate to elaborate */}
      <div className="flex justify-center pt-2 pb-4">
        <Link href="/elaborate"
          className="flex items-center gap-3 px-6 py-3 rounded-2xl font-display font-semibold text-sm transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, var(--accent), #fb923c)', color: '#fff', boxShadow: '0 4px 24px var(--accent-glow)' }}>
          <BarChart2 size={18} />
          Elaborate Analytics
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DataProvider>
      <ThemeWrapper>
        <main className="relative z-10 h-[100dvh] overflow-y-auto p-4 lg:p-6 max-w-[1920px] mx-auto">
          <Content />
        </main>
      </ThemeWrapper>
    </DataProvider>
  );
}
