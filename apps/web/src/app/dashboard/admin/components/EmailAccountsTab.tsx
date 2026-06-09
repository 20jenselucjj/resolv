'use client';

import { useEffect, useState, useRef } from 'react';
import { Mail, Plus, Save, Trash2, TestTube, CheckCircle, XCircle, Star, Edit2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ConfirmModal, Alert, Modal } from './SharedUI';

interface EmailAccount {
  id: string;
  name: string;
  account_type: 'smtp' | 'imap' | 'gmail_api';
  direction: 'outbound' | 'inbound' | 'both';
  host: string | null;
  port: number | null;
  encryption: 'none' | 'ssl' | 'tls' | 'starttls' | null;
  username: string | null;
  password: string | null;
  email_address: string | null;
  from_name: string | null;
  imap_folder: string | null;
  imap_poll_interval: number | null;
  is_active: boolean;
  is_default: boolean;
  last_test_at: string | null;
  last_test_success: boolean | null;
  last_test_error: string | null;
  created_at: string;
}

interface EmailAccountForm {
  name: string;
  account_type: 'smtp' | 'imap' | 'gmail_api';
  direction: 'outbound' | 'inbound' | 'both';
  host: string;
  port: number;
  encryption: 'none' | 'ssl' | 'tls' | 'starttls';
  username: string;
  password: string;
  email_address: string;
  from_name: string;
  imap_folder: string;
  imap_poll_interval: number;
  is_active: boolean;
  is_default: boolean;
}

const EMPTY_FORM: EmailAccountForm = {
  name: '',
  account_type: 'smtp',
  direction: 'outbound',
  host: '',
  port: 587,
  encryption: 'tls',
  username: '',
  password: '',
  email_address: '',
  from_name: '',
  imap_folder: 'INBOX',
  imap_poll_interval: 60,
  is_active: true,
  is_default: false,
};

export function EmailAccountsTab({ showAlert }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmailAccountForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      const res = await api.get<{ data: EmailAccount[] }>('/email-accounts');
      setAccounts(res.data || []);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load email accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (account: EmailAccount) => {
    setForm({
      name: account.name,
      account_type: account.account_type,
      direction: account.direction,
      host: account.host || '',
      port: account.port || 587,
      encryption: account.encryption || 'tls',
      username: account.username || '',
      password: '', // Don't prefill password for edit (security)
      email_address: account.email_address || '',
      from_name: account.from_name || '',
      imap_folder: account.imap_folder || 'INBOX',
      imap_poll_interval: account.imap_poll_interval || 60,
      is_active: account.is_active,
      is_default: account.is_default,
    });
    setEditingId(account.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        const payload: Record<string, any> = {};
        for (const [key, value] of Object.entries(form)) {
          if (value !== undefined && value !== null && value !== '') {
            payload[key] = value;
          }
        }
        // Don't send empty password on edit
        if (payload.password === '') delete payload.password;
        await api.patch(`/email-accounts/${editingId}`, payload);
        showAlert('Email account updated');
      } else {
        await api.post('/email-accounts', form);
        showAlert('Email account created');
      }
      resetForm();
      await loadAccounts();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/email-accounts/${id}`);
      showAlert('Email account deleted');
      setConfirmDelete(null);
      await loadAccounts();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to delete', 'error');
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await api.post<{ data: { success: boolean; error?: string } }>(`/email-accounts/${id}/test`, {});
      if (res.data.success) {
        showAlert('Connection test passed');
      } else {
        showAlert(res.data.error || 'Connection test failed', 'error');
      }
      await loadAccounts();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Test failed', 'error');
      await loadAccounts();
    } finally {
      setTesting(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.post(`/email-accounts/${id}/set-default`, {});
      showAlert('Default outbound account updated');
      await loadAccounts();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to set default', 'error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'auto',
  };

  const typeColors: Record<string, { bg: string; color: string }> = {
    smtp: { bg: '#e8f5e9', color: '#2e7d32' },
    imap: { bg: '#e3f2fd', color: '#1565c0' },
    gmail_api: { bg: '#fce4ec', color: '#c62828' },
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Email Accounts</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Configure SMTP, IMAP, or Gmail API accounts for sending and receiving email
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px' }}
        >
          <Plus size={14} />
          Add Account
        </button>
      </div>

      {/* Account List */}
      {accounts.length === 0 && !showForm ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--text-muted)',
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '2px dashed var(--border)',
        }}>
          <Mail size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            No email accounts configured
          </div>
          <div style={{ fontSize: 13 }}>
            Add an SMTP, IMAP, or Gmail API account to send and receive email.{' '}
            <span style={{ fontSize: 11, display: 'block', marginTop: 8, color: 'var(--text-muted)' }}>
              Without an account, email will use the existing Gmail API OAuth configuration.
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accounts.map(account => (
            <div
              key={account.id}
              className="card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                border: account.is_default ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              {/* Type indicator */}
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: typeColors[account.account_type]?.bg || 'var(--bg-tertiary)',
                color: typeColors[account.account_type]?.color || 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              }}>
                {account.account_type === 'gmail_api' ? 'G' : account.account_type.toUpperCase()}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{account.name}</span>
                  {account.is_default && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                      background: 'var(--accent-subtle)', color: 'var(--accent)',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      <Star size={10} />
                      Default
                    </span>
                  )}
                  {!account.is_active && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                    }}>
                      Inactive
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span>{account.email_address || account.host || '-'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>|</span>
                  <span style={{ textTransform: 'capitalize' }}>{account.direction}</span>
                  {account.host && (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}>|</span>
                      <span>{account.host}:{account.port}</span>
                    </>
                  )}
                </div>
                {/* Last test result */}
                {account.last_test_at && (
                  <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {account.last_test_success === true ? (
                      <><CheckCircle size={11} color="var(--success)" /><span style={{ color: 'var(--success)' }}>Test passed</span></>
                    ) : account.last_test_success === false ? (
                      <><XCircle size={11} color="var(--danger)" /><span style={{ color: 'var(--danger)' }}>Test failed: {account.last_test_error}</span></>
                    ) : null}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(account.last_test_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {account.direction !== 'inbound' && !account.is_default && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleSetDefault(account.id)}
                    title="Set as default outbound"
                    style={{ padding: '6px', fontSize: 11, border: '1px solid var(--border)' }}
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={() => handleTest(account.id)}
                  disabled={testing === account.id}
                  title="Test connection"
                  style={{ padding: '6px', fontSize: 11, border: '1px solid var(--border)' }}
                >
                  <TestTube size={13} />
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleEdit(account)}
                  title="Edit"
                  style={{ padding: '6px', fontSize: 11, border: '1px solid var(--border)' }}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setConfirmDelete(account.id)}
                  title="Delete"
                  style={{ padding: '6px', fontSize: 11, border: '1px solid var(--danger-border)', color: 'var(--danger)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <Modal
          title={editingId ? 'Edit Email Account' : 'Add Email Account'}
          onClose={() => { resetForm(); }}
          maxWidth="600px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Account Name *</label>
              <input className="input" style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Company SMTP" />
            </div>

            {/* Type & Direction */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Account Type *</label>
                <select style={selectStyle} value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value as any }))}>
                  <option value="smtp">SMTP</option>
                  <option value="imap">IMAP</option>
                  <option value="gmail_api">Gmail API</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Direction *</label>
                <select style={selectStyle} value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value as any }))}>
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            {/* Email Address & From Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Email Address</label>
                <input className="input" style={inputStyle} type="email" value={form.email_address} onChange={e => setForm(p => ({ ...p, email_address: e.target.value }))} placeholder="noreply@example.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>From Name</label>
                <input className="input" style={inputStyle} value={form.from_name} onChange={e => setForm(p => ({ ...p, from_name: e.target.value }))} placeholder="IT Support" />
              </div>
            </div>

            {/* SMTP/IMAP fields — show for smtp and imap */}
            {(form.account_type === 'smtp' || form.account_type === 'imap') && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Server Configuration</div>

                {/* Host & Port */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Host *</label>
                    <input className="input" style={inputStyle} value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} placeholder="smtp.example.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Port</label>
                    <input className="input" style={inputStyle} type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Encryption</label>
                    <select style={selectStyle} value={form.encryption} onChange={e => setForm(p => ({ ...p, encryption: e.target.value as any }))}>
                      <option value="none">None</option>
                      <option value="ssl">SSL</option>
                      <option value="tls">TLS</option>
                      <option value="starttls">STARTTLS</option>
                    </select>
                  </div>
                </div>

                {/* Username & Password */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Username</label>
                    <input className="input" style={inputStyle} value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder={editingId ? '(unchanged)' : ''} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Password</label>
                    <input className="input" style={inputStyle} type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={editingId ? '(unchanged if empty)' : ''} />
                  </div>
                </div>

                {/* IMAP-specific fields */}
                {form.account_type === 'imap' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>IMAP Folder</label>
                      <input className="input" style={inputStyle} value={form.imap_folder} onChange={e => setForm(p => ({ ...p, imap_folder: e.target.value }))} placeholder="INBOX" />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Poll Interval (s)</label>
                      <input className="input" style={inputStyle} type="number" min={10} max={86400} value={form.imap_poll_interval} onChange={e => setForm(p => ({ ...p, imap_poll_interval: parseInt(e.target.value) || 60 }))} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Active toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Active</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Inactive accounts won't be used for sending/receiving</div>
              </div>
              <button
                onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: form.is_active ? 'var(--accent)' : 'var(--bg-tertiary)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                  position: 'absolute', top: 3,
                  left: form.is_active ? 25 : 3,
                  transition: 'left 0.2s ease',
                }} />
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={resetForm} style={{ border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name || ((form.account_type === 'smtp' || form.account_type === 'imap') && !form.host)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Save size={14} />
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <ConfirmModal
          open={true}
          title="Delete Email Account"
          message="Are you sure you want to delete this email account? If it's the default, the fallback Gmail API will be used."
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
