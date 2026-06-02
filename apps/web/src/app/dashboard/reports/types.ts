export type TimeRange = '7d' | '30d' | '90d' | 'all';
export type ReportTab = 'overview' | 'tickets' | 'sla' | 'performance' | 'assets' | 'knowledge' | 'ai' | 'portal';

export interface Ticket {
  id: string; number: number; title: string; status: string;
  priority: string; created_at: string; updated_at: string;
  assigned_to_id: string | null; assigned_to_name: string | null;
  category_id: string | null; category_name: string | null;
  sla_breached: boolean; first_response_at: string | null;
  ticket_type: string; due_date: string | null; resolved_at: string | null;
  closed_at?: string | null;
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
