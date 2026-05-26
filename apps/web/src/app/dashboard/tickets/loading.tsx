export default function TicketsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header skeleton */}
      <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skeleton" style={{ height: 28, width: 120 }} />
        <div className="skeleton" style={{ height: 32, width: 100, borderRadius: 8 }} />
      </div>

      {/* Views bar skeleton */}
      <div style={{ padding: '0 24px 12px', display: 'flex', gap: 8 }}>
        <div className="skeleton" style={{ height: 28, width: 60, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 28, width: 90, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 28, width: 70, borderRadius: 6 }} />
      </div>

      {/* Filters skeleton */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="skeleton" style={{ height: 36, width: 280, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 8 }} />
      </div>

      {/* Table skeleton */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  );
}
