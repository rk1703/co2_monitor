'use client';
import { useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { useDashboardStore } from '@/lib/store';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const dateRange = useDashboardStore((s) => s.dateRange);
  const { setBundle, setError, setLoading } = useDashboardStore();
  const updateCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentEtagRef = useRef<string | null>(null);
  const lastRangeKeyRef = useRef<string>('');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    const { dateRange: currentRange } = useDashboardStore.getState();
    const [start, end] = currentRange;
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const rangeKey = `${startStr}|${endStr}`;

    // Reset ETag when user changes date range to ensure new data is fetched
    if (lastRangeKeyRef.current !== rangeKey) {
      currentEtagRef.current = null;
      lastRangeKeyRef.current = rangeKey;
    }

    const params = new URLSearchParams({
      start: startStr,
      end: endStr,
    });

    try {
      const headers: Record<string, string> = {};
      if (currentEtagRef.current) {
        headers['If-None-Match'] = currentEtagRef.current;
      }

      const res = await fetch(`/api/data?${params.toString()}`, {
        cache: 'no-store',
        headers,
      });

      if (res.status === 304) {
        if (!silent) setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const etag = res.headers.get('ETag');
      if (etag) currentEtagRef.current = etag;

      const bundle = await res.json();
      if (bundle.error) throw new Error(bundle.error);

      setBundle(bundle);
    } catch (e: any) {
      if (!silent) setError(e?.message || 'Could not load database data');
    }
  }, [setBundle, setError, setLoading]);

  useEffect(() => {
    fetchData(false);

    // Keep the dashboard in sync with the database.
    updateCheckRef.current = setInterval(() => fetchData(true), 30_000);

    // Hard refresh every 5 minutes to recover from transient failures.
    refreshRef.current = setInterval(() => fetchData(true), 300_000);

    return () => {
      if (updateCheckRef.current) clearInterval(updateCheckRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [fetchData, dateRange]);

  return <>{children}</>;
}

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const theme = useDashboardStore(s => s.theme);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  return <>{children}</>;
}
