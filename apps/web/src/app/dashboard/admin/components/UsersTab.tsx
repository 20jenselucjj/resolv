'use client';

import { useEffect, useState } from 'react';
import { UserPlus, MoreVertical, Lock, X, CheckCircle, Trash2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from './SharedUI';
import type { UserProfile } from './types';

export function UsersTab({ users, onRefresh, onShowPassword, showAlert, setConfirmModal }: {
  users: UserProfile[];
  onRefresh: () => void;
  onShowPassword: (pw: string) => void;
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: UserProfile['role']; department: string }>({ name: '', email: '', role: 'user', department: '' });
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionMenu && !(e.target as HTMLElement).closest('[data-action-menu]')) {
        setActionMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionMenu]);

  const filteredUsers = users.filter(u => {
    const matchSearch = !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ data: { user: UserProfile; tempPassword: string } }>('/users/invite', inviteForm);
      showAlert('User invited successfully');
      setIsInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'user', department: '' });
      onRefresh();
      onShowPassword(res.data.tempPassword);
    } catch (err) {
      showAlert('Failed to invite user', 'error');
    }
  };

  const toggleSelectUser = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      showAlert(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      onRefresh();
    } catch (err: unknown) {
      console.error('Toggle active error:', err);
      showAlert(err instanceof Error ? err.message : 'Failed to update user', 'error');
    }
  };

  const handleResetPassword = async (user: UserProfile) => {
    try {
      const res = await api.post<{ tempPassword: string }>(`/users/${user.id}/reset-password`, {});
      onShowPassword(res.tempPassword);
      showAlert('Password reset sent');
    } catch {
      showAlert('Failed to reset password', 'error');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    setConfirmModal({
      open: true,
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/users/${user.id}`);
          showAlert('User deleted');
          onRefresh();
        } catch (err: unknown) {
          console.error('Delete user error:', err);
          showAlert(err instanceof Error ? err.message : 'Failed to delete user', 'error');
        }
      }
    });
  };

  // Bulk actions
  const handleBulkDeactivate = async () => {
    try {
      for (const id of selectedUsers) {
        await api.patch(`/users/${id}`, { is_active: false });
      }
      showAlert(`Deactivated ${selectedUsers.size} users`);
      setSelectedUsers(new Set());
      onRefresh();
    } catch {
      showAlert('Failed to bulk update', 'error');
    }
  };

  const handleBulkActivate = async () => {
    try {
      for (const id of selectedUsers) {
        await api.patch(`/users/${id}`, { is_active: true });
      }
      showAlert(`Activated ${selectedUsers.size} users`);
      setSelectedUsers(new Set());
      onRefresh();
    } catch {
      showAlert('Failed to bulk update', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary">
          <UserPlus size={14} /> Invite User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, height: 34 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'admin', 'agent', 'user'].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={roleFilter === role ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: '12px', padding: '6px 12px', textTransform: 'capitalize' }}
            >
              {role === 'all' ? 'All' : role}
            </button>
          ))}
        </div>
      </div>

      {selectedUsers.size > 0 && (
        <div style={{
          background: 'var(--accent-subtle)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.2s'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
            {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleBulkActivate} className="btn" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', fontSize: '12px', padding: '6px 12px' }}>Activate</button>
            <button onClick={handleBulkDeactivate} className="btn" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', fontSize: '12px', padding: '6px 12px' }}>Deactivate</button>
          </div>
        </div>
      )}

      {isInviteOpen && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Name</label><input className="input" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} required /></div>
            <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Email</label><input className="input" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required /></div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Role</label>
              <select className="select" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}>
                <option value="user">User</option><option value="agent">Agent</option><option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Send Invite</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsInviteOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', width: '40px' }}>
                  <input type="checkbox" checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>User</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Role</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: selectedUsers.has(u.id) ? 'var(--accent-subtle)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleSelectUser(u.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      className="select"
                      value={u.role}
                      style={{ fontSize: '12px', padding: '4px 8px', height: 'auto' }}
                      onChange={async (e) => {
                        try {
                          await api.patch(`/users/${u.id}`, { role: e.target.value });
                          showAlert(`Role updated to ${e.target.value}`);
                          onRefresh();
                        } catch {
                          showAlert('Failed to update role', 'error');
                        }
                      }}
                    >
                      <option value="user">User</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant={u.is_active ? 'active' : 'inactive'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => handleResetPassword(u)}
                        title="Reset Password"
                      >
                        <Lock size={12} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '11px', color: u.is_active ? 'var(--warning)' : 'var(--success)' }}
                        onClick={() => handleToggleActive(u)}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {u.is_active ? <X size={12} /> : <CheckCircle size={12} />}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px' }}
                          onClick={() => setActionMenu(actionMenu === u.id ? null : u.id)}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {actionMenu === u.id && (
                          <div data-action-menu style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 4,
                            background: 'var(--card)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            zIndex: 50, minWidth: 160, padding: 4, animation: 'fadeIn 0.15s ease-out'
                          }}>
                            <button
                              onClick={() => { handleResetPassword(u); setActionMenu(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text)', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <Lock size={12} /> Reset Password
                            </button>
                            <button
                              onClick={() => { handleToggleActive(u); setActionMenu(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: u.is_active ? 'var(--warning)' : 'var(--success)', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {u.is_active ? <X size={12} /> : <CheckCircle size={12} />}
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                            <button
                              onClick={() => { handleDeleteUser(u); setActionMenu(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--danger)', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <Trash2 size={12} /> Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
