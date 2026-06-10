'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { DateRangePicker } from '../components/filters';
import type { TimeRange, CustomDateRange } from '../types';

const PRIORITIES = ['all', 'critical', 'high', 'medium', 'low'] as const;
const STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed'] as const;

interface GlobalFiltersProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  customDateRange: CustomDateRange;
  onCustomRange: (from: string, to: string) => void;
  priorityFilter: string;
  onPriorityChange: (p: string) => void;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  categoryFilter: string;
  onCategoryChange: (c: string) => void;
  categoriesList: string[];
}

export function GlobalFilters({
  timeRange,
  onTimeRangeChange,
  customDateRange,
  onCustomRange,
  priorityFilter,
  onPriorityChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  categoriesList,
}: GlobalFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Sync URL params on mount
  useEffect(() => {
    const p = searchParams.get('priority');
    const s = searchParams.get('status');
    const c = searchParams.get('category');
    if (p && p !== priorityFilter) onPriorityChange(p);
    if (s && s !== statusFilter) onStatusChange(s);
    if (c && c !== categoryFilter) onCategoryChange(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateURLParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const handlePriorityChange = useCallback(
    (val: string) => {
      onPriorityChange(val);
      updateURLParam('priority', val);
    },
    [onPriorityChange, updateURLParam],
  );

  const handleStatusChange = useCallback(
    (val: string) => {
      onStatusChange(val);
      updateURLParam('status', val);
    },
    [onStatusChange, updateURLParam],
  );

  const handleCategoryChange = useCallback(
    (val: string) => {
      onCategoryChange(val);
      updateURLParam('category', val);
    },
    [onCategoryChange, updateURLParam],
  );

  const hasActiveFilters = useMemo(
    () => priorityFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== '',
    [priorityFilter, statusFilter, categoryFilter],
  );

  const clearFilters = useCallback(() => {
    handlePriorityChange('all');
    handleStatusChange('all');
    handleCategoryChange('');
  }, [handlePriorityChange, handleStatusChange, handleCategoryChange]);

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    background: active ? 'var(--accent-subtle)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    transition: 'all 0.15s',
  });

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Date Range */}
      <DateRangePicker
        timeRange={timeRange}
        onChange={onTimeRangeChange}
        onCustomRange={onCustomRange}
        customFrom={customDateRange.from}
        customTo={customDateRange.to}
      />

      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Priority */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
          Priority:
        </span>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => handlePriorityChange(p)}
            style={filterBtnStyle(priorityFilter === p)}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
          Status:
        </span>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            style={filterBtnStyle(statusFilter === s)}
          >
            {s === 'all'
              ? 'All'
              : s
                  .split('_')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ')}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* Category */}
      {categoriesList.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
            Category:
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text)',
              background: 'var(--bg-card)',
              maxWidth: 140,
            }}
          >
            <option value="">All Categories</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--danger)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 'auto',
          }}
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );
}
