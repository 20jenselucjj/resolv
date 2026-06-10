'use client';

import React, { useId } from 'react';
import { cssVar } from './export-utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import PinButton from '../shared/PinButton';
import ChartSkeleton from './ChartSkeleton';

// ── Types ──────────────────────────────────────────────────────

export interface ScorecardWidgetProps {
  /** Label for the metric */
  label: string;
  /** Current value */
  value: string | number;
  /** Current value unit */
  unit?: string;
  /** Icon component */
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  /** Icon color */
  iconColor?: string;
  /** Icon background */
  iconBg?: string;
  /** Period-over-period change */
  change?: { value: number; label: string; isPositive: boolean };
  /** Target attainment */
  target?: { current: number; target: number; label?: string };
  /** Sparkline trend data points */
  sparklineData?: { value: number }[];
  /** Sparkline color */
  sparklineColor?: string;
  /** Card accent border color */
  accentColor?: string;
  /** Click handler */
  onClick?: () => void;
  /** Unique metric key for pinning (if provided, PinButton is rendered) */
  metricKey?: string;
  /** Human-readable label for pinning */
  metricLabel?: string;
  /** Whether this metric is currently pinned */
  isPinned?: boolean;
  /** Pin callback */
  onPin?: () => void;
  /** Unpin callback */
  onUnpin?: () => void;
  /** Loading state */
  loading?: boolean;
}

// ── Mini Sparkline ─────────────────────────────────────────────

const Sparkline: React.FC<{ data: { value: number }[]; color: string; height?: number }> = ({
  data,
  color,
  height = 28,
}) => {
  const uid = useId();
  if (!data.length) return null;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-grad-${uid})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────

const ScorecardWidget: React.FC<ScorecardWidgetProps> = ({
  label,
  value,
  unit,
  icon: Icon,
  iconColor,
  iconBg,
  change,
  target,
  sparklineData,
  sparklineColor,
  accentColor,
  onClick,
  metricKey,
  metricLabel,
  isPinned,
  onPin,
  onUnpin,
  loading = false,
}) => {
  const accent = accentColor || cssVar('--accent', '#1E40AF');
  const spColor = sparklineColor || accent;

  if (loading) {
    return (
      <div
        style={{
          background: cssVar('--bg-elevated', '#fff'),
          border: `1px solid ${cssVar('--border', '#dde1e7')}`,
          borderLeft: `4px solid ${accent}`,
          borderRadius: 12,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="animate-pulse" style={{ height: 12, width: '60%', borderRadius: 6, background: cssVar('--border-subtle', '#eef0f3') }} />
        <div className="animate-pulse" style={{ height: 32, width: '40%', borderRadius: 6, background: cssVar('--border-subtle', '#eef0f3') }} />
        <div className="animate-pulse" style={{ height: 8, width: '80%', borderRadius: 4, background: cssVar('--border-subtle', '#eef0f3') }} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: cssVar('--bg-elevated', '#fff'),
        border: `1px solid ${cssVar('--border', '#dde1e7')}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, transform 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: cssVar('--text-muted', '#9CA3AF'),
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        {metricKey && onPin && onUnpin && (
          <PinButton isPinned={isPinned || false} onPin={onPin} onUnpin={onUnpin} />
        )}
        {Icon && (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: iconBg || `${accent}15`,
              border: `1px solid ${accent}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={15} color={iconColor || accent} />
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: cssVar('--text', '#1F2937'), lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 13, color: cssVar('--text-muted', '#9CA3AF'), fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>

      {/* Period change + Target attainment */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {change && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: change.isPositive ? cssVar('--success', '#10B981') : cssVar('--danger', '#EF4444'),
              }}
            >
              {change.isPositive ? '↑' : '↓'} {Math.abs(change.value)}%
            </span>
            <span style={{ fontSize: 11, color: cssVar('--text-muted', '#9CA3AF') }}>{change.label}</span>
          </div>
        )}
        {target && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <div
              style={{
                flex: 1,
                height: 6,
                background: cssVar('--bg-tertiary', '#eef0f3'),
                borderRadius: 3,
                overflow: 'hidden',
                maxWidth: 120,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min((target.current / target.target) * 100, 100)}%`,
                  background:
                    target.current >= target.target
                      ? cssVar('--success', '#10B981')
                      : target.current >= target.target * 0.8
                        ? cssVar('--warning', '#F59E0B')
                        : cssVar('--danger', '#EF4444'),
                  borderRadius: 3,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: cssVar('--text-muted', '#9CA3AF') }}>
              {target.label || `${Math.round((target.current / target.target) * 100)}%`}
            </span>
          </div>
        )}
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <Sparkline data={sparklineData} color={spColor} height={36} />
      )}
    </div>
  );
};

export default ScorecardWidget;
