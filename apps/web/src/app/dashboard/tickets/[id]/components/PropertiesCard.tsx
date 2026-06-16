'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Ticket, User } from '@/lib/store';
import { formatDateTime } from '@/lib/date-utils';
import { api } from '@/lib/api';
import { AssetListResponse } from '@/lib/assets-types';
import { SelectSearch } from '@/components/SelectSearch';
import { UserSearchSelect } from '@/components/UserSearchSelect';
import { CategoryTreeSelect } from '@/components/CategoryTreeSelect';
import { DateTimePicker } from '@/components/DateTimePicker';
import { PropField } from './PropField';
import { PRIORITY_OPTIONS, TICKET_TYPE_OPTIONS } from './constants';
import { useStatusConfig } from '@/lib/StatusConfigContext';

import type { Category } from '@/lib/store';
import { filterStatusesByType } from '@/lib/status-utils';

interface PropertiesCardProps {
  ticket: Ticket;
  categories: Category[];
  allUsers: User[];
  isAdminOrAgent: boolean;
  updateField: (field: string, value: string | number | boolean | null) => Promise<void>;
  handleStatusChange: (status: string) => void;
  handleAssignToUser: (userId: string | null) => Promise<void>;
  handleReporterChange: (userId: string | null) => Promise<void>;
}

function GroupDivider() {
  return <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />;
}

export function PropertiesCard({ ticket, categories, allUsers, isAdminOrAgent, updateField, handleStatusChange, handleAssignToUser, handleReporterChange }: PropertiesCardProps) {
  const [assets, setAssets] = useState<{id: string; name: string}[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const { statusOptions, statusConfig, statusTicketTypes } = useStatusConfig();

  const filteredStatuses = useMemo(() =>
    filterStatusesByType(statusOptions.filter(s => s.value !== 'all'), ticket.ticket_type, statusTicketTypes || {}),
    [statusTicketTypes, statusOptions, ticket.ticket_type]
  );

  useEffect(() => {
    if (isAdminOrAgent) {
      setLoadingAssets(true);
      api.get<AssetListResponse>('/assets?limit=1000')
        .then(res => setAssets(res.data || res.assets || []))
        .catch(err => console.error('Failed to load assets', err))
        .finally(() => setLoadingAssets(false));
    }
  }, [isAdminOrAgent]);

  const currentStatus = statusOptions.find((s) => s.value === ticket.status);
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === ticket.priority);
  const currentType = TICKET_TYPE_OPTIONS.find((t) => t.value === ticket.ticket_type) || TICKET_TYPE_OPTIONS[0];

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Properties</h3>
        {ticket.sla_breached && (
          <span className="badge-sla-breached" style={{ fontSize: 10 }}>SLA BREACHED</span>
        )}
      </div>
      <div className="ticket-props-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>

        {/* ── Status & Priority ── */}
        <PropField label="Status">
          {isAdminOrAgent ? (
            <SelectSearch
              options={filteredStatuses}
              value={ticket.status}
              onChange={val => val && handleStatusChange(val)}
              placeholder="Change"
              hideClear
            />
          ) : (
            <span className={statusConfig[ticket.status]?.badgeClass || 'badge'}>{statusOptions.find((s) => s.value === ticket.status)?.label || ticket.status}</span>
          )}
        </PropField>

        <PropField label="Priority">
          {isAdminOrAgent ? (
            <SelectSearch
              options={PRIORITY_OPTIONS.map(p => ({ ...p, dotColor: p.color }))}
              value={ticket.priority}
              onChange={val => val && updateField('priority', val)}
              placeholder="Select priority"
              hideClear
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: currentPriority?.color }} />
              <span style={{ fontSize: 13 }}>{currentPriority?.label}</span>
            </div>
          )}
        </PropField>

        {/* SLA status row */}
        {ticket.sla_policy_id && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="sla-bar" style={{ flex: 1, height: 4 }}>
              <div
                className={`sla-bar-fill ${ticket.sla_breached ? 'sla-breached' : 'sla-ok'}`}
                style={{ width: ticket.sla_breached ? '100%' : '68%' }}
              />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: ticket.sla_breached ? 'var(--danger)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {ticket.sla_breached ? 'SLA Breached' : 'SLA On Track'}
            </span>
            {ticket.first_response_at && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                · First response: {formatDateTime(ticket.first_response_at)}
              </span>
            )}
          </div>
        )}

        <GroupDivider />

        {/* ── Assignment ── */}
        <PropField label="Assignee">
          {isAdminOrAgent ? (
            <div className="select-wrapper" style={{ width: '100%' }}>
              <UserSearchSelect
                users={allUsers.filter(u => u.role === 'admin' || u.role === 'agent')}
                value={ticket.assigned_to_id}
                onChange={handleAssignToUser}
                placeholder="Unassigned"
              />
            </div>
          ) : <span style={{ fontSize: 13 }}>{ticket.assigned_to_name || 'Unassigned'}</span>}
        </PropField>

        <PropField label="Reporter">
          {isAdminOrAgent ? (
            <div className="select-wrapper" style={{ width: '100%' }}>
              <UserSearchSelect
                users={allUsers}
                value={ticket.created_by_id}
                onChange={handleReporterChange}
                placeholder="Select reporter..."
                hideClear
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: `hsl(${( (ticket.created_by_name?.charCodeAt(0) ?? 0) * 37 || 200) % 360}, 55%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                {ticket.created_by_name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{ticket.created_by_name}</span>
            </div>
          )}
        </PropField>

        <GroupDivider />

        {/* ── Classification ── */}
        <PropField label="Type">
          {isAdminOrAgent ? (
            <SelectSearch
              options={TICKET_TYPE_OPTIONS}
              value={ticket.ticket_type}
              onChange={val => val && updateField('ticket_type', val)}
              placeholder="Select type"
              hideClear
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <currentType.icon size={14} color={currentType.color} />
              <span style={{ fontSize: 13 }}>{currentType.label}</span>
            </div>
          )}
        </PropField>

        <PropField label="Category">
          {isAdminOrAgent ? (
            <CategoryTreeSelect
              categories={categories}
              value={ticket.category_id || null}
              onChange={val => updateField('category_id', val)}
              placeholder="Select category"
              allowClear
            />
          ) : <span style={{ fontSize: 13 }}>{ticket.category_name || 'None'}</span>}
        </PropField>

        <GroupDivider />

        {/* ── Context ── */}
        <PropField label="Linked Asset">
          {isAdminOrAgent ? (
            <SelectSearch
              options={[
                { value: '', label: 'None' },
                ...assets.map(a => ({ value: a.id, label: a.name }))
              ]}
              value={ticket.asset_id || ''}
              onChange={val => updateField('asset_id', val || null)}
              placeholder={loadingAssets ? 'Loading...' : 'Select asset'}
              allowClear
              showSearch
            />
          ) : ticket.asset_id ? (
             <Link href={`/dashboard/assets/${ticket.asset_id}`} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
               {ticket.asset_name || 'View Asset'}
             </Link>
          ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>None</span>}
        </PropField>

        <PropField label="Due Date">
          {isAdminOrAgent ? (
            <div className="select-wrapper" style={{ width: '100%' }}>
              <DateTimePicker
                value={ticket.due_date ?? null}
                onChange={(val) => updateField('due_date', val)}
                placeholder="Not set"
              />
            </div>
          ) : (
            ticket.due_date ? (
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{formatDateTime(ticket.due_date)}</span>
            ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not set</span>
          )}
        </PropField>

        <GroupDivider />

        {/* ── Timestamps ── */}
        <PropField label="Created">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDateTime(ticket.created_at)}</span>
        </PropField>

        <PropField label="Updated">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDateTime(ticket.updated_at)}</span>
        </PropField>

        {ticket.location && (
          <>
            <GroupDivider />
            <div style={{ gridColumn: '1 / -1' }}>
              <PropField label="Location">
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ticket.location}</span>
              </PropField>
            </div>
          </>
        )}

      </div>
    </div>
  );
}