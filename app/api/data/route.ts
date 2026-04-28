import { NextResponse } from 'next/server';
import { parseSqlServerBundle } from '@/lib/parser';
import { DataBundle } from '@/types';

// Never cache — always read fresh from SQL Server
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_CACHE_MS = Number(process.env.API_DATA_CACHE_MS ?? 30_000);

type CacheEntry = {
  bundle: DataBundle;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();

function buildCacheKey(start: string | null, end: string | null): string {
  return `${start ?? ''}|${end ?? ''}`;
}

function isDateRangeValue(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getLastModifiedHeader(bundle: DataBundle): string | null {
  if (!bundle.lastModified) return null;
  const ts = new Date(bundle.lastModified).getTime();
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toUTCString();
}

function getCachedBundle(cacheKey: string): DataBundle | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= API_CACHE_MS) {
    cache.delete(cacheKey);
    return null;
  }

  return entry.bundle;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = isDateRangeValue(url.searchParams.get('start')) ? url.searchParams.get('start') : null;
    const end = isDateRangeValue(url.searchParams.get('end')) ? url.searchParams.get('end') : null;
    const cacheKey = buildCacheKey(start, end);

    const cachedBundle = getCachedBundle(cacheKey);
    const bundle = cachedBundle ?? await parseSqlServerBundle(start ?? undefined, end ?? undefined);

    if (!cachedBundle) {
      cache.set(cacheKey, {
        bundle,
        fetchedAt: Date.now(),
      });
    }

    const lastModified = getLastModifiedHeader(bundle);
    const ifModifiedSince = req.headers.get('if-modified-since');

    if (ifModifiedSince && lastModified) {
      const clientTs = new Date(ifModifiedSince).getTime();
      const serverTs = new Date(lastModified).getTime();

      if (!Number.isNaN(clientTs) && !Number.isNaN(serverTs) && clientTs >= serverTs) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            'Cache-Control': 'no-cache, must-revalidate',
            'Last-Modified': lastModified,
          },
        });
      }
    }

    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'no-cache, must-revalidate',
        ...(lastModified ? { 'Last-Modified': lastModified } : {}),
      },
    });
  } catch (err: any) {
    console.error('[/api/data] Error reading SQL Server data:', err);
    return NextResponse.json({ error: err?.message || 'Failed to read database data' }, { status: 500 });
  }
}
