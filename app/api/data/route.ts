import { NextResponse } from 'next/server';
import { parseSqlServerBundle, getDbLastModified } from '@/lib/parser';
import { DataBundle } from '@/types';

// Never cache at edge — dynamic API route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_CACHE_MS = Number(process.env.API_DATA_CACHE_MS ?? 30_000);

type CacheEntry = {
  bundle: DataBundle;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();

function buildCacheKey(start: string | null, end: string | null): string {
  return `${start ?? 'all'}|${end ?? 'all'}`;
}

function isDateRangeValue(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = isDateRangeValue(url.searchParams.get('start')) ? url.searchParams.get('start') : null;
    const end = isDateRangeValue(url.searchParams.get('end')) ? url.searchParams.get('end') : null;
    const cacheKey = buildCacheKey(start, end);

    const dbLastModified = await getDbLastModified();
    const dbLastModifiedMs = dbLastModified.getTime();
    const etag = `W/"${cacheKey}-${dbLastModifiedMs}"`;

    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Cache-Control': 'no-cache, must-revalidate',
          'ETag': etag,
          'Last-Modified': dbLastModified.toUTCString(),
        },
      });
    }

    const now = Date.now();
    const cachedEntry = cache.get(cacheKey);

    let bundle: DataBundle;
    if (cachedEntry && (now - cachedEntry.fetchedAt < API_CACHE_MS)) {
      bundle = cachedEntry.bundle;
    } else {
      bundle = await parseSqlServerBundle(start ?? undefined, end ?? undefined);
      cache.set(cacheKey, {
        bundle,
        fetchedAt: now,
      });
    }

    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'no-cache, must-revalidate',
        'ETag': etag,
        'Last-Modified': dbLastModified.toUTCString(),
      },
    });
  } catch (err: any) {
    console.error('[/api/data] Error reading SQL Server data:', err);
    return NextResponse.json({ error: err?.message || 'Failed to read database data' }, { status: 500 });
  }
}
