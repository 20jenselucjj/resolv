'use client';
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, ChevronRight } from 'lucide-react';
import type { Category } from '@/lib/store';

interface CategoryTreeSelectProps {
  value: string | null;
  onChange: (id: string | null) => void;
  categories: Category[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

interface FlatNode {
  id: string;
  name: string;
  color: string;
  depth: number;
  hasChildren: boolean;
  childrenCount: number;
}

function flattenTree(categories: Category[], depth = 0): FlatNode[] {
  const result: FlatNode[] = [];
  for (const cat of categories) {
    result.push({
      id: cat.id,
      name: cat.name,
      color: cat.color || '#6366f1',
      depth,
      hasChildren: (cat.children && cat.children.length > 0) || (cat.children_count ?? 0) > 0,
      childrenCount: cat.children_count ?? cat.children?.length ?? 0,
    });
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenTree(cat.children, depth + 1));
    }
  }
  return result;
}

function buildParentMap(categories: Category[], parentId: string | null = null, map: Map<string, FlatNode[]> = new Map()): Map<string, FlatNode[]> {
  for (const cat of categories) {
    const key = parentId ?? '__root__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ id: cat.id, name: cat.name, color: cat.color || '#6366f1', depth: 0, hasChildren: false, childrenCount: 0 });
    if (cat.children && cat.children.length > 0) {
      buildParentMap(cat.children, cat.id, map);
    }
  }
  return map;
}

export function CategoryTreeSelect({
  value,
  onChange,
  categories,
  placeholder = 'Select category...',
  disabled,
  allowClear,
}: CategoryTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  // Build tree from flat categories if not already in tree format
  const treeData = useMemo(() => {
    // If categories already have children, they're tree data
    if (categories.some(c => c.children)) {
      return categories;
    }
    // Otherwise, build tree from flat list with parent_id
    const map = new Map<string, Category & { children: Category[] }>();
    const roots: (Category & { children: Category[] })[] = [];

    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    categories.forEach(cat => {
      const node = map.get(cat.id);
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id)!.children.push(node!);
      } else {
        roots.push(node!);
      }
    });

    return roots;
  }, [categories]);

  const flatNodes = useMemo(() => flattenTree(treeData), [treeData]);

  // Determine if we should use search mode
  const showSearchInput = flatNodes.length > 5;

  // Filtered nodes for search
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return null;
    const lower = search.toLowerCase();
    return flatNodes.filter(n => n.name.toLowerCase().includes(lower));
  }, [search, flatNodes]);

  const selectedCat = flatNodes.find(n => n.id === value);

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(250, rect.width);
    const menuHeight = menuRef.current?.offsetHeight || 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight + 8 ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - menuWidth - 4));
    setMenuPos({ top, left, width: menuWidth });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      calcPos();
      const raf = requestAnimationFrame(calcPos);
      return () => cancelAnimationFrame(raf);
    }
  }, [open, calcPos]);

  useLayoutEffect(() => {
    if (open) calcPos();
  }, [open, searchFiltered?.length, calcPos]);

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

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
    setSearch('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Custom recursive render for tree items
  function renderTreeNode(node: (Category & { children?: Category[] }), depth: number): React.ReactNode {
    const isExpanded = expanded.has(node.id);
    const hasChildren = (node.children && node.children.length > 0) || (node.children_count ?? 0) > 0;
    const isSelected = node.id === value;

    // Check if this node matches search (any descendant matches)
    const matchesSearch = !search.trim() || node.name.toLowerCase().includes(search.toLowerCase());

    return (
      <div key={node.id}>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasChildren && search.trim()) {
              toggleExpand(node.id, e);
            } else {
              handleSelect(node.id);
            }
          }}
          onClick={(e) => {
            if (hasChildren && !search.trim()) {
              toggleExpand(node.id, e);
            }
          }}
          onDoubleClick={(e) => {
            if (!search.trim()) handleSelect(node.id);
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            paddingLeft: 10 + depth * 16,
            background: isSelected ? 'var(--accent-subtle)' : 'none',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text)',
            textAlign: 'left',
            transition: 'background 0.1s',
            boxSizing: 'border-box',
          }}
          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'none'; }}
        >
          {/* Expand/collapse chevron */}
          <div style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, visibility: hasChildren ? 'visible' : 'hidden' }}>
            <ChevronRight
              size={12}
              style={{
                color: 'var(--text-muted)',
                transition: 'transform 0.15s',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </div>

          {/* Color dot */}
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: node.color || '#6366f1', flexShrink: 0 }} />

          {/* Name */}
          <span style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: isSelected ? 600 : 400,
          }}>
            {node.name}
          </span>

          {/* Children count badge */}
          {hasChildren && (
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)',
              padding: '1px 6px',
              borderRadius: 10,
              flexShrink: 0,
              fontWeight: 500,
            }}>
              {node.children?.length ?? node.children_count ?? 0}
            </span>
          )}

          {isSelected && <Check size={14} color="var(--accent)" style={{ flexShrink: 0 }} />}
        </button>

        {/* Children (only show if expanded or searching) */}
        {(isExpanded || search.trim()) && node.children && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
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
      <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px' }}>
        {/* "None" option to clear */}
        {!search.trim() && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(''); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              background: !value ? 'var(--accent-subtle)' : 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-muted)',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <span style={{ flex: 1 }}>None</span>
            {!value && <Check size={14} color="var(--accent)" />}
          </button>
        )}

        {/* Search results or tree */}
        {searchFiltered ? (
          searchFiltered.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              No categories found
            </div>
          ) : (
            searchFiltered.map(n => (
              <button
                key={n.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(n.id); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  paddingLeft: 10 + n.depth * 16,
                  background: n.id === value ? 'var(--accent-subtle)' : 'none',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--text)',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (n.id !== value) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { if (n.id !== value) e.currentTarget.style.background = 'none'; }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.color, flexShrink: 0, marginLeft: n.depth * 16 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.name}
                </span>
                {n.id === value && <Check size={14} color="var(--accent)" style={{ flexShrink: 0 }} />}
              </button>
            ))
          )
        ) : (
          treeData.map(node => renderTreeNode(node, 0))
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
            padding: '0 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: selectedCat ? 'var(--text)' : 'var(--text-muted)',
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
            {selectedCat && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedCat.color, flexShrink: 0 }} />
            )}
            {selectedCat ? selectedCat.name : placeholder}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {selectedCat && allowClear && (
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

export default CategoryTreeSelect;
