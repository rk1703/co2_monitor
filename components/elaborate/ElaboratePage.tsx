"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import { useDashboardStore } from "@/lib/store";
import {
  computeStackedTimeline,
  computeScatterData,
  computeCategoryTimeline,
  computePieData,
  computeSubCategoryBar,
  computeKPI,
  CAT_COLORS,
  computeTimeline,
} from "@/lib/compute";
import { fmtDate, fmt } from "@/lib/utils";
import FilterBar from "@/components/dashboard/FilterBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ChartSkeleton } from "@/components/ui/Skeleton";
import { DataProvider, ThemeWrapper } from "@/components/ui/Providers";
import {
  ArrowLeft,
  Layers,
  Activity,
  TrendingDown,
  GitCompare,
  Sliders,
} from "lucide-react";
import { format } from "date-fns";

// ── Shared palette ─────────────────────────────────────────────────────────────
const STACKED_CATS = [
  { key: "CBRM", color: "#f97316", label: "CBRM (Carbon)" },
  { key: "GAS", color: "#22c55e", label: "GAS" },
  { key: "POWER", color: "#a855f7", label: "POWER" },
  { key: "FLUXES", color: "#eab308", label: "FLUXES" },
  { key: "IBRM", color: "#60a5fa", label: "IBRM (Iron)" },
];
const SUBCAT_C = [
  "#f97316",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#eab308",
  "#06b6d4",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
];

// ── Reusable card ──────────────────────────────────────────────────────────────
function Card({
  title,
  icon: Icon,
  description,
  badge,
  children,
  delay = 0,
}: {
  title: string;
  icon?: any;
  description?: string;
  badge?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="glass fade-up flex flex-col gap-3 p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "var(--accent-dim)",
                border: "1px solid rgba(249,115,22,0.2)",
              }}
            >
              <Icon size={14} style={{ color: "var(--accent)" }} />
            </div>
          )}
          <div>
            <h3
              className="font-display font-semibold text-sm"
              style={{ color: "var(--text)" }}
            >
              {title}
            </h3>
            {description && (
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text3)" }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {badge && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-lg flex-shrink-0 font-medium"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid rgba(249,115,22,0.2)",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────
function Section({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-display flex-shrink-0"
        style={{
          background: "var(--accent)",
          color: "#fff",
          boxShadow: "0 0 12px var(--accent-glow)",
        }}
      >
        {n}
      </div>
      <h2
        className="font-display font-bold text-sm"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h2>
      <div className="flex-1 h-px" style={{ background: "var(--border2)" }} />
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function StackedTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div
      className="rounded-xl border px-4 py-3 text-xs"
      style={{
        background: "var(--card3)",
        borderColor: "var(--border2)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        minWidth: 180,
      }}
    >
      <div
        className="font-display font-semibold mb-2"
        style={{ color: "var(--text)" }}
      >
        {label ? fmtDate(label) : ""} ·{" "}
        <span style={{ color: "var(--accent)" }}>{fmt(total, 0)} tCO₂</span>
      </div>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span
            className="w-2 h-2 rounded-sm flex-shrink-0"
            style={{ background: p.fill }}
          />
          <span style={{ color: "var(--text3)" }}>{p.name}</span>
          <span className="ml-auto font-bold" style={{ color: p.fill }}>
            {fmt(p.value, 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function GenTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border px-4 py-3 text-xs"
      style={{
        background: "var(--card3)",
        borderColor: "var(--border2)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        minWidth: 150,
      }}
    >
      <div className="font-medium mb-2" style={{ color: "var(--text3)" }}>
        {label ? fmtDate(label) : ""}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color || p.fill }}
          />
          <span style={{ color: "var(--text3)" }}>{p.name}</span>
          <span
            className="ml-auto font-bold font-display"
            style={{ color: p.color || p.fill }}
          >
            {typeof p.value === "number"
              ? p.value > 100
                ? fmt(p.value, 0)
                : p.value.toFixed(5)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScatterTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div
      className="rounded-xl border px-4 py-3 text-xs"
      style={{
        background: "var(--card3)",
        borderColor: "var(--border2)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="font-display font-semibold mb-1"
        style={{ color: "var(--text)" }}
      >
        {d?.plant} · {d?.date ? fmtDate(d.date) : ""}
      </div>
      <div style={{ color: "var(--text3)" }}>
        Hot Metal:{" "}
        <span className="font-bold" style={{ color: "var(--green)" }}>
          {fmt(d?.x, 0)} t
        </span>
      </div>
      <div style={{ color: "var(--text3)" }}>
        Intensity:{" "}
        <span className="font-bold" style={{ color: "var(--accent)" }}>
          {d?.y?.toFixed(5)} tCO₂/tP
        </span>
      </div>
      <div style={{ color: "var(--text3)" }}>
        Absolute Emissions:{" "}
        <span className="font-bold" style={{ color: "var(--purple)" }}>
          {fmt(d?.z, 0)} tCO₂
        </span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ElaborateContent() {
  const { bundle, isLoading, dateRange, plant, unit } = useDashboardStore();
  const [start, end] = dateRange;
  const ok = !!bundle && bundle.emissions.length > 0;

  const stacked = useMemo(
    () => (ok ? computeStackedTimeline(bundle!, start, end, plant) : []),
    [bundle, start, end, plant, ok],
  );
  const scatter = useMemo(
    () => (ok ? computeScatterData(bundle!, start, end) : []),
    [bundle, start, end, ok],
  );

  const [scrapRatio, setScrapRatio] = useState(0); // 0 to 30 %
  const [altFuelRatio, setAltFuelRatio] = useState(0); // 0 to 50 %
  const [renewSourcing, setRenewSourcing] = useState(0); // 0 to 100 %

  const baselineKPI = useMemo(() => {
    return ok ? computeKPI(bundle!, start, end, plant) : null;
  }, [bundle, start, end, plant, ok]);

  const simulatedKPI = useMemo(() => {
    if (!ok || !baselineKPI) return null;

    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");

    // Filter emissions in date range and plant
    const filteredEmissions = bundle!.emissions.filter(
      (r) => r.date >= startStr && r.date <= endStr && (plant === "All Plants" || r.plant === plant)
    );

    // Group baseline absolute emissions by category
    let cbrmBase = 0;
    let powerBase = 0;
    let otherBase = 0;
    
    filteredEmissions.forEach(r => {
      if (r.category === 'CBRM') {
        cbrmBase += r.absoluteCO2;
      } else if (r.category === 'POWER') {
        powerBase += r.absoluteCO2;
      } else {
        otherBase += r.absoluteCO2;
      }
    });

    // Apply Alternative Fuel Injection to CBRM
    const cbrmSim = cbrmBase * (1 - (altFuelRatio * 0.005));

    // Apply Renewable grid power sourcing to POWER
    const powerSim = powerBase * (1 - (renewSourcing * 0.01));

    // Apply Scrap Charging ratio to everything
    const totalBeforeScrap = cbrmSim + powerSim + otherBase;
    const simulatedNetCO2 = totalBeforeScrap * (1 - (scrapRatio * 0.008));
    
    // Recalculate intensities
    const totalCS = baselineKPI.totalCS;
    const totalProduct = baselineKPI.totalProduct;

    const simulatedIntensityCS = totalCS > 0 ? simulatedNetCO2 / totalCS : 0;
    const simulatedIntensityProduct = totalProduct > 0 ? simulatedNetCO2 / totalProduct : 0;

    return {
      netCO2: Math.round(simulatedNetCO2),
      intensityCS: Math.round(simulatedIntensityCS * 100000) / 100000,
      intensityProduct: Math.round(simulatedIntensityProduct * 100000) / 100000,
    };
  }, [bundle, start, end, plant, ok, baselineKPI, scrapRatio, altFuelRatio, renewSourcing]);

  // Scatter By Plant Grouping
  const scatterByPlant = useMemo(() => {
    const groups: Record<string, any[]> = {};
    scatter.forEach((p) => {
      if (!groups[p.plant]) groups[p.plant] = [];
      groups[p.plant].push(p);
    });
    return Object.entries(groups).map(([name, data]) => ({ name, data }));
  }, [scatter]);

  // Linear Regression Trendline
  const regressionLine = useMemo(() => {
    if (scatter.length < 2) return [];

    const nVal = scatter.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    scatter.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    });

    const denominator = nVal * sumXX - sumX * sumX;
    if (denominator === 0) return [];

    const m = (nVal * sumXY - sumX * sumY) / denominator;
    const c = (sumY - m * sumX) / nVal;

    const xValues = scatter.map((p) => p.x);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);

    return [
      { x: minX, y: m * minX + c },
      { x: maxX, y: m * maxX + c },
    ];
  }, [scatter]);

  // Scatter Average Stats
  const scatterStats = useMemo(() => {
    if (scatter.length === 0) return { meanX: 0, meanY: 0 };
    const sumX = scatter.reduce((s, p) => s + p.x, 0);
    const sumY = scatter.reduce((s, p) => s + p.y, 0);
    return {
      meanX: Math.round(sumX / scatter.length),
      meanY: Math.round((sumY / scatter.length) * 100000) / 100000,
    };
  }, [scatter]);
  const catTL = useMemo(
    () => (ok ? computeCategoryTimeline(bundle!, start, end, plant) : []),
    [bundle, start, end, plant, ok],
  );
  const subBar = useMemo(
    () => (ok ? computeSubCategoryBar(bundle!, start, end, plant, unit) : []),
    [bundle, start, end, plant, unit, ok],
  );
  const pieCat = useMemo(
    () =>
      ok ? computePieData(bundle!, start, end, plant, "category", unit) : [],
    [bundle, start, end, plant, unit, ok],
  );

  const plantOptions = useMemo(() => {
    if (!ok) return [];
    const plants = Array.from(
      new Set([
        ...bundle!.emissions.map((r) => r.plant),
        ...bundle!.products.map((r) => r.plant),
      ]),
    );
    return plants.filter((p) => !!p && p !== "All Plants").sort();
  }, [bundle, ok]);
  const [compareA, setCompareA] = useState("BF1");
  const [compareB, setCompareB] = useState("BF2");

  useEffect(() => {
    if (!plantOptions.length) return;

    if (plant === "All Plants") {
      const a = plantOptions.includes("BF1") ? "BF1" : plantOptions[0];
      const bCandidate = plantOptions.includes("BF2")
        ? "BF2"
        : plantOptions.find((p) => p !== a) || a;
      setCompareA(a);
      setCompareB(bCandidate);
      return;
    }

    if (!plantOptions.includes(compareA)) {
      setCompareA(plantOptions[0]);
    }

    if (!plantOptions.includes(compareB) || compareB === compareA) {
      const fallbackB =
        plantOptions.find((p) => p !== compareA) || plantOptions[0];
      setCompareB(fallbackB);
    }
  }, [plant, plantOptions, compareA, compareB]);

  const compareSeries = useMemo(() => {
    if (!ok) return [];
    const aSeries = computeTimeline(bundle!, start, end, compareA as any, unit);
    const bMap = new Map(
      computeTimeline(bundle!, start, end, compareB as any, unit).map((d) => [
        d.date,
        d.value,
      ]),
    );

    return aSeries
      .map((d) => ({
        date: d.date,
        [compareA]: d.value,
        [compareB]: bMap.get(d.date) ?? null,
      }))
      .slice(-60);
  }, [bundle, start, end, unit, compareA, compareB, ok]);

  const rolling7 = useMemo(() => {
    const pts = compareSeries.map((d) => ({
      date: d.date,
      avg: (((d as any)[compareA] ?? 0) + ((d as any)[compareB] ?? 0)) / 2,
    }));
    return pts.map((p, i) => {
      const win = pts.slice(Math.max(0, i - 6), i + 1);
      return {
        date: p.date,
        instant: p.avg,
        rolling7:
          Math.round(
            (win.reduce((s, w) => s + w.avg, 0) / win.length) * 100000,
          ) / 100000,
      };
    });
  }, [compareSeries, compareA, compareB]);

  const cumulative = useMemo(() => {
    let sum = 0;
    return stacked.map((d) => {
      sum +=
        (d.CBRM || 0) +
        (d.GAS || 0) +
        (d.POWER || 0) +
        (d.FLUXES || 0) +
        (d.IBRM || 0);
      return { date: d.date, cumulative: Math.round(sum) };
    });
  }, [stacked]);

  const tickFmt = (d: string) => {
    try {
      return fmtDate(d);
    } catch {
      return d;
    }
  };
  const tInt = (len: number) => Math.max(0, Math.floor(len / 8) - 1);
  const uLabel = unit === "per_crude_steel" ? "tCO₂/tCS" : "tCO₂/tP";

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div
        className="relative lg:sticky lg:top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-0 pb-3">
        <ErrorBoundary label="Filter error">
          <FilterBar />
        </ErrorBoundary>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-all hover:opacity-80 font-medium"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border2)",
            color: "var(--text2)",
            fontFamily: "'Space Grotesk',sans-serif",
          }}
        >
          <ArrowLeft size={13} /> Dashboard
        </Link>
        <h1
          className="font-display font-bold text-xl"
          style={{ color: "var(--text)" }}
        >
          Elaborate Analytics
        </h1>
        <span
          className="text-xs px-3 py-1 rounded-xl font-display font-semibold"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid rgba(249,115,22,0.25)",
          }}
        >
          {plant}
        </span>
      </div>

      {/* 1. Stacked Area */}
      <Section n="1" title="Category Contribution Over Time — Stacked" />
      <Card
        title="Daily Absolute CO₂ by Category"
        icon={Layers}
        badge="tCO₂/day"
        description="Which emission category dominates each day. CBRM (coke, coal, PCI) is typically largest."
        delay={0}
      >
        {isLoading ? (
          <ChartSkeleton height={300} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={stacked.slice(-60)}
              margin={{ top: 8, right: 16, left: -12, bottom: 5 }}
            >
              <defs>
                {STACKED_CATS.map(({ key, color }) => (
                  <linearGradient
                    key={key}
                    id={`sg-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border2)" }}
                tickLine={false}
                tickFormatter={tickFmt}
                interval={tInt(Math.min(stacked.length, 60))}
              />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v, 0)}
              />
              <Tooltip content={<StackedTip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                formatter={(v) => (
                  <span style={{ color: "var(--text2)" }}>
                    {STACKED_CATS.find((c) => c.key === v)?.label || v}
                  </span>
                )}
              />
              {STACKED_CATS.map(({ key, color }) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={color}
                  fill={`url(#sg-${key})`}
                  strokeWidth={0}
                  name={key}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 2. Category Lines */}
      <Section n="2" title="Category Trend Lines — Day by Day" />
      <Card
        title="Daily CO₂ per Category (tCO₂)"
        icon={Activity}
        badge="Trend"
        description="Track individual category trends. A rising GAS or POWER line signals an inefficiency."
        delay={60}
      >
        {isLoading ? (
          <ChartSkeleton height={270} />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <LineChart
              data={catTL.slice(-60)}
              margin={{ top: 8, right: 16, left: -12, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border2)" }}
                tickLine={false}
                tickFormatter={tickFmt}
                interval={tInt(Math.min(catTL.length, 60))}
              />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v, 0)}
              />
              <Tooltip content={<GenTip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {STACKED_CATS.map(({ key, color, label }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  name={label}
                  activeDot={{ r: 3, fill: color }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 3. Subcategory deep dive */}
      <Section n="3" title="Subcategory Deep-Dive" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card
          title={`All Subcategories Ranked (${uLabel})`}
          badge={uLabel}
          description="Full period breakdown of every material's CO₂ contribution per tonne of output."
          delay={80}
        >
          {isLoading ? (
            <ChartSkeleton height={370} />
          ) : (
            <ResponsiveContainer width="100%" height={370}>
              <BarChart
                data={subBar}
                layout="vertical"
                margin={{ top: 4, right: 58, left: 0, bottom: 4 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--grid)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--text3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.toFixed(3)}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "var(--text2)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={148}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div
                        className="rounded-xl border px-3 py-2 text-xs"
                        style={{
                          background: "var(--card3)",
                          borderColor: "var(--border2)",
                        }}
                      >
                        <div
                          className="font-bold"
                          style={{ color: payload[0]?.fill }}
                        >
                          {Number(payload[0]?.value || 0).toFixed(6)}
                        </div>
                        <div style={{ color: "var(--text3)" }}>{uLabel}</div>
                      </div>
                    );
                  }}
                  cursor={{ fill: "rgba(249,115,22,0.04)" }}
                />
                <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={22}>
                  {subBar.map((_, i) => (
                    <Cell key={i} fill={SUBCAT_C[i % SUBCAT_C.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card
          title="By Category — Absolute CO₂ Share (tCO₂ total)"
          badge="Absolute"
          description="Period-total CO₂ by category. CBRM dominates in blast furnace operations."
          delay={100}
        >
          {isLoading ? (
            <ChartSkeleton height={370} />
          ) : (
            <ResponsiveContainer width="100%" height={370}>
              <BarChart
                data={pieCat}
                margin={{ top: 20, right: 16, left: -12, bottom: 48 }}
                barCategoryGap="30%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--grid)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text3)", fontSize: 10 }}
                  axisLine={{ stroke: "var(--border2)" }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "var(--text3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(v, 0)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const total = pieCat.reduce((s, d) => s + d.value, 0);
                    return (
                      <div
                        className="rounded-xl border px-3 py-2 text-xs"
                        style={{
                          background: "var(--card3)",
                          borderColor: "var(--border2)",
                        }}
                      >
                        <div
                          className="font-bold"
                          style={{ color: payload[0]?.fill }}
                        >
                          {fmt(payload[0]?.value as number, 0)} tCO₂
                        </div>
                        <div style={{ color: "var(--text3)" }}>
                          {((Number(payload[0]?.value) / total) * 100).toFixed(
                            1,
                          )}
                          % of total
                        </div>
                      </div>
                    );
                  }}
                  cursor={{ fill: "rgba(249,115,22,0.04)" }}
                />
                <Bar
                  dataKey="value"
                  name="tCO₂"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={60}
                >
                  {pieCat.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* 4. Enhanced Scatter */}
      <Section n="4" title="Production Volume vs. Emission Intensity — Scatter Bubble Chart" />
      <Card
        title="Hot Metal Output (t/day) vs tCO₂/tP"
        badge="Bubble Size = Daily Emission Vol (t)"
        icon={GitCompare}
        description="Each bubble = one plant-day. Dot size represents absolute daily emissions. Quadrants divided by mean production and intensity."
        delay={120}
      >
        {isLoading ? (
          <ChartSkeleton height={380} />
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 12, right: 36, left: -10, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Hot Metal"
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: "Hot Metal Output (t/day)",
                  position: "insideBottom",
                  fill: "var(--text3)",
                  fontSize: 10,
                  offset: -12,
                }}
                domain={["auto", "auto"]}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Intensity"
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.toFixed(3)}
                label={{
                  value: "tCO₂/tP",
                  angle: -90,
                  position: "insideLeft",
                  fill: "var(--text3)",
                  fontSize: 10,
                  offset: 8,
                }}
                domain={["auto", "auto"]}
              />
              <ZAxis
                type="number"
                dataKey="z"
                range={[30, 300]}
                name="Absolute CO₂"
                unit=" t"
              />
              <Tooltip
                content={<ScatterTip />}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {scatterByPlant.map(({ name, data }, idx) => (
                <Scatter
                  key={name}
                  name={name}
                  data={data}
                  fill={SUBCAT_C[idx % SUBCAT_C.length]}
                  opacity={0.75}
                />
              ))}
              {regressionLine.length === 2 && (
                <Scatter
                  name="Regression Line"
                  data={regressionLine}
                  line={{ stroke: "var(--text3)", strokeWidth: 1.5, strokeDasharray: "5 5" }}
                  shape={() => <circle r={0} />}
                  legendType="none"
                />
              )}
              {scatterStats.meanX > 0 && (
                <ReferenceLine
                  x={scatterStats.meanX}
                  stroke="var(--border3)"
                  strokeDasharray="3 3"
                  label={{
                    value: `Mean: ${scatterStats.meanX} t`,
                    fill: "var(--text2)",
                    position: "top",
                    fontSize: 9,
                  }}
                />
              )}
              {scatterStats.meanY > 0 && (
                <ReferenceLine
                  y={scatterStats.meanY}
                  stroke="var(--border3)"
                  strokeDasharray="3 3"
                  label={{
                    value: `Mean: ${scatterStats.meanY.toFixed(3)}`,
                    fill: "var(--text2)",
                    position: "right",
                    fontSize: 9,
                  }}
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 5. Plant vs Plant */}
      <Section n="5" title="Plant vs Plant — Daily Intensity Comparison" />
      <Card
        title={`Emission Intensity per Day (${uLabel})`}
        badge={`${compareA} vs ${compareB}`}
        icon={GitCompare}
        description="Compare any two plants. When All Plants is selected, this view automatically shows BF1 vs BF2."
        delay={140}
      >
        {plant !== "All Plants" && plantOptions.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span style={{ color: "var(--text3)" }}>Compare</span>
            <select
              value={compareA}
              onChange={(e) => {
                const next = e.target.value;
                if (next === compareB) {
                  const alt = plantOptions.find((p) => p !== next) || next;
                  setCompareB(alt);
                }
                setCompareA(next);
              }}
              className="px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                background: "var(--card2)",
                borderColor: "var(--border2)",
                color: "var(--text)",
              }}
            >
              {plantOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span style={{ color: "var(--text3)" }}>vs</span>
            <select
              value={compareB}
              onChange={(e) => {
                const next = e.target.value;
                if (next === compareA) {
                  const alt = plantOptions.find((p) => p !== next) || next;
                  setCompareA(alt);
                }
                setCompareB(next);
              }}
              className="px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                background: "var(--card2)",
                borderColor: "var(--border2)",
                color: "var(--text)",
              }}
            >
              {plantOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        {isLoading ? (
          <ChartSkeleton height={270} />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <LineChart
              data={compareSeries}
              margin={{ top: 8, right: 16, left: -12, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border2)" }}
                tickLine={false}
                tickFormatter={tickFmt}
                interval={tInt(compareSeries.length)}
              />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.toFixed(3)}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<GenTip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey={compareA}
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{ r: 3, fill: "#f97316" }}
                name={`${compareA} ${uLabel}`}
              />
              <Line
                type="monotone"
                dataKey={compareB}
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{ r: 3, fill: "#60a5fa" }}
                name={`${compareB} ${uLabel}`}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 6. Rolling avg */}
      <Section n="6" title="Rolling 7-Day Average Intensity — Smoothed Trend" />
      <Card
        title={`Instantaneous vs 7-Day Rolling Avg (${uLabel})`}
        badge={`Rolling Avg · ${uLabel}`}
        icon={TrendingDown}
        description="Rolling average filters daily noise to reveal the true trajectory. Falling line = improving performance."
        delay={160}
      >
        {isLoading ? (
          <ChartSkeleton height={250} />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={rolling7.slice(-60)}
              margin={{ top: 8, right: 16, left: -12, bottom: 5 }}
            >
              <defs>
                <linearGradient id="igrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border2)" }}
                tickLine={false}
                tickFormatter={tickFmt}
                interval={tInt(Math.min(rolling7.length, 60))}
              />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.toFixed(3)}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<GenTip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area
                type="monotone"
                dataKey="instant"
                stroke="#94a3b8"
                strokeWidth={1}
                fill="url(#igrad)"
                dot={false}
                name={`Daily Avg (${uLabel})`}
              />
              <Area
                type="monotone"
                dataKey="rolling7"
                stroke="#f97316"
                strokeWidth={2.5}
                fill="url(#rgrad)"
                dot={false}
                name={`7-Day Rolling (${uLabel})`}
                activeDot={{
                  r: 4,
                  fill: "#f97316",
                  stroke: "var(--bg)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 7. Cumulative */}
      <Section n="7" title="Cumulative CO₂ Accumulation" />
      <Card
        title="Total Cumulative CO₂ Over Period (tCO₂)"
        description="Running total against annual/monthly reduction targets."
        delay={180}
      >
        {isLoading ? (
          <ChartSkeleton height={230} />
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart
              data={cumulative}
              margin={{ top: 8, right: 16, left: -12, bottom: 5 }}
            >
              <defs>
                <linearGradient id="cumg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border2)" }}
                tickLine={false}
                tickFormatter={tickFmt}
                interval={tInt(cumulative.length)}
              />
              <YAxis
                tick={{ fill: "var(--text3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v, 0)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div
                      className="rounded-xl border px-4 py-3 text-xs"
                      style={{
                        background: "var(--card3)",
                        borderColor: "var(--border2)",
                      }}
                    >
                      <div style={{ color: "var(--text3)" }}>
                        {label ? fmtDate(label) : ""}
                      </div>
                      <div
                        className="font-bold font-display"
                        style={{ color: "#a855f7" }}
                      >
                        {fmt(payload[0]?.value as number, 0)} tCO₂ cumulative
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#a855f7"
                strokeWidth={2}
                fill="url(#cumg)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#a855f7",
                  stroke: "var(--bg)",
                  strokeWidth: 2,
                }}
                name="Cumulative CO₂"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 8. Decarbonization What-If Simulator */}
      <Section n="8" title="ESG Decarbonization Simulator & Shadow Carbon Price Tracker" />
      <Card
        title="What-If Decarbonization Scenario Simulator"
        icon={Sliders}
        badge="ESG Sandbox"
        description="Simulate the impact of plant modernization levers on absolute footprint, Scope 1/2 intensities, and shadow pricing liabilities."
        delay={200}
      >
        {isLoading || !baselineKPI || !simulatedKPI ? (
          <ChartSkeleton height={350} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-2">
            {/* Left Controls */}
            <div className="lg:col-span-2 flex flex-col gap-5 p-4 rounded-xl" style={{ background: 'var(--card2)', border: '1px solid var(--border2)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Sliders size={16} style={{ color: 'var(--accent)' }} />
                <span className="font-display font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Modernization Levers</span>
              </div>

              {/* Slider 1: Scrap Charging */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>Scrap Charging Increase</span>
                  <span className="font-semibold text-accent font-display">+{scrapRatio}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={scrapRatio}
                  onChange={(e) => setScrapRatio(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-neutral-800 accent-accent"
                  style={{ background: 'var(--bg3)' }}
                />
                <span className="text-[10px]" style={{ color: 'var(--text3)' }}>Replaces crude ore with scrap. Cuts absolute emissions by 0.8% for every 1%.</span>
              </div>

              {/* Slider 2: H2 Fuel Injection */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>Alternative Fuel Injection (PCI/H₂)</span>
                  <span className="font-semibold text-accent font-display">{altFuelRatio}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={altFuelRatio}
                  onChange={(e) => setAltFuelRatio(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-neutral-800 accent-accent"
                  style={{ background: 'var(--bg3)' }}
                />
                <span className="text-[10px]" style={{ color: 'var(--text3)' }}>Substitutes metallurgical coke. Cuts coal-related emissions by 0.5% for every 1%.</span>
              </div>

              {/* Slider 3: Renewable Electricity */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>Renewable Grid Power Sourcing</span>
                  <span className="font-semibold text-accent font-display">{renewSourcing}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={renewSourcing}
                  onChange={(e) => setRenewSourcing(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-neutral-800 accent-accent"
                  style={{ background: 'var(--bg3)' }}
                />
                <span className="text-[10px]" style={{ color: 'var(--text3)' }}>Displaces coal-fired power purchases. Reduces Scope 2 emissions by 1.0% for every 1%.</span>
              </div>
              
              <button 
                onClick={() => { setScrapRatio(0); setAltFuelRatio(0); setRenewSourcing(0); }}
                className="mt-2 text-center text-xs py-2 rounded-xl border border-dashed transition-all hover:bg-neutral-800 hover:border-solid cursor-pointer"
                style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}
              >
                Reset Levers to Baseline
              </button>
            </div>

            {/* Right Comparison Results */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Absolute Emissions */}
              <div className="flex flex-col justify-between p-4 rounded-xl border" style={{ background: 'var(--card2)', borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>Total Net CO₂ Footprint</span>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>{fmt(simulatedKPI.netCO2, 0)}</span>
                    <span className="text-xs" style={{ color: 'var(--text2)' }}>tCO₂</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--text3)' }}>Baseline: {fmt(baselineKPI.netCO2, 0)} t</span>
                  {baselineKPI.netCO2 > simulatedKPI.netCO2 ? (
                    <span className="text-[11px] font-semibold font-display px-2 py-0.5 rounded text-emerald-500 bg-emerald-500/10">
                      -{Math.round(((baselineKPI.netCO2 - simulatedKPI.netCO2) / baselineKPI.netCO2) * 100)}% Red.
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-neutral-400 font-display">No Change</span>
                  )}
                </div>
              </div>

              {/* Box 2: Emission Intensity */}
              <div className="flex flex-col justify-between p-4 rounded-xl border" style={{ background: 'var(--card2)', borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>Decarbonization Intensity</span>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-display" style={{ color: 'var(--text)' }}>{unit === 'per_crude_steel' ? simulatedKPI.intensityCS.toFixed(3) : simulatedKPI.intensityProduct.toFixed(3)}</span>
                    <span className="text-xs" style={{ color: 'var(--text2)' }}>{uLabel}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--text3)' }}>Baseline: {unit === 'per_crude_steel' ? baselineKPI.co2PerCS.toFixed(3) : baselineKPI.co2PerProduct.toFixed(3)}</span>
                  {unit === 'per_crude_steel' ? (
                    simulatedKPI.intensityCS < 1.8 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded text-emerald-400 bg-emerald-500/10 uppercase tracking-wider">Target Achieved</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded text-amber-500 bg-amber-500/10 uppercase tracking-wider">+{ (simulatedKPI.intensityCS - 1.8).toFixed(2) } to SBTi</span>
                    )
                  ) : (
                    <span className="text-[10px] text-neutral-500 italic">SBTi applies to tCS</span>
                  )}
                </div>
              </div>

              {/* Box 3: Carbon Pricing Liability */}
              <div className="flex flex-col justify-between p-4 rounded-xl border" style={{ background: 'var(--card2)', borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>Shadow Carbon Price Liability</span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-xs" style={{ color: 'var(--text3)' }}>₹</span>
                    <span className="text-2xl font-bold font-display text-amber-500">{fmt(simulatedKPI.netCO2 * 2500, 0)}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--text3)' }}>Price base: ₹2,500/tCO₂</span>
                  {baselineKPI.netCO2 > simulatedKPI.netCO2 ? (
                    <span className="text-[11px] font-semibold text-emerald-400">Saved: ₹{fmt((baselineKPI.netCO2 - simulatedKPI.netCO2) * 2500, 0)}</span>
                  ) : (
                    <span className="text-[11px]" style={{ color: 'var(--text3)' }}>No savings</span>
                  )}
                </div>
              </div>

              {/* Box 4: SBTi Target Decarbonization Path */}
              <div className="flex flex-col justify-between p-4 rounded-xl border" style={{ background: 'var(--card2)', borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>Decarbonization Target Compliance</span>
                  <div className="flex items-center gap-2 mt-2">
                    {unit === 'per_crude_steel' && simulatedKPI.intensityCS < 1.8 ? (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-semibold text-xs">SBTi Compliant (&lt; 1.8 t/t)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-rose-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="font-semibold text-xs">Non-compliant (Target 1.8)</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-[10px]" style={{ color: 'var(--text3)' }}>
                  *Aligns with Science-Based Targets Initiative (SBTi) 1.5°C trajectory for iron and steel sector.
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ElaboratePage() {
  return (
    <DataProvider>
      <ThemeWrapper>
        <main className="relative z-10 min-h-screen p-4 lg:p-6 max-w-[1920px] mx-auto">
          <ElaborateContent />
        </main>
      </ThemeWrapper>
    </DataProvider>
  );
}
