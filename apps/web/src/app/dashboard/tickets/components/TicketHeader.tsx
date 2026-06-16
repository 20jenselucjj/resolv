'use client';
import { memo } from 'react';
import { Plus, Download, RefreshCw } from 'lucide-react';
import type { Ticket } from '@/lib/store';

export const TicketHeader = memo(function TicketHeader({
  sorted,
  total,
  exportCSV,
  fetchTickets,
  setShowNewTicketPanel,
}: {
  sorted: Ticket[];
  total: number;
  exportCSV: () => void;
  fetchTickets: () => void;
  setShowNewTicketPanel: (v: boolean) => void;
}) {
  return (
    <div style={{
      padding: '20px 24px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', gap: 16,
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 4, height: 24, background: 'var(--accent)', borderRadius: 2 }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' }}>
          Tickets
          <span style={{ 
            color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, marginLeft: 12, 
            padding: '2px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-full)', 
            border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            {sorted.length > 0 ? sorted.length : total}
          </span>
        </h1>
      </div>

      <button
        onClick={exportCSV}
        className="btn btn-ghost"
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', gap: 8 }}
      >
        <Download size={15} />
        Export CSV
      </button>

      <button
        onClick={fetchTickets}
        data-tooltip="Refresh"
        className="btn btn-ghost btn-icon"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        <RefreshCw size={15} />
      </button>

      <button
        onClick={() => setShowNewTicketPanel(true)}
        className="btn btn-primary"
        style={{ 
          boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.25)',
          padding: '0 20px',
          height: 40,
          fontSize: 14,
          fontWeight: 600,
          gap: 8
        }}
      >
        <Plus size={16} strokeWidth={2.5} />
        New Ticket
      </button>
    </div>
  );
});
