'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Circle, Clock3, Download, FileText, Save, Shield, Ticket, User, Users
} from 'lucide-react';
import type { AssetDetail, AssetSoftware, AssetUser, AssetActivityEntry } from '@/lib/asset-detail-types';
import { BODY_FONT } from '@/lib/asset-detail-types';
import { formatDateTime, timeAgo, formatCurrency, formatDate } from '@/components/asset-detail-utils';
import { Panel, DetailGrid, Pill, EmptyState, ActionButton } from '@/components/asset-detail-ui';

interface AssetDetailSidebarProps {
  asset: AssetDetail;
  compactLayout: boolean;
  isOnline: boolean;
  lastSeen?: string | null;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  savingNotes: boolean;
  saveNotes: () => Promise<void>;
  users: (AssetUser & { session_count?: number })[];
  software: AssetSoftware[];
  activity: AssetActivityEntry[];
}

export function AssetDetailSidebar({
  asset,
  compactLayout,
  isOnline,
  lastSeen,
  notes,
  setNotes,
  savingNotes,
  saveNotes,
  users,
  software,
  activity
}: AssetDetailSidebarProps): React.JSX.Element {
  const router = useRouter();

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, position: compactLayout ? 'static' : 'sticky', top: 24 }}>
      <Panel title="Agent status" subtitle="Realtime endpoint health" icon={Shield}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg)'
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                <Circle size={10} fill={isOnline ? 'var(--success)' : 'var(--text-muted)'} color={isOnline ? 'var(--success)' : 'var(--text-muted)'} />
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
            {isOnline ? <Pill tone="success">Agent active</Pill> : <Pill tone="warning">Awaiting heartbeat</Pill>}
          </div>

          <DetailGrid
            items={[
              { label: 'Last seen', value: formatDateTime(lastSeen) },
              { label: 'Agent version', value: asset.agent_version }
            ]}
          />
        </div>
      </Panel>

      <Panel title="Logged-in users" subtitle="Unique user sessions on this endpoint" icon={Users}>
        {users.length === 0 ? (
          <EmptyState icon={User} title="No active user data" description="No logged-in users were returned for this asset." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map((session, index) => (
              <div
                key={session.id || `${session.username || 'user'}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: session.is_current ? 'var(--accent-subtle)' : 'var(--bg)',
                  transition: 'background 0.15s'
                }}
              >
                  {session.user_avatar ? (
                  <img
                    src={session.user_avatar}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      objectFit: 'cover', flexShrink: 0,
                      border: '1px solid var(--border)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: session.user_id ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                      border: session.user_id ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <User size={14} color={session.user_id ? 'var(--accent)' : 'var(--text-muted)'} />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.display_name || session.username || 'Unknown user'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {session.logged_in_at ? `Active ${timeAgo(session.logged_in_at)}` : 'Unknown session'}
                    </span>
                    {session.session_type && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 6px',
                        borderRadius: 999, border: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                      }}>
                        {session.session_type === 'console' ? 'Local' : session.session_type}
                      </span>
                    )}
                  </div>
                </div>
                {session.session_count && session.session_count > 1 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 7px',
                    borderRadius: 999, background: 'var(--accent-subtle)',
                    color: 'var(--accent)', border: '1px solid var(--accent-border)',
                    flexShrink: 0
                  }}>
                    {session.session_count} sessions
                  </span>
                )}
                {session.is_current && <Pill tone="success">Active</Pill>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Notes"
        subtitle="Internal context for operators"
        icon={FileText}
        actions={
          <ActionButton icon={Save} disabled={savingNotes} onClick={saveNotes}>
            {savingNotes ? 'Saving\u2026' : 'Save'}
          </ActionButton>
        }
      >
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Document useful context, known issues, or field notes..."
          rows={8}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            padding: 14,
            fontSize: 13,
            fontFamily: BODY_FONT,
            lineHeight: 1.6,
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
      </Panel>

      <Panel title="Quick links" subtitle="Jump into adjacent workflows" icon={Ticket}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => router.push(`/dashboard/tickets?asset_id=${asset.id}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Ticket size={15} color="var(--accent)" />
              Open Tickets for this Asset
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{'\u2192'}</span>
          </button>

          <button
            onClick={() => {
              window.open(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/assets/${asset.id}/logs`,
                '_blank'
              );
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Download size={15} color="var(--accent)" />
              Download Agent Logs
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{'\u2192'}</span>
          </button>
        </div>
      </Panel>

      <Panel title="Snapshot" subtitle="Fast operational readout" icon={Clock3}>
        <DetailGrid
          items={[
            { label: 'Users', value: users.length },
            { label: 'Adapters', value: (asset.network_adapters || []).length },
            { label: 'Apps', value: software.length },
            { label: 'Recent activity', value: activity.length },
            { label: 'Purchase cost', value: formatCurrency(asset.purchase_cost) },
            { label: 'Warranty', value: formatDate(asset.warranty_expiry) }
          ]}
        />
        {(asset.usb_devices && asset.usb_devices.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>USB Devices</span>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{asset.usb_devices.length}</span>
          </div>
        )}
      </Panel>
      {asset.hardware?.encryption_status && asset.hardware.encryption_status.length > 0 && (
        <Panel title="Encryption" subtitle="BitLocker drive status" icon={Shield}>
          {asset.hardware.encryption_status.map((d) => {
            const encrypted = d.protection_status?.toLowerCase() === 'protection on' || d.encryption_percentage === 100;
            return (
              <div key={d.drive_letter} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: encrypted ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                <span style={{ fontSize: 12 }}>Drive {d.drive_letter}: {encrypted ? 'Encrypted' : 'Unencrypted'}</span>
              </div>
            );
          })}
        </Panel>
      )}
    </aside>
  );
}
