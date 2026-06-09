'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { AutoRefreshInterval } from '../../types';

interface AutoRefreshToggleProps {
  enabled: boolean;
  interval: AutoRefreshInterval;
  countdown: number;
  isLive: boolean;
  lastUpdated: Date | null;
  onToggle: (enabled: boolean) => void;
  onIntervalChange: (interval: AutoRefreshInterval) => void;
}

const INTERVAL_OPTIONS: { value: AutoRefreshInterval; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
];

function formatLastUpdated(date: Date | null): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins === 1) return '1m ago';
  return `${mins}m ago`;
}

const AutoRefreshToggle: React.FC<AutoRefreshToggleProps> = ({
  enabled,
  interval,
  countdown,
  isLive,
  lastUpdated,
  onToggle,
  onIntervalChange,
}) => {
  const [showSelector, setShowSelector] = React.useState(false);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Live indicator */}
      {isLive && (
        <span
          title="Auto-refresh active"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--success, #10B981)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--success, #10B981)',
              animation: 'ar-pulse 2s ease-in-out infinite',
              display: 'inline-block',
            }}
          />
          Live
        </span>
      )}

      {/* Last updated */}
      {lastUpdated && (
        <span style={{ fontSize: 11, color: 'var(--text-muted, #9CA3AF)', whiteSpace: 'nowrap' }}>
          {formatLastUpdated(lastUpdated)}
        </span>
      )}

      {/* Toggle button */}
      <button
        onClick={() => {
          if (enabled) {
            onToggle(false);
          } else {
            setShowSelector(!showSelector);
          }
        }}
        className="btn btn-secondary btn-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          fontSize: 12,
          border: enabled ? '1px solid var(--success, #10B981)' : undefined,
          background: enabled ? 'var(--success-bg, rgba(16,185,129,0.08))' : undefined,
        }}
        title={enabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
      >
        <RefreshCw
          size={12}
          style={{
            animation: enabled ? 'ar-spin 2s linear infinite' : 'none',
          }}
        />
        {enabled ? `${countdown}s` : 'Auto'}
      </button>

      {/* Interval selector dropdown */}
      {showSelector && !enabled && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setShowSelector(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: 'var(--bg-elevated, #fff)',
              border: '1px solid var(--border, #dde1e7)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 1000,
              minWidth: 100,
              overflow: 'hidden',
            }}
          >
            {INTERVAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === 0) {
                    onToggle(false);
                  } else {
                    onIntervalChange(opt.value);
                    onToggle(true);
                  }
                  setShowSelector(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 16px',
                  textAlign: 'left',
                  border: 'none',
                  background: interval === opt.value && enabled ? 'var(--bg-secondary, #f5f7fa)' : 'transparent',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text, #1F2937)',
                  fontWeight: interval === opt.value && enabled ? 600 : 400,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary, #f5f7fa)'}
                onMouseLeave={e => {
                  if (!(interval === opt.value && enabled)) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes ar-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes ar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AutoRefreshToggle;
