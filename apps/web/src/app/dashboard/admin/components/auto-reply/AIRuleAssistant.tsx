'use client';

import { useState } from 'react';
import {
  Sparkles, Loader2, X, Edit2, CheckCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS, EVENT_LABELS
} from './types';

interface AIRuleAssistantProps {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  onRuleCreated: () => void;
}

type AiStep = 'prompt' | 'generating' | 'preview' | 'saving' | 'complete';

interface AiGeneratedData {
  name: string;
  description: string;
  event: string;
  conditions: {
    ticket_types: string[];
    priorities: string[];
    statuses: string[];
    keyword: string;
  };
  reply_subject: string;
  reply_body: string;
}

export function AIRuleAssistant({ showAlert, onRuleCreated }: AIRuleAssistantProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStep, setAiStep] = useState<AiStep>('prompt');
  const [aiGeneratedRule, setAiGeneratedRule] = useState<AiGeneratedData | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiStep('generating');
    setAiError(null);
    try {
      const res = await api.post<{ data: AiGeneratedData }>('/admin/ai/generate-template', {
        type: 'auto_reply_rule',
        prompt: aiPrompt,
      });
      setAiGeneratedRule(res.data);
      setAiStep('preview');
    } catch (err: any) {
      setAiError(err?.message || 'AI generation failed');
      setAiStep('prompt');
      showAlert(err?.serverError || err?.message || 'AI generation failed', 'error');
    }
  };

  const handleSave = async () => {
    if (!aiGeneratedRule) return;
    setAiStep('saving');
    try {
      await api.post('/admin/auto-replies', {
        name: aiGeneratedRule.name,
        description: aiGeneratedRule.description,
        event: aiGeneratedRule.event,
        conditions: aiGeneratedRule.conditions,
        reply_subject: aiGeneratedRule.reply_subject,
        reply_body: aiGeneratedRule.reply_body,
        send_to_requester: true,
        send_to_assignee: false,
      });
      showAlert('Auto-reply rule created by AI');
      await onRuleCreated();
      setAiStep('complete');
      setTimeout(() => {
        setAiStep('prompt');
        setAiPrompt('');
        setAiGeneratedRule(null);
        setAiError(null);
      }, 2000);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save rule', 'error');
      setAiStep('preview');
    }
  };

  const handleEdit = () => {
    if (!aiGeneratedRule) return;
    showAlert('Manual editing not implemented yet', 'error');
  };

  const handleRegenerate = () => {
    setAiGeneratedRule(null);
    setAiError(null);
    handleGenerate();
  };

  const handleCancel = () => {
    setAiStep('prompt');
    setAiPrompt('');
    setAiGeneratedRule(null);
    setAiError(null);
  };

  const stepOrder: Record<AiStep, number> = {
    prompt: 0, generating: 1, preview: 2, saving: 3, complete: 4,
  };

  const isBusy = aiStep === 'generating' || aiStep === 'saving';

  return (
    <div className="card" style={{
      padding: 24,
      background: 'linear-gradient(135deg, var(--accent-subtle), var(--bg-secondary))',
      border: '1px solid var(--accent-border)',
      borderRadius: 'var(--radius-md)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'block' }}>
              AI Rule Assistant
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {aiStep === 'prompt' && 'Describe the rule you need'}
              {aiStep === 'generating' && 'Creating your rule...'}
              {aiStep === 'preview' && 'Review before saving'}
              {aiStep === 'saving' && 'Saving your rule...'}
              {aiStep === 'complete' && 'All done!'}
            </span>
          </div>
        </div>
        <button
          onClick={handleCancel}
          disabled={isBusy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer',
            background: 'transparent',
            color: 'var(--text-muted)', transition: 'all 0.12s',
            opacity: isBusy ? 0.4 : 1,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress Steps */}
      {aiStep !== 'complete' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '0 4px' }}>
          {['Prompt', 'Generate', 'Preview', 'Save'].map((label, i) => {
            const current = stepOrder[aiStep];
            const isActive = current >= i;
            const isCompleted = current > i;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i === 3 ? 0 : 1 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  flexShrink: 0,
                }}>
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 12,
                  color: isActive ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.4s ease',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
                {i < 3 && (
                  <div style={{
                    flex: 1, height: 2, minWidth: 12,
                    background: isCompleted ? 'var(--accent)' : 'var(--border)',
                    transition: 'all 0.4s ease',
                    marginLeft: 4, marginRight: 4,
                    borderRadius: 1,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {aiError && aiStep === 'prompt' && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-sm)',
          background: '#fef2f2', border: '1px solid #fecaca',
          color: 'var(--danger)', fontSize: 13, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <X size={14} /> {aiError}
        </div>
      )}

      {/* Content */}
      <div style={{ transition: 'all 0.3s ease' }}>
        {/* Prompt */}
        {aiStep === 'prompt' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <textarea
                style={{
                  width: '100%', minHeight: 90, padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--accent-border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={'Describe the auto-reply rule, e.g., "When a high priority incident is created, send an urgent notification to the requester with expected response time"'}
                rows={3}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Describe what you want the rule to do in natural language. The AI will generate conditions, event trigger, and reply content.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={handleGenerate}
                disabled={!aiPrompt.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                  padding: '8px 16px',
                  border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  background: !aiPrompt.trim()
                    ? 'var(--bg-tertiary)'
                    : 'linear-gradient(135deg, var(--accent), #7c3aed)',
                  color: !aiPrompt.trim() ? 'var(--text-muted)' : '#fff',
                  fontWeight: 600,
                }}
              >
                <Sparkles size={14} /> Generate Rule
              </button>
            </div>
          </div>
        )}

        {/* Generating */}
        {aiStep === 'generating' && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <Loader2 size={48} style={{ color: 'var(--accent)', animation: 'spin 1.2s linear infinite' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 16, marginBottom: 8 }}>
              Generating your rule...
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.5s infinite' }} />
                Sending prompt to AI...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', animation: 'pulse-dot 1.5s infinite 0.5s' }} />
                Generating rule conditions...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', animation: 'pulse-dot 1.5s infinite 1s' }} />
                Preparing reply content...
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {aiStep === 'preview' && aiGeneratedRule && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              padding: 16, borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Generated Rule Preview
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>NAME</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{aiGeneratedRule.name}</div>
                {aiGeneratedRule.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{aiGeneratedRule.description}</div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>EVENT TRIGGER</div>
                <span style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-subtle)', color: 'var(--accent)',
                  border: '1px solid var(--accent)', fontWeight: 600,
                }}>
                  {EVENT_LABELS[aiGeneratedRule.event] || aiGeneratedRule.event}
                </span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>CONDITIONS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {aiGeneratedRule.conditions.ticket_types?.map(t => (
                    <span key={t} style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-subtle)', color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                    }}>
                      Type: {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                  {aiGeneratedRule.conditions.priorities?.map(p => (
                    <span key={p} style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      background: `${PRIORITY_COLORS[p]}18`, color: PRIORITY_COLORS[p],
                      border: `1px solid ${PRIORITY_COLORS[p]}`,
                    }}>
                      Priority: {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  ))}
                  {aiGeneratedRule.conditions.statuses?.map(s => (
                    <span key={s} style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      background: `${STATUS_COLORS[s]}18`, color: STATUS_COLORS[s],
                      border: `1px solid ${STATUS_COLORS[s]}`,
                    }}>
                      Status: {STATUS_LABELS[s] || s}
                    </span>
                  ))}
                  {aiGeneratedRule.conditions.keyword && (
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      Keyword: "{aiGeneratedRule.conditions.keyword}"
                    </span>
                  )}
                  {(!aiGeneratedRule.conditions.ticket_types || aiGeneratedRule.conditions.ticket_types.length === 0) &&
                   (!aiGeneratedRule.conditions.priorities || aiGeneratedRule.conditions.priorities.length === 0) &&
                   (!aiGeneratedRule.conditions.statuses || aiGeneratedRule.conditions.statuses.length === 0) &&
                   !aiGeneratedRule.conditions.keyword && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Applies to all tickets</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>REPLY SUBJECT</div>
                <div style={{
                  fontSize: 13, color: 'var(--text)', marginBottom: 10,
                  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)', fontFamily: 'monospace',
                }}>
                  {aiGeneratedRule.reply_subject}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>REPLY BODY</div>
                <div style={{
                  fontSize: 12, color: 'var(--text)',
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                  maxHeight: 150, overflowY: 'auto',
                }}>
                  {aiGeneratedRule.reply_body || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No body content</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleCancel} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600, padding: '8px 14px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)',
              }}>
                <X size={14} /> Cancel
              </button>
              <button type="button" onClick={handleRegenerate} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600, padding: '8px 14px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-border)',
                cursor: 'pointer', background: 'var(--accent-subtle)', color: 'var(--accent)',
              }}>
                <Sparkles size={14} /> Regenerate
              </button>
              <button type="button" onClick={handleSave} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, padding: '8px 18px',
                borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), #7c3aed)', color: '#fff',
              }}>
                <CheckCircle size={14} /> Create Rule
              </button>
            </div>
          </div>
        )}

        {/* Saving */}
        {aiStep === 'saving' && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <Loader2 size={40} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Saving rule...</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Please wait while we save your new rule</div>
          </div>
        )}

        {/* Complete */}
        {aiStep === 'complete' && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#059669', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircle size={28} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
              Rule created successfully!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {aiGeneratedRule?.name}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
