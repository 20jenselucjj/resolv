'use client';

import React, { memo, useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cssVar } from '../../components/recharts/export-utils';
import PinButton from '../../components/shared/PinButton';

// ── Types ──────────────────────────────────────────────────────

export type RAGStatus = 'green' | 'yellow' | 'red';

export interface KPITileProps {
  label: string;
  value: string | number;
  unit?: string;
  ragStatus?: RAGStatus;
  sparklineData?: { value: number }[];
  sparklineColor?: string;
  change?: { value: number; label?: string; isPositive: boolean };
  target?: { current: number; target: number; label?: string };
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconColor?: string;
  iconBg?: string;
  accentColor?: string;
  onClick?: () => void;
  metricKey?: string;
  metricLabel?: string;
  isPinned?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  ariaLabel?: string;
}

// ── RAG Dot ────────────────────────────────────────────────────

const RAG_DOT_COLORS: Record<RAGStatus, string> = {
  green: '#16A34A',
  yellow: '#F59E0B',
  red: '#EF4444',
};

const RAGDot: React.FC<{ status: RAGStatus }> = ({ status }) => (
  <span
    role="img"
    aria-label={`Status: ${status}`}
    style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: RAG_DOT_COLORS[status],
      boxShadow: `0 0 6px ${RAG_DOT_COLORS[status]}40`,
      flexShrink: 0,
    }}
  />
);

// ── Mini Sparkline ─────────────────────────────────────────────

const Sparkline: React.FC<{ data: { value: number }[]; color: string; height?: number }> = ({
  data,
  color,
  height = 32,
}) => {
  const uid = useId();
  if (!data.length) return null;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
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

const KPITile: React.FC<KPITileProps> = ({
  label,
  value,
  unit,
  ragStatus,
  sparklineData,
  sparklineColor,
  change,
  target,
  icon: Icon,
  iconColor,
  iconBg,
  accentColor,
  onClick,
  metricKey,
  metricLabel,
  isPinned,
  onPin,
  onUnpin,
  ariaLabel,
}) => {
  const accent = accentColor || cssVar('--accent', '#2563EB');
  const spColor = sparklineColor || accent;

  return (
    <div
      role="button"
      aria-label={ariaLabel || `${label}: ${value}${unit || ''}`}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background: cssVar('--bg-elevated', '#ffffff'),
        border: `1px solid ${cssVar('--border', '#e5e7eb')}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease, transform 0.15s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.10)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header row: label + RAG + pin + icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: cssVar('--text-muted', '#6B7280'),
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {label}
          </span>
          {ragStatus && <RAGDot status={ragStatus} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {metricKey && onPin && onUnpin && (
            <PinButton isPinned={isPinned || false} onPin={onPin} onUnpin={onUnpin} />
          )}
          {Icon && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: iconBg || `${accent}15`,
                border: `1px solid ${accent}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={14} color={iconColor || accent} />
            </div>
          )}
        </div>
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: cssVar('--text', '#1f2937'),
            lineHeight: 1,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 13, color: cssVar('--text-muted', '#6B7280'), fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>

      {/* Change + Target */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', minHeight: 18 }}>
        {change && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: change.isPositive ? cssVar('--success', '#16A34A') : cssVar('--danger', '#EF4444'),
              }}
              aria-label={`${change.isPositive ? 'Up' : 'Down'} ${Math.abs(change.value)}%`}
            >
              {change.isPositive ? '↑' : '↓'} {Math.abs(change.value)}%
            </span>
            <span style={{ fontSize: 11, color: cssVar('--text-muted', '#6B7280') }}>{change.label}</span>
          </div>
        )}
        {target && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <div
              style={{
                flex: 1,
                height: 5,
                background: cssVar('--bg-tertiary', '#f3f4f6'),
                borderRadius: 3,
                overflow: 'hidden',
                maxWidth: 100,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min((target.current / target.target) * 100, 100)}%`,
                  background:
                    target.current >= target.target
                      ? cssVar('--success', '#16A34A')
                      : target.current >= target.target * 0.8
                        ? cssVar('--warning', '#F59E0B')
                        : cssVar('--danger', '#EF4444'),
                  borderRadius: 3,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 10, color: cssVar('--text-muted', '#6B7280') }}>
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

export default memo(KPITile);
