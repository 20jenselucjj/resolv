'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type {
  Ticket, AdminStats, TimeSeriesData, AssetStats, KnowledgeStats,
  AIAnalytics, ProblemReportData, ChangeReportData, ApprovalReportData,
  LicenseReportData, SavedReport, ReportSchedule, ReportMetrics,
  ReportExecutionResult, TimeRange, ReportTab, CustomDateRange,
  ComparisonData,
} from '../types';

export function useReportData(
  timeRange: TimeRange,
  isAdminOrAgent: boolean,
  activeTab: ReportTab,
  customDateRange?: CustomDateRange,
  comparisonEnabled?: boolean,
) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData | null>(null);
  const [assetStats, setAssetStats] = useState<AssetStats | null>(null);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [aiAnalytics, setAiAnalytics] = useState<AIAnalytics | null>(null);
  const [problemData, setProblemData] = useState<ProblemReportData | null>(null);
  const [changeData, setChangeData] = useState<ChangeReportData | null>(null);
  const [approvalData, setApprovalData] = useState<ApprovalReportData | null>(null);
  const [licenseData, setLicenseData] = useState<LicenseReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comparison state
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Advanced Reporting state
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [reportSchedules, setReportSchedules] = useState<ReportSchedule[]>([]);
  const [reportMetrics, setReportMetrics] = useState<ReportMetrics | null>(null);
  const [execResult, setExecResult] = useState<ReportExecutionResult | null>(null);
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  // ── Date helpers ───────────────────────────────────────────────────────────
  const computeDateParams = useCallback(() => {
    if (timeRange === 'custom' && customDateRange?.from && customDateRange?.to) {
      return { from: customDateRange.from, to: customDateRange.to };
    }
    const now = new Date();
    const to = now.toISOString();
    let from: string;
    switch (timeRange) {
      case '7d': from = new Date(now.getTime() - 7 * 86400000).toISOString(); break;
      case '30d': from = new Date(now.getTime() - 30 * 86400000).toISOString(); break;
      case '90d': from = new Date(now.getTime() - 90 * 86400000).toISOString(); break;
      default: from = new Date('2020-01-01').toISOString(); break;
    }
    return { from, to };
  }, [timeRange, customDateRange]);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketRes, ...rest] = await Promise.all([
        api.get<{ data: Ticket[] }>('/tickets?pageSize=500'),
        isAdminOrAgent ? api.get<{ data: AdminStats }>('/admin/stats').catch(() => null) : Promise.resolve(null as any),
        isAdminOrAgent ? api.get<{ data: TimeSeriesData }>(`/admin/stats/time-series?range=${timeRange}`).catch(() => null) : Promise.resolve(null as any),
        isAdminOrAgent ? api.get<{ data: AssetStats }>('/assets/stats').catch(() => null) : Promise.resolve(null as any),
        isAdminOrAgent ? api.get<{ data: KnowledgeStats }>('/knowledge/stats').catch(() => null) : Promise.resolve(null as any),
        isAdminOrAgent ? api.get<{ data: AIAnalytics }>('/ai/rag/analytics').catch(() => null) : Promise.resolve(null as any),
      ]);
      setTickets(ticketRes.data || []);
      if (rest[0]?.data) setAdminStats(rest[0].data);
      if (rest[1]?.data) setTimeSeries(rest[1].data);
      if (rest[2]?.data) setAssetStats(rest[2].data);
      if (rest[3]?.data) setKnowledgeStats(rest[3].data);
      if (rest[4]?.data) setAiAnalytics(rest[4].data);
    } catch (err) {
      console.error('Failed to fetch report data:', err);
      setError('Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [timeRange, isAdminOrAgent]);

  // ── Comparison Data Fetching ──────────────────────────────────────────────
  const fetchComparisonData = useCallback(async () => {
    if (!isAdminOrAgent || !comparisonEnabled) {
      setComparisonData(null);
      return;
    }
    setComparisonLoading(true);
    try {
      const { from, to } = computeDateParams();
      const res = await api.get<{ data: ComparisonData }>(
        `/reports/aggregated/comparison?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`,
      );
      if (res?.data) setComparisonData(res.data);
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
      setComparisonData(null);
    } finally {
      setComparisonLoading(false);
    }
  }, [isAdminOrAgent, comparisonEnabled, computeDateParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (comparisonEnabled) fetchComparisonData();
    else setComparisonData(null);
  }, [comparisonEnabled, fetchComparisonData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Advanced Report Fetching ────────────────────────────────────────────────
  const fetchSavedReports = useCallback(async () => {
    if (!isAdminOrAgent) return;
    try {
      const res = await api.get<{ data: SavedReport[] }>('/reports/saved');
      setSavedReports(res.data || []);
    } catch (err) { console.error('Failed to fetch saved reports:', err); }
  }, [isAdminOrAgent]);

  const fetchSchedules = useCallback(async () => {
    if (!isAdminOrAgent) return;
    try {
      const res = await api.get<{ data: ReportSchedule[] }>('/reports/schedules');
      setReportSchedules(res.data || []);
    } catch (err) { console.error('Failed to fetch schedules:', err); }
  }, [isAdminOrAgent]);

  const fetchMetrics = useCallback(async () => {
    if (!isAdminOrAgent) return;
    try {
      const res = await api.get<{ data: ReportMetrics }>('/reports/metrics');
      setReportMetrics(res.data);
    } catch (err) { console.error('Failed to fetch report metrics:', err); }
  }, [isAdminOrAgent]);

  // Fetch advanced data when related tabs become active
  useEffect(() => {
    if (activeTab === 'saved-reports') fetchSavedReports();
    if (activeTab === 'schedules') fetchSchedules();
    if (activeTab === 'builder') fetchMetrics();
  }, [activeTab, fetchSavedReports, fetchSchedules, fetchMetrics]);

  // Fetch ITSM report data when ITSM tabs or overview become active
  useEffect(() => {
    if (!isAdminOrAgent) return;
    const range = timeRange === 'all' ? '90d' : timeRange;
    const itsmTabs = ['problems', 'changes', 'approvals', 'licenses', 'overview'];
    if (!itsmTabs.includes(activeTab)) return;
    const fetchAll = activeTab === 'overview';
    const fetchers: [string, () => Promise<void>][] = [
      ['problems', async () => { const r = await api.get<{ data: ProblemReportData }>(`/reports/problems?range=${range}`).catch(() => null); if (r?.data) setProblemData(r.data); }],
      ['changes', async () => { const r = await api.get<{ data: ChangeReportData }>(`/reports/changes?range=${range}`).catch(() => null); if (r?.data) setChangeData(r.data); }],
      ['approvals', async () => { const r = await api.get<{ data: ApprovalReportData }>(`/reports/approvals?range=${range}`).catch(() => null); if (r?.data) setApprovalData(r.data); }],
      ['licenses', async () => { const r = await api.get<{ data: LicenseReportData }>('/reports/licenses').catch(() => null); if (r?.data) setLicenseData(r.data); }],
    ];
    if (fetchAll) {
      fetchers.forEach(([, fn]) => fn());
    } else {
      const entry = fetchers.find(([key]) => key === activeTab);
      if (entry) entry[1]();
    }
  }, [activeTab, timeRange, isAdminOrAgent]);

  return {
    // State
    tickets, setTickets,
    adminStats, setAdminStats,
    timeSeries, setTimeSeries,
    assetStats, setAssetStats,
    knowledgeStats, setKnowledgeStats,
    aiAnalytics, setAiAnalytics,
    problemData, setProblemData,
    changeData, setChangeData,
    approvalData, setApprovalData,
    licenseData, setLicenseData,
    loading, setLoading,
    error, setError,
    // Comparison
    comparisonData, setComparisonData,
    comparisonLoading,
    // Advanced
    savedReports, setSavedReports,
    reportSchedules, setReportSchedules,
    reportMetrics, setReportMetrics,
    execResult, setExecResult,
    execLoading, setExecLoading,
    execError, setExecError,
    // Actions
    fetchData,
    fetchSavedReports,
    fetchSchedules,
    fetchMetrics,
    fetchComparisonData,
  };
}
