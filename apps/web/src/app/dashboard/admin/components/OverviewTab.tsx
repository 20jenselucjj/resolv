'use client';

import { Activity, FileText, Plus, CheckCircle, AlertTriangle, AlertCircle, Users, Circle, Clock } from 'lucide-react';
import { StatCard } from './SharedUI';
import type { AdminStats, AuditEntry } from './types';

function getAuditDescription(entry: AuditEntry): string {
  const entity = entry.entity_type?.replace(/_/g, ' ') || '';
  const newData = entry.new_data || {};

  switch (entry.action) {
    case 'update_user': {
      if (newData.name) return `Name → "${newData.name}"`;
      if (newData.role) return `Role → ${newData.role}`;
      if (newData.is_active !== undefined) return newData.is_active ? 'Account activated' : 'Account deactivated';
      if (newData.department) return `Dept → "${newData.department}"`;
      return 'User updated';
    }
    case 'invite_user': return newData.email ? `Invited ${newData.email}` : 'User invited';
    case 'update_setting': return String(newData.key || '') ? `"${String(newData.key).replace(/_/g, ' ')}" changed` : 'Setting changed';
    case 'create_automation_rule': return newData.name ? `Rule "${newData.name}"` : 'Automation rule';
    case 'create_holiday': return newData.name ? `Holiday "${newData.name}"` : 'Holiday added';
    case 'create_workflow': return newData.name ? `Workflow "${newData.name}"` : 'Workflow created';
    case 'update_roles': return 'Permissions updated';
    case 'update_maintenance': return newData.enabled ? 'Maintenance ON' : 'Maintenance OFF';
    case 'update_knowledge_article': return newData.title ? `"${newData.title}"` : 'KB updated';
    case 'kb_sync': return 'KB synced to AI';
    case 'ticket_sync': return 'Tickets synced to AI';
    case 'login': return 'Signed in';
    case 'logout': return 'Signed out';
    default:
      if (entity) return `${entry.action.replace(/_/g, ' ')} ${entity}`;
      return entry.action.replace(/_/g, ' ');
  }
}

export function OverviewTab({ stats, auditLog }: { stats: AdminStats | null; auditLog: AuditEntry[] }) {
  const byStatus = stats?.tickets?.by_status || {};
  const totalTickets = stats?.tickets?.total || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Tickets" value={stats?.tickets?.total || 0} icon={<FileText size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Open" value={stats?.tickets?.by_status?.open || 0} icon={<Circle size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
        <StatCard label="Created Today" value={stats?.tickets?.created_today || 0} icon={<Plus size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Closed Today" value={stats?.tickets?.resolved_today || 0} icon={<CheckCircle size={16} />} color="var(--success)" bg="var(--success-bg)" />
        <StatCard label="SLA Breached" value={stats?.sla?.breached_count || 0} icon={<AlertTriangle size={16} />} color="var(--critical)" bg="var(--critical-bg)" />
        <StatCard label="SLA At Risk" value={stats?.sla?.at_risk_count || 0} icon={<AlertCircle size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
        <StatCard label="Total Users" value={stats?.users?.total || 0} icon={<Users size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Active Agents" value={stats?.users?.by_role?.agent || 0} icon={<Activity size={16} />} color="var(--success)" bg="var(--success-bg)" />
      </div>

      {/* Ticket Status Breakdown */}
      {totalTickets > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Ticket Status Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byStatus).map(([status, count]) => {
              const pct = totalTickets > 0 ? Math.round((count as number / totalTickets) * 100) : 0;
              const colors: Record<string, string> = { open: 'var(--warning)', in_progress: 'var(--accent)', closed: 'var(--success)' };
              return (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>{status.replace('_', ' ')}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count as number} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[status] || 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Avg Resolution Time */}
      {(stats?.tickets?.avg_resolution_hours || 0) > 0 && (
        <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={22} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Average Resolution Time</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{(stats?.tickets?.avg_resolution_hours || 0).toFixed(1)}h</div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <Activity size={15} color="var(--accent)" />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Recent Activity</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Actor</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Entity</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.slice(0, 8).map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{entry.actor_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{getAuditDescription(entry)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>{entry.entity_type?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(entry.timestamp || entry.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {auditLog.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No recent activity found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
