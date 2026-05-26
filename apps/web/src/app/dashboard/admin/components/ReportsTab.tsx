'use client';

import { useEffect, useState } from 'react';
import { FileText, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from './SharedUI';
import type { AdminStats } from './types';

export function ReportsTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    setLoading(true);
    api.get<{ data: AdminStats }>('/admin/stats')
      .then(res => setStats(res.data))
      .catch(() => showAlert('Failed to load reports', 'error'))
      .finally(() => setLoading(false));
  }, [dateRange, showAlert]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports...</div>;

  const byStatus = stats?.tickets?.by_status || {};
  const byPriority = stats?.tickets?.by_priority || {};
  const totalTickets = stats?.tickets?.total || 0;
  const avgResolution = stats?.tickets?.avg_resolution_hours || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Date Range Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Reports & Analytics</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Ticket volume, resolution metrics, and team performance</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['7d', '30d', '90d', 'all'].map(r => (
            <button key={r} onClick={() => setDateRange(r)}
              className={dateRange === r ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: 12, padding: '6px 12px' }}>
              {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : r === '90d' ? 'Last 90 days' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Total Tickets" value={totalTickets} icon={<FileText size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Avg Resolution" value={`${avgResolution.toFixed(1)}h`} icon={<Clock size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
        <StatCard label="SLA Breached" value={stats?.sla?.breached_count || 0} icon={<AlertTriangle size={16} />} color="var(--critical)" bg="var(--critical-bg)" />
        <StatCard label="At Risk" value={stats?.sla?.at_risk_count || 0} icon={<AlertCircle size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
      </div>

      {/* Tickets by Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Tickets by Status</h4>
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
            {Object.keys(byStatus).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data available</div>}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Tickets by Priority</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byPriority).map(([priority, count]) => {
              const pct = totalTickets > 0 ? Math.round((count as number / totalTickets) * 100) : 0;
              const colors: Record<string, string> = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--danger)', critical: 'var(--critical)' };
              return (
                <div key={priority}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>{priority}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count as number} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[priority] || 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(byPriority).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data available</div>}
          </div>
        </div>
      </div>

      {/* Team Summary */}
      <div className="card" style={{ padding: 24 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Team Summary</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {Object.entries(stats?.users?.by_role || {}).map(([role, count]) => (
            <div key={role} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{count as number}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 4 }}>{role}s</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => showAlert('Export feature coming soon', 'success')}>
          <FileText size={14} /> Export Report (CSV)
        </button>
      </div>
    </div>
  );
}
