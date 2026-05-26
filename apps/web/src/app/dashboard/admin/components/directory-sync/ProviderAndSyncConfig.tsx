'use client';

import { Globe, Settings, Key, Shield, ShieldCheck, AlertTriangle, Info, RefreshCw, Search, Zap, HardDrive } from 'lucide-react';
import type { DirectorySyncConfig, FieldMapping } from './types';
import { InputField } from './InputField';
import { ToggleSwitch } from './ToggleSwitch';
import { Section } from './Section';

interface ProviderAndSyncConfigProps {
  config: DirectorySyncConfig;
  setConfig: React.Dispatch<React.SetStateAction<DirectorySyncConfig>>;
  oauthConnected: boolean;
  showClientSecret: boolean;
  setShowClientSecret: React.Dispatch<React.SetStateAction<boolean>>;
  handleTestConnection: () => void;
  testingConnection: boolean;
  handleFieldMappingChange: (field: keyof FieldMapping, value: string) => void;
}

export function ProviderAndSyncConfig({
  config, setConfig, oauthConnected,
  showClientSecret, setShowClientSecret,
  handleTestConnection, testingConnection,
  handleFieldMappingChange,
}: ProviderAndSyncConfigProps) {
  return (
    <>
      {/* ===== Provider Configuration ===== */}
      <Section
        icon={<Settings size={16} />}
        iconBg="var(--accent-subtle)"
        iconColor="var(--accent)"
        label="Provider Configuration"
        description="Configure your directory provider and OAuth credentials"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Provider Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Provider Type
              <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                { value: 'google_workspace', label: 'Google Workspace', icon: Globe },
                { value: 'azure_ad', label: 'Azure AD', icon: Shield },
                { value: 'okta', label: 'Okta', icon: ShieldCheck },
              ] as const).map(({ value, label, icon: Icon }) => {
                const isCurrentProvider = config.provider === value;
                const isLocked = value === 'google_workspace' && oauthConnected && isCurrentProvider;
                return (
                  <button
                    key={value}
                    onClick={() => setConfig(prev => ({ ...prev, provider: value }))}
                    disabled={isLocked}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '9px 18px', borderRadius: 'var(--radius-full)',
                      border: `1.5px solid ${isCurrentProvider ? 'var(--accent)' : 'var(--border)'}`,
                      background: isCurrentProvider ? 'var(--accent-subtle)' : 'transparent',
                      color: isCurrentProvider ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: isCurrentProvider ? 600 : 500,
                      opacity: isLocked ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                );
              })}
            </div>
            {config.provider === 'google_workspace' && oauthConnected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Info size={12} color="var(--text-muted)" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Provider is locked to Google Workspace while OAuth is connected. Disconnect to switch.
                </span>
              </div>
            )}
          </div>

          {/* Credentials */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <InputField
              label="Client ID"
              value={config.clientId}
              onChange={val => setConfig(prev => ({ ...prev, clientId: val }))}
              placeholder="123456789-xxxxx.apps.googleusercontent.com"
              icon={<Key size={14} />}
              hint={config.provider === 'google_workspace'
                ? 'From Google Cloud Console \u2192 APIs & Services \u2192 Credentials. Create an OAuth 2.0 Web Client ID.'
                : 'The OAuth client ID provided by your identity provider.'}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client Secret</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showClientSecret ? 'text' : 'password'}
                  value={config.clientSecret ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                  placeholder="Enter client secret"
                  style={{ paddingRight: 80 }}
                />
                <button
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500,
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {showClientSecret ? 'Hide' : 'Show'}
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stored securely and never displayed in full. In Google Cloud Console, set the Authorized Redirect URI to your API domain + <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>/api/oauth/google/callback</code></span>
            </div>
          </div>

          {/* Corruption warning */}
          {config.secretCorrupted && (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '12px', color: 'var(--danger)', lineHeight: 1.5 }}>
                <strong>Client secret corrupted.</strong> The stored client secret was overwritten by a redacted placeholder during a previous save. Re-enter it from Google Cloud Console and save again.
              </div>
            </div>
          )}

          {/* Tenant ID (Azure AD only) */}
          <InputField
            label="Tenant ID"
            value={config.tenantId}
            onChange={val => setConfig(prev => ({ ...prev, tenantId: val }))}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            hidden={config.provider !== 'azure_ad'}
            icon={<Shield size={14} />}
          />

          {/* Domain (Google Workspace only) */}
          <InputField
            label="Domain"
            value={config.domain}
            onChange={val => setConfig(prev => ({ ...prev, domain: val }))}
            placeholder="e.g. company.com"
            hidden={config.provider !== 'google_workspace'}
            icon={<Globe size={14} />}
            hint="Your Google Workspace domain name (e.g. your-company.com)"
          />

          {/* Test Connection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection || !config.clientId || !config.clientSecret}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 18px', borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 500,
                  cursor: testingConnection ? 'wait' : 'pointer',
                  opacity: (!config.clientId || !config.clientSecret) ? 0.5 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {testingConnection ? <RefreshCw size={14} className="ds-spin" /> : <Search size={14} />}
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>
              {(!config.clientId || !config.clientSecret) && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enter credentials above to test</span>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ===== Sync Configuration ===== */}
      <Section
        icon={<Zap size={16} />}
        iconBg="var(--accent-subtle)"
        iconColor="var(--accent)"
        label="Sync Configuration"
        description="Control how and when directory sync runs"
        badge={config.enabled ? (
          <span style={{
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            fontSize: '10px', fontWeight: 600,
            background: 'var(--success-bg)', color: 'var(--success)',
            border: '1px solid var(--success-border)',
          }}>Active</span>
        ) : undefined}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Enable/Disable Toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '14px 16px', background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          }}>
            <ToggleSwitch
              enabled={config.enabled}
              onChange={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable Directory Sync</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Periodically sync users and groups from your directory provider</div>
            </div>
          </div>

          {/* Sync Settings (dimmed when disabled) */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '16px',
            opacity: config.enabled ? 1 : 0.5,
            pointerEvents: config.enabled ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}>
            {/* Auto-Provision Toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
            }}>
              <ToggleSwitch
                small
                enabled={config.autoProvision}
                onChange={() => setConfig(prev => ({ ...prev, autoProvision: !prev.autoProvision }))}
              />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>Auto-provision new users</span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Automatically create Resolv accounts for new directory users
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Default Role</label>
                <select
                  className="select"
                  value={config.defaultRole}
                  onChange={e => setConfig(prev => ({ ...prev, defaultRole: e.target.value as 'user' | 'agent' }))}
                  style={{ maxWidth: '100%' }}
                >
                  <option value="user">User</option>
                  <option value="agent">Agent</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned to newly provisioned users</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sync Interval</label>
                <select
                  className="select"
                  value={config.syncIntervalMinutes}
                  onChange={e => setConfig(prev => ({ ...prev, syncIntervalMinutes: parseInt(e.target.value) }))}
                  style={{ maxWidth: '100%' }}
                >
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every hour</option>
                  <option value={360}>Every 6 hours</option>
                  <option value={1440}>Every 24 hours</option>
                  <option value={0}>Manual only</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>How often to sync automatically</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ===== Field Mapping ===== */}
      <Section
        icon={<HardDrive size={16} />}
        iconBg="var(--bg-tertiary)"
        iconColor="var(--text-secondary)"
        label="Field Mapping"
        description="Map directory attributes to Resolv user fields"
      >
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12,
            padding: '10px 16px', background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span>Resolv Field</span>
            <span>Directory Attribute</span>
            <span style={{ width: 100 }} />
          </div>
          {/* Field rows */}
          {([
            { key: 'email' as const, label: 'Email', placeholder: 'email' },
            { key: 'name' as const, label: 'Name', placeholder: 'name' },
            { key: 'department' as const, label: 'Department', placeholder: 'department' },
            { key: 'jobTitle' as const, label: 'Job Title', placeholder: 'title' },
            { key: 'phone' as const, label: 'Phone', placeholder: 'phone' },
          ]).map(({ key, label, placeholder }, index) => (
            <div
              key={key}
              style={{
                display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12,
                padding: '10px 16px', alignItems: 'center',
                borderBottom: index < 4 ? '1px solid var(--border-subtle)' : 'none',
                background: 'var(--bg)',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{label}</span>
              <input
                className="input"
                value={config.fieldMapping[key] ?? ''}
                onChange={e => handleFieldMappingChange(key, e.target.value)}
                placeholder={placeholder}
                style={{ maxWidth: '320px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: 100 }}>{'\u2190'} directory attr</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
