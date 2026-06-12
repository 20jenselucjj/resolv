'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Save } from 'lucide-react';
import { api } from '@/lib/api';

export function LicenseComplianceTab({ showAlert }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [licenseSettings, setLicenseSettings] = useState<Record<string, string>>({
    license_default_alert_threshold: '90',
    license_default_renewal_days: '30',
    license_default_currency: 'USD',
    license_categories: '',
  });
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [savingLicense, setSavingLicense] = useState<string | null>(null);

  const loadLicenseSettings = useCallback(async () => {
    setLicenseLoading(true);
    try {
      const res = await api.get<{ data: Array<{ key: string; value: string }> }>('/admin/settings');
      if (res.data) {
        const keys = ['license_default_alert_threshold', 'license_default_renewal_days', 'license_default_currency', 'license_categories'];
        const loaded: Record<string, string> = { ...licenseSettings };
        for (const item of res.data) {
          if (keys.includes(item.key)) {
            loaded[item.key] = item.value;
          }
        }
        setLicenseSettings(loaded);
      }
    } catch {
      // Settings endpoint may not be available
    } finally {
      setLicenseLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLicenseSettings();
  }, [loadLicenseSettings]);

  const handleSaveLicense = async (key: string) => {
    setSavingLicense(key);
    try {
      await api.patch('/admin/settings', { key, value: licenseSettings[key] });
      showAlert('License setting saved');
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save license setting', 'error');
    } finally {
      setSavingLicense(null);
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '4px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: '13px',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Header */}
      <div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Configure default settings for software license management. These values are used
          as presets when creating new license records. Updates to compliance thresholds
          and renewal notice periods affect all existing license records.
        </p>
      </div>

      {licenseLoading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
      ) : (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-md)',
              background: 'rgba(34,197,94,0.12)', color: '#22c55e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                License Compliance Thresholds
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Set alert triggers and renewal notice periods to maintain software license compliance.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Compliance Alert Threshold */}
              <div>
                <label style={labelStyle}>Compliance Alert Threshold (%)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={licenseSettings.license_default_alert_threshold}
                      onChange={e => setLicenseSettings({ ...licenseSettings, license_default_alert_threshold: e.target.value })}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      When license usage reaches this percentage, a compliance alert is triggered.
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveLicense('license_default_alert_threshold')}
                    className="btn btn-ghost"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      color: 'var(--accent)', marginTop: 0, flexShrink: 0,
                    }}
                    disabled={savingLicense === 'license_default_alert_threshold'}
                  >
                    <Save size={14} />
                    {savingLicense === 'license_default_alert_threshold' ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Renewal Notice */}
              <div>
                <label style={labelStyle}>Default Renewal Notice (days)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={licenseSettings.license_default_renewal_days}
                      onChange={e => setLicenseSettings({ ...licenseSettings, license_default_renewal_days: e.target.value })}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Number of days before a license expires to send a renewal notice.
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveLicense('license_default_renewal_days')}
                    className="btn btn-ghost"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      color: 'var(--accent)', marginTop: 0, flexShrink: 0,
                    }}
                    disabled={savingLicense === 'license_default_renewal_days'}
                  >
                    <Save size={14} />
                    {savingLicense === 'license_default_renewal_days' ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
                License Defaults
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                Default values applied when creating new software license records.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Currency */}
                <div>
                  <label style={labelStyle}>Default Currency</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <select
                        value={licenseSettings.license_default_currency}
                        onChange={e => setLicenseSettings({ ...licenseSettings, license_default_currency: e.target.value })}
                        style={selectStyle}
                      >
                        <option value="USD">USD — US Dollar</option>
                        <option value="EUR">EUR — Euro</option>
                        <option value="GBP">GBP — British Pound</option>
                        <option value="CAD">CAD — Canadian Dollar</option>
                        <option value="AUD">AUD — Australian Dollar</option>
                      </select>
                    </div>
                    <button
                      onClick={() => handleSaveLicense('license_default_currency')}
                      className="btn btn-ghost"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 'var(--radius-md)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--accent)', marginTop: 0, flexShrink: 0,
                      }}
                      disabled={savingLicense === 'license_default_currency'}
                    >
                      <Save size={14} />
                      {savingLicense === 'license_default_currency' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label style={labelStyle}>License Categories</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <textarea
                        value={licenseSettings.license_categories}
                        onChange={e => setLicenseSettings({ ...licenseSettings, license_categories: e.target.value })}
                        style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                        placeholder="e.g. SaaS, Perpetual, Subscription, OEM, Volume Licensing"
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        Comma-separated list of default license categories for new licenses.
                      </div>
                    </div>
                    <button
                      onClick={() => handleSaveLicense('license_categories')}
                      className="btn btn-ghost"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 'var(--radius-md)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--accent)', marginTop: 0, flexShrink: 0,
                      }}
                      disabled={savingLicense === 'license_categories'}
                    >
                      <Save size={14} />
                      {savingLicense === 'license_categories' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
