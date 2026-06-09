'use client';

import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Ticket, 
  CheckCircle, 
  MessageSquare, 
  X, 
  Loader2, 
  ArrowRight,
  Check,
  Calendar
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStore, Notification } from '@/lib/store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 400, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
            background: danger ? 'var(--danger)' : 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, setNotifications, markNotificationRead, unreadCount } = useStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
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
  }, [setNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all', {});
      const updated = notifications.map(n => ({ ...n, is_read: true }));
      setNotifications(updated);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleClearAll = async () => {
    setConfirmModal({
      open: true,
      title: 'Clear Notifications',
      message: 'Are you sure you want to clear all notifications? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete('/notifications');
          setNotifications([]);
        } catch (error) {
          console.error('Failed to clear notifications:', error);
        }
      }
    });
  };

  const handleMarkRead = async (id: string, ticketId?: string) => {
    try {
      await api.post(`/notifications/${id}/read`, {});
      markNotificationRead(id);
      if (ticketId) {
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
      case 'ticket_assigned': return <Ticket size={18} />;
      case 'ticket_resolved': return <CheckCircle size={18} />;
      case 'new_comment': return <MessageSquare size={18} />;
      default: return <Bell size={18} />;
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

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ 
              backgroundColor: 'var(--accent)', 
              color: 'white', 
              padding: '2px 10px', 
              borderRadius: 'var(--radius-full)', 
              fontSize: '12px', 
              fontWeight: '600' 
            }}>
              {unreadCount} unread
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            style={{ 
              padding: '7px 14px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border)', 
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <Check size={15} /> Mark all read
          </button>
          <button 
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            style={{ 
              padding: '7px 14px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border)', 
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: notifications.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <X size={15} /> Clear all
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        marginBottom: '16px', 
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0'
      }}>
        <button 
          onClick={() => setFilter('all')}
          style={{ 
            padding: '8px 16px', 
            border: 'none',
            borderBottom: filter === 'all' ? '2px solid var(--accent)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: filter === 'all' ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: filter === 'all' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          All
        </button>
        <button 
          onClick={() => setFilter('unread')}
          style={{ 
            padding: '8px 16px', 
            border: 'none',
            borderBottom: filter === 'unread' ? '2px solid var(--accent)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: filter === 'unread' ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: filter === 'unread' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Unread
        </button>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <LoadingSkeleton />
        ) : filteredNotifications.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '80px 0',
            color: 'var(--text-muted)',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '72px', 
              height: '72px', 
              borderRadius: 'var(--radius-full)', 
              backgroundColor: 'var(--bg-secondary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Bell size={36} />
            </div>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text)' }}>All caught up!</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>No new notifications to show</p>
          </div>
        ) : (
          groupOrder.map(group => {
            const items = groupedNotifications[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 4 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '8px 4px 6px', marginTop: group === 'Today' ? 0 : 8,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Calendar size={11} />
                  {group}
                </div>
                {items.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => handleMarkRead(notif.id, notif.ticket_id)}
                    style={{ 
                      padding: '14px 16px', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border)',
                      backgroundColor: notif.is_read ? 'var(--bg)' : 'var(--accent-subtle)',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      gap: '14px',
                      transition: 'all 0.15s ease',
                      marginBottom: 6,
                      boxShadow: notif.is_read ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.backgroundColor = notif.is_read ? 'var(--bg-secondary)' : 'var(--accent-subtle)';
                      if (!notif.is_read) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                      const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                      if (btn) btn.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.backgroundColor = notif.is_read ? 'var(--bg)' : 'var(--accent-subtle)';
                      if (!notif.is_read) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                      const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                      if (btn) btn.style.opacity = '0';
                    }}
                  >
                    <div style={{ 
                      width: '38px', 
                      height: '38px', 
                      borderRadius: 'var(--radius-md)', 
                      backgroundColor: notif.is_read ? 'var(--bg-secondary)' : 'var(--accent)', 
                      color: notif.is_read ? 'var(--text-secondary)' : 'white',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getIcon(notif.type)}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                        <span style={{ 
                          fontWeight: notif.is_read ? '500' : '600', 
                          color: 'var(--text)',
                          fontSize: '14px'
                        }}>
                          {notif.title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '12px', marginTop: 2 }}>
                          {formatTime(notif.created_at)}
                        </span>
                      </div>
                      
                      {notif.body && (
                        <p style={{ 
                          margin: '4px 0 0 0', 
                          fontSize: '13px', 
                          color: 'var(--text-secondary)',
                          lineHeight: '1.4',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {notif.body}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        {notif.ticket_id && (
                          <Link 
                            href={`/dashboard/tickets/${notif.ticket_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              fontSize: '12px', 
                              color: 'var(--accent)', 
                              textDecoration: 'none',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: 0.85,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}
                          >
                            View ticket <ArrowRight size={13} />
                          </Link>
                        )}
                        {!notif.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markNotificationRead(notif.id);
                            }}
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              textDecoration: 'none',
                              fontWeight: 500,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              opacity: 0.7,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="delete-btn"
                      style={{ 
                        padding: '4px', 
                        borderRadius: 'var(--radius-sm)', 
                        border: 'none', 
                        backgroundColor: 'transparent', 
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ 
          padding: '16px', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          display: 'flex',
          gap: '16px',
          animation: 'pulse 2s infinite ease-in-out'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '40%', height: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }} />
            <div style={{ width: '90%', height: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '4px' }} />
            <div style={{ width: '70%', height: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} />
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
