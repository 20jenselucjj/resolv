'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Menu, Bell } from 'lucide-react';
import { useStore, User } from '@/lib/store';
import { api, refreshAccessToken } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { ToastContainer } from '@/components/Toast';

const AiPanel = dynamic(() => import('@/components/AiPanel').then((m) => m.AiPanel), { ssr: false });
const CommandPalette = dynamic(() => import('@/components/CommandPalette').then((m) => m.CommandPalette), { ssr: false });
const NewTicketPanel = dynamic(() => import('@/components/NewTicketPanel').then((m) => m.NewTicketPanel), { ssr: false });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser, token, setToken: setStoreToken, unreadCount } = useStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth init: try to refresh access token from stored refresh token on cold page load
  useEffect(() => {
    if (!mounted) return;
    if (token) {
      // Already authed (SPA navigation) — just mark ready
      setAuthReady(true);
      return;
    }

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

  useEffect(() => {
    if (!mounted || !authReady) return;
    if (!token && !localStorage.getItem('resolv_refresh_token')) {
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

  if (!mounted || !authReady) return null;
  if (!token) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar 
        onAiOpen={() => { setAiOpen(true); setNewTicketOpen(false); }} 
        onNewTicket={() => { setNewTicketOpen(true); setAiOpen(false); }}
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
            <Link href="/dashboard/notifications" style={{ position: 'relative', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
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
            </Link>
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
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}
