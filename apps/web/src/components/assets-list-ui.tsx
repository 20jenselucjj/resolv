'use client';

import type { ReactNode } from 'react';
import { Monitor } from 'lucide-react';
import Image from 'next/image';

export function Avatar({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  const initial = name?.trim()?.[0]?.toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          flexShrink: 0
        }}
      >
        <Image
          src={avatarUrl}
          alt={name || 'Owner'}
          width={100}
          height={100}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--accent-subtle)',
        border: '1px solid var(--accent-border)',
        color: 'var(--accent)',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0
      }}
    >
      {initial}
    </div>
  );
}

export function ProgressMini({ value, tone }: { value: number | null; tone: string }) {
  if (value == null) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 72 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{Math.round(value)}%</div>
      <div
        style={{
          width: '100%',
          height: 6,
          borderRadius: 999,
          background: 'var(--bg-tertiary)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            borderRadius: 999,
            background: tone
          }}
        />
      </div>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Monitor;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `color-mix(in srgb, ${tone} 14%, var(--bg-secondary))`,
          color: tone,
          flexShrink: 0
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
        {label}
        {required ? <span style={{ color: 'var(--danger)' }}> *</span> : null}
      </label>
      {children}
    </div>
  );
}
