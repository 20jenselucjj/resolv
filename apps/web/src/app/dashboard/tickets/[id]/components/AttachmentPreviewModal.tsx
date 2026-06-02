'use client';
import { useEffect, useState } from 'react';
import { X, Download, FileText, AlertTriangle } from 'lucide-react';
import { formatSize } from './helpers';

interface AttachmentPreviewModalProps {
  attachment: {
    id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    size: number;
    uploader_name: string;
    created_at: string;
  };
  onClose: () => void;
}

const VIEWABLE_TEXT_TYPES = [
  'text/plain', 'text/csv', 'text/html', 'text/css', 'text/xml', 'text/markdown',
  'application/json', 'application/xml', 'application/x-yaml',
  'application/javascript', 'application/typescript',
];

const TEXT_EXTENSIONS = ['txt', 'csv', 'json', 'xml', 'md', 'log', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'env', 'sh', 'bat', 'ps1', 'py', 'js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'less', 'sql', 'conf'];

function isViewable(mime: string, filename: string): 'image' | 'pdf' | 'text' | 'audio' | 'video' | false {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('text/') || VIEWABLE_TEXT_TYPES.includes(mime)) return 'text';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  // Fallback: check extension for common text formats that may have wrong mime
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && TEXT_EXTENSIONS.includes(ext)) return 'text';
  return false;
}

export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const viewType = isViewable(attachment.mime_type, attachment.original_name || attachment.filename);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const token = typeof window !== 'undefined' ? localStorage.getItem('resolv_token') : null;
  const viewUrl = `${apiBase}/attachments/${attachment.id}/view?token=${token}`;
  const downloadUrl = `${apiBase}/attachments/${attachment.id}/download?token=${token}`;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card)', borderRadius: 'var(--radius-lg)',
        width: '90vw', maxWidth: 900, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {attachment.original_name || attachment.filename}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {formatSize(attachment.size)} &bull; {attachment.uploader_name} &bull; {new Date(attachment.created_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <a
              href={downloadUrl}
              className="btn btn-ghost btn-icon btn-sm"
              title="Download"
              style={{ textDecoration: 'none' }}
            >
              <Download size={16} />
            </a>
            <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
          {viewType === 'image' && (
            <img
              src={viewUrl}
              alt={attachment.original_name}
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
            />
          )}
          {viewType === 'pdf' && (
            <iframe
              src={viewUrl}
              style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 'var(--radius-md)' }}
              title={attachment.original_name}
            />
          )}
          {viewType === 'text' && (
            <TextPreview url={viewUrl} />
          )}
          {viewType === 'audio' && (
            <div style={{ width: '100%', maxWidth: 500, textAlign: 'center' }}>
              <audio controls src={viewUrl} style={{ width: '100%' }} />
            </div>
          )}
          {viewType === 'video' && (
            <video controls src={viewUrl} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-md)' }} />
          )}
          {!viewType && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              <FileText size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Preview not available</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>This file type cannot be previewed inline.</div>
              <a
                href={downloadUrl}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, textDecoration: 'none' }}
              >
                <Download size={14} /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load');
        return r.text();
      })
      .then(setText)
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
        <AlertTriangle size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Failed to load text preview.</div>
      </div>
    );
  }

  if (text === null) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <pre style={{
      width: '100%', maxHeight: '70vh', overflow: 'auto',
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 16,
      fontSize: 13, lineHeight: 1.6, color: 'var(--text)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      margin: 0, fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    }}>
      {text}
    </pre>
  );
}
