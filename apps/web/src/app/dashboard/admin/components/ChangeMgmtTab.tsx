'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, FileText, Shield, Clock, BarChart3, Save,
  Info, HelpCircle, ClipboardList, RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { api } from '@/lib/api';
import { ToggleSwitch } from './ToggleSwitch';

// ─── Component ───────────────────────────────────────────────────────────────

export function ChangeMgmtTab({ showAlert }: {
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
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Change Types */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Change Types</h3>
        <p style={sectionDesc}>
          Resolv supports three change types — Standard, Normal, and Emergency.
          Configure how each type is processed and approved.
        </p>
        <div style={subsectionStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ ...subsectionTitle, margin: 0 }}>
                  <GitBranch size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Standard Changes
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Low-risk, pre-approved changes that follow a defined procedure (e.g., password reset, server restart).
                  These are typically fully automated or require minimal oversight.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Auto-Approve Standard Changes
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Automatically approve standard changes without review.
                </p>
              </div>
              <ToggleSwitch
                enabled={settings['change_auto_approve_standard'] === 'true'}
                onChange={() => handleToggle('change_auto_approve_standard', settings['change_auto_approve_standard'] || 'true')}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <h4 style={{ ...subsectionTitle, margin: 0 }}>
              <Info size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Normal Changes
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Changes that require review and approval before implementation.
              These have a defined risk assessment and implementation plan.
            </p>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <h4 style={{ ...subsectionTitle, margin: 0 }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Emergency Changes
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              High-urgency changes that require immediate implementation (e.g., security patches, outage fixes).
              These follow an expedited approval process with post-implementation review.
            </p>
          </div>
        </div>
      </div>

      {/* Risk Framework */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Risk Framework</h3>
        <p style={sectionDesc}>
          Define risk levels that are assigned to changes. Each level has a description that helps change
          requesters and reviewers assess the appropriate risk category.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            { key: 'change_risk_low_desc', label: 'Low Risk', color: 'var(--success)', desc: 'Cosmetic or routine changes with no customer impact. No rollback complexity.' },
            { key: 'change_risk_medium_desc', label: 'Medium Risk', color: 'var(--warning)', desc: 'Changes with minor customer impact. Simple rollback procedure available.' },
            { key: 'change_risk_high_desc', label: 'High Risk', color: 'var(--danger)', desc: 'Changes with significant customer impact. Complex rollback requiring planning.' },
            { key: 'change_risk_critical_desc', label: 'Critical Risk', color: 'var(--critical, #dc2626)', desc: 'Changes that could cause major service disruption. Requires executive approval.' },
          ] as const).map(({ key, label: riskLabel, color, desc }) => (
            <div key={key} style={subsectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <h4 style={{ ...subsectionTitle, margin: 0 }}>{riskLabel}</h4>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>{desc}</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Description</label>
                  <input
                    type="text"
                    value={settings[key] || ''}
                    onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                    style={inputStyle}
                    placeholder={`Describe what constitutes ${riskLabel.toLowerCase()}...`}
                  />
                </div>
                <button
                  onClick={() => handleSave(key, settings[key] || '')}
                  style={savingKey === key ? btnDisabledStyle : btnStyle}
                  disabled={savingKey === key}
                >
                  <Save size={13} />
                  {savingKey === key ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance Windows */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Maintenance Windows</h3>
        <p style={sectionDesc}>
          Configure blackout periods and maintenance windows. During blackout periods, changes
          can be scheduled but will not be implemented until after the window ends.
        </p>
        <div style={subsectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ ...subsectionTitle, margin: 0 }}>
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Enforce Blackout Periods
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                When enabled, changes cannot be implemented during configured blackout periods.
              </p>
            </div>
            <ToggleSwitch
              enabled={settings['change_blackout_enabled'] === 'true'}
              onChange={() => handleToggle('change_blackout_enabled', settings['change_blackout_enabled'] || 'false')}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Blackout Period Message</label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>
              Message shown to users when attempting to schedule a change during a blackout period.
            </p>
            <textarea
              value={settings['change_blackout_message'] || ''}
              onChange={e => setSettings(prev => ({ ...prev, change_blackout_message: e.target.value }))}
              style={{ ...inputStyle, minHeight: 60, fontSize: 12, lineHeight: 1.5 }}
              placeholder="Changes cannot be scheduled during the blackout period of December 20 – January 5. Please reschedule for after this date."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => handleSave('change_blackout_message', settings['change_blackout_message'] || '')}
                style={savingKey === 'change_blackout_message' ? btnDisabledStyle : btnStyle}
                disabled={savingKey === 'change_blackout_message'}
              >
                <Save size={13} />
                {savingKey === 'change_blackout_message' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PIR Requirements */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Post-Implementation Review</h3>
        <p style={sectionDesc}>
          Configure requirements for post-implementation reviews (PIR) to ensure change quality
          and capture lessons learned.
        </p>
        <div style={subsectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ ...subsectionTitle, margin: 0 }}>
                <ClipboardList size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Require PIR
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                When enabled, a post-implementation review is required for completed changes.
              </p>
            </div>
            <ToggleSwitch
              enabled={settings['change_pir_required'] === 'true'}
              onChange={() => handleToggle('change_pir_required', settings['change_pir_required'] || 'true')}
            />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <label style={labelStyle}>
              <BarChart3 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Change Types Requiring PIR
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>
              Comma-separated list of change types that require PIR. Options: normal, emergency.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, maxWidth: 300 }}>
                <input
                  type="text"
                  value={settings['change_pir_types'] || 'normal,emergency'}
                  onChange={e => setSettings(prev => ({ ...prev, change_pir_types: e.target.value }))}
                  style={inputStyle}
                  placeholder="normal,emergency"
                />
              </div>
              <button
                onClick={() => handleSave('change_pir_types', settings['change_pir_types'] || 'normal,emergency')}
                style={savingKey === 'change_pir_types' ? btnDisabledStyle : btnStyle}
                disabled={savingKey === 'change_pir_types'}
              >
                <Save size={13} />
                {savingKey === 'change_pir_types' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Plan Template */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Implementation Plan Template</h3>
        <p style={sectionDesc}>
          Default template used when creating an implementation plan for a change request.
          Consistent templates ensure no critical steps are missed.
        </p>
        <div style={subsectionStyle}>
          <h4 style={{ ...subsectionTitle, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} />
            Implementation Plan Template
          </h4>
          <textarea
            value={settings['change_impl_plan_template'] || ''}
            onChange={e => setSettings(prev => ({ ...prev, change_impl_plan_template: e.target.value }))}
            style={{ ...inputStyle, minHeight: 140, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
            placeholder={`## Implementation Plan

**Change:** {{change_title}}
**Date/Time:** {{scheduled_date}}
**Risk Level:** {{risk_level}}

### Pre-Implementation Checklist

- [ ] Required approvals obtained
- [ ] Team notified
- [ ] Backups completed
- [ ] Rollback plan confirmed

### Implementation Steps

1. 

### Post-Implementation Verification

- [ ] Service confirmed operational
- [ ] Monitoring alerts verified
- [ ] Stakeholders notified

### Rollback Trigger Conditions

`}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={() => handleSave('change_impl_plan_template', settings['change_impl_plan_template'] || '')}
              style={savingKey === 'change_impl_plan_template' ? btnDisabledStyle : btnStyle}
              disabled={savingKey === 'change_impl_plan_template'}
            >
              <Save size={13} />
              {savingKey === 'change_impl_plan_template' ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Rollback Plan Template */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Rollback Plan Template</h3>
        <p style={sectionDesc}>
          Default template used when creating a rollback plan. A well-defined rollback plan is
          critical for minimizing downtime if implementation fails.
        </p>
        <div style={subsectionStyle}>
          <h4 style={{ ...subsectionTitle, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RotateCcw size={14} />
            Rollback Plan Template
          </h4>
          <textarea
            value={settings['change_rollback_template'] || ''}
            onChange={e => setSettings(prev => ({ ...prev, change_rollback_template: e.target.value }))}
            style={{ ...inputStyle, minHeight: 140, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
            placeholder={`## Rollback Plan

**Change:** {{change_title}}

### Rollback Trigger

### Rollback Steps

1. 

### Verification After Rollback

- [ ] System returned to previous state
- [ ] No data loss confirmed
- [ ] Users notified

### Lessons Learned

`}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={() => handleSave('change_rollback_template', settings['change_rollback_template'] || '')}
              style={savingKey === 'change_rollback_template' ? btnDisabledStyle : btnStyle}
              disabled={savingKey === 'change_rollback_template'}
            >
              <Save size={13} />
              {savingKey === 'change_rollback_template' ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
          <div>
            <h3 style={{ ...sectionTitle, marginBottom: 6 }}>About Change Management Settings</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Change management settings govern how changes are planned, reviewed, approved, implemented,
              and reviewed in your organization. A well-configured change management process reduces
              service disruption risk while enabling necessary changes to proceed efficiently.
              Define risk levels and required documentation templates
              to match your organization's change management maturity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
