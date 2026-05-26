'use client';

import { Ticket } from '@/lib/store';

interface BulkCloseModalProps {
  selectedIds: Set<string>;
  bulkCloseNote: string;
  setBulkCloseNote: (note: string) => void;
  handleBulkUpdate: (updates: Partial<Ticket>) => Promise<void>;
  onClose: () => void;
}

export default function BulkCloseModal({ selectedIds, bulkCloseNote, setBulkCloseNote, handleBulkUpdate, onClose }: BulkCloseModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Close {selectedIds.size} ticket{selectedIds.size > 1 ? 's' : ''}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>A closing note is required.</p>
        <textarea
          className="textarea"
          value={bulkCloseNote}
          onChange={e => setBulkCloseNote(e.target.value)}
          placeholder="Enter closing note..."
          rows={4}
          style={{ width: '100%', marginBottom: 16, resize: 'vertical' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!bulkCloseNote.trim()} onClick={() => {
            handleBulkUpdate({ status: 'closed', close_notes: bulkCloseNote });
            onClose();
          }}>Close Tickets</button>
        </div>
      </div>
    </div>
  );
}