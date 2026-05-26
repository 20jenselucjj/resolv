'use client';
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';

interface UserOption {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface UserSearchSelectProps {
  users: UserOption[];
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  hideClear?: boolean;
}

export function UserSearchSelect({ users, value, onChange, placeholder = 'Select a user...', disabled, hideClear }: UserSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const selectedUser = users.find(u => u.id === value);

  const filtered = search.trim()
    ? users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(220, rect.width);
    const menuHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - menuWidth - 4));
    setMenuPos({ top, left, width: menuWidth });
  }, []);

  useLayoutEffect(() => {
    if (open) calcPos();
  }, [open, calcPos]);

  useLayoutEffect(() => {
    if (!open) return;
    const onScroll = () => calcPos();
    const onResize = () => calcPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, calcPos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function handleSelect(userId: string) {
    onChange(userId);
    setOpen(false);
    setSearch('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  const menu = open ? createPortal(
    <div ref={menuRef} style={{
      position: 'fixed',
      top: menuPos.top,
      left: menuPos.left,
      width: menuPos.width,
      zIndex: 999999,
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users..."
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No users found
          </div>
        ) : (
          filtered.map(u => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(u.id); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: u.id === value ? 'var(--accent-bg)' : 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text)',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (u.id !== value) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { if (u.id !== value) e.currentTarget.style.background = 'none'; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: `hsl(${(u.name.charCodeAt(0) * 37 || 200) % 360}, 55%, 45%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {u.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                {u.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>}
              </div>
              {u.id === value && <Check size={14} color="var(--accent)" style={{ flexShrink: 0 }} />}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div ref={triggerRef} style={{ display: 'inline-flex', width: '100%' }}>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setOpen(o => !o);
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 4px',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            color: selectedUser ? 'var(--text)' : 'var(--text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            minHeight: 28,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!disabled && !open) e.currentTarget.style.background = 'transparent'; }}
          onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
            {selectedUser ? selectedUser.name : placeholder}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {selectedUser && !hideClear && (
              <span
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(e as any); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)' }}
              >
                <X size={12} />
              </span>
            )}
            <ChevronDown size={10} style={{ opacity: 0.5, flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
          </div>
        </button>
      </div>
      {menu}
    </>
  );
}
