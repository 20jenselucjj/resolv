'use client';

import { useEffect, useState, useMemo } from 'react';
import { Edit2, Trash2, Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';

interface CannedResponse {
  id: string;
  text: string;
  category: string;
}

const DEFAULT_RESPONSES: CannedResponse[] = [
  { id: '1', text: "Hi there, we've received your request and are looking into it.", category: 'Greetings' },
  { id: '2', text: "Could you please provide more details or screenshots to help us investigate?", category: 'Requests' },
  { id: '3', text: "We have resolved the issue. Please confirm if everything is working for you now.", category: 'Resolutions' },
  { id: '4', text: "Closing this ticket due to inactivity. Feel free to reply if you still need help.", category: 'Resolutions' },
];

export function CannedResponsesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newResponse, setNewResponse] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(responses.map(r => r.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [responses]);

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const raw = res.data['canned_responses'];
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
              setResponses(parsed.map((text: string, i: number) => ({ id: String(i + 1), text, category: 'General' })));
            } else {
              setResponses(parsed);
            }
          } catch { setResponses(DEFAULT_RESPONSES); }
        } else {
          setResponses(DEFAULT_RESPONSES);
        }
      })
      .catch(() => setResponses(DEFAULT_RESPONSES))
      .finally(() => setLoading(false));
  }, []);

  const saveResponses = async (updated: CannedResponse[]) => {
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
    const cat = newCategory.trim() || 'General';
    setNewResponse('');
    setNewCategory('');
    saveResponses([...responses, { id: Date.now().toString(), text: t, category: cat }]);
  };

  const removeResponse = (id: string) => {
    saveResponses(responses.filter(r => r.id !== id));
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    if (!editDraft.trim()) return;
    const cat = editCategory.trim() || 'General';
    const updated = responses.map((r, i) =>
      i === editingIdx ? { ...r, text: editDraft.trim(), category: cat } : r
    );
    setEditingIdx(null);
    saveResponses(updated);
  };

  const filteredResponses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return responses;
    return responses.filter(r => r.text.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [responses, searchQuery]);

  const groupedResponses = useMemo(() => {
    const map = new Map<string, CannedResponse[]>();
    for (const r of filteredResponses) {
      const cat = r.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredResponses]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        {/* Search / Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search responses by text or category..."
              style={{ paddingLeft: 32, paddingRight: 32 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Add new */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <textarea
            className="input"
            value={newResponse}
            onChange={e => setNewResponse(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addResponse(); }}
            placeholder="Type a new canned response..."
            rows={3}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="input"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Category (e.g. Greetings, Requests, Resolutions)..."
                list="category-suggestions-new"
                style={{ width: '100%' }}
              />
              <datalist id="category-suggestions-new">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addResponse} disabled={saving || !newResponse.trim()} style={{ whiteSpace: 'nowrap' }}>
              <Plus size={14} style={{ marginRight: 4 }} /> Add Response
            </button>
          </div>
        </div>

        {/* List grouped by category */}
        {filteredResponses.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            {searchQuery ? 'No responses match your search.' : 'No canned responses yet. Add your first one above.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groupedResponses.map(([category, items]) => (
              <div key={category}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>
                  {category}
                  <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>({items.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((r, idx) => {
                    const globalIdx = responses.findIndex(gr => gr.id === r.id);
                    return (
                      <div key={r.id} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        {editingIdx === globalIdx ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <textarea
                              className="input"
                              value={editDraft}
                              onChange={e => setEditDraft(e.target.value)}
                              rows={3}
                              style={{ resize: 'vertical', minHeight: 80 }}
                              autoFocus
                            />
                            <div style={{ position: 'relative' }}>
                              <input
                                className="input"
                                value={editCategory}
                                onChange={e => setEditCategory(e.target.value)}
                                placeholder="Category..."
                                list="category-suggestions-edit"
                                style={{ width: '100%' }}
                              />
                              <datalist id="category-suggestions-edit">
                                {categories.map(c => <option key={c} value={c} />)}
                              </datalist>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => setEditingIdx(null)} className="btn btn-ghost btn-sm">Cancel</button>
                              <button onClick={saveEdit} className="btn btn-primary btn-sm" disabled={saving}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.5, minWidth: 0 }}>
                              <div style={{ marginBottom: 6 }}>{r.text}</div>
                              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, background: 'var(--accent-bg)', color: 'var(--accent)', padding: '1px 8px', borderRadius: 4 }}>{r.category}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0, paddingTop: 2 }}>
                              <button onClick={() => { setEditingIdx(globalIdx); setEditDraft(r.text); setEditCategory(r.category); }} className="btn btn-ghost btn-icon btn-sm" title="Edit">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => removeResponse(r.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
