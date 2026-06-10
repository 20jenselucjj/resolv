'use client';

import React from 'react';
import { cssVar } from '../recharts/export-utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  role?: string;
  ariaLabel?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  role = 'status',
  ariaLabel,
}: EmptyStateProps) {
  const sizeMap = {
    sm: { padding: '24px 0', iconSize: 24, titleSize: 13, descSize: 12 },
    md: { padding: '40px 0', iconSize: 32, titleSize: 14, descSize: 13 },
    lg: { padding: '60px 0', iconSize: 48, titleSize: 16, descSize: 14 },
  };
  const s = sizeMap[size];

  return (
    <div
      role={role}
      aria-label={ariaLabel || title}
      style={{
        padding: s.padding,
        textAlign: 'center',
        color: cssVar('--text-muted', '#9CA3AF'),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {icon && (
        <div style={{ opacity: 0.5, marginBottom: 4 }}>
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: s.titleSize,
          fontWeight: 600,
          color: cssVar('--text-secondary', '#4B5563'),
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: s.descSize,
            color: cssVar('--text-muted', '#9CA3AF'),
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
