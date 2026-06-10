'use client';

import { useState, useRef, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Upload, FileText, X, Download, AlertTriangle, CheckCircle, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface ParsedLicense {
  name: string;
  publisher: string;
  version: string;
  license_type: string;
  total_seats: number;
  license_key: string;
  purchase_date: string;
  expiry_date: string;
  cost_per_seat: number | null;
  total_cost: number | null;
  currency: string;
  vendor: string;
  category: string;
  notes: string;
}

interface ImportResult {
  row: number;
  name: string;
  status: 'imported' | 'error';
  error?: string;
}

interface ImportResponse {
  data: {
    total: number;
    imported: number;
    failed: number;
    results: ImportResult[];
  };
}

type Step = 'upload' | 'preview' | 'result';

const CSV_TEMPLATE = `name,publisher,version,license_type,total_seats,license_key,purchase_date,expiry_date,cost_per_seat,total_cost,currency,vendor,category,notes
Microsoft Office 365,Microsoft,2024,subscription,50,OEM-12345,2024-01-15,2025-01-15,99.99,4999.50,USD,Microsoft Corp,Productivity,
Adobe Creative Cloud,Adobe,2025,subscription,25,,2024-06-01,2025-06-01,79.99,1999.75,USD,Adobe Inc,Design,
JetBrains IntelliJ IDEA,JetBrains,2025.1,perpetual,10,LIC-67890,2024-03-01,,599.00,5990.00,USD,JetBrains s.r.o,Development,Developer IDE license`;

const LICENSE_TYPE_LABELS: Record<string, string> = {
  perpetual: 'Perpetual',
  subscription: 'Subscription',
  concurrent: 'Concurrent',
  freeware: 'Freeware',
  open_source: 'Open Source',
  trial: 'Trial',
};

function parseCSV(text: string): ParsedLicense[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const results: ParsedLicense[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    const seats = parseInt(row['total_seats']) || 1;
    results.push({
      name: row['name'] || `Row ${i}`,
      publisher: row['publisher'] || '',
      version: row['version'] || '',
      license_type: row['license_type'] || 'perpetual',
      total_seats: seats,
      license_key: row['license_key'] || '',
      purchase_date: row['purchase_date'] || '',
      expiry_date: row['expiry_date'] || '',
      cost_per_seat: parseFloat(row['cost_per_seat']) || null,
      total_cost: parseFloat(row['total_cost']) || null,
      currency: row['currency'] || 'USD',
      vendor: row['vendor'] || '',
      category: row['category'] || '',
      notes: row['notes'] || '',
    });
  }

  return results;
}

function parseJSON(text: string): ParsedLicense[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : (data.licenses || data.data || []);
  if (!Array.isArray(arr)) throw new Error('JSON must contain an array of licenses');

  return arr.map((item: any) => ({
    name: item.name || '',
    publisher: item.publisher || '',
    version: item.version || '',
    license_type: item.license_type || 'perpetual',
    total_seats: item.total_seats ?? 1,
    license_key: item.license_key || '',
    purchase_date: item.purchase_date || '',
    expiry_date: item.expiry_date || '',
    cost_per_seat: item.cost_per_seat ?? null,
    total_cost: item.total_cost ?? null,
    currency: item.currency || 'USD',
    vendor: item.vendor || '',
    category: item.category || '',
    notes: item.notes || '',
  }));
}

export default function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedLicense[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse['data'] | null>(null);
  const [error, setError] = useState('');
  const [previewPage, setPreviewPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewPageSize = 10;

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const text = await file.text();

    try {
      let data: ParsedLicense[];
      if (ext === 'json') {
        data = parseJSON(text);
      } else if (ext === 'csv') {
        data = parseCSV(text);
      } else {
        // Try CSV first, fall back to JSON
        if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
          data = parseJSON(text);
        } else {
          data = parseCSV(text);
        }
      }

      if (data.length === 0) {
        setError('No valid license entries found in the file.');
        return;
      }

      // Validate that at least names exist
      const valid = data.filter(d => d.name.trim());
      if (valid.length === 0) {
        setError('No entries with a valid "name" field found. Name is required.');
        return;
      }

      setParsed(data);
      setPreviewPage(0);
      setStep('preview');
    } catch (e: any) {
      setError(e.message || 'Failed to parse file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const payload = parsed.filter(d => d.name.trim()).map(d => ({
        name: d.name,
        publisher: d.publisher || null,
        version: d.version || null,
        license_type: d.license_type,
        license_key: d.license_key || null,
        total_seats: d.total_seats,
        purchase_date: d.purchase_date || null,
        expiry_date: d.expiry_date || null,
        cost_per_seat: d.cost_per_seat,
        total_cost: d.total_cost,
        currency: d.currency,
        vendor: d.vendor || null,
        category: d.category || null,
        notes: d.notes || null,
      }));

      const response = await api.post<ImportResponse>('/software-licenses/import', { licenses: payload });
      setImportResult(response.data);
      setStep('result');
    } catch (e: any) {
      setError(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (importResult && importResult.imported > 0) {
      onImported();
    }
    onClose();
  };

  const previewRows = parsed.slice(previewPage * previewPageSize, (previewPage + 1) * previewPageSize);
  const totalPreviewPages = Math.ceil(parsed.length / previewPageSize);

  const labelStyle: CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block',
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: step === 'preview' ? 720 : 540,
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={16} />
            Import Licenses
          </h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: step === s ? 'var(--accent)' : s === 'upload' && step === 'preview' ? '#22c55e'
                    : step === 'result' ? '#22c55e' : 'var(--bg-secondary)',
                  color: step === s || (s === 'upload' && step !== 'upload') || step === 'result' ? '#fff' : 'var(--text-muted)',
                }}>
                  {step === 'result' || (s === 'upload' && step !== 'upload') ? <CheckCircle size={12} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: step === s ? 'var(--text)' : 'var(--text-muted)' }}>
                  {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Results'}
                </span>
                {i < 2 && <div style={{ width: 20, height: 1, background: 'var(--border)' }} />}
              </div>
            ))}
          </div>

          {step === 'upload' && (
            <>
              {/* Download template */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  onClick={() => {
                    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'license-import-template.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >
                  <Download size={13} />
                  Download CSV Template
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
                  padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                  background: 'var(--bg-secondary)', transition: 'all 0.15s',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  Drop a CSV or JSON file here
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  or click to browse &middot; Supports .csv and .json
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>

              {fileName && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                }}>
                  <FileText size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 600 }}>{fileName}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 12 }}>Ready to preview</span>
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: '#ef444415', color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
                Found <strong style={{ color: 'var(--text)' }}>{parsed.length}</strong> license entries. Review and confirm the import.
              </p>

              {parsed.length > previewPageSize && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, fontSize: 12 }}>
                  <button
                    disabled={previewPage === 0}
                    onClick={() => setPreviewPage(p => p - 1)}
                    style={pageBtnStyle}
                  >
                    Previous
                  </button>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Page {previewPage + 1} of {totalPreviewPages}
                  </span>
                  <button
                    disabled={previewPage >= totalPreviewPages - 1}
                    onClick={() => setPreviewPage(p => p + 1)}
                    style={pageBtnStyle}
                  >
                    Next
                  </button>
                </div>
              )}

              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Publisher</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Seats</th>
                      <th style={thStyle}>Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((lic, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>{previewPage * previewPageSize + idx + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{lic.name}</td>
                        <td style={tdStyle}>{lic.publisher || '—'}</td>
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-block', padding: '1px 6px', borderRadius: 10,
                            background: 'var(--bg-secondary)', fontSize: 10, fontWeight: 600,
                          }}>
                            {LICENSE_TYPE_LABELS[lic.license_type] || lic.license_type}
                          </span>
                        </td>
                        <td style={tdStyle}>{lic.total_seats}</td>
                        <td style={tdStyle}>{lic.expiry_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: '#ef444415', color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}
            </>
          )}

          {step === 'result' && importResult && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: importResult.failed > 0 ? '#f59e0b20' : '#22c55e20',
                color: importResult.failed > 0 ? '#f59e0b' : '#22c55e',
              }}>
                {importResult.failed > 0 ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Import Complete
              </p>
              <p style={{ margin: '6px 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
                <strong style={{ color: '#22c55e' }}>{importResult.imported} imported</strong>
                {importResult.failed > 0 && (
                  <span> &middot; <strong style={{ color: '#ef4444' }}>{importResult.failed} failed</strong></span>
                )}
                <span> &middot; {importResult.total} total</span>
              </p>

              {importResult.results.filter(r => r.status === 'error').length > 0 && (
                <div style={{
                  marginTop: 12, textAlign: 'left',
                  border: '1px solid #ef444430', borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '8px 12px', background: '#ef444410', fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
                    Errors ({importResult.failed})
                  </div>
                  <div style={{ padding: 8, maxHeight: 150, overflow: 'auto' }}>
                    {importResult.results.filter(r => r.status === 'error').map((r, i) => (
                      <div key={i} style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}>
                        Row {r.row}: <strong>{r.name}</strong> — {r.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          {step === 'upload' && (
            <>
              <button onClick={handleClose} style={btnStyle}>Cancel</button>
              <button
                onClick={() => { setStep('preview'); }}
                disabled={parsed.length === 0}
                style={{
                  ...btnStyle, background: 'var(--accent)', border: '1px solid var(--accent)',
                  color: 'var(--text-inverse)', opacity: parsed.length === 0 ? 0.5 : 1,
                }}
              >
                Next: Preview
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('upload')} style={btnStyle}>Back</button>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  ...btnStyle, background: 'var(--accent)', border: '1px solid var(--accent)',
                  color: 'var(--text-inverse)', opacity: importing ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {importing ? <><LoaderCircle size={14} /> Importing...</> : `Import ${parsed.length} License${parsed.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={handleClose} style={{ ...btnStyle, background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--text-inverse)' }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const btnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer',
  fontSize: 13, fontWeight: 600,
};

const thStyle: CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '8px 10px', verticalAlign: 'middle',
};

const pageBtnStyle: CSSProperties = {
  padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
};
