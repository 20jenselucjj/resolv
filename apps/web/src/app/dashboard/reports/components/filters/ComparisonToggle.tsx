'use client';

interface ComparisonToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * ComparisonToggle — enables "vs previous period" mode for reports.
 * When toggled on, charts and scorecards will show comparison data
 * from the previous time period alongside current data.
 */
export default function ComparisonToggle({ enabled, onToggle }: ComparisonToggleProps) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary, #4B5563)',
        cursor: 'pointer', userSelect: 'none',
        padding: '4px 0',
      }}
    >
      <div
        onClick={() => onToggle(!enabled)}
        style={{
          position: 'relative',
          width: 36, height: 20,
          borderRadius: 10,
          background: enabled ? 'var(--accent, #1E40AF)' : 'var(--border, #dde1e7)',
          transition: 'background 0.2s',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute', top: 2, left: enabled ? 18 : 2,
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            transition: 'left 0.2s',
          }}
        />
      </div>
      <span>Compare to previous period</span>
    </label>
  );
}
