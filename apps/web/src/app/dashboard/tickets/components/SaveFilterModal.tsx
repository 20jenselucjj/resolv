'use client';

export function SaveFilterModal({
  showSaveFilter,
  setShowSaveFilter,
  handleSaveFilter,
  filterName,
  setFilterName,
}: {
  showSaveFilter: boolean;
  setShowSaveFilter: (v: boolean) => void;
  handleSaveFilter: () => void;
  filterName: string;
  setFilterName: (v: string) => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 320, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Save Filter</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Save your current filter combination for quick access later.</p>
        <input
          autoFocus
          className="input"
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveFilter(); if (e.key === 'Escape') setShowSaveFilter(false); }}
          placeholder="Filter name (e.g., High Priority Open)"
          style={{ width: '100%', marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => { setShowSaveFilter(false); setFilterName(''); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveFilter} disabled={!filterName.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}
