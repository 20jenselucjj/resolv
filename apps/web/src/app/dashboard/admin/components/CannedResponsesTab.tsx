'use client';

import { useEffect, useState } from 'react';
import { Book, Edit2, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';

export function CannedResponsesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DEFAULT_RESPONSES = [
    "Hi there, we've received your request and are looking into it.",
    "Could you please provide more details or screenshots to help us investigate?",
    "We have resolved the issue. Please confirm if everything is working for you now.",
    "Closing this ticket due to inactivity. Feel free to reply if you still need help.",
  ];

  const [responses, setResponses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newResponse, setNewResponse] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const raw = res.data['canned_responses'];
        if (raw) {
          try { setResponses(JSON.parse(raw)); } catch { setResponses(DEFAULT_RESPONSES); }
        } else {
          setResponses(DEFAULT_RESPONSES);
        }
      })
      .catch(() => setResponses(DEFAULT_RESPONSES))
      .finally(() => setLoading(false));
  }, []);

  const saveResponses = async (updated: string[]) => {
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
    setNewResponse('');
    saveResponses([...responses, t]);
  };

  const removeResponse = (idx: number) => {
    saveResponses(responses.filter((_, i) => i !== idx));
  };

  const saveEdit = (idx: number) => {
    if (!editDraft.trim()) return;
    const updated = responses.map((r, i) => i === idx ? editDraft.trim() : r);
    setEditingIdx(null);
    saveResponses(updated);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        {/* Add new */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <textarea
            className="input"
            value={newResponse}
            onChange={e => setNewResponse(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addResponse(); }}
            placeholder="Type a new canned response... (⌘↵ to add)"
            rows={3}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={addResponse} disabled={saving || !newResponse.trim()}>
              <Plus size={14} style={{ marginRight: 4 }} /> Add Response
            </button>
          </div>
        </div>

        {/* List */}
        {responses.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            No canned responses yet. Add your first one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {responses.map((r, idx) => (
              <div key={idx} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {editingIdx === idx ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      className="input"
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      rows={3}
                      style={{ resize: 'vertical', minHeight: 80 }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingIdx(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      <button onClick={() => saveEdit(idx)} className="btn btn-primary btn-sm" disabled={saving}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{r}</div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditingIdx(idx); setEditDraft(r); }} className="btn btn-ghost btn-icon btn-sm" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => removeResponse(idx)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
