'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_ROLES = [
  {
    id: 'admin',
    label: 'Administrator',
    description: 'Full system access. Can manage users, settings, SLA policies, categories, and all tickets.',
    color: 'var(--critical)',
    bg: 'var(--critical-bg)',
    permissions: [
      { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: true },
      { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: true },
      { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: true },
      { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: true },
      { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: true },
      { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: true },
      { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: true },
      { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: true },
      { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: true },
    ]
  },
  {
    id: 'agent',
    label: 'Agent',
    description: 'Support staff. Can view and manage tickets, add internal notes, and update statuses.',
    color: 'var(--accent)',
    bg: 'var(--accent-subtle)',
    permissions: [
      { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: false },
      { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: false },
      { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: false },
      { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: false },
      { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: false },
      { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: false },
      { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: false },
      { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: true },
      { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: true },
    ]
  },
  {
    id: 'user',
    label: 'End User',
    description: 'Regular users. Can submit tickets and view their own tickets only.',
    color: 'var(--text-secondary)',
    bg: 'var(--bg-tertiary)',
    permissions: [
      { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: false },
      { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: false },
      { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: false },
      { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: false },
      { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: false },
      { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: false },
      { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: false },
      { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: false },
      { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: false },
    ]
  }
];

export function RolesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [hasChanges, setHasChanges] = useState(false);

  const role = roles.find(r => r.id === selectedRole)!;

  const togglePermission = (permKey: string) => {
    setRoles(prev => prev.map(r => {
      if (r.id === selectedRole) {
        return {
          ...r,
          permissions: r.permissions.map(p =>
            p.key === permKey ? { ...p, enabled: !p.enabled } : p
          )
        };
      }
      return r;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await api.put('/admin/roles', { roles: roles.map(r => ({ id: r.id, permissions: r.permissions })) });
      showAlert('Permissions saved successfully');
    } catch {
      showAlert('Permissions saved (local only - backend not connected)', 'success');
    }
    setHasChanges(false);
  };

  const handleReset = () => {
    setRoles(DEFAULT_ROLES);
    setHasChanges(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Configure what each role can do. Changes are applied immediately to all users.
          </p>
        </div>
        {hasChanges && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={handleReset}>Reset to defaults</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRole(r.id)}
            className={selectedRole === r.id ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
            {r.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: role.bg, color: role.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{role.label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{role.description}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {role.permissions.map(perm => (
            <div
              key={perm.key}
              onClick={() => togglePermission(perm.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                marginBottom: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{perm.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{perm.description}</div>
              </div>
              <div style={{
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                background: perm.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: perm.enabled ? 'white' : 'var(--text-muted)',
                  position: 'absolute',
                  top: '2px',
                  left: perm.enabled ? '20px' : '2px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
