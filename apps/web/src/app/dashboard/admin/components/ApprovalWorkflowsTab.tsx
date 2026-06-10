'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, Bell, Clock, AlertTriangle, ArrowUpCircle, Save,
  Users, HelpCircle, Gavel, ArrowRight, CheckSquare
} from 'lucide-react';
import { api } from '@/lib/api';
import { ToggleSwitch } from './ToggleSwitch';
import { ApprovalRoutingRulesTab } from './ApprovalRoutingRulesTab';
import { SelectSearch } from '@/components/SelectSearch';

// ─── Component ───────────────────────────────────────────────────────────────

export function ApprovalWorkflowsTab({ showAlert }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [subSection, setSubSection] = useState<'settings' | 'routing-rules'>('settings');
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
        <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {renderSubTabs(subSection, setSubSection)}
      {subSection === 'routing-rules' ? (
        <ApprovalRoutingRulesTab showAlert={showAlert} />
      ) : (
        <>

      {/* Default Due Dates */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Default Due Dates</h3>
        <p style={sectionDesc}>
          Configure default due dates for approval requests based on priority level.
          These time limits ensure that approvals are processed in a timely manner.
        </p>
        <div style={subsectionStyle}>
          <h4 style={subsectionTitle}>
            <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Due Date by Priority (Hours)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {([
              { key: 'approval_due_critical_hours', label: 'Critical', color: 'var(--critical, #dc2626)', defaultValue: 4 },
              { key: 'approval_due_high_hours', label: 'High', color: 'var(--danger)', defaultValue: 24 },
              { key: 'approval_due_medium_hours', label: 'Medium', color: 'var(--warning)', defaultValue: 72 },
              { key: 'approval_due_low_hours', label: 'Low', color: 'var(--success)', defaultValue: 168 },
            ]).map(({ key, label, color, defaultValue }) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: '50%', background: `${color}20`, color,
                  marginBottom: 6,
                }}>
                  <Clock size={16} />
                </div>
                <label style={{ ...labelStyle, textAlign: 'center', fontSize: 11 }}>{label}</label>
                <input
                  type="number"
                  min={1}
                  value={settings[key] || String(defaultValue)}
                  onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ ...inputStyle, textAlign: 'center', maxWidth: 120, margin: '0 auto' }}
                />
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>hours</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={async () => {
                const defaults: Record<string, string> = {
                  approval_due_critical_hours: '4',
                  approval_due_high_hours: '24',
                  approval_due_medium_hours: '72',
                  approval_due_low_hours: '168',
                };
                for (const key of Object.keys(defaults)) {
                  const value = settings[key] || defaults[key];
                  try {
                    await api.patch('/admin/settings', { key, value });
                  } catch {
                    showAlert(`Failed to save ${key}`, 'error');
                  }
                }
                showAlert('All due date settings saved');
              }}
              className="btn-save"
              style={btnStyle}
            >
              <Save size={13} />
              Save All
            </button>
          </div>
        </div>
      </div>

      {/* Escalation Rules */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Escalation Rules</h3>
        <p style={sectionDesc}>
          Configure automatic escalation for approval requests that have not been acted upon within
          a defined timeframe. Escalation ensures that stalled approvals are brought to attention.
        </p>
        <div style={subsectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ ...subsectionTitle, margin: 0 }}>
                <ArrowUpCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Enable Auto-Escalation
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Automatically escalate approval requests that remain pending beyond the configured timeframe.
              </p>
            </div>
            <ToggleSwitch
              enabled={settings['approval_escalation_enabled'] === 'true'}
              onChange={() => handleToggle('approval_escalation_enabled', settings['approval_escalation_enabled'] || 'true')}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div style={subsectionStyle}>
            <label style={labelStyle}>
              <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Escalation After (Hours)
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>
              Number of hours after which a pending approval is escalated.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={1}
                value={settings['approval_escalation_hours'] || '48'}
                onChange={e => setSettings(prev => ({ ...prev, approval_escalation_hours: e.target.value }))}
                style={{ ...inputStyle, maxWidth: 120 }}
              />
              <button
                onClick={() => handleSave('approval_escalation_hours', settings['approval_escalation_hours'] || '48')}
                style={savingKey === 'approval_escalation_hours' ? btnDisabledStyle : btnStyle}
                disabled={savingKey === 'approval_escalation_hours'}
                className={`btn-save${savingKey === 'approval_escalation_hours' ? ' saving' : ''}`}
              >
                <Save size={13} />
                {savingKey === 'approval_escalation_hours' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          <div style={subsectionStyle}>
            <label style={labelStyle}>
              <Users size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Escalation Target
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>
              Who receives the escalated approval request.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <SelectSearch
                  options={[
                    { value: 'next_step', label: 'Next Approver in Step' },
                    { value: 'manager', label: "Requestor's Manager" },
                    { value: 'admin', label: 'System Administrator' },
                  ]}
                  value={settings['approval_escalation_target'] || 'next_step'}
                  onChange={val => setSettings(prev => ({ ...prev, approval_escalation_target: val || 'next_step' }))}
                  allowClear={false}
                  hideClear
                  showSearch={false}
                />
              </div>
              <button
                onClick={() => handleSave('approval_escalation_target', settings['approval_escalation_target'] || 'next_step')}
                style={savingKey === 'approval_escalation_target' ? btnDisabledStyle : btnStyle}
                disabled={savingKey === 'approval_escalation_target'}
                className={`btn-save${savingKey === 'approval_escalation_target' ? ' saving' : ''}`}
              >
                <Save size={13} />
                {savingKey === 'approval_escalation_target' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Step Templates */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Approval Step Templates</h3>
        <p style={sectionDesc}>
          Define default approval steps for each change type. Steps are processed sequentially,
          and each step must be approved before moving to the next.
        </p>
        <div style={subsectionStyle}>
          <h4 style={subsectionTitle}>
            <Gavel size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Default Approval Steps
          </h4>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Steps are comma-separated role names. The system will route the approval request
            to any user with the specified role. Steps are processed in order.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Normal Change Steps</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={settings['approval_normal_steps'] || 'manager,admin'}
                  onChange={e => setSettings(prev => ({ ...prev, approval_normal_steps: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="manager,admin"
                />
                <button
                  onClick={() => handleSave('approval_normal_steps', settings['approval_normal_steps'] || 'manager,admin')}
                  style={savingKey === 'approval_normal_steps' ? btnDisabledStyle : btnStyle}
                  disabled={savingKey === 'approval_normal_steps'}
                  className={`btn-save${savingKey === 'approval_normal_steps' ? ' saving' : ''}`}
                >
                  <Save size={13} />
                  {savingKey === 'approval_normal_steps' ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                e.g. "manager,admin" — first a manager must approve, then an admin.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Emergency Change Steps</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={settings['approval_emergency_steps'] || 'admin'}
                  onChange={e => setSettings(prev => ({ ...prev, approval_emergency_steps: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="admin"
                />
                <button
                  onClick={() => handleSave('approval_emergency_steps', settings['approval_emergency_steps'] || 'admin')}
                  style={savingKey === 'approval_emergency_steps' ? btnDisabledStyle : btnStyle}
                  disabled={savingKey === 'approval_emergency_steps'}
                  className={`btn-save${savingKey === 'approval_emergency_steps' ? ' saving' : ''}`}
                >
                  <Save size={13} />
                  {savingKey === 'approval_emergency_steps' ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Emergency changes typically require fewer steps for faster processing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Notification Settings</h3>
        <p style={sectionDesc}>
          Control which approval-related events trigger notifications to involved parties.
        </p>
        <div style={subsectionStyle}>
          <h4 style={subsectionTitle}>
            <Bell size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Approval Notifications
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { key: 'approval_notify_created', label: 'Approval Request Created', desc: 'Notify approvers when a new approval request is created.' },
              { key: 'approval_notify_approved', label: 'Approval Approved', desc: 'Notify the requestor when their approval is approved.' },
              { key: 'approval_notify_denied', label: 'Approval Denied', desc: 'Notify the requestor when their approval is denied.' },
              { key: 'approval_notify_escalated', label: 'Approval Escalated', desc: 'Notify the escalation target when an approval is escalated.' },
            ]).map(({ key, label, desc }) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{desc}</p>
                </div>
                <ToggleSwitch
                  enabled={settings[key] === 'true'}
                  onChange={() => handleToggle(key, settings[key] || 'true')}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
          <div>
            <h3 style={{ ...sectionTitle, marginBottom: 6 }}>About Approval Workflow Settings</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Approval workflows define how change requests, problem resolutions, and other ITSM
              processes are reviewed and authorized. Configuring due dates, escalation rules,
              and notification settings ensures that approvals are processed efficiently and
              nothing falls through the cracks. Step templates define the approval chain for
              each change type.
            </p>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function renderSubTabs(subSection: 'settings' | 'routing-rules', setSubSection: (s: 'settings' | 'routing-rules') => void) {
  return (
    <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--border)' }}>
      {([{ id: 'settings' as const, label: 'General Settings', icon: <CheckSquare size={14} /> },
         { id: 'routing-rules' as const, label: 'Routing Rules', icon: <ArrowRight size={14} /> }]).map(tab => (
        <div
          key={tab.id}
          onClick={() => setSubSection(tab.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', fontSize: '13px', fontWeight: subSection === tab.id ? 700 : 500,
            cursor: 'pointer', color: subSection === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: subSection === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: '-2px', transition: 'all 0.15s',
          }}
        >
          {tab.icon}
          {tab.label}
        </div>
      ))}
    </div>
  );
}
