'use client';

import { useState } from 'react';
import { Database, Download, Upload, AlertTriangle } from 'lucide-react';
import { getToken } from '@/lib/api';

export function BackupRestoreTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [backingUp, setBackingUp] = useState(false);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const token = getToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${baseUrl}/admin/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `resolv-backup-${timestamp}.sql`;
      a.href = url; a.click(); URL.revokeObjectURL(url);
      showAlert('Backup downloaded successfully');
    } catch (err: any) {
      showAlert(err.message || 'Backup failed. Ensure the server has pg_dump available.', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const section: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: 24,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Backup Section */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Download size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Database Backup</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Download a complete SQL dump of the Resolv database</p>
          </div>
        </div>
        <div style={{ padding: '16px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            Backups contain all tickets, users, settings, and knowledge base data. Store backups securely ΓÇö they may contain sensitive information.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleBackup}
          disabled={backingUp}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
        >
          <Download size={16} /> {backingUp ? 'Creating Backup...' : 'Download Backup (SQL)'}
        </button>
      </div>

      {/* Restore Section */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={16} color="var(--warning)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Restore Database</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Restore the database from a previously downloaded backup file</p>
          </div>
        </div>
        <div style={{ padding: '16px', background: 'var(--critical-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--critical-border)', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <AlertTriangle size={16} color="var(--critical)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>Warning:</strong> Restoring a backup will <strong>overwrite all current data</strong>. This action cannot be undone. Ensure you have a recent backup before proceeding.
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          To restore: connect to your database server directly and run:
        </p>
        <div style={{
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '16px', fontFamily: 'monospace', fontSize: 13,
          color: 'var(--text)', whiteSpace: 'pre-wrap'
        }}>
{`psql -U postgres -d resolv < resolv-backup-YYYY-MM-DD.sql`}
        </div>
      </div>

      {/* Info */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={16} color="var(--accent)" />
          </div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Maintenance Tips</h3>
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>Schedule regular backups (daily recommended for production)</li>
          <li>Test restores periodically to verify backup integrity</li>
          <li>Store backups off-server in secure cloud storage</li>
          <li>Enable maintenance mode before performing major changes</li>
          <li>Review the audit log after restore operations</li>
        </ul>
      </div>
    </div>
  );
}
