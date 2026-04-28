"use client";
import { KPIData, Plant, EmissionUnit } from "@/types";
import { fmt } from "@/lib/utils";
import {
  TrendingDown,
  TrendingUp,
  Wind,
  Gauge,
  Factory,
  Layers,
} from "lucide-react";
import { KPISkeleton } from "@/components/ui/Skeleton";

function Card({
  title,
  value,
  unit,
  sub,
  trend,
  icon: Icon,
  color,
  loading,
  delay = 0,
}: {
  title: string;
  value: number;
  unit: string;
  sub?: string;
  trend?: number;
  icon: any;
  color: string;
  loading?: boolean;
  delay?: number;
}) {
  if (loading) return <KPISkeleton />;
  const up = trend !== undefined && trend > 0;
  const show = trend !== undefined && trend !== 0;

  return (
    <div
      className="fade-up relative rounded-2xl border overflow-hidden transition-all duration-200 hover:scale-[1.015] hover:shadow-lg cursor-default"
      style={{
        background: "var(--card)",
        borderColor: "var(--border2)",
        animationDelay: `${delay}ms`,
      }}
    >
      {/* top colour bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${color}, ${color}55, transparent)`,
        }}
      />
      {/* subtle bg tint */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ background: color }}
      />

      <div className="relative p-2">
        <div className="flex items-start justify-between mb-1">
          <span
            className="text-[11px] uppercase tracking-widest font-semibold font-display leading-tight max-w-[75%]"
            style={{ color: "var(--text3)" }}
          >
            {title}
          </span>
          <div
            className="w-6 h-6 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}15`, border: `1px solid ${color}28` }}
          >
            <Icon size={15} color={color} />
          </div>
        </div>

        <div
          className="font-display font-bold leading-none mb-1"
          style={{
            color: "var(--text)",
            fontSize: value > 999999 ? 18 : value > 9999 ? 22 : 26,
          }}
        >
          {fmt(value, value >= 100 ? 0 : 4)}
        </div>
        <div className="text-xs mb-1" style={{ color: "var(--text3)" }}>
          {unit}
        </div>
        {sub && (
          <div className="text-[11px] italic" style={{ color: "var(--text4)" }}>
            {sub}
          </div>
        )}

        {show && (
          <div
            className="flex items-center gap-1 mt-3 text-xs font-semibold"
            style={{ color: up ? "var(--red)" : "var(--green)" }}
          >
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend!).toFixed(1)}% vs prior period
          </div>
        )}
      </div>
    </div>
  );
}

export default function KPICards({
  kpi,
  plant,
  unit,
  loading,
}: {
  kpi: KPIData | null;
  plant: Plant;
  unit: EmissionUnit;
  loading: boolean;
}) {
  const isAll = plant === "All Plants";
  const intVal =
    unit === "per_crude_steel"
      ? (kpi?.co2PerCS ?? 0)
      : (kpi?.co2PerProduct ?? 0);
  const intScope1 =
    unit === "per_crude_steel"
      ? (kpi?.scope1PerCS ?? 0)
      : (kpi?.scope1PerProduct ?? 0);
  const intScope2 =
    unit === "per_crude_steel"
      ? (kpi?.scope2PerCS ?? 0)
      : (kpi?.scope2PerProduct ?? 0);
  const intUnit =
    unit === "per_crude_steel" ? "tCO₂ / t Crude Steel" : "tCO₂ / t Product";

  return (
    <div className={`grid grid-cols-1 ${isAll ? 'xl:grid-cols-5' : 'xl:grid-cols-6'} gap-4`}>
      <Card
        title="Gross CO₂ Emissions"
        value={kpi?.netCO2 ?? 0}
        unit="tCO₂ — consumption total"
        trend={kpi?.trend}
        icon={Wind}
        color="#f97316"
        loading={loading}
        delay={0}
      />
      {!isAll && (
        <Card
          title="Product Production"
          value={kpi?.totalProduct ?? 0}
          unit="tonnes — period total"
          icon={Factory}
          color="#22c55e"
          loading={loading}
          delay={120}
        />
      )}
      <Card
        title="Crude Steel Production"
        value={kpi?.totalCS ?? 0}
        unit="tCS — period total"
        sub={`Intensity: ${fmt(kpi?.co2PerCS ?? 0, 4)} tCO₂/tCS`}
        icon={Layers}
        color="#a855f7"
        loading={loading}
        delay={180}
      />
      <Card
        title="Emission Intensity"
        value={intVal}
        unit={intUnit}
        sub={isAll ? "All plants combined" : plant}
        icon={Gauge}
        color="#3b82f6"
        loading={loading}
        delay={60}
      />

      <Card
        title="Scope 1 Emissions"
        value={intScope1}
        unit={intUnit}
        sub={isAll ? "All plants combined" : plant}
        icon={Layers}
        color="#a855f7"
        loading={loading}
        delay={180}
      />
      <Card
        title="Scope 2 Emissions"
        value={intScope2}
        unit={intUnit}
        sub={isAll ? "All plants combined" : plant}
        icon={Layers}
        color="#a855f7"
        loading={loading}
        delay={180}
      />
    </div>
  );
}
