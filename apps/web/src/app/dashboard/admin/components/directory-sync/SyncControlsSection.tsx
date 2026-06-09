'use client';

import { Activity, RefreshCw, Info, AlertTriangle, CheckCircle, CalendarClock, Users, UserPlus, Search, XCircle, ChevronRight, Database } from 'lucide-react';
import type { DirectorySyncConfig, SyncStatus } from './types';
import { Section } from './Section';
import { StatBadge } from './StatBadge';

interface SyncUserResult {
  email: string;
  status: string;
  name?: string;
  error?: string;
}

interface SyncControlsSectionProps {
  syncing: boolean;
  oauthConnected: boolean;
  syncStatus: SyncStatus | null;
  handleSyncNow: () => void;
  config: DirectorySyncConfig;
  showSyncUsers: boolean;
  setShowSyncUsers: React.Dispatch<React.SetStateAction<boolean>>;
  selectedUsers: Array<{ email: string; name?: string }>;
  setSelectedUsers: React.Dispatch<React.SetStateAction<Array<{ email: string; name?: string }>>>;
  userSearchQuery: string;
  setUserSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  handleUserSearch: (query: string) => Promise<void>;
  syncingUsers: boolean;
  handleSyncSelectedUsers: () => void;
  syncUsersResults: {
    total: number; created: number; updated: number; skipped: number;
    notFound: number; errors: number; results: SyncUserResult[];
  } | null;
  searchingUsers: boolean;
  showUserDropdown: boolean;
  setShowUserDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  userSearchResults: Array<{ email: string; name?: string }>;
  setUserSearchResults: React.Dispatch<React.SetStateAction<Array<{ email: string; name?: string }>>>;
  formatRelativeTime: (dateStr?: string) => string | null;
  formatDateTime: (dateStr?: string) => string;
}

export function SyncControlsSection({
  syncing, oauthConnected, syncStatus, handleSyncNow, config,
  showSyncUsers, setShowSyncUsers,
  selectedUsers, setSelectedUsers,
  userSearchQuery, setUserSearchQuery,
  handleUserSearch, syncingUsers, handleSyncSelectedUsers, syncUsersResults,
  searchingUsers, showUserDropdown, setShowUserDropdown,
  userSearchResults, setUserSearchResults,
  formatRelativeTime, formatDateTime,
}: SyncControlsSectionProps) {
  return (
    <Section
      icon={<Activity size={16} />}
      iconBg="var(--accent-subtle)"
      iconColor="var(--accent)"
      label="Sync Controls & Status"
      description="Run manual syncs and view current status"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary resp-btn"
            onClick={handleSyncNow}
            disabled={syncing || !oauthConnected}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', fontSize: '13px', fontWeight: 600,
              opacity: !oauthConnected ? 0.5 : 1,
            }}
          >
            {syncing ? (
              <RefreshCw size={15} className="ds-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>

          {!oauthConnected && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={12} />
              Connect OAuth to enable sync
            </span>
          )}

          {/* Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Status:</span>
            {syncStatus?.status === 'syncing' ? (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                fontSize: '12px', fontWeight: 600,
                background: 'var(--accent-subtle)', color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
              }}>
                <RefreshCw size={12} className="ds-spin" />
                Syncing
              </span>
            ) : syncStatus?.status === 'error' ? (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                fontSize: '12px', fontWeight: 600,
                background: 'var(--danger-bg)', color: 'var(--danger)',
                border: '1px solid var(--danger-border)',
              }}>
                <AlertTriangle size={12} />
                Error
              </span>
            ) : (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                fontSize: '12px', fontWeight: 600,
                background: 'var(--success-bg)', color: 'var(--success)',
                border: '1px solid var(--success-border)',
              }}>
                <CheckCircle size={12} />
                Idle
              </span>
            )}
          </div>
        </div>

        {/* Timestamps & Stats Grid */}
        <div className="ds-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Timestamps */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
            padding: '16px', background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              <CalendarClock size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              Schedule
            </div>

            {/* Last successful sync */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last successful sync</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                {formatRelativeTime(syncStatus?.lastSuccessfulSyncAt || syncStatus?.lastSyncAt) || formatDateTime(syncStatus?.lastSuccessfulSyncAt || syncStatus?.lastSyncAt)}
              </span>
              {(syncStatus?.lastSuccessfulSyncAt && syncStatus?.lastSyncAt && syncStatus.lastSuccessfulSyncAt !== syncStatus.lastSyncAt) && (
                <span style={{ fontSize: '10px', color: 'var(--warning)' }}>
                  Last attempt ({formatRelativeTime(syncStatus.lastSyncAt)}) failed
                </span>
              )}
            </div>

            {/* Last attempted sync (only show if different from successful) */}
            {syncStatus?.lastSyncAt && syncStatus?.lastSuccessfulSyncAt && syncStatus.lastSuccessfulSyncAt !== syncStatus.lastSyncAt && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last attempted sync</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--warning)' }}>
                  {formatRelativeTime(syncStatus.lastSyncAt) || formatDateTime(syncStatus.lastSyncAt)}
                </span>
              </div>
            )}

            {/* Next scheduled sync */}
            {config.enabled && config.syncIntervalMinutes > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Next scheduled sync</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
                  {formatRelativeTime(syncStatus?.nextSyncAt) || formatDateTime(syncStatus?.nextSyncAt)}
                </span>
                {syncStatus?.nextSyncAt && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {formatDateTime(syncStatus.nextSyncAt)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          {syncStatus?.stats ? (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
            }}>
              <StatBadge label="Synced" value={syncStatus.stats.synced} icon={<Users size={14} />} color="var(--accent)" />
              <StatBadge label="Created" value={syncStatus.stats.created} icon={<UserPlus size={14} />} color="var(--success)" />
              <StatBadge label="Updated" value={syncStatus.stats.updated} icon={<RefreshCw size={14} />} color="var(--accent-mid)" />
              <StatBadge label="Deactivated" value={syncStatus.stats.deactivated} icon={<XCircle size={14} />} color="var(--text-muted)" />
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px', background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)', fontSize: '12px',
            }}>
              <Database size={16} style={{ marginRight: 8 }} />
              No sync statistics available yet
            </div>
          )}
        </div>

        {/* Sync Selected Users */}
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'visible',
          position: 'relative',
        }}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={showSyncUsers}
            onClick={() => setShowSyncUsers(!showSyncUsers)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowSyncUsers(!showSyncUsers); } }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              background: 'var(--bg-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background 0.15s',
              borderRadius: showSyncUsers ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', flex: 1 }}>
              Sync Selected Users
            </span>
            <span style={{
              fontSize: '11px', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'transform 0.2s',
              transform: showSyncUsers ? 'rotate(90deg)' : 'none',
            }}>
              <ChevronRight size={14} />
            </span>
          </div>

          {showSyncUsers && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Search for users by name or email to sync them to your directory. Max 20 at a time.
              </div>

              {/* Selected Users Chips */}
              {selectedUsers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedUsers.map((user, idx) => (
                    <div key={idx} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 8px 4px 10px',
                      background: 'var(--accent-subtle)', color: 'var(--accent)',
                      borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 500,
                    }}>
                      <span>{user.name || user.email}</span>
                      <button
                        onClick={() => setSelectedUsers(prev => prev.filter((_, i) => i !== idx))}
                        disabled={syncingUsers}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 14, height: 14, padding: 0, borderRadius: '50%',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--accent)', opacity: 0.7,
                        }}
                      >
                        <XCircle size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search Input with Dropdown */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '0 12px',
                  transition: 'border-color 0.15s',
                }}>
                  <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={e => {
                      const val = e.target.value;
                      setUserSearchQuery(val);
                      if (val.length >= 2) {
                        setShowUserDropdown(true);
                        handleUserSearch(val);
                      } else {
                        setShowUserDropdown(false);
                        setUserSearchResults([]);
                      }
                    }}
                    onFocus={() => userSearchQuery.length >= 2 && setShowUserDropdown(true)}
                    onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                    placeholder="Search users by name or email..."
                    disabled={syncingUsers}
                    style={{
                      flex: 1, border: 'none', background: 'transparent',
                      padding: '10px 10px', fontSize: '12px', color: 'var(--text)',
                      outline: 'none',
                    }}
                  />
                  {searchingUsers && <RefreshCw size={13} className="ds-spin" style={{ color: 'var(--text-muted)' }} />}
                </div>

                {/* Search Results Dropdown */}
                {showUserDropdown && userSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {userSearchResults.map((user, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          if (!selectedUsers.some(u => u.email === user.email)) {
                            setSelectedUsers(prev => [...prev, user]);
                          }
                          setUserSearchQuery('');
                          setUserSearchResults([]);
                          setShowUserDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
                          borderBottom: idx < userSearchResults.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                          display: 'flex', flexDirection: 'column', gap: 1,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{user.name || '\u2014'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{user.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={handleSyncSelectedUsers}
                  disabled={syncingUsers || selectedUsers.length === 0 || !oauthConnected}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 18px', borderRadius: 'var(--radius-md)',
                    background: syncingUsers ? 'var(--bg-tertiary)' : 'var(--accent)',
                    color: syncingUsers ? 'var(--text-muted)' : 'white',
                    border: 'none', fontSize: '12px', fontWeight: 600,
                    cursor: syncingUsers ? 'wait' : 'pointer',
                    opacity: (selectedUsers.length === 0 || !oauthConnected) ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {syncingUsers ? <RefreshCw size={13} className="ds-spin" /> : <Search size={13} />}
                  {syncingUsers ? 'Syncing...' : 'Sync Selected'}
                </button>
                {!oauthConnected && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Info size={11} />
                    Connect OAuth to enable sync
                  </span>
                )}
              </div>

              {/* Sync Results */}
              {syncUsersResults && (
                <div className="ds-fade-in" style={{
                  marginTop: 4,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}>
                  {/* Summary row */}
                  <div style={{
                    display: 'flex', gap: 8, padding: '10px 14px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '12px', fontWeight: 600,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ color: 'var(--success)' }}>{syncUsersResults.created} created</span>
                    <span style={{ color: 'var(--accent)' }}>{syncUsersResults.updated} updated</span>
                    <span style={{ color: 'var(--text-muted)' }}>{syncUsersResults.skipped} skipped</span>
                    <span style={{ color: 'var(--warning)' }}>{syncUsersResults.notFound} not found</span>
                    {syncUsersResults.errors > 0 && (
                      <span style={{ color: 'var(--danger)' }}>{syncUsersResults.errors} errors</span>
                    )}
                  </div>
                  {/* Results table */}
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <tbody>
                        {syncUsersResults.results.map((r, idx) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            background: r.status === 'error' ? 'var(--danger-bg)' : r.status === 'not_found' ? 'var(--warning-bg)' : undefined,
                          }}>
                            <td style={{ padding: '6px 14px', color: 'var(--text)', fontWeight: 500 }}>
                              {r.email}
                            </td>
                            <td style={{ padding: '6px 14px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                fontSize: '11px', fontWeight: 600,
                                background: r.status === 'created' ? 'var(--success-bg)' :
                                  r.status === 'updated' ? 'var(--accent-subtle)' :
                                  r.status === 'error' ? 'var(--danger-bg)' :
                                  r.status === 'not_found' ? 'var(--warning-bg)' :
                                  'var(--bg-tertiary)',
                                color: r.status === 'created' ? 'var(--success)' :
                                  r.status === 'updated' ? 'var(--accent)' :
                                  r.status === 'error' ? 'var(--danger)' :
                                  r.status === 'not_found' ? 'var(--warning)' :
                                  'var(--text-muted)',
                              }}>
                                {r.status === 'created' && <UserPlus size={10} />}
                                {r.status === 'updated' && <RefreshCw size={10} />}
                                {r.status === 'error' && <XCircle size={10} />}
                                {r.status === 'not_found' && <AlertTriangle size={10} />}
                                {r.status === 'skipped' && <Info size={10} />}
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: '6px 14px', color: 'var(--text-muted)', fontSize: '11px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.error || r.name || ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
