'use client';

import { CardSection, MiniTable } from './Charts';
import { InteractiveDonutChart, InteractiveBarChart, ScorecardWidget, GaugeChart } from './recharts';
import { Key, DollarSign, Percent, AlertTriangle, Shield, Ban, Layers } from 'lucide-react';

interface LicenseReportsProps {
  data: {
    total: number;
    by_compliance: Record<string, number>;
    total_cost: number;
    cost_per_seat_avg: number;
    total_seats: number;
    used_seats: number;
    utilization_rate: number;
    expiring_soon: number;
    over_allocated: number;
    by_publisher: { publisher: string; count: number; total_cost: number }[];
    by_type: Record<string, number>;
  } | null;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pinProps(key: string, label: string, isPinnedFn?: (k: string) => boolean, pinFn?: (k: string, l: string, t?: string) => void, unpinFn?: (k: string) => void, type: string = 'kpi') {
  return (isPinnedFn && pinFn && unpinFn) ? {
    metricKey: key, metricLabel: label,
    isPinned: isPinnedFn(key),
    onPin: () => pinFn(key, label, type),
    onUnpin: () => unpinFn(key),
  } : {};
}

const COMPLIANCE_COLORS: Record<string, string> = {
  compliant: 'var(--success)',
  warning: 'var(--warning)',
  non_compliant: 'var(--danger)',
  expired: '#991b1b',
};

export default function LicenseReports({ data, isMetricPinned, handlePin, handleUnpin }: LicenseReportsProps) {
  if (!data) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Key size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>License Data Not Available</div>
        <div style={{ fontSize: 13 }}>Ensure software license tracking is configured.</div>
      </div>
    );
  }

  const totalCompliance = Object.values(data.by_compliance).reduce((a, c) => a + c, 0);
  const complianceSegments = Object.entries(data.by_compliance).map(([key, value]) => ({
    name: key.replace(/_/g, ' '),
    value,
    color: COMPLIANCE_COLORS[key] || 'var(--text-muted)',
  }));

  const utilizationPct = Math.round(data.utilization_rate);
  const utilizationColor = utilizationPct >= 80 ? 'var(--danger)' : utilizationPct >= 60 ? 'var(--warning)' : 'var(--success)';

  const sortedPublishers = [...data.by_publisher].sort((a, b) => b.total_cost - a.total_cost).slice(0, 10);

  const typeEntries = Object.entries(data.by_type).sort((a, b) => b[1] - a[1]);

  // Calculate compliance rate percentage (ratio of compliant to total)
  const compliantCount = data.by_compliance.compliant || 0;
  const complianceRate = totalCompliance > 0 ? Math.round((compliantCount / totalCompliance) * 100) : 0;

  // Publisher bar chart data (by cost)
  const publisherBarData = sortedPublishers.map(p => ({
    name: p.publisher,
    value: p.count,
  }));

  // Type bar chart data
  const typeBarData = typeEntries.map(([type, count]) => ({
    name: type.replace(/_/g, ' '),
    value: count,
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Licenses"
          value={data.total}
          icon={Key}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{ value: data.total_seats, label: 'seats', isPositive: true }}
          {...pinProps('licenses_total', 'Total Licenses', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Total Cost"
          value={formatCurrency(data.total_cost)}
          icon={DollarSign}
          iconColor="var(--success)"
          iconBg="var(--success-bg)"
          accentColor="var(--success)"
          {...pinProps('licenses_total_cost', 'Total Cost', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Utilization"
          value={utilizationPct}
          unit="%"
          icon={Percent}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor={utilizationColor}
          {...pinProps('licenses_utilization', 'Utilization', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Expiring Soon"
          value={data.expiring_soon}
          icon={AlertTriangle}
          iconColor={data.expiring_soon > 0 ? 'var(--warning)' : 'var(--success)'}
          iconBg={data.expiring_soon > 0 ? 'var(--warning-bg)' : 'var(--success-bg)'}
          accentColor={data.expiring_soon > 0 ? 'var(--warning)' : 'var(--success)'}
          {...pinProps('licenses_expiring', 'Expiring Soon', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Over-allocated"
          value={data.over_allocated}
          icon={Ban}
          iconColor={data.over_allocated > 0 ? 'var(--danger)' : 'var(--success)'}
          iconBg={data.over_allocated > 0 ? 'var(--danger-bg)' : 'var(--success-bg)'}
          accentColor={data.over_allocated > 0 ? 'var(--danger)' : 'var(--success)'}
          {...pinProps('licenses_over_allocated', 'Over-allocated', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Compliance Status */}
        <CardSection title="Compliance Status" icon={Shield} {...pinProps('chart_license_compliance', 'License Compliance Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {complianceSegments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No compliance data available.</div>
          ) : (
            <InteractiveDonutChart
              data={complianceSegments}
              total={totalCompliance}
              totalLabel="licenses"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Compliance clicked:', seg)}
              exportFilename="licenses-compliance"
            />
          )}
        </CardSection>

        {/* Compliance Gauge */}
        <CardSection title="Compliance Rate" icon={Shield}>
          <GaugeChart
            value={complianceRate}
            target={100}
            label="Compliance Rate"
            unit="%"
            showExport={true}
            exportFilename="licenses-compliance-gauge"
            size={220}
            thresholds={{ danger: 60, warning: 85 }}
          />
        </CardSection>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* By Publisher */}
        <CardSection title="Top Publishers" icon={Layers} {...pinProps('chart_license_publisher', 'Top Publishers', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {publisherBarData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No publisher data available.</div>
          ) : (
            <InteractiveBarChart
              data={publisherBarData}
              layout="horizontal"
              height={Math.max(180, publisherBarData.length * 50)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Publisher clicked:', datum)}
              exportFilename="licenses-publishers"
            />
          )}
        </CardSection>

        {/* By Type */}
        <CardSection title="Licenses by Type" icon={Key}>
          {typeBarData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No type data available.</div>
          ) : (
            <InteractiveBarChart
              data={typeBarData}
              layout="horizontal"
              height={Math.max(180, typeBarData.length * 50)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Type clicked:', datum)}
              exportFilename="licenses-by-type"
            />
          )}
        </CardSection>
      </div>
    </div>
  );
}
