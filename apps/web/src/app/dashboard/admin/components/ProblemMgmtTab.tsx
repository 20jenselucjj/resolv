'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, FileText, Link2, Archive, Flag, Save,
  HelpCircle, CheckSquare
} from 'lucide-react';
import { api } from '@/lib/api';
import { ToggleSwitch } from './ToggleSwitch';

// ─── Component ───────────────────────────────────────────────────────────────

export function ProblemMgmtTab({ showAlert }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px',
  };

  const sectionDesc: React.CSSProperties = {
    fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: '13px',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '4px',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  };

  const subsectionStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '16px', marginTop: '12px',
  };

  const subsectionTitle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px',
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Record<string, string> }>('/admin/settings');
      setSettings(res.data || {});
    } catch {
      showAlert('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await api.patch('/admin/settings', { key, value });
      showAlert('Setting saved');
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch {
      showAlert('Failed to save setting', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = async (key: string, current: string) => {
    const newVal = current === 'true' ? 'false' : 'true';
    // Optimistic update: flip immediately
    setSettings(prev => ({ ...prev, [key]: newVal }));
    try {
      await api.patch('/admin/settings', { key, value: newVal });
      showAlert('Setting saved');
    } catch {
      // Revert on failure
      setSettings(prev => ({ ...prev, [key]: current }));
      showAlert('Failed to save setting', 'error');
    }
  };

  const subsectionHeader = (icon: React.ReactNode, title: string) => (
    <h4 style={subsectionTitle}>
      {icon}
      {title}
    </h4>
  );

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-md)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    opacity: 1, whiteSpace: 'nowrap',
  };

  const btnDisabledStyle: React.CSSProperties = {
    ...btnStyle, opacity: 0.6, cursor: 'default',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Root Cause Templates */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={sectionTitle}>Root Cause Templates</h3>
            <p style={sectionDesc}>
              Configure the default template used for root cause analysis when resolving problems.
              This template guides problem managers through the investigation process.
            </p>
          </div>
        </div>
        <div style={subsectionStyle}>
          {subsectionHeader(<FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />, 'Default Root Cause Analysis Template')}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            This template is pre-filled when creating a new root cause analysis. Use variables like {'{{problem_title}}'}, {'{{impact}}'}, {'{{category}}'}.
          </p>
          <textarea
            value={settings['problem_root_cause_template'] || ''}
            onChange={e => setSettings(prev => ({ ...prev, problem_root_cause_template: e.target.value }))}
            style={{ ...inputStyle, minHeight: 140, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
            placeholder={`## Root Cause Analysis

**Problem:** {{problem_title}}
**Impact:** {{impact}}
**Category:** {{category}}

### Timeline of Events

1. 

### Investigation Findings



### Root Cause



### Resolution Steps

1. 

### Preventive Measures

1. `}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={() => handleSave('problem_root_cause_template', settings['problem_root_cause_template'] || '')}
              style={savingKey === 'problem_root_cause_template' ? btnDisabledStyle : btnStyle}
              disabled={savingKey === 'problem_root_cause_template'}
            >
              <Save size={13} />
              {savingKey === 'problem_root_cause_template' ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Linking Rules */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Auto-Linking Rules</h3>
        <p style={sectionDesc}>
          Automatically link incidents to existing problems when patterns are detected.
          This helps maintain problem–incident relationships without manual effort.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={subsectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ ...subsectionTitle, margin: 0 }}>
                  <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Auto-Link by Category Match
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Automatically link incidents to problems when their category matches the problem category.
                </p>
              </div>
              <ToggleSwitch
                enabled={settings['problem_auto_link_enabled'] === 'true'}
                onChange={() => handleToggle('problem_auto_link_enabled', settings['problem_auto_link_enabled'] || 'false')}
              />
            </div>
          </div>
          <div style={subsectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ ...subsectionTitle, margin: 0 }}>
                  <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Auto-Link by Similarity
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Automatically link incidents to problems when the description or title has high textual similarity.
                </p>
              </div>
              <ToggleSwitch
                enabled={settings['problem_auto_link_similarity'] === 'true'}
                onChange={() => handleToggle('problem_auto_link_similarity', settings['problem_auto_link_similarity'] || 'false')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Known Error Lifecycle */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Known Error Lifecycle</h3>
        <p style={sectionDesc}>
          Manage the lifecycle of known error records — from draft through published to archived.
          Configure approval gates and automatic archival rules.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={subsectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ ...subsectionTitle, margin: 0 }}>
                  <CheckSquare size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Require Approval to Publish
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  When enabled, draft known error records require explicit approval before transitioning to published status.
                </p>
              </div>
              <ToggleSwitch
                enabled={settings['ke_require_approval'] === 'true'}
                onChange={() => handleToggle('ke_require_approval', settings['ke_require_approval'] || 'false')}
              />
            </div>
          </div>
          <div style={subsectionStyle}>
            <h4 style={{ ...subsectionTitle, margin: 0 }}>
              <Archive size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Auto-Archive After N Days
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
              Automatically archive known error records that have been in published status for this many days.
              Set to 0 to disable auto-archival.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, maxWidth: 200 }}>
                <label style={labelStyle}>Days</label>
                <input
                  type="number"
                  min={0}
                  value={settings['ke_auto_archive_days'] || '0'}
                  onChange={e => setSettings(prev => ({ ...prev, ke_auto_archive_days: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <button
                onClick={() => handleSave('ke_auto_archive_days', settings['ke_auto_archive_days'] || '0')}
                style={savingKey === 'ke_auto_archive_days' ? btnDisabledStyle : btnStyle}
                disabled={savingKey === 'ke_auto_archive_days'}
              >
                <Save size={13} />
                {savingKey === 'ke_auto_archive_days' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Default Priority */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Default Priority</h3>
        <p style={sectionDesc}>
          Set the default priority level assigned to newly created problems.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, maxWidth: 250 }}>
            <label style={labelStyle}>
              <Flag size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Default Problem Priority
            </label>
            <select
              value={settings['problem_default_priority'] || 'medium'}
              onChange={e => setSettings(prev => ({ ...prev, problem_default_priority: e.target.value }))}
              style={selectStyle}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <button
            onClick={() => handleSave('problem_default_priority', settings['problem_default_priority'] || 'medium')}
            style={savingKey === 'problem_default_priority' ? btnDisabledStyle : btnStyle}
            disabled={savingKey === 'problem_default_priority'}
          >
            <Save size={13} />
            {savingKey === 'problem_default_priority' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
          <div>
            <h3 style={{ ...sectionTitle, marginBottom: 6 }}>About Problem Management Settings</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Problem management settings control how problems, known errors, and workarounds are
              managed in your organization. Configuring root cause templates ensures consistent
              investigation documentation. Auto-linking rules reduce manual effort by connecting
              related incidents to known problems automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
