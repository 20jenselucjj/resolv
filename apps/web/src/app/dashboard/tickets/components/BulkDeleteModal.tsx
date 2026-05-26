'use client';
import { Trash2 } from 'lucide-react';

interface BulkDeleteModalProps {
  selectedIds: Set<string>;
  handleBulkDelete: () => Promise<void>;
  onClose: () => void;
  isDeleteAll?: boolean;
}

export default function BulkDeleteModal({ selectedIds, handleBulkDelete, onClose, isDeleteAll }: BulkDeleteModalProps) {
  const count = isDeleteAll ? 'all' : selectedIds.size;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 360, maxWidth: 420, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={20} color="var(--danger)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {isDeleteAll ? 'Delete All Tickets' : `Delete ${selectedIds.size} ticket${selectedIds.size > 1 ? 's' : ''}`}
            </h3>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
          {isDeleteAll
            ? 'This will permanently delete ALL tickets from the system. Comments, activity logs, and attachments will also be deleted. This action cannot be undone.'
            : `This will permanently delete ${selectedIds.size} ticket${selectedIds.size > 1 ? 's' : ''} and all associated comments, activity logs, and attachments. This action cannot be undone.`
          }
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
            onClick={async () => {
              await handleBulkDelete();
              onClose();
            }}
          >
            {isDeleteAll ? 'Delete All Tickets' : `Delete ${selectedIds.size} ticket${selectedIds.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
