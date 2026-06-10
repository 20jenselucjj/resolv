'use client';

import { useState, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import type { TimeRange } from '../../types';

interface DateRangePickerProps {
  /** Currently selected time range key */
  timeRange: TimeRange;
  /** Called when preset or custom range is selected */
  onChange: (range: TimeRange) => void;
  /** Called when a custom date range is applied */
  onCustomRange?: (from: string, to: string) => void;
  /** Custom "from" date value (ISO string) */
  customFrom?: string;
  /** Custom "to" date value (ISO string) */
  customTo?: string;
}

const PRESETS: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

function toLocalDateString(iso: string): string {
  if (!iso) return '';
  try { return new Date(iso).toISOString().split('T')[0]; }
  catch { return ''; }
}

export default function DateRangePicker({
  timeRange,
  onChange,
  onCustomRange,
  customFrom = '',
  customTo = '',
}: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(timeRange === 'custom');
  const [localFrom, setLocalFrom] = useState(customFrom ? toLocalDateString(customFrom) : '');
  const [localTo, setLocalTo] = useState(customTo ? toLocalDateString(customTo) : '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isCustom = timeRange === 'custom';

  const handlePreset = useCallback((key: TimeRange) => {
    setShowCustom(false);
    setValidationError(null);
    onChange(key);
  }, [onChange]);

  const handleCustomToggle = useCallback(() => {
    const nextShow = !showCustom;
    setShowCustom(nextShow);
    if (!nextShow && isCustom) {
      // Switching back from custom — reset to 30d
      onChange('30d');
    }
    setValidationError(null);
  }, [showCustom, isCustom, onChange]);

  const handleApplyCustom = useCallback(() => {
    // Validate dates
    if (!localFrom || !localTo) {
      setValidationError('Please select both a start and end date.');
      return;
    }

    const fromDate = new Date(localFrom);
    const toDate = new Date(localTo);

    if (isNaN(fromDate.getTime())) {
      setValidationError('Invalid start date.');
      return;
    }
    if (isNaN(toDate.getTime())) {
      setValidationError('Invalid end date.');
      return;
    }
    if (fromDate >= toDate) {
      setValidationError('Start date must be before end date.');
      return;
    }

    // Max 1 year range
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    if (toDate.getTime() - fromDate.getTime() > yearMs) {
      setValidationError('Date range cannot exceed 1 year.');
      return;
    }

    setValidationError(null);
    onChange('custom');
    onCustomRange?.(fromDate.toISOString(), toDate.toISOString());
  }, [localFrom, localTo, onChange, onCustomRange]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', background: 'var(--bg)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
        {PRESETS.map(r => (
          <button
            key={r.key}
            onClick={() => handlePreset(r.key)}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none',
              background: !isCustom && timeRange === r.key ? 'var(--accent)' : 'transparent',
              color: !isCustom && timeRange === r.key ? 'white' : 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={handleCustomToggle}
          title="Custom date range"
          style={{
            padding: '6px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none',
            background: isCustom ? 'var(--accent)' : 'transparent',
            color: isCustom ? 'white' : 'var(--text-muted)', cursor: 'pointer',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Calendar size={12} />
          Custom
        </button>
      </div>

      {/* Custom date range inputs */}
      {showCustom && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg)', fontSize: 12,
          }}
        >
          <input
            type="date"
            value={localFrom}
            onChange={e => { setLocalFrom(e.target.value); setValidationError(null); }}
            style={{
              padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4,
              fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text)',
              outline: 'none',
            }}
          />
          <span style={{ color: 'var(--text-muted)' }}>—</span>
          <input
            type="date"
            value={localTo}
            onChange={e => { setLocalTo(e.target.value); setValidationError(null); }}
            style={{
              padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4,
              fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleApplyCustom}
            className="btn btn-sm"
            style={{ fontSize: 11, padding: '4px 10px', fontWeight: 600 }}
          >
            Apply
          </button>
          {validationError && (
            <span style={{ fontSize: 10, color: 'var(--danger, #EF4444)', maxWidth: 180 }}>
              {validationError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
