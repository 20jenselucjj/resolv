'use client';
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  color?: string;
  dotColor?: string;
}

interface SelectSearchProps {
  options: Option[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  hideClear?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
  label?: string;
}

export function SelectSearch({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled,
  hideClear,
  allowClear,
  showSearch,
  label,
}: SelectSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const labelId = useId();
  const selectedOption = options.find(o => o.value === value);

  const filtered = search.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const showSearchInput = showSearch ?? options.length > 5;

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(220, rect.width);
    const menuHeight = menuRef.current?.offsetHeight || 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight + 8 ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - menuWidth - 4));
    setMenuPos({ top, left, width: menuWidth });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      calcPos();
      // Re-measure after portal paints to get actual menu height
      const raf = requestAnimationFrame(calcPos);
      return () => cancelAnimationFrame(raf);
    }
  }, [open, calcPos]);

  // Re-calculate position when filtered results change (menu height changes with search)
  useLayoutEffect(() => {
    if (open) calcPos();
  }, [open, filtered.length, calcPos]);

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

  function handleSelect(optValue: string) {
    onChange(optValue);
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
      {showSearchInput && (
        <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            aria-label="Search options"
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
      )}
      <div role="listbox" style={{ maxHeight: 220, overflowY: 'auto', padding: '4px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No options found
          </div>
        ) : (
          filtered.map(o => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(o.value); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: o.value === value ? 'var(--accent-subtle)' : 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text)',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'none'; }}
            >
              {(o.icon || o.dotColor) && (
                <div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {o.icon ? (
                    <o.icon size={14} color={o.color} />
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: o.dotColor, flexShrink: 0 }} />
                  )}
                </div>
              )}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.label}
              </span>
              {o.value === value && <Check size={14} color="var(--accent)" style={{ flexShrink: 0 }} />}
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
        {label && (
          <span id={labelId} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2, display: 'block' }}>
            {label}
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-labelledby={label ? labelId : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
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
            padding: '0 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: selectedOption ? 'var(--text)' : 'var(--text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            height: 34,
            transition: 'border-color var(--transition), box-shadow var(--transition)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (!disabled && !open) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
          onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
            {selectedOption?.icon && (
              <selectedOption.icon size={14} color={selectedOption.color} />
            )}
            {selectedOption?.dotColor && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedOption.dotColor, flexShrink: 0 }} />
            )}
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {selectedOption && !hideClear && allowClear && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(e as any); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleClear(e as any); } }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)', alignItems: 'center' }}
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

export default SelectSearch;
