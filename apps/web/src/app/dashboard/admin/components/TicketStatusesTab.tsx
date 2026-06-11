'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Circle, Plus, X, GripVertical, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { useStatusConfig } from '@/lib/StatusConfigContext';

interface CustomStatus {
  value: string;
  label: string;
  color: string;
}

const DEFAULT_STATUSES = [
  { value: 'open', defaultLabel: 'Open', description: 'New tickets awaiting action', dotColor: '#3b82f6' },
  { value: 'in_progress', defaultLabel: 'In Progress', description: 'Tickets being actively worked on', dotColor: '#f59e0b' },
  { value: 'waiting', defaultLabel: 'Waiting', description: 'Tickets waiting for user response or external action', dotColor: '#8b5cf6' },
  { value: 'closed', defaultLabel: 'Closed', description: 'Tickets fully closed with a closing note', dotColor: '#10b981' },
];

const COLOR_OPTIONS = [
  { id: 'default', label: 'Default', bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border)' },
  { id: 'accent', label: 'Blue', bg: 'var(--accent-subtle)', color: 'var(--accent)', border: 'var(--accent-border)' },
  { id: 'success', label: 'Green', bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' },
  { id: 'warning', label: 'Yellow', bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' },
  { id: 'danger', label: 'Red', bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger-border)' },
];

const DEFAULT_KEYS = DEFAULT_STATUSES.map(d => d.value);

export function TicketStatusesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const { refreshStatusConfig } = useStatusConfig();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);
  const [statusOrder, setStatusOrder] = useState<string[]>(DEFAULT_KEYS);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('default');

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLElement | null>(null);

  // Build lookup helper
  const isDefault = (key: string) => DEFAULT_KEYS.includes(key);
  const getCustom = (key: string) => customStatuses.find(c => c.value === key);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const s = res.data;
        const loaded: Record<string, string> = {};
        DEFAULT_STATUSES.forEach(st => {
          loaded[st.value] = s[`status_label_${st.value}`] || st.defaultLabel;
        });
        let customs: CustomStatus[] = [];
        try {
          const raw = s['custom_statuses'];
          if (raw) {
            customs = JSON.parse(raw);
            setCustomStatuses(customs);
            customs.forEach(cs => { loaded[cs.value] = cs.label; });
          }
        } catch { /* ignore */ }
        // Restore status order, or build from defaults + customs
        try {
          const rawOrder = s['status_order'];
          if (rawOrder) {
            const parsed: string[] = JSON.parse(rawOrder);
            // Ensure all defaults are present
            const fullOrder = [...new Set([...DEFAULT_KEYS, ...parsed])];
            // Only keep keys that actually exist (defaults + current customs)
            const validKeys = new Set([...DEFAULT_KEYS, ...customs.map(c => c.value)]);
            setStatusOrder(fullOrder.filter(k => validKeys.has(k)));
          } else {
            setStatusOrder([...DEFAULT_KEYS, ...customs.map(c => c.value)]);
          }
        } catch {
          setStatusOrder([...DEFAULT_KEYS, ...customs.map(c => c.value)]);
        }
        setLabels(loaded);
      })
      .catch(() => {
        const defaults: Record<string, string> = {};
        DEFAULT_STATUSES.forEach(st => { defaults[st.value] = st.defaultLabel; });
        setLabels(defaults);
        setStatusOrder(DEFAULT_KEYS);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
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
      await api.patch('/admin/settings', { key: 'status_order', value: JSON.stringify(statusOrder) });
      setCustomStatuses(updatedCustom);
      await refreshStatusConfig();
      showAlert('All status labels saved successfully');
    } catch {
      showAlert('Failed to save status labels', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Add custom status ────────────────────────────────────────────────────
  const addCustomStatus = () => {
    const label = newLabel.trim();
    if (!label) return;
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (DEFAULT_KEYS.includes(value) || getCustom(value)) {
      showAlert('A status with this key already exists', 'error');
      return;
    }
    const newStatus = { value, label, color: newColor };
    setCustomStatuses(prev => [...prev, newStatus]);
    setStatusOrder(prev => [...prev, value]);
    setLabels(prev => ({ ...prev, [value]: label }));
    setNewLabel('');
    setNewColor('default');
  };

  // ── Remove custom status ─────────────────────────────────────────────────
  const removeCustomStatus = (value: string) => {
    setCustomStatuses(prev => prev.filter(s => s.value !== value));
    setStatusOrder(prev => prev.filter(k => k !== value));
    setLabels(prev => {
      const next = { ...prev };
      delete next[value];
      return next;
    });
  };

  // ── Drag handlers ────────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    const key = statusOrder[idx];
    if (isDefault(key)) {
      e.preventDefault(); // can't drag defaults
      return;
    }
    setDragIdx(idx);
    dragNode.current = e.currentTarget as HTMLElement;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    requestAnimationFrame(() => {
      if (dragNode.current) dragNode.current.style.opacity = '0.4';
    });
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx !== null && dragIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { cleanup(); return; }
    setStatusOrder(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(idx, 0, moved);
      return updated;
    });
    cleanup();
  };

  const handleDragEnd = () => cleanup();

  const cleanup = () => {
    if (dragNode.current) {
      dragNode.current.style.opacity = '1';
      dragNode.current = null;
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const isDraggingCustom = dragIdx !== null && !isDefault(statusOrder[dragIdx]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Unified Statuses List ────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {statusOrder.map((key, idx) => {
          const def = DEFAULT_STATUSES.find(d => d.value === key);
          const cs = getCustom(key);
          const colorOpt = cs ? COLOR_OPTIONS.find(o => o.id === cs.color) || COLOR_OPTIONS[0] : null;
          const isDragSource = dragIdx === idx;
          const isDropTarget = dragOverIdx === idx && dragIdx !== idx;

          return (
            <div
              key={key}
              draggable={!!cs}
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                background: isDragSource
                  ? 'var(--accent-subtle)'
                  : isDropTarget
                    ? 'var(--bg-secondary)'
                    : idx % 2 === 0 ? 'var(--card)' : 'var(--bg-secondary)',
                borderBottom: idx < statusOrder.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                borderLeft: isDropTarget ? '3px solid var(--accent)' : '3px solid transparent',
                cursor: cs ? 'grab' : 'default',
                transition: 'background 0.12s, border-color 0.12s, opacity 0.12s',
                userSelect: 'none',
                opacity: isDragSource && isDraggingCustom ? 0.4 : 1,
              }}
            >
              {/* Drag handle (custom only) or spacer */}
              {cs ? (
                <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'grab', flexShrink: 0 }}>
                  <GripVertical size={14} />
                </div>
              ) : (
                <div style={{ width: 14, flexShrink: 0 }} />
              )}

              {/* Indicator */}
              {def ? (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: def.dotColor, flexShrink: 0,
                }} />
              ) : colorOpt ? (
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: colorOpt.bg, border: `1px solid ${colorOpt.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Circle size={9} color={colorOpt.color} fill={colorOpt.color} />
                </div>
              ) : null}

              {/* Status key badge */}
              <div style={{ minWidth: 90 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  {def ? 'Default' : 'Custom'}
                </div>
                <code style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: 4 }}>{key}</code>
              </div>

              {/* Label input */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>LABEL</label>
                <input
                  className="input"
                  value={labels[key] || ''}
                  onChange={e => setLabels(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={def?.defaultLabel || key}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>

              {/* Description (default) or color picker (custom) */}
              {def ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200 }}>
                  {def.description}
                </div>
              ) : cs ? (
                <div style={{ minWidth: 100 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>COLOR</label>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {COLOR_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setCustomStatuses(prev => prev.map(c => c.value === cs.value ? { ...c, color: opt.id } : c))}
                        title={opt.label}
                        style={{
                          width: 22, height: 22, borderRadius: 5,
                          border: cs.color === opt.id ? '2px solid var(--text)' : '1px solid var(--border)',
                          background: opt.bg, cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'border-color 0.1s, transform 0.1s',
                          transform: cs.color === opt.id ? 'scale(1.15)' : 'scale(1)',
                        }}
                      >
                        <Circle size={7} color={opt.color} fill={opt.color} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              {cs && (
                <button
                  onClick={() => removeCustomStatus(key)}
                  className="btn btn-ghost btn-sm"
                  title="Remove custom status"
                  style={{ color: 'var(--text-muted)', flexShrink: 0, padding: 4 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}

        {/* ── Inline Add Form ────────────────────────────────────────────── */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>
                <Plus size={11} style={{ marginRight: 3, display: 'inline' }} /> New Custom Status
              </label>
              <input
                className="input"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomStatus(); }}
                placeholder="e.g. On Hold, Pending Review"
                style={{ width: '100%', fontSize: 13 }}
              />
              {newLabel.trim() && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Hash size={10} /> Key: <code style={{ background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>
                    {newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}
                  </code>
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 }}>COLOR</label>
              <div style={{ display: 'flex', gap: 3, height: 38, alignItems: 'center', padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                {COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setNewColor(opt.id)}
                    title={opt.label}
                    style={{
                      width: 22, height: 22, borderRadius: 5,
                      border: newColor === opt.id ? '2px solid var(--text)' : '1px solid var(--border)',
                      background: opt.bg, cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transform: newColor === opt.id ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    <Circle size={7} color={opt.color} fill={opt.color} />
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={addCustomStatus}
              disabled={!newLabel.trim()}
              style={{
                height: 38, padding: '0 18px', borderRadius: 8,
                background: 'var(--accent)', color: 'white', border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: !newLabel.trim() ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className={`btn btn-primary btn-save${saving ? ' saving' : ''}`} onClick={handleSave} disabled={saving} style={{ padding: '10px 28px', fontSize: 14 }}>
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
