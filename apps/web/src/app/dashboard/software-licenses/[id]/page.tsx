'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, CreditCard, Download, Edit3, Key, Link2, LoaderCircle,
  Plus, RefreshCw, Shield, Trash2, Unlink, User, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';

interface LicenseAssignment {
  id: string;
  license_id: string;
  asset_id: string;
  software_name: string;
  assigned_at: string;
  assigned_by: string | null;
  is_auto_matched: boolean;
  asset_name: string;
  asset_hostname: string;
  assigned_by_name?: string;
}

interface SoftwareContract {
  id: string;
  license_id: string;
  name: string;
  contract_number: string | null;
  vendor: string | null;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  renewal_notice_days: number;
  terms: string | null;
  file_path: string | null;
  created_at: string;
}

interface LicenseDetail {
  id: string;
  name: string;
  publisher: string | null;
  version: string | null;
  license_type: string;
  license_key: string | null;
  total_seats: number;
  used_seats: number;
  available_seats: number;
  purchase_date: string | null;
  expiry_date: string | null;
  renewal_date: string | null;
  cost_per_seat: number | null;
  total_cost: number | null;
  currency: string;
  vendor: string | null;
  purchase_order: string | null;
  invoice_number: string | null;
  notes: string | null;
  compliance_status: string;
  alert_threshold: number;
  auto_match: boolean;
  match_pattern: string | null;
  category: string | null;
  is_active: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  assignments: LicenseAssignment[];
  contracts: SoftwareContract[];
}

interface AssignResponse {
  data: LicenseAssignment;
}

interface ContractResponse {
  data: SoftwareContract;
}

interface AutoMatchResponse {
  data: {
    matched_count: number;
    matches: { asset_id: string; asset_name: string; software_name: string }[];
  };
}

const LICENSE_TYPE_LABELS: Record<string, string> = {
  perpetual: 'Perpetual',
  subscription: 'Subscription',
  concurrent: 'Concurrent',
  freeware: 'Freeware',
  open_source: 'Open Source',
  trial: 'Trial',
};

const COMPLIANCE_LABELS: Record<string, string> = {
  compliant: 'Compliant',
  warning: 'Warning',
  non_compliant: 'Non-Compliant',
  expired: 'Expired',
};

const COMPLIANCE_COLORS: Record<string, string> = {
  compliant: '#22c55e',
  warning: '#f59e0b',
  non_compliant: '#ef4444',
  expired: '#6b7280',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  const [license, setLicense] = React.useState<LicenseDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showAssignModal, setShowAssignModal] = React.useState(false);
  const [assignAssetId, setAssignAssetId] = React.useState('');
  const [assignAssetName, setAssignAssetName] = React.useState('');
  const [assigning, setAssigning] = React.useState(false);
  const [autoMatching, setAutoMatching] = React.useState(false);
  const [recalculating, setRecalculating] = React.useState(false);
  const [showContractModal, setShowContractModal] = React.useState(false);
  const [contractForm, setContractForm] = React.useState({
    name: '', contract_number: '', vendor: '', start_date: '', end_date: '',
    auto_renew: false, renewal_notice_days: 30, terms: '', file_path: '',
  });
  const [savingContract, setSavingContract] = React.useState(false);

  // Asset search state for assignment
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [searchingAsset, setSearchingAsset] = React.useState(false);

  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const fetchLicense = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: LicenseDetail }>(`/software-licenses/${id}`);
      setLicense(response.data);
    } catch (err: any) {
      setError(err.message || 'Unable to load license');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { fetchLicense(); }, [fetchLicense]);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const response = await api.post<{ data: LicenseDetail }>(`/software-licenses/${id}/recalculate`, {});
      setLicense(prev => prev ? { ...prev, ...response.data } : prev);
      setNotice({ tone: 'success', text: 'Compliance recalculated' });
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Recalculation failed' });
    } finally {
      setRecalculating(false);
    }
  }

  async function handleAutoMatch() {
    setAutoMatching(true);
    try {
      const response = await api.post<AutoMatchResponse>(`/software-licenses/${id}/auto-match`, {});
      setNotice({
        tone: 'success',
        text: `Auto-match complete: ${response.data.matched_count} asset(s) matched`,
      });
      await fetchLicense();
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Auto-match failed' });
    } finally {
      setAutoMatching(false);
    }
  }

  async function handleAssign() {
    if (!assignAssetId) return;
    setAssigning(true);
    try {
      await api.post<AssignResponse>(`/software-licenses/${id}/assign`, { asset_id: assignAssetId });
      setShowAssignModal(false);
      setAssignAssetId('');
      setAssignAssetName('');
      setSearchResults([]);
      setNotice({ tone: 'success', text: 'License assigned to asset' });
      await fetchLicense();
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Assignment failed' });
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(assetId: string) {
    if (!window.confirm('Remove this license assignment?')) return;
    try {
      await api.delete(`/software-licenses/${id}/assignments/${assetId}`);
      setNotice({ tone: 'success', text: 'Assignment removed' });
      await fetchLicense();
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Failed to remove assignment' });
    }
  }

  async function searchAsset(query: string) {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchingAsset(true);
    try {
      const response = await api.get<{ data: any[] }>(`/assets?search=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(response.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchingAsset(false);
    }
  }

  async function handleCreateContract() {
    if (!contractForm.name.trim()) return;
    setSavingContract(true);
    try {
      const payload: any = {
        name: contractForm.name,
        contract_number: contractForm.contract_number || null,
        vendor: contractForm.vendor || null,
        start_date: contractForm.start_date || null,
        end_date: contractForm.end_date || null,
        auto_renew: contractForm.auto_renew,
        renewal_notice_days: contractForm.renewal_notice_days,
        terms: contractForm.terms || null,
        file_path: contractForm.file_path || null,
      };
      await api.post<ContractResponse>(`/software-licenses/${id}/contracts`, payload);
      setShowContractModal(false);
      setContractForm({ name: '', contract_number: '', vendor: '', start_date: '', end_date: '', auto_renew: false, renewal_notice_days: 30, terms: '', file_path: '' });
      setNotice({ tone: 'success', text: 'Contract created' });
      await fetchLicense();
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Failed to create contract' });
    } finally {
      setSavingContract(false);
    }
  }

  async function handleDeleteContract(contractId: string) {
    if (!window.confirm('Delete this contract?')) return;
    try {
      await api.delete(`/software-licenses/${id}/contracts/${contractId}`);
      setNotice({ tone: 'success', text: 'Contract deleted' });
      await fetchLicense();
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Failed to delete contract' });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}>
        <LoaderCircle size={18} />&nbsp; Loading license&hellip;
      </div>
    );
  }

  if (!license) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)', padding: 24, fontSize: 14 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <Key size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>License not found</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 20px' }}>{error || 'This license could not be loaded or may have been removed.'}</p>
          <button onClick={() => router.push('/dashboard/software-licenses')} style={btnStyle}>
            <ArrowLeft size={14} /> Back to Licenses
          </button>
        </div>
      </div>
    );
  }

  const complianceColor = COMPLIANCE_COLORS[license.compliance_status] || '#6b7280';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}>
      {/* Notice toast */}
      {notice && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          padding: '12px 20px', borderRadius: 'var(--radius-md)',
          background: notice.tone === 'error' ? '#ef4444' : notice.tone === 'info' ? '#6366f1' : '#22c55e',
          color: 'white', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {notice.text}
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
        {/* Back button */}
        <button onClick={() => router.push('/dashboard/software-licenses')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'none',
          color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 16,
        }}>
          <ArrowLeft size={15} /> Software Licenses
        </button>

        {/* Main card */}
        <div style={{
          background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)', overflow: 'hidden', marginBottom: 24,
        }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: complianceColor + '20', color: complianceColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Key size={20} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{license.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {license.publisher && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{license.publisher}</span>}
                  {license.version && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>v{license.version}</span>}
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                    background: 'var(--bg-secondary)', fontSize: 11, fontWeight: 600,
                  }}>
                    {LICENSE_TYPE_LABELS[license.license_type] || license.license_type}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 12,
                    background: complianceColor + '20', color: complianceColor,
                    fontWeight: 600, fontSize: 11,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: complianceColor }} />
                    {COMPLIANCE_LABELS[license.compliance_status] || license.compliance_status}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handleRecalculate} disabled={recalculating} style={actionBtnStyle}>
                <RefreshCw size={13} style={{ animation: recalculating ? 'spin 1s linear infinite' : undefined }} />
                {recalculating ? 'Recalculating...' : 'Recalculate'}
              </button>
              {license.match_pattern && (
                <button onClick={handleAutoMatch} disabled={autoMatching} style={actionBtnStyle}>
                  <Download size={13} />
                  {autoMatching ? 'Matching...' : 'Auto-Match'}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowAssignModal(true)} style={{ ...actionBtnStyle, background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--text-inverse)' }}>
                  <Plus size={13} /> Assign
                </button>
              )}
            </div>
          </div>

          {/* Content grid */}
          <div style={{ padding: 24 }}>
            {/* Seats progress */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Seats</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <strong>{license.used_seats}</strong> used / <strong>{license.total_seats}</strong> total
                  &nbsp;·&nbsp; <strong>{license.available_seats}</strong> available
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4, transition: 'width 0.3s',
                  background: license.compliance_status === 'non_compliant' ? '#ef4444'
                    : license.compliance_status === 'warning' ? '#f59e0b'
                    : '#22c55e',
                  width: license.total_seats > 0 ? `${Math.min(100, (license.used_seats / license.total_seats) * 100)}%` : '0%',
                }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {/* Details */}
              <FieldGroup title="License Details">
                <Field label="Category" value={license.category || '—'} />
                <Field label="License Key" value={license.license_key ? (
                  <code style={{ fontSize: 12, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{license.license_key}</code>
                ) : '—'} />
                <Field label="Vendor" value={license.vendor || '—'} />
                <Field label="Purchase Order" value={license.purchase_order || '—'} />
                <Field label="Invoice Number" value={license.invoice_number || '—'} />
                <Field label="Auto-Match Pattern" value={license.match_pattern ? (
                  <code style={{ fontSize: 12, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{license.match_pattern}</code>
                ) : '—'} />
                <Field label="Alert Threshold" value={`${license.alert_threshold}%`} />
                <Field label="Auto-Match" value={license.auto_match ? 'Enabled' : 'Disabled'} />
              </FieldGroup>

              {/* Dates */}
              <FieldGroup title="Dates & Cost">
                <Field label="Purchase Date" value={formatDate(license.purchase_date)} />
                <Field label="Expiry Date" value={
                  <span style={{ color: license.compliance_status === 'expired' ? '#ef4444' : undefined, fontWeight: license.compliance_status === 'expired' ? 600 : 400 }}>
                    {formatDate(license.expiry_date)}
                  </span>
                } />
                <Field label="Renewal Date" value={formatDate(license.renewal_date)} />
                <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                <Field label="Cost Per Seat" value={formatCurrency(license.cost_per_seat, license.currency)} />
                <Field label="Total Cost" value={formatCurrency(license.total_cost, license.currency)} />
                <Field label="Currency" value={license.currency} />
              </FieldGroup>
            </div>

            {license.notes && (
              <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</div>
                {license.notes}
              </div>
            )}
          </div>
        </div>

        {/* Assignments Section */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', marginBottom: 24, overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Assignments ({license.assignments.length})</h2>
          </div>
          {license.assignments.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No assets assigned to this license yet.
              {isAdmin && license.match_pattern && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={handleAutoMatch} disabled={autoMatching} style={actionBtnStyle}>
                    <Download size={13} /> Run Auto-Match
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Asset</th>
                    <th style={thStyle}>Hostname</th>
                    <th style={thStyle}>Software</th>
                    <th style={thStyle}>Assigned At</th>
                    <th style={thStyle}>Method</th>
                    {isAdmin && <th style={{ ...thStyle, width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {license.assignments.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <User size={13} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: 600 }}>{a.asset_name || '—'}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{a.asset_hostname || '—'}</td>
                      <td style={tdStyle}>{a.software_name}</td>
                      <td style={tdStyle}>{formatDateTime(a.assigned_at)}</td>
                      <td style={tdStyle}>
                        {a.is_auto_matched ? (
                          <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>Auto</span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Manual</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={tdStyle}>
                          <button onClick={() => handleUnassign(a.asset_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                            <Unlink size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Contracts Section */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Contracts ({license.contracts.length})</h2>
            {isAdmin && (
              <button onClick={() => setShowContractModal(true)} style={{ ...actionBtnStyle, background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--text-inverse)' }}>
                <Plus size={13} /> Add Contract
              </button>
            )}
          </div>
          {license.contracts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No contracts associated with this license.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {license.contracts.map((c) => (
                <div key={c.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginTop: 4, flexWrap: 'wrap' }}>
                      {c.contract_number && <span>#{c.contract_number}</span>}
                      {c.vendor && <span>{c.vendor}</span>}
                      {c.start_date && <span><Calendar size={10} /> {formatDate(c.start_date)}</span>}
                      {c.end_date && <span>→ {formatDate(c.end_date)}</span>}
                      {c.auto_renew && <span style={{ color: '#6366f1', fontWeight: 600 }}>Auto-Renew</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDeleteContract(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <ModalOverlay onClose={() => setShowAssignModal(false)}>
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
            width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Assign License</h2>
              <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <label style={labelStyle}>Search Asset</label>
              <input
                placeholder="Type asset name or hostname..."
                value={assignAssetName}
                onChange={e => {
                  setAssignAssetName(e.target.value);
                  searchAsset(e.target.value);
                }}
                style={inputStyle}
              />
              {searchingAsset && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Searching...</div>}
              {searchResults.length > 0 && (
                <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', maxHeight: 200, overflow: 'auto' }}>
                  {searchResults.map((asset: any) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setAssignAssetId(asset.id);
                        setAssignAssetName(`${asset.name}${asset.hostname ? ` (${asset.hostname})` : ''}`);
                        setSearchResults([]);
                      }}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                        fontSize: 13, transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: 600 }}>{asset.name}</div>
                      {asset.hostname && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{asset.hostname}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowAssignModal(false)} style={btnStyle}>Cancel</button>
              <button
                onClick={handleAssign}
                disabled={!assignAssetId || assigning}
                style={{ ...btnStyle, background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--text-inverse)', opacity: (!assignAssetId || assigning) ? 0.6 : 1 }}
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Contract Modal */}
      {showContractModal && (
        <ModalOverlay onClose={() => setShowContractModal(false)}>
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
            width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
            boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Add Contract</h2>
              <button onClick={() => setShowContractModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={contractForm.name} onChange={e => setContractForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Microsoft Enterprise Agreement" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Contract Number</label>
                  <input value={contractForm.contract_number} onChange={e => setContractForm(f => ({ ...f, contract_number: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Vendor</label>
                  <input value={contractForm.vendor} onChange={e => setContractForm(f => ({ ...f, vendor: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={contractForm.start_date} onChange={e => setContractForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input type="date" value={contractForm.end_date} onChange={e => setContractForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="auto_renew" checked={contractForm.auto_renew} onChange={e => setContractForm(f => ({ ...f, auto_renew: e.target.checked }))} />
                <label htmlFor="auto_renew" style={{ fontSize: 13, color: 'var(--text)' }}>Auto-Renew</label>
              </div>
              <div>
                <label style={labelStyle}>Renewal Notice (days)</label>
                <input type="number" min={0} value={contractForm.renewal_notice_days} onChange={e => setContractForm(f => ({ ...f, renewal_notice_days: parseInt(e.target.value) || 30 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Terms & Conditions</label>
                <textarea value={contractForm.terms} onChange={e => setContractForm(f => ({ ...f, terms: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowContractModal(false)} style={btnStyle}>Cancel</button>
              <button
                onClick={handleCreateContract}
                disabled={!contractForm.name.trim() || savingContract}
                style={{ ...btnStyle, background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--text-inverse)', opacity: (!contractForm.name.trim() || savingContract) ? 0.6 : 1 }}
              >
                {savingContract ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer',
  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', verticalAlign: 'middle',
};
