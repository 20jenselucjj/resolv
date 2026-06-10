'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Monitor, DollarSign, HardDrive, AlertTriangle,
  Shield, Key, Percent, Ban, Layers, Calendar, Clock,
  TrendingUp, Building2, RefreshCw, Grid,
} from 'lucide-react';
import { CardSection, MiniTable } from '../components/Charts';
import { EmptyState } from '../components/shared';
import {
  InteractiveDonutChart, InteractiveBarChart, ScorecardWidget, GaugeChart,
} from '../components/recharts';
import type { AssetStats, LicenseReportData } from '../types';

// ── Color Constants ──────────────────────────────────────────────────────────

const ASSET_STATUS_COLORS: Record<string, string> = {
  active: '#16A34A',
  in_repair: '#F59E0B',
  retired: '#6B7280',
  in_storage: '#8B5CF6',
  maintenance: '#F59E0B',
  disposed: '#EF4444',
  lost: '#DC2626',
};

const LICENSE_COMPLIANCE_COLORS: Record<string, string> = {
  compliant: '#16A34A',
  over_allocated: '#EF4444',
  under_utilized: '#F59E0B',
  expiring: '#DC2626',
  warning: '#F59E0B',
  non_compliant: '#EF4444',
  expired: '#991b1b',
};

const LICENSE_TYPE_COLORS: Record<string, string> = {
  perpetual: '#16A34A',
  subscription: '#3B82F6',
  freemium: '#8B5CF6',
  trial: '#F59E0B',
};

const WARRANTY_STATUS_COLORS: Record<string, string> = {
  green: '#16A34A',
  yellow: '#F59E0B',
  red: '#EF4444',
  expired: '#EF4444',
};

const ASSET_TYPE_ICON_COLORS: Record<string, string> = {
  laptop: '#3B82F6',
  desktop: '#6366F1',
  server: '#7C3AED',
  network: '#F97316',
  mobile: '#16A34A',
  printer: '#8B5CF6',
  other: '#6B7280',
};

// ── Real Data Types (from API) ──────────────────────────────────────────────

interface AssetDetail {
  id: string;
  name: string;
  asset_type: string;
  department: string | null;
  purchase_cost: number | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  status: string;
  assigned_to_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
}

interface LicenseDetail {
  id: string;
  name: string;
  publisher: string | null;
  license_type: string;
  total_seats: number;
  used_seats: number;
  cost_per_seat: number | null;
  total_cost: number | null;
  expiry_date: string | null;
  compliance_status: string;
}

interface PublisherCost {
  publisher: string;
  totalCost: number;
  count: number;
}

// ── Utility Functions ────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function daysRemaining(dateStr: string): number {
  const now = new Date();
  const end = new Date(dateStr);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function pinProps(
  key: string, label: string,
  isPinnedFn?: (k: string) => boolean,
  pinFn?: (k: string, l: string, t?: string) => void,
  unpinFn?: (k: string) => void,
  type: string = 'kpi',
) {
  return (isPinnedFn && pinFn && unpinFn) ? {
    metricKey: key, metricLabel: label,
    isPinned: isPinnedFn(key),
    onPin: () => pinFn(key, label, type),
    onUnpin: () => unpinFn(key),
  } : {};
}

function getWarrantyStatus(days: number): { label: string; color: string } {
  if (days < 0) return { label: 'Expired', color: WARRANTY_STATUS_COLORS.expired };
  if (days <= 30) return { label: 'Critical', color: WARRANTY_STATUS_COLORS.red };
  if (days <= 90) return { label: 'Warning', color: WARRANTY_STATUS_COLORS.yellow };
  return { label: 'Healthy', color: WARRANTY_STATUS_COLORS.green };
}

function getUtilizationStatus(pct: number): { label: string; color: string } {
  if (pct > 100) return { label: 'Over-Allocated', color: LICENSE_COMPLIANCE_COLORS.over_allocated };
  if (pct < 50) return { label: 'Under-Utilized', color: LICENSE_COMPLIANCE_COLORS.under_utilized };
  if (pct < 70) return { label: 'Low', color: LICENSE_COMPLIANCE_COLORS.warning };
  return { label: 'Optimal', color: LICENSE_COMPLIANCE_COLORS.compliant };
}

// ── Type for sortable table columns ──────────────────────────────────────────

type SortDir = 'asc' | 'desc';

function useSortable<T>(items: T[], defaultKey: keyof T, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    const sortedList = [...items].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal);
      }
      return (aVal as number) - (bVal as number);
    });
    return sortDir === 'desc' ? sortedList.reverse() : sortedList;
  }, [items, sortKey, sortDir]);

  const toggleSort = useCallback((key: keyof T) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  return { sorted, sortKey, sortDir, toggleSort };
}

function SortHeader({
  label, sortKey, currentKey, currentDir, onToggle,
}: {
  label: string; sortKey: string; currentKey: string; currentDir: SortDir; onToggle: (k: any) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <th
      onClick={() => onToggle(sortKey)}
      style={{
        textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11,
        textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)',
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      {label}
      {isActive && <span style={{ marginLeft: 4, fontSize: 10 }}>{currentDir === 'asc' ? '▲' : '▼'}</span>}
      {!isActive && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.3 }}>▲</span>}
    </th>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Assets Sub-Tab ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function AssetsContent({
  stats,
  assetDetails = [],
  assetDetailsLoading = false,
  isMetricPinned,
  handlePin,
  handleUnpin,
  onExportCSV,
  isAdminOrAgent,
}: {
  stats: AssetStats | null;
  assetDetails: AssetDetail[];
  assetDetailsLoading?: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
  onExportCSV: (section: string) => void;
  isAdminOrAgent: boolean;
}) {
  // ── Derived / computed data ────────────────────────────────────────────────

  const assetTypeData = useMemo(() => {
    if (!stats) return [];
    return stats.byType.map(t => ({
      name: t.asset_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: t.count,
      color: ASSET_TYPE_ICON_COLORS[t.asset_type] || '#6B7280',
    }));
  }, [stats]);

  const assetStatusData = useMemo(() => {
    if (!stats) return [];
    const statusMap: Record<string, string> = {
      active: 'Active', in_repair: 'In Repair', maintenance: 'In Repair',
      retired: 'Retired', in_storage: 'In Storage', disposed: 'Disposed',
      lost: 'Lost',
    };
    return stats.byStatus.map(s => ({
      name: statusMap[s.status] || s.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: s.count,
      color: ASSET_STATUS_COLORS[s.status] || '#6B7280',
    }));
  }, [stats]);

  const assetAgeData = useMemo(() => {
    const now = Date.now();
    const bins = [
      { name: '0-1 yr', min: 0, max: 1 },
      { name: '1-2 yr', min: 1, max: 2 },
      { name: '2-3 yr', min: 2, max: 3 },
      { name: '3-4 yr', min: 3, max: 4 },
      { name: '4-5 yr', min: 4, max: 5 },
      { name: '5+ yr', min: 5, max: Infinity },
    ];
    return bins.map(b => ({
      name: b.name,
      value: assetDetails.filter(a => {
        if (!a.purchase_date) return false;
        const ageYears = (now - new Date(a.purchase_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return ageYears >= b.min && ageYears < b.max;
      }).length,
      color: b.max === Infinity ? '#EF4444' : '#3B82F6',
    }));
  }, [assetDetails]);

  const assetDeptData = useMemo(() => {
    const deptCounts: Record<string, number> = {};
    assetDetails.forEach(a => {
      const dept = a.department || 'Unassigned';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });
    return Object.entries(deptCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value, color: '#6366F1' }));
  }, [assetDetails]);

  // Warranty expiry data
  const warrantyData = useMemo(() => {
    return assetDetails
      .filter(a => a.warranty_expiry)
      .map(a => ({ ...a, days: daysRemaining(a.warranty_expiry!) }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 20);
  }, [assetDetails]);

  // Asset category cost data
  const categoryCostData = useMemo(() => {
    const catMap: Record<string, { count: number; totalCost: number }> = {};
    assetDetails.forEach(a => {
      const type = a.asset_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (!catMap[type]) catMap[type] = { count: 0, totalCost: 0 };
      catMap[type].count++;
      catMap[type].totalCost += (a.purchase_cost || 0);
    });
    return Object.entries(catMap)
      .map(([category, data]) => ({
        category,
        count: data.count,
        totalCost: data.totalCost,
        avgCost: data.totalCost / data.count,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [assetDetails]);

  // Calculated KPIs
  const activeAssets = useMemo(
    () => stats?.byStatus.find(s => s.status === 'active')?.count || 0,
    [stats],
  );

  const retired30d = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return assetDetails.filter(a => a.status === 'retired').length;
  }, [assetDetails]);

  const totalAssetValue = useMemo(
    () => assetDetails.reduce((sum, a) => sum + (a.purchase_cost || 0), 0),
    [assetDetails],
  );

  const needingAttention = useMemo(
    () => assetDetails.filter(a => {
      if (!a.warranty_expiry || a.status !== 'active') return false;
      const days = daysRemaining(a.warranty_expiry);
      return days < 90;
    }).length,
    [assetDetails],
  );

  if (!stats) {
    return (
      <EmptyState
        icon={<Monitor size={32} />}
        title="Asset Data Not Available"
        description="Ensure asset tracking is configured and assets are registered."
        size="md"
      />
    );
  }

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI Row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
      }}>
        <ScorecardWidget
          label="Total Assets"
          value={stats.total}
          icon={Monitor}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{ value: Math.round((activeAssets / stats.total) * 100), label: 'active', isPositive: true }}
          {...pinProps('assets_total', 'Total Assets', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Active Assets"
          value={activeAssets}
          icon={TrendingUp}
          iconColor="#16A34A"
          iconBg="#16A34A20"
          accentColor="#16A34A"
          change={{ value: Math.round((activeAssets / Math.max(stats.total, 1)) * 100), label: 'of total', isPositive: true }}
          {...pinProps('assets_active', 'Active Assets', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Retired (30d)"
          value={retired30d}
          icon={RefreshCw}
          iconColor="#6B7280"
          iconBg="#6B728020"
          accentColor="#6B7280"
          change={{ value: Math.round((retired30d / Math.max(stats.total, 1)) * 100), label: 'churn rate', isPositive: false }}
          {...pinProps('assets_retired', 'Retired (30d)', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Total Asset Value"
          value={formatCurrency(totalAssetValue)}
          icon={DollarSign}
          iconColor="#16A34A"
          iconBg="#16A34A20"
          accentColor="#16A34A"
          change={{ value: Math.round(totalAssetValue / Math.max(assetDetails.length, 1)), label: 'avg per asset', isPositive: true }}
          {...pinProps('assets_value', 'Total Asset Value', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Need Attention"
          value={needingAttention}
          icon={AlertTriangle}
          iconColor={needingAttention > 0 ? '#F59E0B' : '#16A34A'}
          iconBg={needingAttention > 0 ? '#F59E0B20' : '#16A34A20'}
          accentColor={needingAttention > 0 ? '#F59E0B' : '#16A34A'}
          {...pinProps('assets_attention', 'Needing Attention', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* ── Charts Row 1: Type Donut + Status Bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 20,
      }}>
        <CardSection title="Assets by Type" icon={Grid} {...pinProps('chart_assets_by_type', 'Assets by Type', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {assetTypeData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Grid size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No asset type data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveDonutChart
              data={assetTypeData}
              total={stats.total}
              totalLabel="assets"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Asset type clicked:', seg)}
              exportFilename="assets-by-type"
            />
          )}
        </CardSection>

        <CardSection title="Assets by Status" icon={HardDrive} {...pinProps('chart_assets_by_status', 'Assets by Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {assetStatusData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <HardDrive size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No asset status data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={assetStatusData}
              layout="horizontal"
              height={Math.max(200, assetStatusData.length * 50)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Asset status clicked:', datum)}
              exportFilename="assets-by-status"
            />
          )}
        </CardSection>
      </div>

      {/* ── Charts Row 2: Age Histogram + Department Bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 20,
      }}>
        <CardSection title="Asset Age Distribution" icon={Clock} {...pinProps('chart_asset_age', 'Asset Age Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <InteractiveBarChart
            data={assetAgeData}
            layout="vertical"
            color="#3B82F6"
            height={240}
            showExport={true}
            showGrid={false}
            onBarClick={(datum) => console.log('Age bin clicked:', datum)}
            exportFilename="asset-age-distribution"
          />
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Highlights aging infrastructure — assets 4+ years may need refresh
          </div>
        </CardSection>

        <CardSection title="Assets by Department" icon={Building2} {...pinProps('chart_assets_by_dept', 'Assets by Department', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <InteractiveBarChart
            data={assetDeptData}
            layout="horizontal"
            height={Math.max(200, assetDeptData.length * 42)}
            showExport={true}
            showGrid={false}
            onBarClick={(datum) => console.log('Department clicked:', datum)}
            exportFilename="assets-by-department"
          />
        </CardSection>
      </div>

      {/* ── Warranty / Contract Expiry Table ── */}
      <CardSection title="Warranty & Contract Expiry" icon={Calendar} {...pinProps('table_warranty', 'Warranty & Contract Expiry', isMetricPinned, handlePin, handleUnpin, 'table')}>
        <MiniTable
          headers={['Asset Tag', 'Asset Type', 'Department', 'Warranty End', 'Days Remaining', 'Status']}
          rows={warrantyData.map(a => {
            const ws = getWarrantyStatus(a.days);
            const assetTypeDisplay = a.asset_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return [
              <span key="tag" style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>{a.name || a.id.slice(0, 8)}</span>,
              <span key="type" style={{ fontSize: 12 }}>{assetTypeDisplay}</span>,
              <span key="dept" style={{ fontSize: 12 }}>{a.department || '—'}</span>,
              <span key="end" style={{ fontSize: 12 }}>{a.warranty_expiry ? new Date(a.warranty_expiry).toLocaleDateString() : '—'}</span>,
              <span key="days" style={{
                fontSize: 12, fontWeight: 600,
                color: a.days < 0 ? WARRANTY_STATUS_COLORS.expired : WARRANTY_STATUS_COLORS.red,
              }}>{a.days < 0 ? 'Expired' : `${a.days}d`}</span>,
              <span key="status" style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                color: ws.color,
                background: `${ws.color}18`,
                padding: '2px 8px', borderRadius: 4,
              }}>{ws.label}</span>,
            ];
          })}
          emptyMessage="No warranty data available."
        />
      </CardSection>

      {/* ── Top Asset Categories by Cost ── */}
      <CardSection title="Top Asset Categories by Cost" icon={DollarSign} {...pinProps('table_asset_cost', 'Top Asset Categories by Cost', isMetricPinned, handlePin, handleUnpin, 'table')}>
        <MiniTable
          headers={['Category', 'Asset Count', 'Total Cost', 'Avg Cost per Asset']}
          rows={categoryCostData.slice(0, 10).map(c => [
            <span key="cat" style={{ fontWeight: 600, fontSize: 12 }}>{c.category}</span>,
            <span key="cnt" style={{ fontSize: 12 }}>{c.count}</span>,
            <span key="tc" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{formatCurrency(c.totalCost)}</span>,
            <span key="ac" style={{ fontSize: 12 }}>{formatCurrency(c.avgCost)}</span>,
          ])}
          emptyMessage="No cost data available."
        />
      </CardSection>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Licenses Sub-Tab ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function LicensesContent({
  data,
  licenseDetailRecords = [],
  isMetricPinned,
  handlePin,
  handleUnpin,
  onExportCSV,
  isAdminOrAgent,
}: {
  data: LicenseReportData | null;
  licenseDetailRecords: LicenseDetail[];
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
  onExportCSV: (section: string) => void;
  isAdminOrAgent: boolean;
}) {
  // ── Derived / computed data ────────────────────────────────────────────────

  const totalCompliance = useMemo(
    () => data ? Object.values(data.by_compliance).reduce((a, c) => a + c, 0) : 0,
    [data],
  );

  const complianceRate = useMemo(
    () => data && totalCompliance > 0
      ? Math.round(((data.by_compliance.compliant || 0) / totalCompliance) * 100)
      : 0,
    [data, totalCompliance],
  );

  const complianceSegments = useMemo(() => {
    if (!data) return [];
    const labelMap: Record<string, string> = {
      compliant: 'Compliant',
      over_allocated: 'Over-Allocated',
      under_utilized: 'Under-Utilized',
      expiring: 'Expiring',
      warning: 'Warning',
      non_compliant: 'Non-Compliant',
      expired: 'Expired',
    };
    return Object.entries(data.by_compliance).map(([key, value]) => ({
      name: labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value,
      color: LICENSE_COMPLIANCE_COLORS[key] || '#6B7280',
    }));
  }, [data]);

  const licenseTypeData = useMemo(() => {
    if (!data) return [];
    const labelMap: Record<string, string> = {
      perpetual: 'Perpetual',
      subscription: 'Subscription',
      freemium: 'Freemium',
      trial: 'Trial',
    };
    return Object.entries(data.by_type).map(([type, count]) => ({
      name: labelMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: count,
      color: LICENSE_TYPE_COLORS[type] || '#6B7280',
    }));
  }, [data]);

  const topLicenseCostData = useMemo(
    () => licenseDetailRecords
      .sort((a, b) => (Number(b.total_cost) || 0) - (Number(a.total_cost) || 0))
      .slice(0, 10)
      .map(l => ({ name: l.name, value: Number(l.total_cost) || 0, color: '#3B82F6' })),
    [licenseDetailRecords],
  );

  const publisherCostData = useMemo(() => {
    const pubMap: Record<string, PublisherCost> = {};
    licenseDetailRecords.forEach(l => {
      const pub = l.publisher || 'Unknown';
      if (!pubMap[pub]) pubMap[pub] = { publisher: pub, totalCost: 0, count: 0 };
      pubMap[pub].totalCost += Number(l.total_cost) || 0;
      pubMap[pub].count += l.total_seats;
    });
    return Object.values(pubMap)
      .sort((a, b) => b.totalCost - a.totalCost)
      .map(p => ({
        name: p.publisher,
        value: Math.round(p.totalCost),
        color: `hsl(${Object.keys(pubMap).indexOf(p.publisher) * 45}, 60%, 50%)`,
      }));
  }, [licenseDetailRecords]);

  // Utilisation table with sort
  const {
    sorted: sortedUtilization,
    sortKey: utilSortKey,
    sortDir: utilSortDir,
    toggleSort: toggleUtilSort,
  } = useSortable(licenseDetailRecords, 'name');

  // Expiry timeline with sort
  const {
    sorted: sortedExpiry,
    sortKey: expSortKey,
    sortDir: expSortDir,
    toggleSort: toggleExpSort,
  } = useSortable(
    licenseDetailRecords
      .filter(l => l.expiry_date)
      .map(l => ({
        ...l,
        days: daysRemaining(l.expiry_date!),
      })),
    'days',
  );

  const underUtilized = useMemo(
    () => licenseDetailRecords.filter(l => l.total_seats > 0 && (l.used_seats / l.total_seats) * 100 < 50).length,
    [licenseDetailRecords],
  );

  if (!data) {
    return (
      <EmptyState
        icon={<Key size={32} />}
        title="License Data Not Available"
        description="Ensure software license tracking is configured and licenses are registered."
        size="md"
      />
    );
  }

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI Row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
        gap: 16,
      }}>
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
          label="Total License Cost"
          value={formatCurrency(data.total_cost)}
          icon={DollarSign}
          iconColor="#16A34A"
          iconBg="#16A34A20"
          accentColor="#16A34A"
          change={{ value: Math.round(data.cost_per_seat_avg), label: 'avg/seat', isPositive: false }}
          {...pinProps('licenses_cost', 'Total License Cost', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Compliance Rate"
          value={complianceRate}
          unit="%"
          icon={Percent}
          iconColor={complianceRate >= 100 ? '#16A34A' : complianceRate >= 80 ? '#F59E0B' : '#EF4444'}
          iconBg={complianceRate >= 100 ? '#16A34A20' : complianceRate >= 80 ? '#F59E0B20' : '#EF444420'}
          accentColor={complianceRate >= 100 ? '#16A34A' : complianceRate >= 80 ? '#F59E0B' : '#EF4444'}
          target={{ current: complianceRate, target: 100, label: 'target: 100%' }}
          {...pinProps('licenses_compliance_rate', 'Compliance Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Over-Allocated"
          value={data.over_allocated}
          icon={Ban}
          iconColor={data.over_allocated > 0 ? '#EF4444' : '#16A34A'}
          iconBg={data.over_allocated > 0 ? '#EF444420' : '#16A34A20'}
          accentColor={data.over_allocated > 0 ? '#EF4444' : '#16A34A'}
          {...pinProps('licenses_over_allocated', 'Over-Allocated', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Under-Utilized"
          value={underUtilized}
          icon={AlertTriangle}
          iconColor={underUtilized > 0 ? '#F59E0B' : '#16A34A'}
          iconBg={underUtilized > 0 ? '#F59E0B20' : '#16A34A20'}
          accentColor={underUtilized > 0 ? '#F59E0B' : '#16A34A'}
          {...pinProps('licenses_under_utilized', 'Under-Utilized', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Expiring Soon (30d)"
          value={data.expiring_soon}
          icon={Calendar}
          iconColor={data.expiring_soon > 0 ? '#DC2626' : '#16A34A'}
          iconBg={data.expiring_soon > 0 ? '#DC262620' : '#16A34A20'}
          accentColor={data.expiring_soon > 0 ? '#DC2626' : '#16A34A'}
          {...pinProps('licenses_expiring', 'Expiring Soon', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* ── Charts Row 1: Compliance Donut + Type Bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 20,
      }}>
        <CardSection title="Licenses by Compliance Status" icon={Shield} {...pinProps('chart_license_compliance', 'License Compliance Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {complianceSegments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Shield size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No compliance data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveDonutChart
              data={complianceSegments}
              total={totalCompliance}
              totalLabel="licenses"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Compliance clicked:', seg)}
              exportFilename="license-compliance"
            />
          )}
        </CardSection>

        <CardSection title="Licenses by Type" icon={Layers} {...pinProps('chart_license_type', 'Licenses by Type', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {licenseTypeData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No license type data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={licenseTypeData}
              layout="horizontal"
              height={Math.max(180, licenseTypeData.length * 50)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('License type clicked:', datum)}
              exportFilename="licenses-by-type"
            />
          )}
        </CardSection>
      </div>

      {/* ── Charts Row 2: Top 10 by Cost + Cost by Publisher ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 20,
      }}>
        <CardSection title="Top 10 Licenses by Cost" icon={DollarSign} {...pinProps('chart_license_top_cost', 'Top 10 Licenses by Cost', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {topLicenseCostData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <DollarSign size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No license cost data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={topLicenseCostData}
              layout="horizontal"
              height={Math.max(240, topLicenseCostData.length * 40)}
              showExport={true}
              showGrid={false}
              unit="$"
              onBarClick={(datum) => console.log('License cost clicked:', datum)}
              exportFilename="top-license-costs"
            />
          )}
        </CardSection>

        <CardSection title="Cost by Publisher" icon={Building2} {...pinProps('chart_license_publisher_cost', 'Cost by Publisher', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {publisherCostData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Building2 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No publisher cost data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveDonutChart
              data={publisherCostData}
              total={publisherCostData.reduce((s, d) => s + d.value, 0)}
              totalLabel="cost ($)"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Publisher clicked:', seg)}
              exportFilename="license-cost-by-publisher"
            />
          )}
        </CardSection>
      </div>

      {/* ── Compliance Gauge ── */}
      <CardSection title="Compliance Rate" icon={Shield}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GaugeChart
            value={complianceRate}
            target={100}
            label="Compliance Rate"
            unit="%"
            showExport={true}
            exportFilename="license-compliance-gauge"
            size={220}
            thresholds={{ danger: 60, warning: 85 }}
          />
        </div>
      </CardSection>

      {/* ── License Utilization Table ── */}
      <CardSection title="License Utilization" icon={Percent} {...pinProps('table_license_util', 'License Utilization', isMetricPinned, handlePin, handleUnpin, 'table')}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <SortHeader label="Software" sortKey="software" currentKey={utilSortKey as string} currentDir={utilSortDir} onToggle={toggleUtilSort} />
                <SortHeader label="Publisher" sortKey="publisher" currentKey={utilSortKey as string} currentDir={utilSortDir} onToggle={toggleUtilSort} />
                <SortHeader label="Total Seats" sortKey="totalSeats" currentKey={utilSortKey as string} currentDir={utilSortDir} onToggle={toggleUtilSort} />
                <SortHeader label="Used Seats" sortKey="usedSeats" currentKey={utilSortKey as string} currentDir={utilSortDir} onToggle={toggleUtilSort} />
                <SortHeader label="Utilization %" sortKey="usedSeats" currentKey={utilSortKey as string} currentDir={utilSortDir} onToggle={toggleUtilSort} />
                <SortHeader label="Cost per Seat" sortKey="costPerSeat" currentKey={utilSortKey as string} currentDir={utilSortDir} onToggle={toggleUtilSort} />
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedUtilization.map((l, i) => {
                const utilPct = l.total_seats > 0 ? Math.round((l.used_seats / l.total_seats) * 100) : 0;
                const us = getUtilizationStatus(utilPct);
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12 }}>{l.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{l.publisher}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{l.total_seats}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{l.used_seats}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>
                      <span style={{ color: us.color }}>{utilPct}%</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{formatCurrency(Number(l.cost_per_seat) || 0)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        color: us.color, background: `${us.color}18`,
                        padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                      }}>{us.label}</span>
                    </td>
                  </tr>
                );
              })}
              {sortedUtilization.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No license data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardSection>

      {/* ── License Expiry Timeline ── */}
      <CardSection title="License Expiry Timeline" icon={Calendar} {...pinProps('table_license_expiry', 'License Expiry Timeline', isMetricPinned, handlePin, handleUnpin, 'table')}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <SortHeader label="Software" sortKey="name" currentKey={expSortKey as string} currentDir={expSortDir} onToggle={toggleExpSort} />
                <SortHeader label="Publisher" sortKey="publisher" currentKey={expSortKey as string} currentDir={expSortDir} onToggle={toggleExpSort} />
                <SortHeader label="Expiry Date" sortKey="expiry_date" currentKey={expSortKey as string} currentDir={expSortDir} onToggle={toggleExpSort} />
                <SortHeader label="Days Remaining" sortKey="days" currentKey={expSortKey as string} currentDir={expSortDir} onToggle={toggleExpSort} />
                <SortHeader label="Renewal Cost" sortKey="total_cost" currentKey={expSortKey as string} currentDir={expSortDir} onToggle={toggleExpSort} />
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpiry.map((l) => {
                const color = l.days < 0 ? WARRANTY_STATUS_COLORS.expired
                  : l.days <= 30 ? WARRANTY_STATUS_COLORS.red
                    : l.days <= 90 ? WARRANTY_STATUS_COLORS.yellow
                      : WARRANTY_STATUS_COLORS.green;
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12 }}>{l.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{l.publisher}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>
                      <span style={{
                        color: l.days < 30 ? WARRANTY_STATUS_COLORS.red : 'inherit',
                        fontWeight: l.days < 30 ? 600 : 400,
                      }}>{l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color }}>{l.days < 0 ? 'Expired' : `${l.days}d`}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{formatCurrency(Number(l.total_cost) || 0)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => console.log('Renew:', l.name, l.id)}
                        style={{
                          background: '#3B82F6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        Renew
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedExpiry.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No license expiry data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardSection>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Main Exported Component ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

interface AssetsLicensesSectionProps {
  assetStats: AssetStats | null;
  licenseData: LicenseReportData | null;
  assetDetails?: AssetDetail[];
  licenseDetailRecords?: LicenseDetail[];
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

type SubTab = 'assets' | 'licenses';

const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'assets', label: 'Asset Management', icon: Monitor },
  { key: 'licenses', label: 'Software Licenses', icon: Key },
];

export default function AssetsLicensesSection(props: AssetsLicensesSectionProps) {
  const {
    assetStats, licenseData, isAdminOrAgent, onExportCSV,
    isMetricPinned, handlePin, handleUnpin,
    assetDetails = [],
    licenseDetailRecords = [],
  } = props;
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('assets');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Sub-Tab Navigation ── */}
      <div role="tablist" style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border)',
        paddingBottom: 8, flexWrap: 'wrap',
      }}>
        {SUB_TABS.map((st) => (
          <button
            key={st.key}
            onClick={() => setActiveSubTab(st.key)}
            aria-label={st.label}
            aria-selected={activeSubTab === st.key}
            role="tab"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === st.key ? 'var(--accent-subtle)' : 'transparent',
              color: activeSubTab === st.key ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (activeSubTab !== st.key) {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }
            }}
            onMouseLeave={e => {
              if (activeSubTab !== st.key) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <st.icon size={16} />
            {st.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeSubTab === 'assets' && (
        <AssetsContent
          stats={assetStats}
          assetDetails={assetDetails}
          isMetricPinned={isMetricPinned}
          handlePin={handlePin}
          handleUnpin={handleUnpin}
          onExportCSV={onExportCSV}
          isAdminOrAgent={isAdminOrAgent}
        />
      )}
      {activeSubTab === 'licenses' && (
        <LicensesContent
          data={licenseData}
          licenseDetailRecords={licenseDetailRecords}
          isMetricPinned={isMetricPinned}
          handlePin={handlePin}
          handleUnpin={handleUnpin}
          onExportCSV={onExportCSV}
          isAdminOrAgent={isAdminOrAgent}
        />
      )}
    </div>
  );
}
