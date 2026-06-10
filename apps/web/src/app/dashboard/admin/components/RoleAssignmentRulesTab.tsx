'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Edit2, GripVertical, ArrowUp, ArrowDown, Shield, AlertCircle } from 'lucide-react';
// Inline types (packages/shared not aliased in web tsconfig)
type UserRole = 'admin' | 'manager' | 'agent' | 'user' | 'readonly';
type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists' | 'gt' | 'gte' | 'lt' | 'lte';
interface RuleCondition { field: string; operator: ConditionOperator; value: any; }
interface RoleAssignmentRule {
  id: string; name: string; description?: string; priority: number;
  match_type: 'all' | 'any'; conditions: RuleCondition[]; role: UserRole;
  enabled: boolean; created_at?: string; updated_at?: string;
}

const ROLES: UserRole[] = ['admin', 'manager', 'agent', 'user', 'readonly'];

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'in', label: 'in (comma-separated)' },
  { value: 'not_in', label: 'not in' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'not exists' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
];

const SUGGESTED_FIELDS = [
  'department', 'title', 'email', 'name', 'location', 'cost_center',
  'employee_id', 'external_id', 'google_admin', 'suspended',
];

const EMPTY_CONDITION: RuleCondition = { field: '', operator: 'equals', value: '' };

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  index: number;
  onChange: (idx: number, c: RuleCondition) => void;
  onRemove: (idx: number) => void;
}) {
  const update = (field: keyof RuleCondition, value: any) => {
    onChange(index, { ...condition, [field]: value });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <select
        className="select"
        value={condition.field}
        onChange={e => update('field', e.target.value)}
        style={{ width: 160, padding: '6px 8px', fontSize: 12 }}
      >
        <option value="">Select field…</option>
        {SUGGESTED_FIELDS.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <select
        className="select"
        value={condition.operator}
        onChange={e => update('operator', e.target.value)}
        style={{ width: 160, padding: '6px 8px', fontSize: 12 }}
      >
        {OPERATORS.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {!['exists', 'not_exists'].includes(condition.operator) && (
        <input
          className="input"
          value={typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value ?? '')}
          onChange={e => {
            // If operator is 'in' or 'not_in', parse comma-separated values
            if (['in', 'not_in'].includes(condition.operator)) {
              update('value', e.target.value.split(',').map(v => v.trim()).filter(Boolean));
            } else {
              update('value', e.target.value);
            }
          }}
          placeholder="Value"
          style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
        />
      )}

      <button
        onClick={() => onRemove(index)}
        style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', flexShrink: 0 }}
        title="Remove condition"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function RuleEditor({
  rule,
  onSave,
  onCancel,
}: {
  rule: Partial<RoleAssignmentRule>;
  onSave: (r: Partial<RoleAssignmentRule>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule.name || '');
  const [description, setDescription] = useState(rule.description || '');
  const [matchType, setMatchType] = useState<'all' | 'any'>(rule.match_type || 'all');
  const [role, setRole] = useState<UserRole>(rule.role || 'user');
  const [conditions, setConditions] = useState<RuleCondition[]>(rule.conditions?.length ? rule.conditions : [{ ...EMPTY_CONDITION }]);

  const addCondition = () => setConditions([...conditions, { ...EMPTY_CONDITION }]);
  const updateCondition = (idx: number, c: RuleCondition) => {
    const next = [...conditions];
    next[idx] = c;
    setConditions(next);
  };
  const removeCondition = (idx: number) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const canSave = name.trim().length > 0 && role;

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)', padding: 24,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text)' }}>
        {rule.id ? 'Edit Rule' : 'New Rule'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Rule Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. IT Staff get agent role" style={{ width: '100%', padding: '8px 12px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Description (optional)</label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What this rule does" style={{ width: '100%', padding: '8px 12px' }} />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Match Type</label>
            <select className="select" value={matchType} onChange={e => setMatchType(e.target.value as 'all' | 'any')} style={{ padding: '8px 12px', width: '100%' }}>
              <option value="all">ALL conditions must match</option>
              <option value="any">ANY condition must match</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Assign Role</label>
            <select className="select" value={role} onChange={e => setRole(e.target.value as UserRole)} style={{ padding: '8px 12px', width: '100%' }}>
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Conditions</label>
            <button onClick={addCondition} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 'var(--radius-md)',
              background: 'var(--accent)', color: 'white', border: 'none',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>
              <Plus size={12} /> Add Condition
            </button>
          </div>
          {conditions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
              No conditions — this rule will match all users (catch-all). Place it last in priority order.
            </p>
          ) : (
            conditions.map((cond, i) => (
              <ConditionRow key={i} condition={cond} index={i} onChange={updateCondition} onRemove={removeCondition} />
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onCancel} style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={() => onSave({ name, description, match_type: matchType, role, conditions: conditions.filter(c => c.field) })}
          disabled={!canSave}
          style={{ padding: '8px 16px', fontSize: 13, opacity: canSave ? 1 : 0.5 }}
        >
          {rule.id ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Tab Component ──────────────────────────────────────────────────────

export function RoleAssignmentRulesTab({
  showAlert,
}: {
  showAlert: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [rules, setRules] = useState<RoleAssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<RoleAssignmentRule> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await api.get<{ data: RoleAssignmentRule[] }>('/admin/role-rules');
      setRules(res.data || []);
    } catch {
      showAlert('Failed to load role rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleSave = async (rule: Partial<RoleAssignmentRule>) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await api.put(`/admin/role-rules/${editing.id}`, rule);
        showAlert('Rule updated');
      } else {
        await api.post('/admin/role-rules', rule);
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
    if (!confirm('Delete this rule? Users will no longer match it.')) return;
    try {
      await api.delete(`/admin/role-rules/${id}`);
      showAlert('Rule deleted');
      await loadRules();
    } catch {
      showAlert('Failed to delete rule', 'error');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const reordered = [...rules];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    // Update priorities based on new order
    const updated = reordered.map((r, i) => ({ id: r.id, priority: (i + 1) * 10 }));

    try {
      await api.patch('/admin/role-rules/reorder', { rules: updated });
      await loadRules();
    } catch {
      showAlert('Failed to reorder rules', 'error');
    }
  };

  const handleToggle = async (rule: RoleAssignmentRule) => {
    try {
      await api.put(`/admin/role-rules/${rule.id}`, { enabled: !rule.enabled });
      showAlert(rule.enabled ? 'Rule disabled' : 'Rule enabled');
      await loadRules();
    } catch {
      showAlert('Failed to toggle rule', 'error');
    }
  };

  if (loading) {
    return <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Define rules to automatically assign roles during directory sync. Rules are evaluated in priority order. First match wins.
          </p>
        </div>
        <button
          onClick={() => setEditing({ match_type: 'all', role: 'user', enabled: true })}
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
          <RuleEditor
            rule={editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {rules.length === 0 && !editing ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border)',
        }}>
          <Shield size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No Role Assignment Rules</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Create rules to automatically assign roles based on directory attributes like department, title, or Google admin status.
          </p>
          <button
            onClick={() => setEditing({ match_type: 'all', role: 'user', enabled: true })}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button onClick={() => handleMove(index, -1)} disabled={index === 0} style={{ padding: 1, background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', color: 'var(--text-muted)' }}>
                  <ArrowUp size={12} />
                </button>
                <button onClick={() => handleMove(index, 1)} disabled={index === rules.length - 1} style={{ padding: 1, background: 'none', border: 'none', cursor: index === rules.length - 1 ? 'default' : 'pointer', color: 'var(--text-muted)' }}>
                  <ArrowDown size={12} />
                </button>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{rule.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {rule.description || (
                    rule.conditions && rule.conditions.length > 0
                      ? `If ${rule.match_type === 'all' ? 'all' : 'any'} of ${rule.conditions.length} condition${rule.conditions.length > 1 ? 's' : ''} match → ${rule.role}`
                      : 'Catch-all: matches all users'
                  )}
                </div>
              </div>

              <div style={{
                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                fontSize: 11, fontWeight: 700,
                background: rule.role === 'admin' ? 'var(--critical-bg)' :
                  rule.role === 'manager' ? 'var(--warning-bg)' :
                  rule.role === 'agent' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                color: rule.role === 'admin' ? 'var(--critical)' :
                  rule.role === 'manager' ? 'var(--warning)' :
                  rule.role === 'agent' ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}>
                {rule.role}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => handleToggle(rule)}
                  style={{ cursor: 'pointer' }}
                />
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
