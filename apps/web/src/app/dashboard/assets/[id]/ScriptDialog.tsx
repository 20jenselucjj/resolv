'use client';

import { X, Loader2 } from 'lucide-react';
import type React from 'react';
import { DISPLAY_FONT, BODY_FONT } from '@/lib/asset-detail-types';

interface Script {
  id: string;
  name: string;
  description?: string;
  category?: string;
  target_os?: string;
  script_type?: string;
  script_content?: string;
  parameters?: any[];
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
}

interface ScriptDialogProps {
  open: boolean;
  onClose: () => void;
  editingScript: Script | null;
  scriptForm: { name: string; description: string; script_type: string; script_content: string };
  setScriptForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; script_type: string; script_content: string }>>;
  scriptSaving: boolean;
  scriptError: string;
  saveScript: () => void;
}

export function ScriptDialog({
  open,
  onClose,
  editingScript,
  scriptForm,
  setScriptForm,
  scriptSaving,
  scriptError,
  saveScript
}: ScriptDialogProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: DISPLAY_FONT }}>
            {editingScript ? 'Edit Script' : 'New Script'}
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {scriptError && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 13 }}>
              {scriptError}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Script Name</label>
            <input
              type="text"
              value={scriptForm.name}
              onChange={(e) => setScriptForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Disk Cleanup"
              style={{
                width: '100%', height: 42, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', padding: '0 12px', fontSize: 13, fontFamily: BODY_FONT, boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
            <textarea
              value={scriptForm.description}
              onChange={(e) => setScriptForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description of what this script does"
              rows={2}
              style={{
                width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', padding: '10px 12px', fontSize: 13, fontFamily: BODY_FONT, boxSizing: 'border-box', resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Script Type</label>
            <select
              value={scriptForm.script_type}
              onChange={(e) => setScriptForm(f => ({ ...f, script_type: e.target.value }))}
              style={{
                width: '100%', height: 42, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', padding: '0 12px', fontSize: 13, fontFamily: BODY_FONT, boxSizing: 'border-box'
              }}
            >
              <option value="powershell">PowerShell</option>
              <option value="cmd">CMD</option>
              <option value="batch">Batch</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Script Content</label>
            <textarea
              value={scriptForm.script_content}
              onChange={(e) => setScriptForm(f => ({ ...f, script_content: e.target.value }))}
              placeholder="Write your script here..."
              rows={10}
              style={{
                width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical',
                lineHeight: 1.5
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            style={{
              height: 40, padding: '0 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT
            }}
          >
            Cancel
          </button>
          <button
            onClick={saveScript}
            disabled={scriptSaving}
            style={{
              height: 40, padding: '0 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)',
              background: 'var(--accent)', color: 'var(--text-inverse)', fontSize: 13, fontWeight: 700,
              cursor: scriptSaving ? 'not-allowed' : 'pointer', opacity: scriptSaving ? 0.6 : 1, fontFamily: BODY_FONT,
              display: 'inline-flex', alignItems: 'center', gap: 8
            }}
          >
            {scriptSaving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {editingScript ? 'Save Changes' : 'Create Script'}
          </button>
        </div>
      </div>
    </div>
  );
}
