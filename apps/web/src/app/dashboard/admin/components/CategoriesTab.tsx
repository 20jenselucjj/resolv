'use client';

import { useState, useMemo } from 'react';
import { Layers, Plus, Edit2, Trash2, Hash, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import type { Category } from './types';

type TreeNode = Omit<Category, 'children'> & { children: TreeNode[] };

function buildTree(categories: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  categories.forEach(cat => {
    map.set(cat.id, { ...cat, children: [] as TreeNode[] });
  });

  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort by sort_order then name
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    nodes.forEach(n => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

function CategoryTreeNode({ node, depth, onEdit, onDelete, editingId, editForm, setEditForm, handleEdit, categories }: {
  node: TreeNode;
  depth: number;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  editForm: { name: string; description: string; color: string; parent_id: string; sort_order: number };
  setEditForm: (f: any) => void;
  handleEdit: (e: React.FormEvent) => void;
  categories: Category[];
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <div>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 0, borderBottom: depth > 0 ? '1px solid var(--border-subtle)' : undefined, borderLeft: depth > 0 ? `3px solid ${node.color}30` : undefined, marginLeft: depth * 20 }}>
        {editingId === node.id ? (
          <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Name *</label>
                <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Sort Order</label>
                <input type="number" className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.sort_order} onChange={e => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
              <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }} />
                  <input className="input" style={{ padding: '6px 10px', fontSize: 13, flex: 1 }} value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Parent Category</label>
                <select
                  className="select"
                  style={{ width: '100%', fontSize: 12, height: 32 }}
                  value={editForm.parent_id || ''}
                  onChange={e => setEditForm({ ...editForm, parent_id: e.target.value })}
                >
                  <option value="">None (Root)</option>
                  {categories
                    .filter(c => c.id !== editingId)
                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                  }
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}>Save</button>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => onEdit({} as Category)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {node.children.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)', flexShrink: 0 }}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {node.children.length === 0 && <div style={{ width: 18, flexShrink: 0 }} />}
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-md)', background: `${node.color}20`, color: node.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>
              {(node.sort_order ?? 0) > 0 ? node.sort_order : <Hash size={14} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {node.name}
                {node.children.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 10, fontWeight: 500 }}>
                    {node.children.length}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                {node.description || 'No description'}
                {node.parent_id && <span style={{ marginLeft: 8, opacity: 0.6 }}>• Subcategory</span>}
              </div>
            </div>
            <button className="btn btn-ghost" style={{ padding: '4px', flexShrink: 0 }} onClick={() => {
              onEdit(node);
              setEditForm({ name: node.name, description: node.description || '', color: node.color, parent_id: node.parent_id || '', sort_order: node.sort_order ?? 0 });
            }}><Edit2 size={14} /></button>
            <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)', flexShrink: 0 }} onClick={() => onDelete(node.id)}><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      {expanded && node.children.length > 0 && node.children.map(child => (
        <CategoryTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          editingId={editingId}
          editForm={editForm}
          setEditForm={setEditForm}
          handleEdit={handleEdit}
          categories={categories}
        />
      ))}
    </div>
  );
}

export function CategoriesTab({ categories, onRefresh, showAlert, setConfirmModal }: {
  categories: Category[];
  onRefresh: () => void;
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6', parent_id: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#3B82F6', parent_id: '', sort_order: 0 });

  const treeData = useMemo(() => buildTree(categories), [categories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/categories', {
        name: form.name,
        description: form.description || undefined,
        color: form.color,
        parent_id: form.parent_id || null,
        sort_order: form.sort_order,
      });
      showAlert('Category created successfully');
      setIsAdding(false);
      setForm({ name: '', description: '', color: '#3B82F6', parent_id: '', sort_order: 0 });
      onRefresh();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to create category', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, any> = {};
      if (editForm.name) payload.name = editForm.name;
      if (editForm.description !== undefined) payload.description = editForm.description;
      if (editForm.color) payload.color = editForm.color;
      payload.parent_id = editForm.parent_id || null;
      payload.sort_order = editForm.sort_order;
      await api.patch(`/categories/${editingId}`, payload);
      showAlert('Category updated');
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to update category', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category? Subcategories will be unlinked.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/categories/${id}`);
          showAlert('Category deleted');
          onRefresh();
        } catch (err: any) {
          showAlert(err?.serverError || err?.message || 'Failed to delete category', 'error');
        }
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button onClick={() => setIsAdding(true)} className="btn btn-primary"><Plus size={14} /> Add Category</button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
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
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Parent Category</label>
                <select
                  className="select"
                  style={{ width: '100%', fontSize: 12, height: 34 }}
                  value={form.parent_id}
                  onChange={e => setForm({ ...form, parent_id: e.target.value })}
                >
                  <option value="">None (Root)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Sort Order</label>
                <input type="number" className="input" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} placeholder="0" style={{ height: 34 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {treeData.map(node => (
            <CategoryTreeNode
              key={node.id}
              node={node}
              depth={0}
              onEdit={(cat) => setEditingId(cat.id || null)}
              onDelete={handleDelete}
              editingId={editingId}
              editForm={editForm}
              setEditForm={setEditForm}
              handleEdit={handleEdit}
              categories={categories}
            />
          ))}
        </div>
      )}
    </div>
  );
}
