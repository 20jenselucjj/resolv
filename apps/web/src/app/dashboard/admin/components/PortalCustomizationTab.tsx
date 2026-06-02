'use client';

import { useEffect, useState } from 'react';
import { Palette, Zap, Globe, LayoutGrid, Eye, Info } from 'lucide-react';
import { api } from '@/lib/api';

const QA_COLORS = [
  { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '🔴' },
  { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '🟠' },
  { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: '🔵' },
  { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', icon: '🟣' },
  { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', icon: '🟢' },
  { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: '⚫' },
];

export function PortalCustomizationTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    portal_hero_title: '',
    portal_hero_subtitle: '',
    portal_company_name: '',
    portal_qa_1_label: 'Report an Issue',
    portal_qa_1_prompt: 'I need to report an issue with my computer or software.',
    portal_qa_2_label: 'Password / Access',
    portal_qa_2_prompt: 'I need help with a password reset or access to a system.',
    portal_qa_3_label: 'Hardware Request',
    portal_qa_3_prompt: 'I need to request new hardware or equipment.',
    portal_qa_4_label: 'Software Request',
    portal_qa_4_prompt: 'I need a software license or application installed.',
    portal_qa_5_label: 'Network / VPN',
    portal_qa_5_prompt: 'I am having network connectivity or VPN issues.',
    portal_qa_6_label: 'Something Else',
    portal_qa_6_prompt: 'I need help with something not listed here.',
  });

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const s = res.data;
        setForm(prev => ({
          ...prev,
          portal_hero_title: s.portal_hero_title || '',
          portal_hero_subtitle: s.portal_hero_subtitle || '',
          portal_company_name: s.portal_company_name || '',
          portal_qa_1_label: s.portal_qa_1_label || prev.portal_qa_1_label,
          portal_qa_1_prompt: s.portal_qa_1_prompt || prev.portal_qa_1_prompt,
          portal_qa_2_label: s.portal_qa_2_label || prev.portal_qa_2_label,
          portal_qa_2_prompt: s.portal_qa_2_prompt || prev.portal_qa_2_prompt,
          portal_qa_3_label: s.portal_qa_3_label || prev.portal_qa_3_label,
          portal_qa_3_prompt: s.portal_qa_3_prompt || prev.portal_qa_3_prompt,
          portal_qa_4_label: s.portal_qa_4_label || prev.portal_qa_4_label,
          portal_qa_4_prompt: s.portal_qa_4_prompt || prev.portal_qa_4_prompt,
          portal_qa_5_label: s.portal_qa_5_label || prev.portal_qa_5_label,
          portal_qa_5_prompt: s.portal_qa_5_prompt || prev.portal_qa_5_prompt,
          portal_qa_6_label: s.portal_qa_6_label || prev.portal_qa_6_label,
          portal_qa_6_prompt: s.portal_qa_6_prompt || prev.portal_qa_6_prompt,
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveSetting = async (key: string, value: string) => {
    await api.patch('/admin/settings', { key, value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(form).map(([key, value]) => saveSetting(key, value))
      );
      showAlert('Portal settings saved successfully');
    } catch {
      showAlert('Failed to save portal settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading portal settings...</div>;

  const qaItems = [1, 2, 3, 4, 5, 6] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Info banner */}
      <div style={{
        padding: '14px 18px', borderRadius: 'var(--radius-md)',
        background: 'var(--info-bg)', border: '1px solid var(--info-border)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <Info size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--info)', lineHeight: 1.5 }}>
          Customize the self-service portal — the first page users see when they sign in.
          Changes apply immediately. <a href="/dashboard/portal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)', fontWeight: 600 }}>Preview portal →</a>
        </div>
      </div>

      {/* ── Branding Section ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={18} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Branding & Header</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Company name displayed in the portal header</p>
          </div>
        </div>

        {/* Preview mockup — simplified hero banner */}
        <div style={{
          marginBottom: 24, padding: '28px 24px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 35%, #1e40af 65%, #2563eb 100%)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginTop: 4 }}>
              {form.portal_company_name || 'IT Self Service'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              Welcome to the self-service portal
            </div>
          </div>
        </div>

        <div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Company Name
            </label>
            <input className="input" value={form.portal_company_name}
              onChange={e => setForm(f => ({ ...f, portal_company_name: e.target.value }))}
              placeholder="e.g. Acme Corp IT"
              style={{ width: '100%' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Shown in the portal header</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions Section ────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={18} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Quick Action Buttons</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>6 buttons shown in the portal — users click to start an AI-guided request</p>
          </div>
        </div>

        {/* Preview grid of buttons */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          marginBottom: 24, padding: 16, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        }}>
          {qaItems.map(i => {
            const c = QA_COLORS[i - 1];
            const labelKey = `portal_qa_${i}_label` as keyof typeof form;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10,
                background: c.bg, border: `1px solid ${c.border}`,
                fontSize: 12, fontWeight: 600, color: c.color,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: c.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                  {i}
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {form[labelKey] || `Action ${i}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Editable quick action rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {qaItems.map(i => {
            const c = QA_COLORS[i - 1];
            return (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderLeft: `4px solid ${c.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: c.color + '20', color: c.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {i}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Button {i}</span>
                  <span style={{ fontSize: 10, color: c.color, fontWeight: 600, marginLeft: 'auto' }}>{['Report','Access','Hardware','Software','Network','Other'][i-1]}</span>
                </div>
                <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Button Label
                    </label>
                    <input
                      className="input"
                      value={(form as any)[`portal_qa_${i}_label`]}
                      onChange={e => setForm(f => ({ ...f, [`portal_qa_${i}_label`]: e.target.value }))}
                      placeholder="Text shown on button"
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      AI Prompt
                    </label>
                    <input
                      className="input"
                      value={(form as any)[`portal_qa_${i}_prompt`]}
                      onChange={e => setForm(f => ({ ...f, [`portal_qa_${i}_prompt`]: e.target.value }))}
                      placeholder="Message sent to AI when clicked"
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Save ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <a
          href="/dashboard/portal"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Eye size={14} /> Preview Portal
        </a>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '10px 28px', fontSize: 14, fontWeight: 600 }}
        >
          {saving ? 'Saving...' : 'Save Portal Settings'}
        </button>
      </div>
    </div>
  );
}
