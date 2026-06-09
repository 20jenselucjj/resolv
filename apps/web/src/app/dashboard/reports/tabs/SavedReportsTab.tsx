'use client';

import { Save, Play, Edit3, Download, Printer, Trash2, RefreshCcw } from 'lucide-react';
import type { SavedReport, ReportExecutionResult } from '../types';

interface SavedReportsTabProps {
  savedReports: SavedReport[];
  execResult: ReportExecutionResult | null;
  execLoading: boolean;
  onRefresh: () => void;
  onExecute: (id: string) => void;
  onEdit: (report: SavedReport) => void;
  onExport: (id: string, format: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function SavedReportsTab({
  savedReports, execResult, execLoading, onRefresh, onExecute, onEdit, onExport, onDelete,
}: SavedReportsTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {savedReports.length} saved report{savedReports.length !== 1 ? 's' : ''}
        </div>
        <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCcw size={13} /> Refresh
        </button>
      </div>
      {savedReports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <Save size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No saved reports yet</div>
          <div style={{ fontSize: 12 }}>Build and save your first report from the Report Builder tab.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {savedReports.map(report => (
            <div key={report.id} className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{report.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {report.report_type.replace(/_/g, ' ')} · by {report.created_by_name}
                  </div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                  background: report.is_public ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                  color: report.is_public ? 'var(--success)' : 'var(--text-muted)',
                }}>{report.is_public ? 'Public' : 'Private'}</span>
              </div>
              {report.description && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{report.description}</div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <button onClick={() => onExecute(report.id)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Play size={11} /> Run
                </button>
                <button onClick={() => onEdit(report)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Edit3 size={11} /> Edit
                </button>
                <button onClick={() => onExport(report.id, 'csv', report.name)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Download size={11} /> CSV
                </button>
                <button onClick={() => onExport(report.id, 'pdf', report.name)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Printer size={11} /> Print
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={() => { if (confirm('Delete this report?')) onDelete(report.id); }}
                  className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {execResult && !execLoading && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Last Run Result</div>
          <SavedReportResult result={execResult} />
        </div>
      )}
    </div>
  );
}

function SavedReportResult({ result }: { result: ReportExecutionResult }) {
  const { data, summary } = result;
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
        <div className="rp-card card" style={{ borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            Report Data
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {Object.keys(data[0]).map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                        {h.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} style={{ padding: '8px 12px', color: 'var(--text)' }}>{val ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
