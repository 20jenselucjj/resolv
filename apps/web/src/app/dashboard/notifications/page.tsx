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
  MoreHorizontal,
  Check
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ 
              backgroundColor: 'var(--accent)', 
              color: 'white', 
              padding: '2px 8px', 
              borderRadius: 'var(--radius-full)', 
              fontSize: '12px', 
              fontWeight: '600' 
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            style={{ 
              padding: '8px 12px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border)', 
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-secondary)',
              fontSize: '14px',
              cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <Check size={16} /> Mark all as read
          </button>
          <button 
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            style={{ 
              padding: '8px 12px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border)', 
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-secondary)',
              fontSize: '14px',
              cursor: notifications.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <X size={16} /> Clear all
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
            padding: '64px 0',
            color: 'var(--text-muted)',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: 'var(--radius-full)', 
              backgroundColor: 'var(--bg-secondary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Bell size={32} />
            </div>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>No notifications</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>You&apos;re all caught up!</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div 
              key={notif.id}
              onClick={() => handleMarkRead(notif.id, notif.ticket_id)}
              className="notification-item"
              style={{ 
                padding: '16px', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border)',
                backgroundColor: notif.is_read ? 'var(--bg)' : 'var(--accent-subtle)',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                gap: '16px',
                transition: 'var(--transition)',
              }}
            >
              <div style={{ 
                width: '40px', 
                height: '40px', 
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ 
                    fontWeight: notif.is_read ? '500' : '700', 
                    color: 'var(--text)',
                    fontSize: '15px'
                  }}>
                    {notif.title}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    {formatTime(notif.created_at)}
                  </span>
                </div>
                
                <p style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '14px', 
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {notif.body}
                </p>

                {notif.ticket_id && (
                  <Link 
                    href={`/dashboard/tickets/${notif.ticket_id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ 
                      fontSize: '13px', 
                      color: 'var(--accent)', 
                      textDecoration: 'none',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    View ticket <ArrowRight size={14} />
                  </Link>
                )}
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
                  top: '12px',
                  right: '12px',
                  opacity: 0,
                  transition: 'var(--transition)'
                }}
              >
                <X size={16} />
              </button>

              <style jsx>{`
                .notification-item:hover {
                  border-color: var(--border-subtle);
                  background-color: ${notif.is_read ? 'var(--bg-secondary)' : 'var(--accent-subtle)'};
                }
                .notification-item:hover .delete-btn {
                  opacity: 1;
                }
                .delete-btn:hover {
                  background-color: var(--danger-bg);
                  color: var(--danger);
                }
              `}</style>
            </div>
          ))
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
