'use client';

import * as React from 'react';
import { X, Save } from 'lucide-react';
import type { AssetDetail, AssetResponse, NoticeTone } from '@/lib/asset-detail-types';
import { BODY_FONT } from '@/lib/asset-detail-types';
import { toneColor } from '@/components/asset-detail-utils';
import { api } from '@/lib/api';

export function Panel({
  title,
  subtitle,
  icon: Icon,
  actions,
  children
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      style={{
        background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {Icon && (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-subtle)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Icon size={16} color="var(--accent)" />
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.01em'
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div>
            )}
          </div>
        </div>

        {actions}
      </div>

      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

export function DetailGrid({
  items,
  columns = 2
}: {
  items: Array<{ label: string; value?: React.ReactNode; accent?: boolean }>;
  columns?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 12
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px'
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: 6,
              fontWeight: 700
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: item.accent ? 'var(--accent)' : 'var(--text)',
              wordBreak: 'break-word'
            }}
          >
            {item.value ?? '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({
  percent,
  color,
  label,
  meta
}: {
  percent: number;
  color: string;
  label: string;
  meta?: string;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meta || `${percent}%`}</div>
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 999,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: color,
            transition: 'width 180ms ease'
          }}
        />
      </div>
    </div>
  );
}

export function Pill({
  children,
  tone = 'accent'
}: {
  children: React.ReactNode;
  tone?: NoticeTone;
}): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: tone === 'accent' ? 'var(--accent-subtle)' : 'var(--bg)',
        color: toneColor(tone),
        fontSize: 12,
        fontWeight: 700
      }}
    >
      {children}
    </span>
  );
}

export function ActionButton({
  icon: Icon,
  children,
  tone = 'neutral',
  disabled,
  onClick
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  const background = tone === 'primary' ? 'var(--accent)' : tone === 'danger' ? 'var(--bg)' : 'var(--bg-elevated)';
  const color = tone === 'primary' ? 'var(--text-inverse)' : tone === 'danger' ? 'var(--danger)' : 'var(--text)';
  const border = tone === 'primary' ? 'var(--accent)' : tone === 'danger' ? 'var(--danger)' : 'var(--border)';

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 42,
        padding: '0 16px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${border}`,
        background,
        color,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        boxShadow: tone === 'primary' ? 'var(--shadow-md)' : 'none',
        transition: 'transform 140ms ease, opacity 140ms ease'
      }}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '48px 24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--border)',
        background: 'var(--bg-secondary)',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}
      >
        <Icon size={22} color="var(--text-muted)" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>{description}</div>
    </div>
  );
}

export function EditAssetModal({
  asset,
  onClose,
  onSaved
}: {
  asset: AssetDetail;
  onClose: () => void;
  onSaved: (next: AssetDetail) => void;
}): React.JSX.Element {
  const [form, setForm] = React.useState({
    display_name: asset.display_name || '',
    assigned_to_name: asset.assigned_to_name || '',
    department: asset.department || '',
    location: asset.location || '',
    company: asset.company || '',
    vendor: asset.vendor || '',
    purchase_date: asset.purchase_date || '',
    warranty_expiry: asset.warranty_expiry || ''
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 42,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    padding: '0 12px',
    fontSize: 13,
    fontFamily: BODY_FONT,
    boxSizing: 'border-box'
  };

  const save = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await api.patch<AssetResponse | undefined>(`/assets/${asset.id}`, form);
      onSaved(response?.data || { ...asset, ...form });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to save asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        padding: 24,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '18px 20px',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Edit asset</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Update ownership, lifecycle, and display details.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            ['Display name', 'display_name', 'text'],
            ['Assigned to', 'assigned_to_name', 'text'],
            ['Department', 'department', 'text'],
            ['Location', 'location', 'text'],
            ['Company', 'company', 'text'],
            ['Vendor', 'vendor', 'text'],
            ['Purchase date', 'purchase_date', 'date'],
            ['Warranty expiry', 'warranty_expiry', 'date']
          ].map(([label, key, type]) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  fontWeight: 700
                }}
              >
                {label}
              </span>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.value
                  }))
                }
                style={inputStyle}
              />
            </label>
          ))}
        </div>

        {error && (
          <div style={{ padding: '0 20px 20px', color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{error}</div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 20px 20px',
            borderTop: '1px solid var(--border)'
          }}
        >
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton icon={Save} tone="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving\u2026' : 'Save changes'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
