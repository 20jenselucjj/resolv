'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useStore, User } from '@/lib/store';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { ToastContainer } from '@/components/Toast';

const AiPanel = dynamic(() => import('@/components/AiPanel').then((m) => m.AiPanel), { ssr: false });
const CommandPalette = dynamic(() => import('@/components/CommandPalette').then((m) => m.CommandPalette), { ssr: false });
const NewTicketPanel = dynamic(() => import('@/components/NewTicketPanel').then((m) => m.NewTicketPanel), { ssr: false });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser, token } = useStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = () => setNewTicketOpen(true);
    window.addEventListener('resolv:new-ticket', handler);
    return () => window.removeEventListener('resolv:new-ticket', handler);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      router.push('/login');
      return;
    }
    if (!user) {
      api.get<{ data: User }>('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => router.push('/login'));
    }
  }, [mounted, token, user]);

  if (!mounted) return null;
  if (!token) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar 
        onAiOpen={() => { setAiOpen(true); setNewTicketOpen(false); }} 
        onNewTicket={() => { setNewTicketOpen(true); setAiOpen(false); }}
      />
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
