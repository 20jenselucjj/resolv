'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Brain, Upload, Link, FileText, MessageSquare, Settings, FlaskConical,
  BarChart3, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Clock,
  Shield, ChevronDown, ChevronUp, X, Search, BookOpen, Zap, Eye, Flag, Activity
} from 'lucide-react';

interface KnowledgeSource {
  id: string;
  name: string;
  source_type: 'manual' | 'url' | 'file' | 'kb_sync' | 'ticket_sync';
  raw_content?: string;
  url?: string;
  tags: string[];
  category: string;
  classification: 'unclassified' | 'sensitive' | 'confidential' | 'secret';
  status: 'pending' | 'processing' | 'ready' | 'error';
  chunk_count: number;
  is_active: boolean;
  created_at: string;
}

interface Chunk {
  id: string;
  content: string;
  chunk_index: number;
  has_embedding?: boolean;
  content_tokens?: number;
  embedding_model?: string;
}

interface QAPair {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

interface RAGConfig {
  enabled: boolean;
  retrieval_strategy: 'keyword' | 'semantic' | 'hybrid';
  top_k: number;
  similarity_threshold: number;
  chunk_size: number;
  chunk_overlap: number;
  citation_mode: 'inline' | 'footer' | 'none';
  inject_context: boolean;
}

interface TestResult {
  strategy: string;
  retrieval_ms: number;
  total_results: number;
  test_response?: string;
  qa_pairs?: {
    question: string;
    answer: string;
    score: number;
  }[];
  chunks?: {
    source_name: string;
    classification: 'unclassified' | 'sensitive' | 'confidential' | 'secret';
    content: string;
    score: number;
  }[];
}

interface AnalyticsData {
  summary: {
    total_queries: number;
    avg_confidence: number;
    flagged_count: number;
    active_sources: number;
    total_sources: number;
  };
  daily_volume: { date: string; count: number }[];
  source_stats: {
    name: string;
    category: string;
    chunk_count: number;
    query_hits: number;
  }[];
  recent_queries: {
    id: string;
    query: string;
    user_name: string;
    created_at: string;
    confidence_score: number;
    flagged_for_review: boolean;
  }[];
}

export function AITrainingTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'sources' | 'qa' | 'rag' | 'test' | 'analytics'>('sources');
  const [loading, setLoading] = useState(false);

  // --- Sub-tab 1: Sources State ---
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [sourceChunks, setSourceChunks] = useState<Record<string, Chunk[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<Record<string, boolean>>({});
  const [syncingKB, setSyncingKB] = useState(false);
  const [syncingTickets, setSyncingTickets] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    source_type: 'manual' as 'manual' | 'url',
    category: '',
    classification: 'unclassified' as 'unclassified' | 'sensitive' | 'confidential' | 'secret',
    tags: '',
    raw_content: '',
    url: ''
  });

  // --- Sub-tab 2: Q&A Pairs State ---
  const [qaPairs, setQAPairs] = useState<QAPair[]>([]);
  const [showAddQA, setShowAddQA] = useState(false);
  const [editingQAId, setEditingQAId] = useState<string | null>(null);
  const [qaForm, setQAForm] = useState({
    question: '',
    answer: '',
    category: '',
    tags: ''
  });
  const [qaEditForm, setQAEditForm] = useState({
    question: '',
    answer: '',
    category: '',
    tags: ''
  });

  // --- Sub-tab 3: RAG Settings State ---
  const [ragConfig, setRagConfig] = useState<RAGConfig>({
    enabled: true,
    retrieval_strategy: 'hybrid',
    top_k: 5,
    similarity_threshold: 0.70,
    chunk_size: 512,
    chunk_overlap: 64,
    citation_mode: 'inline',
    inject_context: true
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // --- Sub-tab 4: Test & Evaluate State ---
  const [testQuery, setTestQuery] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // --- Sub-tab 5: Analytics State ---
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // --- Initial Data Load ---
  useEffect(() => {
    loadTabSpecificData();
  }, [activeSubTab]);

  const loadTabSpecificData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'sources') {
        const res = await api.get<{ data: KnowledgeSource[] }>('/ai/knowledge/sources');
        setSources(res.data || []);
      } else if (activeSubTab === 'qa') {
        const res = await api.get<{ data: QAPair[] }>('/ai/knowledge/qa');
        setQAPairs(res.data || []);
      } else if (activeSubTab === 'rag') {
        const res = await api.get<{ data: RAGConfig }>('/ai/rag/config');
        if (res.data) {
          setRagConfig(res.data);
        }
      } else if (activeSubTab === 'analytics') {
        const res = await api.get<{ data: AnalyticsData }>('/ai/rag/analytics');
        if (res.data) {
          setAnalytics(res.data);
        }
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || 'Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Knowledge Source Functions ---
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceForm.name.trim()) {
      showAlert('Source Name is required', 'error');
      return;
    }
    if (sourceForm.source_type === 'manual' && !sourceForm.raw_content.trim()) {
      showAlert('Content is required for manual text source', 'error');
      return;
    }
    if (sourceForm.source_type === 'url' && !sourceForm.url.trim()) {
      showAlert('URL is required for URL source', 'error');
      return;
    }

    try {
      const payload = {
        name: sourceForm.name,
        source_type: sourceForm.source_type,
        category: sourceForm.category,
        classification: sourceForm.classification,
        tags: sourceForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        raw_content: sourceForm.source_type === 'manual' ? sourceForm.raw_content : undefined,
        url: sourceForm.source_type === 'url' ? sourceForm.url : undefined
      };
      await api.post('/ai/knowledge/sources', payload);
      showAlert('Knowledge source added successfully');
      setShowAddSource(false);
      setSourceForm({
        name: '',
        source_type: 'manual',
        category: '',
        classification: 'unclassified',
        tags: '',
        raw_content: '',
        url: ''
      });
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to create knowledge source', 'error');
    }
  };

  const toggleSourceActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/ai/knowledge/sources/${id}`, { is_active: !currentStatus });
      setSources(sources.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
      showAlert(`Source ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      showAlert(err.message || 'Failed to toggle source status', 'error');
    }
  };

  const handleReprocessSource = async (id: string) => {
    try {
      await api.post(`/ai/knowledge/sources/${id}/reprocess`, {});
      showAlert('Reprocessing request dispatched successfully');
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to dispatch reprocess request', 'error');
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this knowledge source and all its chunks?')) return;
    try {
      await api.delete(`/ai/knowledge/sources/${id}`);
      showAlert('Knowledge source deleted successfully');
      setSources(sources.filter(s => s.id !== id));
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete knowledge source', 'error');
    }
  };

  const handleSyncKB = async () => {
    setSyncingKB(true);
    try {
      await api.post('/ai/knowledge/kb-sync', {});
      showAlert('Sync initiated. KB articles are being ingested securely.');
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to initiate KB sync', 'error');
    } finally {
      setSyncingKB(false);
    }
  };

  const handleSyncTickets = async () => {
    setSyncingTickets(true);
    try {
      const res = await api.post<{ data: { synced: number; message: string } }>('/ai/knowledge/ticket-sync', {});
      showAlert(res.data?.message || 'Ticket sync initiated successfully.');
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to initiate ticket sync', 'error');
    } finally {
      setSyncingTickets(false);
    }
  };

  const loadChunksForSource = async (sourceId: string) => {
    if (expandedSourceId === sourceId) {
      setExpandedSourceId(null);
      return;
    }
    setExpandedSourceId(sourceId);
    if (sourceChunks[sourceId]) return;

    setLoadingChunks(prev => ({ ...prev, [sourceId]: true }));
    try {
      const res = await api.get<{ data: Chunk[] }>(`/ai/knowledge/sources/${sourceId}/chunks`);
      setSourceChunks(prev => ({ ...prev, [sourceId]: res.data || [] }));
    } catch (err: any) {
      console.error(err);
      showAlert('Failed to fetch chunks for this source', 'error');
    } finally {
      setLoadingChunks(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  // --- Q&A Pair Functions ---
  const handleAddQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaForm.question.trim() || !qaForm.answer.trim()) {
      showAlert('Question and Answer are both required', 'error');
      return;
    }
    try {
      const payload = {
        question: qaForm.question,
        answer: qaForm.answer,
        category: qaForm.category,
        tags: qaForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      };
      await api.post('/ai/knowledge/qa', payload);
      showAlert('Q&A pair created successfully');
      setShowAddQA(false);
      setQAForm({ question: '', answer: '', category: '', tags: '' });
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to create Q&A pair', 'error');
    }
  };

  const handleStartEditQA = (qa: QAPair) => {
    setEditingQAId(qa.id);
    setQAEditForm({
      question: qa.question,
      answer: qa.answer,
      category: qa.category || '',
      tags: (qa.tags || []).join(', ')
    });
  };

  const handleSaveEditQA = async (id: string) => {
    if (!qaEditForm.question.trim() || !qaEditForm.answer.trim()) {
      showAlert('Question and Answer are required', 'error');
      return;
    }
    try {
      const payload = {
        question: qaEditForm.question,
        answer: qaEditForm.answer,
        category: qaEditForm.category,
        tags: qaEditForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      };
      await api.patch(`/ai/knowledge/qa/${id}`, payload);
      showAlert('Q&A pair updated successfully');
      setEditingQAId(null);
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to update Q&A pair', 'error');
    }
  };

  const toggleQAActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/ai/knowledge/qa/${id}`, { is_active: !currentStatus });
      setQAPairs(qaPairs.map(qa => qa.id === id ? { ...qa, is_active: !currentStatus } : qa));
      showAlert(`Q&A pair ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      showAlert(err.message || 'Failed to toggle Q&A pair status', 'error');
    }
  };

  const handleDeleteQA = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this Q&A pair?')) return;
    try {
      await api.delete(`/ai/knowledge/qa/${id}`);
      showAlert('Q&A pair deleted successfully');
      setQAPairs(qaPairs.filter(qa => qa.id !== id));
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete Q&A pair', 'error');
    }
  };

  // --- RAG Configuration Functions ---
  const handleSaveRAGConfig = async () => {
    setSavingConfig(true);
    try {
      await api.put('/ai/rag/config', ragConfig);
      showAlert('Retrieval configuration saved successfully');
    } catch (err: any) {
      showAlert(err.message || 'Failed to save retrieval configuration', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // --- Test & Evaluate Functions ---
  const handleRunTest = async () => {
    if (!testQuery.trim()) {
      showAlert('Please enter a query to test', 'error');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ data: TestResult }>('/ai/rag/test', { query: testQuery });
      setTestResult(res.data);
      showAlert('Test query executed successfully');
    } catch (err: any) {
      showAlert(err.message || 'Failed to test retrieval strategy', 'error');
    } finally {
      setTesting(false);
    }
  };

  // --- Analytics Flagging ---
  const handleFlagQuery = async (id: string) => {
    try {
      await api.patch(`/ai/rag/queries/${id}/flag`, {});
      showAlert('Query flagged for review');
      if (analytics) {
        setAnalytics({
          ...analytics,
          recent_queries: analytics.recent_queries.map(q => q.id === id ? { ...q, flagged_for_review: true } : q),
          summary: {
            ...analytics.summary,
            flagged_count: analytics.summary.flagged_count + 1
          }
        });
      }
    } catch (err: any) {
      showAlert(err.message || 'Failed to flag query', 'error');
    }
  };

  // --- Helper Color Mappings ---
  const getClassificationStyles = (classification: string) => {
    const map: Record<string, { bg: string, text: string, border: string }> = {
      unclassified: { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: 'var(--border)' },
      sensitive: { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning-border)' },
      confidential: { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316', border: 'rgba(249, 115, 22, 0.2)' },
      secret: { bg: 'var(--danger-bg)', text: 'var(--danger)', border: 'var(--danger-border)' },
    };
    return map[classification.toLowerCase()] || map.unclassified;
  };

  const getStatusStyles = (status: string) => {
    const map: Record<string, { bg: string, text: string, border: string }> = {
      pending: { bg: 'var(--bg-tertiary)', text: 'var(--text-muted)', border: 'var(--border)' },
      processing: { bg: 'var(--accent-subtle)', text: 'var(--accent)', border: 'var(--accent-border)' },
      ready: { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success-border)' },
      error: { bg: 'var(--danger-bg)', text: 'var(--danger)', border: 'var(--danger-border)' },
    };
    return map[status.toLowerCase()] || map.pending;
  };

  const getSourceTypeStyles = (type: string) => {
    const map: Record<string, { bg: string, text: string, border: string }> = {
      file: { bg: 'rgba(147, 51, 234, 0.1)', text: '#9333ea', border: 'rgba(147, 51, 234, 0.2)' },
      url: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' },
      manual: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.2)' },
      kb_sync: { bg: 'rgba(79, 70, 229, 0.1)', text: '#4f46e5', border: 'rgba(79, 70, 229, 0.2)' },
      ticket_sync: { bg: 'rgba(234, 88, 12, 0.1)', text: '#ea580c', border: 'rgba(234, 88, 12, 0.2)' },
    };
    return map[type.toLowerCase()] || map.manual;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Secondary Sub-tab Navigation */}
      <div style={{
        display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)',
        paddingBottom: '8px', marginBottom: '8px', overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveSubTab('sources')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, background: 'transparent', border: 'none',
            color: activeSubTab === 'sources' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'sources' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: '10px', marginBottom: '-10px'
          }}
        >
          <Upload size={14} />
          Knowledge Sources
        </button>
        <button
          onClick={() => setActiveSubTab('qa')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, background: 'transparent', border: 'none',
            color: activeSubTab === 'qa' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'qa' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: '10px', marginBottom: '-10px'
          }}
        >
          <MessageSquare size={14} />
          Q&A Pairs
        </button>
        <button
          onClick={() => setActiveSubTab('rag')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, background: 'transparent', border: 'none',
            color: activeSubTab === 'rag' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'rag' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: '10px', marginBottom: '-10px'
          }}
        >
          <Settings size={14} />
          RAG Settings
        </button>
        <button
          onClick={() => setActiveSubTab('test')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, background: 'transparent', border: 'none',
            color: activeSubTab === 'test' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'test' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: '10px', marginBottom: '-10px'
          }}
        >
          <FlaskConical size={14} />
          Test & Evaluate
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, background: 'transparent', border: 'none',
            color: activeSubTab === 'analytics' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'analytics' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: '10px', marginBottom: '-10px'
          }}
        >
          <BarChart3 size={14} />
          Analytics
        </button>
      </div>

      {/* SUB-TAB 1: KNOWLEDGE SOURCES */}
      {activeSubTab === 'sources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Knowledge Sources</h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                Upload documents, paste text, or fetch URLs to build the AI's knowledge base
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                disabled={syncingKB}
                onClick={handleSyncKB}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: '13px', fontWeight: 600,
                  cursor: syncingKB ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <RefreshCw size={14} className={syncingKB ? 'animate-spin' : ''} />
                {syncingKB ? 'Syncing...' : 'Sync KB Articles'}
              </button>
              <button
                disabled={syncingTickets}
                onClick={handleSyncTickets}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: '13px', fontWeight: 600,
                  cursor: syncingTickets ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <RefreshCw size={14} className={syncingTickets ? 'animate-spin' : ''} />
                {syncingTickets ? 'Syncing...' : 'Sync Resolved Tickets'}
              </button>
              <button
                onClick={() => setShowAddSource(!showAddSource)}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {showAddSource ? <X size={14} /> : <Plus size={14} />}
                {showAddSource ? 'Cancel' : 'Add Source'}
              </button>
            </div>
          </div>

          {/* Government Classification Banner */}
          <div style={{
            display: 'flex', gap: '12px', padding: '12px 16px', background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', alignItems: 'center'
          }}>
            <Shield size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
              <strong>Government Compliance:</strong> All documents are processed and stored securely. Classify documents appropriately before ingestion.
            </span>
          </div>

          {/* Add Source Inline Form */}
          {showAddSource && (
            <form onSubmit={handleAddSource} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                Ingest New Knowledge Source
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Source Type</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSourceForm({ ...sourceForm, source_type: 'manual' })}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
                        border: sourceForm.source_type === 'manual' ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: sourceForm.source_type === 'manual' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                        color: sourceForm.source_type === 'manual' ? 'var(--accent)' : 'var(--text)', cursor: 'pointer'
                      }}
                    >
                      <FileText size={12} style={{ display: 'inline', marginRight: '6px' }} />
                      Manual Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceForm({ ...sourceForm, source_type: 'url' })}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
                        border: sourceForm.source_type === 'url' ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: sourceForm.source_type === 'url' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                        color: sourceForm.source_type === 'url' ? 'var(--accent)' : 'var(--text)', cursor: 'pointer'
                      }}
                    >
                      <Link size={12} style={{ display: 'inline', marginRight: '6px' }} />
                      Paste URL
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Source Name *</label>
                  <input
                    className="input"
                    value={sourceForm.name}
                    onChange={e => setSourceForm({ ...sourceForm, name: e.target.value })}
                    placeholder="e.g. IT Procurement SOP"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Category</label>
                  <input
                    className="input"
                    value={sourceForm.category}
                    onChange={e => setSourceForm({ ...sourceForm, category: e.target.value })}
                    placeholder="e.g. IT Procedures, HR Policy"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Classification Level</label>
                  <select
                    className="input"
                    value={sourceForm.classification}
                    onChange={e => setSourceForm({ ...sourceForm, classification: e.target.value as any })}
                    style={{ appearance: 'none', WebkitAppearance: 'none' }}
                  >
                    <option value="unclassified">🟢 Unclassified</option>
                    <option value="sensitive">🟡 Sensitive</option>
                    <option value="confidential">🟠 Confidential</option>
                    <option value="secret">🔴 Secret</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Tags (comma-separated)</label>
                  <input
                    className="input"
                    value={sourceForm.tags}
                    onChange={e => setSourceForm({ ...sourceForm, tags: e.target.value })}
                    placeholder="e.g. onboarding, internal"
                  />
                </div>
              </div>

              {sourceForm.source_type === 'manual' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Document Content *</label>
                  <textarea
                    className="input"
                    value={sourceForm.raw_content}
                    onChange={e => setSourceForm({ ...sourceForm, raw_content: e.target.value })}
                    placeholder="Paste full text knowledge content here..."
                    rows={6}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                    required
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Target URL *</label>
                  <input
                    className="input"
                    value={sourceForm.url}
                    onChange={e => setSourceForm({ ...sourceForm, url: e.target.value })}
                    placeholder="https://agency.gov/manual/index.html"
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSource(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Submit Ingestion
                </button>
              </div>
            </form>
          )}

          {/* Sources List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Ingested Sources & Status</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sources.length} total sources active</span>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                Loading sources database...
              </div>
            ) : sources.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No knowledge sources found</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Click "Add Source" or "Sync KB Articles" to populate the AI database.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Source Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Classification</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Chunks</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map(source => {
                      const cStyle = getClassificationStyles(source.classification);
                      const sStyle = getStatusStyles(source.status);
                      const tStyle = getSourceTypeStyles(source.source_type);
                      const isExpanded = expandedSourceId === source.id;

                      return (
                        <tr key={source.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                onClick={() => loadChunksForSource(source.id)}
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center'
                                }}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{source.name}</div>
                                {source.url && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{source.url}</div>}
                              </div>
                            </div>

                            {/* Collapsible Chunk Viewer */}
                            {isExpanded && (
                              <div style={{ marginTop: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
                                  Ingested Vector Chunks
                                </div>
                                {loadingChunks[source.id] ? (
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <RefreshCw size={12} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                                    Retrieving chunks from vector database...
                                  </div>
                                ) : !sourceChunks[source.id] || sourceChunks[source.id].length === 0 ? (
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No chunks generated yet. Try reprocessing this document.</div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {sourceChunks[source.id].map((chunk, index) => (
                                      <div key={chunk.id} style={{ background: 'var(--card)', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                                          <span>Chunk #{index + 1} (Index: {chunk.chunk_index})</span>
                                          {chunk.content_tokens && <span>Tokens: {chunk.content_tokens}</span>}
                                        </div>
                                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text)', fontFamily: 'monospace' }}>{chunk.content}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{source.category || 'N/A'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
                              background: tStyle.bg, color: tStyle.text, border: `1px solid ${tStyle.border}`, textTransform: 'uppercase'
                            }}>
                              {source.source_type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
                              background: cStyle.bg, color: cStyle.text, border: `1px solid ${cStyle.border}`, textTransform: 'uppercase'
                            }}>
                              {source.classification}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
                              background: sStyle.bg, color: sStyle.text, border: `1px solid ${sStyle.border}`, textTransform: 'capitalize',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}>
                              {source.status === 'processing' && <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%' }} className="animate-pulse" />}
                              {source.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{source.chunk_count || 0}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {/* Active/Inactive Toggle */}
                              <div
                                onClick={() => toggleSourceActive(source.id, source.is_active)}
                                style={{
                                  width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
                                  background: source.is_active ? 'var(--success)' : 'var(--bg-tertiary)',
                                  border: `1px solid ${source.is_active ? 'var(--success)' : 'var(--border)'}`,
                                  position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
                                }}
                                title={source.is_active ? 'Deactivate Source' : 'Activate Source'}
                              >
                                <div style={{
                                  position: 'absolute', top: 1,
                                  left: source.is_active ? 15 : 1,
                                  width: 14, height: 14, borderRadius: '50%',
                                  background: source.is_active ? 'white' : 'var(--text-muted)',
                                  transition: 'left 0.2s ease'
                                }} />
                              </div>

                              {/* Reprocess */}
                              <button
                                onClick={() => handleReprocessSource(source.id)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                title="Reprocess & Re-chunk Source"
                              >
                                <RefreshCw size={14} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteSource(source.id)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                                title="Delete Knowledge Source"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Q&A PAIRS */}
      {activeSubTab === 'qa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Q&A Pairs</h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                Author precise question-answer pairs for high-confidence responses on critical topics
              </p>
            </div>
            <button
              onClick={() => setShowAddQA(!showAddQA)}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddQA(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Save QA Pair
                </button>
              </div>
            </form>
          )}

          {/* Q&A List */}
          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                Loading QA registry...
              </div>
            ) : qaPairs.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No custom Q&A pairs recorded</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Create precise question-and-answer pairs to override automated RAG on critical topics.</p>
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

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
      )}

      {/* SUB-TAB 3: RAG SETTINGS */}
      {activeSubTab === 'rag' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Retrieval Configuration</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
              Configure how document-based retrieval integrates context safely with the large language models
            </p>
          </div>

          <div style={{
            display: 'flex', gap: '12px', padding: '12px 16px', background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', alignItems: 'center'
          }}>
            <Shield size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
              <strong>Government Compliance:</strong> These settings control how the AI retrieves and uses your knowledge base. Hybrid retrieval is recommended for government use.
            </span>
          </div>

          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Global Enable RAG */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div
                onClick={() => setRagConfig({ ...ragConfig, enabled: !ragConfig.enabled })}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                  background: ragConfig.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: `1px solid ${ragConfig.enabled ? 'var(--accent)' : 'var(--border)'}`,
                  position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
                }}
              >
                <div style={{
                  position: 'absolute', top: 2,
                  left: ragConfig.enabled ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: ragConfig.enabled ? 'white' : 'var(--text-muted)',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable retrieval augmented generation (RAG)</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>When disabled, the AI will answer queries using its default pre-trained model knowledge.</div>
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
                      min="0.50"
                      max="0.99"
                      step="0.01"
                      value={ragConfig.similarity_threshold}
                      onChange={e => setRagConfig({ ...ragConfig, similarity_threshold: parseFloat(e.target.value) })}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ignore retrieved vectors with scores lower than this percentage.</span>
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
      )}

      {/* SUB-TAB 4: TEST & EVALUATE */}
      {activeSubTab === 'test' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Test Retrieval</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
              Test your knowledge base retrieval and review matching vector chunks before going live
            </p>
          </div>

          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700,
                    cursor: testing ? 'not-allowed' : 'pointer', alignSelf: 'stretch', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {testing ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                  Run Test
                </button>
              </div>
            </div>
          </div>

          {testing && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
              <div style={{ fontWeight: 600 }}>Querying Knowledge Model...</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Executing vector similarity search and compiling response.</div>
            </div>
          )}

          {!testing && !testResult && (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }} className="card">
              <FlaskConical size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Retrieval sandbox is empty</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Type a query in the test prompt above to run vector matching analysis.</p>
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
      )}

      {/* SUB-TAB 5: ANALYTICS */}
      {activeSubTab === 'analytics' && !analytics && !loading && (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }} className="card">
          <BarChart3 size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No analytics data available</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Analytics will populate once the AI assistant begins processing queries.</p>
        </div>
      )}
      {activeSubTab === 'analytics' && analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Retrieval & Generation Analytics</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
              Monitor model query hits, vector matching confidence, and flag anomalies for manual remediation
            </p>
          </div>

          {/* Core KPI metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>TOTAL RAG QUERIES</span>
                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={16} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
                {analytics.summary.total_queries}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>AVG CONFIDENCE SCORE</span>
                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
                {(analytics.summary.avg_confidence * 100).toFixed(1)}%
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>FLAGGED FOR REVIEW</span>
                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Flag size={16} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
                {analytics.summary.flagged_count}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>ACTIVE SOURCES</span>
                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
                {analytics.summary.active_sources}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Daily Volume Bar Chart */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Daily Retrieval Volume (Last 7 Days)</h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '200px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                {analytics.daily_volume.map((d, index) => {
                  const maxCount = Math.max(...analytics.daily_volume.map(day => day.count));
                  const percentageHeight = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                  return (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>{d.count}</span>
                      <div
                        style={{
                          width: '70%',
                          height: `${percentageHeight * 1.4}px`, // scale height comfortably
                          maxHeight: '150px',
                          background: 'linear-gradient(to top, var(--accent) 70%, var(--accent-border))',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px'
                        }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{d.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source Usage Matrix */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Source Retrieval Density</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Source Document</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Query Hits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.source_stats.map((src, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{src.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{src.category} • {src.chunk_count} chunks</div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                          {src.query_hits}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Queries / Flagged Area */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Recent Model Inquiries</h4>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Live query logging pipeline</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {analytics.recent_queries.map((q) => {
                const conf = Math.round((q.confidence_score || 0) * 100) / 100;
                const confColor = conf > 85 ? 'var(--success)' : conf > 70 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <div key={q.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        "{q.query}"
                      </p>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>User: {q.user_name || 'Unknown'}</span>
                        <span>•</span>
                        <span>{new Date(q.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>CONFIDENCE</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: confColor }}>{conf.toFixed(1)}%</div>
                      </div>

                      <button
                        disabled={q.flagged_for_review}
                        onClick={() => handleFlagQuery(q.id)}
                        style={{
                          padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)',
                          background: q.flagged_for_review ? 'var(--danger-bg)' : 'transparent',
                          color: q.flagged_for_review ? 'var(--danger)' : 'var(--text-secondary)',
                          fontSize: '11px', fontWeight: 600, cursor: q.flagged_for_review ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Flag size={12} />
                        {q.flagged_for_review ? 'Flagged' : 'Flag Query'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
