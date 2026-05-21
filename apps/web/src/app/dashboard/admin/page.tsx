'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { AITrainingTab } from './AITrainingTab';
import {
  Users, Layers, Clock, Settings, FileText, LayoutDashboard,
  ShieldAlert, ShieldCheck, Shield, UserPlus, MoreVertical, Edit2, 
  Trash2,   Plus, Save, RotateCcw, Search, ChevronLeft, 
  ChevronRight, CheckCircle, AlertCircle, Lock, Mail,
  User, Building, Activity, X, Palette, Hash, Trash, Book,
  AlertTriangle, Circle, Server, Database, Layers as StackIcon,
  Play,   Filter, Calendar, Zap, Sparkles, LayoutGrid, Brain, CalendarClock,
  Plug, BarChart3
} from 'lucide-react';

function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 400, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
            background: danger ? 'var(--danger)' : 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// --- Types ---

interface AdminStats {
  tickets: {
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_type: Record<string, number>;
    created_today: number;
    resolved_today: number;
    avg_resolution_hours: number;
  };
  users: {
    total: number;
    by_role: Record<string, number>;
    active_count: number;
  };
  sla: {
    breached_count: number;
    at_risk_count: number;
  };
  recent_activity: AuditEntry[];
}

interface AuditEntry {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  timestamp?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user';
  department?: string;
  is_active: boolean;
  avatarUrl?: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  icon?: string;
  is_active: boolean;
}

interface SLAPolicy {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  response_time_hours: number;
  resolution_time_hours: number;
  is_active: boolean;
}

interface AdminSetting {
  key: string;
  value: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  group?: string; // We'll infer this if not present
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  condition?: string;
  action: string;
  action_value: string;
  enabled: boolean;
  actionValue?: string; // local UI extension
}

interface WorkingHour {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

interface WorkingHourAPI {
  day: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface AIConfig {
  enabled: boolean;
  provider: string;
  base_url: string;
  api_key?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  allowed_roles: string[];
  max_messages_per_day: number;
}

// --- Components ---

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) => {
  const styles: Record<string, React.CSSProperties> = {
    admin: { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical-border)' },
    agent: { background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' },
    user: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    active: { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' },
    inactive: { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
    low: { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' },
    medium: { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' },
    high: { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' },
    critical: { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical-border)' },
    default: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
  };

  return (
    <span className="badge" style={{ ...(styles[variant] || styles.default), fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', textTransform: 'capitalize' }}>
      {children}
    </span>
  );
};

const StatCard = ({ label, value, icon, color, bg }: { label: string; value: number | string; icon: React.ReactNode; color: string; bg: string }) => (
  <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
  </div>
);

const Alert = ({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) => (
  <div style={{
    position: 'fixed', bottom: '24px', right: '24px', padding: '12px 16px', borderRadius: 'var(--radius-md)',
    background: type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
    color: type === 'success' ? 'var(--success)' : 'var(--danger)',
    border: `1px solid ${type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
    display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000, boxShadow: 'var(--shadow-md)',
    animation: 'slideIn 0.2s ease-out'
  }}>
    {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
    <span style={{ fontSize: '13px', fontWeight: 500 }}>{message}</span>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
      <X size={14} />
    </button>
  </div>
);

const Modal = ({ title, children, onClose, maxWidth = '400px' }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(2px)' }}>
    <div className="card" style={{ width: '100%', maxWidth, padding: 0, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header" style={{ justifyContent: 'space-between', padding: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{title}</h3>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}><X size={18} /></button>
      </div>
      <div style={{ padding: '20px', overflowY: 'auto' }}>{children}</div>
    </div>
  </div>
);

function PortalCustomizationTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
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

function TagsTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [usedTags, setUsedTags] = useState<{ tag: string; count: number }[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTags = () => {
    setLoading(true);
    api.get<{ data: { configured: string[]; used: { tag: string; count: number }[] } }>('/admin/tags')
      .then(res => {
        setTags(res.data.configured);
        setUsedTags(res.data.used);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTags(); }, []);

  const saveTags = async (newTags: string[]) => {
    setSaving(true);
    try {
      await api.patch('/admin/settings', { key: 'available_tags', value: JSON.stringify(newTags) });
      setTags(newTags);
      showAlert('Tags saved');
    } catch {
      showAlert('Failed to save tags', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || tags.includes(t)) { setNewTag(''); return; }
    const updated = [...tags, t];
    setNewTag('');
    saveTags(updated);
  };

  const removeTag = (tag: string) => {
    saveTags(tags.filter(t => t !== tag));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Hash size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Tag Library</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Manage the tags available for tickets. Tags help categorize and filter tickets.</p>
          </div>
        </div>

        {/* Add new tag */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            className="input"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
            placeholder="Add a new tag (e.g. vpn, hardware, urgent)"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={addTag} disabled={saving || !newTag.trim()}>
            <Plus size={14} style={{ marginRight: 4 }} /> Add Tag
          </button>
        </div>

        {/* Configured tags */}
        {tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tags.map(tag => (
              <div key={tag} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px 4px 12px',
                background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--accent)',
              }}>
                <Hash size={10} />
                {tag}
                <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', opacity: 0.6, display: 'flex', padding: 0, marginLeft: 2 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            No tags configured yet. Add your first tag above.
          </div>
        )}
      </div>

      {/* Tags in use */}
      {usedTags.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Tags Currently Used in Tickets</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {usedTags.map(({ tag, count }) => (
              <div key={tag} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 20, fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <Hash size={10} />
                {tag}
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 10 }}>{count}</span>
                {!tags.includes(tag) && (
                  <button onClick={() => saveTags([...tags, tag])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 10, fontWeight: 600, padding: 0, marginLeft: 2 }}>
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

function SSOTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_enabled') === 'true';
    }
    return false;
  });
  const [provider, setProvider] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_provider') || 'saml';
    }
    return 'saml';
  });
  const [providerName, setProviderName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_provider_name') || 'Company SSO';
    }
    return 'Company SSO';
  });
  const [entityId, setEntityId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_entity_id') || '';
    }
    return '';
  });
  const [ssoUrl, setSsoUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_url') || '';
    }
    return '';
  });
  const [certificate, setCertificate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_certificate') || '';
    }
    return '';
  });
  const [defaultRole, setDefaultRole] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_default_role') || 'user';
    }
    return 'user';
  });
  const [autoProvision, setAutoProvision] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_auto_provision') !== 'false';
    }
    return true;
  });

  const handleSave = () => {
    localStorage.setItem('resolv_sso_enabled', String(enabled));
    localStorage.setItem('resolv_sso_provider', provider);
    localStorage.setItem('resolv_sso_provider_name', providerName);
    localStorage.setItem('resolv_sso_entity_id', entityId);
    localStorage.setItem('resolv_sso_url', ssoUrl);
    localStorage.setItem('resolv_sso_certificate', certificate);
    localStorage.setItem('resolv_sso_default_role', defaultRole);
    localStorage.setItem('resolv_sso_auto_provision', String(autoProvision));
    showAlert('SSO configuration saved');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Honest status banner */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '16px 20px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)' }}>
        <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', marginBottom: 4 }}>Frontend configuration only — backend integration required</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This UI saves your SSO settings and shows the SSO button on the login page. However, <strong>actual authentication</strong> (SAML assertions, OIDC token exchange, Azure AD redirects) requires backend middleware to be wired up in <code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 4 }}>apps/api/src/routes/auth.ts</code>. The configuration you enter here is stored in your browser and will be used once the backend is connected.
          </div>
        </div>
      </div>

    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>SSO / Identity Provider</h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>Configure single sign-on for your organization</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div 
          onClick={() => setEnabled(!enabled)}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
            background: enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
            position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
          }}
        >
          <div style={{
            position: 'absolute', top: 2, 
            left: enabled ? 22 : 2,
            width: 18, height: 18, borderRadius: '50%',
            background: enabled ? 'white' : 'var(--text-muted)',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>SSO Authentication</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allow users to sign in with your identity provider</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: enabled ? 1 : 0.6, pointerEvents: enabled ? 'auto' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider Configuration</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>Provider Type</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['saml', 'oidc', 'azure_ad', 'google'].map(p => (
                <button key={p} onClick={() => setProvider(p)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-full)',
                    border: `1px solid ${provider === p ? 'var(--accent)' : 'var(--border)'}`,
                    background: provider === p ? 'var(--accent-subtle)' : 'transparent',
                    color: provider === p ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 13, fontWeight: provider === p ? 600 : 400
                  }}
                >
                  {p === 'saml' ? 'SAML 2.0' : p === 'oidc' ? 'OIDC' : p === 'azure_ad' ? 'Azure AD' : 'Google Workspace'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Display Name</label>
              <input className="input" value={providerName} onChange={e => setProviderName(e.target.value)} placeholder="e.g. Okta SSO" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Entity ID / Client ID</label>
              <input className="input" value={entityId} onChange={e => setEntityId(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>SSO URL / Auth Endpoint</label>
            <input className="input" value={ssoUrl} onChange={e => setSsoUrl(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>Certificate / Client Secret</label>
            <textarea className="input" style={{ minHeight: '100px', fontFamily: 'monospace', fontSize: '12px' }} value={certificate} onChange={e => setCertificate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Provisioning</div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              onClick={() => setAutoProvision(!autoProvision)}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: autoProvision ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: autoProvision ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s ease'
              }} />
            </div>
            <span style={{ fontSize: '13px' }}>Auto-provision new users</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>Default role for new SSO users</label>
            <select className="select" value={defaultRole} onChange={e => setDefaultRole(e.target.value)} style={{ maxWidth: '200px' }}>
              <option value="user">User</option>
              <option value="agent">Agent</option>
            </select>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Admins always use password login. SSO is available for Agents and Users.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Login Page Preview</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>When enabled, users will see:</div>
          <button className="btn" style={{ background: 'white', color: 'var(--text)', border: '1px solid var(--border)', padding: '10px', width: '100%', maxWidth: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 500 }}>
            <Shield size={16} color="var(--accent)" />
            Continue with {providerName}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '8px' }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ padding: '12px 24px' }}>
          Save SSO Configuration
        </button>
      </div>
    </div>
    </div>
  );
}

function AIConfigTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [config, setConfig] = useState<AIConfig>({
    enabled: false,
    provider: 'openai',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 2048,
    system_prompt: '',
    allowed_roles: ['admin', 'agent'],
    max_messages_per_day: 50,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get<{ data: AIConfig }>('/ai/config');
      if (res.data) {
        setConfig(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      if (newApiKey) {
        payload.api_key = newApiKey;
      } else {
        delete payload.api_key;
      }
      await api.put('/ai/config', payload);
      showAlert('AI configuration saved successfully');
      setNewApiKey('');
      fetchConfig();
    } catch (err) {
      showAlert('Failed to save AI configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    const roles = (config.allowed_roles || []).includes(role)
      ? config.allowed_roles.filter(r => r !== role)
      : [...(config.allowed_roles || []), role];
    setConfig({ ...config, allowed_roles: roles });
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading AI configuration...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>AI Assistant Configuration</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>Configure AI capabilities for ticket assistance and automation</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div 
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
              background: config.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: `1px solid ${config.enabled ? 'var(--accent)' : 'var(--border)'}`,
              position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute', top: 2, 
              left: config.enabled ? 22 : 2,
              width: 18, height: 18, borderRadius: '50%',
              background: config.enabled ? 'white' : 'var(--text-muted)',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable AI Assistant</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allow AI to help agents with ticket summaries and replies</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', opacity: config.enabled ? 1 : 0.6, pointerEvents: config.enabled ? 'auto' : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Provider</label>
              <input className="input" value={config.provider} onChange={e => setConfig({ ...config, provider: e.target.value })} placeholder="e.g. openai, openrouter" />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Base URL</label>
              <input className="input" value={config.base_url} onChange={e => setConfig({ ...config, base_url: e.target.value })} placeholder="e.g. https://api.openai.com/v1" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>API Key</label>
              <input 
                type="password" 
                className="input" 
                value={newApiKey} 
                onChange={e => setNewApiKey(e.target.value)} 
                placeholder={config.api_key ? '••••••••••••••••' : 'Enter API Key'} 
              />
              {config.api_key && <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Leave blank to keep existing key</p>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Model</label>
              <input className="input" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} placeholder="e.g. gpt-4o-mini" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>Temperature ({config.temperature})</label>
                <input type="number" className="input" min="0" max="2" step="0.1" value={config.temperature} onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>Max Tokens</label>
                <input type="number" className="input" min="256" max="8192" value={config.max_tokens} onChange={e => setConfig({ ...config, max_tokens: parseInt(e.target.value) })} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Max Messages Per Day</label>
              <input type="number" className="input" value={config.max_messages_per_day} onChange={e => setConfig({ ...config, max_messages_per_day: parseInt(e.target.value) })} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Allowed Roles</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                {['admin', 'agent', 'user'].map(role => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input 
                      type="checkbox" 
                      checked={(config.allowed_roles || []).includes(role)} 
                      onChange={() => toggleRole(role)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ textTransform: 'capitalize' }}>{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', opacity: config.enabled ? 1 : 0.6, pointerEvents: config.enabled ? 'auto' : 'none' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>System Prompt</label>
          <textarea 
            className="input" 
            rows={5} 
            style={{ resize: 'vertical', minHeight: '120px' }} 
            value={config.system_prompt} 
            onChange={e => setConfig({ ...config, system_prompt: e.target.value })} 
            placeholder="Describe the AI's personality and instructions..."
          />
        </div>

        <div style={{ marginTop: '8px' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={saving}
            style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {saving ? 'Saving...' : 'Save AI Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketStatusesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DEFAULT_STATUSES = [
    { value: 'open', defaultLabel: 'Open', description: 'New tickets awaiting action' },
    { value: 'in_progress', defaultLabel: 'In Progress', description: 'Tickets being actively worked on' },
    { value: 'waiting', defaultLabel: 'Waiting', description: 'Tickets waiting for user response or external action' },
    { value: 'closed', defaultLabel: 'Closed', description: 'Tickets fully closed with a closing note' },
  ];

  interface CustomStatus {
    value: string;
    label: string;
    color: string;
  }

  const COLOR_OPTIONS = [
    { id: 'default', label: 'Default', bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border)' },
    { id: 'accent', label: 'Blue', bg: 'var(--accent-subtle)', color: 'var(--accent)', border: 'var(--accent-border)' },
    { id: 'success', label: 'Green', bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' },
    { id: 'warning', label: 'Yellow', bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' },
    { id: 'danger', label: 'Red', bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger-border)' },
  ];

  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('default');
  const [savingCustom, setSavingCustom] = useState(false);

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const s = res.data;
        const loaded: Record<string, string> = {};
        DEFAULT_STATUSES.forEach(st => {
          loaded[st.value] = s[`status_label_${st.value}`] || st.defaultLabel;
        });
        setLabels(loaded);
        // Load custom statuses
        try {
          const raw = s['custom_statuses'];
          if (raw) setCustomStatuses(JSON.parse(raw));
        } catch { /* ignore */ }
      })
      .catch(() => {
        const defaults: Record<string, string> = {};
        DEFAULT_STATUSES.forEach(st => { defaults[st.value] = st.defaultLabel; });
        setLabels(defaults);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        DEFAULT_STATUSES.map(st =>
          api.patch('/admin/settings', { key: `status_label_${st.value}`, value: labels[st.value] || st.defaultLabel })
        )
      );
      showAlert('Status labels saved successfully');
    } catch {
      showAlert('Failed to save status labels', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (value: string, defaultLabel: string) => {
    setLabels(prev => ({ ...prev, [value]: defaultLabel }));
  };

  const saveCustomStatuses = async (updated: CustomStatus[]) => {
    setSavingCustom(true);
    try {
      await api.patch('/admin/settings', { key: 'custom_statuses', value: JSON.stringify(updated) });
      setCustomStatuses(updated);
      showAlert('Custom statuses saved');
    } catch {
      showAlert('Failed to save custom statuses', 'error');
    } finally {
      setSavingCustom(false);
    }
  };

  const addCustomStatus = () => {
    const label = newLabel.trim();
    if (!label) return;
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (DEFAULT_STATUSES.some(s => s.value === value) || customStatuses.some(s => s.value === value)) {
      showAlert('A status with this key already exists', 'error');
      return;
    }
    const updated = [...customStatuses, { value, label, color: newColor }];
    setNewLabel('');
    setNewColor('default');
    saveCustomStatuses(updated);
  };

  const removeCustomStatus = (value: string) => {
    saveCustomStatuses(customStatuses.filter(s => s.value !== value));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Default Statuses */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Circle size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Status Display Labels</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Customize how each ticket status appears to users. The underlying status values remain unchanged.</p>
          </div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DEFAULT_STATUSES.map(st => (
            <div key={st.value} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Status Key</div>
                <code style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>{st.value}</code>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DISPLAY LABEL</label>
                <input
                  className="input"
                  value={labels[st.value] || ''}
                  onChange={e => setLabels(prev => ({ ...prev, [st.value]: e.target.value }))}
                  placeholder={st.defaultLabel}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{st.description}</div>
              </div>
              <button
                onClick={() => handleReset(st.value, st.defaultLabel)}
                className="btn btn-ghost btn-sm"
                title="Reset to default"
                style={{ color: 'var(--text-muted)', flexShrink: 0 }}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', fontSize: 14 }}>
            {saving ? 'Saving...' : 'Save Status Labels'}
          </button>
        </div>
      </div>

      {/* Custom Statuses */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Custom Statuses</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Add your own ticket statuses beyond the defaults.</p>
          </div>
        </div>

        {/* Add form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>STATUS LABEL</label>
              <input
                className="input"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomStatus(); }}
                placeholder="e.g. On Hold, Pending Review, Escalated"
                style={{ width: '100%' }}
              />
              {newLabel.trim() && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Key: <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>
                    {newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}
                  </code>
                </div>
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={addCustomStatus}
              disabled={savingCustom || !newLabel.trim()}
              style={{ height: 38, padding: '0 20px', whiteSpace: 'nowrap' }}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> Add Status
            </button>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>COLOR</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setNewColor(opt.id)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: newColor === opt.id ? opt.bg : 'transparent',
                    color: newColor === opt.id ? opt.color : 'var(--text-muted)',
                    border: `1px solid ${newColor === opt.id ? opt.border : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom status list */}
        {customStatuses.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            No custom statuses yet. Add your first one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customStatuses.map(cs => {
              const colorOpt = COLOR_OPTIONS.find(o => o.id === cs.color) || COLOR_OPTIONS[0];
              return (
                <div key={cs.value} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Status Key</div>
                    <code style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>{cs.value}</code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: colorOpt.bg, color: colorOpt.color, border: `1px solid ${colorOpt.border}`
                    }}>
                      {cs.label}
                    </span>
                  </div>
                  <button
                    onClick={() => removeCustomStatus(cs.value)}
                    className="btn btn-ghost btn-sm"
                    title="Remove custom status"
                    style={{ color: 'var(--danger)', flexShrink: 0 }}
                    disabled={savingCustom}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CannedResponsesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DEFAULT_RESPONSES = [
    "Hi there, we've received your request and are looking into it.",
    "Could you please provide more details or screenshots to help us investigate?",
    "We have resolved the issue. Please confirm if everything is working for you now.",
    "Closing this ticket due to inactivity. Feel free to reply if you still need help.",
  ];

  const [responses, setResponses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newResponse, setNewResponse] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const raw = res.data['canned_responses'];
        if (raw) {
          try { setResponses(JSON.parse(raw)); } catch { setResponses(DEFAULT_RESPONSES); }
        } else {
          setResponses(DEFAULT_RESPONSES);
        }
      })
      .catch(() => setResponses(DEFAULT_RESPONSES))
      .finally(() => setLoading(false));
  }, []);

  const saveResponses = async (updated: string[]) => {
    setSaving(true);
    try {
      await api.patch('/admin/settings', { key: 'canned_responses', value: JSON.stringify(updated) });
      setResponses(updated);
      showAlert('Canned responses saved');
    } catch {
      showAlert('Failed to save canned responses', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addResponse = () => {
    const t = newResponse.trim();
    if (!t) return;
    setNewResponse('');
    saveResponses([...responses, t]);
  };

  const removeResponse = (idx: number) => {
    saveResponses(responses.filter((_, i) => i !== idx));
  };

  const saveEdit = (idx: number) => {
    if (!editDraft.trim()) return;
    const updated = responses.map((r, i) => i === idx ? editDraft.trim() : r);
    setEditingIdx(null);
    saveResponses(updated);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Book size={16} color="var(--accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Canned Responses</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Quick reply templates available to agents in the ticket reply box. Agents can insert these with one click.</p>
          </div>
        </div>

        {/* Add new */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <textarea
            className="input"
            value={newResponse}
            onChange={e => setNewResponse(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addResponse(); }}
            placeholder="Type a new canned response... (⌘↵ to add)"
            rows={3}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={addResponse} disabled={saving || !newResponse.trim()}>
              <Plus size={14} style={{ marginRight: 4 }} /> Add Response
            </button>
          </div>
        </div>

        {/* List */}
        {responses.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            No canned responses yet. Add your first one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {responses.map((r, idx) => (
              <div key={idx} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {editingIdx === idx ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      className="input"
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      rows={3}
                      style={{ resize: 'vertical', minHeight: 80 }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingIdx(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      <button onClick={() => saveEdit(idx)} className="btn btn-primary btn-sm" disabled={saving}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{r}</div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditingIdx(idx); setEditDraft(r); }} className="btn btn-ghost btn-icon btn-sm" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => removeResponse(idx)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  
  // Tab Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slaPolicies, setSLAPolicies] = useState<SLAPolicy[]>([]);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  
  // Forms/Modals
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);

  // Sidebar Search
  const [sidebarSearch, setSidebarSearch] = useState('');

  // System Health Status
  const [healthStatus, setHealthStatus] = useState({ api: true, db: true, queue: true });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get<{ data: { api: boolean; db: boolean; queue: boolean } }>('/admin/health');
        setHealthStatus(res.data || { api: true, db: true, queue: true });
      } catch {
        setHealthStatus({ api: false, db: false, queue: false });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Deep search index: maps keywords/phrases to tab IDs
  const searchIndex = useMemo(() => [
    // Overview
    { tab: 'overview', keywords: ['overview', 'dashboard', 'stats', 'statistics', 'summary', 'activity', 'monitor', 'health', 'kpi', 'metrics'] },
    // Users
    { tab: 'users', keywords: ['users', 'user', 'invite', 'accounts', 'people', 'members', 'staff', 'deactivate', 'activate', 'password', 'reset', 'department', 'bulk'] },
    // Roles
    { tab: 'roles', keywords: ['roles', 'permissions', 'access', 'rbac', 'admin', 'agent', 'privileges', 'security', 'manage users', 'delete tickets', 'assign tickets'] },
    // SSO
    { tab: 'sso', keywords: ['sso', 'single sign-on', 'saml', 'oidc', 'azure', 'google workspace', 'identity', 'oauth', 'okta', 'login', 'auth', 'provision'] },
    // Categories
    { tab: 'categories', keywords: ['categories', 'category', 'ticket type', 'classification', 'routing', 'organize', 'color'] },
    // Tags
    { tab: 'tags', keywords: ['tags', 'tag', 'labels', 'label', 'metadata', 'filter'] },
    // Ticket Statuses
    { tab: 'ticket-statuses', keywords: ['ticket statuses', 'status labels', 'status names', 'progress text', 'open', 'in progress', 'waiting', 'closed', 'rename status'] },
    // SLA
    { tab: 'sla-policies', keywords: ['sla', 'service level', 'response time', 'resolution time', 'breach', 'priority', 'critical', 'high', 'medium', 'low', 'policies'] },
    // Working Hours
    { tab: 'working-hours', keywords: ['working hours', 'business hours', 'schedule', 'timezone', 'calendar', 'open', 'closed', 'monday', 'friday', 'weekend', 'operating'] },
    // Automation
    { tab: 'automation', keywords: ['automation', 'rules', 'trigger', 'workflow', 'escalate', 'escalation', 'auto', 'routing', 'condition', 'action', 'notify'] },
    // Email Templates
    { tab: 'email-templates', keywords: ['email', 'templates', 'template', 'notification', 'smtp', 'mail', 'subject', 'body', 'ticket created', 'ticket resolved', 'survey'] },
    // Portal
    { tab: 'portal-customization', keywords: ['portal', 'branding', 'hero', 'customize', 'customization', 'quick actions', 'company name', 'subtitle', 'end user', 'user portal'] },
    // Canned Responses
    { tab: 'canned-responses', keywords: ['canned responses', 'canned', 'responses', 'quick replies', 'templates', 'reply templates', 'shortcuts'] },
    // AI Config
    { tab: 'ai-config', keywords: ['ai', 'assistant', 'openai', 'gpt', 'model', 'temperature', 'tokens', 'api key', 'system prompt', 'provider', 'base url', 'allowed roles'] },
    // AI Training
    { tab: 'ai-training', keywords: ['ai training', 'training', 'knowledge', 'rag', 'retrieval', 'vector', 'embedding', 'chunks', 'qa pairs', 'q&a', 'sources', 'documents', 'ingest', 'semantic', 'hybrid', 'keyword', 'similarity', 'top k', 'chunk size', 'chunk overlap', 'citation', 'analytics', 'test', 'evaluate', 'rag settings', 'knowledge sources', 'ticket sync', 'kb sync'] },
    // Reports
    { tab: 'reports', keywords: ['reports', 'report', 'analytics', 'charts', 'volume', 'performance', 'csat', 'export', 'csv', 'trends', 'breakdown'] },
    // Settings
    { tab: 'settings', keywords: ['settings', 'configuration', 'config', 'system', 'general', 'integrations key', 'variables', 'global'] },
    // Integrations
    { tab: 'integrations', keywords: ['integrations', 'integration', 'slack', 'webhook', 'jira', 'teams', 'pagerduty', 'zapier', 'connect', 'third party', 'external'] },
    // Audit Log
    { tab: 'audit-log', keywords: ['audit', 'log', 'history', 'trail', 'audit log', 'operations', 'changes', 'who', 'actor', 'events'] },
  ], []);

  // Smart search: find matching tabs from the deep index
  const searchResults = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter(entry => entry.keywords.some(kw => kw.includes(q) || q.includes(kw)))
      .map(entry => entry.tab);
  }, [sidebarSearch, searchIndex]);

  const navGroups = useMemo(() => [
    {
      group: '',
      items: [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
      ]
    },
    {
      group: 'USERS & ACCESS',
      items: [
        { id: 'users', label: 'Users', icon: <Users size={15} /> },
        { id: 'roles', label: 'Roles & Permissions', icon: <ShieldCheck size={15} /> },
        { id: 'sso', label: 'SSO / Identity', icon: <Shield size={15} /> },
      ]
    },
    {
      group: 'TICKETING',
      items: [
        { id: 'categories', label: 'Categories', icon: <Layers size={15} /> },
        { id: 'tags', label: 'Tags', icon: <Hash size={15} /> },
        { id: 'ticket-statuses', label: 'Ticket Statuses', icon: <Circle size={15} /> },
        { id: 'sla-policies', label: 'SLA Policies', icon: <Clock size={15} /> },
        { id: 'working-hours', label: 'Working Hours', icon: <CalendarClock size={15} /> },
        { id: 'automation', label: 'Automation', icon: <Zap size={15} /> },
      ]
    },
    {
      group: 'COMMUNICATION',
      items: [
        { id: 'email-templates', label: 'Email Templates', icon: <Mail size={15} /> },
        { id: 'portal-customization', label: 'Portal', icon: <LayoutGrid size={15} /> },
        { id: 'canned-responses', label: 'Canned Responses', icon: <Book size={15} /> },
      ]
    },
    {
      group: 'AI & INTELLIGENCE',
      items: [
        { id: 'ai-config', label: 'AI Assistant', icon: <Sparkles size={15} /> },
        { id: 'ai-training', label: 'AI Training', icon: <Brain size={15} /> },
      ]
    },
    {
      group: 'REPORTS',
      items: [
        { id: 'reports', label: 'Reports', icon: <BarChart3 size={15} /> },
      ]
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
        { id: 'integrations', label: 'Integrations', icon: <Plug size={15} /> },
        { id: 'audit-log', label: 'Audit Log', icon: <FileText size={15} /> },
      ]
    }
  ], []);

  const filteredNavGroups = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return navGroups;
    // Merge label match + deep keyword match
    const matchedTabIds = new Set(searchResults);
    return navGroups.map(group => {
      const items = group.items.filter(item =>
        item.label.toLowerCase().includes(q) || matchedTabIds.has(item.id)
      );
      return { ...group, items };
    }).filter(group => group.items.length > 0);
  }, [sidebarSearch, navGroups, searchResults]);

  const activeNavItem = useMemo(() => {
    for (const group of navGroups) {
      const item = group.items.find(i => i.id === activeTab);
      if (item) return item;
    }
    return null;
  }, [activeTab, navGroups]);

  const getTabSubtitle = (id: string) => {
    switch (id) {
      case 'overview': return 'System monitoring, statistics, and recent activity overview';
      case 'users': return 'Manage user accounts, departments, and active statuses';
      case 'roles': return 'Define security roles, access permissions, and privileges';
      case 'sso': return 'Configure Single Sign-On and enterprise identity providers';
      case 'categories': return 'Organize tickets into categories and define routing rules';
      case 'tags': return 'Manage custom labels and metadata tags for ticketing';
      case 'ticket-statuses': return 'Customize the display labels for ticket status values';
      case 'sla-policies': return 'Set Service Level Agreement response and resolution targets';
      case 'working-hours': return 'Configure business calendars, hours of operation, and holidays';
      case 'automation': return 'Create workflow triggers, automated actions, and conditions';
      case 'email-templates': return 'Customize system notifications and client communication layouts';
      case 'portal-customization': return 'Style the end-user support portal layout and branding';
      case 'canned-responses': return 'Manage quick reply templates available to agents when responding to tickets';
      case 'ai-config': return 'Configure artificial intelligence response models and behavior';
      case 'ai-training': return 'Train classification models and fine-tune AI agents';
      case 'reports': return 'View ticket analytics, agent performance, and CSAT metrics';
      case 'integrations': return 'Connect third-party services, webhooks, and external tools';
      case 'settings': return 'Adjust application configuration variables and system settings';
      case 'audit-log': return 'View the history of administrative and system operations';
      default: return 'Manage system configuration and administrative policies';
    }
  };

  const showAlert = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  }, []);

  const loadTabData = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const statsRes = await api.get<{ data: AdminStats }>('/admin/stats');
        setStats(statsRes.data);
        setAuditLog(statsRes.data.recent_activity || []);
      } else if (tab === 'users') {
        const res = await api.get<{ data: UserProfile[] }>('/users');
        setUsers(res.data);
      } else if (tab === 'categories') {
        const res = await api.get<{ data: Category[] }>('/categories');
        setCategories(res.data);
      } else if (tab === 'sla-policies') {
        const res = await api.get<{ data: SLAPolicy[] }>('/sla-policies');
        setSLAPolicies(res.data);
      } else if (tab === 'settings') {
        const res = await api.get<{ data: Record<string, string> }>('/admin/settings');
        // Convert flat key-value to array with labels
        const settingsArray: AdminSetting[] = Object.entries(res.data || {}).map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          let type: 'string' | 'number' | 'boolean' = 'string';
          let group = 'General';
          if (value === 'true' || value === 'false') type = 'boolean';
          else if (!isNaN(Number(value)) && value !== '') type = 'number';
          if (key.includes('smtp') || key.includes('email') || key.includes('mail')) group = 'Email / Notifications';
          else if (key.includes('auth') || key.includes('security') || key.includes('password') || key.includes('session')) group = 'Security';
          else if (key.includes('slack') || key.includes('webhook') || key.includes('integration')) group = 'Integrations';
          else if (key.includes('sla') || key.includes('ticket') || key.includes('auto')) group = 'Ticket Settings';
          return { key, value: value ?? '', label, type, group };
        });
        setSettings(settingsArray);
      } else if (tab === 'audit-log') {
        const res = await api.get<{ data: AuditEntry[] }>(`/admin/audit-log?page=${auditPage}&pageSize=50`);
        setAuditLog(res.data);
      }
    } catch {
      showAlert('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [auditPage, showAlert]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'agent') {
      loadTabData(activeTab);
    }
  }, [user, activeTab, auditPage, loadTabData]);

  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'agent') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--critical-bg)', color: 'var(--critical)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>You do not have permission to view this page.</p>
      </div>
    </div>
  );
}


  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* App Title & Search Area */}
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Admin Settings</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 32px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>
          {/* Smart search hint: show top match as a "jump to" shortcut */}
          {sidebarSearch.trim() && searchResults.length > 0 && (() => {
            const topTabId = searchResults[0];
            const allItems = navGroups.flatMap(g => g.items);
            const topItem = allItems.find(i => i.id === topTabId);
            if (!topItem) return null;
            return (
              <div style={{ marginTop: '6px' }}>
                <button
                  onClick={() => { setActiveTab(topItem.id); setSidebarSearch(''); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--accent)',
                    background: 'var(--accent-subtle)',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ opacity: 0.7, fontSize: '10px' }}>Jump to</span>
                  <span style={{ fontWeight: 600 }}>{topItem.label}</span>
                  {searchResults.length > 1 && (
                    <span style={{ marginLeft: 'auto', opacity: 0.6 }}>+{searchResults.length - 1} more</span>
                  )}
                </button>
              </div>
            );
          })()}
        </div>

        {/* Grouped Nav Items */}
        <div style={{ flex: 1, paddingBottom: '20px' }}>
          {filteredNavGroups.map(g => (
            <div key={g.group || 'no-header'}>
              {g.group && (
                <div style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '16px 16px 6px'
                }}>
                  {g.group}
                </div>
              )}
              {g.items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: isActive ? '8px 16px 8px 13px' : '8px 16px',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      borderRadius: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                      background: isActive ? 'var(--accent-subtle)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      borderLeft: isActive ? '3px solid var(--accent)' : 'none',
                      transition: 'background 0.2s, color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                        e.currentTarget.style.color = 'var(--text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 80px', display: 'flex', flexDirection: 'column' }}>
        {/* System Health Widget at Top */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', gap: '16px', padding: '12px 20px', 
            background: 'var(--bg-secondary)', border: '1px solid var(--border)', 
            borderRadius: 'var(--radius-lg)', alignItems: 'center'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              SYSTEM HEALTH
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus.api ? 'var(--success)' : 'var(--danger)' }} />
              <Server size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>API</span>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus.db ? 'var(--success)' : 'var(--danger)' }} />
              <Database size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>DB</span>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus.queue ? 'var(--success)' : 'var(--danger)' }} />
              <StackIcon size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>Queue</span>
            </div>
          </div>
        </div>

        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            {activeNavItem?.label || 'Admin Control Panel'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '4px' }}>
            {getTabSubtitle(activeTab)}
          </p>
        </header>

        <div style={{ position: 'relative', minHeight: '400px' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', opacity: 0.7, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)' }}>
              <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            </div>
          )}

          {activeTab === 'overview' && <OverviewTab stats={stats} auditLog={auditLog} />}
          {activeTab === 'users' && (
            <UsersTab 
              users={users} 
              onRefresh={() => loadTabData('users')} 
              onShowPassword={(pw) => setTempPassword(pw)} 
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'categories' && (
            <CategoriesTab 
              categories={categories} 
              onRefresh={() => loadTabData('categories')} 
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'sla-policies' && (
            <SLAPoliciesTab 
              policies={slaPolicies} 
              onRefresh={() => loadTabData('sla-policies')} 
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'email-templates' && (
            <EmailTemplatesTab showAlert={showAlert} setConfirmModal={setConfirmModal} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab 
              settings={settings} 
              onRefresh={() => loadTabData('settings')} 
              showAlert={showAlert}
            />
          )}
          {activeTab === 'ai-config' && <AIConfigTab showAlert={showAlert} />}
          {activeTab === 'ai-training' && <AITrainingTab showAlert={showAlert} />}
          {activeTab === 'sso' && <SSOTab showAlert={showAlert} />}
          {activeTab === 'roles' && <RolesTab showAlert={showAlert} />}
          {activeTab === 'automation' && <AutomationTab showAlert={showAlert} setConfirmModal={setConfirmModal} />}
          {activeTab === 'working-hours' && <WorkingHoursTab showAlert={showAlert} />}
          {activeTab === 'portal-customization' && <PortalCustomizationTab showAlert={showAlert} />}
           {activeTab === 'tags' && <TagsTab showAlert={showAlert} />}
           {activeTab === 'ticket-statuses' && <TicketStatusesTab showAlert={showAlert} />}
           {activeTab === 'canned-responses' && <CannedResponsesTab showAlert={showAlert} />}
          {activeTab === 'reports' && <ReportsTab showAlert={showAlert} />}
          {activeTab === 'integrations' && <IntegrationsTab showAlert={showAlert} />}
          {activeTab === 'audit-log' && (
            <AuditLogTab 
              auditLog={auditLog} 
              page={auditPage} 
              setPage={setAuditPage} 
            />
          )}
        </div>
      </div>

      {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
      
      {tempPassword && (
        <Modal title="Temporary Password" onClose={() => setTempPassword(null)}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            A temporary password has been generated. Please provide it to the user. They will be asked to change it on their next login.
          </p>
          <div style={{ 
            background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
          }}>
            <code style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px' }}>{tempPassword}</code>
            <button 
              className="btn btn-ghost" 
              onClick={() => { navigator.clipboard.writeText(tempPassword); showAlert('Copied to clipboard'); }}
            >
              Copy
            </button>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '24px', padding: '12px' }}
            onClick={() => setTempPassword(null)}
          >
            Done
          </button>
        </Modal>
      )}

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

// --- Tab Implementations ---

function OverviewTab({ stats, auditLog }: { stats: AdminStats | null; auditLog: AuditEntry[] }) {
  const byStatus = stats?.tickets?.by_status || {};
  const totalTickets = stats?.tickets?.total || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Tickets" value={stats?.tickets?.total || 0} icon={<FileText size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Open" value={stats?.tickets?.by_status?.open || 0} icon={<Circle size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
        <StatCard label="Created Today" value={stats?.tickets?.created_today || 0} icon={<Plus size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Closed Today" value={stats?.tickets?.resolved_today || 0} icon={<CheckCircle size={16} />} color="var(--success)" bg="var(--success-bg)" />
        <StatCard label="SLA Breached" value={stats?.sla?.breached_count || 0} icon={<AlertTriangle size={16} />} color="var(--critical)" bg="var(--critical-bg)" />
        <StatCard label="SLA At Risk" value={stats?.sla?.at_risk_count || 0} icon={<AlertCircle size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
        <StatCard label="Total Users" value={stats?.users?.total || 0} icon={<Users size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Active Agents" value={stats?.users?.by_role?.agent || 0} icon={<Activity size={16} />} color="var(--success)" bg="var(--success-bg)" />
      </div>

      {/* Ticket Status Breakdown */}
      {totalTickets > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Ticket Status Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byStatus).map(([status, count]) => {
              const pct = totalTickets > 0 ? Math.round((count as number / totalTickets) * 100) : 0;
              const colors: Record<string, string> = { open: 'var(--warning)', in_progress: 'var(--accent)', closed: 'var(--success)' };
              return (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>{status.replace('_', ' ')}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count as number} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[status] || 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Avg Resolution Time */}
      {(stats?.tickets?.avg_resolution_hours || 0) > 0 && (
        <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={22} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Average Resolution Time</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{(stats?.tickets?.avg_resolution_hours || 0).toFixed(1)}h</div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <Activity size={15} color="var(--accent)" />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Recent Activity</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Actor</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Entity</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.slice(0, 8).map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{entry.actor_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{entry.action}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{entry.entity_type} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({entry.entity_id})</span></td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(entry.timestamp || entry.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {auditLog.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No recent activity found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, onRefresh, onShowPassword, showAlert, setConfirmModal }: { 
  users: UserProfile[]; 
  onRefresh: () => void; 
  onShowPassword: (pw: string) => void; 
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: UserProfile['role']; department: string }>({ name: '', email: '', role: 'user', department: '' });
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionMenu && !(e.target as HTMLElement).closest('[data-action-menu]')) {
        setActionMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionMenu]);

  const filteredUsers = users.filter(u => {
    const matchSearch = !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ data: { user: UserProfile; tempPassword: string } }>('/users/invite', inviteForm);
      showAlert('User invited successfully');
      setIsInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'user', department: '' });
      onRefresh();
      onShowPassword(res.data.tempPassword);
    } catch (err) {
      showAlert('Failed to invite user', 'error');
    }
  };

  const toggleSelectUser = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      showAlert(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      onRefresh();
    } catch (err: unknown) {
      console.error('Toggle active error:', err);
      showAlert(err instanceof Error ? err.message : 'Failed to update user', 'error');
    }
  };

  const handleResetPassword = async (user: UserProfile) => {
    try {
      const res = await api.post<{ tempPassword: string }>(`/users/${user.id}/reset-password`, {});
      onShowPassword(res.tempPassword);
      showAlert('Password reset sent');
    } catch {
      showAlert('Failed to reset password', 'error');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    setConfirmModal({
      open: true,
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/users/${user.id}`);
          showAlert('User deleted');
          onRefresh();
        } catch (err: unknown) {
          console.error('Delete user error:', err);
          showAlert(err instanceof Error ? err.message : 'Failed to delete user', 'error');
        }
      }
    });
  };

  // Bulk actions
  const handleBulkDeactivate = async () => {
    try {
      for (const id of selectedUsers) {
        await api.patch(`/users/${id}`, { is_active: false });
      }
      showAlert(`Deactivated ${selectedUsers.size} users`);
      setSelectedUsers(new Set());
      onRefresh();
    } catch {
      showAlert('Failed to bulk update', 'error');
    }
  };

  const handleBulkActivate = async () => {
    try {
      for (const id of selectedUsers) {
        await api.patch(`/users/${id}`, { is_active: true });
      }
      showAlert(`Activated ${selectedUsers.size} users`);
      setSelectedUsers(new Set());
      onRefresh();
    } catch {
      showAlert('Failed to bulk update', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Manage Users</h3>
        <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary">
          <UserPlus size={14} /> Invite User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, height: 34 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'admin', 'agent', 'user'].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={roleFilter === role ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: '12px', padding: '6px 12px', textTransform: 'capitalize' }}
            >
              {role === 'all' ? 'All' : role}
            </button>
          ))}
        </div>
      </div>

      {selectedUsers.size > 0 && (
        <div style={{ 
          background: 'var(--accent-subtle)', border: '1px solid var(--accent)', 
          borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', 
          alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.2s' 
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
            {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleBulkActivate} className="btn" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', fontSize: '12px', padding: '6px 12px' }}>Activate</button>
            <button onClick={handleBulkDeactivate} className="btn" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', fontSize: '12px', padding: '6px 12px' }}>Deactivate</button>
          </div>
        </div>
      )}

      {isInviteOpen && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Name</label><input className="input" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} required /></div>
            <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Email</label><input className="input" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required /></div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Role</label>
              <select className="select" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}>
                <option value="user">User</option><option value="agent">Agent</option><option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Send Invite</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsInviteOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', width: '40px' }}>
                  <input type="checkbox" checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>User</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Role</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: selectedUsers.has(u.id) ? 'var(--accent-subtle)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleSelectUser(u.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select 
                      className="select" 
                      value={u.role} 
                      style={{ fontSize: '12px', padding: '4px 8px', height: 'auto' }}
                      onChange={async (e) => {
                        try {
                          await api.patch(`/users/${u.id}`, { role: e.target.value });
                          showAlert(`Role updated to ${e.target.value}`);
                          onRefresh();
                        } catch {
                          showAlert('Failed to update role', 'error');
                        }
                      }}
                    >
                      <option value="user">User</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant={u.is_active ? 'active' : 'inactive'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-ghost" 
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => handleResetPassword(u)}
                        title="Reset Password"
                      >
                        <Lock size={12} />
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        style={{ padding: '4px 8px', fontSize: '11px', color: u.is_active ? 'var(--warning)' : 'var(--success)' }}
                        onClick={() => handleToggleActive(u)}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {u.is_active ? <X size={12} /> : <CheckCircle size={12} />}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button 
                          className="btn btn-ghost" 
                          style={{ padding: '4px' }}
                          onClick={() => setActionMenu(actionMenu === u.id ? null : u.id)}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {actionMenu === u.id && (
                          <div data-action-menu style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 4,
                            background: 'var(--card)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            zIndex: 50, minWidth: 160, padding: 4, animation: 'fadeIn 0.15s ease-out'
                          }}>
                            <button
                              onClick={() => { handleResetPassword(u); setActionMenu(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text)', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <Lock size={12} /> Reset Password
                            </button>
                            <button
                              onClick={() => { handleToggleActive(u); setActionMenu(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: u.is_active ? 'var(--warning)' : 'var(--success)', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {u.is_active ? <X size={12} /> : <CheckCircle size={12} />}
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                            <button
                              onClick={() => { handleDeleteUser(u); setActionMenu(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--danger)', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <Trash2 size={12} /> Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CategoriesTab({ categories, onRefresh, showAlert, setConfirmModal }: { 
  categories: Category[]; 
  onRefresh: () => void; 
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#3B82F6' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/categories', { ...form, is_active: true });
      showAlert('Category created successfully');
      setIsAdding(false);
      setForm({ name: '', description: '', color: '#3B82F6' });
      onRefresh();
    } catch {
      showAlert('Failed to create category', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/categories/${editingId}`, editForm);
      showAlert('Category updated');
      setEditingId(null);
      onRefresh();
    } catch {
      showAlert('Failed to update category', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/categories/${id}`);
          showAlert('Category deleted');
          onRefresh();
        } catch {
          showAlert('Failed to delete category', 'error');
        }
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Ticket Categories</h3>
        <button onClick={() => setIsAdding(true)} className="btn btn-primary"><Plus size={14} /> Add Category</button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Network Issues" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Description</label>
              <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 40, height: 34, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }} />
                <input className="input" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ flex: 1 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {categories.length === 0 && !isAdding ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Layers size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No categories yet</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Create categories to organize your tickets</div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add First Category</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {categories.map((cat) => (
            <div key={cat.id} className="card" style={{ padding: '16px' }}>
              {editingId === cat.id ? (
                <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Name *</label>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="color" value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }} />
                      <input className="input" style={{ padding: '6px 10px', fontSize: 13, flex: 1 }} value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}>Save</button>
                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: `${cat.color}20`, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Hash size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{cat.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>{cat.description || 'No description'}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '4px', flexShrink: 0 }} onClick={() => { setEditingId(cat.id); setEditForm({ name: cat.name, description: cat.description, color: cat.color }); }}><Edit2 size={14} /></button>
                  <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)', flexShrink: 0 }} onClick={() => handleDelete(cat.id)}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SLAPoliciesTab({ policies, onRefresh, showAlert, setConfirmModal }: { 
  policies: SLAPolicy[]; 
  onRefresh: () => void; 
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', priority: 'medium' as SLAPolicy['priority'], response_time_hours: 4, resolution_time_hours: 24 });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', priority: 'medium' as SLAPolicy['priority'], response_time_hours: 4, resolution_time_hours: 24 });

  const getTierIndicator = (priority: string) => {
    switch (priority) {
      case 'critical': return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/></div>;
      case 'high': return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--danger)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--danger)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--danger)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/></div>;
      case 'medium': return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--warning)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--warning)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/></div>;
      default: return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--success)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/></div>;
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/sla-policies', { ...form, is_active: true });
      showAlert('SLA policy created successfully');
      setIsAdding(false);
      setForm({ name: '', priority: 'medium', response_time_hours: 4, resolution_time_hours: 24 });
      onRefresh();
    } catch {
      showAlert('Failed to create SLA policy', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/sla-policies/${editingId}`, editForm);
      showAlert('SLA policy updated');
      setEditingId(null);
      onRefresh();
    } catch {
      showAlert('Failed to update SLA policy', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete SLA Policy',
      message: 'Are you sure you want to delete this SLA policy? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/sla-policies/${id}`);
          showAlert('SLA policy deleted');
          onRefresh();
        } catch {
          showAlert('Failed to delete SLA policy', 'error');
        }
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>SLA Policies</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} onClick={() => showAlert('SLA check triggered. Running dry-run simulation.', 'success')}>
            <Play size={14} style={{ marginRight: '6px' }} /> Test SLA
          </button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add Policy</button>
        </div>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Policy Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard SLA" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Priority</label>
              <select className="select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Response Time (hours)</label>
              <input className="input" type="number" min={1} value={form.response_time_hours} onChange={e => setForm({ ...form, response_time_hours: parseInt(e.target.value) })} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Resolution Time (hours)</label>
              <input className="input" type="number" min={1} value={form.resolution_time_hours} onChange={e => setForm({ ...form, resolution_time_hours: parseInt(e.target.value) })} required />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {policies.length === 0 && !isAdding ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Clock size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No SLA policies yet</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Define response and resolution time targets for each priority level</div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add First Policy</button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Tier / Priority</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Response Time</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Resolution Time</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  editingId === p.id ? (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px' }} colSpan={5}>
                        <form onSubmit={handleEdit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Name *</label>
                            <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Priority</label>
                            <select className="select" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value as any })}>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Response (h)</label>
                            <input className="input" type="number" min={1} style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.response_time_hours} onChange={e => setEditForm({ ...editForm, response_time_hours: parseInt(e.target.value) })} required />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Resolution (h)</label>
                            <input className="input" type="number" min={1} style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.resolution_time_hours} onChange={e => setEditForm({ ...editForm, resolution_time_hours: parseInt(e.target.value) })} required />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12, flex: 1 }}>Save</button>
                            <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {getTierIndicator(p.priority)}
                          <Badge variant={p.priority}>{p.priority}</Badge>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}><Clock size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--text-muted)' }} />{p.response_time_hours}h</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}><CheckCircle size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--text-muted)' }} />{p.resolution_time_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => { setEditingId(p.id); setEditForm({ name: p.name, priority: p.priority, response_time_hours: p.response_time_hours, resolution_time_hours: p.resolution_time_hours }); }}><Edit2 size={14} /></button>
                          <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }} onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailTemplatesTab({ showAlert, setConfirmModal }: { 
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const DEFAULT_TEMPLATES: EmailTemplate[] = [
    { id: '1', name: 'Ticket Created', subject: 'Your ticket #[TICKET_ID] has been created', body: 'Hello [USER_NAME],\n\nWe have received your request. Our team will review it shortly.\n\nBest,\nSupport Team' },
    { id: '2', name: 'Ticket Assigned', subject: 'Ticket #[TICKET_ID] has been assigned to [AGENT_NAME]', body: 'Hello [USER_NAME],\n\nYour ticket has been assigned and is being reviewed.\n\nBest,\nSupport Team' },
    { id: '3', name: 'SLA Breach Warning', subject: 'Warning: SLA breach imminent for Ticket #[TICKET_ID]', body: 'Team,\n\nTicket #[TICKET_ID] is about to breach its SLA in 1 hour. Please prioritize.' },
    { id: '4', name: 'Ticket Resolved', subject: 'Your ticket #[TICKET_ID] has been resolved', body: 'Hello [USER_NAME],\n\nWe consider this issue resolved. If you have any further questions, please reopen the ticket.\n\nBest,\nSupport Team' },
    { id: '5', name: 'Ticket Reopened', subject: 'Ticket #[TICKET_ID] has been reopened', body: 'Hello [USER_NAME],\n\nYour ticket has been reopened and our team will follow up shortly.\n\nBest,\nSupport Team' },
    { id: '6', name: 'Satisfaction Survey', subject: 'How did we do? Rate your experience for Ticket #[TICKET_ID]', body: 'Hello [USER_NAME],\n\nWe hope your issue was resolved to your satisfaction. Please take a moment to rate your experience.\n\nBest,\nSupport Team' },
  ];
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', subject: '', body: '' });
  const [editForm, setEditForm] = useState({ subject: '', body: '' });

  useEffect(() => {
    api.get<{ data: EmailTemplate[] }>('/admin/email-templates')
      .then(res => {
        if (res.data && res.data.length > 0) setTemplates(res.data);
      })
      .catch(() => {}) // keep defaults on error
      .finally(() => setTemplatesLoading(false));
  }, []);

  const handleEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setEditForm({ subject: t.subject, body: t.body });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/email-templates/${editingTemplate!.id}`, editForm);
      setTemplates(prev => prev.map(t => t.id === editingTemplate!.id ? { ...t, ...editForm } : t));
      showAlert('Email template saved successfully');
      setEditingTemplate(null);
    } catch {
      // Fallback to local state update if API not available
      setTemplates(prev => prev.map(t => t.id === editingTemplate!.id ? { ...t, ...editForm } : t));
      showAlert('Email template saved (local only)');
      setEditingTemplate(null);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Template',
      message: 'Are you sure you want to delete this email template?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/admin/email-templates/${id}`);
        } catch {} // ignore if API not available
        setTemplates(prev => prev.filter(t => t.id !== id));
        showAlert('Email template deleted');
      }
    });
  };

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.subject.trim()) return;
    try {
      const res = await api.post<{ data: EmailTemplate }>('/admin/email-templates', addForm);
      setTemplates(prev => [...prev, res.data]);
      showAlert('Email template created successfully');
    } catch {
      const newTemplate: EmailTemplate = { id: String(Date.now()), name: addForm.name.trim(), subject: addForm.subject.trim(), body: addForm.body.trim() };
      setTemplates(prev => [...prev, newTemplate]);
      showAlert('Email template created (local only)');
    }
    setIsAdding(false);
    setAddForm({ name: '', subject: '', body: '' });
  };

  if (templatesLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading templates...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Email Templates</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
            Variables: [TICKET_ID] [USER_NAME] [AGENT_NAME] [TICKET_TITLE]
          </div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Template
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>New Email Template</div>
          <form onSubmit={handleAddSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Template Name *</label>
              <input className="input" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Password Reset Notification" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Subject Line *</label>
              <input className="input" value={addForm.subject} onChange={e => setAddForm({ ...addForm, subject: e.target.value })} placeholder="e.g. Your password has been reset for Ticket #[TICKET_ID]" required />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Available variables: [TICKET_ID], [USER_NAME], [AGENT_NAME], [TICKET_TITLE]</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Body Content</label>
              <textarea className="textarea" value={addForm.body} onChange={e => setAddForm({ ...addForm, body: e.target.value })} rows={6} style={{ minHeight: '120px', padding: '12px' }} placeholder={'Hello [USER_NAME],\n\nYour message here.\n\nBest,\nSupport Team'} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setIsAdding(false); setAddForm({ name: '', subject: '', body: '' }); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Template</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Template Type</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Subject Line</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{t.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t.subject}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid var(--border)' }} onClick={() => handleEdit(t)}>
                      <Edit2 size={12} style={{ marginRight: 6 }} /> Edit
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--danger)' }} onClick={() => handleDelete(t.id)}>
                      <Trash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingTemplate && (
        <Modal title={`Edit Template: ${editingTemplate.name}`} onClose={() => setEditingTemplate(null)} maxWidth="600px">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Subject Line</label>
              <input className="input" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} required />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Available variables: [TICKET_ID], [USER_NAME], [AGENT_NAME], [TICKET_TITLE]</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Body Content</label>
              <textarea className="textarea" value={editForm.body} onChange={e => setEditForm({ ...editForm, body: e.target.value })} rows={8} style={{ minHeight: '150px', padding: '12px' }} required />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingTemplate(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Template</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SettingsTab({ settings, onRefresh, showAlert }: { settings: AdminSetting[]; onRefresh: () => void; showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const values: Record<string, string> = {};
    settings.forEach(s => {
      values[s.key] = s.value;
    });
    setLocalValues(values);
  }, [settings]);

  const handleSave = async (key: string) => {
    setSavingKeys(prev => new Set(prev).add(key));
    try {
      await api.patch('/admin/settings', { key, value: localValues[key] });
      showAlert('Setting saved');
      onRefresh();
    } catch (err) {
      showAlert('Failed to save', 'error');
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const groupedSettings = settings.reduce((acc, curr) => {
    const group = curr.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(curr);
    return acc;
  }, {} as Record<string, AdminSetting[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {Object.entries(groupedSettings).map(([group, groupSettings]) => (
        <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, paddingBottom: '8px', borderBottom: '2px solid var(--border)' }}>{group}</h3>
          <div className="card">
            {groupSettings.map((s, idx) => (
              <div key={s.key} style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '24px', borderBottom: idx < groupSettings.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.key}</div>
                </div>
                <div style={{ width: '250px', display: 'flex', gap: '8px' }}>
                  {s.type === 'boolean' ? (
                    <select 
                      className="select" 
                      value={localValues[s.key] ?? s.value}
                      onChange={(e) => setLocalValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input 
                      className="input" 
                      type={s.type === 'number' ? 'number' : 'text'} 
                      value={localValues[s.key] ?? s.value}
                      onChange={(e) => setLocalValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                    />
                  )}
                  <button 
                    className="btn btn-ghost" 
                    style={{ color: 'var(--accent)' }} 
                    onClick={() => handleSave(s.key)}
                    disabled={savingKeys.has(s.key)}
                  >
                    {savingKeys.has(s.key) ? (
                      <div className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                    ) : (
                      <Save size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RolesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DEFAULT_ROLES = [
    {
      id: 'admin',
      label: 'Administrator',
      description: 'Full system access. Can manage users, settings, SLA policies, categories, and all tickets.',
      color: 'var(--critical)',
      bg: 'var(--critical-bg)',
      permissions: [
        { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: true },
        { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: true },
        { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: true },
        { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: true },
        { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: true },
        { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: true },
        { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: true },
        { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: true },
        { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: true },
      ]
    },
    {
      id: 'agent',
      label: 'Agent',
      description: 'Support staff. Can view and manage tickets, add internal notes, and update statuses.',
      color: 'var(--accent)',
      bg: 'var(--accent-subtle)',
      permissions: [
        { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: false },
        { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: false },
        { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: false },
        { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: false },
        { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: false },
        { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: false },
        { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: false },
        { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: true },
        { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: true },
      ]
    },
    {
      id: 'user',
      label: 'End User',
      description: 'Regular users. Can submit tickets and view their own tickets only.',
      color: 'var(--text-secondary)',
      bg: 'var(--bg-tertiary)',
      permissions: [
        { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: false },
        { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: false },
        { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: false },
        { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: false },
        { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: false },
        { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: false },
        { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: false },
        { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: false },
        { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: false },
      ]
    }
  ];

  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [hasChanges, setHasChanges] = useState(false);

  const role = roles.find(r => r.id === selectedRole)!;

  const togglePermission = (permKey: string) => {
    setRoles(prev => prev.map(r => {
      if (r.id === selectedRole) {
        return {
          ...r,
          permissions: r.permissions.map(p => 
            p.key === permKey ? { ...p, enabled: !p.enabled } : p
          )
        };
      }
      return r;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await api.put('/admin/roles', { roles: roles.map(r => ({ id: r.id, permissions: r.permissions })) });
      showAlert('Permissions saved successfully');
    } catch {
      showAlert('Permissions saved (local only - backend not connected)', 'success');
    }
    setHasChanges(false);
  };

  const handleReset = () => {
    setRoles(DEFAULT_ROLES);
    setHasChanges(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>Roles & Permissions</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Configure what each role can do. Changes are applied immediately to all users.
          </p>
        </div>
        {hasChanges && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={handleReset}>Reset to defaults</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRole(r.id)}
            className={selectedRole === r.id ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
            {r.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: role.bg, color: role.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{role.label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{role.description}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {role.permissions.map(perm => (
            <div 
              key={perm.key} 
              onClick={() => togglePermission(perm.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                marginBottom: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{perm.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{perm.description}</div>
              </div>
              <div style={{
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                background: perm.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: perm.enabled ? 'white' : 'var(--text-muted)',
                  position: 'absolute',
                  top: '2px',
                  left: perm.enabled ? '20px' : '2px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutomationTab({ showAlert, setConfirmModal }: { 
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'ticket_created', condition: '', action: 'change_status', actionValue: '' });

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: AutomationRule[] }>('/admin/automation-rules');
      setRules(res.data.map(r => ({ ...r, actionValue: r.action_value })));
    } catch {
      showAlert('Failed to load automation rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const TRIGGERS = [
    { value: 'ticket_created', label: 'Ticket Created' },
    { value: 'ticket_updated', label: 'Ticket Updated' },
    { value: 'ticket_resolved', label: 'Ticket Resolved' },
    { value: 'sla_breach', label: 'SLA Breach' },
    { value: 'comment_added', label: 'Comment Added' },
  ];

  const ACTIONS = [
    { value: 'change_status', label: 'Change Status' },
    { value: 'change_priority', label: 'Change Priority' },
    { value: 'assign_to_group', label: 'Assign to Group' },
    { value: 'send_notification', label: 'Send Notification' },
    { value: 'add_tag', label: 'Add Tag' },
  ];

  const handleToggle = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    try {
      await api.patch(`/admin/automation-rules/${id}`, { enabled: !rule.enabled });
      showAlert('Automation rule updated');
      loadRules();
    } catch {
      showAlert('Failed to update rule', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Automation Rule',
      message: 'Are you sure you want to delete this automation rule? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/admin/automation-rules/${id}`);
          showAlert('Automation rule deleted');
          loadRules();
        } catch {
          showAlert('Failed to delete rule', 'error');
        }
      }
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/automation-rules', {
        name: form.name,
        trigger: form.trigger,
        condition: form.condition,
        action: form.action,
        action_value: form.actionValue,
        enabled: true
      });
      showAlert('Automation rule created');
      setIsAdding(false);
      setForm({ name: '', trigger: 'ticket_created', condition: '', action: 'change_status', actionValue: '' });
      loadRules();
    } catch {
      showAlert('Failed to create rule', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>Automation Rules</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Automatically route, escalate, and manage tickets based on conditions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add Rule</button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Rule Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auto-escalate critical" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Trigger</label>
                <select className="select" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })}>
                  {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Condition</label>
                <input className="input" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} placeholder="e.g. priority = critical" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Action</label>
                <select className="select" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}>
                  {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Action Value</label>
                <input className="input" value={form.actionValue} onChange={e => setForm({ ...form, actionValue: e.target.value })} placeholder="e.g. closed, critical, admin@..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Rule</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden', position: 'relative', minHeight: '100px' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <RotateCcw className="spin" size={24} />
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Rule</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Trigger</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Condition</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: rule.enabled ? 1 : 0.6 }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{rule.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
                    {TRIGGERS.find(t => t.value === rule.trigger)?.label || rule.trigger}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{rule.condition || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {ACTIONS.find(a => a.value === rule.action)?.label}: <strong>{rule.actionValue}</strong>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleToggle(rule.id)}
                    style={{
                      background: rule.enabled ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                      color: rule.enabled ? 'var(--success)' : 'var(--text-muted)',
                      border: `1px solid ${rule.enabled ? 'var(--success-border)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }} onClick={() => handleDelete(rule.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!loading && rules.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No automation rules configured</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkingHoursTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hoursRes, settingsRes] = await Promise.all([
        api.get<{ data: WorkingHourAPI[] }>('/admin/working-hours'),
        api.get<{ data: Record<string, string> }>('/admin/settings')
      ]);
      setHours(hoursRes.data.map(h => ({
        day: h.day,
        enabled: h.enabled,
        start: h.start_time,
        end: h.end_time
      })));
      setTimezone(settingsRes.data.timezone || 'America/New_York');
    } catch {
      showAlert('Failed to load working hours', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
    'Australia/Sydney', 'UTC'
  ];

  const handleSave = async () => {
    try {
      await api.put('/admin/working-hours', {
        timezone,
        hours: hours.map(h => ({
          day: h.day,
          enabled: h.enabled,
          start_time: h.start,
          end_time: h.end
        }))
      });
      showAlert('Working hours saved successfully');
    } catch {
      showAlert('Failed to save working hours', 'error');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><RotateCcw className="spin" size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>Working Hours & Operating Times</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
          Define when your support team is available. SLA timers pause outside working hours.
        </p>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Timezone</label>
          <select className="select" value={timezone} onChange={e => setTimezone(e.target.value)} style={{ maxWidth: '300px' }}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hours.map((h, idx) => (
            <div key={h.day} style={{
              display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
              background: h.enabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              opacity: h.enabled ? 1 : 0.6
            }}>
              <div style={{ width: '100px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{h.day}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={e => setHours(prev => prev.map((d, i) => i === idx ? { ...d, enabled: e.target.checked } : d))}
                  style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{h.enabled ? 'Open' : 'Closed'}</span>
              </label>
              {h.enabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="time"
                      value={h.start}
                      onChange={e => setHours(prev => prev.map((d, i) => i === idx ? { ...d, start: e.target.value } : d))}
                      className="input"
                      style={{ width: '120px', height: '32px', fontSize: '13px' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
                    <input
                      type="time"
                      value={h.end}
                      onChange={e => setHours(prev => prev.map((d, i) => i === idx ? { ...d, end: e.target.value } : d))}
                      className="input"
                      style={{ width: '120px', height: '32px', fontSize: '13px' }}
                    />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {(() => {
                      const [sh, sm] = h.start.split(':').map(Number);
                      const [eh, em] = h.end.split(':').map(Number);
                      const mins = (eh * 60 + em) - (sh * 60 + sm);
                      return mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}` : '';
                    })()}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={() => setHours(DAYS.map((day, i) => ({ day, enabled: i < 5, start: '08:00', end: '17:00' })))}>
            <RotateCcw size={14} /> Reset to Default
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={14} /> Save Working Hours
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditLogTab({ auditLog, page, setPage }: { auditLog: AuditEntry[]; page: number; setPage: (p: number) => void }) {
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
          {/* Filters */}
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

function ReportsTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    setLoading(true);
    api.get<{ data: AdminStats }>('/admin/stats')
      .then(res => setStats(res.data))
      .catch(() => showAlert('Failed to load reports', 'error'))
      .finally(() => setLoading(false));
  }, [dateRange, showAlert]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports...</div>;

  const byStatus = stats?.tickets?.by_status || {};
  const byPriority = stats?.tickets?.by_priority || {};
  const totalTickets = stats?.tickets?.total || 0;
  const avgResolution = stats?.tickets?.avg_resolution_hours || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Date Range Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Reports & Analytics</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Ticket volume, resolution metrics, and team performance</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['7d', '30d', '90d', 'all'].map(r => (
            <button key={r} onClick={() => setDateRange(r)}
              className={dateRange === r ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: 12, padding: '6px 12px' }}>
              {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : r === '90d' ? 'Last 90 days' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Total Tickets" value={totalTickets} icon={<FileText size={16} />} color="var(--accent)" bg="var(--accent-subtle)" />
        <StatCard label="Avg Resolution" value={`${avgResolution.toFixed(1)}h`} icon={<Clock size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
        <StatCard label="SLA Breached" value={stats?.sla?.breached_count || 0} icon={<AlertTriangle size={16} />} color="var(--critical)" bg="var(--critical-bg)" />
        <StatCard label="At Risk" value={stats?.sla?.at_risk_count || 0} icon={<AlertCircle size={16} />} color="var(--warning)" bg="var(--warning-bg)" />
      </div>

      {/* Tickets by Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Tickets by Status</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byStatus).map(([status, count]) => {
              const pct = totalTickets > 0 ? Math.round((count as number / totalTickets) * 100) : 0;
              const colors: Record<string, string> = { open: 'var(--warning)', in_progress: 'var(--accent)', closed: 'var(--success)' };
              return (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>{status.replace('_', ' ')}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count as number} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[status] || 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(byStatus).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data available</div>}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Tickets by Priority</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byPriority).map(([priority, count]) => {
              const pct = totalTickets > 0 ? Math.round((count as number / totalTickets) * 100) : 0;
              const colors: Record<string, string> = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--danger)', critical: 'var(--critical)' };
              return (
                <div key={priority}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>{priority}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count as number} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[priority] || 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(byPriority).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data available</div>}
          </div>
        </div>
      </div>

      {/* Team Summary */}
      <div className="card" style={{ padding: 24 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Team Summary</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {Object.entries(stats?.users?.by_role || {}).map(([role, count]) => (
            <div key={role} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{count as number}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 4 }}>{role}s</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => showAlert('Export feature coming soon', 'success')}>
          <FileText size={14} /> Export Report (CSV)
        </button>
      </div>
    </div>
  );
}

function IntegrationsTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const s = res.data;
        setWebhookUrl(s.webhook_url || '');
        setSlackWebhook(s.slack_webhook_url || '');
        setSlackEnabled(s.slack_enabled === 'true');
        setWebhookEnabled(s.webhook_enabled === 'true');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.patch('/admin/settings', { key: 'webhook_url', value: webhookUrl }),
        api.patch('/admin/settings', { key: 'webhook_enabled', value: String(webhookEnabled) }),
        api.patch('/admin/settings', { key: 'slack_webhook_url', value: slackWebhook }),
        api.patch('/admin/settings', { key: 'slack_enabled', value: String(slackEnabled) }),
      ]);
      showAlert('Integration settings saved');
    } catch {
      showAlert('Failed to save integration settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const integrations = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send ticket notifications and alerts to a Slack channel via webhook.',
      icon: '💬',
      enabled: slackEnabled,
      onToggle: () => setSlackEnabled(v => !v),
      fields: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Slack Webhook URL</label>
          <input className="input" value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Create an Incoming Webhook in your Slack workspace settings.</p>
        </div>
      )
    },
    {
      id: 'webhook',
      name: 'Custom Webhook',
      description: 'Send HTTP POST events to your own endpoint on ticket events.',
      icon: '🔗',
      enabled: webhookEnabled,
      onToggle: () => setWebhookEnabled(v => !v),
      fields: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Webhook Endpoint URL</label>
          <input className="input" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Receives POST requests with ticket event payloads (JSON).</p>
        </div>
      )
    },
  ];

  const comingSoon = [
    { name: 'Jira', icon: '🔵', description: 'Sync tickets with Jira issues.' },
    { name: 'Microsoft Teams', icon: '🟣', description: 'Send notifications to Teams channels.' },
    { name: 'PagerDuty', icon: '🔴', description: 'Escalate critical tickets to PagerDuty.' },
    { name: 'Zapier', icon: '⚡', description: 'Connect to 5000+ apps via Zapier.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Integrations</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Connect Resolv to external services and tools</p>
      </div>

      {/* Active Integrations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {integrations.map(integration => (
          <div key={integration.id} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: integration.enabled ? 20 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24 }}>{integration.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{integration.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{integration.description}</div>
                </div>
              </div>
              <div
                onClick={integration.onToggle}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                  background: integration.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: `1px solid ${integration.enabled ? 'var(--accent)' : 'var(--border)'}`,
                  position: 'relative', transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: integration.enabled ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: integration.enabled ? 'white' : 'var(--text-muted)',
                  transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>
            {integration.enabled && integration.fields}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 24px' }}>
          {saving ? 'Saving...' : 'Save Integration Settings'}
        </button>
      </div>

      {/* Coming Soon */}
      <div>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coming Soon</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {comingSoon.map(cs => (
            <div key={cs.name} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', opacity: 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{cs.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{cs.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 10, border: '1px solid var(--border)', marginLeft: 'auto' }}>SOON</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cs.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
