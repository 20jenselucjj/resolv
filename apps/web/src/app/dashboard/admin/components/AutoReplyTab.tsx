'use client';

import { useEffect, useState } from 'react';
import {
  Reply, Plus, Save, ChevronDown, ChevronRight,
  Edit2, Trash2, X, CheckCircle, Sparkles, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';

interface AutoReplyCondition {
  ticket_types: string[];
  priorities: string[];
  category_id: string;
  keyword: string;
  statuses: string[];
}

interface AutoReplyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AutoReplyCondition;
  reply_subject: string;
  reply_body: string;
  send_to_requester: boolean;
  send_to_assignee: boolean;
  template_id?: string;
  event?: string;
}

interface FlatEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
}

interface Category {
  id: string;
  name: string;
}

const TICKET_TYPES = ['incident', 'service_request', 'problem', 'change'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const;

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting on User',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#2563eb',
  in_progress: '#7c3aed',
  waiting: '#f59e0b',
  resolved: '#059669',
  closed: '#6b7280',
};

const EVENTS = [
  { value: 'any', label: 'Any Event' },
  { value: 'ticket_created', label: 'Ticket Created' },
  { value: 'ticket_assigned', label: 'Ticket Assigned' },
  { value: 'ticket_reassigned', label: 'Ticket Reassigned' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'comment_added', label: 'Comment Added' },
  { value: 'ticket_resolved', label: 'Ticket Resolved' },
  { value: 'ticket_closed', label: 'Ticket Closed' },
];

const EVENT_LABELS: Record<string, string> = {
  any: 'Any Event',
  ticket_created: 'Ticket Created',
  ticket_assigned: 'Ticket Assigned',
  ticket_reassigned: 'Ticket Reassigned',
  status_changed: 'Status Changed',
  comment_added: 'Comment Added',
  ticket_resolved: 'Ticket Resolved',
  ticket_closed: 'Ticket Closed',
};

const defaultFormData = {
  name: '',
  description: '',
  ticket_types: [] as string[],
  priorities: [] as string[],
  statuses: [] as string[],
  category_id: '',
  keyword: '',
  template_id: '',
  event: 'any',
  reply_subject: 'Re: Ticket #[TICKET_ID]',
  reply_body: '',
  send_to_requester: true,
  send_to_assignee: false,
};

export function AutoReplyTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<FlatEmailTemplate[]>([]);
  const [form, setForm] = useState({ ...defaultFormData });
  const [showVars, setShowVars] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState<'prompt' | 'generating' | 'preview' | 'saving' | 'complete'>('prompt');
  const [aiGeneratedRule, setAiGeneratedRule] = useState<{
    name: string;
    description: string;
    event: string;
    conditions: { ticket_types: string[]; priorities: string[]; statuses: string[]; keyword: string };
    reply_subject: string;
    reply_body: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      const res = await api.get<{ data: AutoReplyRule[] }>('/admin/auto-replies');
      setRules(res.data || []);
    } catch {
      showAlert('Failed to load auto-reply rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get<{ data: Category[] }>('/categories');
      setCategories(res.data || []);
    } catch {
      // non-critical
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get<{ data: FlatEmailTemplate[] }>('/admin/email-templates');
      setTemplates(res.data || []);
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    Promise.all([fetchRules(), fetchCategories(), fetchTemplates()]);
  }, []);

  const resetForm = () => {
    setForm({ ...defaultFormData });
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (rule: AutoReplyRule) => {
    setForm({
      name: rule.name,
      description: rule.description,
      ticket_types: [...(rule.conditions.ticket_types || [])],
      priorities: [...(rule.conditions.priorities || [])],
      statuses: [...((rule.conditions as AutoReplyCondition).statuses || rule.conditions.statuses || [])],
      category_id: rule.conditions.category_id || '',
      keyword: rule.conditions.keyword || '',
      template_id: rule.template_id || '',
      event: rule.event || 'any',
      reply_subject: rule.reply_subject,
      reply_body: rule.reply_body,
      send_to_requester: rule.send_to_requester,
      send_to_assignee: rule.send_to_assignee,
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const toggleArray = (arr: string[], val: string): string[] => {
    if (arr.includes(val)) return arr.filter(v => v !== val);
    return [...arr, val];
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showAlert('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        event: form.event,
        conditions: {
          ticket_types: form.ticket_types,
          priorities: form.priorities,
          statuses: form.statuses,
          category_id: form.category_id || null,
          keyword: form.keyword || null,
        },
        template_id: form.template_id || '',
        reply_subject: form.template_id ? '' : form.reply_subject,
        reply_body: form.template_id ? '' : form.reply_body,
        send_to_requester: form.send_to_requester,
        send_to_assignee: form.send_to_assignee,
      };

      if (editingId) {
        await api.patch(`/admin/auto-replies/${editingId}`, body);
        showAlert('Auto-reply rule updated');
      } else {
        await api.post('/admin/auto-replies', body);
        showAlert('Auto-reply rule created');
      }
      resetForm();
      await fetchRules();
    } catch {
      showAlert('Failed to save auto-reply rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AutoReplyRule) => {
    try {
      await api.patch(`/admin/auto-replies/${rule.id}/toggle`, {});
      setRules(prev =>
        prev.map(r => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
      showAlert(`${rule.name} ${rule.enabled ? 'disabled' : 'enabled'}`);
    } catch {
      showAlert('Failed to toggle auto-reply rule', 'error');
    }
  };

  const handleDelete = async (rule: AutoReplyRule) => {
    try {
      await api.delete(`/admin/auto-replies/${rule.id}`);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      if (expandedId === rule.id) setExpandedId(null);
      showAlert(`"${rule.name}" deleted`);
    } catch {
      showAlert('Failed to delete auto-reply rule', 'error');
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiStep('generating');
    setAiError(null);
    try {
      const res = await api.post<{ data: {
        name: string;
        description: string;
        event: string;
        conditions: {
          ticket_types: string[];
          priorities: string[];
          statuses: string[];
          keyword: string;
        };
        reply_subject: string;
        reply_body: string;
      } }>('/admin/ai/generate-template', {
        type: 'auto_reply_rule',
        prompt: aiPrompt,
      });

      setAiGeneratedRule(res.data);
      setAiStep('preview');
    } catch (err: any) {
      setAiError(err?.message || 'AI generation failed');
      setAiStep('prompt');
      showAlert(err?.message || 'AI generation failed', 'error');
    }
  };

  const handleAiSave = async () => {
    if (!aiGeneratedRule) return;
    setAiStep('saving');
    try {
      await api.post('/admin/auto-replies', {
        name: aiGeneratedRule.name,
        description: aiGeneratedRule.description,
        event: aiGeneratedRule.event,
        conditions: aiGeneratedRule.conditions,
        reply_subject: aiGeneratedRule.reply_subject,
        reply_body: aiGeneratedRule.reply_body,
        send_to_requester: true,
        send_to_assignee: false,
      });
      showAlert('Auto-reply rule created by AI');
      await fetchRules();
      setAiStep('complete');
      setTimeout(() => {
        setShowAiPanel(false);
        setAiPrompt('');
        setAiGeneratedRule(null);
        setAiStep('prompt');
        setAiError(null);
      }, 2000);
    } catch (err: any) {
      showAlert(err?.message || 'Failed to save rule', 'error');
      setAiStep('preview');
    }
  };

  const handleAiEdit = () => {
    if (!aiGeneratedRule) return;
    setForm({
      name: aiGeneratedRule.name,
      description: aiGeneratedRule.description,
      ticket_types: aiGeneratedRule.conditions.ticket_types || [],
      priorities: aiGeneratedRule.conditions.priorities || [],
      statuses: aiGeneratedRule.conditions.statuses || [],
      category_id: '',
      keyword: aiGeneratedRule.conditions.keyword || '',
      template_id: '',
      event: aiGeneratedRule.event || 'any',
      reply_subject: aiGeneratedRule.reply_subject,
      reply_body: aiGeneratedRule.reply_body,
      send_to_requester: true,
      send_to_assignee: false,
    });
    setEditingId(null);
    setShowForm(true);
    setShowAiPanel(false);
    setAiPrompt('');
    setAiGeneratedRule(null);
    setAiStep('prompt');
    setAiError(null);
  };

  const handleAiRegenerate = () => {
    setAiGeneratedRule(null);
    setAiError(null);
    handleAiGenerate();
  };

  const handleAiCancel = () => {
    setShowAiPanel(false);
    setAiPrompt('');
    setAiGeneratedRule(null);
    setAiStep('prompt');
    setAiError(null);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const toggleStyle: React.CSSProperties = {
    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
    position: 'relative', transition: 'background 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4,
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Auto Reply Rules</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Automatically reply to tickets that match defined conditions
          </div>
        </div>
        {!showForm && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost"
              onClick={() => setShowAiPanel(!showAiPanel)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)' }}
            >
              <Sparkles size={14} /> AI Generate
            </button>
            <button
              className="btn btn-primary"
              onClick={() => { resetForm(); setShowForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Plus size={14} />
              Add Rule
            </button>
          </div>
        )}
      </div>

      {/* AI Rule Assistant Panel */}
      {showAiPanel && (
        <div className="card" style={{
          padding: 24,
          background: 'linear-gradient(135deg, var(--accent-subtle), var(--bg-secondary))',
          border: '1px solid var(--accent-border)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'block' }}>
                  AI Rule Assistant
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {aiStep === 'prompt' && 'Describe the rule you need'}
                  {aiStep === 'generating' && 'Creating your rule...'}
                  {aiStep === 'preview' && 'Review before saving'}
                  {aiStep === 'saving' && 'Saving your rule...'}
                  {aiStep === 'complete' && 'All done!'}
                </span>
              </div>
            </div>
            <button
              onClick={handleAiCancel}
              disabled={aiStep === 'generating' || aiStep === 'saving'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: aiStep === 'generating' || aiStep === 'saving' ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: 'var(--text-muted)', transition: 'all 0.12s',
                opacity: aiStep === 'generating' || aiStep === 'saving' ? 0.4 : 1,
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress Steps */}
          {aiStep !== 'complete' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '0 4px' }}>
              {['Prompt', 'Generate', 'Preview', 'Save'].map((label, i) => {
                const stepMap = { prompt: 0, generating: 1, preview: 2, saving: 3, complete: 4 };
                const current = stepMap[aiStep];
                const isActive = current >= i;
                const isCompleted = current > i;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i === 3 ? 0 : 1 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      flexShrink: 0,
                    }}>
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    <span style={{
                      fontSize: 12,
                      color: isActive ? 'var(--text)' : 'var(--text-muted)',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.4s ease',
                      whiteSpace: 'nowrap',
                    }}>
                      {label}
                    </span>
                    {i < 3 && (
                      <div style={{
                        flex: 1, height: 2, minWidth: 12,
                        background: isCompleted ? 'var(--accent)' : 'var(--border)',
                        transition: 'all 0.4s ease',
                        marginLeft: 4, marginRight: 4,
                        borderRadius: 1,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Error */}
          {aiError && aiStep === 'prompt' && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: '#fef2f2', border: '1px solid #fecaca',
              color: 'var(--danger)', fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <X size={14} /> {aiError}
            </div>
          )}

          {/* Content */}
          <div style={{ transition: 'all 0.3s ease' }}>
            {/* Prompt */}
            {aiStep === 'prompt' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <textarea
                    style={{
                      width: '100%', minHeight: 90, padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--accent-border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder={'Describe the auto-reply rule, e.g., "When a high priority incident is created, send an urgent notification to the requester with expected response time"'}
                    rows={3}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Describe what you want the rule to do in natural language. The AI will generate conditions, event trigger, and reply content.
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn"
                    onClick={handleAiGenerate}
                    disabled={!aiPrompt.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                      padding: '8px 16px',
                      border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      background: !aiPrompt.trim()
                        ? 'var(--bg-tertiary)'
                        : 'linear-gradient(135deg, var(--accent), #7c3aed)',
                      color: !aiPrompt.trim() ? 'var(--text-muted)' : '#fff',
                      fontWeight: 600,
                    }}
                  >
                    <Sparkles size={14} /> Generate Rule
                  </button>
                </div>
              </div>
            )}

            {/* Generating */}
            {aiStep === 'generating' && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 48, height: 48, margin: '0 auto 20px' }}>
                  <Loader2 size={48} style={{ color: 'var(--accent)', animation: 'spin 1.2s linear infinite' }} />
                  <div style={{
                    position: 'absolute', inset: -4,
                    borderRadius: '50%',
                    border: '2px solid var(--accent)',
                    opacity: 0.3,
                    animation: 'pulse-ring 1.5s ease-out infinite',
                  }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Generating your rule...
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.5s infinite' }} />
                    Sending prompt to AI...
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', animation: 'pulse-dot 1.5s infinite 0.5s' }} />
                    Generating rule conditions...
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', animation: 'pulse-dot 1.5s infinite 1s' }} />
                    Preparing reply content...
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            {aiStep === 'preview' && aiGeneratedRule && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  padding: 16, borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                    Generated Rule Preview
                  </div>

                  {/* Rule Name & Description */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>NAME</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{aiGeneratedRule.name}</div>
                    {aiGeneratedRule.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{aiGeneratedRule.description}</div>
                    )}
                  </div>

                  {/* Event */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>EVENT TRIGGER</div>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-subtle)', color: 'var(--accent)',
                      border: '1px solid var(--accent)', fontWeight: 600,
                    }}>
                      {EVENT_LABELS[aiGeneratedRule.event] || aiGeneratedRule.event}
                    </span>
                  </div>

                  {/* Conditions */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>CONDITIONS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {aiGeneratedRule.conditions.ticket_types?.map(t => (
                        <span key={t} style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-subtle)', color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                        }}>
                          Type: {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ))}
                      {aiGeneratedRule.conditions.priorities?.map(p => (
                        <span key={p} style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                          background: `${PRIORITY_COLORS[p]}18`, color: PRIORITY_COLORS[p],
                          border: `1px solid ${PRIORITY_COLORS[p]}`,
                        }}>
                          Priority: {p.charAt(0).toUpperCase() + p.slice(1)}
                        </span>
                      ))}
                      {aiGeneratedRule.conditions.statuses?.map(s => (
                        <span key={s} style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                          background: `${STATUS_COLORS[s]}18`, color: STATUS_COLORS[s],
                          border: `1px solid ${STATUS_COLORS[s]}`,
                        }}>
                          Status: {STATUS_LABELS[s] || s}
                        </span>
                      ))}
                      {aiGeneratedRule.conditions.keyword && (
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          Keyword: "{aiGeneratedRule.conditions.keyword}"
                        </span>
                      )}
                      {(!aiGeneratedRule.conditions.ticket_types || aiGeneratedRule.conditions.ticket_types.length === 0) &&
                       (!aiGeneratedRule.conditions.priorities || aiGeneratedRule.conditions.priorities.length === 0) &&
                       (!aiGeneratedRule.conditions.statuses || aiGeneratedRule.conditions.statuses.length === 0) &&
                       !aiGeneratedRule.conditions.keyword && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Applies to all tickets</span>
                      )}
                    </div>
                  </div>

                  {/* Reply Content */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>REPLY SUBJECT</div>
                    <div style={{
                      fontSize: 13, color: 'var(--text)', marginBottom: 10,
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)', fontFamily: 'monospace',
                    }}>
                      {aiGeneratedRule.reply_subject}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>REPLY BODY</div>
                    <div style={{
                      fontSize: 12, color: 'var(--text)',
                      padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                      maxHeight: 150, overflowY: 'auto',
                    }}>
                      {aiGeneratedRule.reply_body || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No body content</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleAiCancel}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer', background: 'transparent',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAiRegenerate}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-border)',
                      cursor: 'pointer', background: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Sparkles size={14} /> Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleAiEdit}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer', background: 'var(--bg-elevated)',
                      color: 'var(--text)',
                    }}
                  >
                    <Edit2 size={14} /> Edit Before Saving
                  </button>
                  <button
                    type="button"
                    onClick={handleAiSave}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700, padding: '8px 18px',
                      borderRadius: 'var(--radius-sm)', border: 'none',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
                      color: '#fff',
                    }}
                  >
                    <CheckCircle size={14} /> Create Rule
                  </button>
                </div>
              </div>
            )}

            {/* Saving */}
            {aiStep === 'saving' && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <Loader2 size={40} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  Saving rule...
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Please wait while we save your new rule
                </div>
              </div>
            )}

            {/* Complete */}
            {aiStep === 'complete' && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: '#059669', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  animation: 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}>
                  <CheckCircle size={28} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
                  Rule created successfully!
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {aiGeneratedRule?.name}
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity: 0.3; }
              100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes pulse-dot {
              0%, 100% { opacity: 0.4; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }
            @keyframes scale-in {
              0% { transform: scale(0); }
              100% { transform: scale(1); }
            }
          `}</style>
        </div>
      )}

      {/* Variables Reference */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Available Variables</div>
          <button
            onClick={() => setShowVars(!showVars)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--accent)', padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {showVars ? 'Collapse' : 'Expand'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {!showVars && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 2 }}>Variables:</span>
          )}
          {(showVars
            ? ['TICKET_ID', 'TICKET_TITLE', 'USER_NAME', 'AGENT_NAME', 'TICKET_URL', 'PRIORITY', 'STATUS', 'REQUESTOR_NAME', 'ASSIGNED_TO_NAME', 'CREATED_AT', 'DUE_DATE', 'CATEGORY', 'TICKET_TYPE', 'DESCRIPTION', 'COMMENT_BODY']
            : ['TICKET_ID', 'USER_NAME', 'PRIORITY']
          ).map(v => (
            <code key={v} style={{
              padding: '1px 5px', borderRadius: 'var(--radius-sm)', fontSize: 10,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
              color: 'var(--accent)',
            }}>
              [{v}]
            </code>
          ))}
          {!showVars && (
            <button
              onClick={() => setShowVars(true)}
              style={{
                padding: '1px 5px', borderRadius: 'var(--radius-sm)', fontSize: 10,
                background: 'none', border: 'none',
                color: 'var(--accent)', cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              (+{12} more)
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {editingId ? <Edit2 size={14} color="var(--accent)" /> : <Plus size={14} color="var(--accent)" />}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
              {editingId ? 'Edit Rule' : 'New Rule'}
            </div>
            <button
              onClick={resetForm}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name & Description */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Password Reset Reply"
                />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this rule"
                />
              </div>
            </div>

            {/* Trigger Section */}
            <div style={{
              padding: 16, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderLeft: '3px solid var(--accent)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Trigger</div>
              <div>
                <label style={labelStyle}>Event</label>
                <select
                  style={inputStyle}
                  value={form.event}
                  onChange={e => setForm(prev => ({ ...prev, event: e.target.value }))}
                >
                  {EVENTS.map(ev => (
                    <option key={ev.value} value={ev.value}>{ev.label}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Send email when this event occurs and conditions match
                </div>
              </div>
            </div>

            {/* Conditions Section */}
            <div style={{
              padding: 16, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Conditions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Ticket Types */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: 6 }}>Ticket Types</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TICKET_TYPES.map(t => (
                      <label
                        key={t}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 'var(--radius-md)',
                          border: `1px solid ${form.ticket_types.includes(t) ? 'var(--accent)' : 'var(--border)'}`,
                          background: form.ticket_types.includes(t) ? 'var(--accent-subtle)' : 'var(--bg)',
                          cursor: 'pointer', fontSize: 12,
                          color: form.ticket_types.includes(t) ? 'var(--accent)' : 'var(--text-secondary)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.ticket_types.includes(t)}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            ticket_types: toggleArray(prev.ticket_types, t),
                          }))}
                          style={{ display: 'none' }}
                        />
                        {form.ticket_types.includes(t) ? (
                          <CheckCircle size={12} />
                        ) : (
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />
                        )}
                        {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priorities */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: 6 }}>Priorities</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {PRIORITIES.map(p => (
                      <label
                        key={p}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 'var(--radius-md)',
                          border: `1px solid ${form.priorities.includes(p) ? PRIORITY_COLORS[p] : 'var(--border)'}`,
                          background: form.priorities.includes(p)
                            ? `${PRIORITY_COLORS[p]}18`
                            : 'var(--bg)',
                          cursor: 'pointer', fontSize: 12,
                          color: form.priorities.includes(p) ? PRIORITY_COLORS[p] : 'var(--text-secondary)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.priorities.includes(p)}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            priorities: toggleArray(prev.priorities, p),
                          }))}
                          style={{ display: 'none' }}
                        />
                        {form.priorities.includes(p) ? (
                          <CheckCircle size={12} />
                        ) : (
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />
                        )}
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Statuses */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: 6 }}>Statuses</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {STATUSES.map(s => (
                      <label
                        key={s}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 'var(--radius-md)',
                          border: `1px solid ${form.statuses.includes(s) ? STATUS_COLORS[s] : 'var(--border)'}`,
                          background: form.statuses.includes(s)
                            ? `${STATUS_COLORS[s]}18`
                            : 'var(--bg)',
                          cursor: 'pointer', fontSize: 12,
                          color: form.statuses.includes(s) ? STATUS_COLORS[s] : 'var(--text-secondary)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.statuses.includes(s)}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            statuses: toggleArray(prev.statuses, s),
                          }))}
                          style={{ display: 'none' }}
                        />
                        {form.statuses.includes(s) ? (
                          <CheckCircle size={12} />
                        ) : (
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />
                        )}
                        {STATUS_LABELS[s]}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Category + Keyword */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      style={inputStyle}
                      value={form.category_id}
                      onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
                    >
                      <option value="">Any Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Keyword</label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={form.keyword}
                      onChange={e => setForm(prev => ({ ...prev, keyword: e.target.value }))}
                      placeholder="Match in title/description"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Email Template */}
            <div style={{
              padding: 16, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Email Template</div>
              <div>
                <label style={labelStyle}>Template</label>
                <select
                  style={inputStyle}
                  value={form.template_id}
                  onChange={e => setForm(prev => ({ ...prev, template_id: e.target.value }))}
                >
                  <option value="">Use custom subject/body below</option>
                  {templates
                    .slice()
                    .sort((a, b) => (a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1))
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.is_default ? ' (Default)' : ''}
                      </option>
                    ))}
                </select>
                {form.template_id && (() => {
                  const sel = templates.find(t => t.id === form.template_id);
                  return sel ? (
                    <div style={{
                      marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg)', border: '1px solid var(--border-subtle)',
                      fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Template Preview</div>
                      <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>Subject:</span> {sel.subject}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto' }}>
                        <span style={{ fontWeight: 600 }}>Body:</span> {sel.body || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(empty)</span>}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Reply Content */}
            <div style={{
              padding: 16, borderRadius: 'var(--radius-md)',
              background: form.template_id ? 'var(--bg-secondary)' : 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              opacity: form.template_id ? 0.5 : 1,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                Reply Content {form.template_id && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(using template — inline content ignored)</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Reply Subject</label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={form.reply_subject}
                    onChange={e => setForm(prev => ({ ...prev, reply_subject: e.target.value }))}
                    placeholder="Re: Ticket #[TICKET_ID]"
                    disabled={!!form.template_id}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Reply Body</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
                    value={form.reply_body}
                    onChange={e => setForm(prev => ({ ...prev, reply_body: e.target.value }))}
                    placeholder={`Hi [USER_NAME],\n\nThank you for contacting us regarding ticket #[TICKET_ID].\n\nWe are looking into this and will get back to you shortly.\n\nBest regards,\n[AGENT_NAME]`}
                    disabled={!!form.template_id}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Use [TICKET_ID], [TICKET_TITLE], [USER_NAME], [AGENT_NAME], [TICKET_URL], [PRIORITY], [STATUS] as placeholders
                  </div>
                </div>
              </div>
            </div>

            {/* Send Options */}
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: `1px solid ${form.send_to_requester ? 'var(--accent)' : 'var(--border)'}`,
                background: form.send_to_requester ? 'var(--accent-subtle)' : 'var(--bg)',
                cursor: 'pointer', fontSize: 13, userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={form.send_to_requester}
                  onChange={e => setForm(prev => ({ ...prev, send_to_requester: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                Send to Requester
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: `1px solid ${form.send_to_assignee ? 'var(--accent)' : 'var(--border)'}`,
                background: form.send_to_assignee ? 'var(--accent-subtle)' : 'var(--bg)',
                cursor: 'pointer', fontSize: 13, userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={form.send_to_assignee}
                  onChange={e => setForm(prev => ({ ...prev, send_to_assignee: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                Send to Assignee
              </label>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <Save size={14} />
                {saving ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 && !showForm ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          No auto-reply rules configured yet. Click "Add Rule" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map(rule => {
            const isExpanded = expandedId === rule.id;
            const isEditing = editingId === rule.id && showForm;
            return (
              <div
                key={rule.id}
                className="card"
                style={{
                  padding: '14px 16px',
                  border: `1px solid ${rule.enabled ? 'var(--border)' : 'var(--border-subtle)'}`,
                  opacity: rule.enabled ? 1 : 0.6,
                }}
              >
                {/* Collapsed Row */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                >
                  {/* Expand icon */}
                  <div style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>

                  {/* Enabled toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); handleToggle(rule); }}
                    style={{
                      ...toggleStyle,
                      background: rule.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                      position: 'absolute', top: 3,
                      left: rule.enabled ? 25 : 3,
                      transition: 'left 0.2s ease',
                    }} />
                  </button>

                  {/* Name & description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{rule.name}</div>
                    {rule.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rule.description}
                      </div>
                    )}
                  </div>

                  {/* Conditions summary badges */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {rule.event && rule.event !== 'any' && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-subtle)', color: 'var(--accent)',
                        border: '1px solid var(--accent)',
                      }}>
                        On: {EVENT_LABELS[rule.event] || rule.event}
                      </span>
                    )}
                    {rule.conditions.ticket_types.length > 0 && rule.conditions.ticket_types.length < 4 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {rule.conditions.ticket_types.map(t => t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ')}
                      </span>
                    )}
                    {rule.conditions.priorities.length > 0 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {rule.conditions.priorities.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                      </span>
                    )}
                    {rule.conditions.statuses && rule.conditions.statuses.length > 0 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {rule.conditions.statuses.map(s => STATUS_LABELS[s] || s).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); openEditForm(rule); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                      }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(rule); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, color: 'var(--danger)',
                        display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && !isEditing && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    {/* Conditions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Conditions</div>
                      {rule.event && rule.event !== 'any' && (
                        <span style={{
                          padding: '2px 7px', borderRadius: 'var(--radius-sm)', fontSize: 10,
                          background: 'var(--accent-subtle)', color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                        }}>
                          Trigger: {EVENT_LABELS[rule.event] || rule.event}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {rule.conditions.ticket_types.map(t => (
                        <span key={t} style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: 'var(--accent-subtle)', color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                        }}>
                          Type: {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ))}
                      {rule.conditions.priorities.map(p => (
                        <span key={p} style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: `${PRIORITY_COLORS[p]}18`, color: PRIORITY_COLORS[p],
                          border: `1px solid ${PRIORITY_COLORS[p]}`,
                        }}>
                          Priority: {p.charAt(0).toUpperCase() + p.slice(1)}
                        </span>
                      ))}
                      {rule.conditions.statuses && rule.conditions.statuses.map(s => (
                        <span key={s} style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: `${STATUS_COLORS[s]}18`, color: STATUS_COLORS[s],
                          border: `1px solid ${STATUS_COLORS[s]}`,
                        }}>
                          Status: {STATUS_LABELS[s] || s}
                        </span>
                      ))}
                      {rule.conditions.category_id && (
                        <span style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          Category: {categories.find(c => c.id === rule.conditions.category_id)?.name || rule.conditions.category_id}
                        </span>
                      )}
                      {rule.conditions.keyword && (
                        <span style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          Keyword: "{rule.conditions.keyword}"
                        </span>
                      )}
                      {(!rule.conditions.ticket_types || rule.conditions.ticket_types.length === 0) &&
                       (!rule.conditions.priorities || rule.conditions.priorities.length === 0) &&
                       (!rule.conditions.statuses || rule.conditions.statuses.length === 0) &&
                       !rule.conditions.category_id && !rule.conditions.keyword && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Applies to all tickets</span>
                      )}
                    </div>

                    {/* Template info */}
                    {rule.template_id && (() => {
                      const tmpl = templates.find(t => t.id === rule.template_id);
                      return tmpl ? (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email Template</div>
                          <div style={{
                            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                            fontSize: 12, color: 'var(--accent)',
                          }}>
                            {tmpl.name}{tmpl.is_default ? ' (Default)' : ''}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email Template</div>
                          <div style={{
                            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                            fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic',
                          }}>
                            Unknown template ({rule.template_id})
                          </div>
                        </div>
                      );
                    })()}

                    {/* Reply Subject */}
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reply Subject</div>
                    <div style={{
                      fontSize: 12, color: 'var(--text)', marginBottom: 12,
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)', fontFamily: 'monospace',
                    }}>
                      {rule.reply_subject}
                    </div>

                    {/* Reply Body Preview */}
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reply Body</div>
                    <div style={{
                      fontSize: 12, color: 'var(--text)', marginBottom: 12,
                      padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)',
                      whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                      maxHeight: 120, overflowY: 'auto',
                    }}>
                      {rule.reply_body || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No body content</span>}
                    </div>

                    {/* Delivery Options */}
                    <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                      }}>
                        {rule.send_to_requester ? 'Send to Requester' : 'No requester notification'}
                      </span>
                      <span style={{
                        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                      }}>
                        {rule.send_to_assignee ? 'Send to Assignee' : 'No assignee notification'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
