'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import type { RolePermissions } from './types';

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
      { key: 'manage_assets', label: 'Manage Assets', description: 'Create and edit hardware assets', enabled: true },
      { key: 'manage_asset_groups', label: 'Manage Asset Groups', description: 'Organize assets into groups', enabled: true },
      { key: 'manage_email_templates', label: 'Manage Email Templates', description: 'Create and edit email templates', enabled: true },
      { key: 'manage_notification_settings', label: 'Manage Notifications', description: 'Configure notification channels', enabled: true },
      { key: 'manage_workflows', label: 'Manage Workflows', description: 'Configure ticket workflow transitions', enabled: true },
      { key: 'manage_backup', label: 'Manage Backups', description: 'Create and restore database backups', enabled: true },
      { key: 'manage_ai_config', label: 'Manage AI Config', description: 'Configure AI assistant settings', enabled: true },
      { key: 'manage_directory_sync', label: 'Manage Directory Sync', description: 'Configure Google Workspace directory sync', enabled: true },
      { key: 'manage_portal', label: 'Manage Portal', description: 'Customize end-user portal appearance', enabled: true },
      { key: 'manage_agent_settings', label: 'Manage Agent Settings', description: 'Configure deployment agents and secrets', enabled: true },
      { key: 'manage_reports', label: 'Manage Reports', description: 'View and export analytics reports', enabled: true },
      { key: 'manage_integrations', label: 'Manage Integrations', description: 'Configure third-party integrations', enabled: true },
    ]
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Team lead. Can manage users, tickets, SLAs, reports, and assets. Cannot change system settings or delete data.',
    color: 'var(--accent)',
    bg: 'var(--accent-subtle)',
    permissions: [
      { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: true },
      { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: false },
      { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: true },
      { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: true },
      { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: false },
      { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: true },
      { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: true },
      { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: true },
      { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: true },
      { key: 'manage_assets', label: 'Manage Assets', description: 'Create and edit hardware assets', enabled: true },
      { key: 'manage_asset_groups', label: 'Manage Asset Groups', description: 'Organize assets into groups', enabled: true },
      { key: 'manage_email_templates', label: 'Manage Email Templates', description: 'Create and edit email templates', enabled: true },
      { key: 'manage_notification_settings', label: 'Manage Notifications', description: 'Configure notification channels', enabled: true },
      { key: 'manage_workflows', label: 'Manage Workflows', description: 'Configure ticket workflow transitions', enabled: false },
      { key: 'manage_backup', label: 'Manage Backups', description: 'Create and restore database backups', enabled: false },
      { key: 'manage_ai_config', label: 'Manage AI Config', description: 'Configure AI assistant settings', enabled: false },
      { key: 'manage_directory_sync', label: 'Manage Directory Sync', description: 'Configure Google Workspace directory sync', enabled: false },
      { key: 'manage_portal', label: 'Manage Portal', description: 'Customize end-user portal appearance', enabled: true },
      { key: 'manage_agent_settings', label: 'Manage Agent Settings', description: 'Configure deployment agents and secrets', enabled: true },
      { key: 'manage_reports', label: 'Manage Reports', description: 'View and export analytics reports', enabled: true },
      { key: 'manage_integrations', label: 'Manage Integrations', description: 'Configure third-party integrations', enabled: false },
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
      { key: 'manage_assets', label: 'Manage Assets', description: 'Create and edit hardware assets', enabled: true },
      { key: 'manage_asset_groups', label: 'Manage Asset Groups', description: 'Organize assets into groups', enabled: false },
      { key: 'manage_email_templates', label: 'Manage Email Templates', description: 'Create and edit email templates', enabled: false },
      { key: 'manage_notification_settings', label: 'Manage Notifications', description: 'Configure notification channels', enabled: false },
      { key: 'manage_workflows', label: 'Manage Workflows', description: 'Configure ticket workflow transitions', enabled: false },
      { key: 'manage_backup', label: 'Manage Backups', description: 'Create and restore database backups', enabled: false },
      { key: 'manage_ai_config', label: 'Manage AI Config', description: 'Configure AI assistant settings', enabled: false },
      { key: 'manage_directory_sync', label: 'Manage Directory Sync', description: 'Configure Google Workspace directory sync', enabled: false },
      { key: 'manage_portal', label: 'Manage Portal', description: 'Customize end-user portal appearance', enabled: false },
      { key: 'manage_agent_settings', label: 'Manage Agent Settings', description: 'Configure deployment agents and secrets', enabled: false },
      { key: 'manage_reports', label: 'Manage Reports', description: 'View and export analytics reports', enabled: false },
      { key: 'manage_integrations', label: 'Manage Integrations', description: 'Configure third-party integrations', enabled: false },
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
      { key: 'manage_assets', label: 'Manage Assets', description: 'Create and edit hardware assets', enabled: false },
      { key: 'manage_asset_groups', label: 'Manage Asset Groups', description: 'Organize assets into groups', enabled: false },
      { key: 'manage_email_templates', label: 'Manage Email Templates', description: 'Create and edit email templates', enabled: false },
      { key: 'manage_notification_settings', label: 'Manage Notifications', description: 'Configure notification channels', enabled: false },
      { key: 'manage_workflows', label: 'Manage Workflows', description: 'Configure ticket workflow transitions', enabled: false },
      { key: 'manage_backup', label: 'Manage Backups', description: 'Create and restore database backups', enabled: false },
      { key: 'manage_ai_config', label: 'Manage AI Config', description: 'Configure AI assistant settings', enabled: false },
      { key: 'manage_directory_sync', label: 'Manage Directory Sync', description: 'Configure Google Workspace directory sync', enabled: false },
      { key: 'manage_portal', label: 'Manage Portal', description: 'Customize end-user portal appearance', enabled: false },
      { key: 'manage_agent_settings', label: 'Manage Agent Settings', description: 'Configure deployment agents and secrets', enabled: false },
      { key: 'manage_reports', label: 'Manage Reports', description: 'View and export analytics reports', enabled: false },
      { key: 'manage_integrations', label: 'Manage Integrations', description: 'Configure third-party integrations', enabled: false },
    ]
  },
  {
    id: 'readonly',
    label: 'Read-Only',
    description: 'Auditor or observer. Can view tickets and reports but cannot make any changes.',
    color: 'var(--text-muted)',
    bg: 'var(--bg-tertiary)',
    permissions: [
      { key: 'manage_users', label: 'Manage Users', description: 'Invite, edit, deactivate users and change roles', enabled: false },
      { key: 'manage_settings', label: 'Manage System Settings', description: 'Edit global system configuration', enabled: false },
      { key: 'manage_sla', label: 'Manage SLA Policies', description: 'Create and edit SLA policies', enabled: false },
      { key: 'manage_categories', label: 'Manage Categories', description: 'Create and delete ticket categories', enabled: false },
      { key: 'delete_tickets', label: 'Delete Tickets', description: 'Permanently delete any ticket', enabled: false },
      { key: 'view_audit_log', label: 'View Audit Log', description: 'Access full system audit trail', enabled: true },
      { key: 'manage_automation', label: 'Manage Automation Rules', description: 'Create routing and escalation rules', enabled: false },
      { key: 'view_all_tickets', label: 'View All Tickets', description: 'See tickets from all users', enabled: true },
      { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents', enabled: false },
      { key: 'manage_assets', label: 'Manage Assets', description: 'Create and edit hardware assets', enabled: false },
      { key: 'manage_asset_groups', label: 'Manage Asset Groups', description: 'Organize assets into groups', enabled: false },
      { key: 'manage_email_templates', label: 'Manage Email Templates', description: 'Create and edit email templates', enabled: false },
      { key: 'manage_notification_settings', label: 'Manage Notifications', description: 'Configure notification channels', enabled: false },
      { key: 'manage_workflows', label: 'Manage Workflows', description: 'Configure ticket workflow transitions', enabled: false },
      { key: 'manage_backup', label: 'Manage Backups', description: 'Create and restore database backups', enabled: false },
      { key: 'manage_ai_config', label: 'Manage AI Config', description: 'Configure AI assistant settings', enabled: false },
      { key: 'manage_directory_sync', label: 'Manage Directory Sync', description: 'Configure Google Workspace directory sync', enabled: false },
      { key: 'manage_portal', label: 'Manage Portal', description: 'Customize end-user portal appearance', enabled: false },
      { key: 'manage_agent_settings', label: 'Manage Agent Settings', description: 'Configure deployment agents and secrets', enabled: false },
      { key: 'manage_reports', label: 'Manage Reports', description: 'View and export analytics reports', enabled: true },
      { key: 'manage_integrations', label: 'Manage Integrations', description: 'Configure third-party integrations', enabled: false },
    ]
  }
];

export function RolesTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedRole, setSelectedRole] = useState(() => {
    try { return localStorage.getItem('resolv_roles_selected') || 'admin' } catch { return 'admin' }
  });

  useEffect(() => { localStorage.setItem('resolv_roles_selected', selectedRole) }, [selectedRole]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    api.get<{ data: { id: string; permissions: { key: string; enabled: boolean }[] }[] }>('/admin/roles')
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const apiPermMap = new Map<string, Map<string, boolean>>();
          res.data.forEach(r => {
            apiPermMap.set(r.id, new Map(r.permissions.map(p => [p.key, p.enabled])));
          });
          setRoles(DEFAULT_ROLES.map(defaultRole => {
            const apiPerms = apiPermMap.get(defaultRole.id);
            if (!apiPerms) return defaultRole;
            return {
              ...defaultRole,
              permissions: defaultRole.permissions.map(p => ({
                ...p,
                enabled: apiPerms.has(p.key) ? apiPerms.get(p.key)! : p.enabled,
              })),
            };
          }));
        }
      })
      .catch(() => { setFetchError(true); })
      .finally(() => setLoadingRoles(false));
  }, []);

  if (loadingRoles) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, opacity: 0.6, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Configure what each role can do. Changes are applied immediately to all users.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {DEFAULT_ROLES.map(r => (
            <div key={r.id} className="skeleton" style={{ width: 120, height: 42, borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
        <div className="card skeleton" style={{ padding: 20, minHeight: 200, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (fetchError && roles.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, textAlign: 'center' }}>
        <ShieldCheck size={48} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Failed to load roles</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Using default permissions. Check your connection and try again.</div>
      </div>
    );
  }

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
      await api.put('/admin/roles', {
        roles: roles.map(r => ({
          id: r.id,
          permissions: r.permissions.map(p => ({ key: p.key, enabled: p.enabled }))
        }))
      });
      showAlert('Permissions saved successfully');
    } catch {
      showAlert('Failed to save permissions', 'error');
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {role.permissions.map(perm => (
              <div
                key={perm.key}
                role="button"
                tabIndex={0}
                onClick={() => togglePermission(perm.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePermission(perm.key); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: perm.enabled ? 'var(--bg-secondary)' : 'transparent',
                  border: `1px solid ${perm.enabled ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = perm.enabled ? 'var(--bg-secondary)' : 'transparent'; e.currentTarget.style.borderColor = perm.enabled ? 'var(--accent-border)' : 'var(--border-subtle)'; }}
                onFocus={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
                onBlur={(e) => { e.currentTarget.style.background = perm.enabled ? 'var(--bg-secondary)' : 'transparent'; e.currentTarget.style.borderColor = perm.enabled ? 'var(--accent-border)' : 'var(--border-subtle)'; }}
              >
                <div
                  role="switch"
                  aria-checked={perm.enabled}
                  style={{
                    width: '34px', minWidth: '34px',
                    height: '18px',
                    borderRadius: '9px',
                    background: perm.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: perm.enabled ? 'var(--text-inverse)' : 'var(--text-muted)',
                    position: 'absolute',
                    top: '2px',
                    left: perm.enabled ? '18px' : '2px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: 'var(--shadow-sm)'
                  }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perm.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perm.description}</div>
                </div>
              </div>
          ))}
        </div>
      </div>
    </div>
  );
}
