'use client';

import { useState } from 'react';
import { Ticket, User } from '@/lib/store';
import { formatDateTime } from '@/lib/date-utils';
import { SelectSearch } from '@/components/SelectSearch';
import { UserSearchSelect } from '@/components/UserSearchSelect';
import { DateTimePicker } from '@/components/DateTimePicker';
import { PropField } from './PropField';
import { STATUS_OPTIONS, PRIORITY_OPTIONS, TICKET_TYPE_OPTIONS, CATEGORY_DOT_COLORS, statusBadgeClass } from './constants';

interface PropertiesCardProps {
  ticket: Ticket;
  categories: { id: string; name: string }[];
  allUsers: User[];
  isAdminOrAgent: boolean;
  updateField: (field: string, value: string | number | boolean | null) => Promise<void>;
  handleStatusChange: (status: string) => void;
  handleAssignToUser: (userId: string | null) => Promise<void>;
  handleReporterChange: (userId: string | null) => Promise<void>;
}

export function PropertiesCard({ ticket, categories, allUsers, isAdminOrAgent, updateField, handleStatusChange, handleAssignToUser, handleReporterChange }: PropertiesCardProps) {
  const currentStatus = statusBadgeClass[ticket.status] ? undefined : undefined;
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === ticket.priority);
  const currentType = TICKET_TYPE_OPTIONS.find((t) => t.value === ticket.ticket_type) || TICKET_TYPE_OPTIONS[0];

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0' }}>Properties</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 16px' }}>
        <PropField label="Status">
          {isAdminOrAgent ? (
            <SelectSearch
              options={STATUS_OPTIONS}
              value={ticket.status}
              onChange={val => val && handleStatusChange(val)}
              placeholder="Change"
              hideClear
            />
          ) : (
            <span className={statusBadgeClass[ticket.status] || 'badge'}>{STATUS_OPTIONS.find((s) => s.value === ticket.status)?.label || ticket.status}</span>
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

        <PropField label="Category">
          {isAdminOrAgent ? (
            <SelectSearch
              options={[
                { value: '', label: 'Uncategorized', dotColor: 'var(--text-muted)' },
                ...categories.map((c, i) => ({
                  value: c.id,
                  label: c.name,
                  dotColor: CATEGORY_DOT_COLORS[i % CATEGORY_DOT_COLORS.length],
                }))
              ]}
              value={ticket.category_id || ''}
              onChange={val => updateField('category_id', val || null)}
              placeholder="Select category"
              allowClear
            />
          ) : <span style={{ fontSize: 13 }}>{ticket.category_name || 'None'}</span>}
        </PropField>

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

        <PropField label="Created Date">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDateTime(ticket.created_at)}</span>
        </PropField>
      </div>
    </div>
  );
}