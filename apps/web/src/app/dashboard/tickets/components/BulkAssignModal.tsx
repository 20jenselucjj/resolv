'use client';

import { Users } from 'lucide-react';
import { User } from '@/lib/store';

interface BulkAssignModalProps {
  selectedIds: Set<string>;
  allUsers: User[];
  handleBulkUpdate: (updates: Partial<import('@/lib/store').Ticket>) => Promise<void>;
  onClose: () => void;
}

export default function BulkAssignModal({ selectedIds, allUsers, handleBulkUpdate, onClose }: BulkAssignModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 320, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Assign {selectedIds.size} ticket{selectedIds.size > 1 ? 's' : ''}</h3>
        <select className="select" style={{ width: '100%', marginBottom: 16 }} id="bulk-assign-select">
          <option value="">Unassigned</option>
          {allUsers.filter(u => u.role === 'admin' || u.role === 'agent').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const sel = document.getElementById('bulk-assign-select') as HTMLSelectElement;
            handleBulkUpdate({ assigned_to_id: sel.value || null });
            onClose();
          }}>Apply</button>
        </div>
      </div>
    </div>
  );
}