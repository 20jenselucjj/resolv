'use client';

import { useEffect, useRef } from 'react';
import { X, ArrowLeft, ExternalLink } from 'lucide-react';
import { STATUS_COLORS, PRIORITY_COLORS } from '../../types';
import type { DrillDownLevel, DrillDownState } from '../../types';

interface DrillDownModalProps {
  state: DrillDownState;
  onClose: () => void;
  onDrillUp: () => void;
  onNavigateToTickets: (filters: Record<string, string>) => void;
  /** Optional title for the modal */
  title?: string;
}

/**
 * DrillDownModal — shows a list of detail records when clicking a chart segment.
 * Supports multi-level drill-down with breadcrumb navigation.
 * Dismissible with Escape key.
 */
export default function DrillDownModal({
  state,
  onClose,
  onDrillUp,
  onNavigateToTickets,
  title,
}: DrillDownModalProps) {
  const { levels, tickets, loading } = state;
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (state.isOpen) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [state.isOpen, onClose]);

  // Focus trap / prevent body scroll
  useEffect(() => {
    if (state.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  // Build navigation link filters from current drill-down levels
  const buildTicketFilters = (): Record<string, string> => {
    const filters: Record<string, string> = {};
    for (const level of levels) {
      if (level.filterKey === 'status') filters.status = level.filterValue;
      else if (level.filterKey === 'priority') filters.priority = level.filterValue;
      else if (level.filterKey === 'ticket_type') filters.type = level.filterValue;
      else if (level.filterKey === 'category') filters.category = level.filterValue;
      else if (level.filterKey === 'assignee') filters.assignee = level.filterValue;
    }
    return filters;
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--border, #dde1e7)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', borderBottom: '1px solid var(--border, #dde1e7)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {levels.length > 1 && (
              <button
                onClick={onDrillUp}
                title="Go up one level"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, borderRadius: 6, display: 'flex',
                  color: 'var(--text-muted, #9CA3AF)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary, #f0f2f5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #1F2937)' }}>
              {title || 'Details'}
            </h2>
            <span
              style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #9CA3AF)',
                background: 'var(--bg-tertiary, #f0f2f5)',
                padding: '2px 8px', borderRadius: 8,
              }}
            >
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 8, display: 'flex',
              color: 'var(--text-muted, #9CA3AF)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary, #f0f2f5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Breadcrumbs ────────────────────────────────────── */}
        {levels.length > 0 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              padding: '10px 24px', borderBottom: '1px solid var(--border-subtle, #eef0f3)',
              background: 'var(--bg-secondary, #f8f9fb)',
              fontSize: 12,
            }}
          >
            {levels.map((level, index) => (
              <span key={index} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {index > 0 && (
                  <span style={{ color: 'var(--text-muted, #9CA3AF)' }}>/</span>
                )}
                <span
                  style={{
                    fontWeight: index === levels.length - 1 ? 700 : 500,
                    color: index === levels.length - 1 ? 'var(--text, #1F2937)' : 'var(--text-secondary, #4B5563)',
                  }}
                >
                  {level.label}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* ── Tickets List ────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, #9CA3AF)', fontSize: 13 }}>
              Loading tickets...
            </div>
          )}
          {!loading && tickets.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, #9CA3AF)', fontSize: 13 }}>
              No tickets match this filter.
            </div>
          )}
          {!loading && tickets.map(ticket => (
            <div
              key={ticket.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 24px', transition: 'background 0.1s',
                borderBottom: '1px solid var(--border-subtle, #eef0f3)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary, #f8f9fb)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Ticket number */}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #9CA3AF)', width: 60, flexShrink: 0 }}>
                #{ticket.number}
              </span>

              {/* Title */}
              <span
                style={{
                  flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text, #1F2937)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {ticket.title}
              </span>

              {/* Status badge */}
              <span
                style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                  textTransform: 'capitalize', whiteSpace: 'nowrap',
                  background: (STATUS_COLORS[ticket.status] || 'var(--bg-tertiary)') + '20',
                  color: STATUS_COLORS[ticket.status] || 'var(--text-muted)',
                  border: `1px solid ${(STATUS_COLORS[ticket.status] || 'var(--border)')}20`,
                }}
              >
                {ticket.status.replace('_', ' ')}
              </span>

              {/* Priority */}
              <span
                style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap',
                  color: PRIORITY_COLORS[ticket.priority] || 'var(--text)',
                  width: 56, textAlign: 'right',
                }}
              >
                {ticket.priority}
              </span>
            </div>
          ))}
        </div>

        {/* ── Footer — Navigate to tickets ──────────────────── */}
        {tickets.length > 0 && (
          <div
            style={{
              display: 'flex', justifyContent: 'flex-end', gap: 8,
              padding: '14px 24px', borderTop: '1px solid var(--border, #dde1e7)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => onNavigateToTickets(buildTicketFilters())}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ExternalLink size={13} />
              View all in Tickets tab
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
