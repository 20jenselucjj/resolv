'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Download, AlertTriangle, User, Star, RefreshCw } from 'lucide-react';
import {
  LayoutDashboard, FileText, Shield, Users, Bug, Wrench, CheckSquare,
  DollarSign, Monitor, BookOpen, Brain, Sliders, Save, Clock as ClockIcon,
} from 'lucide-react';
import type { ReportTab, Ticket, TimeRange, CustomDateRange, DrillDownLevel, AutoRefreshInterval } from './types';
import { useReportData, useFilters, useExport, useDrillDown, usePinboard, useAutoRefresh } from './hooks';
import { TabNavigation, LoadingState, ErrorState, DrillDownModal } from './components/shared';
import { DateRangePicker, ComparisonToggle, AutoRefreshToggle } from './components/filters';
import { ExportModal } from './components/export';
import {
  OverviewTab, TicketsTab, SLATab, PerformanceTab,
  ProblemsTab, ChangesTab, ApprovalsTab, LicensesTab,
  AssetsTab, KnowledgeTab, AITab, PortalTab,
  BuilderTab, SavedReportsTab, SchedulesTab, PinboardTab,
} from './tabs';
import { connectSocket, disconnectSocket } from '@/lib/socket';

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS: { key: ReportTab; label: string; icon: React.ComponentType<{ size?: number }>; adminOnly?: boolean }[] = [
  { key: 'pinboard', label: 'Pinboard', icon: Star },
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'tickets', label: 'Tickets', icon: FileText },
  { key: 'sla', label: 'SLA', icon: Shield },
  { key: 'performance', label: 'Performance', icon: Users, adminOnly: true },
  { key: 'problems', label: 'Problems', icon: Bug, adminOnly: true },
  { key: 'changes', label: 'Changes', icon: Wrench, adminOnly: true },
  { key: 'approvals', label: 'Approvals', icon: CheckSquare, adminOnly: true },
  { key: 'licenses', label: 'Licenses', icon: DollarSign, adminOnly: true },
  { key: 'assets', label: 'Assets', icon: Monitor, adminOnly: true },
  { key: 'knowledge', label: 'Knowledge', icon: BookOpen, adminOnly: true },
  { key: 'ai', label: 'AI & Automation', icon: Brain, adminOnly: true },
  { key: 'portal', label: 'Self Service', icon: LayoutDashboard, adminOnly: true },
  { key: 'builder', label: 'Report Builder', icon: Sliders },
  { key: 'saved-reports', label: 'Saved Reports', icon: Save },
  { key: 'schedules', label: 'Schedules', icon: ClockIcon, adminOnly: true },
];

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useStore();
  const role = user?.role || 'user';
  const isAdminOrAgent = role === 'admin' || role === 'agent';

  // Redirect non-admin users away from reports
  useEffect(() => {
    if (user && !isAdminOrAgent) {
      router.replace('/dashboard/tickets');
    }
  }, [user, isAdminOrAgent, router]);

  // ── Core State ──────────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  // ── Custom Date Range ──────────────────────────────────────────────────────
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

  // ── Data ────────────────────────────────────────────────────────────────────
  const reportData = useReportData(timeRange, isAdminOrAgent, activeTab, customDateRange, comparisonEnabled);

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
  const { filteredTickets, categoryFilter, setCategoryFilter, priorityFilter, setPriorityFilter, statusFilter, setStatusFilter, searchQuery, setSearchQuery, categories, categoriesList } = filterState;

  // ── Drill-Down ──────────────────────────────────────────────────────────────
  const {
    drillDownState,
    drillTo,
    drillUp,
    resetDrillDown,
    closeDrillDown,
  } = useDrillDown({ allTickets: tickets });

  const handleDrillNavigateToTickets = useCallback((filters: Record<string, string>) => {
    closeDrillDown();
    resetDrillDown();
    // Apply filters and switch to tickets tab
    if (filters.status) setStatusFilter(filters.status);
    if (filters.priority) setPriorityFilter(filters.priority);
    setActiveTab('tickets');
  }, [closeDrillDown, resetDrillDown, setStatusFilter, setPriorityFilter]);

  // ── Pinboard ──────────────────────────────────────────────────────────────────
  const pinboard = usePinboard();
  const { pins, pinsLoading, isPinned, pinMetric, unpinMetric, reorderPins } = pinboard;

  // ── Pin helpers for ScorecardWidget ───────────────────────────────────────────
  const isMetricPinned = useCallback((key: string) => pins.some(p => p.metric_key === key), [pins]);
  const handlePin = useCallback((key: string, label: string, type: string = 'kpi', config?: any) => {
    pinMetric({ metric_key: key, metric_label: label, metric_type: type as 'kpi' | 'chart' | 'table', config });
  }, [pinMetric]);
  const handleUnpin = useCallback((key: string) => {
    const p = pins.find(p => p.metric_key === key);
    if (p) unpinMetric(p.id, key);
  }, [pins, unpinMetric]);

  // ── Auto-Refresh ──────────────────────────────────────────────────────────────
  const builderFormRef = useRef<HTMLDivElement | null>(null);
  const autoRefresh = useAutoRefresh({
    onRefresh: fetchData,
    initialEnabled: false,
    initialInterval: 60,
    formRef: builderFormRef,
  });

  // ── Socket.IO integration for real-time updates ────────────────────────────────
  const socketRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handleDataUpdated = () => {
      // Debounce: don't refresh more than once every 5 seconds via socket
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchData();
      }, 5000);
    };

    socket.on('reports:data-updated', handleDataUpdated);

    return () => {
      socket.off('reports:data-updated', handleDataUpdated);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      disconnectSocket();
    };
  }, [fetchData]);

  const total = filteredTickets.length;

  // ── Computed Metrics ───────────────────────────────────────────────────────
  const slaStats = useMemo(() => {
    const breached = filteredTickets.filter(t => t.sla_breached).length;
    return { breached, compliance: total ? Math.round(((total - breached) / total) * 100) : 100 };
  }, [filteredTickets, total]);

  const responseStats = useMemo(() => {
    const withResponse = filteredTickets.filter(t => t.first_response_at);
    if (!withResponse.length) return { avg: 0, formatted: 'N/A' };
    const sum = withResponse.reduce((a, t) => a + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0);
    const hrs = sum / withResponse.length / 3600000;
    return { avg: hrs, formatted: hrs < 1 ? `${Math.round(hrs * 60)}m` : `${hrs.toFixed(1)}h` };
  }, [filteredTickets]);

  const resolutionStats = useMemo(() => {
    const resolved = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    if (!resolved.length) return { avgHrs: 0, formatted: 'N/A' };
    const sum = resolved.reduce((a, t) => {
      const end = t.resolved_at || t.closed_at || t.updated_at;
      return a + (new Date(end).getTime() - new Date(t.created_at).getTime());
    }, 0);
    const hrs = sum / resolved.length / 3600000;
    return { avgHrs: hrs, formatted: hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d` };
  }, [filteredTickets]);

  const openCount = filteredTickets.filter(t => t.status === 'open').length;
  const progressCount = filteredTickets.filter(t => t.status === 'in_progress').length;

  // ── Portal stats computed from tickets ────────────────────────────────────
  const portalStats = useMemo(() => ({
    totalUsers: adminStats?.users?.total || 0,
    userRegistrations30d: adminStats?.users?.active_count || 0,
    totalTickets: total,
    serviceRequestCount: filteredTickets.filter(t => t.ticket_type === 'service_request').length,
    csatAvg: undefined as number | undefined,
    csatCount: filteredTickets.filter(t => t.status === 'closed').length,
  }), [filteredTickets, adminStats, total]);

  // ── Agent Performance ──────────────────────────────────────────────────────
  const agentPerformance = useMemo(() => {
    const agents: Record<string, { name: string; count: number; resolved: number; breaches: number; totalResTime: number }> = {};
    filteredTickets.forEach(t => {
      const name = t.assigned_to_name; if (!name) return;
      const id = t.assigned_to_id || name;
      if (!agents[id]) agents[id] = { name, count: 0, resolved: 0, breaches: 0, totalResTime: 0 };
      agents[id].count++;
      if (t.sla_breached) agents[id].breaches++;
      if (['resolved', 'closed'].includes(t.status.toLowerCase())) {
        agents[id].resolved++;
        agents[id].totalResTime += new Date(t.resolved_at || t.closed_at || t.updated_at).getTime() - new Date(t.created_at).getTime();
      }
    });
    return Object.values(agents).sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportDeps = useMemo(() => ({
    filteredTickets, agentPerformance, assetStats, knowledgeStats,
    aiAnalytics, adminStats, slaStats, total, resolutionStats, timeRange,
    problemData, changeData, approvalData, licenseData,
  }), [filteredTickets, agentPerformance, assetStats, knowledgeStats, aiAnalytics, adminStats, slaStats, total, resolutionStats, timeRange, problemData, changeData, approvalData, licenseData]);

  const exportState = useExport(exportDeps);
  const { showExportModal, setShowExportModal, exportFormat, setExportFormat, exportSections, setExportSections, toggleExportSection, exportSectionCSV, exportAllSelected, exportSavedReport } = exportState;

  // ── Report Builder State ────────────────────────────────────────────────────
  const [builderType, setBuilderType] = useState<string>('ticket_summary');
  const [builderDatePreset, setBuilderDatePreset] = useState<string>('30d');
  const [builderDateFrom, setBuilderDateFrom] = useState<string>('');
  const [builderDateTo, setBuilderDateTo] = useState<string>('');
  const [builderFilters, setBuilderFilters] = useState<{ status: string[]; priority: string[]; ticket_type: string[] }>({ status: [], priority: [], ticket_type: [] });
  const [builderGroupBy, setBuilderGroupBy] = useState<string>('');
  const [builderMetrics, setBuilderMetrics] = useState<string[]>(['ticket_count']);
  const [builderName, setBuilderName] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderPublic, setBuilderPublic] = useState(false);

  // ── Schedule State ──────────────────────────────────────────────────────────
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<{ report_id: string; frequency: string; day_of_week: number; day_of_month: number; hour: number; recipients: string; format: string }>({
    report_id: '', frequency: 'daily', day_of_week: 1, day_of_month: 1, hour: 8, recipients: '', format: 'email',
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
        date_range: builderDateFrom && builderDateTo
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
      Object.keys(config.filters).forEach(k => { if (config.filters[k] === undefined) delete config.filters[k]; });
      const res = await api.post<{ data: any; summary: any; report_type: string }>('/reports/execute', { report_type: builderType, config });
      setExecResult(res);
    } catch (err: any) {
      setExecError(err.message || 'Failed to execute report');
    } finally {
      setExecLoading(false);
    }
  }, [builderType, builderDatePreset, builderDateFrom, builderDateTo, builderFilters, builderGroupBy, builderMetrics, setExecResult, setExecError, setExecLoading]);

  const saveReportFromBuilder = useCallback(async () => {
    if (!builderName.trim()) return;
    try {
      const config: any = {
        date_range: builderDateFrom && builderDateTo
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
      Object.keys(config.filters).forEach(k => { if (config.filters[k] === undefined) delete config.filters[k]; });
      await api.post('/reports/saved', {
        name: builderName, description: builderDescription || null,
        report_type: builderType, config, is_public: builderPublic,
      });
      setBuilderName(''); setBuilderDescription('');
      fetchSavedReports();
      setActiveTab('saved-reports');
    } catch (err: any) {
      setExecError(err.message || 'Failed to save report');
    }
  }, [builderName, builderDescription, builderType, builderDatePreset, builderDateFrom, builderDateTo, builderFilters, builderGroupBy, builderMetrics, builderPublic, fetchSavedReports, setExecError]);

  const loadSavedReport = useCallback(async (report: any) => {
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
    setActiveTab('builder');
  }, []);

  const deleteSavedReport = useCallback(async (id: string) => {
    try { await api.delete(`/reports/saved/${id}`); fetchSavedReports(); }
    catch (err) { console.error('Failed to delete saved report:', err); }
  }, [fetchSavedReports]);

  const executeSavedReport = useCallback(async (id: string) => {
    setExecLoading(true); setExecError(null); setExecResult(null);
    try { const res = await api.get<{ data: any; summary: any; report_type: string }>(`/reports/execute/${id}`); setExecResult(res); }
    catch (err: any) { setExecError(err.message || 'Failed to execute saved report'); }
    finally { setExecLoading(false); }
  }, [setExecResult, setExecError, setExecLoading]);

  // ── Schedule Functions ─────────────────────────────────────────────────────
  const createSchedule = useCallback(async () => {
    try {
      const recipients = scheduleForm.recipients.split(',').map(r => r.trim()).filter(Boolean);
      await api.post('/reports/schedules', {
        report_id: scheduleForm.report_id, frequency: scheduleForm.frequency,
        day_of_week: scheduleForm.frequency === 'weekly' ? scheduleForm.day_of_week : null,
        day_of_month: scheduleForm.frequency === 'monthly' ? scheduleForm.day_of_month : null,
        hour: scheduleForm.hour, recipients, format: scheduleForm.format,
      });
      setShowScheduleForm(false);
      fetchSchedules();
    } catch (err: any) { console.error('Failed to create schedule:', err); }
  }, [scheduleForm, fetchSchedules]);

  const deleteSchedule = useCallback(async (id: string) => {
    try { await api.delete(`/reports/schedules/${id}`); fetchSchedules(); }
    catch (err) { console.error('Failed to delete schedule:', err); }
  }, [fetchSchedules]);

  const runScheduleNow = useCallback(async (id: string) => {
    try { await api.post(`/reports/schedules/${id}/run`, {}); fetchSchedules(); }
    catch (err) { console.error('Failed to run schedule:', err); }
  }, [fetchSchedules]);

  const updateScheduleForm = useCallback((field: string, value: any) => {
    setScheduleForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: any }>('/reports/scheduler/status');
      setSchedulerStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch scheduler status:', err);
    }
  }, []);

  // Fetch scheduler status when schedules tab becomes active
  useEffect(() => {
    if (activeTab === 'schedules') {
      fetchSchedulerStatus();
    }
  }, [activeTab, fetchSchedulerStatus]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingState />;
  }

  // ── Render Content ──────────────────────────────────────────────────────────
  const renderContent = () => {
    const handleExportOverview = () => {
      setExportSections(prev => Object.keys(prev).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>));
      setTimeout(() => setShowExportModal(true), 50);
    };

    switch (activeTab) {
      case 'pinboard':
        return (
          <PinboardTab
            pins={pins}
            pinsLoading={pinsLoading}
            tickets={tickets}
            onUnpin={unpinMetric}
            onReorder={reorderPins}
            onRefresh={fetchData}
          />
        );
      case 'overview':
        return (
          <OverviewTab
            tickets={tickets}
            filteredTickets={filteredTickets}
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
            onTabChange={setActiveTab}
            onExportOverview={handleExportOverview}
            onDrillDown={drillTo}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'tickets':
        return (
          <TicketsTab
            filteredTickets={filteredTickets}
            categories={categories}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onExportCSV={() => exportSectionCSV('tickets')}
            onDrillDown={drillTo}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'sla':
        return (
          <SLATab
            filteredTickets={filteredTickets}
            adminStats={adminStats}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'performance':
        return (
          <PerformanceTab
            agentPerformance={agentPerformance}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'problems':
        return <ProblemsTab data={problemData} onExportCSV={(s) => exportSectionCSV('problems')} isAdminOrAgent={isAdminOrAgent} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />;
      case 'changes':
        return <ChangesTab data={changeData} onExportCSV={(s) => exportSectionCSV('changes')} isAdminOrAgent={isAdminOrAgent} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />;
      case 'approvals':
        return <ApprovalsTab data={approvalData} onExportCSV={(s) => exportSectionCSV('approvals')} isAdminOrAgent={isAdminOrAgent} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />;
      case 'licenses':
        return <LicensesTab data={licenseData} onExportCSV={(s) => exportSectionCSV('licenses')} isAdminOrAgent={isAdminOrAgent} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />;
      case 'assets':
        return (
          <AssetsTab
            stats={assetStats}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'knowledge':
        return (
          <KnowledgeTab
            stats={knowledgeStats}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'ai':
        return (
          <AITab
            stats={aiAnalytics}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'portal':
        return (
          <PortalTab
            portalStats={portalStats}
            isAdminOrAgent={isAdminOrAgent}
            onExportCSV={exportSectionCSV}
            isMetricPinned={isMetricPinned}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
          />
        );
      case 'builder':
        return (
          <BuilderTab
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
          />
        );
      case 'saved-reports':
        return (
          <SavedReportsTab
            savedReports={savedReports}
            execResult={execResult}
            execLoading={execLoading}
            onRefresh={fetchSavedReports}
            onExecute={executeSavedReport}
            onEdit={loadSavedReport}
            onExport={exportSavedReport}
            onDelete={deleteSavedReport}
          />
        );
      case 'schedules':
        return (
          <SchedulesTab
            reportSchedules={reportSchedules}
            savedReports={savedReports}
            schedulerStatus={schedulerStatus}
            showScheduleForm={showScheduleForm}
            scheduleForm={scheduleForm}
            onToggleForm={setShowScheduleForm}
            onUpdateForm={updateScheduleForm}
            onCreate={createSchedule}
            onDelete={deleteSchedule}
            onRunNow={runScheduleNow}
          />
        );
      default:
        return <OverviewTab tickets={tickets} filteredTickets={filteredTickets} adminStats={adminStats} timeSeries={timeSeries} assetStats={assetStats} knowledgeStats={knowledgeStats} aiAnalytics={aiAnalytics} problemData={problemData} changeData={changeData} approvalData={approvalData} licenseData={licenseData} isAdminOrAgent={isAdminOrAgent} timeRange={timeRange} onTabChange={setActiveTab} onExportOverview={handleExportOverview} onDrillDown={drillTo} />;
    }
  };

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .rp-fade { animation: fadeUp 0.4s ease-out both; }
        .rp-card { transition: box-shadow 0.2s ease, border-color 0.2s ease; }
        .rp-card:hover { box-shadow: var(--shadow-md); border-color: var(--accent-border) !important; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                Reports & Analytics
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {isAdminOrAgent ? 'Full ITSM reporting across all modules' : 'Your personal ticket insights'}
                {' · '}<span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{total}</span> ticket{total !== 1 ? 's' : ''} in view
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <DateRangePicker
                timeRange={timeRange}
                onChange={handleTimeRangeChange}
                onCustomRange={handleCustomRange}
                customFrom={customDateRange.from}
                customTo={customDateRange.to}
              />
              {comparisonLoading && (
                <span style={{ fontSize: 11, color: 'var(--text-muted, #9CA3AF)' }}>Loading comparison...</span>
              )}
              {isAdminOrAgent && (
                <ComparisonToggle enabled={comparisonEnabled} onToggle={setComparisonEnabled} />
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
                <button onClick={() => setShowExportModal(true)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={13} /> Export All
                </button>
              )}
              {error && <ErrorState message={error} onRetry={fetchData} />}
            </div>
          </div>

          {/* ── Navigation Tabs ─────────────────────────────────────────────── */}
          <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} isAdminOrAgent={isAdminOrAgent} />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px 60px', width: '100%' }}>
        {renderContent()}
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
    </div>
  );
}
