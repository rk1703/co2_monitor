import { NextResponse } from 'next/server';
import { parseSqlServerBundle, getDbLastModified } from '@/lib/parser';
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

    const ifModifiedSince = req.headers.get('if-modified-since');
    let dbLastModified: Date | null = null;

    if (ifModifiedSince) {
      dbLastModified = await getDbLastModified();
      const clientTs = new Date(ifModifiedSince).getTime();
      const serverTs = dbLastModified.getTime();

      if (!Number.isNaN(clientTs) && !Number.isNaN(serverTs) && clientTs >= serverTs) {
        console.log('[/api/data] Fast-path Cache Hit! Returning 304 Not Modified.');
        return new NextResponse(null, {
          status: 304,
          headers: {
            'Cache-Control': 'no-cache, must-revalidate',
            'Last-Modified': dbLastModified.toUTCString(),
          },
        });
      }
    }

    const cachedBundle = getCachedBundle(cacheKey);
    const bundle = cachedBundle ?? await parseSqlServerBundle(start ?? undefined, end ?? undefined);

    if (!cachedBundle) {
      cache.set(cacheKey, {
        bundle,
        fetchedAt: Date.now(),
      });
    }

    if (!dbLastModified) {
      dbLastModified = new Date(bundle.lastModified || Date.now());
    }
    const lastModifiedHeader = dbLastModified.toUTCString();

    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'no-cache, must-revalidate',
        'Last-Modified': lastModifiedHeader,
      },
    });
  } catch (err: any) {
    console.error('[/api/data] Error reading SQL Server data:', err);
    return NextResponse.json({ error: err?.message || 'Failed to read database data' }, { status: 500 });
  }
}
