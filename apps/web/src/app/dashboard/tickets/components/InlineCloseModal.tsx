'use client';
import { api } from '@/lib/api';
import type { Ticket } from '@/lib/store';
import { toast } from '@/components/Toast';

export function InlineCloseModal({
  inlineCloseTicket,
  setInlineCloseTicket,
  inlineCloseNote,
  setInlineCloseNote,
  sorted,
  fetchTickets,
}: {
  inlineCloseTicket: { id: string; title: string } | null;
  setInlineCloseTicket: (v: { id: string; title: string } | null) => void;
  inlineCloseNote: string;
  setInlineCloseNote: (v: string) => void;
  sorted: Ticket[];
  fetchTickets: () => void;
}) {
  if (!inlineCloseTicket) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setInlineCloseTicket(null)}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Close Ticket</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>#{sorted.find(t => t.id === inlineCloseTicket.id)?.number} - {inlineCloseTicket.title}</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>A closing note is required.</p>
        <textarea
          className="textarea"
          value={inlineCloseNote}
          onChange={e => setInlineCloseNote(e.target.value)}
          placeholder="Enter closing note..."
          rows={4}
          style={{ width: '100%', marginBottom: 16, resize: 'vertical' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setInlineCloseTicket(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={!inlineCloseNote.trim()} onClick={async () => {
            try {
              await api.patch(`/tickets/${inlineCloseTicket.id}`, { status: 'closed', close_notes: inlineCloseNote });
              setInlineCloseTicket(null);
              setInlineCloseNote('');
              fetchTickets();
            } catch (err) {
              toast.error('Close failed', err instanceof Error ? err.message : 'Please try again');
            }
          }}>Close Ticket</button>
        </div>
      </div>
    </div>
  );
}
