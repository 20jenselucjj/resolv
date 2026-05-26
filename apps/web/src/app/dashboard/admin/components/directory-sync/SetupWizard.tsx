'use client';

import { CheckCircle, ExternalLink, Link2 } from 'lucide-react';

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

  return (
    <div className="ds-fade-in" style={{
      padding: '24px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--bg) 100%)',
    }}>
      {/* Progress Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Setup Progress</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
            {completedSteps === setupSteps.length
              ? 'All steps complete — you\'re ready to sync!'
              : `${completedSteps} of ${setupSteps.length} steps completed`}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: '50%',
          background: setupProgress === 100 ? 'var(--success-bg)' : 'var(--accent-subtle)',
          border: `2px solid ${setupProgress === 100 ? 'var(--success)' : 'var(--accent-border)'}`,
          fontSize: '14px', fontWeight: 700,
          color: setupProgress === 100 ? 'var(--success)' : 'var(--accent)',
        }}>
          {setupProgress === 100 ? <CheckCircle size={20} /> : `${completedSteps}/${setupSteps.length}`}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%', height: 6, borderRadius: 3,
        background: 'var(--bg-tertiary)', marginBottom: 24, overflow: 'hidden',
      }}>
        <div style={{
          width: `${setupProgress}%`, height: '100%', borderRadius: 3,
          background: setupProgress === 100
            ? 'linear-gradient(90deg, var(--success), #34d399)'
            : 'linear-gradient(90deg, var(--accent), var(--accent-mid))',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>

      {/* Step List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {setupSteps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isCompleted = step.completed;
          const isLast = index === setupSteps.length - 1;
          return (
            <div key={step.key} style={{ display: 'flex', gap: 16 }}>
              {/* Step indicator column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
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
                    <CheckCircle size={16} color="var(--success)" />
                  ) : isCurrent ? (
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>{index + 1}</span>
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>{index + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 24,
                    background: isCompleted ? 'var(--success-border)' : 'var(--border)',
                    transition: 'background 0.3s ease',
                    margin: '4px 0',
                  }} />
                )}
              </div>
              {/* Step content */}
              <div style={{
                paddingBottom: isLast ? 0 : 20, flex: 1,
              }}>
                <div style={{
                  fontSize: '13px', fontWeight: 600,
                  color: isCompleted ? 'var(--success)' : isCurrent ? 'var(--text)' : 'var(--text-muted)',
                  marginBottom: 2,
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5,
                }}>
                  {step.description}
                </div>

                {/* Step-specific actions */}
                {isCurrent && step.key === 'credentials' && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--accent)', color: 'white',
                        fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                    >
                      <ExternalLink size={12} />
                      Open Google Cloud Console
                    </a>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Create OAuth 2.0 Client ID for a web application
                    </span>
                  </div>
                )}

                {isCurrent && step.key === 'oauth' && (
                  <div style={{ marginTop: 12 }}>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/oauth/google/authorize`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 18px', borderRadius: 'var(--radius-md)',
                        background: 'var(--accent)', color: 'white',
                        fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                        transition: 'background 0.15s',
                        boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.3)',
                      }}
                    >
                      <Link2 size={14} />
                      Connect Google Workspace
                    </a>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 12 }}>
                      Opens in a new tab. Return here after authorizing.
                    </span>
                  </div>
                )}

                {isCurrent && step.key === 'sync' && (
                  <div style={{ marginTop: 12 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Enable directory sync in the Sync Configuration section below, then save your configuration.
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
