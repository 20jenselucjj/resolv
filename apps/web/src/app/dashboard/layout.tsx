'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Menu, Bell } from 'lucide-react';
import { useStore, User } from '@/lib/store';
import { api, refreshAccessToken, getToken } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { ToastContainer, toast } from '@/components/Toast';
import { connectSocket } from '@/lib/socket';

import { StatusConfigProvider } from '@/lib/StatusConfigContext';

const AiPanel = dynamic(() => import('@/components/AiPanel').then((m) => m.AiPanel), { ssr: false });
const CommandPalette = dynamic(() => import('@/components/CommandPalette').then((m) => m.CommandPalette), { ssr: false });
const NewTicketPanel = dynamic(() => import('@/components/NewTicketPanel').then((m) => m.NewTicketPanel), { ssr: false });
const NotificationsPanel = dynamic(() => import('@/components/NotificationsPanel').then((m) => m.NotificationsPanel), { ssr: false });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser, token, setToken: setStoreToken, unreadCount } = useStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth init: restore token from sessionStorage or refresh from refresh token on cold page load
  useEffect(() => {
    if (!mounted) return;

    // Check if we have a token in sessionStorage (restored from page reload)
    const storedToken = getToken();
    if (storedToken) {
      setStoreToken(storedToken);
      setAuthReady(true);
      return;
    }

    // No stored token — try to refresh using refresh token
    const savedRefresh = localStorage.getItem('resolv_refresh_token');
    if (!savedRefresh) {
      setAuthReady(true); // No refresh token — the auth check below will redirect
      return;
    }

    refreshAccessToken()
      .then(async (newToken) => {
        setStoreToken(newToken); // sets both in-memory + zustand store
        const res = await api.get<{ data: User }>('/auth/me');
        setUser(res.data);
        if (res.data.passwordResetRequired) {
          router.push('/force-password-change');
          return;
        }
        setAuthReady(true);
      })
      .catch(() => {
        localStorage.removeItem('resolv_refresh_token');
        setAuthReady(true);
      });
  }, [mounted]);

  useEffect(() => {
    const handler = () => setNewTicketOpen(true);
    window.addEventListener('resolv:new-ticket', handler);
    return () => window.removeEventListener('resolv:new-ticket', handler);
  }, []);

  // Keyboard shortcut: C key opens New Ticket panel (when not focused on an input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'c' && !(e.target as HTMLElement).matches('input,textarea,select,button') && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setNewTicketOpen(true);
        setAiOpen(false);
        setNotificationsOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!mounted || !authReady) return;
    // Redirect to login if no token (either from store or sessionStorage) and no refresh token
    const hasToken = token || getToken();
    if (!hasToken && !localStorage.getItem('resolv_refresh_token')) {
      router.push('/login');
      return;
    }
    if (!user && token) {
      api.get<{ data: User }>('/auth/me')
        .then((res) => {
          setUser(res.data);
          if (res.data.passwordResetRequired) {
            router.push('/force-password-change');
          }
        })
        .catch(() => router.push('/login'));
    }
  }, [mounted, authReady, token, user]);

  // Socket listener for real-time notification popups
  useEffect(() => {
    if (!mounted || !authReady || !user) return;
    if (user.notification_popups === false) return; // user disabled popups

    const socket = connectSocket();
    if (!socket) return;

    const handleNotification = async (data: { ticketId?: string }) => {
      try {
        const res = await api.get<{ data: any[] }>('/notifications?limit=1');
        const latest = res.data?.[0];
        if (!latest) return;

        const { notifications, setNotifications } = useStore.getState();
        setNotifications([latest, ...notifications.filter(n => n.id !== latest.id)]);

        const ticketId = latest.ticket_id || data.ticketId;
        const toastId = toast.show({
          type: 'info',
          title: latest.title || 'New notification',
          message: latest.body || '',
          duration: 6000,
          onClick: ticketId ? () => {
            toast.dismiss(toastId);
            router.push(`/dashboard/tickets/${ticketId}`);
          } : undefined,
        });
      } catch (e) {
        // Silently fail — notification polling still works
      }
    };

    socket.on('notification:new', handleNotification);
    return () => { socket.off('notification:new', handleNotification); };
  }, [mounted, authReady, user, router]);

  if (!mounted || !authReady) return null;
  const hasToken = token || (typeof window !== 'undefined' && getToken());
  if (!hasToken) return null;

  return (
    <StatusConfigProvider>
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar 
        onAiOpen={() => { setAiOpen(true); setNewTicketOpen(false); setNotificationsOpen(false); }} 
        onNewTicket={() => { setNewTicketOpen(true); setAiOpen(false); setNotificationsOpen(false); }}
        onNotificationsOpen={() => { setNotificationsOpen(true); setAiOpen(false); setNewTicketOpen(false); }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="mobile-header">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
          >
            <Menu size={20} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Resolv</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
            <button onClick={() => setNotificationsOpen(true)} style={{ position: 'relative', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: 700,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {user && (
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-inverse)',
                flexShrink: 0,
              }}>
                {user.name[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
        {children}
      </main>
      <AiPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      {newTicketOpen && (
        <NewTicketPanel 
          onClose={() => setNewTicketOpen(false)} 
          onCreated={() => setNewTicketOpen(false)} 
        />
      )}
      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <CommandPalette />
      <ToastContainer />
    </div>
    </StatusConfigProvider>
  );
}
