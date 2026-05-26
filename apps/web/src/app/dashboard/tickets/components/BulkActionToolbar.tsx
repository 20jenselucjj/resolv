'use client';
import { Users, LayoutGrid, GitBranch, Trash2, X } from 'lucide-react';

export function BulkActionToolbar({
  selectedIds,
  isAdminOrAgent,
  setShowBulkAssign,
  setShowBulkPriority,
  setShowBulkMerge,
  setShowBulkClose,
  setBulkCloseNote,
  setShowBulkDelete,
  setSelectedIds,
}: {
  selectedIds: Set<string>;
  isAdminOrAgent: boolean;
  setShowBulkAssign: (v: boolean) => void;
  setShowBulkPriority: (v: boolean) => void;
  setShowBulkMerge: (v: boolean) => void;
  setShowBulkClose: (v: boolean) => void;
  setBulkCloseNote: (v: string) => void;
  setShowBulkDelete: (v: boolean) => void;
  setSelectedIds: (ids: Set<string>) => void;
}) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(30, 41, 59, 0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: '#fff', padding: '10px 16px', borderRadius: '16px',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      zIndex: 100, animation: 'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: 11 }}>
          {selectedIds.size}
        </div>
        selected
      </span>
      <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {isAdminOrAgent && (
          <>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 500 }} onClick={() => setShowBulkAssign(true)}>
              <Users size={14} /> Assign
            </button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 500 }} onClick={() => setShowBulkPriority(true)}>
              <LayoutGrid size={14} /> Change Priority
            </button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 500 }} onClick={() => setShowBulkMerge(true)} disabled={selectedIds.size < 2}>
              <GitBranch size={14} /> Merge
            </button>
          </>
        )}
        <button onClick={() => { setShowBulkClose(true); setBulkCloseNote(''); }} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontWeight: 500 }}>
          <X size={14} /> Close
        </button>
        {isAdminOrAgent && (
          <button onClick={() => setShowBulkDelete(true)} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontWeight: 500 }}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
      <button onClick={() => setSelectedIds(new Set())} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, display: 'flex', marginLeft: 8, transition: 'color 0.15s ease' }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
      >
        <X size={16} />
      </button>
    </div>
  );
}
