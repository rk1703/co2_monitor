# CO₂ Dashboard — Steel Plant
## Live SQL Server-driven · No static data · Always in sync

---

## Quick Start

```bash
npm install
npm run dev
```
→ Opens at **http://localhost:3000** (redirects to `/dashboard`)

---

## How the live data works

The dashboard reads directly from SQL Server. The API returns the same `DataBundle` shape the UI already expects, so the charts and calculations do not need to change.

The column rename rules used by the parser are documented in [column_mapping.txt](column_mapping.txt) and are treated as the source of truth.

The app queries three tables by default:

- `CO2_ABSOLUTE_EMISSION`
- `CO2_PRODUCT`
- `CO2_CS_PRODUCTION`

You can override those table names with environment variables:

- `CO2_ABSOLUTE_EMISSION_TABLE`
- `CO2_PRODUCT_TABLE`
- `CO2_CS_PRODUCTION_TABLE`

The database connection is built from `.env.local` or your environment variables. Set `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`, and optionally `SQL_PORT`.

If you need to change transport options, set `SQL_SERVER_ENCRYPT=true` or `SQL_SERVER_TRUST_SERVER_CERTIFICATE=false`.

The UI polls every **30 seconds** and also does a slower refresh every **5 minutes** to recover from transient connection issues.

The server matches columns by normalized name, so `DATE`, `Date`, `date`, and similar variants all work.

---

## Expected tables

### Table 1: `Absolute Emission`
Expected columns:

- date
- plant
- type
- category
- sub category
- qty
- emission factor
- absolute co2 emission

### Table 2: `Product`
Expected columns:

- date
- plant
- product or hot metal

### Table 3: `CS Production`
Expected columns:

- date
- cs production

If your database uses different casing or underscore naming, that is fine. The API normalizes column names before mapping them into the dashboard rows.

---

## Why the calculation is correct

The dashboard uses **weighted average** for any date range:

```
CO₂/tHM = SUM(gross CO₂ for range) ÷ SUM(Hot Metal for range)
CO₂/tCS = SUM(gross CO₂ for range) ÷ SUM(Crude Steel for range)
```

This is correct. Simply summing the pre-computed `CO₂/ton` column from the database would be wrong because each day's ratio has a different denominator. The dashboard always recomputes from raw totals.

---

## Project structure

```
co2-dashboard/
├── app/
│   ├── api/
│   │   ├── data/route.ts      ← GET: reads SQL Server, returns DataBundle JSON
│   ├── dashboard/page.tsx     ← main big-screen dashboard
│   └── elaborate/page.tsx     ← scrollable analytics (7 charts)
├── components/
│   ├── dashboard/             ← FilterBar, KPICards, BarChart, PieChart, Timeline
│   ├── elaborate/             ← 7-chart analytics page component
│   └── ui/                    ← ErrorBoundary, Skeleton, Providers
├── lib/
│   ├── db.ts                  ← SERVER ONLY: SQL Server pool helpers
│   ├── parser.ts              ← SERVER ONLY: SQL Server data loader
│   ├── compute.ts             ← pure functions: KPI, chart data
│   ├── store.ts               ← Zustand state
│   └── utils.ts               ← formatting helpers
└── types/index.ts             ← EmissionRow, ProductRow, CSRow, DataBundle, KPIData
```

---

## Tech stack
Next.js 14 · Recharts · Zustand · react-datepicker · mssql · Tailwind CSS · date-fns · Space Grotesk + Inter
