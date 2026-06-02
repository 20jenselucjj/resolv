'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Filter, Calendar, Search, X, Info } from 'lucide-react';
import { Badge } from './SharedUI';
import type { AuditEntry } from './types';

function getAuditDescription(entry: AuditEntry): string {
  const entity = entry.entity_type?.replace(/_/g, ' ') || '';
  const newData = entry.new_data || {};
  const oldData = entry.old_data || {};

  switch (entry.action) {
    case 'update_user': {
      if (newData.name) return `Name → "${newData.name}"`;
      if (newData.role) return `Role → ${newData.role}`;
      if (newData.is_active !== undefined) return newData.is_active ? 'Account activated' : 'Account deactivated';
      if (newData.department) return `Department → "${newData.department}"`;
      if (newData.email) return `Email → ${newData.email}`;
      return 'User details updated';
    }
    case 'invite_user':
      return newData.email ? `Invite sent to ${newData.email}` : 'User invited';
    case 'update_setting': {
      const key = String(newData.key || oldData.key || '');
      if (key) return `"${key.replace(/_/g, ' ')}" updated`;
      return 'System setting changed';
    }
    case 'create_automation_rule':
      return newData.name ? `Rule "${newData.name}" created` : 'Automation rule created';
    case 'update_roles':
      return 'Role permissions updated';
    case 'update_knowledge_article':
      return newData.title ? `"${newData.title}" updated` : 'KB article updated';
    case 'update_rag_config':
      return 'AI configuration updated';
    case 'create_knowledge_source':
      return newData.name ? `Source "${newData.name}" added` : 'Knowledge source created';
    case 'update_knowledge_source':
      return newData.name ? `Source "${newData.name}" updated` : 'Knowledge source updated';
    case 'delete_knowledge_source':
      return newData.name ? `Source "${newData.name}" deleted` : 'Knowledge source deleted';
    case 'kb_sync':
      return 'KB synced to AI training';
    case 'ticket_sync':
      return 'Tickets synced to AI training';
    case 'update_notification_settings':
      return 'Notification settings changed';
    case 'create_workflow':
      return newData.name ? `Workflow "${newData.name}" created` : 'Workflow created';
    case 'create_holiday':
      return newData.name ? `Holiday "${newData.name}" (${newData.date || ''})` : 'Holiday created';
    case 'update_maintenance':
      return newData.enabled ? 'Maintenance mode ON' : 'Maintenance mode OFF';
    case 'login':
      return 'Signed in';
    case 'logout':
      return 'Signed out';
    default:
      if (entity) {
        const action = entry.action.replace(/_/g, ' ');
        return `${action} ${entity}`;
      }
      return entry.action.replace(/_/g, ' ');
  }
}

const DATE_OPTIONS = [
  { label: 'All Time', value: '' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
];

interface AuditLogTabProps {
  auditLog: AuditEntry[];
  page: number;
  setPage: (p: number) => void;
  totalPages?: number;
  total?: number;
  filterAction: string;
  setFilterAction: (a: string) => void;
  filterUser: string;
  setFilterUser: (u: string) => void;
  filterEntityType: string;
  setFilterEntityType: (t: string) => void;
  filterSearch: string;
  setFilterSearch: (s: string) => void;
  dateRange: string;
  setDateRange: (d: string) => void;
  entityTypes: string[];
}

export function AuditLogTab(props: AuditLogTabProps) {
  const {
    auditLog, page, setPage, totalPages = 0, total = 0,
    filterAction, setFilterAction, filterUser, setFilterUser,
    filterEntityType, setFilterEntityType, filterSearch, setFilterSearch,
    dateRange, setDateRange, entityTypes,
  } = props;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateLabel, setDateLabel] = useState(dateRange ? DATE_OPTIONS.find(d => d.value === dateRange)?.label || 'Custom' : 'All Time');

  const exportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Details'];
    const rows = auditLog.map(e => [
      new Date(e.timestamp || e.created_at).toLocaleString(),
      e.actor_name, e.action, e.entity_type, getAuditDescription(e)
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const actionMap: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    login: 'Login',
    logout: 'Logout',
    update_setting: 'Setting Changed',
    create_automation_rule: 'Automation Rule',
    update_roles: 'Roles Updated',
    update_user: 'User Updated',
    invite_user: 'User Invited',
    update_knowledge_article: 'KB Article Updated',
    update_rag_config: 'RAG Config',
    create_knowledge_source: 'Knowledge Source',
    kb_sync: 'KB Sync',
    ticket_sync: 'Ticket Sync',
    update_notification_settings: 'Notifications Updated',
    create_workflow: 'Workflow Created',
    create_holiday: 'Holiday Created',
    update_maintenance: 'Maintenance Mode',
    update_knowledge_source: 'Knowledge Source',
    delete_knowledge_source: 'Knowledge Source',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-ghost" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={exportCSV}>
            <FileText size={14} /> Export CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search logs..."
              className="input"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: filterSearch ? 28 : 8, height: 34, fontSize: 12, width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
            />
            {filterSearch && (
              <button onClick={() => setFilterSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Action filter */}
          <select className="select" style={{ border: '1px solid var(--border)', height: 34, fontSize: 12, padding: '0 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }} value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
          </select>

          {/* Entity Type filter */}
          <select className="select" style={{ border: '1px solid var(--border)', height: 34, fontSize: 12, padding: '0 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }} value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
            <option value="">All Entities</option>
            {entityTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {/* User filter */}
          <input type="text" placeholder="Filter by user..." className="input" style={{ border: '1px solid var(--border)', height: 34, fontSize: 12, padding: '0 8px', width: 140, borderRadius: 'var(--radius-md)' }} value={filterUser} onChange={(e) => setFilterUser(e.target.value)} />

          {/* Date filter */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" style={{ padding: '0 10px', height: 34, fontSize: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setShowDatePicker(!showDatePicker)}>
              <Calendar size={13} /> {dateLabel}
            </button>
            {showDatePicker && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 150 }}>
                {DATE_OPTIONS.map(opt => (
                  <button key={opt.value} className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    onClick={() => { setDateLabel(opt.label); setDateRange(opt.value); setShowDatePicker(false); }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Actor</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Entity Type</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(entry.timestamp || entry.created_at).toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 500 }}>{entry.actor_name || 'System'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px' }}>
                    <Badge variant="default">{actionMap[entry.action] || entry.action.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{entry.entity_type?.replace(/_/g, ' ') || '-'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getAuditDescription(entry)}</td>
                </tr>
              ))}
              {auditLog.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found matching your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} total entries</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ border: '1px solid var(--border)' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            Page {page} of {totalPages || 1}
          </span>
          <button className="btn btn-ghost" onClick={() => setPage(page + 1)} disabled={page >= totalPages} style={{ border: '1px solid var(--border)' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
