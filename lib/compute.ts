// lib/compute.ts — pure functions, no Node imports, safe on client + server
import { DataBundle, Plant, EmissionUnit, KPIData, BarItem, PieSlice, TimelinePoint } from '@/types';
import { format, eachDayOfInterval } from 'date-fns';

// ─── helpers ─────────────────────────────────────────────────────────────────
function inRange(date: string, start: Date, end: Date): boolean {
  return date >= format(start, 'yyyy-MM-dd') && date <= format(end, 'yyyy-MM-dd');
}
function matchPlant(plant: string, filter: Plant): boolean {
  return filter === 'All Plants' || plant === filter;
}

function normKey(v: string): string {
  return (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── KPI — correctly weighted ─────────────────────────────────────────────────
export function computeKPI(b: DataBundle, start: Date, end: Date, plant: Plant): KPIData {
  const grossCO2 = b.emissions
    .filter(r => r.type === 'CONSUMPTION' && inRange(r.date, start, end) && matchPlant(r.plant, plant))
    .reduce((s, r) => s + r.absoluteCO2, 0);

  const netCO2 = b.emissions
    .filter(r => inRange(r.date, start, end) && matchPlant(r.plant, plant))
    .reduce((s, r) => s + r.absoluteCO2, 0);

  const scope2 = b.emissions
    .filter(r => {
      const sub = normKey(r.subCategory);
      const isElectricity = sub.includes('electricityconsumption');
      return r.type === 'CONSUMPTION' && isElectricity && inRange(r.date, start, end) && matchPlant(r.plant, plant);
    })
    .reduce((s, r) => s + r.absoluteCO2, 0);    

  const scope1 = netCO2 - scope2;

  const totalProduct = b.products
    .filter(r => inRange(r.date, start, end) && matchPlant(r.plant, plant))
    .reduce((s, r) => s + r.qty, 0);

  const totalCS = b.cs
    .filter(r => inRange(r.date, start, end))
    .reduce((s, r) => s + r.qty, 0);

  const rangeDays  = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const priorEnd   = new Date(start.getTime() - 86400000);
  const priorStart = new Date(priorEnd.getTime() - rangeDays * 86400000);
  const priorNet = b.emissions
    .filter(r => inRange(r.date, priorStart, priorEnd) && matchPlant(r.plant, plant))
    .reduce((s, r) => s + r.absoluteCO2, 0);

  return {
    grossCO2:     Math.round(grossCO2),
    netCO2:       Math.round(netCO2),
    scope2CO2:    Math.round(scope2),
    scope1CO2:    Math.round(scope1),
    totalProduct: Math.round(totalProduct),
    totalCS:      Math.round(totalCS),
    scope1PerProduct: totalProduct > 0 ? Math.round((scope1 / totalProduct) * 100000) / 100000 : 0,
    scope1PerCS:      totalCS > 0     ? Math.round((scope1 / totalCS)      * 100000) / 100000 : 0,
    scope2PerProduct: totalProduct > 0 ? Math.round((scope2 / totalProduct) * 100000) / 100000 : 0,
    scope2PerCS:      totalCS > 0     ? Math.round((scope2 / totalCS)      * 100000) / 100000 : 0,
    co2PerProduct: totalProduct > 0 ? Math.round((netCO2 / totalProduct) * 100000) / 100000 : 0,
    co2PerCS:      totalCS > 0     ? Math.round((netCO2 / totalCS)      * 100000) / 100000 : 0,
    trend:        priorNet > 0 ? Math.round(((netCO2 - priorNet) / priorNet) * 1000) / 10 : 0,
    daysInRange:  rangeDays,
  };
}

// ─── bar: all plants → per plant; single → subcategory ───────────────────────
export function computePlantBar(b: DataBundle, start: Date, end: Date): BarItem[] {
  const plants = Array.from(new Set(b.emissions.map(r => r.plant)))
    .filter((plant): plant is Plant => plant !== 'All Plants' && plant.length > 0);

  return plants
    .map(p => ({ name: p, value: computeKPI(b, start, end, p).co2PerCS, unit: 'tCO₂/tCS' }))
    .sort((a, b) => b.value - a.value);
}

export function computeSubCategoryBar(b: DataBundle, start: Date, end: Date, plant: Plant, unit: EmissionUnit): BarItem[] {
  const filterEmissions = b.emissions.filter(r => inRange(r.date, start, end) && matchPlant(r.plant, plant));
  const prod = b.products.filter(r => inRange(r.date, start, end) && matchPlant(r.plant, plant)).reduce((s, r) => s + r.qty, 0);
  const cs   = b.cs.filter(r => inRange(r.date, start, end)).reduce((s, r) => s + r.qty, 0);
  const denom = unit === 'per_product' ? prod : cs;

  const map = new Map<string, number>();
  filterEmissions.forEach(r => map.set(r.subCategory, (map.get(r.subCategory) || 0) + r.absoluteCO2));

  return Array.from(map.entries())
    .map(([name, co2]) => ({ name, value: denom > 0 ? Math.round((co2 / denom) * 100000) / 100000 : 0, unit: unit === 'per_product' ? 'tCO₂/tP' : 'tCO₂/tCS' }))
    .filter(x => Math.abs(x.value) > 1e-7)
    .sort((a, b) => b.value - a.value);
}

// ─── pie ─────────────────────────────────────────────────────────────────────
export const CAT_COLORS: Record<string, string> = {
  CBRM: '#f97316', IBRM: '#60a5fa', FLUXES: '#eab308', GAS: '#22c55e',
  POWER: '#a855f7', DUST: '#94a3b8', PRODUCT: '#10b981', STEAM: '#f43f5e',
  'Purchased Coke': '#f97316', 'Coke': '#fb923c', 'Nut Coke': '#fdba74', 'PCI': '#c2410c',
  'Iron Ore': '#60a5fa', 'Limestone (Aggregate)': '#fde047', 'Dolomite (Aggregate)': '#ca8a04',
  'Natural Gas': '#4ade80', 'COG': '#22c55e', 'Purchased COG': '#16a34a',
  'Electricity Consumption': '#c084fc', 'Hot Metal Production': '#10b981',
  'BFG Generation (Net)': '#34d399', 'Coke Fines Produced': '#6b7280',
  'Nut Coke Produced': '#9ca3af', 'Other Dust Produced': '#cbd5e1',
  'RABH Dust Produced': '#e2e8f0', 'Flue Dust Produced': '#4b5563',
  'TRT': '#818cf8', 'Steam Production': '#fb7185', 'Pig Iron Production': '#059669',
};

const FALLBACK_PIE_PALETTE = [
  '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7',
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#d946ef',
];

function hashString(v: string): number {
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
  return h;
}

function pieColorFor(name: string): string {
  if (CAT_COLORS[name]) return CAT_COLORS[name];
  const idx = hashString(name.trim().toLowerCase()) % FALLBACK_PIE_PALETTE.length;
  return FALLBACK_PIE_PALETTE[idx];
}

export function computePieData(
  b: DataBundle,
  start: Date,
  end: Date,
  plant: Plant,
  view: 'category' | 'subcategory',
  unit: EmissionUnit,
): PieSlice[] {
  const map = new Map<string, number>();
  b.emissions
    .filter(r => inRange(r.date, start, end) && matchPlant(r.plant, plant))
    .forEach(r => { const k = view === 'category' ? r.category : r.subCategory; map.set(k, (map.get(k) || 0) + r.absoluteCO2); });

  const prod = b.products
    .filter(r => inRange(r.date, start, end) && matchPlant(r.plant, plant))
    .reduce((s, r) => s + r.qty, 0);
  const cs = b.cs
    .filter(r => inRange(r.date, start, end))
    .reduce((s, r) => s + r.qty, 0);
  const denom = unit === 'per_product' ? prod : cs;

  return Array.from(map.entries())
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      fill: pieColorFor(name),
      intensity: denom > 0 ? Math.round((value / denom) * 100000) / 100000 : 0,
    }))
    .filter(x => Math.abs(x.value) > 1e-7)
    .sort((a, b) => b.value - a.value);
}

// ─── timeline ────────────────────────────────────────────────────────────────
function dayVal(b: DataBundle, date: string, plantName: string, unit: EmissionUnit): number | null {
  const co2 = b.emissions
    .filter(r => r.date === date && r.plant === plantName)
    .reduce((s, r) => s + r.absoluteCO2, 0);
  const prod = b.products
    .filter(r => r.date === date && r.plant === plantName)
    .reduce((s, r) => s + r.qty, 0);
  // Sum all CS rows for this date in case CS table has multiple entries (per plant or duplicates)
  const cs = b.cs
    .filter(r => r.date === date)
    .reduce((s, r) => s + r.qty, 0);
  const den = unit === 'per_crude_steel' ? cs : prod;
  return co2 > 0 && den > 0 ? Math.round((co2 / den) * 100000) / 100000 : null;
}

function dayOverallVal(b: DataBundle, date: string, unit: EmissionUnit, plants: string[]): number | null {
  const co2 = b.emissions
    .filter(r => r.date === date && plants.includes(r.plant))
    .reduce((s, r) => s + r.absoluteCO2, 0);
  const prod = b.products
    .filter(r => r.date === date && plants.includes(r.plant))
    .reduce((s, r) => s + r.qty, 0);
  // Sum all CS rows for this date (CS table may have one row per plant or one global row)
  const cs = b.cs
    .filter(r => r.date === date)
    .reduce((s, r) => s + r.qty, 0);
  const den = unit === 'per_crude_steel' ? cs : prod;
  return co2 > 0 && den > 0 ? Math.round((co2 / den) * 100000) / 100000 : null;
}

export function computeTimeline(b: DataBundle, start: Date, end: Date, plant: Plant, unit: EmissionUnit): TimelinePoint[] {
  const plants = Array.from(new Set([...b.emissions.map(r => r.plant), ...b.products.map(r => r.plant)]))
    .filter(p => p && p !== 'All Plants');

  return eachDayOfInterval({ start, end }).map(day => {
    const d = format(day, 'yyyy-MM-dd');
    if (plant === 'All Plants') {
      return { date: d, value: dayOverallVal(b, d, unit, plants) ?? 0 };
    }
    return { date: d, value: dayVal(b, d, plant, unit) ?? 0 };
  });
}

// ─── elaborate ───────────────────────────────────────────────────────────────
export interface StackedPoint { date: string; CBRM: number; IBRM: number; FLUXES: number; GAS: number; POWER: number; }
export function computeStackedTimeline(b: DataBundle, start: Date, end: Date, plant: Plant): StackedPoint[] {
  return eachDayOfInterval({ start, end }).map(day => {
    const d = format(day, 'yyyy-MM-dd');
    const dr = b.emissions.filter(r => r.date === d && matchPlant(r.plant, plant));
    const sum = (cat: string) => Math.round(dr.filter(r => r.category === cat).reduce((s, r) => s + r.absoluteCO2, 0));
    return { date: d, CBRM: sum('CBRM'), IBRM: sum('IBRM'), FLUXES: sum('FLUXES'), GAS: sum('GAS'), POWER: sum('POWER') };
  });
}

export interface ScatterPoint { x: number; y: number; z: number; plant: string; date: string; }
export function computeScatterData(b: DataBundle, start: Date, end: Date): ScatterPoint[] {
  const plants = Array.from(new Set([...b.emissions.map(r => r.plant), ...b.products.map(r => r.plant)]))
    .filter(p => p && p !== 'All Plants');

  return eachDayOfInterval({ start, end }).flatMap(day => {
    const d = format(day, 'yyyy-MM-dd');
    return plants.flatMap(plant => {
      const co2  = b.emissions.filter(r => r.date === d && r.plant === plant).reduce((s, r) => s + r.absoluteCO2, 0);
      const prod = b.products.find(r => r.date === d && r.plant === plant)?.qty || 0;
      return prod > 0 && co2 > 0 ? [{ x: Math.round(prod), y: Math.round((co2/prod)*100000)/100000, z: Math.round(co2), plant, date: d }] : [];
    });
  });
}

export interface CatPoint { date: string; [k: string]: string | number; }
export function computeCategoryTimeline(b: DataBundle, start: Date, end: Date, plant: Plant): CatPoint[] {
  return eachDayOfInterval({ start, end }).map(day => {
    const d = format(day, 'yyyy-MM-dd');
    const dr = b.emissions.filter(r => r.date === d && matchPlant(r.plant, plant));
    const pt: CatPoint = { date: d };
    ['CBRM','GAS','POWER','FLUXES','IBRM'].forEach(cat => { pt[cat] = Math.round(dr.filter(r => r.category === cat).reduce((s, r) => s + r.absoluteCO2, 0)); });
    return pt;
  });
}
