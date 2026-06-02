'use client';

import { CardSection, MiniTable, MiniBar, DonutChart } from './Charts';
import { Monitor, HardDrive, Wifi, Activity } from 'lucide-react';
import type { AssetStats } from '../types';

const ASSET_STATUS_COLORS: Record<string, string> = {
  active: 'var(--success)',
  maintenance: 'var(--warning)',
  retired: 'var(--text-muted)',
  disposed: 'var(--danger)',
  lost: 'var(--danger)',
};
const ASSET_TYPE_COLORS: Record<string, string> = {
  workstation: 'var(--info)',
  laptop: 'var(--accent)',
  server: '#7c3aed',
  network: '#f97316',
  printer: '#8b5cf6',
  mobile: 'var(--success)',
  peripheral: 'var(--text-muted)',
  other: 'var(--warning)',
};

export default function AssetReports({ stats }: { stats: AssetStats | null }) {
  if (!stats) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Asset data is not available. Ensure asset tracking is configured.
      </div>
    );
  }

  const maxStatusCount = Math.max(...stats.byStatus.map(s => s.count), 1);
  const typeTotal = stats.byType.reduce((a, s) => a + s.count, 0);
  const typeChartData = stats.byType.map(t => ({
    label: t.asset_type.replace(/_/g, ' '),
    value: t.count,
    color: ASSET_TYPE_COLORS[t.asset_type] || 'var(--accent)',
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Assets</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Monitor size={16} color="var(--accent)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {stats.byStatus.find(s => s.status === 'active')?.count || 0} active
          </div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Maintenance</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HardDrive size={16} color="var(--warning)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>
            {stats.byStatus.find(s => s.status === 'maintenance')?.count || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Under maintenance</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Status</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--info-bg)', border: '1px solid var(--info-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wifi size={16} color="var(--info)" />
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>
            {stats.agentStatus.map(a => `${a.agent_status}: ${a.count}`).join(', ') || 'No agents deployed'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Agent deployment status</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asset Types</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} color="var(--text-muted)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{stats.byType.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Distinct asset types</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Status distribution */}
        <CardSection title="Asset Status Distribution" icon={HardDrive}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.byStatus.map(s => (
              <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: ASSET_STATUS_COLORS[s.status] || 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)', textTransform: 'capitalize' }}>{s.status}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.count}</span>
                <MiniBar value={s.count} max={maxStatusCount} color={ASSET_STATUS_COLORS[s.status] || 'var(--text-muted)'} />
              </div>
            ))}
          </div>
        </CardSection>

        {/* Type distribution */}
        <CardSection title="Asset Type Breakdown" icon={Monitor}>
          {typeChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No assets registered.</div>
          ) : (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <DonutChart segments={typeChartData} total={typeTotal} size={100} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {typeChartData.map(t => (
                  <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', textTransform: 'capitalize' }}>{t.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t.value}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>{typeTotal ? Math.round(t.value/typeTotal*100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardSection>
      </div>

      {/* Recent asset activity */}
      {stats.recentActivity.length > 0 && (
        <CardSection title="Recent Asset Activity" icon={Activity}>
          <MiniTable
            headers={['Action', 'Description', 'Date']}
            rows={stats.recentActivity.slice(0, 10).map(a => [
              <span key="act" style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: 12 }}>{a.action.replace(/_/g, ' ')}</span>,
              <span key="desc" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.description}</span>,
              <span key="date" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleDateString()}</span>,
            ])}
          />
        </CardSection>
      )}
    </div>
  );
}
