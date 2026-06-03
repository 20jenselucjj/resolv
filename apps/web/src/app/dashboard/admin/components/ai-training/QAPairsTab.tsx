'use client';

import { Plus, Trash2, RefreshCw, X, MessageSquare } from 'lucide-react';
import type { QAPair } from './types';

interface QAFormData {
  question: string;
  answer: string;
  category: string;
  tags: string;
  scope: string;
}

// Re-export for use in parent
export type { QAFormData };

interface QAPairsTabProps {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  loading: boolean;
  qaPairs: QAPair[];
  showAddQA: boolean;
  editingQAId: string | null;
  qaForm: QAFormData;
  qaEditForm: QAFormData;
  setShowAddQA: (v: boolean) => void;
  setQAForm: React.Dispatch<React.SetStateAction<QAFormData>>;
  setQAEditForm: React.Dispatch<React.SetStateAction<QAFormData>>;
  setEditingQAId: (id: string | null) => void;
  handleAddQA: (e: React.FormEvent) => Promise<void>;
  handleStartEditQA: (qa: QAPair) => void;
  handleSaveEditQA: (id: string) => Promise<void>;
  toggleQAActive: (id: string, currentStatus: boolean) => Promise<void>;
  handleDeleteQA: (id: string) => Promise<void>;
}

export function QAPairsTab(props: QAPairsTabProps) {
  const {
    showAlert, loading, qaPairs, showAddQA, editingQAId,
    qaForm, qaEditForm, setShowAddQA, setQAForm, setQAEditForm,
    setEditingQAId, handleAddQA, handleStartEditQA, handleSaveEditQA,
    toggleQAActive, handleDeleteQA
  } = props;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
        padding: '20px 24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--bg) 100%)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={18} />
            </div>
            Q&A Pairs
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
            Author precise question-answer pairs for high-confidence responses on critical topics
          </p>
        </div>
        <button
          onClick={() => setShowAddQA(!showAddQA)}
          style={{
            padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none',
            background: '#10b981', color: '#fff', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
          }}
        >
          {showAddQA ? <X size={14} /> : <Plus size={14} />}
          {showAddQA ? 'Cancel' : 'Add Q&A Pair'}
        </button>
      </div>

      {/* Add QA Inline Form */}
      {showAddQA && (
        <form onSubmit={handleAddQA} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Add New QA Pair
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Question *</label>
            <textarea
              className="input"
              value={qaForm.question}
              onChange={e => setQAForm({ ...qaForm, question: e.target.value })}
              placeholder="What is the exact question users might ask?"
              rows={2}
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Answer *</label>
            <textarea
              className="input"
              value={qaForm.answer}
              onChange={e => setQAForm({ ...qaForm, answer: e.target.value })}
              placeholder="Provide the highly detailed, authorized standard response."
              rows={4}
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Category</label>
              <input
                className="input"
                value={qaForm.category}
                onChange={e => setQAForm({ ...qaForm, category: e.target.value })}
                placeholder="e.g. Compensation, Login Errors"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Tags (comma-separated)</label>
              <input
                className="input"
                value={qaForm.tags}
                onChange={e => setQAForm({ ...qaForm, tags: e.target.value })}
                placeholder="e.g. essential, payroll"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>AI Availability</label>
              <select
                className="input"
                value={qaForm.scope}
                onChange={e => setQAForm({ ...qaForm, scope: e.target.value })}
                style={{ appearance: 'none', WebkitAppearance: 'none' }}
              >
                <option value="both">🔄 Both Agent &amp; Portal AI</option>
                <option value="agent">🤖 Agent AI Only</option>
                <option value="portal">🌐 Portal AI Only</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowAddQA(false)}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Save QA Pair
            </button>
          </div>
        </form>
      )}

      {/* Q&A List */}
      <div className="card" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading Q&A registry...</div>
          </div>
        ) : qaPairs.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <MessageSquare size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>No custom Q&A pairs yet</p>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              Create precise question-and-answer pairs to override automated RAG on critical topics
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {qaPairs.map(qa => {
              const isEditing = editingQAId === qa.id;

              return (
                <div key={qa.id} style={{ borderBottom: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Question</label>
                        <textarea
                          className="input"
                          value={qaEditForm.question}
                          onChange={e => setQAEditForm({ ...qaEditForm, question: e.target.value })}
                          rows={2}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Answer</label>
                        <textarea
                          className="input"
                          value={qaEditForm.answer}
                          onChange={e => setQAEditForm({ ...qaEditForm, answer: e.target.value })}
                          rows={4}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Category</label>
                          <input
                            className="input"
                            value={qaEditForm.category}
                            onChange={e => setQAEditForm({ ...qaEditForm, category: e.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Tags</label>
                          <input
                            className="input"
                            value={qaEditForm.tags}
                            onChange={e => setQAEditForm({ ...qaEditForm, tags: e.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>AI Availability</label>
                          <select
                            className="input"
                            value={qaEditForm.scope}
                            onChange={e => setQAEditForm({ ...qaEditForm, scope: e.target.value })}
                            style={{ appearance: 'none', WebkitAppearance: 'none' }}
                          >
                            <option value="both">🔄 Both Agent &amp; Portal AI</option>
                            <option value="agent">🤖 Agent AI Only</option>
                            <option value="portal">🌐 Portal AI Only</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => setEditingQAId(null)}
                          style={{
                            padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                            background: 'transparent', color: 'var(--text)', fontSize: '12px', cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEditQA(qa.id)}
                          style={{
                            padding: '6px 12px', borderRadius: 'var(--radius-md)', border: 'none',
                            background: 'var(--success)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Row Summary */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={{
                              background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
                              fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px'
                            }}>
                              {qa.category || 'General'}
                            </span>
                            {qa.scope && (
                              <span style={{
                                background: qa.scope === 'portal' ? 'rgba(16,185,129,0.1)' : qa.scope === 'agent' ? 'rgba(37,99,235,0.1)' : 'var(--bg-tertiary)',
                                color: qa.scope === 'portal' ? '#10b981' : qa.scope === 'agent' ? '#2563eb' : 'var(--text-secondary)',
                                border: `1px solid ${qa.scope === 'portal' ? 'rgba(16,185,129,0.3)' : qa.scope === 'agent' ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
                                fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px'
                              }}>
                                {qa.scope === 'portal' ? '🌐 Portal' : qa.scope === 'agent' ? '🤖 Agent' : '🔄 Both'}
                              </span>
                            )}
                            {(qa.tags || []).map(t => (
                              <span key={t} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-secondary)', padding: '1px 4px', borderRadius: '3px' }}>
                                #{t}
                              </span>
                            ))}
                          </div>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                            Q: {qa.question}
                          </h4>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            A: {qa.answer}
                          </p>
                        </div>

                        {/* Actions Column */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Toggle active state */}
                          <div
                            onClick={() => toggleQAActive(qa.id, qa.is_active)}
                            style={{
                              width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
                              background: qa.is_active ? 'var(--success)' : 'var(--bg-tertiary)',
                              border: `1px solid ${qa.is_active ? 'var(--success)' : 'var(--border)'}`,
                              position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
                            }}
                            title={qa.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <div style={{
                              position: 'absolute', top: 1,
                              left: qa.is_active ? 15 : 1,
                              width: 14, height: 14, borderRadius: '50%',
                              background: qa.is_active ? 'white' : 'var(--text-muted)',
                              transition: 'left 0.2s ease'
                            }} />
                          </div>

                          <button
                            onClick={() => handleStartEditQA(qa)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDeleteQA(qa.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
