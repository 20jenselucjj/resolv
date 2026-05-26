'use client';

import { useEffect, useState } from 'react';
import { Circle, Plus, RotateCcw, X } from 'lucide-react';
import { api } from '@/lib/api';

interface CustomStatus {
  value: string;
  label: string;
  color: string;
}

export function TicketStatusesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DEFAULT_STATUSES = [
    { value: 'open', defaultLabel: 'Open', description: 'New tickets awaiting action' },
    { value: 'in_progress', defaultLabel: 'In Progress', description: 'Tickets being actively worked on' },
    { value: 'waiting', defaultLabel: 'Waiting', description: 'Tickets waiting for user response or external action' },
    { value: 'closed', defaultLabel: 'Closed', description: 'Tickets fully closed with a closing note' },
  ];

  const COLOR_OPTIONS = [
    { id: 'default', label: 'Default', bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border)' },
    { id: 'accent', label: 'Blue', bg: 'var(--accent-subtle)', color: 'var(--accent)', border: 'var(--accent-border)' },
    { id: 'success', label: 'Green', bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' },
    { id: 'warning', label: 'Yellow', bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' },
    { id: 'danger', label: 'Red', bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger-border)' },
  ];

  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('default');

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const s = res.data;
        const loaded: Record<string, string> = {};
        DEFAULT_STATUSES.forEach(st => {
          loaded[st.value] = s[`status_label_${st.value}`] || st.defaultLabel;
        });
        try {
          const raw = s['custom_statuses'];
          if (raw) {
            const parsed: CustomStatus[] = JSON.parse(raw);
            setCustomStatuses(parsed);
            parsed.forEach(cs => { loaded[cs.value] = cs.label; });
          }
        } catch { /* ignore */ }
        setLabels(loaded);
      })
      .catch(() => {
        const defaults: Record<string, string> = {};
        DEFAULT_STATUSES.forEach(st => { defaults[st.value] = st.defaultLabel; });
        setLabels(defaults);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        DEFAULT_STATUSES.map(st =>
          api.patch('/admin/settings', { key: `status_label_${st.value}`, value: labels[st.value] || st.defaultLabel })
        )
      );
      const updatedCustom = customStatuses.map(cs => ({
        ...cs,
        label: labels[cs.value] || cs.label,
      }));
      await api.patch('/admin/settings', { key: 'custom_statuses', value: JSON.stringify(updatedCustom) });
      setCustomStatuses(updatedCustom);
      showAlert('All status labels saved successfully');
    } catch {
      showAlert('Failed to save status labels', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addCustomStatus = () => {
    const label = newLabel.trim();
    if (!label) return;
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (DEFAULT_STATUSES.some(s => s.value === value) || customStatuses.some(s => s.value === value)) {
      showAlert('A status with this key already exists', 'error');
      return;
    }
    const newStatus = { value, label, color: newColor };
    setCustomStatuses(prev => [...prev, newStatus]);
    setLabels(prev => ({ ...prev, [value]: label }));
    setNewLabel('');
    setNewColor('default');
  };

  const removeCustomStatus = (value: string) => {
    setCustomStatuses(prev => prev.filter(s => s.value !== value));
    setLabels(prev => {
      const next = { ...prev };
      delete next[value];
      return next;
    });
  };

  const moveCustomStatus = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= customStatuses.length) return;
    setCustomStatuses(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Circle size={16} color="var(--accent)" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Status Labels</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Customize display labels and add custom statuses. Changes the tickets' underlying status value.</p>
        </div>
      </div>

      {/* All statuses list */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Default statuses */}
        {DEFAULT_STATUSES.map(st => (
          <div key={st.value} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Status Key</div>
              <code style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>{st.value}</code>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DISPLAY LABEL</label>
              <input
                className="input"
                value={labels[st.value] || ''}
                onChange={e => setLabels(prev => ({ ...prev, [st.value]: e.target.value }))}
                placeholder={st.defaultLabel}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{st.description}</div>
            </div>
            <button
              onClick={() => setLabels(prev => ({ ...prev, [st.value]: st.defaultLabel }))}
              className="btn btn-ghost btn-sm"
              title="Reset to default"
              style={{ color: 'var(--text-muted)', flexShrink: 0 }}
            >
              <RotateCcw size={13} />
            </button>
          </div>
        ))}

        {customStatuses.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom Statuses</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
        )}

        {customStatuses.map((cs, idx) => {
          const colorOpt = COLOR_OPTIONS.find(o => o.id === cs.color) || COLOR_OPTIONS[0];
          return (
            <div key={cs.value} style={{ display: 'grid', gridTemplateColumns: 'auto 130px 1fr auto auto', gap: 8, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button
                  onClick={() => moveCustomStatus(idx, 'up')}
                  disabled={idx === 0}
                  style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--border)' : 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 10 }}
                  title="Move up"
                >▲</button>
                <button
                  onClick={() => moveCustomStatus(idx, 'down')}
                  disabled={idx === customStatuses.length - 1}
                  style={{ background: 'none', border: 'none', cursor: idx === customStatuses.length - 1 ? 'default' : 'pointer', color: idx === customStatuses.length - 1 ? 'var(--border)' : 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 10 }}
                  title="Move down"
                >▼</button>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Status Key</div>
                <code style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>{cs.value}</code>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DISPLAY LABEL</label>
                <input
                  className="input"
                  value={labels[cs.value] || ''}
                  onChange={e => setLabels(prev => ({ ...prev, [cs.value]: e.target.value }))}
                  placeholder={cs.value}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>COLOR</label>
                <select
                  value={cs.color}
                  onChange={e => {
                    const newColorVal = e.target.value;
                    setCustomStatuses(prev => prev.map((c, i) => i === idx ? { ...c, color: newColorVal } : c));
                  }}
                  style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  {COLOR_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => removeCustomStatus(cs.value)}
                className="btn btn-ghost btn-sm"
                title="Remove custom status"
                style={{ color: 'var(--danger)', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}

        {customStatuses.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)', fontSize: 12 }}>
            No custom statuses yet. Add one below.
          </div>
        )}
      </div>

      {/* Inline add form */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-end', padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ADD NEW STATUS LABEL</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomStatus(); }}
              placeholder="e.g. On Hold, Pending Review"
              style={{ flex: 1 }}
            />
            <select
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              style={{ width: 120, padding: '0 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            >
              {COLOR_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={addCustomStatus}
              disabled={!newLabel.trim()}
              style={{
                height: 38, padding: '0 16px', borderRadius: 8,
                background: 'var(--accent)', color: 'white', border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                opacity: !newLabel.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {newLabel.trim() && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              Key: <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>
                {newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}
              </code>
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 28px', fontSize: 14 }}>
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>
    </div>
  );
}
