'use client';

import { useEffect, useState } from 'react';
import { Lock, Info, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

export function ReopenTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [reopenDays, setReopenDays] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        setReopenDays(res.data['reopen_window_days'] || '');
      })
      .catch((err) => toast.error('Failed to load reopen settings', err instanceof Error ? err.message : 'Please try again'))
      .finally(() => setLoading(false));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const num = parseInt(reopenDays, 10);
    if (reopenDays !== '' && (isNaN(num) || num < 0)) {
      showAlert('Please enter a valid number of days (0 = no limit)', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/admin/settings', { key: 'reopen_window_days', value: reopenDays || '0' });
      showAlert('Reopen policy saved successfully');
    } catch {
      showAlert('Failed to save reopen policy', 'error');
    } finally {
      setSaving(false);
    }
  };

  const daysNum = parseInt(reopenDays, 10);
  const isValid = reopenDays === '' || (!isNaN(daysNum) && daysNum >= 0);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Info Banner ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 12, padding: '14px 16px',
        background: 'var(--accent-subtle)', borderRadius: 10,
        border: '1px solid var(--accent-border)',
        fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)',
      }}>
        <Info size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong style={{ color: 'var(--text)' }}>Reopen Policy</strong>
          <div style={{ marginTop: 4 }}>
            Controls how long after closing a ticket that end users can reopen it themselves.
            Admins and agents can always reopen any ticket regardless of this setting.
            When the window expires, users will need to contact support to reopen a closed ticket.
          </div>
        </div>
      </div>

      {/* ── Settings Card ────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '20px 24px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Reopen Window</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Set the time limit for end-user reopen requests</div>
            </div>
          </div>

          {/* Days input */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1, maxWidth: 200 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
                Days after closing
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="999"
                  value={reopenDays}
                  onChange={e => setReopenDays(e.target.value)}
                  placeholder="0"
                  style={{
                    width: 100, fontSize: 16, fontWeight: 700, textAlign: 'center',
                    borderColor: isValid ? undefined : 'var(--danger-border)',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>days</span>
              </div>
              {!isValid && (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Enter a valid number (0 = no limit)</div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center',
                padding: '10px 14px', borderRadius: 8,
                background: daysNum > 0 ? 'var(--success-bg)' : 'var(--bg-secondary)',
                border: `1px solid ${daysNum > 0 ? 'var(--success-border)' : 'var(--border)'}`,
                fontSize: 12, color: daysNum > 0 ? 'var(--success)' : 'var(--text-muted)',
              }}>
                <Lock size={14} />
                {daysNum > 0
                  ? `End users can reopen tickets within ${daysNum} day${daysNum !== 1 ? 's' : ''} of closing.`
                  : 'End users can reopen tickets at any time (no limit).'}
              </div>
            </div>
          </div>

          {/* Role summary */}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
              Admins / Agents — always allowed
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: daysNum > 0 ? 'var(--warning)' : 'var(--success)' }} />
              End users — {daysNum > 0 ? 'limited' : 'unlimited'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className={`btn btn-primary${saving ? ' saving' : ''}`}
          onClick={handleSave}
          disabled={saving || !isValid}
          style={{ padding: '10px 28px', fontSize: 14 }}
        >
          {saving ? 'Saving...' : 'Save Policy'}
        </button>
      </div>
    </div>
  );
}
