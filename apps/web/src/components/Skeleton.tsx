'use client';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, borderRadius, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: borderRadius ?? undefined,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-hidden="true" className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={14}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 32 }: { size?: number }) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius="50%"
      aria-hidden="true"
    />
  );
}

export function SkeletonButton({ width = 80 }: { width?: number }) {
  return (
    <Skeleton
      width={width}
      height={32}
      borderRadius="var(--radius-md)"
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card ${className}`} aria-hidden="true" style={{ padding: 18 }}>
      <Skeleton width="40%" height={18} />
      <div style={{ height: 12 }} />
      <SkeletonText lines={3} />
      <div style={{ height: 12 }} />
      <Skeleton width="30%" height={14} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} height={16} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({ className = '' }: { className?: string }) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
      {/* Title */}
      <Skeleton width="30%" height={28} />
      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`f-${i}`} width={100} height={32} borderRadius="var(--radius-md)" />
        ))}
      </div>
      {/* Content */}
      <SkeletonTable rows={6} columns={5} />
    </div>
  );
}
