// lib/parser.ts — SERVER ONLY (Node.js, runs in API routes)
// Reads SQL Server tables and returns a DataBundle.

import sql from 'mssql';
import { getPool, quoteIdentifier, quoteQualifiedName } from '@/lib/db';
import { CSRow, DataBundle, EmissionRow, ProductRow, RecordType } from '@/types';

const EMISSION_TABLE = process.env.CO2_ABSOLUTE_EMISSION_TABLE ?? 'CO2_ABSOLUTE_EMISSION';
const PRODUCT_TABLE = process.env.CO2_PRODUCT_TABLE ?? 'CO2_PRODUCT';
const CS_TABLE = process.env.CO2_CS_PRODUCTION_TABLE ?? 'CO2_CS_PRODUCTION';
const TABLE_SCHEMA = process.env.CO2_DB_SCHEMA ?? 'dbo';

const EMISSION_COLUMN_ALIASES = {
  date: ['PROD_DATE', 'DATE', 'Date', 'date'],
  plant: ['PLANT', 'Plant', 'plant'],
  type: ['PROD_TYPE', 'TYPE', 'Type', 'type'],
  category: ['CATEGORY', 'Category', 'category'],
  subCategory: ['SUB_CATEGORY', 'SUB CATEGORY', 'Sub Category', 'SubCategory', 'subcategory', 'sub_category'],
  qty: ['QTY', 'Qty.', 'Qty', 'quantity', 'qty'],
  emissionFactor: ['EMISSION_FACTOR', 'Emission Factor', 'EmissionFactor', 'emission_factor', 'emissionfactor'],
  absoluteCO2: ['ABSOLUTE_CO2_EMISSION', 'ABSOLUTE CO2 EMISSION', 'Absolute CO2 Emission', 'absolute_co2_emission', 'absoluteco2emission'],
} as const;

const PRODUCT_COLUMN_ALIASES = {
  date: ['PROD_DATE', 'DATE', 'Date', 'date'],
  plant: ['PLANT', 'Plant', 'plant'],
  qty: ['PRODUCT_QTY', 'Product', 'PRODUCT', 'product', 'Hot Metal', 'HotMetal', 'hot_metal'],
} as const;

const CS_COLUMN_ALIASES = {
  date: ['PROD_DATE', 'DATE', 'Date', 'date'],
  qty: ['CS_PRODUCTION', 'CS Production', 'CSPRODUCTION', 'cs_production', 'CS'],
} as const;

function toLocalYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDate(value: unknown): string {
  if (!value) return '';

  if (value instanceof Date) {
    return toLocalYMD(value);
  }

  const text = String(value).trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  if (text.includes('/')) {
    const [first, second, third] = text.split('/');
    if (third && third.length === 4) return `${third}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : toLocalYMD(parsed);
}

function n(value: unknown): number {
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;

  const parsed = parseFloat(String(value ?? '0').replace(/,/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normKey(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normKey(key)] = value;
    return acc;
  }, {});
}

function pick(normalized: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = normalized[normKey(key)];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function parseTimestamp(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function deriveLastModified(rows: Array<Record<string, unknown>>[]): string {
  const timestampKeys = ['updatedAt', 'modifiedAt', 'lastModified', 'lastUpdated', 'updated', 'modified', 'createdAt', 'timestamp'];
  let latest = 0;

  rows.flat().forEach((row) => {
    const normalized = normaliseRow(row);
    timestampKeys.forEach((key) => {
      const timestamp = parseTimestamp(normalized[normKey(key)]);
      if (timestamp && timestamp > latest) {
        latest = timestamp;
      }
    });
  });

  return new Date(latest || Date.now()).toISOString();
}

function isDateRangeValue(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

interface TableColumn {
  column_name: string;
  data_type: string;
}

const dateColumnCache = new Map<string, string | null>();

async function resolveDateColumn(tableName: string): Promise<string | null> {
  const cached = dateColumnCache.get(tableName);
  if (cached !== undefined) return cached;

  const pool = await getPool();
  const result = await pool.request()
    .input('schema', sql.NVarChar, TABLE_SCHEMA)
    .input('tableName', sql.NVarChar, tableName)
    .query(`SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @schema
       AND TABLE_NAME = @tableName
     ORDER BY ORDINAL_POSITION`);

  const columns = result.recordset as TableColumn[];
  const normalizedDateTypes = new Set(['date', 'timestamp without time zone', 'timestamp with time zone', 'timestamp']);
  const candidate =
    columns.find((column) => normKey(column.column_name) === 'date') ||
    columns.find((column) => normalizedDateTypes.has(column.data_type.toLowerCase())) ||
    columns.find((column) => normKey(column.column_name).includes('date')) ||
    null;

  const resolved = candidate?.column_name ?? null;
  dateColumnCache.set(tableName, resolved);
  return resolved;
}

async function readTable(
  tableName: string,
  dateRange?: { start: string; end: string },
): Promise<Array<Record<string, unknown>>> {
  const pool = await getPool();

  try {
    const request = pool.request();

    if (dateRange) {
      const dateColumn = await resolveDateColumn(tableName);

      if (dateColumn) {
        request.input('start', sql.VarChar(10), dateRange.start);
        request.input('end', sql.VarChar(10), dateRange.end);

        const result = await request.query(
          `SELECT *
           FROM ${quoteQualifiedName(TABLE_SCHEMA)}.${quoteIdentifier(tableName)}
           WHERE CAST(${quoteIdentifier(dateColumn)} AS date) BETWEEN CONVERT(date, @start) AND CONVERT(date, @end)
           ORDER BY ${quoteIdentifier(dateColumn)} ASC`,
        );

        return result.recordset as Array<Record<string, unknown>>;
      }
    }

    const result = await request.query(`SELECT * FROM ${quoteQualifiedName(TABLE_SCHEMA)}.${quoteIdentifier(tableName)}`);
    return result.recordset as Array<Record<string, unknown>>;
  } catch (error: any) {
    if (error?.number === 208) {
      return [];
    }

    throw error;
  }
}

export async function parseSqlServerBundle(start?: string, end?: string): Promise<DataBundle> {
  const dateRange = isDateRangeValue(start) && isDateRangeValue(end) ? { start, end } : undefined;

  const [emissionRows, productRows, csRows] = await Promise.all([
    readTable(EMISSION_TABLE, dateRange),
    readTable(PRODUCT_TABLE, dateRange),
    readTable(CS_TABLE, dateRange),
  ]);

  const emissions: EmissionRow[] = emissionRows
    .map((row) => {
      const normalized = normaliseRow(row);

      return {
        date: resolveDate(pick(normalized, ...EMISSION_COLUMN_ALIASES.date)),
        plant: String(pick(normalized, ...EMISSION_COLUMN_ALIASES.plant) ?? '').trim(),
        type: String(pick(normalized, ...EMISSION_COLUMN_ALIASES.type) ?? 'CONSUMPTION') as RecordType,
        category: String(pick(normalized, ...EMISSION_COLUMN_ALIASES.category) ?? '').trim(),
        subCategory: String(pick(normalized, ...EMISSION_COLUMN_ALIASES.subCategory) ?? '').trim(),
        qty: n(pick(normalized, ...EMISSION_COLUMN_ALIASES.qty)),
        emissionFactor: n(pick(normalized, ...EMISSION_COLUMN_ALIASES.emissionFactor)),
        absoluteCO2: n(pick(normalized, ...EMISSION_COLUMN_ALIASES.absoluteCO2)),
      };
    })
    .filter((row) => row.date && row.plant);

  const products: ProductRow[] = productRows
    .map((row) => {
      const normalized = normaliseRow(row);

      return {
        date: resolveDate(pick(normalized, ...PRODUCT_COLUMN_ALIASES.date)),
        plant: String(pick(normalized, ...PRODUCT_COLUMN_ALIASES.plant) ?? '').trim(),
        qty: n(pick(normalized, ...PRODUCT_COLUMN_ALIASES.qty)),
      };
    })
    .filter((row) => row.date && row.plant);

  const cs: CSRow[] = csRows
    .map((row) => {
      const normalized = normaliseRow(row);

      return {
        date: resolveDate(pick(normalized, ...CS_COLUMN_ALIASES.date)),
        qty: n(pick(normalized, ...CS_COLUMN_ALIASES.qty)),
      };
    })
    .filter((row) => row.date && row.qty > 0);

  return {
    emissions,
    products,
    cs,
    lastModified: deriveLastModified([emissionRows, productRows, csRows]),
  };
}
