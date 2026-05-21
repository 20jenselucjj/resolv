'use client';
import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export function InlineSelect({ value, options, onChange, renderValue, stopPropagation = true }: {
  value: string;
  options: { value: string; label: string; style?: React.CSSProperties }[];
  onChange: (val: string) => void;
  renderValue?: (val: string) => React.ReactNode;
  stopPropagation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(160, rect.width);
    const menuHeight = Math.min(options.length * 36 + 8, 220);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuHeight || spaceBelow >= rect.top
      ? rect.bottom + 4
      : rect.top - menuHeight - 4;
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - menuWidth - 4));
    setMenuPos({ top, left, width: menuWidth });
  }, [options.length]);

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

  useLayoutEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const menu = open ? createPortal(
    <div ref={menuRef} style={{
      position: 'fixed',
      top: menuPos.top,
      left: menuPos.left,
      minWidth: menuPos.width,
      zIndex: 999999,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
      maxHeight: 'min(360px, calc(100vh - 16px))',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    }}>
      {options.map(opt => (
        <div key={opt.value}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(opt.value); setOpen(false); }}
          style={{
            padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: opt.value === value ? 'var(--accent-subtle)' : 'transparent',
            transition: 'background 0.15s', ...opt.style,
            userSelect: 'none',
          }}
          onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
          onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
        >
          {opt.label}
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div ref={triggerRef} style={{ display: 'inline-flex' }}
        onMouseDown={(e) => {
          if (stopPropagation) e.stopPropagation();
          e.preventDefault();
          setOpen(o => !o);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', borderRadius: 'var(--radius-sm)', padding: '2px 4px', transition: 'background 0.15s', userSelect: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {renderValue ? renderValue(value) : (options.find(o => o.value === value)?.label || value)}
          <ChevronDown size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
        </div>
      </div>
      {menu}
    </>
  );
}
