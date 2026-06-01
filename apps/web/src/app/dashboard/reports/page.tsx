'use client';

import { useState, useEffect, useMemo } from 'react';
import { api, API_BASE } from '@/lib/api';
import { useStore } from '@/lib/store';
import {
  BarChart2, PieChart, TrendingUp, Download, FileText,
  User, AlertCircle, RefreshCcw, Target, Activity, Layers,
  Clock, CheckCircle2, Shield, Zap, Filter, ChevronDown,
  Calendar, Users, Monitor, HardDrive, Wifi, Search
} from 'lucide-react';

type TimeRange = '7d' | '30d' | '90d' | 'all';
type ViewMode = 'overview' | 'tickets' | 'sla' | 'performance';

interface Ticket {
  id: string; number: number; title: string; status: string;
  priority: string; created_at: string; updated_at: string;
  assigned_to_id: string | null; assigned_to_name: string | null;
  category_id: string | null; category_name: string | null;
  sla_breached: boolean; first_response_at: string | null;
  ticket_type: string; due_date: string | null; resolved_at: string | null;
  closed_at?: string | null;
}

interface AdminStats {
  tickets: { total: number; by_status: Record<string,number>; by_priority: Record<string,number>;
    by_type: Record<string,number>; created_today: number; resolved_today: number;
    avg_resolution_hours: number; };
  users: { total: number; by_role: Record<string,number>; active_count: number; };
  sla: { breached_count: number; at_risk_count: number; };
}

interface TimeSeriesPoint { date: string; created?: number; resolved?: number; breached?: number; hours?: number; }

const STATUS_COLORS: Record<string, string> = {
  open: 'var(--info)', in_progress: 'var(--warning)',
  pending: '#8b5cf6', resolved: 'var(--success)', closed: 'var(--text-muted)',
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)', high: '#f97316', medium: 'var(--warning)', low: 'var(--success)',
};
const TYPE_COLORS: Record<string, string> = {
  incident: 'var(--danger)', service_request: 'var(--info)',
  problem: 'var(--warning)', change: '#7c3aed',
};

const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div style={{ height: 4, flex: 1, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden', minWidth: 40 }}>
    <div style={{ height: '100%', width: `${max ? (value/max)*100 : 0}%`, background: color, borderRadius: 2, transition: 'width 1s ease-out' }} />
  </div>
);

const TrendIndicator = ({ data, color, height }: { data: number[]; color: string; height?: number }) => {
  const h = height || 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: h, width: 52, flexShrink: 0 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, background: color,
          height: `${Math.max(((v - min) / range) * 100, 8)}%`,
          opacity: 0.35 + (i / data.length) * 0.65,
          borderRadius: '1px 1px 0 0',
          transition: 'height 0.4s ease',
        }} />
      ))}
    </div>
  );
};

const DonutChart = ({ segments, total, size }: { segments: { label: string; value: number; color: string }[]; total: number; size: number }) => {
  const strokeW = size * 0.22;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((seg, i) => {
          const pct = total ? seg.value / total : 0;
          const dash = pct * circ;
          const segOffset = offset;
          offset += dash;
          return (
            <circle key={i} cx={size/2} cy={size/2} r={r}
              fill="none" stroke={seg.color} strokeWidth={strokeW}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-segOffset}
              style={{ transition: 'stroke-dasharray 1s ease-out, stroke-dashoffset 1s ease-out' }}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontSize: size * 0.24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: size * 0.13, color: 'var(--text-muted)' }}>total</span>
      </div>
    </div>
  );
};

export default function ReportsPage() {
  const { user } = useStore();
  const role = user?.role || 'user';
  const isAdminOrAgent = role === 'admin' || role === 'agent';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [timeSeries, setTimeSeries] = useState<{ tickets: TimeSeriesPoint[]; sla: TimeSeriesPoint[]; avg_resolution: TimeSeriesPoint[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      setLoading(true); setError(null);
      try {
        // Fetch user's tickets (for end users and as fallback)
        const ticketRes = await api.get<{ data: Ticket[] }>('/tickets?pageSize=200');
        setTickets(ticketRes.data || []);

        // Fetch admin stats for agents/admins
        if (isAdminOrAgent) {
          try {
            const statsRes = await api.get<{ data: AdminStats }>('/admin/stats');
            setAdminStats(statsRes.data);
          } catch { /* stats endpoint may not be available */ }
          try {
            const tsRes = await api.get<{ data: { tickets: TimeSeriesPoint[]; sla: TimeSeriesPoint[]; avg_resolution: TimeSeriesPoint[] } }>(`/admin/stats/time-series?range=${timeRange}`);
            setTimeSeries(tsRes.data);
          } catch { /* time-series endpoint may not be available */ }
        }
      } catch (err) {
        console.error('Failed to fetch report data:', err);
        setError('Failed to load report data. Please try again.');
      } finally { setLoading(false); }
    }
    fetchData();
  }, [timeRange, isAdminOrAgent]);

  // ── Filtered tickets ──────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    let data = tickets;
    if (timeRange !== 'all') {
      const now = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      data = data.filter(t => new Date(t.created_at) >= cutoff);
    }
    if (categoryFilter !== 'all') data = data.filter(t => (t.category_name || 'Uncategorized') === categoryFilter);
    if (priorityFilter !== 'all') data = data.filter(t => t.priority === priorityFilter);
    return data;
  }, [tickets, timeRange, categoryFilter, priorityFilter]);

  // ── Computed metrics ──────────────────────────────────────────────────────
  const total = filteredTickets.length;

  const slaStats = useMemo(() => {
    const breached = filteredTickets.filter(t => t.sla_breached).length;
    return { breached, compliance: total ? Math.round(((total - breached) / total) * 100) : 100, trend: Array(7).fill(0) };
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
  const resolvedCount = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase())).length;

  // ── Breakdowns ────────────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { m[t.status] = (m[t.status] || 0) + 1; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }, [filteredTickets]);

  const priorityBreakdown = useMemo(() => {
    const m: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    filteredTickets.forEach(t => { const p = t.priority?.toLowerCase() || 'low'; m[p] = (m[p]||0)+1; });
    return Object.entries(m);
  }, [filteredTickets]);

  const typeBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const ty = t.ticket_type || 'incident'; m[ty] = (m[ty]||0)+1; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }, [filteredTickets]);

  const categoryBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const c = t.category_name || 'Uncategorized'; m[c] = (m[c]||0)+1; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0, 6);
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
      if (['resolved','closed'].includes(t.status.toLowerCase())) {
        agents[id].resolved++;
        agents[id].totalResTime += new Date(t.resolved_at||t.closed_at||t.updated_at).getTime() - new Date(t.created_at).getTime();
      }
    });
    return Object.values(agents).sort((a,b) => b.count - a.count);
  }, [filteredTickets]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['ID','#','Title','Status','Priority','Type','Category','Created','Assignee','SLA Breached','Due Date'];
    const rows = filteredTickets.map(t => [
      t.id, t.number, `"${t.title.replace(/"/g,'""')}"`, t.status, t.priority,
      t.ticket_type, t.category_name||'Uncategorized', t.created_at,
      t.assigned_to_name||'Unassigned', t.sla_breached?'Yes':'No', t.due_date||'',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `report_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const maxStatusVal = Math.max(...statusBreakdown.map(s => s[1]), 1);
  const maxCategoryVal = Math.max(...categoryBreakdown.map(c => c[1]), 1);
  const maxPriorityVal = Math.max(...priorityBreakdown.map(p => p[1]), 1);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'70vh', flexDirection:'column', gap:16 }}>
        <RefreshCcw className="animate-spin" size={32} color="var(--accent)" />
        <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Loading analytics...</p>
      </div>
    );
  }

  // ── Donut chart segments ──────────────────────────────────────────────────
  const typeSegments = typeBreakdown.map(([type, count]) => ({
    label: type.replace('_',' '), value: count,
    color: TYPE_COLORS[type] || 'var(--accent)',
  }));

  const statusSegments = statusBreakdown.map(([status, count]) => ({
    label: status.replace('_',' '), value: count,
    color: STATUS_COLORS[status] || 'var(--text-muted)',
  }));

  // ── Time-series chart data ────────────────────────────────────────────────
  const tsPoints = timeSeries?.tickets || [];
  const tsMaxCreated = Math.max(...tsPoints.map(p => p.created || 0), 1);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .rp-fade { animation: fadeUp 0.4s ease-out both; }
        .rp-card { transition: box-shadow 0.2s ease, border-color 0.2s ease; }
        .rp-card:hover { box-shadow: var(--shadow-md); border-color: var(--accent-border) !important; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '28px 32px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing:'-0.02em', marginBottom: 4 }}>
                Reports & Analytics
              </h1>
              <p style={{ color:'var(--text-muted)', fontSize: 13 }}>
                {isAdminOrAgent ? 'System-wide insights' : 'Your personal ticket insights'}
                {' · '}{total} ticket{total !== 1 ? 's' : ''} in view
              </p>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {/* Time range */}
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
              <button onClick={exportCSV} className="btn btn-secondary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          {/* View mode tabs */}
          <div style={{ display:'flex', gap:4, marginTop:16 }}>
            {([
              { key:'overview' as ViewMode, label:'Overview', icon:BarChart2 },
              { key:'tickets' as ViewMode, label:'Tickets', icon:FileText },
              { key:'sla' as ViewMode, label:'SLA', icon:Shield },
              ...(isAdminOrAgent ? [{ key:'performance' as ViewMode, label:'Performance', icon:Users }] : []),
            ]).map(tab => (
              <button key={tab.key} onClick={() => setViewMode(tab.key)} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'7px 14px', borderRadius:6, border:'none', fontSize:12, fontWeight:600,
                cursor:'pointer',
                background: viewMode===tab.key ? 'var(--accent-subtle)' : 'transparent',
                color: viewMode===tab.key ? 'var(--accent)' : 'var(--text-muted)',
                transition:'all 0.15s',
              }}>
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin:'0 auto', padding:'24px 32px 60px', width:'100%' }}>

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'overview' && (
        <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* Top KPI row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
            {[
              { label:'SLA Compliance', value:`${slaStats.compliance}%`, sub:`${slaStats.breached} breaches`, icon:Target, color:'var(--success)', bg:'var(--success-bg)', border:'var(--success-border)' },
              { label:'First Response', value:responseStats.formatted, sub:'Avg time to reply', icon:Activity, color:'var(--accent)', bg:'var(--accent-subtle)', border:'var(--accent-border)' },
              { label:'Avg Resolution', value:resolutionStats.formatted, sub:'Time to close', icon:Clock, color:'var(--warning)', bg:'var(--warning-bg)', border:'var(--warning-border)' },
              ...(isAdminOrAgent ? [{ label:'Open Tickets', value:openCount, sub:`${progressCount} in progress`, icon:AlertCircle, color:'var(--info)', bg:'var(--info-bg)', border:'var(--info-border)' }] : []),
            ].map((kpi, i) => (
              <div key={i} className="rp-card card" style={{
                padding:'20px 24px', borderRadius:14, border:`1px solid var(--border)`,
                display:'flex', flexDirection:'column', gap:8,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{kpi.label}</span>
                  <div style={{ width:36, height:36, borderRadius:10, background:kpi.bg, border:`1px solid ${kpi.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <kpi.icon size={16} color={kpi.color} />
                  </div>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color:'var(--text)', lineHeight:1 }}>{kpi.value}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Middle row: Donuts + Breakdowns */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:20 }}>
            {/* Status Distribution */}
            <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
                <BarChart2 size={16} /> Status Distribution
              </div>
              <div style={{ padding:20, display:'flex', gap:24, alignItems:'center' }}>
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
            </div>

            {/* Type Distribution */}
            <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
                <PieChart size={16} /> Ticket Types
              </div>
              <div style={{ padding:20, display:'flex', gap:24, alignItems:'center' }}>
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
            </div>
          </div>

          {/* Time-series chart (admin/agent) */}
          {isAdminOrAgent && tsPoints.length > 0 && (
            <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
                <TrendingUp size={16} /> Ticket Volume Over Time
              </div>
              <div style={{ padding:20 }}>
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
                <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:'var(--accent)', opacity:0.7 }} /> Created
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:'var(--success)', opacity:0.6 }} /> Resolved
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category breakdown */}
          <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
              <Layers size={16} /> Top Categories
            </div>
            <div style={{ padding:20 }}>
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
            </div>
          </div>
        </div>
      )}

      {/* ── TICKETS ──────────────────────────────────────────────────────── */}
      {viewMode === 'tickets' && (
        <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {/* Filters */}
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>
              <Filter size={13} /> Filters:
            </div>
            <select className="select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ maxWidth:200, fontSize:12 }}>
              <option value="all">All Categories</option>
              {categories.filter(c => c!=='all').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ maxWidth:160, fontSize:12 }}>
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Priority Distribution */}
          <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
              <Shield size={16} /> Priority Distribution
            </div>
            <div style={{ padding:24 }}>
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
            </div>
          </div>

          {/* Ticket Summary Table */}
          <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
              <FileText size={16} /> Recent Tickets ({total})
            </div>
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
                  {filteredTickets.slice(0, 20).map(t => (
                    <tr key={t.id} style={{ borderBottom:'1px solid var(--border-subtle)', transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding:'10px 14px', color:'var(--text-muted)', fontSize:11 }}>#{t.number}</td>
                      <td style={{ padding:'10px 14px', fontWeight:500, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:600, textTransform:'capitalize', background:(STATUS_COLORS[t.status]||'var(--bg-tertiary)')+'20', color:STATUS_COLORS[t.status]||'var(--text-muted)', border:`1px solid ${STATUS_COLORS[t.status]||'var(--border)'}20` }}>
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
          </div>
        </div>
      )}

      {/* ── SLA ──────────────────────────────────────────────────────────── */}
      {viewMode === 'sla' && (
        <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
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

          {/* Breached tickets list */}
          <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
              <Shield size={16} /> SLA Breached Tickets
            </div>
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
                      <td style={{ padding:'10px 14px', fontWeight:500, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</td>
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
          </div>
        </div>
      )}

      {/* ── PERFORMANCE (admin/agent) ─────────────────────────────────────── */}
      {viewMode === 'performance' && isAdminOrAgent && (
        <div className="rp-fade" style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {/* Agent performance summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16 }}>
            {agentPerformance.slice(0, 6).map(agent => {
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
              <div className="card" style={{ gridColumn:'1/-1', padding:40, textAlign:'center', color:'var(--text-muted)' }}>No agent performance data available.</div>
            )}
          </div>

          {/* Detailed table */}
          <div className="rp-card card" style={{ borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}>
              <Users size={16} /> Agent Performance Details
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
                          {agent.breaches > 0 ? <span style={{ padding:'2px 8px', borderRadius:10, background:'var(--danger-bg)', color:'var(--danger)', fontSize:11, fontWeight:700 }}>{agent.breaches}</span>
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
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
