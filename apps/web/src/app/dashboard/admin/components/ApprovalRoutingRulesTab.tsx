'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Edit2, ArrowUp, ArrowDown, CheckSquare } from 'lucide-react';
import { ConditionSection } from './ConditionBuilder';
import type { RuleCondition, ConditionOperator } from './ConditionBuilder';

// ─── Types ───────────────────────────────────────────────────────────────────

type ApprovalStepType = 'role' | 'manager_of_requester' | 'user' | 'any_role';

interface StepDef {
  type: ApprovalStepType;
  role?: string;
  user_id?: string;
}

interface ApprovalRoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  match_type: 'all' | 'any';
  match_criteria: RuleCondition[];
  steps: StepDef[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES = ['admin', 'manager', 'agent', 'user', 'readonly'];

const OPERATORS: ConditionOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'in', label: 'in (comma-separated)' },
  { value: 'not_in', label: 'not in' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
];

const SUGGESTED_FIELDS = [
  'catalog_name', 'catalog_category', 'department', 'requester_role',
  'priority', 'title', 'location',
];

const STEP_TYPE_OPTIONS: { value: ApprovalStepType; label: string }[] = [
  { value: 'role', label: 'Role-based (any user with role)' },
  { value: 'manager_of_requester', label: "Requester's manager" },
  { value: 'user', label: 'Specific user' },
];

// ─── Step Editor ─────────────────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: StepDef;
  index: number;
  onChange: (idx: number, s: StepDef) => void;
  onRemove: (idx: number) => void;
}) {
  const update = (field: keyof StepDef, value: any) => {
    onChange(index, { ...step, [field]: value });
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 12px', background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-md)', marginBottom: 8,
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 24 }}>
        #{index + 1}
      </span>

      <select
        className="select"
        value={step.type}
        onChange={e => update('type', e.target.value)}
        style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
      >
        {STEP_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {step.type === 'role' && (
        <select
          className="select"
          value={step.role || 'manager'}
          onChange={e => update('role', e.target.value)}
          style={{ width: 140, padding: '6px 8px', fontSize: 12 }}
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      )}

      {step.type === 'user' && (
        <input
          className="input"
          value={step.user_id || ''}
          onChange={e => update('user_id', e.target.value)}
          placeholder="User UUID"
          style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
        />
      )}

      <button onClick={() => onRemove(index)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Rule Editor ─────────────────────────────────────────────────────────────

function RuleEditor({
  rule,
  onSave,
  onCancel,
  saving,
}: {
  rule: Partial<ApprovalRoutingRule>;
  onSave: (r: Partial<ApprovalRoutingRule>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(rule.name || '');
  const [description, setDescription] = useState(rule.description || '');
  const [matchType, setMatchType] = useState<'all' | 'any'>(rule.match_type || 'all');
  const [criteria, setCriteria] = useState<RuleCondition[]>(
    rule.match_criteria?.length ? rule.match_criteria : []
  );
  const [steps, setSteps] = useState<StepDef[]>(
    rule.steps?.length ? rule.steps : [{ type: 'role', role: 'manager' }]
  );

  const addCriterion = () => setCriteria([...criteria, { field: '', operator: 'equals', value: '' }]);
  const updateCriterion = (idx: number, c: RuleCondition) => {
    const next = [...criteria]; next[idx] = c; setCriteria(next);
  };
  const removeCriterion = (idx: number) => setCriteria(criteria.filter((_, i) => i !== idx));

  const addStep = () => setSteps([...steps, { type: 'role', role: 'manager' }]);
  const updateStep = (idx: number, s: StepDef) => {
    const next = [...steps]; next[idx] = s; setSteps(next);
  };
  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const canSave = name.trim().length > 0 && steps.length > 0;

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)', padding: 24,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text)' }}>
        {rule.id ? 'Edit Routing Rule' : 'New Routing Rule'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Rule Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Software requests" style={{ width: '100%', padding: '8px 12px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Description (optional)</label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '8px 12px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Match Type</label>
          <select className="select" value={matchType} onChange={e => setMatchType(e.target.value as 'all' | 'any')} style={{ padding: '8px 12px' }}>
            <option value="all">ALL criteria must match</option>
            <option value="any">ANY criterion must match</option>
          </select>
        </div>

        <ConditionSection
          conditions={criteria}
          onAdd={addCriterion}
          onChange={updateCriterion}
          onRemove={removeCriterion}
          fields={SUGGESTED_FIELDS}
          operators={OPERATORS}
          emptyLabel="No criteria — this rule will match all requests (catch-all default)."
        />

        {/* Approval Steps */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Approval Steps (sequential order)</label>
            <button onClick={addStep} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 'var(--radius-md)',
              background: 'var(--accent)', color: 'white', border: 'none',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>
              <Plus size={12} /> Add Step
            </button>
          </div>
          {steps.map((s, i) => (
            <StepEditor key={i} step={s} index={i} onChange={updateStep} onRemove={removeStep} />
          ))}
          {steps.length > 1 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Steps are evaluated sequentially. The next step triggers when the previous one is approved.
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onCancel} style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={() => onSave({
            name, description, match_type: matchType,
            match_criteria: criteria.filter(c => c.field),
            steps,
            enabled: true,
          })}
          disabled={!canSave || saving}
          style={{ padding: '8px 16px', fontSize: 13, opacity: canSave && !saving ? 1 : 0.5 }}
        >
          {saving ? 'Saving…' : rule.id ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Tab Component ──────────────────────────────────────────────────────

export function ApprovalRoutingRulesTab({
  showAlert,
}: {
  showAlert: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [rules, setRules] = useState<ApprovalRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ApprovalRoutingRule> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await api.get<{ data: ApprovalRoutingRule[] }>('/admin/approval-routing-rules');
      setRules(res.data || []);
    } catch {
      showAlert('Failed to load routing rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleSave = async (rule: Partial<ApprovalRoutingRule>) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await api.put(`/admin/approval-routing-rules/${editing.id}`, rule);
        showAlert('Rule updated');
      } else {
        await api.post('/admin/approval-routing-rules', rule);
        showAlert('Rule created');
      }
      setEditing(null);
      await loadRules();
    } catch {
      showAlert('Failed to save rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this routing rule?')) return;
    try {
      await api.delete(`/admin/approval-routing-rules/${id}`);
      showAlert('Rule deleted');
      await loadRules();
    } catch {
      showAlert('Failed to delete rule', 'error');
    }
  };

  const handleToggle = async (rule: ApprovalRoutingRule) => {
    try {
      await api.put(`/admin/approval-routing-rules/${rule.id}`, { enabled: !rule.enabled });
      showAlert(rule.enabled ? 'Rule disabled' : 'Rule enabled');
      await loadRules();
    } catch {
      showAlert('Failed to toggle rule', 'error');
    }
  };

  const formatSteps = (steps: StepDef[]) =>
    steps.map(s => {
      switch (s.type) {
        case 'role': return `Role: ${s.role}`;
        case 'manager_of_requester': return "Requester's manager";
        case 'user': return `User: ${s.user_id?.slice(0, 8)}…`;
        default: return s.type;
      }
    }).join(' → ');

  if (loading) {
    return <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Define how service catalog requests route through approvals. Rules are evaluated in priority order.
            When a request matches, its approval steps are created. The first match wins.
          </p>
        </div>
        <button
          onClick={() => setEditing({ match_type: 'all', match_criteria: [], steps: [{ type: 'role', role: 'manager' }], enabled: true })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent)', color: 'white', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {editing && (
        <div style={{ marginBottom: 24 }}>
          <RuleEditor rule={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
        </div>
      )}

      {rules.length === 0 && !editing ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border)',
        }}>
          <CheckSquare size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No Approval Routing Rules</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Create rules to control how service catalog requests are approved — by role, by the requester's manager, or by a specific person.
          </p>
          <button
            onClick={() => setEditing({ match_type: 'all', match_criteria: [], steps: [{ type: 'role', role: 'manager' }], enabled: true })}
            className="btn btn-primary"
            style={{ padding: '10px 20px', fontSize: 13 }}
          >
            <Plus size={14} /> Create Your First Rule
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: rule.enabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                opacity: rule.enabled ? 1 : 0.6,
              }}
            >
              <div style={{ minWidth: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>#{index + 1}</span>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{rule.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {rule.match_criteria && rule.match_criteria.length > 0
                    ? `${rule.match_criteria.length} criteri${rule.match_criteria.length > 1 ? 'a' : 'on'} → `
                    : 'Catch-all → '}
                  <span style={{ fontWeight: 600 }}>{formatSteps(rule.steps)}</span>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={rule.enabled} onChange={() => handleToggle(rule)} style={{ cursor: 'pointer' }} />
              </label>

              <button onClick={() => setEditing(rule)} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Edit">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleDelete(rule.id)} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
