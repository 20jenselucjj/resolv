'use client';
import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  {
    group: 'Global',
    items: [
      { keys: ['Ctrl', 'K'], desc: 'Open command palette' },
      { keys: ['C'], desc: 'Create new ticket' },
      { keys: ['['], desc: 'Toggle sidebar' },
      { keys: ['?'], desc: 'Show this help' },
    ],
  },
  {
    group: 'Navigation',
    items: [
      { keys: ['G', 'D'], desc: 'Go to Dashboard' },
      { keys: ['G', 'T'], desc: 'Go to Tickets' },
      { keys: ['G', 'U'], desc: 'Go to Users' },
      { keys: ['G', 'S'], desc: 'Go to Settings' },
    ],
  },
  {
    group: 'Ticket List',
    items: [
      { keys: ['R'], desc: 'Refresh tickets' },
      { keys: ['↑', '↓'], desc: 'Navigate rows' },
    ],
  },
  {
    group: 'Ticket Detail',
    items: [
      { keys: ['R'], desc: 'Focus reply box' },
      { keys: ['Ctrl', 'Enter'], desc: 'Send reply' },
      { keys: ['ESC'], desc: 'Go back' },
    ],
  },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '?' && !(e.target instanceof Element && e.target.matches('input,textarea,select'))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'var(--bg-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          animation: 'fadeIn 150ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <Keyboard size={16} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            Keyboard shortcuts
          </span>
          <button
            onClick={() => setOpen(false)}
            className="btn btn-ghost btn-icon btn-sm"
          >
            <X size={14} />
          </button>
        </div>

        {/* Shortcuts grid */}
        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {SHORTCUTS.map(({ group, items }) => (
            <div key={group}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: 10,
              }}>
                {group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(({ keys, desc }) => (
                  <div key={desc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</span>
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {keys.map((k, i) => (
                        <kbd key={i}>{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Press <kbd>?</kbd> to toggle this panel
          </span>
          <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
