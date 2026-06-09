export type TimeRange = '7d' | '30d' | '90d' | 'all' | 'custom';
export type ReportTab = 'executive-summary' | 'overview' | 'tickets' | 'sla' | 'performance' | 'assets' | 'knowledge' | 'ai' | 'portal' | 'problems' | 'changes' | 'approvals' | 'licenses' | 'cab' | 'builder' | 'saved-reports' | 'schedules' | 'pinboard';

export type AutoRefreshInterval = 0 | 30 | 60 | 300; // 0=off, 30s, 1m, 5m

export interface PinnedMetric {
  id: string;
  metric_key: string;
  metric_label: string;
  metric_type: 'kpi' | 'chart' | 'table';
  config: any;
  position: number;
  created_at: string;
}

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  config: any;
  created_by: string;
  created_by_name: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  id: string;
  report_id: string;
  report_name: string;
  report_type: string;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  hour: number;
  recipients: string[];
  format: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReportExecutionResult {
  data: any;
  summary: any;
  report_type: string;
  saved_report?: SavedReport;
}

export interface ReportMetrics {
  metrics: { key: string; label: string; type: string; description: string }[];
  dimensions: { key: string; label: string; type: string }[];
  filters: { key: string; label: string; type: string; options?: string[] }[];
  report_types: { key: string; label: string; description: string }[];
}

export interface ReportConfig {
  date_range: { from?: string; to?: string; preset?: string };
  filters: { status?: string[]; priority?: string[]; category_id?: string[]; assignee_id?: string[]; ticket_type?: string[] };
  group_by: string | null;
  metrics: string[];
}

export interface Ticket {
  id: string; number: number; title: string; status: string;
  priority: string; created_at: string; updated_at: string;
  assigned_to_id: string | null; assigned_to_name: string | null;
  category_id: string | null; category_name: string | null;
  sla_breached: boolean; first_response_at: string | null;
  ticket_type: string; due_date: string | null; resolved_at: string | null;
  closed_at?: string | null;
  satisfaction_rating?: number;
  satisfaction_comment?: string;
}

export interface AdminStats {
  tickets: {
    total: number; by_status: Record<string,number>; by_priority: Record<string,number>;
    by_type: Record<string,number>; created_today: number; resolved_today: number;
    avg_resolution_hours: number;
  };
  users: { total: number; by_role: Record<string,number>; active_count: number; };
  sla: { breached_count: number; at_risk_count: number; };
}

export interface TimeSeriesPoint {
  date: string; created?: number; resolved?: number; breached?: number; hours?: number;
}

export interface TimeSeriesData {
  tickets: TimeSeriesPoint[];
  sla: TimeSeriesPoint[];
  avg_resolution: TimeSeriesPoint[];
}

export interface AssetStats {
  total: number;
  byStatus: { status: string; count: number }[];
  byType: { asset_type: string; count: number }[];
  agentStatus: { agent_status: string; count: number }[];
  recentActivity: { action: string; description: string; created_at: string }[];
}

export interface KnowledgeStats {
  total: number;
  byStatus: { status: string; count: number }[];
  topViewed: { id: string; title: string; slug: string; views: number; helpful_count: number; not_helpful_count: number }[];
  topHelpful: { id: string; title: string; slug: string; views: number; helpful_count: number; not_helpful_count: number; helpfulness_pct: number }[];
  byCategory: { category: string; count: number }[];
  authorStats: { author: string; total: number; total_views: number }[];
  viewsDaily: { date: string; count: number }[];
}

export interface AIAnalytics {
  summary: {
    total_queries: number;
    avg_confidence: number;
    flagged_count: number;
    active_sources: number;
    total_sources: number;
  };
  recent_queries: {
    id: string; query: string; user_name: string; confidence_score: number;
    flagged_for_review: boolean; created_at: string;
  }[];
  source_stats: { name: string; category: string; chunk_count: number; query_hits: number }[];
  flagged_queries: { id: string; query: string; created_at: string }[];
  daily_volume: { date: string; count: number }[];
}

export const STATUS_COLORS: Record<string, string> = {
  open: 'var(--info)', in_progress: 'var(--warning)',
  pending: '#8b5cf6', resolved: 'var(--success)', closed: 'var(--text-muted)',
};
export const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)', high: '#f97316', medium: 'var(--warning)', low: 'var(--success)',
};
export const TYPE_COLORS: Record<string, string> = {
  incident: 'var(--danger)', service_request: 'var(--info)',
  problem: 'var(--warning)', change: '#7c3aed',
};

// ── ITSM Report Data Types ──────────────────────────────────────────────────

export interface ProblemReportData {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  mttr_hours: number;
  created_trend: { date: string; count: number }[];
  top_root_causes: { category: string; count: number }[];
  incident_link_rate: number;
}

export interface ChangeReportData {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_risk: Record<string, number>;
  by_priority: Record<string, number>;
  success_rate: number;
  rollback_rate: number;
  avg_implementation_hours: number;
  emergency_count: number;
  emergency_rate: number;
  pir_completion_rate: number;
  created_trend: { date: string; count: number }[];
}

export interface ApprovalReportData {
  total: number;
  by_status: Record<string, number>;
  avg_time_to_decide_hours: number;
  by_entity_type: Record<string, number>;
  overdue_count: number;
  approval_rate: number;
  created_trend: { date: string; count: number }[];
}

// ── Drill-Down & Comparison Types ─────────────────────────────────────────────

export interface DrillDownLevel {
  /** Human-readable label for this level (e.g. "Status: Open") */
  label: string;
  /** Filter key applied at this level */
  filterKey: 'status' | 'priority' | 'ticket_type' | 'category' | 'assignee';
  /** Filter value */
  filterValue: string;
  /** Number of matching tickets */
  count: number;
}

export interface DrillDownState {
  /** Stack of drill-down levels */
  levels: DrillDownLevel[];
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Tickets matching the current drill-down path */
  tickets: Ticket[];
  /** Loading state for ticket fetch */
  loading: boolean;
}

export interface CustomDateRange {
  /** Preset range key or 'custom' */
  preset: TimeRange | 'custom';
  /** ISO date string for custom from date */
  from?: string;
  /** ISO date string for custom to date */
  to?: string;
}

export interface ComparisonPeriod {
  total_tickets: number;
  resolved_tickets: number;
  resolution_rate: number;
  sla_breaches: number;
  sla_compliance_pct: number;
  avg_response_hours: number;
  avg_resolution_hours: number;
  csat_avg: number | null;
}

export interface ComparisonChange {
  current: number;
  previous: number;
  change: number;
  change_pct: number | null;
}

export interface ComparisonData {
  current_period: ComparisonPeriod;
  previous_period: ComparisonPeriod;
  changes: Record<string, ComparisonChange>;
}

export interface LicenseReportData {
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
}
