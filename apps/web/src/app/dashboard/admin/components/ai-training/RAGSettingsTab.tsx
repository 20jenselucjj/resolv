'use client';

import { Settings, RefreshCw, CheckCircle } from 'lucide-react';
import type { RAGConfig } from './types';

interface RAGSettingsTabProps {
  ragConfig: RAGConfig;
  savingConfig: boolean;
  setRagConfig: React.Dispatch<React.SetStateAction<RAGConfig>>;
  handleSaveRAGConfig: () => Promise<void>;
}

export function RAGSettingsTab(props: RAGSettingsTabProps) {
  const { ragConfig, savingConfig, setRagConfig, handleSaveRAGConfig } = props;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
        padding: '20px 24px', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, var(--bg) 100%)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(79, 70, 229, 0.2)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={18} />
            </div>
            Retrieval Configuration
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
            Configure how document-based retrieval integrates context safely with the large language models
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', borderRadius: 'var(--radius-lg)' }}>
        {/* Global Enable RAG */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: ragConfig.enabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: `1px solid ${ragConfig.enabled ? 'var(--border)' : 'var(--border-subtle)'}` }}>
          <div
            onClick={() => setRagConfig({ ...ragConfig, enabled: !ragConfig.enabled })}
            style={{
              width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
              background: ragConfig.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: `1px solid ${ragConfig.enabled ? 'var(--accent)' : 'var(--border)'}`,
              position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: ragConfig.enabled ? 24 : 2,
              width: 20, height: 20, borderRadius: '50%',
              background: ragConfig.enabled ? 'white' : 'var(--text-muted)',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable RAG</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>When disabled, the AI will answer using its pre-trained model knowledge only.</div>
          </div>
        </div>

        {/* Content inputs grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', opacity: ragConfig.enabled ? 1 : 0.5, pointerEvents: ragConfig.enabled ? 'auto' : 'none' }}>

          {/* Left Column: Retrieval Strategies & Citations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 700 }}>Retrieval Strategy</label>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Specify how we analyze search queries against indexed content</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: ragConfig.retrieval_strategy === 'keyword' ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="strategy"
                    value="keyword"
                    checked={ragConfig.retrieval_strategy === 'keyword'}
                    onChange={() => setRagConfig({ ...ragConfig, retrieval_strategy: 'keyword' })}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>Keyword Only</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Fuzzy search matching precise terms. Low computational footprint.</span>
                  </div>
                </label>

                <label style={{ display: 'flex', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: ragConfig.retrieval_strategy === 'semantic' ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="strategy"
                    value="semantic"
                    checked={ragConfig.retrieval_strategy === 'semantic'}
                    onChange={() => setRagConfig({ ...ragConfig, retrieval_strategy: 'semantic' })}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>Semantic (Vector)</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Uses embedding vectors to find matches matching intent, even if wording differs.</span>
                  </div>
                </label>

                <label style={{ display: 'flex', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: ragConfig.retrieval_strategy === 'hybrid' ? 'var(--bg-secondary)' : 'transparent', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="strategy"
                    value="hybrid"
                    checked={ragConfig.retrieval_strategy === 'hybrid'}
                    onChange={() => setRagConfig({ ...ragConfig, retrieval_strategy: 'hybrid' })}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', color: 'var(--accent)' }}>Hybrid (Recommended)</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Combines keywords and vector embeddings with a re-ranking algorithm for maximum precision.</span>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 700 }}>Citation Mode</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                {['inline', 'footer', 'none'].map((mode) => (
                  <label key={mode} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'capitalize', fontSize: '12px', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="citation_mode"
                      value={mode}
                      checked={ragConfig.citation_mode === mode as any}
                      onChange={() => setRagConfig({ ...ragConfig, citation_mode: mode as any })}
                    />
                    {mode}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Parameters Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>Top K results</span>
                <span style={{ color: 'var(--accent)' }}>{ragConfig.top_k} chunks</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={ragConfig.top_k}
                onChange={e => setRagConfig({ ...ragConfig, top_k: parseInt(e.target.value) })}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Maximum number of context fragments supplied to the model.</span>
            </div>

            {(ragConfig.retrieval_strategy === 'semantic' || ragConfig.retrieval_strategy === 'hybrid') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                  <span>Similarity Threshold</span>
                  <span style={{ color: 'var(--accent)' }}>{(ragConfig.similarity_threshold * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={ragConfig.similarity_threshold}
                  onChange={e => setRagConfig({ ...ragConfig, similarity_threshold: parseFloat(e.target.value) })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Minimum cosine similarity threshold for vector retrieval.</span>
              </div>
            )}

            {ragConfig.retrieval_strategy === 'hybrid' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                  <span>Semantic Weight</span>
                  <span style={{ color: 'var(--accent)' }}>{(ragConfig.semantic_weight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ragConfig.semantic_weight}
                  onChange={e => setRagConfig({ ...ragConfig, semantic_weight: parseFloat(e.target.value) })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Balances semantic (vector) vs keyword (full-text) scores in hybrid retrieval. Higher = more emphasis on meaning over exact words.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>Chunk Size</span>
                <span style={{ color: 'var(--accent)' }}>{ragConfig.chunk_size} words</span>
              </div>
              <input
                type="range"
                min="256"
                max="2048"
                step="128"
                value={ragConfig.chunk_size}
                onChange={e => setRagConfig({ ...ragConfig, chunk_size: parseInt(e.target.value) })}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target word count for segmented paragraphs during document chunking.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>Chunk Overlap</span>
                <span style={{ color: 'var(--accent)' }}>{ragConfig.chunk_overlap} words</span>
              </div>
              <input
                type="range"
                min="0"
                max="256"
                step="16"
                value={ragConfig.chunk_overlap}
                onChange={e => setRagConfig({ ...ragConfig, chunk_overlap: parseInt(e.target.value) })}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overlap words preserved on both sides of a chunk to protect context flow.</span>
            </div>

            {/* Inject Context Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <input
                type="checkbox"
                id="injectContext"
                checked={ragConfig.inject_context}
                onChange={e => setRagConfig({ ...ragConfig, inject_context: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
              />
              <label htmlFor="injectContext" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Inject citation reference blocks explicitly into system prompt context
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
          <button
            disabled={savingConfig}
            onClick={handleSaveRAGConfig}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-lg)', border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700,
              cursor: savingConfig ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {savingConfig ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle size={14} />}
            {savingConfig ? 'Saving Settings...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
