'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, RotateCcw, GripVertical, Save, X, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'textarea'] as const;
const ENTITY_TYPES = ['ticket', 'asset'] as const;

interface CustomFieldDefinition {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
  entity_type: string;
  required: boolean;
  options: string[];
  default_value: string | null;
  placeholder: string | null;
  help_text: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function CustomFieldsTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    name: '',
    field_key: '',
    field_type: 'text' as string,
    entity_type: 'ticket' as string,
    required: false,
    options: '',
    default_value: '',
    placeholder: '',
    help_text: '',
    sort_order: 0,
  };

  const [form, setForm] = useState(emptyForm);

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CustomFieldDefinition[] }>('/custom-fields');
      setFields(res.data);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load custom fields', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    const timer = setTimeout(() => loadFields(), 0);
    return () => clearTimeout(timer);
  }, [loadFields]);

  // Auto-generate field_key from name
  const handleNameChange = (name: string) => {
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    setForm(prev => ({ ...prev, name, field_key: key }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (field: CustomFieldDefinition) => {
    setForm({
      name: field.name,
      field_key: field.field_key,
      field_type: field.field_type,
      entity_type: field.entity_type,
      required: field.required,
      options: (field.options || []).join(', '),
      default_value: field.default_value || '',
      placeholder: field.placeholder || '',
      help_text: field.help_text || '',
      sort_order: field.sort_order,
    });
    setEditingId(field.id);
    setIsAdding(true);
  };

  const handleToggleActive = async (field: CustomFieldDefinition) => {
    try {
      await api.patch(`/custom-fields/${field.id}`, { is_active: !field.is_active });
      showAlert(`Field ${field.is_active ? 'deactivated' : 'activated'} successfully`);
      loadFields();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to update field', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Custom Field',
      message: 'Are you sure you want to delete this custom field? This will permanently remove all associated values and cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/custom-fields/${id}`);
          showAlert('Custom field deleted');
          loadFields();
        } catch (err: any) {
          showAlert(err?.serverError || err?.message || 'Failed to delete field', 'error');
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: form.name,
        field_key: form.field_key,
        field_type: form.field_type,
        entity_type: form.entity_type,
        required: form.required,
        options: form.options ? form.options.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        default_value: form.default_value || undefined,
        placeholder: form.placeholder || undefined,
        help_text: form.help_text || undefined,
        sort_order: form.sort_order,
      };

      if (editingId) {
        // Only send updatable fields for patch
        const patchPayload: any = {
          name: payload.name,
          required: payload.required,
          options: payload.options,
          default_value: payload.default_value || null,
          placeholder: payload.placeholder || null,
          help_text: payload.help_text || null,
          sort_order: payload.sort_order,
        };
        await api.patch(`/custom-fields/${editingId}`, patchPayload);
        showAlert('Custom field updated');
      } else {
        await api.post('/custom-fields', payload);
        showAlert('Custom field created');
      }

      resetForm();
      loadFields();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save field', 'error');
    }
  };

  const ticketFields = fields.filter(f => f.entity_type === 'ticket');
  const assetFields = fields.filter(f => f.entity_type === 'asset');

  const renderFieldList = (entityLabel: string, entityFields: CustomFieldDefinition[]) => (
    <div className="card" style={{ overflow: 'hidden', position: 'relative', minHeight: '100px' }}>
      <div style={{
        padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text)',
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{entityLabel} ({entityFields.length})</span>
      </div>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <RotateCcw className="spin" size={24} />
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Order</th>
            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Name</th>
            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Key</th>
            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Type</th>
            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Required</th>
            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entityFields.map(field => (
            <tr key={field.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: field.is_active ? 1 : 0.5 }}>
              <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GripVertical size={12} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                  {field.sort_order}
                </span>
              </td>
              <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600 }}>{field.name}</td>
              <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{field.field_key}</td>
              <td style={{ padding: '10px 16px', fontSize: '12px' }}>
                <span style={{
                  background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)', fontSize: '11px', fontWeight: 600,
                }}>
                  {field.field_type}
                </span>
              </td>
              <td style={{ padding: '10px 16px', fontSize: '12px' }}>
                {field.required ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Yes</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>No</span>
                )}
              </td>
              <td style={{ padding: '10px 16px' }}>
                <button
                  onClick={() => handleToggleActive(field)}
                  style={{
                    background: field.is_active ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                    color: field.is_active ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${field.is_active ? 'var(--success-border)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {field.is_active ? <Eye size={11} /> : <EyeOff size={11} />}
                  {field.is_active ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-ghost" style={{ padding: '4px', color: 'var(--text-secondary)' }}
                    onClick={() => startEdit(field)}
                  >
                    <Save size={14} />
                  </button>
                  <button
                    className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }}
                    onClick={() => handleDelete(field.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!loading && entityFields.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No custom fields defined</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const showOptionsField = form.field_type === 'select' || form.field_type === 'multi_select';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Description card */}
      <div style={{
        padding: '16px 20px', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>What are Custom Fields?</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Custom fields let you extend tickets and assets with additional data fields tailored to your organization.
          Define text inputs, dropdowns, checkboxes, dates, and more. Fields can be marked as required and
          organized by sort order. Once defined, they will appear on ticket and asset forms throughout the system.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsAdding(true); }}>
          <Plus size={14} /> Add Field
        </button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
              {editingId ? 'Edit Custom Field' : 'New Custom Field'}
            </span>
            <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={resetForm}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Name *</label>
                <input
                  className="input" value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Department"
                  required={!editingId}
                  disabled={!!editingId && form.field_key !== ''}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Field Key *</label>
                <input
                  className="input" value={form.field_key}
                  onChange={e => setForm({ ...form, field_key: e.target.value })}
                  placeholder="e.g. department"
                  required={!editingId}
                  disabled={!!editingId}
                  style={{ fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Lowercase, alphanumeric + underscores. Used programmatically.
                </span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Field Type *</label>
                <select
                  className="select" value={form.field_type}
                  onChange={e => setForm({ ...form, field_type: e.target.value })}
                  disabled={!!editingId}
                  required={!editingId}
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Entity Type *</label>
                <select
                  className="select" value={form.entity_type}
                  onChange={e => setForm({ ...form, entity_type: e.target.value })}
                  disabled={!!editingId}
                  required={!editingId}
                >
                  {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Sort Order</label>
                <input
                  className="input" type="number" value={form.sort_order}
                  onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  style={{ width: '100px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.required}
                    onChange={e => setForm({ ...form, required: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  Required field
                </label>
              </div>
            </div>

            {showOptionsField && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Options (comma-separated) *
                </label>
                <input
                  className="input" value={form.options}
                  onChange={e => setForm({ ...form, options: e.target.value })}
                  placeholder="e.g. Engineering, Sales, Marketing, Support"
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Required for select and multi_select field types.
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Default Value</label>
                <input
                  className="input" value={form.default_value}
                  onChange={e => setForm({ ...form, default_value: e.target.value })}
                  placeholder="Default value"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Placeholder</label>
                <input
                  className="input" value={form.placeholder}
                  onChange={e => setForm({ ...form, placeholder: e.target.value })}
                  placeholder="Placeholder text"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Help Text</label>
                <input
                  className="input" value={form.help_text}
                  onChange={e => setForm({ ...form, help_text: e.target.value })}
                  placeholder="Helpful description"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update Field' : 'Create Field'}
              </button>
            </div>
          </form>
        </div>
      )}

      {renderFieldList('Ticket Fields', ticketFields)}
      {renderFieldList('Asset Fields', assetFields)}
    </div>
  );
}
