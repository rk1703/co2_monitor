// types/index.ts

export type Plant      = 'All Plants' | 'BF1' | 'BF2'| 'Pellet1' | 'Pellet2' | 'Sinter1' | 'Sinter2' | 'SIP' | 'LCP1234' | 'LCP567' | 'COP1' | 'COP2' | 'HSM1' | 'HSM2' | 'BRM' | 'SMS1' | 'SMS2';
export type RecordType = 'CONSUMPTION' | 'PRODUCTION';
export type EmissionUnit = 'per_product' | 'per_crude_steel';
export type PieView    = 'category' | 'subcategory';
export type Theme      = 'dark' | 'light';

// ── Raw rows from the 3 database tables ──────────────────────────────────────
export interface EmissionRow {
  date: string;           // YYYY-MM-DD
  plant: string;          // BF1 | BF2
  type: RecordType;
  category: string;
  subCategory: string;
  qty: number;
  emissionFactor: number;
  absoluteCO2: number;    // negative for PRODUCTION rows
}

export interface ProductRow {
  date: string;
  plant: string;          // BF1 | BF2
  qty: number;            // Hot Metal tonnes
}

export interface CSRow {
  date: string;
  qty: number;            // Crude Steel tonnes – both plants combined
}

export interface DataBundle {
  emissions: EmissionRow[];
  products:  ProductRow[];
  cs:        CSRow[];
  lastModified: string;   // ISO string from the latest database sync
}

// ── Computed / chart shapes ───────────────────────────────────────────────────
export interface KPIData {
  grossCO2:     number;   // SUM consumption CO2
  netCO2:       number;   // gross + production credits
  scope2CO2:    number;   // electricity consumption CO2
  scope1CO2:    number;   // netCO2 - scope2CO2
  totalProduct: number;   // SUM hot metal
  totalCS:      number;   // SUM crude steel
  scope1PerProduct: number;  // scope1CO2 / totalProduct  ← weighted correctly
  scope1PerCS:      number;  // scope1CO2 / totalCS        ← weighted correctly
  scope2PerProduct: number;  // scope2CO2 / totalProduct  ← weighted correctly
  scope2PerCS:      number;  // scope2CO2 / totalCS        ← weighted correctly
  co2PerProduct: number;  // grossCO2 / totalProduct  ← weighted correctly
  co2PerCS:      number;  // grossCO2 / totalCS        ← weighted correctly
  trend:        number;   // % vs prior equal period
  daysInRange:  number;
}

export interface BarItem  { name: string; value: number; unit: string; }
export interface PieSlice { name: string; value: number; fill: string; intensity?: number; }
export interface TimelinePoint { date: string; value: number; bf1?: number; bf2?: number; }
