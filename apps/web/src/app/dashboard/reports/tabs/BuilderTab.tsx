'use client';

import { Play, Save, RefreshCcw, AlertTriangle } from 'lucide-react';
import type { ReportExecutionResult, ReportMetrics } from '../types';

interface BuilderTabProps {
  builderType: string;
  setBuilderType: (val: string) => void;
  builderDatePreset: string;
  setBuilderDatePreset: (val: string) => void;
  builderDateFrom: string;
  setBuilderDateFrom: (val: string) => void;
  builderDateTo: string;
  setBuilderDateTo: (val: string) => void;
  builderFilters: { status: string[]; priority: string[]; ticket_type: string[] };
  setBuilderFilters: (val: { status: string[]; priority: string[]; ticket_type: string[] }) => void;
  builderGroupBy: string;
  setBuilderGroupBy: (val: string) => void;
  builderMetrics: string[];
  setBuilderMetrics: (val: string[]) => void;
  builderName: string;
  setBuilderName: (val: string) => void;
  builderDescription: string;
  setBuilderDescription: (val: string) => void;
  builderPublic: boolean;
  setBuilderPublic: (val: boolean) => void;
  execLoading: boolean;
  execError: string | null;
  execResult: ReportExecutionResult | null;
  onRunReport: () => void;
  onSaveReport: () => void;
}

export default function BuilderTab(props: BuilderTabProps) {
  const {
    builderType, setBuilderType,
    builderDatePreset, setBuilderDatePreset,
    builderDateFrom, setBuilderDateFrom,
    builderDateTo, setBuilderDateTo,
    builderFilters, setBuilderFilters,
    builderGroupBy, setBuilderGroupBy,
    builderMetrics, setBuilderMetrics,
    builderName, setBuilderName,
    builderDescription, setBuilderDescription,
    builderPublic, setBuilderPublic,
    execLoading, execError, execResult,
    onRunReport, onSaveReport,
  } = props;

  const metricOptions = [
    { key: 'ticket_count', label: 'Ticket Count' },
    { key: 'avg_response_time', label: 'Avg Response Time' },
    { key: 'avg_resolution_time', label: 'Avg Resolution Time' },
    { key: 'fcr_rate', label: 'FCR Rate' },
    { key: 'sla_compliance', label: 'SLA Compliance %' },
    { key: 'csat_avg', label: 'CSAT Average' },
  ];

  const reportTypeOptions = [
    { key: 'ticket_summary', label: 'Ticket Summary', desc: 'Overview of ticket volume, response times, and resolution rates' },
    { key: 'agent_performance', label: 'Agent Performance', desc: 'Individual agent metrics including workload, response times, and CSAT' },
    { key: 'sla_compliance', label: 'SLA Compliance', desc: 'SLA performance metrics, breaches, and at-risk tickets' },
    { key: 'category_breakdown', label: 'Category Breakdown', desc: 'Ticket distribution and resolution times by category' },
    { key: 'problem_summary', label: 'Problem Summary', desc: 'Overview of problem management metrics' },
    { key: 'change_summary', label: 'Change Summary', desc: 'Overview of change management metrics' },
    { key: 'approval_summary', label: 'Approval Summary', desc: 'Overview of approval workflow metrics' },
    { key: 'custom', label: 'Custom Report', desc: 'Build your own report with selected metrics and dimensions' },
  ];

  const groupByOptions = [
    { key: '', label: 'None' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'type', label: 'Ticket Type' },
    { key: 'category', label: 'Category' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ];

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Builder Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Report Type */}
        <div className="rp-card card" style={{ padding: 20, borderRadius: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Report Type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reportTypeOptions.map(opt => (
              <label key={opt.key} onClick={() => setBuilderType(opt.key)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                background: builderType === opt.key ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                border: `1px solid ${builderType === opt.key ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
              }}>
                <input type="radio" name="reportType" checked={builderType === opt.key}
                  onChange={() => setBuilderType(opt.key)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="rp-card card" style={{ padding: 20, borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Date Range</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {['7d', '30d', '90d', 'this_month', 'last_month', 'all'].map(p => (
                <button key={p} onClick={() => setBuilderDatePreset(p)} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
                  background: builderDatePreset === p ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: builderDatePreset === p ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                }}>{p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : p === 'this_month' ? 'This Month' : p === 'last_month' ? 'Last Month' : 'All Time'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" className="input" value={builderDateFrom}
                onChange={e => { setBuilderDateFrom(e.target.value); setBuilderDatePreset(''); }}
                style={{ flex: 1, fontSize: 11, padding: '4px 8px' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
              <input type="date" className="input" value={builderDateTo}
                onChange={e => { setBuilderDateTo(e.target.value); setBuilderDatePreset(''); }}
                style={{ flex: 1, fontSize: 11, padding: '4px 8px' }} />
            </div>
          </div>

          <div className="rp-card card" style={{ padding: 20, borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Filters</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['open', 'in_progress', 'waiting', 'resolved', 'closed'].map(s => (
                    <button key={s} onClick={() => setBuilderFilters({
                      ...builderFilters, status: builderFilters.status.includes(s) ? builderFilters.status.filter(x => x !== s) : [...builderFilters.status, s],
                    })} style={{
                      padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 6, border: 'none',
                      background: builderFilters.status.includes(s) ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: builderFilters.status.includes(s) ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                    }}>{s.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Priority</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['low', 'medium', 'high', 'critical'].map(p => (
                    <button key={p} onClick={() => setBuilderFilters({
                      ...builderFilters, priority: builderFilters.priority.includes(p) ? builderFilters.priority.filter(x => x !== p) : [...builderFilters.priority, p],
                    })} style={{
                      padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 6, border: 'none',
                      background: builderFilters.priority.includes(p) ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: builderFilters.priority.includes(p) ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                    }}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Type</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['incident', 'service_request', 'problem', 'change'].map(t => (
                    <button key={t} onClick={() => setBuilderFilters({
                      ...builderFilters, ticket_type: builderFilters.ticket_type.includes(t) ? builderFilters.ticket_type.filter(x => x !== t) : [...builderFilters.ticket_type, t],
                    })} style={{
                      padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 6, border: 'none',
                      background: builderFilters.ticket_type.includes(t) ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: builderFilters.ticket_type.includes(t) ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                    }}>{t.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics & Group By */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="rp-card card" style={{ padding: 20, borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Metrics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {metricOptions.map(m => (
                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={builderMetrics.includes(m.key)}
                    onChange={() => setBuilderMetrics(
                      builderMetrics.includes(m.key) ? builderMetrics.filter(x => x !== m.key) : [...builderMetrics, m.key]
                    )} />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="rp-card card" style={{ padding: 20, borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Group By</div>
            <select className="select" value={builderGroupBy} onChange={e => setBuilderGroupBy(e.target.value)}
              style={{ width: '100%', fontSize: 12 }}>
              {groupByOptions.map(g => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={onRunReport} disabled={execLoading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Play size={14} /> {execLoading ? 'Running...' : 'Run Report'}
        </button>
        <div style={{ flex: 1 }} />
        <input className="input" placeholder="Report name..." value={builderName}
          onChange={e => setBuilderName(e.target.value)}
          style={{ maxWidth: 240, fontSize: 12, padding: '6px 10px' }} />
        <button onClick={onSaveReport} disabled={!builderName.trim()} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} /> Save Report
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={builderPublic} onChange={e => setBuilderPublic(e.target.checked)} />
          Public
        </label>
      </div>

      {/* Results */}
      {execLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
          <RefreshCcw className="animate-spin" size={20} color="var(--accent)" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Running report...</span>
        </div>
      )}
      {execError && (
        <div style={{ padding: 16, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13 }}>
          <AlertTriangle size={14} style={{ marginRight: 6 }} />
          {execError}
        </div>
      )}
      {execResult && !execLoading && <ReportResultsRenderer result={execResult} />}
    </div>
  );
}

// ── Report Results Renderer ──────────────────────────────────────────────────
function ReportResultsRenderer({ result }: { result: ReportExecutionResult }) {
  const { data, summary, report_type } = result;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {Object.entries(summary).filter(([k]) => !k.includes('formatted') && !k.includes('_key')).map(([key, val]) => {
            if (typeof val === 'object') return null;
            return (
              <div key={key} className="rp-card card" style={{ padding: '14px 16px', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{String(val)}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
                  {key.replace(/_/g, ' ')}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {Array.isArray(data) && data.length > 0 && (
        <ReportDataTable title="Report Data" data={data} />
      )}
      {data.by_status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <ReportBreakdown title="By Status" data={data.by_status} valueKey="status" countKey="count" color="var(--accent)" />
          <ReportBreakdown title="By Priority" data={data.by_priority} valueKey="priority" countKey="count" color="var(--warning)" />
          <ReportBreakdown title="By Type" data={data.by_type} valueKey="ticket_type" countKey="count" color="var(--info)" />
        </div>
      )}
      {Array.isArray(data) && data.length > 0 && data[0]?.agent_name && (
        <ReportDataTable
          title="Agent Details"
          data={data}
          headers={['Agent', 'Assigned', 'Resolved', 'SLA Breaches', 'Avg Response', 'Avg Resolution', 'CSAT']}
          rowMap={(r: any) => [
            r.agent_name, r.tickets_assigned, r.tickets_resolved, r.sla_breaches,
            r.avg_response_hours ? `${Number(r.avg_response_hours).toFixed(1)}h` : '—',
            r.avg_resolution_hours ? `${Number(r.avg_resolution_hours).toFixed(1)}h` : '—',
            r.csat_avg ? Number(r.csat_avg).toFixed(1) : '—',
          ]}
        />
      )}
      {Array.isArray(data) && data.length > 0 && data[0]?.category_name && (
        <ReportDataTable
          title="Category Breakdown"
          data={data}
          headers={['Category', 'Tickets', 'Avg Resolution (h)']}
          rowMap={(r: any) => [r.category_name, r.ticket_count, r.avg_resolution_hours ? Number(r.avg_resolution_hours).toFixed(1) : '—']}
        />
      )}
      {data.trend && Array.isArray(data.trend) && data.trend.length > 0 && (
        <div className="rp-card card" style={{ borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Volume Trend
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
              {data.trend.map((p: any, i: number) => {
                const maxVal = Math.max(...data.trend.map((t: any) => parseInt(t.count)), 1);
                const h = (parseInt(p.count) / maxVal) * 100;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ width: '100%', background: 'var(--accent)', borderRadius: '2px 2px 0 0', height: `${Math.max(h, 2)}%`, opacity: 0.5 + (i / data.trend.length) * 0.5, transition: 'height 0.5s ease' }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportDataTable({ title, data, headers, rowMap }: {
  title: string;
  data: any[];
  headers?: string[];
  rowMap?: (row: any) => any[];
}) {
  const cols = headers || Object.keys(data[0]);
  const rows = rowMap ? data.map(rowMap) : data.map((row: any) => Object.values(row));
  return (
    <div className="rp-card card" style={{ borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {cols.map(h => (
                  <th key={String(h)} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                    {String(h).replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {row.map((val: any, j: number) => (
                    <td key={j} style={{ padding: '8px 12px', color: 'var(--text)' }}>{val ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportBreakdown({ title, data, valueKey, countKey, color }: {
  title: string;
  data: any[];
  valueKey: string;
  countKey: string;
  color: string;
}) {
  const maxCount = Math.max(...data.map((r: any) => r[countKey]), 1);
  return (
    <div className="rp-card card" style={{ borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((r: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 80, fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>
                {String(r[valueKey] || '').replace('_', ' ')}
              </span>
              <div style={{ flex: 1, height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (r[countKey] / maxCount) * 100)}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', width: 40, textAlign: 'right' }}>{r[countKey]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
