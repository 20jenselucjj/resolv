'use client';

import { useState } from 'react';
import { CheckCircle, ExternalLink, Link2, ChevronDown } from 'lucide-react';

interface SetupStep {
  key: string;
  label: string;
  description: string;
  completed: boolean;
}

export function SetupWizard({ setupSteps }: { setupSteps: SetupStep[] }) {
  const completedSteps = setupSteps.filter(s => s.completed).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;
  const currentStepIndex = setupSteps.findIndex(s => !s.completed);
  const [expanded, setExpanded] = useState(true);

  const allDone = completedSteps === setupSteps.length;

  return (
    <div className="ds-fade-in ds-wizard-mobile" style={{
      padding: '24px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--bg) 100%)',
    }}>
      {/* Progress Header — compact */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse setup steps' : 'Expand setup steps'}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, cursor: 'pointer', outline: 'none',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Setup Progress</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
            {allDone
              ? 'All steps complete — ready to sync!'
              : `${completedSteps}/${setupSteps.length} steps done`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%',
            background: allDone ? 'var(--success-bg)' : 'var(--accent-subtle)',
            border: `2px solid ${allDone ? 'var(--success)' : 'var(--accent-border)'}`,
            fontSize: '13px', fontWeight: 700,
            color: allDone ? 'var(--success)' : 'var(--accent)',
          }}>
            {allDone ? <CheckCircle size={18} /> : `${completedSteps}/${setupSteps.length}`}
          </div>
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%', height: 4, borderRadius: 2,
        background: 'var(--bg-tertiary)', marginBottom: expanded ? 20 : 0, overflow: 'hidden',
      }}>
        <div style={{
          width: `${setupProgress}%`, height: '100%', borderRadius: 2,
          background: allDone
            ? 'linear-gradient(90deg, var(--success), #34d399)'
            : 'linear-gradient(90deg, var(--accent), var(--accent-mid))',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>

      {/* Step List — collapsible */}
      <div style={{
        maxHeight: expanded ? '800px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.4s ease, opacity 0.3s ease',
        opacity: expanded ? 1 : 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {setupSteps.map((step, index) => {
            const isCurrent = index === currentStepIndex;
            const isCompleted = step.completed;
            const isLast = index === setupSteps.length - 1;
            return (
              <div key={step.key} style={{ display: 'flex', gap: 12 }}>
                {/* Step indicator column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCompleted
                      ? 'var(--success-bg)'
                      : isCurrent
                        ? 'var(--accent-subtle)'
                        : 'var(--bg-tertiary)',
                    border: `2px solid ${
                      isCompleted
                        ? 'var(--success)'
                        : isCurrent
                          ? 'var(--accent)'
                          : 'var(--border)'
                    }`,
                    transition: 'all 0.3s ease',
                    flexShrink: 0,
                  }}>
                    {isCompleted ? (
                      <CheckCircle size={13} color="var(--success)" />
                    ) : isCurrent ? (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{index + 1}</span>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>{index + 1}</span>
                    )}
                  </div>
                  {!isLast && (
                    <div style={{
                      width: 2, flex: 1, minHeight: 16,
                      background: isCompleted ? 'var(--success-border)' : 'var(--border)',
                      transition: 'background 0.3s ease',
                      margin: '2px 0',
                    }} />
                  )}
                </div>
                {/* Step content */}
                <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                  <div className="ds-step-label" style={{
                    fontSize: '12px', fontWeight: 600,
                    color: isCompleted ? 'var(--success)' : isCurrent ? 'var(--text)' : 'var(--text-muted)',
                    marginBottom: 2,
                  }}>
                    {step.label}
                  </div>
                  <div className={`ds-step-desc${isCurrent ? ' current' : ''}`} style={{
                    fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4,
                  }}>
                    {step.description}
                  </div>

                  {/* Step-specific actions — only for current step */}
                  {isCurrent && step.key === 'credentials' && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="resp-btn"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '6px 12px', borderRadius: 'var(--radius-md)',
                          background: 'var(--accent)', color: 'white',
                          fontSize: '11px', fontWeight: 600, textDecoration: 'none',
                          transition: 'background 0.15s', whiteSpace: 'nowrap',
                        }}
                      >
                        <ExternalLink size={11} />
                        <span className="hide-mobile">Open Google Cloud Console</span>
                        <span className="show-mobile">GCP Console</span>
                      </a>
                      <span className="hide-mobile" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Create OAuth 2.0 Client ID for a web application
                      </span>
                    </div>
                  )}

                  {isCurrent && step.key === 'oauth' && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/oauth/google/authorize`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="resp-btn"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '7px 16px', borderRadius: 'var(--radius-md)',
                          background: 'var(--accent)', color: 'white',
                          fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                          transition: 'background 0.15s', whiteSpace: 'nowrap',
                        }}
                      >
                        <Link2 size={13} />
                        <span className="hide-mobile">Connect Google Workspace</span>
                        <span className="show-mobile">Connect</span>
                      </a>
                      <span className="hide-mobile" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Opens in a new tab. Return here after authorizing.
                      </span>
                    </div>
                  )}

                  {isCurrent && step.key === 'sync' && (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Enable sync in the Sync Configuration section below, then save.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
