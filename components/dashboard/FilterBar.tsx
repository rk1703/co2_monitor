'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useDashboardStore } from '@/lib/store';
import { Plant } from '@/types';
import { Sun, Moon, Factory, Zap, RefreshCw, ChevronDown } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const PLANTS: Plant[] = ['All Plants', 'BF1', 'BF2', 'Pellet1', 'Pellet2', 'Sinter1', 'Sinter2', 'SIP', 'LCP1234', 'LCP567' ,'COP1', 'COP2', 'HSM1', 'HSM2', 'BRM', 'SMS1', 'SMS2'];

export default function FilterBar() {
  const { dateRange, plant, unit, theme, lastModified, isLoading, setDateRange, setPlant, setUnit, toggleTheme, setBundle, setLoading, setError } = useDashboardStore();
  const [start, end] = dateRange;
  const isAll = plant === 'All Plants';
  const plantMenuRef = useRef<HTMLDivElement>(null);
  const [isPlantMenuOpen, setIsPlantMenuOpen] = useState(false);

  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!plantMenuRef.current?.contains(event.target as Node)) {
        setIsPlantMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Refresh data from API
  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    });

    try {
      const res = await fetch(`/api/data?${params.toString()}`, {
        cache: 'no-store',
        headers: lastModified ? { 'If-Modified-Since': new Date(lastModified).toUTCString() } : undefined,
      });

      if (res.status === 304) {
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bundle = await res.json();
      if (bundle.error) throw new Error(bundle.error);
      setBundle(bundle);
    } catch (e: any) { setError(e?.message); }
  }, [setBundle, setLoading, setError, start, end, lastModified]);

  const preset = (days: number) => {
    const e = normalizeDate(new Date());
    const s = new Date(e.getTime() - (days-1) * 86400000);
    setDateRange([s, e]);
  };

  const liveLabel = lastModified
    ? new Date(lastModified).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <header className="relative z-20">
      <div className="glass px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-3"
        style={{ borderColor: 'var(--border2)' }}>

        {/* Brand */}
        <div className="flex items-center gap-2.5 mr-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)', boxShadow: '0 0 16px var(--accent-glow)' }}>
            <Factory size={15} color="#fff" />
          </div>
          <div>
            <div className="font-display font-bold text-sm leading-none" style={{ color: 'var(--text)' }}>CO₂ Monitor</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>Steel Plant</div>
          </div>
        </div>

        <div className="h-6 w-px hidden lg:block" style={{ background: 'var(--border2)' }} />

        {/* Date Range */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: 'var(--text3)' }}>Period</span>
          <div className="flex items-center gap-1.5">
            <DatePicker selected={start} onChange={(d: Date | null) => d && setDateRange([normalizeDate(d), normalizeDate(end)])}
              selectsStart startDate={start} endDate={end} maxDate={new Date()}
              dateFormat="dd MMM yy" className="date-input-small" popperPlacement="bottom-start" />
            <span style={{ color: 'var(--text4)', fontSize: 12 }}>→</span>
            <DatePicker selected={end} onChange={(d: Date | null) => d && setDateRange([normalizeDate(start), normalizeDate(d)])}
              selectsEnd startDate={start} endDate={end} minDate={start} maxDate={new Date()}
              dateFormat="dd MMM yy" className="date-input-small" popperPlacement="bottom-start" />
          </div>
          <div className="flex gap-1">
            {[7, 30].map(d => (
              <button key={d} onClick={() => preset(d)}
                className="text-[11px] px-2 py-0.5 rounded-md transition-all hover:opacity-80 font-medium"
                style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                {d}D
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px hidden lg:block" style={{ background: 'var(--border2)' }} />

        {/* Plant */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Plant</span>
          <div
            ref={plantMenuRef}
            className="relative rounded-xl transition-all duration-150"
            style={{
              border: '1px solid var(--border2)',
              background: 'linear-gradient(180deg, var(--bg2) 0%, var(--bg3) 100%)',
              boxShadow: plant !== 'All Plants' ? '0 0 12px var(--accent-glow)' : 'none',
            }}
          >
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isPlantMenuOpen}
              onClick={() => setIsPlantMenuOpen((v) => !v)}
              className="text-xs pl-3 pr-9 py-1.5 font-display font-semibold cursor-pointer text-left"
              style={{
                color: 'var(--text)',
                background: 'transparent',
                minWidth: 150,
              }}
            >
              {plant || 'All Plants'}
            </button>
            <ChevronDown
              size={14}
              className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform duration-150 ${isPlantMenuOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text4)' }}
            />

            {isPlantMenuOpen && (
              <div
                role="listbox"
                className="absolute top-full left-0 mt-1 z-50 min-w-full rounded-xl p-1"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border2)',
                  boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
                }}
              >
                {PLANTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={plant === p}
                    onClick={() => {
                      setPlant(p);
                      setIsPlantMenuOpen(false);
                    }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg font-display font-semibold transition-all duration-150"
                    style={{
                      background: plant === p ? 'var(--accent-dim)' : 'transparent',
                      color: plant === p ? 'var(--accent)' : 'var(--text2)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="h-6 w-px hidden lg:block" style={{ background: 'var(--border2)' }} />

        {/* Unit */}
        <div className="flex items-center gap-2">
          <Zap size={12} style={{ color: isAll ? 'var(--text4)' : 'var(--accent2)' }} />
          <div className="flex rounded-xl overflow-hidden text-xs"
            style={{ border: '1px solid var(--border2)', opacity: isAll ? 0.4 : 1, pointerEvents: isAll ? 'none' : 'auto' }}>
            {(['per_product', 'per_crude_steel'] as const).map(u => (
              <button key={u} onClick={() => setUnit(u)}
                className="px-3 py-1.5 font-medium transition-all duration-150"
                style={{ background: unit === u ? 'var(--accent2)' : 'transparent', color: unit === u ? '#fff' : 'var(--text2)' }}>
                {u === 'per_product' ? 'tCO₂/tP' : 'tCO₂/tCS'}
              </button>
            ))}
          </div>
          {isAll && <span className="text-[10px]" style={{ color: 'var(--text4)' }}>locked tCO₂/tCS</span>}
        </div>

        <div className="flex-1" />

        {/* Live data badge */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--green)' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
            style={{ background: 'var(--green)', animation: 'pulse-dot 2s infinite' }} />
          <span className="font-medium">Live</span>
          <span style={{ color: 'var(--text3)', fontSize: 10 }}>{liveLabel}</span>
        </div>

        {/* Refresh */}
        <button onClick={refresh} disabled={isLoading}
          title="Refresh data from SQL Server"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
          <RefreshCw size={14} style={{ color: 'var(--text2)', animation: isLoading ? 'spin-slow 1s linear infinite' : 'none' }} />
        </button>

        {/* Theme */}
        <button onClick={toggleTheme}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
          {theme === 'dark'
            ? <Sun size={14} style={{ color: 'var(--yellow)' }} />
            : <Moon size={14} style={{ color: 'var(--accent2)' }} />}
        </button>
      </div>
    </header>
  );
}
