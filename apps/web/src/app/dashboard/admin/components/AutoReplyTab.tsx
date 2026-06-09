'use client';

import { useEffect, useState } from 'react';
import {
  Plus, ChevronDown, ChevronRight,
  Edit2, Trash2, Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AutoReplyRule, FlatEmailTemplate, Category } from './auto-reply/types';
import {
  PRIORITY_COLORS,
  STATUS_LABELS, STATUS_COLORS,
  EVENT_LABELS,
  VARIABLES_ALL, VARIABLES_SHORT,
} from './auto-reply/types';
import { AIRuleAssistant } from './auto-reply/AIRuleAssistant';
import { AutoReplyForm } from './auto-reply/AutoReplyForm';

export function AutoReplyTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<FlatEmailTemplate[]>([]);
  const [showVars, setShowVars] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await api.get<{ data: AutoReplyRule[] }>('/admin/auto-replies');
      setRules(res.data || []);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load auto-reply rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get<{ data: Category[] }>('/categories');
      setCategories(res.data || []);
    } catch { /* non-critical */ }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get<{ data: FlatEmailTemplate[] }>('/admin/email-templates');
      setTemplates(res.data || []);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([fetchRules(), fetchCategories(), fetchTemplates()]);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openNewForm = () => {
    setEditingId(null);
    setShowForm(true);
    setShowAiPanel(false);
  };

  const openEditForm = (rule: AutoReplyRule) => {
    setEditingId(rule.id);
    setShowForm(true);
    setShowAiPanel(false);
  };

  const handleToggle = async (rule: AutoReplyRule) => {
    try {
      await api.patch(`/admin/auto-replies/${rule.id}/toggle`, {});
      setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
      showAlert(`${rule.name} ${rule.enabled ? 'disabled' : 'enabled'}`);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to toggle auto-reply rule', 'error');
    }
  };

  const handleDelete = async (rule: AutoReplyRule) => {
    try {
      await api.delete(`/admin/auto-replies/${rule.id}`);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      if (expandedId === rule.id) setExpandedId(null);
      showAlert(`"${rule.name}" deleted`);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to delete auto-reply rule', 'error');
    }
  };

  const editingRule = editingId ? rules.find(r => r.id === editingId) ?? null : null;

  const toggleStyle: React.CSSProperties = {
    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
    position: 'relative', transition: 'background 0.2s',
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
              onClick={openNewForm}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Plus size={14} /> Add Rule
            </button>
          </div>
        )}
      </div>

      {/* AI Rule Assistant */}
      {showAiPanel && (
        <AIRuleAssistant
          showAlert={showAlert}
          onRuleCreated={() => { setShowAiPanel(false); fetchRules(); }}
        />
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
          {!showVars && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 2 }}>Variables:</span>}
          {(showVars ? VARIABLES_ALL : VARIABLES_SHORT).map(v => (
            <code key={v} style={{
              padding: '1px 5px', borderRadius: 'var(--radius-sm)', fontSize: 10,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
              color: 'var(--accent)',
            }}>
              [{v}]
            </code>
          ))}
          {!showVars && (
            <button onClick={() => setShowVars(true)} style={{
              padding: '1px 5px', borderRadius: 'var(--radius-sm)', fontSize: 10,
              background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
              textDecoration: 'underline',
            }}>
              (+{VARIABLES_ALL.length - VARIABLES_SHORT.length} more)
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <AutoReplyForm
          showAlert={showAlert}
          onSaved={() => { setShowForm(false); setEditingId(null); fetchRules(); }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          editingRule={editingRule}
          categories={categories}
          templates={templates}
        />
      )}

      {/* Rules List */}
      {rules.length === 0 && !showForm ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No auto-reply rules configured yet. Click "Add Rule" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map(rule => {
            const isExpanded = expandedId === rule.id;
            const isEditing = editingId === rule.id && showForm;
            if (isEditing) return null; // rendered in the form above
            return (
              <div key={rule.id} className="card" style={{
                padding: '14px 16px',
                border: `1px solid ${rule.enabled ? 'var(--border)' : 'var(--border-subtle)'}`,
                opacity: rule.enabled ? 1 : 0.6,
              }}>
                {/* Collapsed Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : rule.id)}>
                  {/* Expand icon */}
                  <div style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>

                  {/* Enabled toggle */}
                  <button onClick={e => { e.stopPropagation(); handleToggle(rule); }} style={{
                    ...toggleStyle,
                    background: rule.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                      position: 'absolute', top: 3,
                      left: rule.enabled ? 25 : 3, transition: 'left 0.2s ease',
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
                    {rule.conditions.ticket_types?.length > 0 && rule.conditions.ticket_types?.length < 4 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {(rule.conditions.ticket_types || []).map(t => t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ')}
                      </span>
                    )}
                    {rule.conditions.priorities?.length > 0 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {(rule.conditions.priorities || []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                      </span>
                    )}
                    {rule.conditions.statuses && rule.conditions.statuses.length > 0 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {(rule.conditions.statuses || []).map(s => STATUS_LABELS[s] || s).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); openEditForm(rule); }} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                    }} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(rule); }} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, color: 'var(--danger)',
                      display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                    }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
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
                      {(rule.conditions.ticket_types || []).map(t => (
                        <span key={t} style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: 'var(--accent-subtle)', color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                        }}>
                          Type: {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ))}
                      {(rule.conditions.priorities || []).map(p => (
                        <span key={p} style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: `${PRIORITY_COLORS[p]}18`, color: PRIORITY_COLORS[p],
                          border: `1px solid ${PRIORITY_COLORS[p]}`,
                        }}>
                          Priority: {p.charAt(0).toUpperCase() + p.slice(1)}
                        </span>
                      ))}
                      {rule.conditions.statuses && (rule.conditions.statuses as string[]).map(s => (
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

                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reply Subject</div>
                    <div style={{
                      fontSize: 12, color: 'var(--text)', marginBottom: 12,
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)', fontFamily: 'monospace',
                    }}>
                      {rule.reply_subject}
                    </div>

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

                    <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)' }}>
                        {rule.send_to_requester ? 'Send to Requester' : 'No requester notification'}
                      </span>
                      <span style={{ padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)' }}>
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
