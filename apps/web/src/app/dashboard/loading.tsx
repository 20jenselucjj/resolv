export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar skeleton */}
      <div style={{
        width: 224, minWidth: 224, background: 'var(--sidebar-bg)',
        display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
      }}>
        <div className="skeleton" style={{ height: 40, width: 120, margin: '0 auto' }} />
        <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
      </div>

      {/* Main content skeleton */}
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 32, width: '40%' }} />
        <div className="skeleton" style={{ height: 16, width: '60%' }} />
        <div className="skeleton" style={{ flex: 1, borderRadius: 12 }} />
      </div>
    </div>
  );
}
