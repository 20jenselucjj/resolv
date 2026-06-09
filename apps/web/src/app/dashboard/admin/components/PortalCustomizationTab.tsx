'use client';

import { useEffect, useState } from 'react';
import { Palette, Zap, Globe, LayoutGrid, Eye, Info, MessageSquare, FileText, List, BookOpen } from 'lucide-react';
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
    portal_chip_1_label: 'My computer is slow',
    portal_chip_1_prompt: 'My computer is slow',
    portal_chip_2_label: 'I need VPN access',
    portal_chip_2_prompt: 'I need VPN access',
    portal_chip_3_label: 'Reset my password',
    portal_chip_3_prompt: 'Reset my password',
    portal_chip_4_label: 'Track my ticket',
    portal_chip_4_prompt: 'Track my ticket',
    portal_chat_header: 'Resolv AI',
    portal_chat_subtitle: 'Always here to help',
    portal_chat_empty_title: 'Ask me anything',
    portal_chat_empty_description: 'I can help you troubleshoot issues, find answers, or submit a ticket on your behalf.',
    portal_input_placeholder: 'Drop files here or message Resolv AI...',
    portal_input_hint: 'Enter to send · Shift+Enter for new line',
    portal_section_header: 'Report an Issue or Request Service',
    portal_section_description: "Can't find what you need? Submit a support request and our team will help you.",
    portal_button_text: 'Get Help',
    portal_success_title: 'Ticket submitted!',
    portal_success_subtitle: "We'll follow up based on your urgency.",
    portal_tickets_header: 'My Tickets',
    portal_no_tickets_text: 'No open requests.',
    portal_all_clear_text: 'All clear!',
    portal_kb_header: 'Knowledge Base',
    portal_no_articles_text: 'No articles found.',
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
          portal_chip_1_label: s.portal_chip_1_label || prev.portal_chip_1_label,
          portal_chip_1_prompt: s.portal_chip_1_prompt || prev.portal_chip_1_prompt,
          portal_chip_2_label: s.portal_chip_2_label || prev.portal_chip_2_label,
          portal_chip_2_prompt: s.portal_chip_2_prompt || prev.portal_chip_2_prompt,
          portal_chip_3_label: s.portal_chip_3_label || prev.portal_chip_3_label,
          portal_chip_3_prompt: s.portal_chip_3_prompt || prev.portal_chip_3_prompt,
          portal_chip_4_label: s.portal_chip_4_label || prev.portal_chip_4_label,
          portal_chip_4_prompt: s.portal_chip_4_prompt || prev.portal_chip_4_prompt,
          portal_chat_header: s.portal_chat_header || prev.portal_chat_header,
          portal_chat_subtitle: s.portal_chat_subtitle || prev.portal_chat_subtitle,
          portal_chat_empty_title: s.portal_chat_empty_title || prev.portal_chat_empty_title,
          portal_chat_empty_description: s.portal_chat_empty_description || prev.portal_chat_empty_description,
          portal_input_placeholder: s.portal_input_placeholder || prev.portal_input_placeholder,
          portal_input_hint: s.portal_input_hint || prev.portal_input_hint,
          portal_section_header: s.portal_section_header || prev.portal_section_header,
          portal_section_description: s.portal_section_description || prev.portal_section_description,
          portal_button_text: s.portal_button_text || prev.portal_button_text,
          portal_success_title: s.portal_success_title || prev.portal_success_title,
          portal_success_subtitle: s.portal_success_subtitle || prev.portal_success_subtitle,
          portal_tickets_header: s.portal_tickets_header || prev.portal_tickets_header,
          portal_no_tickets_text: s.portal_no_tickets_text || prev.portal_no_tickets_text,
          portal_all_clear_text: s.portal_all_clear_text || prev.portal_all_clear_text,
          portal_kb_header: s.portal_kb_header || prev.portal_kb_header,
          portal_no_articles_text: s.portal_no_articles_text || prev.portal_no_articles_text,
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
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Hero Subtitle
            </label>
            <input className="input" value={form.portal_hero_subtitle}
              onChange={e => setForm(f => ({ ...f, portal_hero_subtitle: e.target.value }))}
              placeholder="Welcome to the self-service portal"
              style={{ width: '100%' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Subtitle shown below the company name in the hero header</p>
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

      {/* ── Chat Chip Buttons ────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Chat Suggestion Chips</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>4 suggestion chips shown inside the AI chat when no conversation has started — like "My computer is slow"</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {([1, 2, 3, 4] as const).map(i => (
            <div key={i} style={{
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderLeft: '4px solid var(--accent-mid)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'rgba(37,99,235,0.12)', color: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {i}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Chip {i}</span>
                <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 600, marginLeft: 'auto' }}>{['Performance','Access','Password','Tracking'][i-1]}</span>
              </div>
              <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Display Label
                  </label>
                  <input
                    className="input"
                    value={(form as any)[`portal_chip_${i}_label`]}
                    onChange={e => setForm(f => ({ ...f, [`portal_chip_${i}_label`]: e.target.value }))}
                    placeholder="Text shown on chip"
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    AI Prompt
                  </label>
                  <input
                    className="input"
                    value={(form as any)[`portal_chip_${i}_prompt`]}
                    onChange={e => setForm(f => ({ ...f, [`portal_chip_${i}_prompt`]: e.target.value }))}
                    placeholder="Message sent to AI when clicked"
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Chat Text ──────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={18} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>AI Chat Text</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Customize the labels and placeholder text throughout the AI chat panel</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chat Header</label>
            <input className="input" value={form.portal_chat_header} onChange={e => setForm(f => ({ ...f, portal_chat_header: e.target.value }))} placeholder="Resolv AI" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chat Subtitle</label>
            <input className="input" value={form.portal_chat_subtitle} onChange={e => setForm(f => ({ ...f, portal_chat_subtitle: e.target.value }))} placeholder="Always here to help" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Empty State Title</label>
            <input className="input" value={form.portal_chat_empty_title} onChange={e => setForm(f => ({ ...f, portal_chat_empty_title: e.target.value }))} placeholder="Ask me anything" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Input Placeholder</label>
            <input className="input" value={form.portal_input_placeholder} onChange={e => setForm(f => ({ ...f, portal_input_placeholder: e.target.value }))} placeholder="Drop files here or message Resolv AI..." style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Empty State Description</label>
            <input className="input" value={form.portal_chat_empty_description} onChange={e => setForm(f => ({ ...f, portal_chat_empty_description: e.target.value }))} placeholder="I can help you troubleshoot issues..." style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Input Hint</label>
            <input className="input" value={form.portal_input_hint} onChange={e => setForm(f => ({ ...f, portal_input_hint: e.target.value }))} placeholder="Enter to send · Shift+Enter for new line" style={{ width: '100%', fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* ── Request Form Text ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Request Form Text</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Labels and messages for the manual ticket submission form</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Section Header</label>
            <input className="input" value={form.portal_section_header} onChange={e => setForm(f => ({ ...f, portal_section_header: e.target.value }))} placeholder="Report an Issue or Request Service" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Button Text</label>
            <input className="input" value={form.portal_button_text} onChange={e => setForm(f => ({ ...f, portal_button_text: e.target.value }))} placeholder="Get Help" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Section Description</label>
            <input className="input" value={form.portal_section_description} onChange={e => setForm(f => ({ ...f, portal_section_description: e.target.value }))} placeholder="Can't find what you need?" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Success Title</label>
            <input className="input" value={form.portal_success_title} onChange={e => setForm(f => ({ ...f, portal_success_title: e.target.value }))} placeholder="Ticket submitted!" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Success Subtitle</label>
            <input className="input" value={form.portal_success_subtitle} onChange={e => setForm(f => ({ ...f, portal_success_subtitle: e.target.value }))} placeholder="We'll follow up based on your urgency." style={{ width: '100%', fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* ── My Tickets Text ───────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <List size={18} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>My Tickets Section</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Text for the My Tickets list on the portal</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Section Header</label>
            <input className="input" value={form.portal_tickets_header} onChange={e => setForm(f => ({ ...f, portal_tickets_header: e.target.value }))} placeholder="My Tickets" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>No Tickets Text</label>
            <input className="input" value={form.portal_no_tickets_text} onChange={e => setForm(f => ({ ...f, portal_no_tickets_text: e.target.value }))} placeholder="No open requests." style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>All Clear Text</label>
            <input className="input" value={form.portal_all_clear_text} onChange={e => setForm(f => ({ ...f, portal_all_clear_text: e.target.value }))} placeholder="All clear!" style={{ width: '100%', fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* ── Knowledge Base Text ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Knowledge Base Section</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Text for the knowledge base section on the portal</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Section Header</label>
            <input className="input" value={form.portal_kb_header} onChange={e => setForm(f => ({ ...f, portal_kb_header: e.target.value }))} placeholder="Knowledge Base" style={{ width: '100%', fontSize: 12 }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>No Articles Text</label>
            <input className="input" value={form.portal_no_articles_text} onChange={e => setForm(f => ({ ...f, portal_no_articles_text: e.target.value }))} placeholder="No articles found." style={{ width: '100%', fontSize: 12 }} />
          </div>
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
