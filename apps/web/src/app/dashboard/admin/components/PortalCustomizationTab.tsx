'use client';

import { useEffect, useState } from 'react';
import { Palette, Zap } from 'lucide-react';
import { api } from '@/lib/api';

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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const qaItems = [1, 2, 3, 4, 5, 6] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero Section */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Palette size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Hero Section</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Customize the portal header shown to all users</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Company Name</label>
            <input className="input" value={form.portal_company_name} onChange={e => setForm(f => ({ ...f, portal_company_name: e.target.value }))} placeholder="e.g. Acme Corp IT" style={{ width: '100%' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Shown in the portal header badge</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Hero Title Override</label>
            <input className="input" value={form.portal_hero_title} onChange={e => setForm(f => ({ ...f, portal_hero_title: e.target.value }))} placeholder="Leave blank for personalized greeting" style={{ width: '100%' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Overrides &quot;Good morning, [Name]&quot; if set</p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Hero Subtitle</label>
            <input className="input" value={form.portal_hero_subtitle} onChange={e => setForm(f => ({ ...f, portal_hero_subtitle: e.target.value }))} placeholder="How can we help you today? Search, chat with AI, or submit a request." style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Quick Action Buttons</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Customize the 6 quick action buttons shown on the portal</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {qaItems.map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'start', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>BUTTON {i} LABEL</label>
                <input className="input" value={(form as any)[`portal_qa_${i}_label`]} onChange={e => setForm(f => ({ ...f, [`portal_qa_${i}_label`]: e.target.value }))} placeholder={`Quick action ${i}`} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>AI PROMPT (sent when clicked)</label>
                <input className="input" value={(form as any)[`portal_qa_${i}_prompt`]} onChange={e => setForm(f => ({ ...f, [`portal_qa_${i}_prompt`]: e.target.value }))} placeholder="Message sent to AI when user clicks this button" style={{ width: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', fontSize: 14 }}>
          {saving ? 'Saving...' : 'Save Portal Settings'}
        </button>
      </div>
    </div>
  );
}
