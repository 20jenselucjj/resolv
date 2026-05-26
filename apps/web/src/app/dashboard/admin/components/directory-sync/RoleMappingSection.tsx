'use client';

import { Shield, Plus, Trash2, ArrowRight } from 'lucide-react';
import type { DirectorySyncConfig, RoleMapping } from './types';
import { EmptyState } from './EmptyState';
import { Section } from './Section';

interface RoleMappingSectionProps {
  config: DirectorySyncConfig;
  handleAddRoleMapping: () => void;
  handleRemoveRoleMapping: (index: number) => void;
  handleRoleMappingChange: (index: number, field: keyof RoleMapping, value: string) => void;
}

export function RoleMappingSection({
  config, handleAddRoleMapping, handleRemoveRoleMapping, handleRoleMappingChange,
}: RoleMappingSectionProps) {
  return (
    <Section
      icon={<Shield size={16} />}
      iconBg="var(--accent-subtle)"
      iconColor="var(--accent)"
      label="Role Mapping"
      description="Map directory groups to Resolv roles"
      badge={config.roleMapping && config.roleMapping.length > 0 ? (
        <span style={{
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          fontSize: '10px', fontWeight: 600,
          background: 'var(--accent-subtle)', color: 'var(--accent)',
          border: '1px solid var(--accent-border)',
        }}>{config.roleMapping.length}</span>
      ) : undefined}
    >
      {(!config.roleMapping || config.roleMapping.length === 0) ? (
        <EmptyState
          icon={<Shield size={24} />}
          title="No role mappings configured"
          description="Add mappings to automatically assign Resolv roles based on directory group membership. Users in matched groups will receive the corresponding role."
          action={
            <button
              onClick={handleAddRoleMapping}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent)', color: 'white',
                border: 'none', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add First Mapping
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {config.roleMapping.map((mapping, index) => (
            <div
              key={index}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1 }}>
                <input
                  className="input"
                  value={mapping.directoryGroup}
                  onChange={e => handleRoleMappingChange(index, 'directoryGroup', e.target.value)}
                  placeholder="Directory group name (e.g. admins@company.com)"
                />
              </div>
              <ArrowRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ width: '150px' }}>
                <select
                  className="select"
                  value={mapping.role}
                  onChange={e => handleRoleMappingChange(index, 'role', e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                  <option value="user">User</option>
                </select>
              </div>
              <button
                onClick={() => handleRemoveRoleMapping(index)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--danger)', display: 'flex', alignItems: 'center',
                  padding: '6px', borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.15s',
                }}
                title="Remove mapping"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={handleAddRoleMapping}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: 'transparent', border: '1px dashed var(--border)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.background = 'var(--accent-subtle)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Plus size={14} />
            Add Mapping
          </button>
        </div>
      )}
    </Section>
  );
}
