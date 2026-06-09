'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, Ticket, CheckCircle, MessageSquare,
  X, Check, Calendar, ArrowRight, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStore, Notification } from '@/lib/store';

export function NotificationsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { notifications, setNotifications, markNotificationRead, unreadCount } = useStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!isOpen) return;
    async function fetchNotifications() {
      try {
        const res = await api.get<{ data: Notification[] }>('/notifications');
        setNotifications(res.data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, [isOpen, setNotifications]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all', {});
      const updated = notifications.map(n => ({ ...n, is_read: true }));
      setNotifications(updated);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkRead = async (id: string, ticketId?: string) => {
    try {
      await api.post(`/notifications/${id}/read`, {});
      markNotificationRead(id);
      if (ticketId) {
        onClose();
        router.push(`/dashboard/tickets/${ticketId}`);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' ? true : !n.is_read
  );

  const getDateGroup = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - notifDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'This Week';
    if (diffDays <= 30) return 'This Month';
    return 'Older';
  };

  const groupedNotifications: Record<string, Notification[]> = {};
  filteredNotifications.forEach(n => {
    const group = getDateGroup(n.created_at);
    if (!groupedNotifications[group]) groupedNotifications[group] = [];
    groupedNotifications[group].push(n);
  });
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  const getIcon = (type: string) => {
    switch (type) {
      case 'ticket_assigned': return <Ticket size={16} />;
      case 'ticket_resolved': return <CheckCircle size={16} />;
      case 'new_comment': return <MessageSquare size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(1px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          height: '100vh',
          background: 'var(--card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Notifications</h2>
            {unreadCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: 'white',
                padding: '1px 8px', borderRadius: 'var(--radius-full)',
                fontSize: 11, fontWeight: 600,
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                data-tooltip="Mark all as read"
                style={{
                  padding: 6, borderRadius: 'var(--radius-md)',
                  background: 'transparent', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Check size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              data-tooltip="Close"
              style={{
                padding: 6, borderRadius: 'var(--radius-md)',
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {(['all', 'unread'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 'none',
                borderBottom: `2px solid ${filter === tab ? 'var(--accent)' : 'transparent'}`,
                background: 'transparent',
                color: filter === tab ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: filter === tab ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: 12,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  animation: 'pulse 2s infinite ease-in-out',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '60%', height: 12, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ width: '90%', height: 10, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 4 }} />
                    <div style={{ width: '50%', height: 10, background: 'var(--bg-tertiary)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 0', color: 'var(--text-muted)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-full)',
                background: 'var(--bg-secondary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Bell size={24} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>All caught up!</p>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>No new notifications</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {groupOrder.map(group => {
                const items = groupedNotifications[group];
                if (!items || items.length === 0) return null;
                return (
                  <div key={group} style={{ marginBottom: 4 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      padding: '6px 4px 4px', marginTop: group === 'Today' ? 0 : 4,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <Calendar size={10} />
                      {group}
                    </div>
                    {items.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkRead(notif.id, notif.ticket_id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: notif.is_read ? 'transparent' : 'var(--accent-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: 10,
                          marginBottom: 4,
                          position: 'relative',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.background = notif.is_read ? 'var(--bg-secondary)' : 'var(--accent-subtle)';
                          const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement;
                          if (btn) btn.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.background = notif.is_read ? 'transparent' : 'var(--accent-subtle)';
                          const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement;
                          if (btn) btn.style.opacity = '0';
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 'var(--radius-md)',
                          background: notif.is_read ? 'var(--bg-secondary)' : 'var(--accent)',
                          color: notif.is_read ? 'var(--text-secondary)' : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {getIcon(notif.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{
                              fontWeight: notif.is_read ? 500 : 600,
                              color: 'var(--text)', fontSize: 13,
                              lineHeight: 1.3,
                            }}>
                              {notif.title}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: 1 }}>
                              {formatTime(notif.created_at)}
                            </span>
                          </div>
                          {notif.body && (
                            <p style={{
                              margin: '3px 0 0', fontSize: 12,
                              color: 'var(--text-secondary)',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {notif.body}
                            </p>
                          )}
                          {notif.ticket_id && (
                            <div style={{ marginTop: 5 }}>
                              <Link
                                href={`/dashboard/tickets/${notif.ticket_id}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  fontSize: 11, color: 'var(--accent)',
                                  textDecoration: 'none', fontWeight: 600,
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                }}
                              >
                                View ticket <ArrowRight size={11} />
                              </Link>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, notif.id)}
                          className="del-btn"
                          style={{
                            padding: 3, borderRadius: 'var(--radius-sm)',
                            border: 'none', background: 'transparent',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            position: 'absolute', top: 6, right: 6,
                            opacity: 0, transition: 'opacity 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}>
          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            style={{
              flex: 1, padding: '7px 0',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: unreadCount === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600,
              cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'var(--transition)',
            }}
          >
            <Check size={14} /> Mark all read
          </button>
          <button
            onClick={() => {
              onClose();
              router.push('/dashboard/notifications');
            }}
            style={{
              flex: 1, padding: '7px 0',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'var(--transition)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <Bell size={14} /> View all
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
