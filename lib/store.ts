'use client';
import { create } from 'zustand';
import { Plant, EmissionUnit, PieView, Theme, DataBundle } from '@/types';

interface Store {
  dateRange: [Date, Date];
  plant: Plant;
  unit: EmissionUnit;
  pieView: PieView;
  theme: Theme;
  bundle: DataBundle | null;
  lastModified: string;
  isLoading: boolean;
  error: string | null;
  setDateRange: (r: [Date, Date]) => void;
  setPlant:    (p: Plant) => void;
  setUnit:     (u: EmissionUnit) => void;
  setPieView:  (v: PieView) => void;
  toggleTheme: () => void;
  setBundle:   (b: DataBundle) => void;
  setLoading:  (v: boolean) => void;
  setError:    (e: string | null) => void;
}

function getDefaultDateRange(): [Date, Date] {
  const now = new Date();
  return [new Date(now.getFullYear(), now.getMonth()-1, 1), new Date(now.getFullYear(), now.getMonth(), 0)];
}

export const useDashboardStore = create<Store>((set) => ({
  dateRange:    getDefaultDateRange(),
  plant:        'All Plants',
  unit:         'per_crude_steel',
  pieView:      'category',
  theme:        'dark',
  bundle:       null,
  lastModified: '',
  isLoading:    true,
  error:        null,

  setDateRange: (dateRange) => set({ dateRange }),
  setPlant:     (plant) => set((s) => ({ plant, unit: plant === 'All Plants' ? 'per_crude_steel' : s.unit })),
  setUnit:      (unit)    => set({ unit }),
  setPieView:   (pieView) => set({ pieView }),
  toggleTheme:  ()        => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setBundle:    (bundle)  => set({ bundle, lastModified: bundle.lastModified, isLoading: false, error: null }),
  setLoading:   (isLoading) => set({ isLoading }),
  setError:     (error)     => set({ error, isLoading: false }),
}));
