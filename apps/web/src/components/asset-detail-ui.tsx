'use client';

import * as React from 'react';
import { Battery, HardDrive, Save, ShieldOff, Terminal, X } from 'lucide-react';
import type { AgentCommand, AssetDetail, AssetHardware, AssetResponse, CommandType, NoticeTone, UsbDevice } from '@/lib/asset-detail-types';
import { BODY_FONT, COMMAND_TYPES } from '@/lib/asset-detail-types';
import { toneColor } from '@/components/asset-detail-utils';
import { formatDateTime } from '@/lib/date-utils';
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

export function EncryptionCard({ encryption }: { encryption: Array<{ drive_letter: string; protection_status?: string; encryption_method?: string; volume_status?: string; encryption_percentage?: number }> }): React.JSX.Element {
  if (!encryption || encryption.length === 0) {
    return <EmptyState icon={ShieldOff} title="No encryption data" description="BitLocker status will appear here after the next agent check-in." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {encryption.map((drive) => {
        const isEncrypted = drive.protection_status?.toLowerCase().includes('on') || drive.encryption_percentage === 100;
        const pct = drive.encryption_percentage ?? 0;
        return (
          <div key={drive.drive_letter} style={{
            padding: 16, borderRadius: 8,
            border: `1px solid ${isEncrypted ? '#22c55e33' : '#ef444433'}`,
            background: isEncrypted ? '#22c55e08' : '#ef444408',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Drive {drive.drive_letter}:</span>
              <Pill tone={isEncrypted ? 'success' : 'danger'}>{isEncrypted ? 'Encrypted' : 'Not Encrypted'}</Pill>
            </div>
            <DetailGrid items={[
              { label: 'Protection', value: drive.protection_status || 'Unknown' },
              { label: 'Method', value: drive.encryption_method || 'Unknown' },
              { label: 'Status', value: drive.volume_status || 'Unknown' },
              { label: 'Encrypted', value: `${pct}%` },
            ]} />
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: isEncrypted ? '#22c55e' : '#ef4444', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BatteryCard({ hw }: { hw: AssetHardware }): React.JSX.Element {
  if (!hw.battery_has_battery) {
    return <EmptyState icon={Battery} title="No battery" description="This device does not have a battery." />;
  }

  const health = Number(hw.battery_health_percent) || 0;
  const remaining = Number(hw.battery_remaining_percent) || 0;
  const healthColor = health >= 80 ? '#22c55e' : health >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Health bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Battery Health</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: healthColor }}>{health.toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${health}%`, background: healthColor, borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Charge bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Charge Level {hw.battery_is_charging ? '⚡' : ''}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{remaining.toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${remaining}%`, background: '#3b82f6', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
      </div>

      <DetailGrid items={[
        { label: 'Design Capacity', value: hw.battery_design_capacity_mwh ? `${(hw.battery_design_capacity_mwh / 1000).toFixed(0)} mWh` : 'Unknown' },
        { label: 'Full Charge Capacity', value: hw.battery_full_charge_capacity_mwh ? `${(hw.battery_full_charge_capacity_mwh / 1000).toFixed(0)} mWh` : 'Unknown' },
        { label: 'Cycle Count', value: hw.battery_cycle_count != null ? `${hw.battery_cycle_count}` : 'Unknown' },
        { label: 'Status', value: hw.battery_is_charging ? 'Charging' : Number(hw.battery_remaining_percent) >= 99 ? 'Fully Charged' : 'On Battery' },
      ]} />
    </div>
  );
}

export function CommandStatusBadge({ status }: { status: string }): React.JSX.Element {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    dispatched: { bg: '#dbeafe', color: '#1e40af', label: 'Dispatched' },
    in_progress: { bg: '#e0e7ff', color: '#3730a3', label: 'Running' },
    completed: { bg: '#dcfce7', color: '#166534', label: 'Completed' },
    failed: { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
    cancelled: { bg: '#f3f4f6', color: '#4b5563', label: 'Cancelled' },
    expired: { bg: '#f3f4f6', color: '#6b7280', label: 'Expired' },
  };
  const c = config[status] || config.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: 12, fontSize: 12, fontWeight: 500,
      background: c.bg, color: c.color,
    }}>
      {status === 'in_progress' && <span style={{ marginRight: 6, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>}
      {c.label}
    </span>
  );
}

export function CommandsPanel({ commands, onRefresh, assetId, onSelect }: {
  commands: AgentCommand[];
  onRefresh: () => void;
  assetId: string;
  onSelect?: (cmd: AgentCommand) => void;
}): React.JSX.Element {
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const handleCancel = async (commandId: string) => {
    if (!confirm('Cancel this command?')) return;
    setCancellingId(commandId);
    try {
      await api.post(`/assets/${assetId}/commands/${commandId}/cancel`, {});
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel command');
    }
    setCancellingId(null);
  };

  if (!commands || commands.length === 0) {
    return (
      <div>
        <div style={{
          padding: '48px 24px', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border)', background: 'var(--bg-secondary)',
          textAlign: 'center'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)',
            background: 'var(--bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <span style={{ fontSize: 22 }}>⚡</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>No commands</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Commands sent to this agent will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {commands.map((cmd) => {
        const typeInfo = COMMAND_TYPES.find(t => t.value === cmd.command_type);
        const rowBg = cmd.status === 'failed' ? '#fef2f2'
          : cmd.status === 'completed' && cmd.exit_code === 0 ? '#f0fdf4'
          : '#fff';
        return (
          <div
            key={cmd.id}
            onClick={() => onSelect?.(cmd)}
            style={{
              padding: 14, borderRadius: 8, border: '1px solid #e5e7eb',
              background: rowBg,
              cursor: 'pointer',
              transition: 'box-shadow 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{typeInfo?.icon || '⚡'}</span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{typeInfo?.label || cmd.command_type}</span>
                <CommandStatusBadge status={cmd.status} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {cmd.status === 'pending' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCancel(cmd.id); }}
                    disabled={cancellingId === cmd.id}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444',
                      background: cancellingId === cmd.id ? '#fecaca' : '#fff',
                      color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: cancellingId === cmd.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {cancellingId === cmd.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {cmd.created_at ? formatDateTime(cmd.created_at) : ''}
                </span>
              </div>
            </div>

            {/* Show details for completed/failed commands */}
            {(cmd.status === 'completed' || cmd.status === 'failed') && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {cmd.exit_code != null && (
                  <span style={{ color: cmd.exit_code === 0 ? '#166534' : '#991b1b', marginRight: 12 }}>
                    Exit code: {cmd.exit_code}
                  </span>
                )}
                {cmd.error_message && (
                  <span style={{ color: '#991b1b', marginRight: 12 }}>{cmd.error_message}</span>
                )}
                {cmd.created_by_name && (
                  <span style={{ color: '#6b7280', marginRight: 12 }}>by {cmd.created_by_name}</span>
                )}
                {cmd.dispatched_at && cmd.completed_at && (
                  <span style={{ color: '#6b7280' }}>
                    Duration: {Math.round((new Date(cmd.completed_at).getTime() - new Date(cmd.dispatched_at).getTime()) / 1000)}s
                  </span>
                )}
              </div>
            )}

            {/* Timestamps for all commands */}
            <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {cmd.dispatched_at && (<span>Dispatched: {formatDateTime(cmd.dispatched_at)}</span>)}
              {cmd.started_at && (<span>Started: {formatDateTime(cmd.started_at)}</span>)}
              {cmd.completed_at && (<span>Completed: {formatDateTime(cmd.completed_at)}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RunCommandDialog({ assetId, onClose, onCreated }: {
  assetId: string;
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [commandType, setCommandType] = React.useState<CommandType>('run_script');
  const [priority, setPriority] = React.useState(0);
  const [timeoutSeconds, setTimeoutSeconds] = React.useState(60);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Dynamic payload fields
  const [script, setScript] = React.useState('');
  const [scriptType, setScriptType] = React.useState('powershell');
  const [customCommand, setCustomCommand] = React.useState('');
  const [customShell, setCustomShell] = React.useState('powershell');
  const [softwareName, setSoftwareName] = React.useState('');
  const [softwareUrl, setSoftwareUrl] = React.useState('');
  const [serviceName, setServiceName] = React.useState('');
  const [logName, setLogName] = React.useState('System');
  const [logLevel, setLogLevel] = React.useState('Error');
  const [maxEvents, setMaxEvents] = React.useState(50);
  const [hoursBack, setHoursBack] = React.useState(24);
  const [delaySeconds, setDelaySeconds] = React.useState(30);
  const [shutdownMessage, setShutdownMessage] = React.useState('');

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

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    fontWeight: 700,
    marginBottom: 6
  };

  const buildPayload = (): Record<string, any> => {
    switch (commandType) {
      case 'run_script':
        return { script, type: scriptType };
      case 'custom':
        return { command: customCommand, shell: customShell };
      case 'install_software':
        return { name: softwareName, ...(softwareUrl ? { installer_url: softwareUrl } : {}) };
      case 'uninstall_software':
        return { name: softwareName };
      case 'restart_service':
      case 'stop_service':
      case 'start_service':
        return { service_name: serviceName };
      case 'collect_logs':
        return { log_name: logName, level: logLevel, max_events: maxEvents, hours_back: hoursBack };
      case 'reboot':
      case 'shutdown':
        return { delay_seconds: delaySeconds, ...(shutdownMessage ? { message: shutdownMessage } : {}) };
      default:
        return {};
    }
  };

  const canSubmit = (): boolean => {
    switch (commandType) {
      case 'run_script': return script.trim().length > 0;
      case 'custom': return customCommand.trim().length > 0;
      case 'install_software':
      case 'uninstall_software': return softwareName.trim().length > 0;
      case 'restart_service':
      case 'stop_service':
      case 'start_service': return serviceName.trim().length > 0;
      case 'collect_logs': return true;
      case 'reboot':
      case 'shutdown': return true;
      default: return false;
    }
  };

  const submit = async () => {
    if (!canSubmit()) return;
    setLoading(true);
    setError('');

    try {
      await api.post(`/assets/${assetId}/commands`, {
        command_type: commandType,
        payload: buildPayload(),
        priority,
        timeout_seconds: timeoutSeconds,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to send command');
    } finally {
      setLoading(false);
    }
  };

  const renderDynamicFields = (): React.ReactNode => {
    switch (commandType) {
      case 'run_script':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Script Type</label>
              <select
                value={scriptType}
                onChange={(e) => setScriptType(e.target.value)}
                style={inputStyle}
              >
                <option value="powershell">PowerShell</option>
                <option value="cmd">CMD</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Script</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Enter your script here..."
                rows={6}
                style={{
                  ...inputStyle,
                  height: 'auto',
                  padding: '10px 12px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  resize: 'vertical'
                }}
              />
            </div>
          </>
        );
      case 'custom':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Shell</label>
              <select
                value={customShell}
                onChange={(e) => setCustomShell(e.target.value)}
                style={inputStyle}
              >
                <option value="powershell">PowerShell</option>
                <option value="cmd">CMD</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Command</label>
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="Enter command to execute..."
                style={inputStyle}
              />
            </div>
          </>
        );
      case 'install_software':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Software Name</label>
              <input
                type="text"
                value={softwareName}
                onChange={(e) => setSoftwareName(e.target.value)}
                placeholder="e.g. Google Chrome"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Download URL (optional)</label>
              <input
                type="url"
                value={softwareUrl}
                onChange={(e) => setSoftwareUrl(e.target.value)}
                placeholder="https://example.com/installer.exe"
                style={inputStyle}
              />
            </div>
          </>
        );
      case 'uninstall_software':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Software Name</label>
            <input
              type="text"
              value={softwareName}
              onChange={(e) => setSoftwareName(e.target.value)}
              placeholder="e.g. Google Chrome"
              style={inputStyle}
            />
          </div>
        );
      case 'restart_service':
      case 'stop_service':
      case 'start_service':
        return (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Service Name</label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. spooler"
              style={inputStyle}
            />
          </div>
        );
      case 'collect_logs':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Log Name</label>
              <select
                value={logName}
                onChange={(e) => setLogName(e.target.value)}
                style={inputStyle}
              >
                <option value="System">System</option>
                <option value="Application">Application</option>
                <option value="Security">Security</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Level</label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                style={inputStyle}
              >
                <option value="Error">Error</option>
                <option value="Warning">Warning</option>
                <option value="Information">Information</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Max Events</label>
              <input
                type="number"
                value={maxEvents}
                onChange={(e) => setMaxEvents(Number(e.target.value))}
                min={1}
                max={1000}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Hours Back</label>
              <input
                type="number"
                value={hoursBack}
                onChange={(e) => setHoursBack(Number(e.target.value))}
                min={1}
                max={720}
                style={inputStyle}
              />
            </div>
          </>
        );
      case 'reboot':
      case 'shutdown':
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Delay (seconds)</label>
              <input
                type="number"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                min={0}
                max={3600}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Message (optional)</label>
              <input
                type="text"
                value={shutdownMessage}
                onChange={(e) => setShutdownMessage(e.target.value)}
                placeholder="Reason for the action..."
                style={inputStyle}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 24px',
        overflow: 'auto'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
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
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Run Command</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Send a command to the remote agent for execution.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-muted)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Command type selector grid */}
          <div style={{ marginBottom: 20 }}>
            <div style={labelStyle}>Command Type</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              marginTop: 8
            }}>
              {COMMAND_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => { setCommandType(ct.value); setError(''); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${commandType === ct.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: commandType === ct.value ? 'var(--accent-subtle)' : 'var(--bg)',
                    color: commandType === ct.value ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left' as const,
                    transition: 'all 140ms ease'
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ct.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{ct.label}</div>
                    <div style={{ fontSize: 10, color: commandType === ct.value ? 'var(--accent)' : 'var(--text-muted)', opacity: 0.8 }}>{ct.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic payload fields */}
          {renderDynamicFields()}

          {/* Priority & Timeout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Priority ({priority})</label>
              <input
                type="range"
                min={0}
                max={100}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Timeout (seconds)</label>
              <input
                type="number"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                min={5}
                max={3600}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 20px 20px',
            borderTop: '1px solid var(--border)'
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 42, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !canSubmit()}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 42, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--accent)', background: 'var(--accent)',
              color: 'var(--text-inverse)', fontSize: 13, fontWeight: 700,
              cursor: loading || !canSubmit() ? 'not-allowed' : 'pointer',
              opacity: loading || !canSubmit() ? 0.6 : 1
            }}
          >
            {loading ? 'Sending\u2026' : '⚡ Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsbDevicesPanel({ devices }: { devices: UsbDevice[] }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);

  if (!devices || devices.length === 0) {
    return <EmptyState icon={HardDrive} title="No USB devices" description="Connected USB devices will appear here after the next agent check-in." />;
  }

  const PREVIEW_COUNT = 3;
  const visibleDevices = expanded ? devices : devices.slice(0, PREVIEW_COUNT);
  const hasMore = devices.length > PREVIEW_COUNT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visibleDevices.map((dev) => (
        <div key={dev.id} style={{
          padding: '10px 14px', borderRadius: 8,
          border: '1px solid #e5e7eb', background: '#fafafa',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{dev.device_name || 'Unknown Device'}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {[dev.manufacturer, dev.device_type].filter(Boolean).join(' · ') || 'No details'}
            </div>
          </div>
          {dev.serial && (
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>SN: {dev.serial}</span>
          )}
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', marginTop: 4,
          }}
        >
          {expanded ? `Show less` : `Show ${devices.length - PREVIEW_COUNT} more device${devices.length - PREVIEW_COUNT !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
