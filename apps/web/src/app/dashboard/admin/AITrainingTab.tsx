'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Upload, MessageSquare, Settings, FlaskConical, BarChart3
} from 'lucide-react';
import type {
  KnowledgeSource, Chunk, QAPair, RAGConfig, TestResult, AnalyticsData
} from './components/ai-training/types';
import {
  KnowledgeSourcesTab, QAPairsTab, RAGSettingsTab, TestEvaluateTab, AnalyticsTab
} from './components/ai-training';

export function AITrainingTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'sources' | 'qa' | 'rag' | 'test' | 'analytics'>(() => {
    try { return (localStorage.getItem('resolv_ai_training_subtab') as 'sources' | 'qa' | 'rag' | 'test' | 'analytics') || 'sources' } catch { return 'sources' }
  });

  useEffect(() => { localStorage.setItem('resolv_ai_training_subtab', activeSubTab) }, [activeSubTab]);
  const [loading, setLoading] = useState(false);

  // --- Sub-tab 1: Sources State ---
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [sourceChunks, setSourceChunks] = useState<Record<string, Chunk[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<Record<string, boolean>>({});
  const [syncingKB, setSyncingKB] = useState(false);
  const [syncingTickets, setSyncingTickets] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    source_type: 'manual' as 'manual' | 'url' | 'file',
    category: '',
    classification: 'unclassified' as 'unclassified' | 'sensitive' | 'confidential' | 'secret',
    tags: '',
    raw_content: '',
    url: '',
    scope: 'both' as 'both' | 'agent' | 'portal'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourceSearch, setSourceSearch] = useState('');

  // --- Sub-tab 2: Q&A Pairs State ---
  const [qaPairs, setQAPairs] = useState<QAPair[]>([]);
  const [showAddQA, setShowAddQA] = useState(false);
  const [editingQAId, setEditingQAId] = useState<string | null>(null);
  const [qaForm, setQAForm] = useState({
    question: '',
    answer: '',
    category: '',
    tags: '',
    scope: 'both'
  });
  const [qaEditForm, setQAEditForm] = useState({
    question: '',
    answer: '',
    category: '',
    tags: '',
    scope: 'both'
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
    inject_context: true,
    semantic_weight: 0.6
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
          setRagConfig(prev => ({ ...prev, ...res.data }));
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

    if (sourceForm.source_type === 'file') {
      // File upload path — uses multipart endpoint
      if (!selectedFile) {
        showAlert('Please select a file to upload', 'error');
        return;
      }
      const allowedExts = ['.pdf', '.xlsx', '.xls', '.csv', '.txt', '.md', '.json', '.html', '.htm'];
      const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
      if (!allowedExts.includes(ext)) {
        showAlert(`Unsupported file type: ${ext}. Allowed: ${allowedExts.join(', ')}`, 'error');
        return;
      }

      setUploading(true);
      try {
        const token = localStorage.getItem('resolv_token');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('name', sourceForm.name.trim());
        if (sourceForm.category) formData.append('category', sourceForm.category);
        if (sourceForm.tags.trim()) formData.append('tags', sourceForm.tags);
        if (sourceForm.classification) formData.append('classification', sourceForm.classification);
        if (sourceForm.scope) formData.append('scope', sourceForm.scope);

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${baseUrl}/ai/knowledge/sources/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(err.error || `Upload failed (${res.status})`);
        }
        showAlert('File uploaded and processing started');
      } catch (err: any) {
        showAlert(err.message || 'Failed to upload file', 'error');
        setUploading(false);
        return;
      }
      setUploading(false);
      setSelectedFile(null);
      setShowAddSource(false);
      setSourceForm({
        name: '', source_type: 'manual', category: '',
        classification: 'unclassified', tags: '', raw_content: '', url: '',
        scope: 'both'
      });
      loadTabSpecificData();
      return;
    }

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
        tags: sourceForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        scope: sourceForm.scope,
        raw_content: sourceForm.source_type === 'manual' ? sourceForm.raw_content : undefined,
        url: sourceForm.source_type === 'url' ? sourceForm.url : undefined
      };

      if (editingSource) {
        // Update existing source
        await api.patch(`/ai/knowledge/sources/${editingSource.id}`, payload);
        showAlert('Knowledge source updated');
        setEditingSource(null);
      } else {
        // Create new source
        await api.post('/ai/knowledge/sources', payload);
        showAlert('Knowledge source added successfully');
        setShowAddSource(false);
      }

      setSourceForm({
        name: '',
        source_type: 'manual',
        category: '',
        classification: 'unclassified',
        tags: '',
        raw_content: '',
        url: '',
        scope: 'both'
      });
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to save knowledge source', 'error');
    }
  };

  const handleStartEditSource = (source: KnowledgeSource) => {
    setSourceForm({
      name: source.name,
      source_type: source.source_type === 'url' ? 'url' : 'manual',
      category: source.category || '',
      classification: source.classification,
      tags: (source.tags || []).join(', '),
      raw_content: source.raw_content || '',
      url: source.url || '',
      scope: (source.scope || 'both') as 'both' | 'agent' | 'portal'
    });
    setEditingSource(source);
    setShowAddSource(true);
  };

  const handleCancelEditSource = () => {
    setEditingSource(null);
    setSelectedFile(null);
    setSourceForm({
      name: '',
      source_type: 'manual',
      category: '',
      classification: 'unclassified',
      tags: '',
      raw_content: '',
      url: '',
      scope: 'both'
    });
    setShowAddSource(false);
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

  const handleBulkDeleteSources = async () => {
    if (selectedSources.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedSources.size} knowledge source(s)?`)) return;
    try {
      await Promise.all([...selectedSources].map(id => api.delete(`/ai/knowledge/sources/${id}`)));
      showAlert(`${selectedSources.size} knowledge sources deleted`);
      setSources(sources.filter(s => !selectedSources.has(s.id)));
      setSelectedSources(new Set());
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete sources', 'error');
    }
  };

  const handleBulkReprocessSources = async () => {
    if (selectedSources.size === 0) return;
    try {
      await Promise.all([...selectedSources].map(id => api.post(`/ai/knowledge/sources/${id}/reprocess`, {})));
      showAlert(`Reprocess initiated for ${selectedSources.size} source(s)`);
      setSelectedSources(new Set());
      loadTabSpecificData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to reprocess sources', 'error');
    }
  };

  const handleBulkToggleSources = async (activate: boolean) => {
    if (selectedSources.size === 0) return;
    try {
      await Promise.all([...selectedSources].map(id => api.patch(`/ai/knowledge/sources/${id}`, { is_active: activate })));
      showAlert(`${selectedSources.size} source(s) ${activate ? 'activated' : 'deactivated'}`);
      setSources(sources.map(s => selectedSources.has(s.id) ? { ...s, is_active: activate } : s));
      setSelectedSources(new Set());
    } catch (err: any) {
      showAlert(err.message || 'Failed to update sources', 'error');
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
        tags: qaForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        scope: qaForm.scope
      };
      await api.post('/ai/knowledge/qa', payload);
      showAlert('Q&A pair created successfully');
      setShowAddQA(false);
      setQAForm({ question: '', answer: '', category: '', tags: '', scope: 'both' });
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
      tags: (qa.tags || []).join(', '),
      scope: qa.scope || 'both'
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
        tags: qaEditForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        scope: qaEditForm.scope
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Secondary Sub-tab Navigation */}
      <div style={{
        display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)',
        paddingBottom: '0', marginBottom: '0', overflowX: 'auto', background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', padding: '6px 6px 0 6px'
      }}>
        {[
          { key: 'sources', label: 'Knowledge Sources', icon: Upload },
          { key: 'qa', label: 'Q&A Pairs', icon: MessageSquare },
          { key: 'rag', label: 'RAG Settings', icon: Settings },
          { key: 'test', label: 'Test & Evaluate', icon: FlaskConical },
          { key: 'analytics', label: 'Analytics', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSubTab(key as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
              fontSize: '13px', fontWeight: 600, background: 'transparent', border: 'none',
              color: activeSubTab === key ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeSubTab === key ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              transition: 'all 0.2s ease',
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeSubTab === 'sources' && (
        <KnowledgeSourcesTab
          showAlert={showAlert}
          loading={loading}
          sources={sources}
          showAddSource={showAddSource}
          editingSource={editingSource}
          expandedSourceId={expandedSourceId}
          sourceChunks={sourceChunks}
          loadingChunks={loadingChunks}
          syncingKB={syncingKB}
          syncingTickets={syncingTickets}
          sourceForm={sourceForm}
          selectedFile={selectedFile}
          uploading={uploading}
          selectedSources={selectedSources}
          setSelectedSources={setSelectedSources}
          sourceSearch={sourceSearch}
          setShowAddSource={setShowAddSource}
          setSourceForm={setSourceForm}
          setSelectedFile={setSelectedFile}
          setSourceSearch={setSourceSearch}
          handleAddSource={handleAddSource}
          handleStartEditSource={handleStartEditSource}
          handleCancelEditSource={handleCancelEditSource}
          toggleSourceActive={toggleSourceActive}
          handleReprocessSource={handleReprocessSource}
          handleDeleteSource={handleDeleteSource}
          handleBulkDeleteSources={handleBulkDeleteSources}
          handleBulkReprocessSources={handleBulkReprocessSources}
          handleBulkToggleSources={handleBulkToggleSources}
          loadChunksForSource={loadChunksForSource}
          handleSyncKB={handleSyncKB}
          handleSyncTickets={handleSyncTickets}
        />
      )}

      {activeSubTab === 'qa' && (
        <QAPairsTab
          showAlert={showAlert}
          loading={loading}
          qaPairs={qaPairs}
          showAddQA={showAddQA}
          editingQAId={editingQAId}
          qaForm={qaForm}
          qaEditForm={qaEditForm}
          setShowAddQA={setShowAddQA}
          setQAForm={setQAForm}
          setQAEditForm={setQAEditForm}
          setEditingQAId={setEditingQAId}
          handleAddQA={handleAddQA}
          handleStartEditQA={handleStartEditQA}
          handleSaveEditQA={handleSaveEditQA}
          toggleQAActive={toggleQAActive}
          handleDeleteQA={handleDeleteQA}
        />
      )}

      {activeSubTab === 'rag' && (
        <RAGSettingsTab
          ragConfig={ragConfig}
          savingConfig={savingConfig}
          setRagConfig={setRagConfig}
          handleSaveRAGConfig={handleSaveRAGConfig}
        />
      )}

      {activeSubTab === 'test' && (
        <TestEvaluateTab
          showAlert={showAlert}
          testing={testing}
          testQuery={testQuery}
          testResult={testResult}
          setTestQuery={setTestQuery}
          handleRunTest={handleRunTest}
        />
      )}

      {activeSubTab === 'analytics' && (
        <AnalyticsTab
          analytics={analytics}
          loading={loading}
          handleFlagQuery={handleFlagQuery}
        />
      )}
    </div>
  );
}
