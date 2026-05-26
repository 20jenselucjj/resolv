'use client';

import { Zap, RefreshCw, Settings, Clock, BookOpen, MessageSquare, FileText, Brain, FlaskConical } from 'lucide-react';
import type { TestResult } from './types';
import { getClassificationStyles } from './helpers';

interface TestEvaluateTabProps {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  testing: boolean;
  testQuery: string;
  testResult: TestResult | null;
  setTestQuery: (q: string) => void;
  handleRunTest: () => Promise<void>;
}

export function TestEvaluateTab(props: TestEvaluateTabProps) {
  const { showAlert, testing, testQuery, testResult, setTestQuery, handleRunTest } = props;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
        padding: '20px 24px', background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, var(--bg) 100%)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(249, 115, 22, 0.2)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#f97316', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FlaskConical size={18} />
            </div>
            Test & Evaluate
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
            Test your knowledge base retrieval and review matching vector chunks before going live
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Test Prompt Query</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <textarea
              className="input"
              value={testQuery}
              onChange={e => setTestQuery(e.target.value)}
              placeholder="Ask any question, e.g. How do I setup the secure remote client credentials?"
              rows={2}
              style={{ flex: 1, resize: 'none' }}
            />
            <button
              disabled={testing}
              onClick={handleRunTest}
              style={{
                padding: '12px 24px', borderRadius: 'var(--radius-md)', border: 'none',
                background: testing ? 'var(--text-muted)' : '#f97316', color: '#fff', fontSize: '13px', fontWeight: 700,
                cursor: testing ? 'not-allowed' : 'pointer', alignSelf: 'stretch', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: testing ? 'none' : '0 2px 8px rgba(249, 115, 22, 0.3)'
              }}
            >
              {testing ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
              {testing ? 'Running...' : 'Run Test'}
            </button>
          </div>
        </div>
      </div>

      {testing && (
        <div style={{ padding: '60px 40px', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 16px', color: '#f97316' }} />
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Querying Knowledge Model...</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Executing vector similarity search and compiling response.</div>
        </div>
      )}

      {!testing && !testResult && (
        <div style={{ padding: '60px 40px', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FlaskConical size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>Retrieval sandbox is empty</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
            Type a query in the test prompt above to run vector matching analysis
          </p>
        </div>
      )}

      {testResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Test statistics widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={18} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>STRATEGY USED</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{testResult.strategy}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={18} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>RETRIEVAL LATENCY</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{testResult.retrieval_ms || 12} ms</div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={18} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>MATCHING CHUNKS</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{testResult.total_results || 0} hits</div>
              </div>
            </div>
          </div>

          {/* Retrieved Q&A Overrides */}
          {testResult.qa_pairs && testResult.qa_pairs.length > 0 && (
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={14} color="var(--accent)" />
                Matched Q&A Override Pairs
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {testResult.qa_pairs.map((qa, index) => (
                  <div key={index} style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>Q: {qa.question}</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)'
                      }}>
                        Match Confidence: {(qa.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>A: {qa.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retrieved Source Chunks */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} color="var(--accent)" />
              Retrieved Ground Truth Vector Chunks
            </h4>
            {(!testResult.chunks || testResult.chunks.length === 0) ? (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '12px' }}>
                No matching knowledge document chunks were retrieved.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {testResult.chunks.map((chunk, index) => {
                  const cStyle = getClassificationStyles(chunk.classification);
                  return (
                    <div key={index} style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>{chunk.source_name}</span>
                          <span style={{
                            padding: '1px 6px', borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: 600,
                            background: cStyle.bg, color: cStyle.text, border: `1px solid ${cStyle.border}`, textTransform: 'uppercase'
                          }}>
                            {chunk.classification}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)'
                        }}>
                          Cosine Similarity: {chunk.score.toFixed(3)}
                        </span>
                      </div>
                      <div style={{
                        fontFamily: 'monospace', fontSize: '12px', padding: '10px',
                        background: 'var(--card)', borderRadius: '4px', border: '1px solid var(--border)',
                        color: 'var(--text)', whiteSpace: 'pre-wrap'
                      }}>
                        {chunk.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Final Consolidated AI Response */}
          {testResult.test_response && (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--accent-border)', background: 'var(--accent-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Brain size={16} />
                Synthesized Test Response
              </h4>
              <div style={{
                fontSize: '13px', lineHeight: 1.6, color: 'var(--text)',
                whiteSpace: 'pre-wrap', padding: '12px', background: 'var(--card)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'
              }}>
                {testResult.test_response}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
