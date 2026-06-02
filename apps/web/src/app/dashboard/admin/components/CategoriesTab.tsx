'use client';

import { useState } from 'react';
import { Layers, Plus, Edit2, Trash2, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import type { Category } from './types';

export function CategoriesTab({ categories, onRefresh, showAlert, setConfirmModal }: {
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
