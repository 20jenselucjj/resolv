'use client';

import { Filter, Search } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  categoryFilter: string;
  onCategoryChange: (val: string) => void;
  priorityFilter: string;
  onPriorityChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  categories: string[];
  showExportButton?: boolean;
  onExport?: () => void;
}

export default function FilterBar({
  searchQuery, onSearchChange,
  categoryFilter, onCategoryChange,
  priorityFilter, onPriorityChange,
  statusFilter, onStatusChange,
  categories, showExportButton, onExport,
}: FilterBarProps) {
  const categoriesList = categories.filter(c => c !== 'all');
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
        <Filter size={13} /> Filters:
      </div>
      <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          className="input"
          placeholder="Search tickets..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          style={{ padding: '6px 10px 6px 30px', fontSize: 12, width: '100%' }}
        />
      </div>
      <select className="select" value={categoryFilter} onChange={e => onCategoryChange(e.target.value)} style={{ maxWidth: 180, fontSize: 12 }}>
        <option value="all">All Categories</option>
        {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="select" value={priorityFilter} onChange={e => onPriorityChange(e.target.value)} style={{ maxWidth: 140, fontSize: 12 }}>
        <option value="all">All Priorities</option>
        {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
      </select>
      <select className="select" value={statusFilter} onChange={e => onStatusChange(e.target.value)} style={{ maxWidth: 140, fontSize: 12 }}>
        <option value="all">All Statuses</option>
        {['open', 'in_progress', 'pending', 'resolved', 'closed'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>)}
      </select>
      {showExportButton && onExport && (
        <button onClick={onExport} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <DownloadIcon size={13} /> CSV
        </button>
      )}
    </div>
  );
}

// Inline download icon to avoid dependency issues
function DownloadIcon({ size }: { size?: number }) {
  return (
    <svg width={size || 13} height={size || 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
