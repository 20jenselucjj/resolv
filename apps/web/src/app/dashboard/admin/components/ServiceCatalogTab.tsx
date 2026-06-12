'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Layers, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight,
  Monitor, Code, Key, User, Wifi, HelpCircle, Package, GripVertical,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CatalogCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomFieldDef {
  name: string;
  field_key: string;
  type: string;
  required: boolean;
  options: string[];
  placeholder: string;
}

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  short_description: string;
  category_id: string | null;
  icon: string;
  image_url: string | null;
  fulfillment_type: string;
  approval_required: boolean;
  approval_role: string;
  priority: string;
  ticket_type: string;
  custom_fields: CustomFieldDef[];
  is_active: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_icon?: string;
}

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'textarea', 'url'] as const;

const CATEGORY_ICONS: Record<string, any> = {
  monitor: Monitor, code: Code, key: Key, user: User,
  wifi: Wifi, 'help-circle': HelpCircle, package: Package,
};

function IconSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const icons = [
    { value: 'monitor', label: 'Monitor' },
    { value: 'code', label: 'Code' },
    { value: 'key', label: 'Key' },
    { value: 'user', label: 'User' },
    { value: 'wifi', label: 'Wifi' },
    { value: 'help-circle', label: 'Help' },
    { value: 'package', label: 'Package' },
    { value: 'shield', label: 'Shield' },
    { value: 'lock', label: 'Lock' },
    { value: 'book', label: 'Book' },
    { value: 'server', label: 'Server' },
    { value: 'database', label: 'Database' },
  ];
  return (
    <select className="select" value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', fontSize: 12, height: 32 }}>
      <option value="">None</option>
      {icons.map(ic => (
        <option key={ic.value} value={ic.value}>{ic.label}</option>
      ))}
    </select>
  );
}

// ─── Category Row ─────────────────────────────────────────────────────────────
function CategoryRow({ category, onEdit, onDelete, isEditing, editForm, setEditForm, onSave, onCancel }: {
  category: CatalogCategory;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  editForm: { name: string; description: string; icon: string; sort_order: number };
  setEditForm: (f: any) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <form onSubmit={onSave} style={{
        padding: '12px 16px', background: 'var(--bg-secondary)',
        border: '1px solid var(--accent-border)', borderRadius: 12,
        marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Name *</label>
            <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required style={{ fontSize: 12 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
            <input type="number" className="input" value={editForm.sort_order} onChange={e => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) || 0 })} style={{ fontSize: 12 }} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Description</label>
          <input className="input" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ fontSize: 12 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Icon</label>
          <IconSelect value={editForm.icon} onChange={v => setEditForm({ ...editForm, icon: v })} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary btn-save" style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Save size={13} /> Save
          </button>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const IconComp = CATEGORY_ICONS[category.icon] || Package;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'var(--accent-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <IconComp size={15} color="var(--accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {category.name}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 10, fontWeight: 500 }}>
            #{category.sort_order}
          </span>
        </div>
        {category.description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{category.description}</div>
        )}
      </div>
      <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Edit2 size={14} />
      </button>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Custom Fields Builder ─────────────────────────────────────────────────────
function CustomFieldsBuilder({ fields, onChange }: {
  fields: CustomFieldDef[];
  onChange: (fields: CustomFieldDef[]) => void;
}) {
  const addField = () => {
    const key = 'field_' + Date.now();
    onChange([...fields, { name: '', field_key: key, type: 'text', required: false, options: [], placeholder: '' }]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<CustomFieldDef>) => {
    onChange(fields.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Custom Fields</span>
        <button type="button" onClick={addField} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
          fontSize: 11, fontWeight: 600, background: 'var(--accent-subtle)',
          color: 'var(--accent)', border: '1px solid var(--accent-border)',
          borderRadius: 6, cursor: 'pointer',
        }}>
          <Plus size={12} /> Add Field
        </button>
      </div>
      {fields.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)', textAlign: 'center' }}>
          No custom fields defined
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map((field, i) => (
            <div key={i} style={{
              padding: 12, background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Field #{i + 1}</span>
                <button type="button" onClick={() => removeField(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2, display: 'flex' }}>
                  <X size={13} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)' }}>Name</label>
                  <input className="input" value={field.name} onChange={e => updateField(i, { name: e.target.value })} placeholder="Field name" style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)' }}>Key</label>
                  <input className="input" value={field.field_key} onChange={e => updateField(i, { field_key: e.target.value })} placeholder="field_key" style={{ fontSize: 12, fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)' }}>Type</label>
                  <select className="select" value={field.type} onChange={e => updateField(i, { type: e.target.value })} style={{ width: '100%', fontSize: 12, height: 32 }}>
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', padding: '6px 0' }}>
                    <input type="checkbox" checked={field.required} onChange={e => updateField(i, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
              </div>
              {(field.type === 'select' || field.type === 'multi_select') && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)' }}>Options (one per line)</label>
                  <textarea
                    className="textarea"
                    value={field.options.join('\n')}
                    onChange={e => updateField(i, { options: e.target.value.split('\n').filter(o => o.trim()) })}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    rows={3}
                    style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
                  />
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)' }}>Placeholder</label>
                <input className="input" value={field.placeholder} onChange={e => updateField(i, { placeholder: e.target.value })} style={{ fontSize: 12 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────
export function ServiceCatalogTab({ showAlert }: { showAlert: (msg: string, type?: 'success' | 'error') => void }) {
  const [activeSection, setActiveSection] = useState<'categories' | 'items'>('categories');

  // Categories
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', icon: '', sort_order: 0 });

  // Items
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);
  const [itemForm, setItemForm] = useState({
    name: '', description: '', short_description: '', category_id: '', icon: '',
    image_url: '', fulfillment_type: 'ticket', approval_required: false,
    approval_role: 'manager', priority: 'medium', ticket_type: 'service_request',
    custom_fields: [] as CustomFieldDef[], sort_order: 0,
  });

  // ── Load categories ──────────────────────────────────────────────────────────
  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const res = await api.get<{ data: CatalogCategory[] }>('/catalog/categories');
      setCategories(res.data || []);
    } catch (e: any) { console.error('Failed to load catalog categories:', e); showAlert(e?.serverError || e?.message || 'Failed to load categories', 'error'); }
    finally { setCatLoading(false); }
  };

  const loadItems = async () => {
    setItemsLoading(true);
    try {
      const res = await api.get<{ data: CatalogItem[] }>('/catalog/items');
      setItems(res.data || []);
    } catch (e: any) { console.error('Failed to load catalog items:', e); showAlert(e?.serverError || e?.message || 'Failed to load items', 'error'); }
    finally { setItemsLoading(false); }
  };

  useEffect(() => { loadCategories(); loadItems(); }, []);

  // Scroll to form when editing an item
  useEffect(() => {
    if (editingItemId && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [editingItemId]);

  // ── Category CRUD ────────────────────────────────────────────────────────────
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/catalog/categories', catForm);
      setShowAddCategory(false);
      setCatForm({ name: '', description: '', icon: '', sort_order: 0 });
      loadCategories();
      showAlert('Category created');
    } catch (e: any) { console.error('Failed to create category:', e); showAlert(e?.serverError || e?.message || 'Failed to create category', 'error'); }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategoryId) return;
    try {
      await api.patch(`/catalog/categories/${editingCategoryId}`, catForm);
      setEditingCategoryId(null);
      setCatForm({ name: '', description: '', icon: '', sort_order: 0 });
      loadCategories();
      showAlert('Category updated');
    } catch (e: any) { console.error('Failed to update category:', e); showAlert(e?.serverError || e?.message || 'Failed to update category', 'error'); }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.delete(`/catalog/categories/${id}`);
      loadCategories();
      showAlert('Category deleted');
    } catch (e: any) { console.error('Failed to delete category:', e); showAlert(e?.serverError || e?.message || 'Failed to delete category', 'error'); }
  };

  const startEditCategory = (cat: CatalogCategory) => {
    setEditingCategoryId(cat.id);
    setCatForm({ name: cat.name, description: cat.description || '', icon: cat.icon || '', sort_order: cat.sort_order });
  };

  // ── Item CRUD ────────────────────────────────────────────────────────────────
  const resetItemForm = () => {
    setItemForm({
      name: '', description: '', short_description: '', category_id: '', icon: '',
      image_url: '', fulfillment_type: 'ticket', approval_required: false,
      approval_role: 'manager', priority: 'medium', ticket_type: 'service_request',
      custom_fields: [], sort_order: 0,
    });
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...itemForm,
        category_id: itemForm.category_id || null,
        image_url: itemForm.image_url || null,
      };
      await api.post('/catalog/items', payload);
      setShowAddItem(false);
      resetItemForm();
      loadItems();
      showAlert('Catalog item created');
    } catch (e: any) { console.error('Failed to create item:', e); showAlert(e?.serverError || e?.message || 'Failed to create item', 'error'); }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItemId) return;
    try {
      const payload = {
        ...itemForm,
        category_id: itemForm.category_id || null,
        image_url: itemForm.image_url || null,
      };
      await api.patch(`/catalog/items/${editingItemId}`, payload);
      setEditingItemId(null);
      resetItemForm();
      loadItems();
      showAlert('Catalog item updated');
    } catch (e: any) { console.error('Failed to update item:', e); showAlert(e?.serverError || e?.message || 'Failed to update item', 'error'); }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await api.delete(`/catalog/items/${id}`);
      loadItems();
      showAlert('Item deleted');
    } catch (e: any) { console.error('Failed to delete item:', e); showAlert(e?.serverError || e?.message || 'Failed to delete item', 'error'); }
  };

  const startEditItem = (item: CatalogItem) => {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      description: item.description || '',
      short_description: item.short_description || '',
      category_id: item.category_id || '',
      icon: item.icon || '',
      image_url: item.image_url || '',
      fulfillment_type: item.fulfillment_type,
      approval_required: item.approval_required,
      approval_role: item.approval_role || 'manager',
      priority: item.priority,
      ticket_type: item.ticket_type,
      custom_fields: Array.isArray(item.custom_fields)
        ? item.custom_fields.map(f => ({
            name: f.name ?? '',
            field_key: f.field_key ?? 'field_' + Date.now(),
            type: f.type ?? 'text',
            required: f.required ?? false,
            options: Array.isArray(f.options) ? f.options : [],
            placeholder: f.placeholder ?? '',
          }))
        : [],
      sort_order: item.sort_order,
    });
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredItems = [...items]
    .filter(item => !categoryFilter || item.category_id === categoryFilter)
    .sort((a, b) => a.sort_order - b.sort_order);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Section Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setActiveSection('categories')}
          style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)',
            background: activeSection === 'categories' ? 'var(--accent)' : 'var(--card)',
            color: activeSection === 'categories' ? '#fff' : 'var(--text)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Layers size={14} style={{ marginRight: 6, display: 'inline' }} />
          Categories
        </button>
        <button
          onClick={() => setActiveSection('items')}
          style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)',
            background: activeSection === 'items' ? 'var(--accent)' : 'var(--card)',
            color: activeSection === 'items' ? '#fff' : 'var(--text)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Package size={14} style={{ marginRight: 6, display: 'inline' }} />
          Items
        </button>
      </div>

      {activeSection === 'categories' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Catalog Categories ({categories.length})
            </h3>
            <button onClick={() => { setShowAddCategory(true); setCatForm({ name: '', description: '', icon: '', sort_order: 0 }); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Add Category
            </button>
          </div>

          {showAddCategory && (
            <form onSubmit={handleAddCategory} style={{
              padding: 16, background: 'var(--bg-secondary)',
              border: '1px solid var(--accent-border)', borderRadius: 12,
              marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Name *</label>
                  <input className="input" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} required style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
                  <input type="number" className="input" value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) || 0 })} style={{ fontSize: 12 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Description</label>
                <input className="input" value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} style={{ fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Icon</label>
                <IconSelect value={catForm.icon} onChange={v => setCatForm({ ...catForm, icon: v })} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-save" style={{ padding: '6px 14px', fontSize: 12 }}>Create</button>
                <button type="button" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setShowAddCategory(false)}>Cancel</button>
              </div>
            </form>
          )}

          {catLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : categories.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 12 }}>
              <Layers size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No categories yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Create your first catalog category to organize services.</div>
            </div>
          ) : (
            <div>
              {[...categories]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((cat, index) => (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', cat.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      if (draggedId === cat.id) return;
                      
                      const newCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
                      const draggedIdx = newCategories.findIndex(c => c.id === draggedId);
                      const targetIdx = index;
                      
                      if (draggedIdx === -1) return;
                      
                      const [moved] = newCategories.splice(draggedIdx, 1);
                      newCategories.splice(targetIdx, 0, moved);
                      
                      const reordered = newCategories.map((c, i) => ({
                        ...c,
                        sort_order: i,
                      }));
                      
                      setCategories(reordered);
                      
                      api.post('/catalog/categories/reorder', {
                        order: reordered.map((c, i) => ({ id: c.id, sort_order: i }))
                      }).catch(err => console.error('Failed to save category order:', err));
                    }}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                      opacity: editingCategoryId === cat.id ? 0.7 : 1,
                    }}
                  >
                    {/* Drag handle */}
                    <div
                      style={{
                        cursor: 'grab', color: 'var(--text-muted)', padding: 4,
                        display: 'flex', flexShrink: 0, borderRadius: 4,
                        visibility: editingCategoryId === cat.id ? 'hidden' : 'visible',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <GripVertical size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <CategoryRow
                        category={cat}
                        onEdit={() => startEditCategory(cat)}
                        onDelete={() => handleDeleteCategory(cat.id)}
                        isEditing={editingCategoryId === cat.id}
                        editForm={catForm}
                        setEditForm={setCatForm}
                        onSave={handleEditCategory}
                        onCancel={() => { setEditingCategoryId(null); setCatForm({ name: '', description: '', icon: '', sort_order: 0 }); }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'items' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Catalog Items ({items.length})
            </h3>
            <button onClick={() => { setShowAddItem(true); resetItemForm(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          {/* Item Form (Add / Edit) */}
          {(showAddItem || editingItemId) && (
            <form ref={formRef} onSubmit={editingItemId ? handleEditItem : handleAddItem} style={{
              padding: 20, background: 'var(--bg-secondary)',
              border: '1px solid var(--accent-border)', borderRadius: 12,
              marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {editingItemId ? 'Edit Item' : 'New Item'}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Name *</label>
                  <input className="input" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} required style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
                  <input type="number" className="input" value={itemForm.sort_order} onChange={e => setItemForm({ ...itemForm, sort_order: parseInt(e.target.value) || 0 })} style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Category</label>
                  <select className="select" value={itemForm.category_id} onChange={e => setItemForm({ ...itemForm, category_id: e.target.value })} style={{ width: '100%', fontSize: 12, height: 32 }}>
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Icon</label>
                  <IconSelect value={itemForm.icon} onChange={v => setItemForm({ ...itemForm, icon: v })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Fulfillment Type</label>
                  <select className="select" value={itemForm.fulfillment_type} onChange={e => setItemForm({ ...itemForm, fulfillment_type: e.target.value })} style={{ width: '100%', fontSize: 12, height: 32 }}>
                    <option value="ticket">Create Ticket</option>
                    <option value="approval">Requires Approval</option>
                    <option value="automated">Automated</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Priority</label>
                  <select className="select" value={itemForm.priority} onChange={e => setItemForm({ ...itemForm, priority: e.target.value })} style={{ width: '100%', fontSize: 12, height: 32 }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Ticket Type</label>
                  <select className="select" value={itemForm.ticket_type} onChange={e => setItemForm({ ...itemForm, ticket_type: e.target.value })} style={{ width: '100%', fontSize: 12, height: 32 }}>
                    <option value="incident">Incident</option>
                    <option value="service_request">Service Request</option>
                    <option value="problem">Problem</option>
                    <option value="change">Change</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Approval Required</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={itemForm.approval_required} onChange={e => setItemForm({ ...itemForm, approval_required: e.target.checked })} />
                      Yes
                    </label>
                    {itemForm.approval_required && (
                      <select className="select" value={itemForm.approval_role} onChange={e => setItemForm({ ...itemForm, approval_role: e.target.value })} style={{ fontSize: 12, height: 28 }}>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="agent">Agent</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Short Description</label>
                <input className="input" value={itemForm.short_description} onChange={e => setItemForm({ ...itemForm, short_description: e.target.value })} style={{ fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Description</label>
                <textarea className="textarea" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} rows={3} style={{ width: '100%', fontSize: 12, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Image URL (optional)</label>
                <input className="input" value={itemForm.image_url} onChange={e => setItemForm({ ...itemForm, image_url: e.target.value })} style={{ fontSize: 12 }} />
              </div>

              <CustomFieldsBuilder
                fields={itemForm.custom_fields}
                onChange={fields => setItemForm({ ...itemForm, custom_fields: fields })}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary btn-save" style={{ padding: '8px 16px', fontSize: 13 }}>
                  {editingItemId ? 'Save Changes' : 'Create Item'}
                </button>
                <button type="button" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={() => { setShowAddItem(false); setEditingItemId(null); resetItemForm(); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Category Filter */}
          {!itemsLoading && items.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Filter:</label>
              <select
                className="select"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                style={{ fontSize: 12, height: 32, minWidth: 220 }}
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {categoryFilter && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, padding: '4px 8px', fontWeight: 600 }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Items List — grouped by category */}
          {itemsLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 12 }}>
              <Package size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No items yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Add catalog items that users can request.</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 12 }}>
              <Package size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No items in this category</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Try selecting a different category or <button type="button" onClick={() => setCategoryFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, fontSize: 12, textDecoration: 'underline' }}>clear the filter</button>.
              </div>
            </div>
          ) : (() => {
            // Group filteredItems by category, sorted by category sort_order
            const itemsByCat = new Map<string, CatalogItem[]>();
            for (const it of filteredItems) {
              const key = it.category_name || 'Uncategorized';
              if (!itemsByCat.has(key)) itemsByCat.set(key, []);
              itemsByCat.get(key)!.push(it);
            }

            // Order category groups by the categories tab's sort_order
            const catSortOrder = new Map(categories.map((c, i) => [c.name, c.sort_order]));
            const sortedGroupNames = [...itemsByCat.keys()].sort((a, b) => {
              const aOrder = catSortOrder.get(a) ?? 9999;
              const bOrder = catSortOrder.get(b) ?? 9999;
              return aOrder - bOrder;
            });

            return sortedGroupNames.map(catName => {
              const catItems = itemsByCat.get(catName)!;
              const cat = categories.find(c => c.name === catName);
              const CatIcon = cat ? (CATEGORY_ICONS[cat.icon] || Package) : Package;

              return (
                <div key={catName} style={{ marginBottom: 24 }}>
                  {/* Category header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', marginBottom: 8,
                    background: 'var(--bg-secondary)', borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'var(--accent-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CatIcon size={14} color="var(--accent)" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                      {catName}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {catItems.length} item{catItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Items within this category — drag-to-reorder */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                    {catItems.map((item, idx) => {
                      const ItemIcon = CATEGORY_ICONS[item.icon] || Package;
                      const isEditing = editingItemId === item.id;
                      return (
                        <div
                          key={item.id}
                          draggable={!isEditing}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', item.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId === item.id) return;

                            // Reorder within this category group
                            const newOrder = [...catItems];
                            const draggedIdx = newOrder.findIndex(i => i.id === draggedId);
                            const targetIdx = idx;

                            if (draggedIdx === -1) return;

                            const [moved] = newOrder.splice(draggedIdx, 1);
                            newOrder.splice(targetIdx, 0, moved);

                            // Map new sort_order back to all items
                            const orderMap = new Map(newOrder.map((i, iIdx) => [i.id, iIdx]));
                            const updatedItems = items.map(i => ({
                              ...i,
                              sort_order: orderMap.has(i.id) ? orderMap.get(i.id)! : i.sort_order,
                            }));

                            setItems(updatedItems);

                            api.post('/catalog/items/reorder', {
                              order: updatedItems.map(i => ({ id: i.id, sort_order: i.sort_order }))
                            })
                              .then(() => { showAlert('Item order saved'); loadItems(); })
                              .catch(err => { console.error('Failed to save item order:', err); showAlert('Failed to save order', 'error'); });
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', background: 'var(--card)',
                            border: '1px solid var(--border)', borderRadius: 10,
                            opacity: isEditing ? 0.6 : 1,
                          }}
                        >
                          {/* Drag handle */}
                          {!isEditing && (
                            <div
                              title="Drag to reorder within this category"
                              style={{
                                cursor: 'grab', color: 'var(--text-muted)', padding: 4,
                                display: 'flex', borderRadius: 4, flexShrink: 0,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                            >
                              <GripVertical size={14} />
                            </div>
                          )}
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: item.approval_required ? 'var(--warning-bg)' : 'var(--accent-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <ItemIcon size={16} color={item.approval_required ? 'var(--warning)' : 'var(--accent)'} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {item.name}
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                                background: item.fulfillment_type === 'approval' ? 'var(--warning-bg)' : item.fulfillment_type === 'automated' ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                                color: item.fulfillment_type === 'approval' ? 'var(--warning)' : item.fulfillment_type === 'automated' ? 'var(--success)' : 'var(--text-muted)',
                                border: '1px solid var(--border)',
                              }}>
                                {item.fulfillment_type === 'approval' ? 'Approval' : item.fulfillment_type === 'automated' ? 'Auto' : 'Ticket'}
                              </span>
                              {item.approval_required && (
                                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                                  background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' }}>
                                  {item.approval_role}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              {item.short_description || item.description?.slice(0, 80) || 'No description'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => startEditItem(item)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
