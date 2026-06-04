'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import {
  BarChart2, PieChart, TrendingUp, Download, FileText,
  User, AlertCircle, RefreshCcw, Target, Activity, Layers,
  Clock, CheckCircle2, Shield, Zap, Filter, ChevronDown,
  Calendar, Users, Monitor, HardDrive, Wifi, Search,
  BookOpen, Brain, Bot, LayoutDashboard, AlertTriangle, X, CheckSquare,
} from 'lucide-react';
import type { TimeRange, ReportTab, Ticket, AdminStats, TimeSeriesData, AssetStats, KnowledgeStats, AIAnalytics } from './types';
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_COLORS } from './types';
import { DonutChart, MiniBar, KPICard, MiniTable, CardSection, BarChart } from './components/Charts';
import AssetReports from './components/AssetReports';
import KnowledgeReports from './components/KnowledgeReports';
import AIReports from './components/AIReports';
import PortalReports from './components/PortalReports';

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS: { key: ReportTab; label: string; icon: React.ComponentType<{ size?: number }>; adminOnly?: boolean }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'tickets', label: 'Tickets', icon: FileText },
  { key: 'sla', label: 'SLA', icon: Shield },
  { key: 'performance', label: 'Performance', icon: Users, adminOnly: true },
  { key: 'assets', label: 'Assets', icon: Monitor, adminOnly: true },
  { key: 'knowledge', label: 'Knowledge', icon: BookOpen, adminOnly: true },
  { key: 'ai', label: 'AI & Automation', icon: Brain, adminOnly: true },
  { key: 'portal', label: 'Self Service', icon: LayoutDashboard, adminOnly: true },
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

  // ── State ──────────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData | null>(null);
  const [assetStats, setAssetStats] = useState<AssetStats | null>(null);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [aiAnalytics, setAiAnalytics] = useState<AIAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  // Ticket-specific filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketRes, ...rest] = await Promise.all([
        api.get<{ data: Ticket[] }>('/tickets?pageSize=500'),
        isAdminOrAgent ? api.get<{ data: AdminStats }>('/admin/stats').catch(() => null) : Promise.resolve(null),
        isAdminOrAgent ? api.get<{ data: TimeSeriesData }>(`/admin/stats/time-series?range=${timeRange}`).catch(() => null) : Promise.resolve(null),
        isAdminOrAgent ? api.get<{ data: AssetStats }>('/assets/stats').catch(() => null) : Promise.resolve(null),
        isAdminOrAgent ? api.get<{ data: KnowledgeStats }>('/knowledge/stats').catch(() => null) : Promise.resolve(null),
        isAdminOrAgent ? api.get<{ data: AIAnalytics }>('/ai/rag/analytics').catch(() => null) : Promise.resolve(null),
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtered Tickets ───────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    let data = tickets;
    if (timeRange !== 'all') {
      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      data = data.filter(t => new Date(t.created_at) >= new Date(now.getTime() - days * 86400000));
    }
    if (categoryFilter !== 'all') data = data.filter(t => (t.category_name || 'Uncategorized') === categoryFilter);
    if (priorityFilter !== 'all') data = data.filter(t => t.priority === priorityFilter);
    if (statusFilter !== 'all') data = data.filter(t => t.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(t => t.title.toLowerCase().includes(q) || t.number.toString().includes(q));
    }
    return data;
  }, [tickets, timeRange, categoryFilter, priorityFilter, statusFilter, searchQuery]);

  const total = filteredTickets.length;

  // ── Computed Metrics ───────────────────────────────────────────────────────
  const slaStats = useMemo(() => {
    const breached = filteredTickets.filter(t => t.sla_breached).length;
    return { breached, compliance: total ? Math.round(((total - breached) / total) * 100) : 100 };
  }, [filteredTickets]);

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
    return { avgHrs: hrs, formatted: hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs/24).toFixed(1)}d` };
  }, [filteredTickets]);

  const openCount = filteredTickets.filter(t => t.status === 'open').length;
  const progressCount = filteredTickets.filter(t => t.status === 'in_progress').length;

  // ── Breakdowns ─────────────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { m[t.status] = (m[t.status] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const priorityBreakdown = useMemo(() => {
    const m: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    filteredTickets.forEach(t => { const p = t.priority?.toLowerCase() || 'low'; m[p] = (m[p]||0)+1; });
    return Object.entries(m);
  }, [filteredTickets]);

  const typeBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const ty = t.ticket_type || 'incident'; m[ty] = (m[ty]||0)+1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const categoryBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const c = t.category_name || 'Uncategorized'; m[c] = (m[c]||0)+1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredTickets]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    tickets.forEach(t => cats.add(t.category_name || 'Uncategorized'));
    return ['all', ...Array.from(cats)];
  }, [tickets]);

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

  // ── Portal stats computed from tickets ────────────────────────────────────
  const portalStats = useMemo(() => {
    const srCount = filteredTickets.filter(t => t.ticket_type === 'service_request').length;
    const csatRatings = filteredTickets.filter(t => t.status === 'closed').length;
    return {
      totalUsers: adminStats?.users?.total || 0,
      userRegistrations30d: adminStats?.users?.active_count || 0,
      totalTickets: total,
      serviceRequestCount: srCount,
      csatAvg: undefined as number | undefined,
      csatCount: csatRatings,
    };
  }, [filteredTickets, adminStats]);

  // ── Max values for bars ────────────────────────────────────────────────────
  const maxStatusVal = Math.max(...statusBreakdown.map(s => s[1]), 1);
  const maxCategoryVal = Math.max(...categoryBreakdown.map(c => c[1]), 1);

  // ── Time-series chart data ──────────────────────────────────────────────────
  const tsPoints = timeSeries?.tickets || [];
  const tsMaxCreated = Math.max(...tsPoints.map(p => p.created || 0), 1);

  // ── Export All modal state ──────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSections, setExportSections] = useState<Record<string, boolean>>({
    tickets: true,
    sla: true,
    performance: true,
    assets: true,
    knowledge: true,
    ai: true,
    portal: true,
  });

  const toggleExportSection = (key: string) => {
    setExportSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const EXPORT_SECTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; adminOnly?: boolean }> = {
    tickets: { label: 'Tickets', icon: FileText },
    sla: { label: 'SLA Summary', icon: Shield },
    performance: { label: 'Agent Performance', icon: Users, adminOnly: true },
    assets: { label: 'Asset Inventory', icon: Monitor, adminOnly: true },
    knowledge: { label: 'Knowledge Base', icon: BookOpen, adminOnly: true },
    ai: { label: 'AI Analytics', icon: Brain, adminOnly: true },
    portal: { label: 'Self-Service Portal', icon: LayoutDashboard, adminOnly: true },
  };

  // ── Export functions ────────────────────────────────────────────────────────
  const generateSectionCSV = useCallback((section: string): string | null => {
    const generators: Record<string, () => string | null> = {
      tickets: () => {
        if (filteredTickets.length === 0) return null;
        const headers = ['ID','#','Title','Status','Priority','Type','Category','Created','Updated','Assignee','SLA Breached','Due Date'];
        const rows = filteredTickets.map(t => [
          t.id, t.number, `"${t.title.replace(/"/g,'""')}"`, t.status, t.priority,
          t.ticket_type, t.category_name||'', t.created_at, t.updated_at,
          t.assigned_to_name||'Unassigned', t.sla_breached?'Yes':'No', t.due_date||'',
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      },
      overview: () => {
        if (filteredTickets.length === 0) return null;
        const headers = ['ID','#','Title','Status','Priority','Type','Category','Created','Updated','Assignee','SLA Breached','Due Date'];
        const rows = filteredTickets.map(t => [
          t.id, t.number, `"${t.title.replace(/"/g,'""')}"`, t.status, t.priority,
          t.ticket_type, t.category_name||'', t.created_at, t.updated_at,
          t.assigned_to_name||'Unassigned', t.sla_breached?'Yes':'No', t.due_date||'',
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      },
      sla: () => {
        if (filteredTickets.length === 0) return null;
        const breached = filteredTickets.filter(t => t.sla_breached);
        const lines = [
          `SLA Compliance,,${slaStats.compliance}%`,
          `Total Tickets,,${total}`,
          `SLA Breaches,,${slaStats.breached}`,
          `At Risk,,${adminStats?.sla?.at_risk_count ?? '—'}`,
          `Avg Resolution,,${resolutionStats.formatted}`,
          '',
          'Breached Tickets',
          '#,Title,Priority,Assignee,Due Date',
          ...breached.map(t => [
            t.number, `"${t.title.replace(/"/g,'""')}"`, t.priority,
            t.assigned_to_name||'Unassigned', t.due_date||'',
          ].join(',')),
        ];
        return lines.join('\n');
      },
      performance: () => {
        if (agentPerformance.length === 0) return null;
        const headers = ['Agent','Handled','Resolved','Resolution Rate','Avg Time (h)','SLA Breaches','Status'];
        const rows = agentPerformance.map(a => {
          const avgHrs = a.resolved ? a.totalResTime/a.resolved/3600000 : 0;
          const resRate = a.count ? Math.round(a.resolved/a.count*100) : 0;
          const status = a.breaches===0 && a.resolved>0 ? 'Good' : a.breaches>0 ? 'Review' : 'Pending';
          return [a.name, a.count, a.resolved, `${resRate}%`, avgHrs.toFixed(1), a.breaches, status];
        });
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      },
      assets: () => {
        if (!assetStats) return null;
        const lines = [
          `Total Assets,,${assetStats.total}`,
          '',
          'By Status',
          'Status,Count',
          ...assetStats.byStatus.map(s => `${s.status},${s.count}`),
          '',
          'By Type',
          'Type,Count',
          ...assetStats.byType.map(t => `${t.asset_type},${t.count}`),
        ];
        return lines.join('\n');
      },
      knowledge: () => {
        if (!knowledgeStats) return null;
        const lines = [
          `Total Articles,,${knowledgeStats.total}`,
          '',
          'By Status',
          'Status,Count',
          ...knowledgeStats.byStatus.map(s => `${s.status},${s.count}`),
          '',
          'Top Viewed',
          'Title,Views,Helpful,Not Helpful',
          ...knowledgeStats.topViewed.map(v => `"${v.title.replace(/"/g,'""')}",${v.views},${v.helpful_count},${v.not_helpful_count}`),
        ];
        if (knowledgeStats.byCategory.length > 0) {
          lines.push('', 'By Category', 'Category,Count');
          lines.push(...knowledgeStats.byCategory.map(c => `${c.category||'Uncategorized'},${c.count}`));
        }
        return lines.join('\n');
      },
      ai: () => {
        if (!aiAnalytics) return null;
        const { summary } = aiAnalytics;
        const lines = [
          `Total Queries,,${summary.total_queries}`,
          `Avg Confidence,,${(summary.avg_confidence*100).toFixed(1)}%`,
          `Flagged for Review,,${summary.flagged_count}`,
          `Active Sources,,${summary.active_sources}`,
          `Total Sources,,${summary.total_sources}`,
        ];
        if (aiAnalytics.recent_queries.length > 0) {
          lines.push('', 'Recent Queries', 'Query,User,Confidence,Flagged');
          lines.push(...aiAnalytics.recent_queries.slice(0, 20).map(q =>
            `"${q.query.replace(/"/g,'""')}",${q.user_name||'Unknown'},${(q.confidence_score*100).toFixed(0)}%,${q.flagged_for_review?'Yes':'No'}`
          ));
        }
        return lines.join('\n');
      },
      portal: () => {
        const srCount = filteredTickets.filter(t => t.ticket_type === 'service_request').length;
        const selfServicePct = total ? Math.round((srCount/total)*100) : 0;
        const lines = [
          `Total Users,,${adminStats?.users?.total ?? 0}`,
          `Active Users,,${adminStats?.users?.active_count ?? 0}`,
          `Service Requests,,${srCount}`,
          `Self-Service Rate,,${selfServicePct}%`,
          `Total Tickets,,${total}`,
        ];
        return lines.join('\n');
      },
    };
    return generators[section]?.() ?? null;
  }, [filteredTickets, agentPerformance, assetStats, knowledgeStats, aiAnalytics, adminStats, slaStats, total, resolutionStats]);

  const exportSectionCSV = useCallback((section: string) => {
    const now = new Date().toISOString().split('T')[0];
    const csv = generateSectionCSV(section);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `resolv_report_${section}_${timeRange}_${now}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [generateSectionCSV, timeRange]);

  const exportAllSelected = useCallback(() => {
    const now = new Date().toISOString().split('T')[0];
    const selected = Object.entries(exportSections).filter(([, v]) => v).map(([k]) => k);

    const parts: string[] = [];
    selected.forEach(section => {
      const csv = generateSectionCSV(section);
      if (csv) {
        parts.push(`=== ${EXPORT_SECTION_LABELS[section]?.label || section} ===`);
        parts.push('');
        parts.push(csv);
        parts.push('');
        parts.push('');
      }
    });

    if (parts.length === 0) return;

    const fullCsv = parts.join('\n');
    const blob = new Blob([fullCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `resolv_full_report_${timeRange}_${now}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setShowExportModal(false);
  }, [exportSections, generateSectionCSV, timeRange]);

  const categoriesList = categories.filter(c => c !== 'all');

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'70vh', flexDirection:'column', gap:16 }}>
        <RefreshCcw className="animate-spin" size={32} color="var(--accent)" />
        <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Loading analytics...</p>
      </div>
    );
  }

  // ── Render Sections ────────────────────────────────────────────────────────
  const renderContent = () => {
    const renderExportBtn = (section: string, label: string) => (
      isAdminOrAgent && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
          <button onClick={() => exportSectionCSV(section)} className="btn btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Download size={13} /> Export {label}
          </button>
        </div>
      )
    );

    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'tickets':
        return renderTicketSection();
      case 'sla':
        return (
          <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {renderExportBtn('sla', 'SLA')}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16 }}>
              <div className="rp-card card" style={{ padding:24, borderRadius:14, textAlign:'center' }}>
                <div style={{ fontSize:40, fontWeight:800, color:slaStats.compliance >= 90 ? 'var(--success)' : slaStats.compliance >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                  {slaStats.compliance}%
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginTop:4 }}>SLA Compliance</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{total} tickets evaluated</div>
              </div>
              <div className="rp-card card" style={{ padding:24, borderRadius:14, textAlign:'center' }}>
                <div style={{ fontSize:40, fontWeight:800, color:'var(--danger)' }}>{slaStats.breached}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginTop:4 }}>SLA Breaches</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Missed deadlines</div>
              </div>
              <div className="rp-card card" style={{ padding:24, borderRadius:14, textAlign:'center' }}>
                <div style={{ fontSize:40, fontWeight:800, color:adminStats?.sla?.at_risk_count ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {adminStats?.sla?.at_risk_count ?? '—'}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginTop:4 }}>At Risk</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Due within 2 hours</div>
              </div>
              <div className="rp-card card" style={{ padding:24, borderRadius:14, textAlign:'center' }}>
                <div style={{ fontSize:40, fontWeight:800, color:'var(--accent)' }}>{resolutionStats.formatted}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginTop:4 }}>Avg Resolution</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Time to close</div>
              </div>
            </div>
            <CardSection title="SLA Breached Tickets" icon={Shield}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border)' }}>
                      {['#','Title','Priority','Assignee','Due Date'].map(h => (
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.filter(t => t.sla_breached).slice(0, 20).map(t => (
                      <tr key={t.id} style={{ borderBottom:'1px solid var(--border-subtle)', background:'var(--danger-bg)' }}>
                        <td style={{ padding:'10px 14px', color:'var(--text-muted)', fontSize:11 }}>#{t.number}</td>
                        <td style={{ padding:'10px 14px', fontWeight:500, maxWidth:250, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ fontSize:11, fontWeight:600, color:'var(--danger)' }}>{t.priority}</span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>{t.assigned_to_name||'Unassigned'}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'var(--danger)', fontWeight:500 }}>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredTickets.filter(t => t.sla_breached).length === 0 && (
                      <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:'var(--success)' }}>
                        <CheckCircle2 size={20} style={{ margin:'0 auto 8px' }} />
                        <div style={{ fontSize:14, fontWeight:600 }}>No SLA breaches!</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>All tickets are meeting their deadlines.</div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardSection>
          </div>
        );
      case 'performance':
        return renderPerformanceSection();
      case 'assets':
        return (
          <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {renderExportBtn('assets', 'Assets')}
            <AssetReports stats={assetStats} />
          </div>
        );
      case 'knowledge':
        return (
          <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {renderExportBtn('knowledge', 'Knowledge')}
            <KnowledgeReports stats={knowledgeStats} />
          </div>
        );
      case 'ai':
        return (
          <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {renderExportBtn('ai', 'AI')}
            <AIReports stats={aiAnalytics} />
          </div>
        );
      case 'portal':
        return (
          <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {renderExportBtn('portal', 'Portal')}
            <PortalReports {...portalStats} />
          </div>
        );
      default:
        return renderOverview();
    }
  };

  // ── OVERVIEW ────────────────────────────────────────────────────────────────
  const renderOverview = () => {
    const typeSegments = typeBreakdown.map(([type, count]) => ({
      label: type.replace('_',' '), value: count,
      color: TYPE_COLORS[type] || 'var(--accent)',
    }));
    const statusSegments = statusBreakdown.map(([status, count]) => ({
      label: status.replace('_',' '), value: count,
      color: STATUS_COLORS[status] || 'var(--text-muted)',
    }));

    return (
      <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
        {/* Section export button */}
        {isAdminOrAgent && (
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => { setExportSections(prev => Object.keys(prev).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>)); setTimeout(() => setShowExportModal(true), 50); }} className="btn btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Download size={13} /> Export Overview
            </button>
          </div>
        )}
        {/* Top KPI Row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
          <KPICard label="SLA Compliance" value={`${slaStats.compliance}%`} sub={`${slaStats.breached} breaches`} icon={Target} color="var(--success)" bg="var(--success-bg)" border="var(--success-border)" />
          <KPICard label="First Response" value={responseStats.formatted} sub="Avg time to reply" icon={Activity} color="var(--accent)" bg="var(--accent-subtle)" border="var(--accent-border)" />
          <KPICard label="Avg Resolution" value={resolutionStats.formatted} sub="Time to close" icon={Clock} color="var(--warning)" bg="var(--warning-bg)" border="var(--warning-border)" />
          {isAdminOrAgent && <KPICard label="Open Tickets" value={openCount} sub={`${progressCount} in progress`} icon={AlertCircle} color="var(--info)" bg="var(--info-bg)" border="var(--info-border)" />}
        </div>

        {/* Donuts */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:20 }}>
          {/* Status Distribution */}
          <CardSection title="Status Distribution" icon={BarChart2}>
            <div style={{ display:'flex', gap:24, alignItems:'center' }}>
              <DonutChart segments={statusSegments} total={total} size={100} />
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {statusBreakdown.map(([s, c]) => (
                  <div key={s} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:STATUS_COLORS[s]||'var(--text-muted)', flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:12, fontWeight:500, color:'var(--text)', textTransform:'capitalize' }}>{s.replace('_',' ')}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{c}</span>
                    <MiniBar value={c} max={maxStatusVal} color={STATUS_COLORS[s]||'var(--text-muted)'} />
                  </div>
                ))}
              </div>
            </div>
          </CardSection>

          {/* Type Distribution */}
          <CardSection title="Ticket Types" icon={PieChart}>
            <div style={{ display:'flex', gap:24, alignItems:'center' }}>
              <DonutChart segments={typeSegments} total={total} size={100} />
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {typeBreakdown.map(([ty, c]) => (
                  <div key={ty} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:TYPE_COLORS[ty]||'var(--accent)', flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:12, fontWeight:500, color:'var(--text)', textTransform:'capitalize' }}>{ty.replace('_',' ')}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{c}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)', width:36, textAlign:'right' }}>{total?Math.round(c/total*100):0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardSection>
        </div>

        {/* Time-series chart */}
        {isAdminOrAgent && tsPoints.length > 0 && (
          <CardSection title="Ticket Volume Over Time" icon={TrendingUp}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:140 }}>
              {tsPoints.map((p, i) => {
                const createdH = tsMaxCreated ? (p.created||0)/tsMaxCreated*100 : 0;
                const resolvedH = tsMaxCreated ? (p.resolved||0)/tsMaxCreated*100 : 0;
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, height:'100%', justifyContent:'flex-end' }}>
                    <div style={{ width:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:1, height:'100%' }}>
                      <div style={{ height:`${createdH}%`, background:'var(--accent)', borderRadius:'2px 2px 0 0', opacity:0.7, transition:'height 0.5s ease', minHeight: createdH>0?2:0 }} />
                      <div style={{ height:`${resolvedH}%`, background:'var(--success)', borderRadius:'2px 2px 0 0', opacity:0.6, transition:'height 0.5s ease', minHeight: resolvedH>0?2:0 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:'flex', gap:16, marginTop:12, justifyContent:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                <div style={{ width:8, height:8, borderRadius:2, background:'var(--accent)', opacity:0.7 }} /> Created
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                <div style={{ width:8, height:8, borderRadius:2, background:'var(--success)', opacity:0.6 }} /> Resolved
              </div>
            </div>
          </CardSection>
        )}

        {/* Category breakdown */}
        <CardSection title="Top Categories" icon={Layers}>
          {categoryBreakdown.length === 0 ? (
            <div style={{ textAlign:'center', padding:24, color:'var(--text-muted)', fontSize:13 }}>No categories found</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {categoryBreakdown.map(([cat, count]) => (
                <div key={cat} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600 }}>
                    <span style={{ color:'var(--text)' }}>{cat}</span>
                    <span style={{ color:'var(--text-muted)' }}>{count}</span>
                  </div>
                  <div style={{ height:8, background:'var(--bg-tertiary)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(count/maxCategoryVal)*100}%`, background:'var(--accent)', borderRadius:4, transition:'width 1s ease-out' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardSection>

        {/* Domain summary cards */}
        {isAdminOrAgent && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16 }}>
            <div className="rp-card card" style={{ padding:20, borderRadius:14, border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <Monitor size={14} color="var(--info)" /> <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Assets</span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>{assetStats?.total ?? '—'}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Total assets tracked</div>
            </div>
            <div className="rp-card card" style={{ padding:20, borderRadius:14, border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <BookOpen size={14} color="var(--success)" /> <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Knowledge Base</span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>{knowledgeStats?.total ?? '—'}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                {knowledgeStats ? `${knowledgeStats.byStatus.find(s=>s.status==='published')?.count||0} published` : 'Articles'}
              </div>
            </div>
            <div className="rp-card card" style={{ padding:20, borderRadius:14, border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <Bot size={14} color="var(--accent)" /> <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>AI Queries</span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>{aiAnalytics?.summary?.total_queries ?? '—'}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                {aiAnalytics ? `${Math.round(aiAnalytics.summary.avg_confidence*100)}% avg confidence` : 'AI analytics'}
              </div>
            </div>
            <div className="rp-card card" style={{ padding:20, borderRadius:14, border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <Users size={14} color="var(--warning)" /> <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Users</span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>{adminStats?.users?.total ?? '—'}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{adminStats?.users?.active_count ?? 0} active</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── TICKETS ─────────────────────────────────────────────────────────────────
  const renderTicketSection = () => (
    <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Filters */}
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>
          <Filter size={13} /> Filters:
        </div>
        <div style={{ position:'relative', flex:1, maxWidth:280 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input className="input" placeholder="Search tickets..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding:'6px 10px 6px 30px', fontSize:12, width:'100%' }} />
        </div>
        <select className="select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ maxWidth:180, fontSize:12 }}>
          <option value="all">All Categories</option>
          {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ maxWidth:140, fontSize:12 }}>
          <option value="all">All Priorities</option>
          {['critical','high','medium','low'].map(p => <option key={p} value={p} style={{ textTransform:'capitalize' }}>{p}</option>)}
        </select>
        <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth:140, fontSize:12 }}>
          <option value="all">All Statuses</option>
          {['open','in_progress','pending','resolved','closed'].map(s => <option key={s} value={s} style={{ textTransform:'capitalize' }}>{s.replace('_',' ')}</option>)}
        </select>
        {filteredTickets.length > 0 && (
          <button onClick={() => exportSectionCSV('tickets')} className="btn btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
            <Download size={13} /> CSV
          </button>
        )}
      </div>

      {/* Priority Distribution */}
      <CardSection title="Priority Distribution" icon={Shield}>
        {priorityBreakdown.map(([p, count]) => {
          const pct = total ? (count/total)*100 : 0;
          const color = PRIORITY_COLORS[p] || 'var(--text-muted)';
          return (
            <div key={p} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
              <span style={{ width:64, fontSize:12, fontWeight:600, color:'var(--text)', textTransform:'capitalize' }}>{p}</span>
              <div style={{ flex:1, height:10, background:'var(--bg-tertiary)', borderRadius:5, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:5, transition:'width 1s ease-out' }} />
              </div>
              <span style={{ width:36, textAlign:'right', fontSize:13, fontWeight:700, color:'var(--text)' }}>{count}</span>
              <span style={{ width:36, textAlign:'right', fontSize:11, color:'var(--text-muted)' }}>{Math.round(pct)}%</span>
            </div>
          );
        })}
      </CardSection>

      {/* Ticket Table */}
      <CardSection title={`Tickets (${total})`} icon={FileText}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['#','Title','Status','Priority','Type','Category','Assignee'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTickets.slice(0, 50).map(t => (
                <tr key={t.id} style={{ borderBottom:'1px solid var(--border-subtle)', transition:'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding:'10px 14px', color:'var(--text-muted)', fontSize:11 }}>#{t.number}</td>
                  <td style={{ padding:'10px 14px', fontWeight:500, maxWidth:250, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:600, textTransform:'capitalize',
                      background:(STATUS_COLORS[t.status]||'var(--bg-tertiary)')+'20', color:STATUS_COLORS[t.status]||'var(--text-muted)',
                      border:`1px solid ${STATUS_COLORS[t.status]||'var(--border)'}20` }}>
                      {t.status.replace('_',' ')}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:PRIORITY_COLORS[t.priority]||'var(--text)', textTransform:'capitalize' }}>{t.priority}</span>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)', textTransform:'capitalize' }}>{(t.ticket_type||'').replace('_',' ')}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>{t.category_name||'—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>{t.assigned_to_name||'Unassigned'}</td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'var(--text-muted)' }}>No tickets match the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardSection>
    </div>
  );

  // ── PERFORMANCE ─────────────────────────────────────────────────────────────
  const renderPerformanceSection = () => (
    <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Agent cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16 }}>
        {agentPerformance.slice(0, 8).map(agent => {
          const avgHrs = agent.resolved ? agent.totalResTime/agent.resolved/3600000 : 0;
          return (
            <div key={agent.name} className="rp-card card" style={{ padding:20, borderRadius:14, textAlign:'center' }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--accent-subtle)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', fontSize:16, fontWeight:700, color:'var(--accent)' }}>
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{agent.name}</div>
              <div style={{ display:'flex', justifyContent:'center', gap:16, fontSize:11, color:'var(--text-muted)' }}>
                <span>{agent.count} tickets</span>
                <span>{agent.resolved} resolved</span>
              </div>
              <div style={{ marginTop:6 }}>
                {agent.breaches > 0 ? (
                  <span style={{ padding:'2px 8px', borderRadius:8, background:'var(--danger-bg)', color:'var(--danger)', fontSize:10, fontWeight:700 }}>
                    {agent.breaches} breaches
                  </span>
                ) : (
                  <span style={{ padding:'2px 8px', borderRadius:8, background:'var(--success-bg)', color:'var(--success)', fontSize:10, fontWeight:700 }}>
                    0 breaches
                  </span>
                )}
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>
                Avg {agent.resolved ? (avgHrs < 1 ? `${Math.round(avgHrs*60)}m` : `${avgHrs.toFixed(1)}h`) : '—'}
              </div>
            </div>
          );
        })}
        {agentPerformance.length === 0 && (
          <div className="card" style={{ gridColumn:'1/-1', padding:40, textAlign:'center', color:'var(--text-muted)' }}>
            No agent performance data available.
          </div>
        )}
      </div>

      {/* Detailed table */}
      <CardSection title="Agent Performance Details" icon={Users}>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
          {agentPerformance.length > 0 && (
            <button onClick={() => exportSectionCSV('performance')} className="btn btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Download size={13} /> Export CSV
            </button>
          )}
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['Agent','Handled','Resolved','Resolution Rate','Avg Time','SLA Breaches','Status'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'12px 16px', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map(agent => {
                const avgHrs = agent.resolved ? agent.totalResTime/agent.resolved/3600000 : 0;
                const resRate = agent.count ? Math.round(agent.resolved/agent.count*100) : 0;
                const resText = !agent.resolved ? '—' : avgHrs < 1 ? `${Math.round(avgHrs*60)} min` : avgHrs < 24 ? `${avgHrs.toFixed(1)}h` : `${(avgHrs/24).toFixed(1)}d`;
                return (
                  <tr key={agent.name} style={{ borderBottom:'1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding:'12px 16px', fontWeight:600, color:'var(--text)' }}>{agent.name}</td>
                    <td style={{ padding:'12px 16px', fontWeight:700 }}>{agent.count}</td>
                    <td style={{ padding:'12px 16px' }}>{agent.resolved}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:6, background:'var(--bg-tertiary)', borderRadius:3, overflow:'hidden', maxWidth:80 }}>
                          <div style={{ height:'100%', width:`${resRate}%`, background:resRate>=80?'var(--success)':resRate>=50?'var(--warning)':'var(--danger)', borderRadius:3 }} />
                        </div>
                        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)' }}>{resRate}%</span>
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px', color:'var(--text-muted)', fontSize:12 }}>{resText}</td>
                    <td style={{ padding:'12px 16px' }}>
                      {agent.breaches > 0
                        ? <span style={{ padding:'2px 8px', borderRadius:10, background:'var(--danger-bg)', color:'var(--danger)', fontSize:11, fontWeight:700 }}>{agent.breaches}</span>
                        : <span style={{ color:'var(--success)', fontSize:11, fontWeight:600 }}>0</span>}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{
                        padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:600,
                        background: agent.breaches===0 && agent.resolved>0 ? 'var(--success-bg)' : agent.breaches>0 ? 'var(--warning-bg)' : 'var(--bg-tertiary)',
                        color: agent.breaches===0 && agent.resolved>0 ? 'var(--success)' : agent.breaches>0 ? 'var(--warning)' : 'var(--text-muted)',
                      }}>
                        {agent.breaches===0 && agent.resolved>0 ? 'Good' : agent.breaches>0 ? 'Review' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardSection>
    </div>
  );

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .rp-fade { animation: fadeUp 0.4s ease-out both; }
        .rp-card { transition: box-shadow 0.2s ease, border-color 0.2s ease; }
        .rp-card:hover { box-shadow: var(--shadow-md); border-color: var(--accent-border) !important; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ padding:'28px 32px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1400, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
            <div>
              <h1 style={{ fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:4 }}>
                Reports & Analytics
              </h1>
              <p style={{ color:'var(--text-muted)', fontSize:13 }}>
                {isAdminOrAgent ? 'Full ITSM reporting across all modules' : 'Your personal ticket insights'}
                {' · '}<span style={{ fontWeight:600, color:'var(--text-secondary)' }}>{total}</span> ticket{total !== 1 ? 's' : ''} in view
              </p>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ display:'flex', background:'var(--bg)', padding:3, borderRadius:8, border:'1px solid var(--border)' }}>
                {(['7d','30d','90d','all'] as TimeRange[]).map(r => (
                  <button key={r} onClick={() => setTimeRange(r)} style={{
                    padding:'6px 12px', fontSize:12, fontWeight:600, borderRadius:6, border:'none',
                    background: timeRange===r ? 'var(--accent)' : 'transparent',
                    color: timeRange===r ? 'white' : 'var(--text-muted)', cursor:'pointer',
                    transition:'all 0.15s',
                  }}>
                    {r==='7d'?'7D':r==='30d'?'30D':r==='90d'?'90D':'All'}
                  </button>
                ))}
              </div>
              {isAdminOrAgent && (
                <button onClick={() => setShowExportModal(true)} className="btn btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Download size={13} /> Export All
                </button>
              )}
              {error && (
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:6, background:'var(--danger-bg)', color:'var(--danger)', fontSize:12 }}>
                  <AlertTriangle size={13} /> {error}
                  <button onClick={() => fetchData()} style={{ background:'none', border:'none', color:'var(--danger)', cursor:'pointer', fontWeight:600, marginLeft:4 }}>Retry</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Navigation Tabs ─────────────────────────────────────────────── */}
          <div style={{ display:'flex', gap:4, marginTop:16, flexWrap:'wrap' }}>
            {TABS.filter(t => !t.adminOnly || isAdminOrAgent).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'7px 14px', borderRadius:6, border:'none', fontSize:12, fontWeight:600,
                cursor:'pointer',
                background: activeTab===tab.key ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab===tab.key ? 'var(--accent)' : 'var(--text-muted)',
                transition:'all 0.15s',
              }}>
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth:1400, margin:'0 auto', padding:'24px 32px 60px', width:'100%' }}>
        {renderContent()}
      </div>

      {/* ── Export Modal ──────────────────────────────────────────────────── */}
      {showExportModal && (
        <div style={{
          position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.6)', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center',
          backdropFilter:'blur(4px)',
        }} onClick={() => setShowExportModal(false)}>
          <div className="rp-fade" style={{
            backgroundColor:'var(--card)', border:'1px solid var(--border)',
            borderRadius:16, padding:0, width:'100%', maxWidth:480,
            position:'relative', boxShadow:'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'20px 24px', borderBottom:'1px solid var(--border)',
            }}>
              <div>
                <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'var(--text)' }}>
                  Export Report Data
                </h3>
                <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--text-muted)' }}>
                  Select which sections to include in the export
                </p>
              </div>
              <button onClick={() => setShowExportModal(false)} style={{
                background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer',
                padding:4, borderRadius:6, transition:'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Section checkboxes */}
            <div style={{ padding:'16px 24px' }}>
              {Object.entries(EXPORT_SECTION_LABELS)
                .filter(([, config]) => !config.adminOnly || isAdminOrAgent)
                .map(([key, config]) => {
                  const Icon = config.icon;
                  const checked = exportSections[key];
                  return (
                    <div key={key} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'10px 12px', borderRadius:8, cursor:'pointer',
                      background: checked ? 'var(--accent-subtle)' : 'transparent',
                      border:`1px solid ${checked ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                      marginBottom:8, transition:'all 0.15s',
                    }} onClick={() => toggleExportSection(key)}>
                      <div style={{
                        width:20, height:20, borderRadius:4,
                        background: checked ? 'var(--accent)' : 'var(--bg-tertiary)',
                        border:`1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all 0.15s',
                      }}>
                        {checked && <CheckSquare size={12} color="white" />}
                      </div>
                      <Icon size={16} color={checked ? 'var(--accent)' : 'var(--text-muted)'} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color: checked ? 'var(--accent)' : 'var(--text)' }}>{config.label}</div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Actions */}
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'16px 24px', borderTop:'1px solid var(--border)',
              background:'var(--bg-secondary)', borderRadius:'0 0 16px 16px',
            }}>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                {timeRange === 'all' ? 'All time' : `Last ${timeRange}`}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowExportModal(false)} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
                <button onClick={exportAllSelected} className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Download size={13} /> Export Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
