'use client';

import { Plus, Trash2 } from 'lucide-react';

export interface RuleCondition {
  field: string;
  operator: string;
  value: any;
}

export interface ConditionOperator {
  value: string;
  label: string;
}

export function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
  fields,
  operators,
  hideValueForOperators = [],
}: {
  condition: RuleCondition;
  index: number;
  onChange: (idx: number, c: RuleCondition) => void;
  onRemove: (idx: number) => void;
  fields: string[];
  operators: ConditionOperator[];
  hideValueForOperators?: string[];
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
        {fields.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <select
        className="select"
        value={condition.operator}
        onChange={e => update('operator', e.target.value)}
        style={{ width: 150, padding: '6px 8px', fontSize: 12 }}
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {!hideValueForOperators.includes(condition.operator) && (
        <input
          className="input"
          value={typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value ?? '')}
          onChange={e => {
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

export function ConditionSection({
  conditions,
  onAdd,
  onChange,
  onRemove,
  fields,
  operators,
  hideValueForOperators,
  emptyLabel = 'No conditions',
}: {
  conditions: RuleCondition[];
  onAdd: () => void;
  onChange: (idx: number, c: RuleCondition) => void;
  onRemove: (idx: number) => void;
  fields: string[];
  operators: ConditionOperator[];
  hideValueForOperators?: string[];
  emptyLabel?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Conditions</label>
        <button onClick={onAdd} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent)', color: 'white', border: 'none',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={12} /> Add
        </button>
      </div>
      {conditions.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
          {emptyLabel}
        </p>
      ) : (
        conditions.map((cond, i) => (
          <ConditionRow
            key={i}
            condition={cond}
            index={i}
            onChange={onChange}
            onRemove={onRemove}
            fields={fields}
            operators={operators}
            hideValueForOperators={hideValueForOperators}
          />
        ))
      )}
    </div>
  );
}
