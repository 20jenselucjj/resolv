'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { 
  BarChart2, PieChart, TrendingUp,
  User, AlertCircle, RefreshCcw, Download,
  Target, Activity, Layers
} from 'lucide-react';

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface Ticket {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  category_id: string | null;
  category_name: string | null;
  sla_breached: boolean;
  first_response_at: string | null;
  ticket_type: string;
  due_date: string | null;
  resolved_at: string | null;
  closed_at?: string | null;
}

const Sparkline = ({ data, color }: { data: number[], color: string }) => {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, width: 48 }}>
      {data.map((val, i) => (
        <div key={i} style={{ 
          flex: 1, 
          background: color, 
          height: `${Math.max((val / max) * 100, 10)}%`,
          opacity: i === 6 ? 1 : 0.4 + (i * 0.1),
          borderRadius: '1px 1px 0 0'
        }} />
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const { user } = useStore();

  useEffect(() => {
    async function fetchTickets() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get<{ data: Ticket[] }>('/tickets?pageSize=100');
        setTickets(response.data || []);
      } catch (err) {
        console.error('Failed to fetch tickets for reports:', err);
        setError('Failed to load report data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    if (timeRange === 'all') return tickets;
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return tickets.filter(t => new Date(t.created_at) >= cutoff);
  }, [tickets, timeRange]);

  // Helper for trend sparklines (grouping by time buckets)
  const generateTrend = (data: Ticket[], metric: (group: Ticket[]) => number) => {
    if (data.length === 0) return Array(7).fill(0);
    const now = new Date().getTime();
    const range = timeRange === 'all' ? 365 : timeRange === '90d' ? 90 : timeRange === '30d' ? 30 : 7;
    const bucketSize = (range * 24 * 60 * 60 * 1000) / 7;
    
    const buckets = Array(7).fill(0).map(() => [] as Ticket[]);
    data.forEach(t => {
      const tTime = new Date(t.created_at).getTime();
      const diff = now - tTime;
      const bucketIdx = 6 - Math.floor(diff / bucketSize);
      if (bucketIdx >= 0 && bucketIdx < 7) {
        buckets[bucketIdx].push(t);
      }
    });
    
    return buckets.map(b => metric(b));
  };

  // 1. SLA Breach Metric
  const slaStats = useMemo(() => {
    const total = filteredTickets.length;
    if (total === 0) return { breached: 0, compliance: 100, trend: Array(7).fill(0) };
    const breached = filteredTickets.filter(t => t.sla_breached).length;
    
    const trend = generateTrend(filteredTickets, group => {
      if (!group.length) return 100;
      return 100 - (group.filter(t => t.sla_breached).length / group.length) * 100;
    });

    return { 
      breached, 
      compliance: Math.round(((total - breached) / total) * 100),
      trend 
    };
  }, [filteredTickets, timeRange]);

  // 2. First Response Time (hours)
  const firstResponseStats = useMemo(() => {
    const responded = filteredTickets.filter(t => t.first_response_at);
    if (!responded.length) return { avg: 0, formatted: 'N/A', trend: Array(7).fill(0) };
    
    const computeAvg = (group: Ticket[]) => {
      if (!group.length) return 0;
      const sum = group.reduce((acc, t) => {
        return acc + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime());
      }, 0);
      return sum / group.length / (1000 * 60 * 60);
    };

    const avgHours = computeAvg(responded);
    const trend = generateTrend(responded, computeAvg);
    
    return {
      avg: avgHours,
      formatted: avgHours < 1 ? `${Math.round(avgHours * 60)} min` : `${avgHours.toFixed(1)} hrs`,
      trend
    };
  }, [filteredTickets, timeRange]);

  // 3. Avg Resolution Time
  const resolutionStats = useMemo(() => {
    const resolved = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    if (!resolved.length) return { avgHours: 0, formatted: 'N/A', trend: Array(7).fill(0) };
    
    const computeAvg = (group: Ticket[]) => {
      const res = group.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));
      if (!res.length) return 0;
      const sum = res.reduce((acc, t) => {
        const resolvedTime = t.resolved_at || t.closed_at || t.updated_at;
        return acc + (new Date(resolvedTime).getTime() - new Date(t.created_at).getTime());
      }, 0);
      return sum / res.length / (1000 * 60 * 60);
    };

    const avgHours = computeAvg(resolved);
    
    return {
      avgHours,
      formatted: avgHours < 24 ? `${avgHours.toFixed(1)} hrs` : `${(avgHours / 24).toFixed(1)} days`,
      trend: generateTrend(resolved, computeAvg)
    };
  }, [filteredTickets, timeRange]);

  // Breakdowns
  const statusStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredTickets.forEach(t => { stats[t.status] = (stats[t.status] || 0) + 1; });
    return stats;
  }, [filteredTickets]);

  const priorityStats = useMemo(() => {
    const stats: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    filteredTickets.forEach(t => {
      const p = t.priority?.toLowerCase() || 'low';
      stats[p] = (stats[p] || 0) + 1; 
    });
    return stats;
  }, [filteredTickets]);

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const type = t.ticket_type || 'incident';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }, [filteredTickets]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const cat = t.category_name || 'Uncategorized';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    // Sort by volume
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredTickets]);

  // Agent Performance
  const agentPerformance = useMemo(() => {
    const agents: Record<string, { 
      name: string, 
      count: number, 
      resolved: number,
      breaches: number,
      totalResTime: number
    }> = {};

    filteredTickets.forEach(t => {
      const name = t.assigned_to_name;
      if (!name) return;
      
      const id = t.assigned_to_id || name;
      const displayName = name;
      
      if (!agents[id]) {
        agents[id] = { name: displayName, count: 0, resolved: 0, breaches: 0, totalResTime: 0 };
      }
      
      agents[id].count++;
      if (t.sla_breached) agents[id].breaches++;
      
      if (['resolved', 'closed'].includes(t.status.toLowerCase())) {
        agents[id].resolved++;
        const resolvedTime = t.resolved_at || t.closed_at || t.updated_at;
        agents[id].totalResTime += (new Date(resolvedTime).getTime() - new Date(t.created_at).getTime());
      }
    });

    return Object.values(agents).sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

  const exportCSV = () => {
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Type', 'Category', 'Created', 'Assignee', 'SLA Breached'];
    const rows = filteredTickets.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.ticket_type,
      t.category_name || 'Uncategorized',
      t.created_at,
      t.assigned_to_name || 'Unassigned',
      t.sla_breached ? 'Yes' : 'No'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `resolv_report_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const maxStatus = Math.max(...Object.values(statusStats), 1);
  const maxType = Math.max(...Object.values(typeStats), 1);
  const maxCategory = Math.max(...categoryStats.map(c => c[1]), 1);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <RefreshCcw className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Compiling analytics...</p>
      </div>
    );
  }

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Reports & Analytics
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>
            Analyzing {filteredTickets.length} tickets over the selected period
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--card)', padding: 4, borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: timeRange === r ? 'var(--accent)' : 'transparent',
                  color: timeRange === r ? 'white' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: timeRange === r ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {r === '7d' ? '7D' : r === '30d' ? '30D' : r === '90d' ? '90D' : 'All'}
              </button>
            ))}
          </div>
          
          <button 
            onClick={exportCSV}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', 
              background: 'transparent', border: '1px solid var(--border)', 
              borderRadius: '8px', color: 'var(--foreground)', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--card)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        
        {/* SLA Compliance */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Target size={16} style={{ color: 'var(--success)' }} /> SLA Compliance
            </div>
            <Sparkline data={slaStats.trend} color="var(--success)" />
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>
            {slaStats.compliance}%
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            <span style={{ color: slaStats.breached > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {slaStats.breached} breaches
            </span> out of {filteredTickets.length}
          </div>
        </div>

        {/* First Response Time */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Activity size={16} style={{ color: 'var(--accent)' }} /> First Response
            </div>
            <Sparkline data={firstResponseStats.trend} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>
            {firstResponseStats.formatted}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            Average initial reply time
          </div>
        </div>

        {/* Avg Resolution Time */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <TrendingUp size={16} style={{ color: 'var(--warning)' }} /> Avg Resolution
            </div>
            <Sparkline data={resolutionStats.trend} color="var(--warning)" />
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>
            {resolutionStats.formatted}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            Time to resolve or close
          </div>
        </div>
      </div>

      {/* Middle Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
        
        {/* Category Breakdown */}
        <div style={{ gridColumn: 'span 6' }} className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--foreground)' }}>
            <Layers size={18} /> Ticket Volume by Category
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {categoryStats.map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ color: 'var(--muted)' }}>{cat}</span>
                  <span style={{ color: 'var(--foreground)' }}>{count}</span>
                </div>
                <div style={{ height: 8, width: '100%', background: 'var(--background)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(count / maxCategory) * 100}%`,
                    background: 'var(--accent)',
                    borderRadius: 4,
                    transition: 'width 1s ease-out'
                  }} />
                </div>
              </div>
            ))}
            {categoryStats.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No categories found</div>}
          </div>
        </div>

        {/* Status Distribution */}
        <div style={{ gridColumn: 'span 6' }} className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--foreground)' }}>
            <BarChart2 size={18} /> Volume by Status
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(statusStats).sort((a,b) => b[1]-a[1]).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                  <span style={{ color: 'var(--muted)' }}>{status.replace('_', ' ')}</span>
                  <span style={{ color: 'var(--foreground)' }}>{count}</span>
                </div>
                <div style={{ height: 8, width: '100%', background: 'var(--background)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(count / maxStatus) * 100}%`,
                    background: ['resolved', 'closed'].includes(status) ? 'var(--success)' : status === 'open' ? 'var(--warning)' : 'var(--accent)',
                    borderRadius: 4,
                    transition: 'width 1s ease-out'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ticket Type & Priority (1/3 & 2/3 roughly or 6/6) */}
        <div style={{ gridColumn: 'span 5' }} className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--foreground)' }}>
            <PieChart size={18} /> Ticket Type
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(typeStats).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', opacity: 0.5 + (count/maxType)*0.5 }} />
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', flex: 1, color: 'var(--muted)' }}>
                  {type.replace('_', ' ')}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{count}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', width: 40, textAlign: 'right' }}>
                  {Math.round((count/filteredTickets.length)*100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: 'span 7' }} className="card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--foreground)' }}>
            <AlertCircle size={18} /> Priority Distribution
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', height: '100%' }}>
            {['critical', 'high', 'medium', 'low'].map(p => {
              const count = priorityStats[p] || 0;
              const pct = filteredTickets.length ? (count / filteredTickets.length) * 100 : 0;
              const colors: Record<string, string> = { critical: 'var(--danger)', high: '#f97316', medium: 'var(--warning)', low: 'var(--success)' };
              
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 60, fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: 'var(--muted)' }}>{p}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--background)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[p], borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 40, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      {isAdminOrAgent && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--foreground)' }}>
            <User size={18} /> Agent Performance
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '16px 24px', fontWeight: 600, color: 'var(--muted)' }}>Agent</th>
                  <th style={{ textAlign: 'center', padding: '16px 24px', fontWeight: 600, color: 'var(--muted)' }}>Tickets Handled</th>
                  <th style={{ textAlign: 'center', padding: '16px 24px', fontWeight: 600, color: 'var(--muted)' }}>Avg Resolution</th>
                  <th style={{ textAlign: 'center', padding: '16px 24px', fontWeight: 600, color: 'var(--muted)' }}>SLA Breaches</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((agent, i) => {
                  const avgResHours = agent.resolved ? agent.totalResTime / agent.resolved / (1000 * 60 * 60) : 0;
                  const resText = !agent.resolved ? '-' : avgResHours < 24 ? `${avgResHours.toFixed(1)}h` : `${(avgResHours/24).toFixed(1)}d`;
                  
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--background)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', opacity: 0.1, position: 'absolute' }} />
                          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{agent.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 700 }}>{agent.count}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center', color: 'var(--muted)' }}>{resText}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        {agent.breaches > 0 ? (
                          <span style={{ background: 'var(--danger)', color: 'white', padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                            {agent.breaches}
                          </span>
                        ) : <span style={{ color: 'var(--success)' }}>0</span>}
                      </td>
                    </tr>
                  );
                })}
                {agentPerformance.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>No agent data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
