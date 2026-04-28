'use client';
export function Skeleton({ h = 20, w = '100%', className = '' }: { h?: number; w?: number | string; className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} style={{ height: h, width: w, background: 'var(--card3)' }} />;
}

export function KPISkeleton() {
  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ background: 'var(--card)', borderColor: 'var(--border2)' }}>
      <Skeleton h={11} w="55%" />
      <Skeleton h={34} w="70%" />
      <Skeleton h={10} w="40%" />
      <Skeleton h={10} w="50%" />
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border2)', height }}>
      <Skeleton h={12} w={180} className="mb-5" />
      <div className="flex items-end gap-2" style={{ height: height - 80 }}>
        {[65, 80, 50, 90, 70, 55, 85, 60, 75, 45].map((p, i) => (
          <Skeleton key={i} className="flex-1" h={Math.round((height - 80) * p / 100)} />
        ))}
      </div>
    </div>
  );
}
