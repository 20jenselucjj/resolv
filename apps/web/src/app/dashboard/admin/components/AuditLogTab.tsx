'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Filter, Calendar } from 'lucide-react';
import { Badge } from './SharedUI';
import type { AuditEntry } from './types';

export function AuditLogTab({ auditLog, page, setPage }: { auditLog: AuditEntry[]; page: number; setPage: (p: number) => void }) {
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const exportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID'];
    const rows = auditLog.map(e => [
      new Date(e.timestamp || e.created_at).toLocaleString(),
      e.actor_name, e.action, e.entity_type, e.entity_id
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>System Audit Log</h3>
          <button className="btn btn-ghost" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={exportCSV}><FileText size={14} /> Export CSV</button>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select className="select" style={{ border: 'none', background: 'transparent', padding: '0 8px', height: '28px', fontSize: '12px' }} value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="deleted">Deleted</option>
            </select>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <input type="text" placeholder="Filter by User..." className="input" style={{ border: 'none', background: 'transparent', padding: '0 8px', height: '28px', fontSize: '12px', width: '120px' }} value={filterUser} onChange={(e) => setFilterUser(e.target.value)} />
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <button className="btn btn-ghost" style={{ padding: '0 8px', height: '28px', fontSize: '12px' }}><Calendar size={14} style={{ marginRight: 4 }} /> Date</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
            <button className="btn btn-ghost" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Page {page}</span>
            <button className="btn btn-ghost" onClick={() => setPage(page + 1)} disabled={auditLog.length < 20}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Actor</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Entity Type</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(entry.timestamp || entry.created_at).toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{entry.actor_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <Badge variant="default">{entry.action}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{entry.entity_type}</td>
                  <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{entry.entity_id}</td>
                </tr>
              ))}
              {auditLog.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
