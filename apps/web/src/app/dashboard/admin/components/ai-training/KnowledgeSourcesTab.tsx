'use client';

import { useState } from 'react';
import {
  Upload, Link, FileText, Plus, Trash2, RefreshCw,
  ChevronDown, ChevronUp, X, Search, BookOpen, Edit3
} from 'lucide-react';
import type { KnowledgeSource, Chunk } from './types';
import {
  getClassificationStyles, getStatusStyles, getSourceTypeStyles
} from './helpers';

interface SourceFormData {
  name: string;
  source_type: 'manual' | 'url' | 'file';
  category: string;
  classification: 'unclassified' | 'sensitive' | 'confidential' | 'secret';
  tags: string;
  raw_content: string;
  url: string;
  scope: 'both' | 'agent' | 'portal';
}

interface KnowledgeSourcesTabProps {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  loading: boolean;
  sources: KnowledgeSource[];
  showAddSource: boolean;
  editingSource: KnowledgeSource | null;
  expandedSourceId: string | null;
  sourceChunks: Record<string, Chunk[]>;
  loadingChunks: Record<string, boolean>;
  syncingKB: boolean;
  syncingTickets: boolean;
  sourceForm: SourceFormData;
  selectedFile: File | null;
  uploading: boolean;
  selectedSources: Set<string>;
  setSelectedSources: React.Dispatch<React.SetStateAction<Set<string>>>;
  sourceSearch: string;
  setShowAddSource: (v: boolean) => void;
  setSourceForm: React.Dispatch<React.SetStateAction<SourceFormData>>;
  setSelectedFile: (f: File | null) => void;
  setSourceSearch: (s: string) => void;
  handleAddSource: (e: React.FormEvent) => Promise<void>;
  handleStartEditSource: (source: KnowledgeSource) => void;
  handleCancelEditSource: () => void;
  toggleSourceActive: (id: string, currentStatus: boolean) => Promise<void>;
  handleReprocessSource: (id: string) => Promise<void>;
  handleDeleteSource: (id: string) => Promise<void>;
  handleBulkDeleteSources: () => Promise<void>;
  handleBulkReprocessSources: () => Promise<void>;
  handleBulkToggleSources: (activate: boolean) => Promise<void>;
  loadChunksForSource: (sourceId: string) => Promise<void>;
  handleSyncKB: () => Promise<void>;
  handleSyncTickets: () => Promise<void>;
}

export function KnowledgeSourcesTab(props: KnowledgeSourcesTabProps) {
  const {
    showAlert, loading, sources, showAddSource, editingSource,
    expandedSourceId, sourceChunks, loadingChunks, syncingKB, syncingTickets,
    sourceForm, selectedFile, uploading, selectedSources, setSelectedSources,
    sourceSearch, setShowAddSource, setSourceForm, setSelectedFile, setSourceSearch,
    handleAddSource, handleStartEditSource, handleCancelEditSource,
    toggleSourceActive, handleReprocessSource, handleDeleteSource,
    handleBulkDeleteSources, handleBulkReprocessSources, handleBulkToggleSources,
    loadChunksForSource, handleSyncKB, handleSyncTickets
  } = props;

  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
    s.category?.toLowerCase().includes(sourceSearch.toLowerCase()) ||
    s.source_type.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const toggleSourceSelection = (id: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSources = () => {
    if (selectedSources.size === filteredSources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(filteredSources.map(s => s.id)));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
        padding: '20px 24px', background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--bg) 100%)',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-border)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} />
            </div>
            Knowledge Base
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
            Build the AI's knowledge foundation — upload documents, paste text, or sync from your help center and resolved tickets
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            disabled={syncingKB}
            onClick={handleSyncKB}
            style={{
              padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', fontWeight: 600,
              cursor: syncingKB ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              opacity: syncingKB ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} className={syncingKB ? 'animate-spin' : ''} />
            {syncingKB ? 'Syncing...' : 'Sync KB'}
          </button>
          <button
            disabled={syncingTickets}
            onClick={handleSyncTickets}
            style={{
              padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', fontWeight: 600,
              cursor: syncingTickets ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              opacity: syncingTickets ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} className={syncingTickets ? 'animate-spin' : ''} />
            {syncingTickets ? 'Syncing...' : 'Sync Tickets'}
          </button>
          <button
            onClick={() => setShowAddSource(!showAddSource)}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.25)'
            }}
          >
            {showAddSource ? <X size={14} /> : <Plus size={14} />}
            {showAddSource ? 'Cancel' : 'Add Source'}
          </button>
        </div>
      </div>

      {/* Add Source Inline Form */}
      {showAddSource && (
        <form onSubmit={handleAddSource} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{editingSource ? 'Edit Knowledge Source' : 'Ingest New Knowledge Source'}</span>
            {editingSource && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>Editing: {editingSource.name}</span>}
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
                <button
                  type="button"
                  onClick={() => setSourceForm({ ...sourceForm, source_type: 'file' })}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
                    border: sourceForm.source_type === 'file' ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: sourceForm.source_type === 'file' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                    color: sourceForm.source_type === 'file' ? 'var(--accent)' : 'var(--text)', cursor: 'pointer'
                  }}
                >
                  <Upload size={12} style={{ display: 'inline', marginRight: '6px' }} />
                  Upload File
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>AI Availability</label>
              <select
                className="input"
                value={sourceForm.scope}
                onChange={e => setSourceForm({ ...sourceForm, scope: e.target.value as any })}
                style={{ appearance: 'none', WebkitAppearance: 'none' }}
              >
                <option value="both">🔄 Both Agent &amp; Portal AI</option>
                <option value="agent">🤖 Agent AI Only</option>
                <option value="portal">🌐 Portal AI Only</option>
              </select>
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
                rows={18}
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px', minHeight: '300px' }}
                required
              />
            </div>
          ) : sourceForm.source_type === 'file' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Upload File *</label>
              <div style={{
                border: `2px dashed ${selectedFile ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', padding: '32px', textAlign: 'center',
                background: selectedFile ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <Upload size={28} style={{ color: selectedFile ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '8px' }} />
                {selectedFile ? (
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB &middot; Click or drop to replace
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>Drop a file here, or click to browse</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      PDF, Excel (.xlsx/.xls), CSV, JSON, HTML, Text (.txt/.md) &mdash; max 25MB
                    </div>
                  </div>
                )}
              </div>
              <input
                id="file-upload-input"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.json,.html,.htm"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
              />
              {sourceForm.name && !sourceForm.name.trim() && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Source name defaults to the filename if left blank
                </span>
              )}
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
              onClick={editingSource ? handleCancelEditSource : () => setShowAddSource(false)}
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
              disabled={uploading}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                background: uploading ? 'var(--text-muted)' : 'var(--accent)',
                color: '#fff', fontSize: '13px', fontWeight: 600, cursor: uploading ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (!uploading) { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (!uploading) { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              {uploading ? 'Uploading...' : (sourceForm.source_type === 'file' ? 'Upload & Ingest' : (editingSource ? 'Save Changes' : 'Submit Ingestion'))}
            </button>
          </div>
        </form>
      )}

      {/* Sources List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Ingested Sources</span>
            <span style={{
              padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
              background: 'var(--accent-subtle)', color: 'var(--accent)'
            }}>
              {sources.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                value={sourceSearch}
                onChange={e => setSourceSearch(e.target.value)}
                placeholder="Search sources..."
                style={{ paddingLeft: '32px', width: '180px', height: '32px', fontSize: '12px' }}
              />
            </div>
            {selectedSources.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>{selectedSources.size} selected</span>
                <button onClick={() => handleBulkToggleSources(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--success)', fontSize: '12px', fontWeight: 600, padding: '2px 4px', transition: 'all 0.15s ease' }} title="Activate"
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >Enable</button>
                <button onClick={() => handleBulkToggleSources(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--warning)', fontSize: '12px', fontWeight: 600, padding: '2px 4px', transition: 'all 0.15s ease' }} title="Deactivate"
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >Disable</button>
                <button onClick={handleBulkReprocessSources} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, padding: '2px 4px', transition: 'all 0.15s ease' }} title="Reprocess"
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >Reprocess</button>
                <button onClick={handleBulkDeleteSources} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '12px', fontWeight: 600, padding: '2px 4px', transition: 'all 0.15s ease' }} title="Delete"
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >Delete</button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading knowledge sources...</div>
          </div>
        ) : sources.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FileText size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>No knowledge sources yet</p>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              Start by adding a knowledge source, syncing KB articles, or importing resolved tickets
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedSources.size === filteredSources.length && filteredSources.length > 0}
                      onChange={toggleAllSources}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Source Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Classification</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Scope</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Chunks</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map(source => {
                  const cStyle = getClassificationStyles(source.classification);
                  const sStyle = getStatusStyles(source.status);
                  const tStyle = getSourceTypeStyles(source.source_type);
                  const isExpanded = expandedSourceId === source.id;
                  const isSelected = selectedSources.has(source.id);

                  return (
                    <tr key={source.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'middle', background: isSelected ? 'var(--accent-subtle)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSourceSelection(source.id)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => loadChunksForSource(source.id)}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.transform = 'scale(1)'; }}
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
                        {source.scope && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
                            background: source.scope === 'portal' ? 'rgba(16,185,129,0.1)' : source.scope === 'agent' ? 'rgba(37,99,235,0.1)' : 'var(--bg-tertiary)',
                            color: source.scope === 'portal' ? '#10b981' : source.scope === 'agent' ? '#2563eb' : 'var(--text-secondary)',
                            border: `1px solid ${source.scope === 'portal' ? 'rgba(16,185,129,0.3)' : source.scope === 'agent' ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`
                          }}>
                            {source.scope === 'portal' ? '🌐 Portal' : source.scope === 'agent' ? '🤖 Agent' : '🔄 Both'}
                          </span>
                        )}
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

                          {/* Edit */}
                          <button
                            onClick={() => handleStartEditSource(source)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s ease' }}
                            title="Edit Source"
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <Edit3 size={14} />
                          </button>

                          {/* Reprocess */}
                          <button
                            onClick={() => handleReprocessSource(source.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s ease' }}
                            title="Reprocess & Re-chunk Source"
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <RefreshCw size={14} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteSource(source.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', transition: 'all 0.15s ease' }}
                            title="Delete Knowledge Source"
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.borderRadius = 'var(--radius-sm)'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
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
  );
}
