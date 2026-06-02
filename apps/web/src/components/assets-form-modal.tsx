'use client';

import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';

import { AssetFormState, AssetGroup, ASSET_TYPE_LABELS } from '@/lib/assets-types';
import { Field } from '@/components/assets-list-ui';

export function AssetFormModal({
  modalMode,
  form,
  setForm,
  groups,
  saving,
  inputStyle,
  controlButtonStyle,
  onClose,
  onSave
}: {
  modalMode: 'add' | 'edit';
  form: AssetFormState;
  setForm: Dispatch<SetStateAction<AssetFormState>>;
  groups: AssetGroup[];
  saving: boolean;
  inputStyle: CSSProperties;
  controlButtonStyle: CSSProperties;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--text) 26%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
              {modalMode === 'edit' ? 'Edit Asset' : 'Add Asset'}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Capture inventory details, ownership, network info, and lifecycle state.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Name" required>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="e.g. DESKTOP-ABC123"
            />
          </Field>

          <Field label="Type" required>
            <select
              style={inputStyle}
              value={form.asset_type}
              onChange={(event) => setForm((previous) => ({ ...previous, asset_type: event.target.value }))}
            >
              {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status" required>
            <select
              style={inputStyle}
              value={form.status}
              onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}
            >
              {['active', 'inactive', 'retired', 'maintenance', 'disposed'].map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Display Name">
            <input
              style={inputStyle}
              value={form.display_name}
              onChange={(event) => setForm((previous) => ({ ...previous, display_name: event.target.value }))}
              placeholder="Friendly name"
            />
          </Field>

          <Field label="Serial Number">
            <input
              style={inputStyle}
              value={form.serial_number}
              onChange={(event) => setForm((previous) => ({ ...previous, serial_number: event.target.value }))}
            />
          </Field>

          <Field label="Manufacturer">
            <input
              style={inputStyle}
              value={form.manufacturer}
              onChange={(event) => setForm((previous) => ({ ...previous, manufacturer: event.target.value }))}
              placeholder="Dell, HP, Lenovo"
            />
          </Field>

          <Field label="Model">
            <input
              style={inputStyle}
              value={form.model}
              onChange={(event) => setForm((previous) => ({ ...previous, model: event.target.value }))}
            />
          </Field>

          <Field label="IP Address">
            <input
              style={inputStyle}
              value={form.ip_address}
              onChange={(event) => setForm((previous) => ({ ...previous, ip_address: event.target.value }))}
              placeholder="192.168.1.100"
            />
          </Field>

          <Field label="OS">
            <input
              style={inputStyle}
              value={form.os_name}
              onChange={(event) => setForm((previous) => ({ ...previous, os_name: event.target.value }))}
              placeholder="Windows 11 Pro"
            />
          </Field>

          <Field label="Hostname">
            <input
              style={inputStyle}
              value={form.hostname}
              onChange={(event) => setForm((previous) => ({ ...previous, hostname: event.target.value }))}
            />
          </Field>

          <Field label="Department">
            <input
              style={inputStyle}
              value={form.department}
              onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))}
            />
          </Field>

          <Field label="Location">
            <input
              style={inputStyle}
              value={form.location}
              onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
            />
          </Field>

          <Field label="Company">
            <input
              style={inputStyle}
              value={form.company}
              onChange={(event) => setForm((previous) => ({ ...previous, company: event.target.value }))}
            />
          </Field>

          <Field label="Group">
            <select
              style={inputStyle}
              value={form.asset_group_id}
              onChange={(event) => setForm((previous) => ({ ...previous, asset_group_id: event.target.value }))}
            >
              <option value="">No Group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vendor">
            <input
              style={inputStyle}
              value={form.vendor}
              onChange={(event) => setForm((previous) => ({ ...previous, vendor: event.target.value }))}
            />
          </Field>

          <Field label="Purchase Date">
            <input
              type="date"
              style={inputStyle}
              value={form.purchase_date}
              onChange={(event) => setForm((previous) => ({ ...previous, purchase_date: event.target.value }))}
            />
          </Field>

          <Field label="Warranty Expiry">
            <input
              type="date"
              style={inputStyle}
              value={form.warranty_expiry}
              onChange={(event) => setForm((previous) => ({ ...previous, warranty_expiry: event.target.value }))}
            />
          </Field>

          <Field label="Purchase Cost">
            <input
              type="number"
              style={inputStyle}
              value={form.purchase_cost}
              onChange={(event) => setForm((previous) => ({ ...previous, purchase_cost: event.target.value }))}
            />
          </Field>

          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Notes">
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                value={form.notes}
                onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
              />
            </Field>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={controlButtonStyle}>
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            style={{
              ...controlButtonStyle,
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              color: 'var(--text-inverse)',
              opacity: saving || !form.name.trim() ? 0.7 : 1,
              cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving…' : modalMode === 'edit' ? 'Save Changes' : 'Create Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
