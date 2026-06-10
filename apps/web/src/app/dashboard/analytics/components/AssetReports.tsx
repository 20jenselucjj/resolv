'use client';

import { CardSection, MiniTable } from './Charts';
import { InteractiveDonutChart, InteractiveBarChart, ScorecardWidget } from './recharts';
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

function pinProps(key: string, label: string, isPinnedFn?: (k: string) => boolean, pinFn?: (k: string, l: string, t?: string) => void, unpinFn?: (k: string) => void, type: string = 'kpi') {
  return (isPinnedFn && pinFn && unpinFn) ? {
    metricKey: key, metricLabel: label,
    isPinned: isPinnedFn(key),
    onPin: () => pinFn(key, label, type),
    onUnpin: () => unpinFn(key),
  } : {};
}

export default function AssetReports({ stats, isMetricPinned, handlePin, handleUnpin }: { stats: AssetStats | null; isMetricPinned?: (key: string) => boolean; handlePin?: (key: string, label: string, type?: string, config?: any) => void; handleUnpin?: (key: string) => void; }) {
  if (!stats) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Asset data is not available. Ensure asset tracking is configured.
      </div>
    );
  }

  const typeTotal = stats.byType.reduce((a, s) => a + s.count, 0);
  const typeChartData = stats.byType.map(t => ({
    name: t.asset_type.replace(/_/g, ' '),
    value: t.count,
    color: ASSET_TYPE_COLORS[t.asset_type] || 'var(--accent)',
  }));

  const statusBarData = stats.byStatus.map(s => ({
    name: s.status,
    value: s.count,
    color: ASSET_STATUS_COLORS[s.status] || 'var(--text-muted)',
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Assets"
          value={stats.total}
          icon={Monitor}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{ value: stats.byStatus.find(s => s.status === 'active')?.count || 0, label: 'active', isPositive: true }}
          {...pinProps('assets_total', 'Total Assets', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="In Maintenance"
          value={stats.byStatus.find(s => s.status === 'maintenance')?.count || 0}
          icon={HardDrive}
          iconColor="var(--warning)"
          iconBg="var(--warning-bg)"
          accentColor="var(--warning)"
          {...pinProps('assets_maintenance', 'In Maintenance', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Agent Status"
          value={stats.agentStatus.length > 0 ? stats.agentStatus[0].count : 0}
          icon={Wifi}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('assets_agent_status', 'Agent Status', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Asset Types"
          value={stats.byType.length}
          icon={Activity}
          iconColor="var(--text-muted)"
          iconBg="var(--bg-tertiary)"
          accentColor="var(--border)"
          {...pinProps('assets_types', 'Asset Types', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Status distribution */}
        <CardSection title="Asset Status Distribution" icon={HardDrive} {...pinProps('chart_asset_status', 'Asset Status Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <InteractiveBarChart
            data={statusBarData}
            layout="horizontal"
            height={Math.max(180, statusBarData.length * 50)}
            showExport={true}
            showGrid={false}
            onBarClick={(datum) => console.log('Asset status clicked:', datum)}
            exportFilename="assets-status-distribution"
          />
        </CardSection>

        {/* Type distribution */}
        <CardSection title="Asset Type Breakdown" icon={Monitor} {...pinProps('chart_asset_type', 'Asset Type Breakdown', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {typeChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No assets registered.</div>
          ) : (
            <InteractiveDonutChart
              data={typeChartData}
              total={typeTotal}
              totalLabel="assets"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Asset type clicked:', seg)}
              exportFilename="assets-type-breakdown"
            />
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
