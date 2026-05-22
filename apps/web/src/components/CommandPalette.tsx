'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, Ticket } from '@/lib/store';
import {
  Search, Ticket as TicketIcon, Plus, User, Settings, LayoutDashboard,
  ArrowRight, Clock, Hash, Zap, ChevronRight,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  shortcut?: string;
  action: () => void;
}

const RECENT_KEY = 'resolv_recent_commands';

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecent(id: string) {
  const recent = getRecent().filter((r) => r !== id).slice(0, 4);
  localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent]));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const { tickets } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(''); setSelected(0); }, []);

  const open_ = useCallback(() => { setOpen(true); setSelected(0); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => { if (!o) setSelected(0); return !o; });
      }
      if (e.key === 'Escape' && open) { e.preventDefault(); close(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, router]);

  const staticCommands: Command[] = [
    {
      id: 'new-ticket', label: 'New Ticket', description: 'Create a new support ticket',
      icon: <Plus size={14} />, group: 'Actions', shortcut: 'C',
      action: () => { window.dispatchEvent(new CustomEvent('resolv:new-ticket')); close(); },
    },
    {
      id: 'go-tickets', label: 'Go to Tickets',
      icon: <TicketIcon size={14} />, group: 'Navigation', shortcut: 'G T',
      action: () => { router.push('/dashboard/tickets'); close(); },
    },
    {
      id: 'go-users', label: 'Go to Users',
      icon: <User size={14} />, group: 'Navigation', shortcut: 'G U',
      action: () => { router.push('/dashboard/users'); close(); },
    },
    {
      id: 'go-settings', label: 'Go to Settings',
      icon: <Settings size={14} />, group: 'Navigation', shortcut: 'G S',
      action: () => { router.push('/dashboard/settings'); close(); },
    },
  ];

  const ticketCommands: Command[] = tickets
    .filter((t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      `#${t.number}`.includes(query) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      label: `#${t.number} — ${t.title}`,
      description: `${t.status.replace('_', ' ')} · ${t.priority}`,
      icon: <Hash size={14} />,
      group: 'Tickets',
      action: () => { saveRecent(t.id); router.push(`/dashboard/tickets/${t.id}`); close(); },
    }));

  const recentIds = getRecent();
  const recentCommands: Command[] = !query
    ? recentIds
        .map((id) => tickets.find((t) => t.id === id))
        .filter((t): t is Ticket => !!t)
        .slice(0, 3)
        .map((t) => ({
          id: `recent-${t.id}`,
          label: `#${t.number} — ${t.title}`,
          description: 'Recently viewed',
          icon: <Clock size={14} />,
          group: 'Recent',
          action: () => { router.push(`/dashboard/tickets/${t.id}`); close(); },
        }))
    : [];

  const filtered: Command[] = query
    ? [
        ...staticCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
        ...ticketCommands,
      ]
    : [...recentCommands, ...staticCommands];

  // Group commands
  const groups = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const flatList = Object.values(groups).flat();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, flatList.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        flatList[selected]?.action();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flatList, selected]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg-overlay)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        backdropFilter: 'blur(2px)',
      }}
      onClick={close}
    >
      <div
        style={{
          width: '100%', maxWidth: 580,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          animation: 'fadeIn 150ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search tickets, navigate, run commands..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 15, fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd>ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto' }}>
          {flatList.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <Search size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              No results for &quot;{query}&quot;
            </div>
          )}

          {Object.entries(groups).map(([group, cmds]) => (
            <div key={group}>
              <div style={{
                padding: '8px 16px 4px',
                fontSize: 10, fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {group}
              </div>
              {cmds.map((cmd) => {
                const idx = globalIdx++;
                const isSelected = idx === selected;
                return (
                  <button
                    key={cmd.id}
                    data-idx={idx}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(idx)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 16px',
                      background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      color: isSelected ? 'var(--accent)' : 'var(--text)',
                      transition: 'background var(--transition)',
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-border)' : 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                      transition: 'all var(--transition)',
                    }}>
                      {cmd.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cmd.label}
                      </div>
                      {cmd.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd style={{ opacity: 0.6, fontSize: 10 }}>{cmd.shortcut}</kbd>
                    )}
                    {isSelected && <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.5 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            <span><kbd>↑</kbd><kbd style={{ marginLeft: 2 }}>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> select</span>
            <span><kbd>ESC</kbd> close</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <Zap size={11} />
            <span>{flatList.length} results</span>
          </div>
        </div>
      </div>
    </div>
  );
}
