'use client';

import { useState } from 'react';
import { Globe, Settings, Key, AlertTriangle, Info, RefreshCw, Search, Zap, HardDrive, Shield, Cloud, ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Users } from 'lucide-react';
import type { DirectorySyncConfig, FieldMapping, ProviderType } from './types';
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
  /** Called when provider type changes */
  onProviderChange?: (provider: ProviderType) => void;
}

export function ProviderAndSyncConfig({
  config, setConfig, oauthConnected,
  showClientSecret, setShowClientSecret,
  handleTestConnection, testingConnection,
  handleFieldMappingChange,
  onProviderChange,
}: ProviderAndSyncConfigProps) {
  const [showAzureGroupMapping, setShowAzureGroupMapping] = useState(false);

  const handleProviderSelect = (provider: ProviderType) => {
    setConfig(prev => ({ ...prev, provider, enabled: false }));
    onProviderChange?.(provider);
  };

  return (
    <>
      {/* ===== Provider Selection ===== */}
      <Section
        icon={<Settings size={16} />}
        iconBg="var(--accent-subtle)"
        iconColor="var(--accent)"
        label="Directory Provider"
        description="Select and configure your directory synchronization provider"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Provider Type Toggle */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleProviderSelect('google_workspace')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${config.provider === 'google_workspace' ? 'var(--accent)' : 'var(--border)'}`,
                background: config.provider === 'google_workspace' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                color: config.provider === 'google_workspace' ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: config.provider === 'google_workspace' ? 600 : 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Globe size={16} />
              Google Workspace
            </button>
            <button
              onClick={() => handleProviderSelect('azure_ad')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${config.provider === 'azure_ad' ? 'var(--accent)' : 'var(--border)'}`,
                background: config.provider === 'azure_ad' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                color: config.provider === 'azure_ad' ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: config.provider === 'azure_ad' ? 600 : 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Cloud size={16} />
              Microsoft Entra ID (Azure AD)
            </button>
          </div>

          {/* Provider-specific credential forms */}
          {config.provider === 'google_workspace' && (
            <>
              {/* Google Workspace Credentials */}
              <div className="ds-cred-grid" style={{
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
                  hint="From Google Cloud Console \u2192 APIs & Services \u2192 Credentials. Create an OAuth 2.0 Web Client ID."
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

              {/* Domain */}
              <InputField
                label="Domain"
                value={config.domain}
                onChange={val => setConfig(prev => ({ ...prev, domain: val }))}
                placeholder="e.g. company.com"
                icon={<Globe size={14} />}
                hint="Your Google Workspace domain name (e.g. your-company.com)"
              />
            </>
          )}

          {config.provider === 'azure_ad' && (
            <>
              {/* Azure AD Credentials */}
              <div className="ds-cred-grid" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
                padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                <InputField
                  label="Tenant ID"
                  value={config.tenantId}
                  onChange={val => setConfig(prev => ({ ...prev, tenantId: val }))}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  icon={<Cloud size={14} />}
                  hint="Your Azure AD tenant (directory) ID from the Azure portal"
                />
                <InputField
                  label="Client ID"
                  value={config.clientId}
                  onChange={val => setConfig(prev => ({ ...prev, clientId: val }))}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  icon={<Key size={14} />}
                  hint="Application (client) ID from Azure AD app registration"
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Client Secret <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  <input
                    className="input"
                    type={showClientSecret ? 'text' : 'password'}
                    value={config.clientSecret ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter Azure AD client secret"
                    style={{ paddingRight: 80, width: '100%' }}
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
                    {showClientSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Client secret from Azure AD app registration. Stored securely.
                </span>
              </div>
            </>
          )}
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

            {/* Azure AD: Auto-deactivate toggle */}
            {config.provider === 'azure_ad' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              }}>
                <ToggleSwitch
                  small
                  enabled={config.autoDeactivate ?? false}
                  onChange={() => setConfig(prev => ({ ...prev, autoDeactivate: !prev.autoDeactivate }))}
                />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>Auto-deactivate removed users</span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Automatically deactivate Resolv users who are no longer in Azure AD
                  </div>
                </div>
              </div>
            )}

            <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                  <option value="admin">Admin</option>
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
        {config.provider === 'google_workspace' ? (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            {/* Header row */}
            <div className="ds-field-grid" style={{
              display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12,
              padding: '10px 16px', background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
              fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Resolv Field</span>
              <span>Directory Attribute</span>
              <span className="ds-field-header-last" style={{ width: 100 }} />
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
                className="ds-field-grid"
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
                <span className="ds-field-header-last" style={{ fontSize: '11px', color: 'var(--text-muted)', width: 100 }}>{'\u2190'} directory attr</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              padding: '10px 16px', background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
              fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Azure AD Attribute</span>
              <span>Resolv Field</span>
            </div>
            {Object.entries(config.azureFieldMapping ?? {}).map(([key, value], index, arr) => (
              <div
                key={key}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                  padding: '10px 16px', alignItems: 'center',
                  borderBottom: index < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: 'var(--bg)',
                }}
              >
                <input
                  className="input"
                  value={key}
                  placeholder="Azure AD attribute"
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  onChange={e => {
                    const newMapping = { ...config.azureFieldMapping };
                    delete newMapping[key];
                    if (e.target.value) newMapping[e.target.value] = value;
                    setConfig(prev => ({ ...prev, azureFieldMapping: newMapping }));
                  }}
                />
                <input
                  className="input"
                  value={value}
                  placeholder="Resolv field"
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  onChange={e => {
                    setConfig(prev => ({
                      ...prev,
                      azureFieldMapping: { ...prev.azureFieldMapping, [key]: e.target.value },
                    }));
                  }}
                />
              </div>
            ))}
            <button
              onClick={() => {
                setConfig(prev => ({
                  ...prev,
                  azureFieldMapping: { ...prev.azureFieldMapping, '': '' },
                }));
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: 'transparent',
                border: 'none', borderTop: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-subtle)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
            >
              + Add Field Mapping
            </button>
          </div>
        )}
      </Section>

      {/* ===== Azure AD Group Role Mapping ===== */}
      {config.provider === 'azure_ad' && (
        <Section
          icon={<Shield size={16} />}
          iconBg="var(--accent-subtle)"
          iconColor="var(--accent)"
          label="Group Role Mapping"
          description="Map Azure AD groups to Resolv roles"
        >
          <div>
            <button
              onClick={() => setShowAzureGroupMapping(!showAzureGroupMapping)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700,
                color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              }}
            >
              Group Role Mapping
              {showAzureGroupMapping ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showAzureGroupMapping && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Map Azure AD groups to Resolv roles. Enter the group ID or name as the key and select the role.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.keys(config.groupRoleMapping ?? {}).length === 0 && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-muted)' }}>
                      No group mappings configured. Add mappings below.
                    </div>
                  )}
                  {Object.entries(config.groupRoleMapping ?? {}).map(([groupId, role]) => (
                    <div key={groupId} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={groupId}
                        placeholder="Azure AD Group ID"
                        onChange={(e) => {
                          const newMapping = { ...config.groupRoleMapping };
                          delete newMapping[groupId];
                          if (e.target.value) newMapping[e.target.value] = role;
                          setConfig(prev => ({ ...prev, groupRoleMapping: newMapping }));
                        }}
                        style={{
                          flex: 1, padding: '6px 10px', fontSize: '12px',
                          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                          fontFamily: 'monospace',
                        }}
                      />
                      <select
                        value={role}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          groupRoleMapping: { ...prev.groupRoleMapping, [groupId]: e.target.value },
                        }))}
                        style={{
                          padding: '6px 10px', fontSize: '12px',
                          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
                        }}
                      >
                        <option value="user">User</option>
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => {
                          const newMapping = { ...config.groupRoleMapping };
                          delete newMapping[groupId];
                          setConfig(prev => ({ ...prev, groupRoleMapping: newMapping }));
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn btn-ghost"
                    style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      groupRoleMapping: { ...prev.groupRoleMapping, '': 'user' },
                    }))}
                  >
                    + Add Mapping
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </>
  );
}
