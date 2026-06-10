'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Key, Lock, Plus, Trash2, Edit2, Save, X, CheckCircle,
  AlertTriangle, Eye, EyeOff, RefreshCw, HelpCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { sectionStyle, sectionTitle, sectionDesc, inputStyle, labelStyle, subsectionStyle } from './admin-styles';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SSOProvider {
  id: string;
  name: string;
  provider_type: 'saml' | 'ldap';
  is_active: boolean;
  saml_entry_point?: string;
  saml_issuer?: string;
  saml_callback_url?: string;
  saml_cert_masked?: string;
  saml_want_assertions_signed?: boolean;
  saml_signature_algorithm?: string;
  saml_attribute_mapping?: Record<string, string>;
  ldap_url?: string;
  ldap_bind_dn?: string;
  ldap_bind_password_masked?: string;
  ldap_search_base?: string;
  ldap_search_filter?: string;
  ldap_attribute_mapping?: Record<string, string>;
  ldap_group_search_base?: string;
  ldap_group_filter?: string;
  auto_create_users?: boolean;
  default_role?: string;
  created_at: string;
}

interface SSOFormData {
  name: string;
  provider_type: 'saml' | 'ldap';
  is_active: boolean;
  // SAML
  saml_entry_point: string;
  saml_issuer: string;
  saml_callback_url: string;
  saml_cert: string;
  saml_want_assertions_signed: boolean;
  saml_signature_algorithm: string;
  saml_attribute_mapping: string;
  // LDAP
  ldap_url: string;
  ldap_bind_dn: string;
  ldap_bind_password: string;
  ldap_search_base: string;
  ldap_search_filter: string;
  ldap_attribute_mapping: string;
  ldap_group_search_base: string;
  ldap_group_filter: string;
  // Common
  auto_create_users: boolean;
  default_role: string;
}

const defaultForm: SSOFormData = {
  name: '',
  provider_type: 'saml',
  is_active: true,
  saml_entry_point: '',
  saml_issuer: '',
  saml_callback_url: '',
  saml_cert: '',
  saml_want_assertions_signed: true,
  saml_signature_algorithm: 'sha256',
  saml_attribute_mapping: JSON.stringify({ email: 'email', name: 'displayName', firstName: 'firstName', lastName: 'lastName' }, null, 2),
  ldap_url: '',
  ldap_bind_dn: '',
  ldap_bind_password: '',
  ldap_search_base: '',
  ldap_search_filter: '(uid={{username}})',
  ldap_attribute_mapping: JSON.stringify({ email: 'mail', name: 'cn', firstName: 'givenName', lastName: 'sn', department: 'department' }, null, 2),
  ldap_group_search_base: '',
  ldap_group_filter: '(member={{dn}})',
  auto_create_users: true,
  default_role: 'user',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SSOTab({ showAlert }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SSOFormData>({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [testingLdap, setTestingLdap] = useState(false);
  const [ldapTestResult, setLdapTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: SSOProvider[] }>('/sso/providers');
      setProviders(res.data || []);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load SSO providers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleEdit = (provider: SSOProvider) => {
    setForm({
      name: provider.name,
      provider_type: provider.provider_type,
      is_active: provider.is_active,
      saml_entry_point: provider.saml_entry_point || '',
      saml_issuer: provider.saml_issuer || '',
      saml_callback_url: provider.saml_callback_url || '',
      saml_cert: '',
      saml_want_assertions_signed: provider.saml_want_assertions_signed ?? true,
      saml_signature_algorithm: provider.saml_signature_algorithm || 'sha256',
      saml_attribute_mapping: JSON.stringify(provider.saml_attribute_mapping || { email: 'email', name: 'displayName' }, null, 2),
      ldap_url: provider.ldap_url || '',
      ldap_bind_dn: provider.ldap_bind_dn || '',
      ldap_bind_password: '',
      ldap_search_base: provider.ldap_search_base || '',
      ldap_search_filter: provider.ldap_search_filter || '(uid={{username}})',
      ldap_attribute_mapping: JSON.stringify(provider.ldap_attribute_mapping || { email: 'mail', name: 'cn' }, null, 2),
      ldap_group_search_base: provider.ldap_group_search_base || '',
      ldap_group_filter: provider.ldap_group_filter || '(member={{dn}})',
      auto_create_users: provider.auto_create_users ?? true,
      default_role: provider.default_role || 'user',
    });
    setEditingId(provider.id);
    setShowForm(true);
  };

  const handleNew = () => {
    setForm({ ...defaultForm });
    setEditingId(null);
    setShowForm(true);
    setLdapTestResult(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setLdapTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Parse JSON mappings
      let samlMapping: Record<string, string> | undefined;
      let ldapMapping: Record<string, string> | undefined;

      try {
        if (form.saml_attribute_mapping) {
          samlMapping = JSON.parse(form.saml_attribute_mapping);
        }
      } catch {
        showAlert('Invalid SAML attribute mapping JSON', 'error');
        setSaving(false);
        return;
      }

      try {
        if (form.ldap_attribute_mapping) {
          ldapMapping = JSON.parse(form.ldap_attribute_mapping);
        }
      } catch {
        showAlert('Invalid LDAP attribute mapping JSON', 'error');
        setSaving(false);
        return;
      }

      const payload: Record<string, any> = {
        name: form.name,
        provider_type: form.provider_type,
        is_active: form.is_active,
        auto_create_users: form.auto_create_users,
        default_role: form.default_role,
      };

      if (form.provider_type === 'saml') {
        payload.saml_entry_point = form.saml_entry_point;
        payload.saml_issuer = form.saml_issuer;
        payload.saml_callback_url = form.saml_callback_url;
        if (form.saml_cert) payload.saml_cert = form.saml_cert;
        payload.saml_want_assertions_signed = form.saml_want_assertions_signed;
        payload.saml_signature_algorithm = form.saml_signature_algorithm;
        payload.saml_attribute_mapping = samlMapping;
      } else {
        payload.ldap_url = form.ldap_url;
        payload.ldap_bind_dn = form.ldap_bind_dn;
        if (form.ldap_bind_password) payload.ldap_bind_password = form.ldap_bind_password;
        payload.ldap_search_base = form.ldap_search_base;
        payload.ldap_search_filter = form.ldap_search_filter;
        payload.ldap_attribute_mapping = ldapMapping;
        payload.ldap_group_search_base = form.ldap_group_search_base;
        payload.ldap_group_filter = form.ldap_group_filter;
      }

      if (editingId) {
        await api.patch(`/sso/providers/${editingId}`, payload);
        showAlert('SSO provider updated');
      } else {
        await api.post('/sso/providers', payload);
        showAlert('SSO provider created');
      }

      setShowForm(false);
      setEditingId(null);
      await loadProviders();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete SSO provider "${name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/sso/providers/${id}`);
      showAlert('SSO provider deleted');
      await loadProviders();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to delete SSO provider', 'error');
    }
  };

  const handleToggleActive = async (provider: SSOProvider) => {
    try {
      await api.patch(`/sso/providers/${provider.id}`, { is_active: !provider.is_active });
      showAlert(`Provider ${provider.is_active ? 'deactivated' : 'activated'}`);
      await loadProviders();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to toggle provider status', 'error');
    }
  };

  const handleTestLdap = async () => {
    setTestingLdap(true);
    setLdapTestResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/sso/ldap/test', {
        url: form.ldap_url,
        bind_dn: form.ldap_bind_dn,
        bind_password: form.ldap_bind_password,
        search_base: form.ldap_search_base,
        search_filter: form.ldap_search_filter,
      });
      setLdapTestResult({ success: true, message: 'LDAP connection successful!' });
      showAlert('LDAP connection successful');
    } catch (err: any) {
      const msg = err?.serverError || err?.message || 'LDAP connection failed';
      setLdapTestResult({ success: false, message: msg });
      showAlert(msg, 'error');
    } finally {
      setTestingLdap(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Section Header */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={sectionTitle}>SSO Providers</h3>
            <p style={sectionDesc}>
              Configure SAML 2.0 and LDAP authentication for single sign-on with your Identity Provider.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={handleNew}
              className="btn btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={15} />
              Add Provider
            </button>
          )}
        </div>

        {/* Provider List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : providers.length === 0 && !showForm ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            color: 'var(--text-muted)', fontSize: 13,
          }}>
            <Shield size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>No SSO providers configured yet.</p>
            <p style={{ marginTop: 4 }}>Add a SAML 2.0 or LDAP provider to enable single sign-on.</p>
          </div>
        ) : !showForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {providers.map(provider => (
              <div key={provider.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: provider.provider_type === 'saml'
                    ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.12)',
                  color: provider.provider_type === 'saml' ? '#6366f1' : '#22c55e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {provider.provider_type === 'saml' ? <Shield size={18} /> : <Key size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {provider.name}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase',
                      background: provider.provider_type === 'saml'
                        ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.12)',
                      color: provider.provider_type === 'saml' ? '#6366f1' : '#22c55e',
                      border: `1px solid ${provider.provider_type === 'saml' ? 'rgba(99,102,241,0.3)' : 'rgba(34,197,94,0.3)'}`,
                    }}>
                      {provider.provider_type}
                    </span>
                    <button
                      onClick={() => handleToggleActive(provider)}
                      style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: provider.is_active ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                        color: provider.is_active ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {provider.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {provider.provider_type === 'saml'
                      ? (provider.saml_entry_point || 'No entry point configured')
                      : (provider.ldap_url || 'No URL configured')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleEdit(provider)}
                    className="btn btn-ghost"
                    style={{ padding: '6px', borderRadius: 'var(--radius-md)' }}
                    title="Edit"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id, provider.name)}
                    className="btn btn-ghost"
                    style={{ padding: '6px', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ ...sectionTitle, margin: 0 }}>
              {editingId ? 'Edit SSO Provider' : 'Add SSO Provider'}
            </h3>
            <button
              onClick={handleCancel}
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: 'var(--radius-md)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Provider Type Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Provider Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
                placeholder="e.g., Corporate AD, Okta"
              />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select
                value={form.provider_type}
                onChange={e => setForm({ ...form, provider_type: e.target.value as 'saml' | 'ldap' })}
                style={selectStyle}
                disabled={!!editingId}
              >
                <option value="saml">SAML 2.0</option>
                <option value="ldap">LDAP</option>
              </select>
            </div>
          </div>

          {/* SAML Fields */}
          {form.provider_type === 'saml' && (
            <div style={subsectionStyle}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
                <Shield size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                SAML 2.0 Configuration
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Entry Point (IdP SSO URL)</label>
                  <input
                    type="text"
                    value={form.saml_entry_point}
                    onChange={e => setForm({ ...form, saml_entry_point: e.target.value })}
                    style={inputStyle}
                    placeholder="https://your-idp.com/saml/sso"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Issuer (Entity ID)</label>
                  <input
                    type="text"
                    value={form.saml_issuer}
                    onChange={e => setForm({ ...form, saml_issuer: e.target.value })}
                    style={inputStyle}
                    placeholder="urn:example:sp"
                  />
                </div>
                <div>
                  <label style={labelStyle}>ACS (Callback) URL</label>
                  <input
                    type="text"
                    value={form.saml_callback_url}
                    onChange={e => setForm({ ...form, saml_callback_url: e.target.value })}
                    style={inputStyle}
                    placeholder="https://your-api.com/api/sso/saml/callback"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Signature Algorithm</label>
                  <select
                    value={form.saml_signature_algorithm}
                    onChange={e => setForm({ ...form, saml_signature_algorithm: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="sha1">SHA-1</option>
                    <option value="sha256">SHA-256</option>
                    <option value="sha512">SHA-512</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>IdP Signing Certificate (PEM)</label>
                <textarea
                  value={form.saml_cert}
                  onChange={e => setForm({ ...form, saml_cert: e.target.value })}
                  style={{ ...inputStyle, minHeight: 80, fontFamily: 'monospace', fontSize: 12 }}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.saml_want_assertions_signed}
                    onChange={e => setForm({ ...form, saml_want_assertions_signed: e.target.checked })}
                  />
                  Want Assertions Signed
                </label>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Attribute Mapping (JSON)</label>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>
                  Maps SAML profile attributes to user fields. Format: {'{"user_field": "saml_attribute"}'}
                </p>
                <textarea
                  value={form.saml_attribute_mapping}
                  onChange={e => setForm({ ...form, saml_attribute_mapping: e.target.value })}
                  style={{ ...inputStyle, minHeight: 80, fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
            </div>
          )}

          {/* LDAP Fields */}
          {form.provider_type === 'ldap' && (
            <div style={subsectionStyle}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
                <Key size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                LDAP Configuration
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>LDAP URL</label>
                  <input
                    type="text"
                    value={form.ldap_url}
                    onChange={e => setForm({ ...form, ldap_url: e.target.value })}
                    style={inputStyle}
                    placeholder="ldap://dc01.example.com:389"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bind DN (Service Account)</label>
                  <input
                    type="text"
                    value={form.ldap_bind_dn}
                    onChange={e => setForm({ ...form, ldap_bind_dn: e.target.value })}
                    style={inputStyle}
                    placeholder="cn=admin,dc=example,dc=com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bind Password</label>
                  <input
                    type="password"
                    value={form.ldap_bind_password}
                    onChange={e => setForm({ ...form, ldap_bind_password: e.target.value })}
                    style={inputStyle}
                    placeholder={editingId ? 'Leave blank to keep current' : 'Service account password'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Search Base</label>
                  <input
                    type="text"
                    value={form.ldap_search_base}
                    onChange={e => setForm({ ...form, ldap_search_base: e.target.value })}
                    style={inputStyle}
                    placeholder="dc=example,dc=com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Search Filter</label>
                  <input
                    type="text"
                    value={form.ldap_search_filter}
                    onChange={e => setForm({ ...form, ldap_search_filter: e.target.value })}
                    style={inputStyle}
                    placeholder="(uid={{username}})"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Group Search Base (optional)</label>
                  <input
                    type="text"
                    value={form.ldap_group_search_base}
                    onChange={e => setForm({ ...form, ldap_group_search_base: e.target.value })}
                    style={inputStyle}
                    placeholder="ou=groups,dc=example,dc=com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Group Filter (optional)</label>
                  <input
                    type="text"
                    value={form.ldap_group_filter}
                    onChange={e => setForm({ ...form, ldap_group_filter: e.target.value })}
                    style={inputStyle}
                    placeholder="(member={{dn}})"
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Attribute Mapping (JSON)</label>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>
                  Maps LDAP attributes to user fields. Format: {'{"user_field": "ldap_attribute"}'}
                </p>
                <textarea
                  value={form.ldap_attribute_mapping}
                  onChange={e => setForm({ ...form, ldap_attribute_mapping: e.target.value })}
                  style={{ ...inputStyle, minHeight: 80, fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
            </div>
          )}

          {/* Common Options */}
          <div style={subsectionStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
              <Lock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Common Options
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.auto_create_users}
                    onChange={e => setForm({ ...form, auto_create_users: e.target.checked })}
                  />
                  Auto-Create Users
                </label>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 24px' }}>
                  Automatically create user accounts on first SSO login
                </p>
              </div>
              <div>
                <label style={labelStyle}>Default Role</label>
                <select
                  value={form.default_role}
                  onChange={e => setForm({ ...form, default_role: e.target.value })}
                  style={selectStyle}
                >
                  <option value="user">User</option>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            {form.provider_type === 'ldap' && (
              <button
                onClick={handleTestLdap}
                disabled={testingLdap || !form.ldap_url || !form.ldap_bind_dn || !form.ldap_bind_password}
                className="btn btn-ghost"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} style={{ animation: testingLdap ? 'spin 1s linear infinite' : undefined }} />
                {testingLdap ? 'Testing...' : 'Test Connection'}
              </button>
            )}
            <button
              onClick={handleCancel}
              className="btn btn-ghost"
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className={`btn btn-primary btn-save${saving ? ' saving' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: (saving || !form.name) ? 0.7 : 1,
              }}
            >
              <Save size={15} />
              {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
            </button>
          </div>

          {ldapTestResult && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500,
              background: ldapTestResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: ldapTestResult.success ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${ldapTestResult.success ? 'var(--success-border)' : 'var(--danger-border)'}`,
            }}>
              {ldapTestResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {ldapTestResult.message}
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>How SSO Login Works</h3>
        <p style={sectionDesc}>
          Once configured, users can sign in with your Identity Provider.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--accent)', minWidth: 80 }}>SAML 2.0</span>
            <span>Users click "Sign in with SSO" → redirected to your IdP → redirected back with a token.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--accent)', minWidth: 80 }}>LDAP</span>
            <span>Users enter their username and password on the login page → verified against your LDAP server.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-muted)' }} />
            <span>
              Metadata URL: The API serves SAML SP metadata at <code style={{ color: 'var(--accent)' }}>/api/sso/saml/metadata.xml</code>
            </span>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
