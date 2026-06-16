'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { AssetListResponse } from '@/lib/assets-types';
import dynamic from 'next/dynamic';
import { Download, Menu, Maximize2, Minimize2 } from 'lucide-react';
import type {
  ReportTab, Ticket, TimeRange, CustomDateRange, DrillDownLevel, AutoRefreshInterval,
} from './types';
import { useReportData, useFilters, useExport, useDrillDown, usePinboard, useAutoRefresh } from './hooks';
import { LoadingState, ErrorState, DrillDownModal } from './components/shared';
import { ComparisonToggle, AutoRefreshToggle } from './components/filters';
import { ExportModal } from './components/export';
import { AnalyticsSidebar } from './components/AnalyticsSidebar';
import type { SectionKey } from './components/AnalyticsSidebar';
import { GlobalFilters } from './components/GlobalFilters';
import { CrossFilterProvider, useCrossFilter, CROSS_FILTER_LABELS } from './components/CrossFilterContext';
import { usePresentationMode } from './hooks/usePresentationMode';
import { connectSocket, disconnectSocket } from '@/lib/socket';

const OverviewSection = dynamic(() => import('./sections/OverviewSection'), { ssr: false });
const OperationalSection = dynamic(() => import('./sections/OperationalSection'), { ssr: false });
const ServiceLevelSection = dynamic(() => import('./sections/ServiceLevelSection'), { ssr: false });
const MatrixSection = dynamic(() => import('./sections/MatrixSection'), { ssr: false });
const ITSMModulesSection = dynamic(() => import('./sections/ITSMModulesSection'), { ssr: false });
const KnowledgeAISection = dynamic(() => import('./sections/KnowledgeAISection'), { ssr: false });
const AssetsLicensesSection = dynamic(() => import('./sections/AssetsLicensesSection'), { ssr: false });
const BenchmarksSection = dynamic(() => import('./sections/BenchmarksSection'), { ssr: false });
const ReportsSection = dynamic(() => import('./sections/ReportsSection'), { ssr: false });
const PinboardSection = dynamic(() => import('./sections/PinboardSection'), { ssr: false });

// ── Map section key → ReportTab for drill-down navigation ─────────────────
const SECTION_TO_TAB: Record<SectionKey, ReportTab> = {
  overview: 'overview',
  operational: 'tickets',
  'service-level': 'sla',
  matrix: 'overview',
  'itsm-modules': 'problems',
  'knowledge-ai': 'knowledge',
  'assets-licenses': 'assets',
  benchmarks: 'overview',
  reports: 'saved-reports',
  pinboard: 'pinboard',
};

export default function AnalyticsPage() {
  return (
    <CrossFilterProvider>
      <AnalyticsPageInner />
    </CrossFilterProvider>
  );
}

function AnalyticsPageInner() {
  const router = useRouter();
  const { user } = useStore();
  const role = user?.role || 'user';
  const isAdminOrAgent = role === 'admin' || role === 'agent';

  // Redirect non-admin users
  useEffect(() => {
    if (user && !isAdminOrAgent) {
      router.replace('/dashboard/tickets');
    }
  }, [user, isAdminOrAgent, router]);

  // ── Sidebar State ──────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Core State ──────────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({ preset: '30d' });

  const handleCustomRange = useCallback((from: string, to: string) => {
    setCustomDateRange({ preset: 'custom', from, to });
  }, []);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
    if (range !== 'custom') {
      setCustomDateRange({ preset: range });
    }
  }, []);

  // ── Comparison Mode ────────────────────────────────────────────────────────
  const [comparisonEnabled, setComparisonEnabled] = useState(false);

  // Map section to tab for data fetching
  const activeTabForData = useMemo<ReportTab>(
    () => SECTION_TO_TAB[activeSection],
    [activeSection],
  );

  // ── Data ────────────────────────────────────────────────────────────────────
  const reportData = useReportData(
    timeRange, isAdminOrAgent, activeTabForData, customDateRange, comparisonEnabled,
  );

  const {
    tickets, adminStats, timeSeries, assetStats, knowledgeStats, aiAnalytics,
    problemData, changeData, approvalData, licenseData,
    loading, error,
    comparisonData, comparisonLoading,
    savedReports, reportSchedules, reportMetrics,
    execResult, execLoading, execError, setExecResult, setExecError, setExecLoading,
    fetchData, fetchSavedReports, fetchSchedules,
  } = reportData;

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filterState = useFilters(tickets);
  const {
    filteredTickets, categoryFilter, setCategoryFilter, priorityFilter,
    setPriorityFilter, statusFilter, setStatusFilter, searchQuery,
    setSearchQuery, categories, categoriesList,
  } = filterState;

  // ── Drill-Down ──────────────────────────────────────────────────────────────
  const {
    drillDownState, drillTo, drillUp, resetDrillDown, closeDrillDown,
  } = useDrillDown({ allTickets: tickets });

  const handleDrillNavigateToTickets = useCallback(
    (filters: Record<string, string>) => {
      closeDrillDown();
      resetDrillDown();
      if (filters.status) setStatusFilter(filters.status);
      if (filters.priority) setPriorityFilter(filters.priority);
      setActiveSection('operational');
    },
    [closeDrillDown, resetDrillDown, setStatusFilter, setPriorityFilter],
  );

  // ── Pinboard ──────────────────────────────────────────────────────────────────
  const pinboard = usePinboard();
  const { pins, pinsLoading, isPinned, pinMetric, unpinMetric, reorderPins } = pinboard;

  const isMetricPinned = useCallback(
    (key: string) => pins.some((p) => p.metric_key === key),
    [pins],
  );
  const handlePin = useCallback(
    (key: string, label: string, type: string = 'kpi', config?: any) => {
      pinMetric({
        metric_key: key, metric_label: label,
        metric_type: type as 'kpi' | 'chart' | 'table', config,
      });
    },
    [pinMetric],
  );
  const handleUnpin = useCallback(
    (key: string) => {
      const p = pins.find((p) => p.metric_key === key);
      if (p) unpinMetric(p.id, key);
    },
    [pins, unpinMetric],
  );

  // ── Asset & License Detail Data ──────────────────────────────────────────────
  const [assetDetails, setAssetDetails] = useState<any[]>([]);

  // Fetch asset detail records when the section is active
  useEffect(() => {
    if (!isAdminOrAgent || activeSection !== 'assets-licenses') return;
    let cancelled = false;
    api.get<AssetListResponse>('/assets?limit=500')
      .then(res => { if (!cancelled) setAssetDetails(res.data || res.assets || []); })
      .catch(() => { if (!cancelled) setAssetDetails([]); });
    return () => { cancelled = true; };
  }, [isAdminOrAgent, activeSection]);

  // ── Auto-Refresh ──────────────────────────────────────────────────────────────
  const builderFormRef = useRef<HTMLDivElement | null>(null);
  const autoRefresh = useAutoRefresh({
    onRefresh: fetchData,
    initialEnabled: false,
    initialInterval: 60,
    formRef: builderFormRef,
  });

  // ── Socket.IO ────────────────────────────────────────────────────────────────
  const socketRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handleDataUpdated = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(), 5000);
    };

    socket.on('analytics:data-updated', handleDataUpdated);

    return () => {
      socket.off('analytics:data-updated', handleDataUpdated);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      disconnectSocket();
    };
  }, [fetchData]);

  // ── Cross-filtering & Presentation Mode ────────────────────────────────────
  const crossFilter = useCrossFilter();
  const { isPresentationMode, togglePresentationMode } = usePresentationMode();

  const handleCrossFilterChange = useCallback(
    (key: string, value: string | null) => {
      if (value === null) {
        crossFilter.removeCrossFilter(key);
      } else {
        crossFilter.setCrossFilter(key, value);
      }
    },
    [crossFilter],
  );

  // Apply cross-filters on top of existing filteredTickets
  const displayTickets = useMemo(
    () => crossFilter.applyCrossFilters(filteredTickets),
    [filteredTickets, crossFilter.applyCrossFilters],
  );

  const displayTotal = displayTickets.length;

  // ── Computed Metrics ───────────────────────────────────────────────────────
  const slaStats = useMemo(() => {
    const breached = displayTickets.filter((t) => t.sla_breached).length;
    return {
      breached,
      compliance: displayTotal ? Math.round(((displayTotal - breached) / displayTotal) * 100) : 100,
    };
  }, [displayTickets, displayTotal]);

  const responseStats = useMemo(() => {
    const withResponse = displayTickets.filter((t) => t.first_response_at);
    if (!withResponse.length) return { avg: 0, formatted: 'N/A' };
    const sum = withResponse.reduce(
      (a, t) =>
        a +
        (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()),
      0,
    );
    const hrs = sum / withResponse.length / 3600000;
    return {
      avg: hrs,
      formatted: hrs < 1 ? `${Math.round(hrs * 60)}m` : `${hrs.toFixed(1)}h`,
    };
  }, [displayTickets]);

  const resolutionStats = useMemo(() => {
    const resolved = displayTickets.filter((t) =>
      ['resolved', 'closed'].includes(t.status.toLowerCase()),
    );
    if (!resolved.length) return { avgHrs: 0, formatted: 'N/A' };
    const sum = resolved.reduce((a, t) => {
      const end = t.resolved_at || t.closed_at || t.updated_at;
      return a + (new Date(end).getTime() - new Date(t.created_at).getTime());
    }, 0);
    const hrs = sum / resolved.length / 3600000;
    return {
      avgHrs: hrs,
      formatted: hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d`,
    };
  }, [displayTickets]);

  const openCount = displayTickets.filter((t) => t.status === 'open').length;
  const progressCount = displayTickets.filter((t) => t.status === 'in_progress').length;

  // ── Portal stats ────────────────────────────────────────────────────────────
  const portalStats = useMemo(
    () => ({
      totalUsers: adminStats?.users?.total || 0,
      userRegistrations30d: adminStats?.users?.active_count || 0,
      totalTickets: displayTotal,
      serviceRequestCount: displayTickets.filter((t) => t.ticket_type === 'service_request').length,
      csatAvg: undefined as number | undefined,
      csatCount: displayTickets.filter((t) => t.status === 'closed').length,
    }),
    [displayTickets, adminStats, displayTotal],
  );

  // ── Agent Performance ──────────────────────────────────────────────────────
  const agentPerformance = useMemo(() => {
    const agents: Record<
      string,
      { name: string; count: number; resolved: number; breaches: number; totalResTime: number }
    > = {};
    displayTickets.forEach((t) => {
      const name = t.assigned_to_name;
      if (!name) return;
      const id = t.assigned_to_id || name;
      if (!agents[id])
        agents[id] = { name, count: 0, resolved: 0, breaches: 0, totalResTime: 0 };
      agents[id].count++;
      if (t.sla_breached) agents[id].breaches++;
      if (['resolved', 'closed'].includes(t.status.toLowerCase())) {
        agents[id].resolved++;
        agents[id].totalResTime +=
          new Date(t.resolved_at || t.closed_at || t.updated_at).getTime() -
          new Date(t.created_at).getTime();
      }
    });
    return Object.values(agents).sort((a, b) => b.count - a.count);
  }, [displayTickets]);

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportDeps = useMemo(
    () => ({
      filteredTickets: displayTickets, agentPerformance, assetStats, knowledgeStats,
      aiAnalytics, adminStats, slaStats, total: displayTotal, resolutionStats, timeRange,
      problemData, changeData, approvalData, licenseData,
    }),
    [
      displayTickets, agentPerformance, assetStats, knowledgeStats, aiAnalytics,
      adminStats, slaStats, displayTotal, resolutionStats, timeRange,
      problemData, changeData, approvalData, licenseData,
    ],
  );

  const exportState = useExport(exportDeps);
  const {
    showExportModal, setShowExportModal, exportFormat, setExportFormat,
    exportSections, setExportSections, toggleExportSection, exportSectionCSV,
    exportAllSelected, exportSavedReport,
  } = exportState;

  // ── Report Builder State ────────────────────────────────────────────────────
  const [builderType, setBuilderType] = useState<string>('ticket_summary');
  const [builderDatePreset, setBuilderDatePreset] = useState<string>('30d');
  const [builderDateFrom, setBuilderDateFrom] = useState<string>('');
  const [builderDateTo, setBuilderDateTo] = useState<string>('');
  const [builderFilters, setBuilderFilters] = useState<{
    status: string[];
    priority: string[];
    ticket_type: string[];
  }>({ status: [], priority: [], ticket_type: [] });
  const [builderGroupBy, setBuilderGroupBy] = useState<string>('');
  const [builderMetrics, setBuilderMetrics] = useState<string[]>(['ticket_count']);
  const [builderName, setBuilderName] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderPublic, setBuilderPublic] = useState(false);

  // ── Schedule State ──────────────────────────────────────────────────────────
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<{
    report_id: string; frequency: string; day_of_week: number;
    day_of_month: number; hour: number; recipients: string; format: string;
  }>({
    report_id: '', frequency: 'daily', day_of_week: 1, day_of_month: 1,
    hour: 8, recipients: '', format: 'email',
  });
  const [schedulerStatus, setSchedulerStatus] = useState<{
    is_running: boolean;
    last_check_at: string | null;
    next_run_at: string | null;
    active_schedules_count: number;
    recent_executions: any[];
  } | null>(null);

  // ── Builder Functions ───────────────────────────────────────────────────────
  const runReport = useCallback(async () => {
    setExecLoading(true);
    setExecError(null);
    setExecResult(null);
    try {
      const config: any = {
        date_range:
          builderDateFrom && builderDateTo
            ? { from: builderDateFrom, to: builderDateTo }
            : { preset: builderDatePreset },
        filters: {
          status: builderFilters.status.length ? builderFilters.status : undefined,
          priority: builderFilters.priority.length ? builderFilters.priority : undefined,
          ticket_type: builderFilters.ticket_type.length ? builderFilters.ticket_type : undefined,
        },
        group_by: builderGroupBy || null,
        metrics: builderMetrics,
      };
      Object.keys(config.filters).forEach((k) => {
        if (config.filters[k] === undefined) delete config.filters[k];
      });
      const res = await api.post<{ data: any; summary: any; report_type: string }>(
        '/reports/execute',
        { report_type: builderType, config },
      );
      setExecResult(res);
    } catch (err: any) {
      setExecError(err.message || 'Failed to execute report');
    } finally {
      setExecLoading(false);
    }
  }, [
    builderType, builderDatePreset, builderDateFrom, builderDateTo,
    builderFilters, builderGroupBy, builderMetrics,
    setExecResult, setExecError, setExecLoading,
  ]);

  const saveReportFromBuilder = useCallback(async () => {
    if (!builderName.trim()) return;
    try {
      const config: any = {
        date_range:
          builderDateFrom && builderDateTo
            ? { from: builderDateFrom, to: builderDateTo }
            : { preset: builderDatePreset },
        filters: {
          status: builderFilters.status.length ? builderFilters.status : undefined,
          priority: builderFilters.priority.length ? builderFilters.priority : undefined,
          ticket_type: builderFilters.ticket_type.length ? builderFilters.ticket_type : undefined,
        },
        group_by: builderGroupBy || null,
        metrics: builderMetrics,
      };
      Object.keys(config.filters).forEach((k) => {
        if (config.filters[k] === undefined) delete config.filters[k];
      });
      await api.post('/reports/saved', {
        name: builderName,
        description: builderDescription || null,
        report_type: builderType,
        config,
        is_public: builderPublic,
      });
      setBuilderName('');
      setBuilderDescription('');
      fetchSavedReports();
      setActiveSection('reports');
    } catch (err: any) {
      setExecError(err.message || 'Failed to save report');
    }
  }, [
    builderName, builderDescription, builderType, builderDatePreset,
    builderDateFrom, builderDateTo, builderFilters, builderGroupBy,
    builderMetrics, builderPublic, fetchSavedReports, setExecError,
  ]);

  const loadSavedReport = useCallback((report: any) => {
    setBuilderType(report.report_type);
    const cfg = report.config || {};
    if (cfg.date_range) {
      if (cfg.date_range.preset) setBuilderDatePreset(cfg.date_range.preset);
      if (cfg.date_range.from) setBuilderDateFrom(cfg.date_range.from);
      if (cfg.date_range.to) setBuilderDateTo(cfg.date_range.to);
    }
    if (cfg.filters) {
      setBuilderFilters({
        status: cfg.filters.status || [],
        priority: cfg.filters.priority || [],
        ticket_type: cfg.filters.ticket_type || [],
      });
    }
    setBuilderGroupBy(cfg.group_by || '');
    setBuilderMetrics(cfg.metrics || ['ticket_count']);
    setBuilderName(report.name);
    setBuilderDescription(report.description || '');
    setBuilderPublic(report.is_public);
    setActiveSection('reports');
  }, []);

  const deleteSavedReport = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/reports/saved/${id}`);
        fetchSavedReports();
      } catch (err) {
        console.error('Failed to delete saved report:', err);
      }
    },
    [fetchSavedReports],
  );

  const executeSavedReport = useCallback(
    async (id: string) => {
      setExecLoading(true);
      setExecError(null);
      setExecResult(null);
      try {
        const res = await api.get<{ data: any; summary: any; report_type: string }>(
          `/reports/execute/${id}`,
        );
        setExecResult(res);
      } catch (err: any) {
        setExecError(err.message || 'Failed to execute saved report');
      } finally {
        setExecLoading(false);
      }
    },
    [setExecResult, setExecError, setExecLoading],
  );

  // ── Schedule Functions ─────────────────────────────────────────────────────
  const createSchedule = useCallback(async () => {
    try {
      const recipients = scheduleForm.recipients
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      await api.post('/reports/schedules', {
        report_id: scheduleForm.report_id,
        frequency: scheduleForm.frequency,
        day_of_week: scheduleForm.frequency === 'weekly' ? scheduleForm.day_of_week : null,
        day_of_month: scheduleForm.frequency === 'monthly' ? scheduleForm.day_of_month : null,
        hour: scheduleForm.hour,
        recipients,
        format: scheduleForm.format,
      });
      setShowScheduleForm(false);
      fetchSchedules();
    } catch (err: any) {
      console.error('Failed to create schedule:', err);
    }
  }, [scheduleForm, fetchSchedules]);

  const deleteSchedule = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/reports/schedules/${id}`);
        fetchSchedules();
      } catch (err) {
        console.error('Failed to delete schedule:', err);
      }
    },
    [fetchSchedules],
  );

  const runScheduleNow = useCallback(
    async (id: string) => {
      try {
        await api.post(`/reports/schedules/${id}/run`, {});
        fetchSchedules();
      } catch (err) {
        console.error('Failed to run schedule:', err);
      }
    },
    [fetchSchedules],
  );

  const updateScheduleForm = useCallback((field: string, value: any) => {
    setScheduleForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: any }>('/reports/scheduler/status');
      setSchedulerStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch scheduler status:', err);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'reports') {
      fetchSchedulerStatus();
    }
  }, [activeSection, fetchSchedulerStatus]);

  // ── Section heading labels ──────────────────────────────────────────────────
  const SECTION_LABELS: Record<SectionKey, string> = {
    overview: 'Overview',
    operational: 'Operational Analytics',
    'service-level': 'Service Level Agreements',
    matrix: 'Matrix & Cross-Tab Analysis',
    'itsm-modules': 'ITSM Modules',
    'knowledge-ai': 'Knowledge & AI',
    'assets-licenses': 'Assets & Licenses',
    benchmarks: 'Industry Benchmarks',
    reports: 'Reports',
    pinboard: 'Pinboard',
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingState />;
  }

  // ── Export helper ───────────────────────────────────────────────────────────
  const handleExportOverview = () => {
    setExportSections((prev: Record<string, boolean>) =>
      Object.keys(prev).reduce(
        (a, k) => ({ ...a, [k]: true }),
        {} as Record<string, boolean>,
      ),
    );
    setTimeout(() => setShowExportModal(true), 50);
  };

  // ── Render Section ──────────────────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <OverviewSection
            tickets={tickets}
            filteredTickets={displayTickets}
            adminStats={adminStats}
            timeSeries={timeSeries}
            assetStats={assetStats}
            knowledgeStats={knowledgeStats}
            aiAnalytics={aiAnalytics}
            problemData={problemData}
            changeData={changeData}
            approvalData={approvalData}
            licenseData={licenseData}
            isAdminOrAgent={isAdminOrAgent}
            timeRange={timeRange}
            onTabChange={(tab) => {
              const sectionMap: Record<string, SectionKey> = {
                tickets: 'operational',
                performance: 'operational',
                portal: 'operational',
                sla: 'service-level',
                problems: 'itsm-modules',
                changes: 'itsm-modules',
                approvals: 'itsm-modules',
                knowledge: 'knowledge-ai',
                ai: 'knowledge-ai',
                assets: 'assets-licenses',
                licenses: 'assets-licenses',
                'saved-reports': 'reports',
                schedules: 'reports',
                builder: 'reports',
                pinboard: 'pinboard',
              };
              setActiveSection(sectionMap[tab] || 'overview');
            }}
            onExportOverview={handleExportOverview}
            onDrillDown={drillTo}
            onCrossFilterChange={handleCrossFilterChange}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
            comparisonData={comparisonData}
            comparisonLoading={comparisonLoading}
          />
        );
      case 'operational':
        return (
          <OperationalSection
            filteredTickets={displayTickets}
            tickets={tickets}
            categories={categories}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            agentPerformance={agentPerformance}
            portalStats={portalStats}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            onDrillDown={drillTo}
            onCrossFilterChange={handleCrossFilterChange}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'service-level':
        return (
          <ServiceLevelSection
            filteredTickets={displayTickets}
            adminStats={adminStats}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
            comparisonData={comparisonData}
            timeSeries={timeSeries}
            onDrillDown={drillTo}
            onCrossFilterChange={handleCrossFilterChange}
          />
        );
      case 'matrix':
        return (
          <MatrixSection
            filteredTickets={displayTickets}
            isAdminOrAgent={isAdminOrAgent}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'itsm-modules':
        return (
          <ITSMModulesSection
            problemData={problemData}
            changeData={changeData}
            approvalData={approvalData}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'knowledge-ai':
        return (
          <KnowledgeAISection
            knowledgeStats={knowledgeStats}
            aiAnalytics={aiAnalytics}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'assets-licenses':
        return (
          <AssetsLicensesSection
            assetStats={assetStats}
            licenseData={licenseData}
            assetDetails={assetDetails}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'benchmarks':
        return (
          <BenchmarksSection
            isAdminOrAgent={isAdminOrAgent}
            filteredTickets={displayTickets}
            adminStats={adminStats}
            comparisonData={comparisonData}
            timeSeries={timeSeries}
            agentPerformance={agentPerformance}
            changeData={changeData}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'reports':
        return (
          <ReportsSection
            builderType={builderType}
            setBuilderType={setBuilderType}
            builderDatePreset={builderDatePreset}
            setBuilderDatePreset={setBuilderDatePreset}
            builderDateFrom={builderDateFrom}
            setBuilderDateFrom={setBuilderDateFrom}
            builderDateTo={builderDateTo}
            setBuilderDateTo={setBuilderDateTo}
            builderFilters={builderFilters}
            setBuilderFilters={setBuilderFilters}
            builderGroupBy={builderGroupBy}
            setBuilderGroupBy={setBuilderGroupBy}
            builderMetrics={builderMetrics}
            setBuilderMetrics={setBuilderMetrics}
            builderName={builderName}
            setBuilderName={setBuilderName}
            builderDescription={builderDescription}
            setBuilderDescription={setBuilderDescription}
            builderPublic={builderPublic}
            setBuilderPublic={setBuilderPublic}
            execLoading={execLoading}
            execError={execError}
            execResult={execResult}
            onRunReport={runReport}
            onSaveReport={saveReportFromBuilder}
            savedReports={savedReports}
            reportSchedules={reportSchedules}
            schedulerStatus={schedulerStatus}
            showScheduleForm={showScheduleForm}
            scheduleForm={scheduleForm}
            onToggleScheduleForm={setShowScheduleForm}
            onUpdateScheduleForm={updateScheduleForm}
            onCreateSchedule={createSchedule}
            onDeleteSchedule={deleteSchedule}
            onRunScheduleNow={runScheduleNow}
            onRefreshSavedReports={fetchSavedReports}
            onExecuteSavedReport={executeSavedReport}
            onEditSavedReport={loadSavedReport}
            onExportSavedReport={exportSavedReport}
            onDeleteSavedReport={deleteSavedReport}
            isAdminOrAgent={isAdminOrAgent}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'pinboard':
        return (
          <PinboardSection
            pins={pins}
            pinsLoading={pinsLoading}
            tickets={tickets}
            onUnpin={unpinMetric}
            onReorder={reorderPins}
            onRefresh={fetchData}
          />
        );
      default:
        return null;
    }
  };

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .an-fade { animation: fadeUp 0.4s ease-out both; }
        .an-card { transition: box-shadow 0.2s ease, border-color 0.2s ease; }
        .an-card:hover { box-shadow: var(--shadow-md); border-color: var(--accent-border) !important; }

        .presentation-mode body {
          background: var(--bg) !important;
          overflow: hidden !important;
        }
      `}</style>

      {/* Sidebar — hidden in presentation mode */}
      {!isPresentationMode && (
        <AnalyticsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isAdminOrAgent={isAdminOrAgent}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header — collapsed in presentation mode */}
        {!isPresentationMode ? (
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="analytics-mobile-hamburger"
                  aria-label="Open navigation menu"
                  aria-expanded={mobileSidebarOpen}
                  aria-controls="analytics-sidebar"
                  style={{
                    display: 'none',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 6,
                  }}
                >
                  <Menu size={20} />
                </button>
                <div>
                  <h1
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: 'var(--text)',
                      letterSpacing: '-0.02em',
                      marginBottom: 2,
                    }}
                  >
                    {SECTION_LABELS[activeSection]}
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {isAdminOrAgent
                      ? 'Full ITSM analytics across all modules'
                      : 'Your personal ticket insights'}
                    {' · '}
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {displayTotal}
                    </span>{' '}
                    ticket{displayTotal !== 1 ? 's' : ''} in view
                    {crossFilter.hasActiveFilters && (
                      <span style={{ color: 'var(--accent)', marginLeft: 8, fontSize: 11, fontWeight: 600 }}>
                        (cross-filtered)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div
                className="analytics-header-actions"
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {comparisonLoading && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted, #9CA3AF)' }}>
                    Loading comparison...
                  </span>
                )}
                {isAdminOrAgent && (
                  <ComparisonToggle
                    enabled={comparisonEnabled}
                    onToggle={setComparisonEnabled}
                  />
                )}
                <AutoRefreshToggle
                  enabled={autoRefresh.enabled}
                  interval={autoRefresh.interval}
                  countdown={autoRefresh.countdown}
                  isLive={autoRefresh.isLive}
                  lastUpdated={autoRefresh.lastUpdated}
                  onToggle={autoRefresh.setEnabled}
                  onIntervalChange={autoRefresh.setInterval}
                />
                {isAdminOrAgent && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="btn btn-secondary btn-sm"
                    aria-label="Export all analytics data"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Download size={13} /> Export All
                  </button>
                )}
                {/* Presentation Mode Toggle */}
                <button
                  onClick={togglePresentationMode}
                  className="btn btn-secondary btn-sm"
                  aria-label={isPresentationMode ? 'Exit presentation mode' : 'Enter presentation mode'}
                  aria-pressed={isPresentationMode}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isPresentationMode ? 'var(--accent-subtle)' : undefined,
                    borderColor: isPresentationMode ? 'var(--accent)' : undefined,
                  }}
                  title={isPresentationMode ? 'Exit presentation mode' : 'Enter presentation mode'}
                >
                  {isPresentationMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  {isPresentationMode ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
                {error && <ErrorState message={error} onRetry={fetchData} />}
              </div>
            </div>
          </div>
        ) : (
          /* Minimal header in presentation mode */
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
              {SECTION_LABELS[activeSection]} · {displayTotal} tickets
              {crossFilter.hasActiveFilters && ' · Cross-filtered'}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <AutoRefreshToggle
                enabled={autoRefresh.enabled}
                interval={autoRefresh.interval}
                countdown={autoRefresh.countdown}
                isLive={autoRefresh.isLive}
                lastUpdated={autoRefresh.lastUpdated}
                onToggle={autoRefresh.setEnabled}
                onIntervalChange={autoRefresh.setInterval}
              />
              <button
                onClick={togglePresentationMode}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Minimize2 size={13} /> Exit
              </button>
            </div>
          </div>
        )}

        {/* Global Filters — hidden in presentation mode */}
        {!isPresentationMode && (
          <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
            <GlobalFilters
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              customDateRange={customDateRange}
              onCustomRange={handleCustomRange}
              priorityFilter={priorityFilter}
              onPriorityChange={setPriorityFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              categoriesList={categoriesList}
            />
          </div>
        )}

        {/* Cross-Filter Chips */}
        {crossFilter.hasActiveFilters && (
          <div
            style={{
              padding: isPresentationMode ? '4px 16px' : '8px 24px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              Cross-filtering by:
            </span>
            {Object.entries(crossFilter.crossFilters).map(([key, value]) => (
              <span
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: 'var(--accent-subtle, #dbeafe)',
                  border: '1px solid var(--accent-border, #93c5fd)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--accent, #2563eb)',
                }}
              >
                {CROSS_FILTER_LABELS[key] || key}: {value}
                <button
                  onClick={() => crossFilter.removeCrossFilter(key)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    margin: 0,
                    color: 'var(--accent, #2563eb)',
                    fontSize: 13,
                    lineHeight: 1,
                    display: 'flex',
                  }}
                  title={`Remove ${key} cross-filter`}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              onClick={crossFilter.clearCrossFilters}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--danger)',
                borderRadius: 4,
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Body */}
        <div
          className="analytics-body"
          style={{
            padding: isPresentationMode ? '8px 16px 16px' : '24px 24px 60px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <div className="an-fade">{renderSection()}</div>
        </div>
      </div>

      {/* ── Drill-Down Modal ──────────────────────────────────────────────── */}
      <DrillDownModal
        state={drillDownState}
        onClose={closeDrillDown}
        onDrillUp={drillUp}
        onNavigateToTickets={handleDrillNavigateToTickets}
      />

      {/* ── Export Modal ──────────────────────────────────────────────────── */}
      <ExportModal
        show={showExportModal}
        onClose={() => setShowExportModal(false)}
        exportSections={exportSections}
        onToggleSection={toggleExportSection}
        onExport={exportAllSelected}
        isAdminOrAgent={isAdminOrAgent}
        timeRange={timeRange}
        exportFormat={exportFormat}
        onFormatChange={setExportFormat}
      />

      <style>{`
        @media (max-width: 767px) {
          .analytics-mobile-hamburger { display: flex !important; }
          .analytics-body { padding: 16px 12px 40px !important; }
        }
        @media (max-width: 640px) {
          .analytics-header-actions { flex-direction: column !important; align-items: flex-start !important; }
          .analytics-header-actions > * { width: 100%; }
        }
      `}</style>
    </div>
  );
}
