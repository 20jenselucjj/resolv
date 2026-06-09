'use client';

import { PRIORITY_OPTIONS, priorityColors } from './constants';
import { Ticket } from '@/lib/store';

interface BulkPriorityModalProps {
  selectedIds: Set<string>;
  handleBulkUpdate: (updates: Partial<Ticket>) => Promise<void>;
  onClose: () => void;
}

export default function BulkPriorityModal({ selectedIds, handleBulkUpdate, onClose }: BulkPriorityModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 320, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Change Priority for {selectedIds.size} ticket{selectedIds.size > 1 ? 's' : ''}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {PRIORITY_OPTIONS.filter(p => p !== 'all').map(p => (
            <button key={p} className="btn btn-ghost" style={{ justifyContent: 'flex-start', gap: 10, textTransform: 'capitalize' }}
              onClick={() => { handleBulkUpdate({ priority: p as Ticket['priority'] }); onClose(); }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: priorityColors[p] }} />
              {p}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}