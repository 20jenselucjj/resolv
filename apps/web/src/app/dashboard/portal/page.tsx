'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { api, API_BASE, getToken } from '@/lib/api';
import {
  Search, Sparkles, Send, Plus, AlertTriangle, Package,
  KeyRound, Wifi, Monitor, HelpCircle, ChevronRight,
  Clock, CheckCircle2, Check, Circle, Loader2, X, FileText,
  BookOpen, ArrowRight, Paperclip, User as UserIcon,
  UploadCloud, Trash2, ExternalLink, MessageSquare,
  Zap, Shield, RefreshCw, History
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ticket {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  category_name?: string;
  views: number;
}

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AiSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SspDoc {
  id: string;
  title: string;
  filename: string;
  url: string;
  created_at: string;
}

// ─── Quick Actions (Dynamic) ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open:        { label: 'Open',        color: '#3b82f6', bg: '#eff6ff',  icon: Circle },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb',  icon: RefreshCw },
  closed:      { label: 'Closed',      color: '#10b981', bg: '#ecfdf5',  icon: CheckCircle2 },
  resolved:    { label: 'Closed',      color: '#10b981', bg: '#ecfdf5',  icon: CheckCircle2 },
  pending:     { label: 'Pending',     color: '#8b5cf6', bg: '#f5f3ff',  icon: Clock },
};

// ─── Formatted Message ─────────────────────────────────────────────────────────
function FormattedMessage({ text }: { text: string }) {
  // Sanitize: escape HTML first, then apply safe formatting
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  const html = escaped
    .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.05);padding:12px;border-radius:6px;margin:8px 0;overflow-x:auto;font-size:13px;border:1px solid var(--border)"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/- ([^\n]+)/g, '• $1');
  return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SelfServicePortal() {
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  // Settings
  const [portalSettings, setPortalSettings] = useState<Record<string, string>>({});

  const quickActions = useMemo(() => [
    { icon: AlertTriangle, label: portalSettings.portal_qa_1_label || 'Report an Issue',   color: '#ef4444', bg: '#fef2f2', border: '#fecaca', prompt: portalSettings.portal_qa_1_prompt || 'I need to report an issue with my computer or software.' },
    { icon: KeyRound,      label: portalSettings.portal_qa_2_label || 'Password / Access', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', prompt: portalSettings.portal_qa_2_prompt || 'I need help with a password reset or access to a system.' },
    { icon: Monitor,       label: portalSettings.portal_qa_3_label || 'Hardware Request',  color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', prompt: portalSettings.portal_qa_3_prompt || 'I need to request new hardware or equipment.' },
    { icon: Package,       label: portalSettings.portal_qa_4_label || 'Software Request',  color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', prompt: portalSettings.portal_qa_4_prompt || 'I need a software license or application installed.' },
    { icon: Wifi,          label: portalSettings.portal_qa_5_label || 'Network / VPN',     color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', prompt: portalSettings.portal_qa_5_prompt || 'I am having network connectivity or VPN issues.' },
    { icon: HelpCircle,    label: portalSettings.portal_qa_6_label || 'Something Else',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', prompt: portalSettings.portal_qa_6_prompt || 'I need help with something not listed here.' },
  ], [portalSettings]);

  // Search for KB
  const [kbSearch, setKbSearch] = useState('');

  // My Tickets
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  // KB Articles
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);

  // AI Chat
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Chat History
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<AiSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // File upload for AI chat
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; filename: string; size: number }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropSuccess, setDropSuccess] = useState(false);

  // Drag-and-drop for ticket submission form
  const [ticketDragOver, setTicketDragOver] = useState(false);

  const ALLOWED_FILE_TYPES = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.pdf,.txt,.log,.csv,.doc,.docx,.xlsx,.xls,.json,.xml,.yaml,.yml';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Flash success indicator
    setDropSuccess(true);
    setTimeout(() => setDropSuccess(false), 800);

    for (const file of files) {
      if (uploadingFile) break;
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        const res = await fetch(`${API_BASE}/ai/upload`, {
          method: 'POST',
          body: formData,
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok) {
          const data = await res.json();
          setUploadedFiles(prev => [...prev, { id: data.data.id, filename: data.data.filename, size: data.data.size }]);
        }
      } catch (err) {
        console.error('File upload failed:', err);
      } finally {
        setUploadingFile(false);
      }
    }
  };

  // New Ticket Panel
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'medium', ticket_type: 'incident' });
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);

  // Admin Docs
  const [sspDocs, setSspDocs] = useState<SspDoc[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Load portal settings
    api.get<{ data: Record<string, string> }>('/settings/portal')
      .then(res => setPortalSettings(res.data || {}))
      .catch(() => {});

    // Load my tickets
    api.get<{ data: Ticket[] }>('/tickets?pageSize=5')
      .then(res => setMyTickets(res.data?.slice(0, 5) || []))
      .catch(() => setMyTickets([]))
      .finally(() => setTicketsLoading(false));

    // Load KB articles
    api.get<{ data: KBArticle[] }>('/knowledge?status=published&pageSize=6')
      .then(res => setKbArticles(res.data || []))
      .catch(() => {});
  }, []);

  // ── Restore last chat session (within 1 hour) ───────────────────────────
  useEffect(() => {
    const storedId = localStorage.getItem('portal_session_id');
    const storedTime = localStorage.getItem('portal_session_time');
    if (!storedId || !storedTime) return;

    const elapsed = Date.now() - parseInt(storedTime, 10);
    if (elapsed > 3600000) { // older than 1 hour — clear
      localStorage.removeItem('portal_session_id');
      localStorage.removeItem('portal_session_time');
      return;
    }

    api.get<{ data: { role: string; content: string }[] }>(`/ai/sessions/${storedId}/messages`)
      .then(res => {
      const msgs = (res?.data || []).filter(m => m.role !== 'system' && m.role !== 'tool').map(m => ({
          id: Math.random().toString(36).slice(2),
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        if (msgs.length > 0) {
          setMessages(msgs);
          setSessionId(storedId);
          setChatStarted(true);
        } else {
          localStorage.removeItem('portal_session_id');
          localStorage.removeItem('portal_session_time');
        }
      })
      .catch(() => {
        localStorage.removeItem('portal_session_id');
        localStorage.removeItem('portal_session_time');
      });
  }, []);

  useEffect(() => {
    if (kbSearch.length > 1) {
      api.get<{ data: KBArticle[] }>(`/knowledge?status=published&search=${encodeURIComponent(kbSearch)}&pageSize=5`)
        .then(res => setKbArticles(res.data || []))
        .catch(() => {});
    } else if (kbSearch === '') {
      api.get<{ data: KBArticle[] }>('/knowledge?status=published&pageSize=6')
        .then(res => setKbArticles(res.data || []))
        .catch(() => {});
    }
  }, [kbSearch]);

  useEffect(() => {
    // Scroll only the chat messages container, not the entire page
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, aiLoading]);

  // ── AI Chat File Upload ────────────────────────────────────────────────────
  const handleAiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(`${API_BASE}/ai/upload`, {
        method: 'POST',
        body: formData,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(prev => [...prev, { id: data.data.id, filename: data.data.filename, size: data.data.size }]);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeAiFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const truncateFilename = (name: string, maxLen = 24) => {
    if (name.length <= maxLen) return name;
    const ext = name.lastIndexOf('.');
    if (ext === -1) return name.slice(0, maxLen - 3) + '...';
    const extStr = name.slice(ext);
    const base = name.slice(0, ext);
    const maxBase = maxLen - extStr.length - 3;
    if (maxBase < 1) return name.slice(0, maxLen - 3) + '...';
    return base.slice(0, maxBase) + '...' + extStr;
  };

  const isImageFile = (name: string) => /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(name);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  // ── AI Chat ────────────────────────────────────────────────────────────────
  const sendMessage = async (overrideText?: string) => {
    const text = overrideText ?? inputText;
    if (!text.trim() || aiLoading) return;
    if (!chatStarted) setChatStarted(true);
    const originalInput = inputText;
    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Append uploaded file IDs to message so AI can reference them
    let messageText = text.trim();
    if (uploadedFiles.length > 0 && !overrideText) {
      const fileIds = uploadedFiles.map(f => f.id).join(',');
      messageText = `${messageText}\n[Attached Files: ${fileIds}]`;
      setUploadedFiles([]);
    }

    const userMsg: AiMessage = { id: Date.now().toString(), role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setAiLoading(true);

    try {
      let sid = sessionId;
      if (!sid) {
        const res = await api.post<{ data: { id: string } }>('/ai/sessions', { title: originalInput.substring(0, 40) });
        sid = res.data.id;
        setSessionId(sid);
        localStorage.setItem('portal_session_id', sid);
        localStorage.setItem('portal_session_time', String(Date.now()));
      }
      const res = await api.post<{ data: { content: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>('/ai/chat', { session_id: sid, message: messageText });
      setMessages(prev => [...prev, { id: Date.now().toString() + 'ai', role: 'assistant', content: res.data.content }]);

      // If the AI created a ticket, refresh the ticket list so it shows up without a manual refresh
      const createdTicket = res.data.tool_calls?.find((tc: any) => tc.function?.name === 'create_ticket')
      if (createdTicket) {
        api.get<{ data: Ticket[] }>('/tickets?pageSize=5')
          .then(ticketsRes => setMyTickets(ticketsRes.data?.slice(0, 5) || []))
          .catch(() => {})
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString() + 'err', role: 'assistant', content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setChatStarted(true);
    setTimeout(() => inputRef.current?.focus(), 100);
    sendMessage(prompt);
  };

  // ── Chat History ────────────────────────────────────────────────────────────
  const loadHistorySessions = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get<{ data: AiSession[] }>('/ai/sessions');
      setHistorySessions((res?.data || []).slice(0, 5));
    } catch {
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSession = async (sid: string) => {
    try {
      const res = await api.get<{ data: { role: string; content: string }[] }>(`/ai/sessions/${sid}/messages`);
      const msgs = (res?.data || []).filter(m => m.role !== 'system').map(m => ({
        id: Math.random().toString(36).slice(2),
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      setMessages(msgs);
      setSessionId(sid);
      setChatStarted(true);
      setShowHistory(false);
      localStorage.setItem('portal_session_id', sid);
      localStorage.setItem('portal_session_time', String(Date.now()));
    } catch {
      console.error('Failed to load session');
    }
  };

  // Close history dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  // ── Ticket Form Drag & Drop ────────────────────────────────────────────────
  const handleTicketDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setTicketDragOver(true);
    }
  };

  const handleTicketDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if actually leaving the container (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setTicketDragOver(false);
    }
  };

  const handleTicketDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTicketDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    setTicketFiles(prev => [...prev, ...files]);
  };
  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.title.trim()) { setTicketError('Title is required'); return; }
    setTicketLoading(true);
    setTicketError('');
    try {
      const res = await api.post<{ data: Ticket }>('/tickets', ticketForm);
      const created = res.data;

      // Upload attached files
      if (ticketFiles.length > 0) {
        const token = getToken();
        for (const file of ticketFiles) {
          const formData = new FormData();
          formData.append('file', file);
          await fetch(`${API_BASE}/tickets/${created.id}/attachments`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
        }
        setTicketFiles([]);
      }

      setMyTickets(prev => [res.data, ...prev].slice(0, 5));
      setTicketSuccess(true);
      setTimeout(() => { setShowTicketForm(false); setTicketSuccess(false); setTicketForm({ title: '', description: '', priority: 'medium', ticket_type: 'incident' }); }, 2000);
    } catch (err: any) {
      setTicketError(err.message || 'Failed to create ticket');
    } finally {
      setTicketLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeInScale { from { opacity:0; transform:scale(0.98); } to { opacity:1; transform:scale(1); } }
        @keyframes typingBounce { 0%,80%,100% { transform:translateY(0); opacity:0.4; } 40% { transform:translateY(-5px); opacity:1; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .ssp-card { transition: box-shadow 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.25s cubic-bezier(0.4,0,0.2,1); }
        .ssp-card:hover { box-shadow: var(--shadow-lg); border-color: var(--accent-border) !important; transform: translateY(-2px); }
        .qa-btn { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
        .qa-btn:hover { box-shadow: var(--shadow-md); background: var(--bg-secondary) !important; border-color: var(--accent-border) !important; transform: translateY(-2px); }
        .qa-btn:active { transform: translateY(0) scale(0.98); }
        .typing-dot { width:6px; height:6px; border-radius:50%; background:#2563eb; animation: typingBounce 1.2s infinite ease-in-out; }
        .ssp-input:focus { border-color: var(--accent-mid) !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important; }
        .msg-in { animation: fadeInUp 0.25s cubic-bezier(0.4,0,0.2,1) forwards; }
        .page-section { animation: fadeInUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards; opacity:0; }
        .kb-card { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .kb-card:hover { background: var(--bg-secondary); border-color: var(--accent-border) !important; box-shadow: var(--shadow-md); transform: translateY(-3px); }
        .kb-card:hover .kb-arrow { transform: translateX(4px); }
      `}</style>

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 35%, #1e40af 65%, #2563eb 100%)',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontSize:18, fontWeight:700, color:'white', lineHeight:1.2, marginBottom:2 }}>
            {portalSettings.portal_company_name || 'IT Self Service'}
          </div>
          <div style={{ fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.7)' }}>
            {portalSettings.portal_hero_subtitle || 'Welcome to the self-service portal'}
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 32px 60px', width:'100%', flex:1, boxSizing:'border-box' }}>

        {/* ── Quick Actions ──────────────────────────────────────────────────── */}
        <div className="page-section" style={{ marginBottom:36, animationDelay:'0.1s' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14 }}>
              {quickActions.map((qa, i) => (
                <button
                  key={i}
                  className="qa-btn"
                  onClick={() => handleQuickAction(qa.prompt)}
                  style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'16px 18px',
                    background:'var(--card)',
                    border:`1px solid var(--border)`,
                    borderRadius:14, cursor:'pointer', textAlign:'left',
                    boxShadow:'var(--shadow-sm)',
                  }}
                >
                  <div style={{ width:38, height:38, borderRadius:10, background:qa.bg, border:`1px solid ${qa.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <qa.icon size={17} color={qa.color} />
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{qa.label}</span>
                  <ChevronRight size={14} color="var(--text-muted)" style={{ marginLeft:'auto', flexShrink:0 }} />
                </button>
              ))}
            </div>
          </div>

        {/* ── Two-column layout: AI Chat + My Tickets ───────────────────────── */}
        <div className="page-section" style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) 360px', gap:24, marginBottom:32, animationDelay:'0.2s' }}>

          {/* ── AI Chat Panel ────────────────────────────────────────────────── */}
          <div className="ssp-card" style={{
            background:'var(--card)', border:'1px solid var(--border)',
            borderRadius:16, overflow:'hidden',
            display:'flex', flexDirection:'column',
            minHeight:440, maxHeight:560,
            boxShadow:'var(--shadow-sm)',
          }}>
            {/* Chat header */}
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Sparkles size={15} color="white" />
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                  Resolv AI
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', display:'inline-block' }} />
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Always here to help</div>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                <div ref={historyRef} style={{ position:'relative' }}>
                  <button
                    onClick={() => { loadHistorySessions(); setShowHistory(h => !h); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color: showHistory ? '#2563eb' : 'var(--text-muted)', display:'flex', padding:4, borderRadius:4, transition:'color 0.15s ease' }}
                    title="Chat history"
                  >
                    <History size={14} />
                  </button>
                  {showHistory && (
                    <div style={{
                      position:'absolute', right:0, top:'100%', marginTop:6,
                      width:240, background:'var(--card)', border:'1px solid var(--border)',
                      borderRadius:12, boxShadow:'0 8px 30px rgba(0,0,0,0.12)',
                      overflow:'hidden', zIndex:50,
                    }}>
                      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border-subtle)', fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        Recent Chats
                      </div>
                      <div style={{ maxHeight:280, overflowY:'auto' }}>
                        {historyLoading ? (
                          <div style={{ padding:20, textAlign:'center' }}><Loader2 size={16} className="animate-spin" color="#2563eb" /></div>
                        ) : historySessions.length === 0 ? (
                          <div style={{ padding:'20px 14px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>No previous chats</div>
                        ) : historySessions.map(s => (
                          <button
                            key={s.id}
                            onClick={() => loadSession(s.id)}
                            style={{
                              width:'100%', padding:'10px 14px', textAlign:'left',
                              background:'transparent', border:'none', cursor:'pointer',
                              transition:'background 0.15s ease',
                              display:'flex', flexDirection:'column', gap:2,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize:13, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title || 'New Chat'}</span>
                            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(s.updated_at || s.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => { setMessages([]); setSessionId(null); setChatStarted(false); localStorage.removeItem('portal_session_id'); localStorage.removeItem('portal_session_time'); }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:11, display:'flex', alignItems:'center', gap:4, transition:'color 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Plus size={12} /> New chat
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:16 }}>
              {!chatStarted ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', textAlign:'center', padding:'0 20px' }}>
                  <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, boxShadow:'0 8px 20px rgba(37,99,235,0.25)' }}>
                    <Sparkles size={24} color="white" />
                  </div>
                  <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 6px', color:'var(--text)' }}>Ask me anything</h3>
                  <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 20px', lineHeight:1.5 }}>
                    I can help you troubleshoot issues, find answers, or submit a ticket on your behalf.
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
                    {['My computer is slow', 'I need VPN access', 'Reset my password', 'Track my ticket'].map(s => (
                      <button key={s} onClick={() => sendMessage(s)} style={{ padding:'6px 12px', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:20, fontSize:12, fontWeight:500, color:'var(--text)', cursor:'pointer', transition:'all 0.15s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#2563eb'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(msg => (
                    <div key={msg.id} className="msg-in" style={{ display:'flex', flexDirection:'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {msg.role === 'user' ? (
                        <div style={{ background:'#2563eb', color:'white', padding:'10px 14px', borderRadius:'16px 16px 4px 16px', fontSize:14, lineHeight:1.5, maxWidth:'85%', boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}>
                          {msg.content}
                        </div>
                      ) : (
                        <div style={{ display:'flex', gap:10, maxWidth:'95%', alignItems:'flex-start' }}>
                          <div style={{ width:26, height:26, borderRadius:6, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                            <Sparkles size={12} color="white" />
                          </div>
                          <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'4px 16px 16px 16px', padding:'10px 14px', flex:1 }}>
                            <FormattedMessage text={msg.content} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {aiLoading && (
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <div style={{ width:26, height:26, borderRadius:6, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Sparkles size={12} color="white" />
                      </div>
                      <div style={{ display:'flex', gap:4, alignItems:'center', background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'4px 16px 16px 16px', padding:'12px 16px' }}>
                        <div className="typing-dot" style={{ animationDelay:'0ms' }} />
                        <div className="typing-dot" style={{ animationDelay:'160ms' }} />
                        <div className="typing-dot" style={{ animationDelay:'320ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input — supports drag-and-drop file upload */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                padding:'12px 14px', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', flexShrink:0,
                position:'relative',
                outline: dragOver ? '2px dashed #2563eb' : 'none',
                outlineOffset: dragOver ? -2 : 0,
                transition: 'outline 0.15s ease',
              }}
            >
              {/* Drag-over overlay */}
              {dragOver && (
                <div style={{
                  position:'absolute', inset:0, zIndex:10,
                  background:'rgba(37,99,235,0.06)',
                  borderRadius:10,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  gap:8, fontSize:14, fontWeight:600, color:'#2563eb',
                  pointerEvents:'none',
                }}>
                  <UploadCloud size={20} /> Drop files here
                </div>
              )}
              {/* Drop success flash */}
              {dropSuccess && (
                <div style={{
                  position:'absolute', inset:0, zIndex:10,
                  background:'rgba(16,185,129,0.08)',
                  borderRadius:10,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  gap:8, fontSize:14, fontWeight:600, color:'#10b981',
                  pointerEvents:'none',
                  animation:'fadeInUp 0.2s ease-out',
                }}>
                  <Check size={18} /> Files added
                </div>
              )}
              {/* Uploaded files preview */}
              {uploadedFiles.length > 0 && (
                <div style={{
                  marginBottom:8, padding:8, borderRadius:8,
                  background:'var(--bg-secondary)',
                  border:'1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} attached
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {uploadedFiles.map(f => (
                      <div key={f.id} style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'5px 8px', borderRadius:6,
                        background:'var(--card)',
                        border:'1px solid var(--border)',
                      }}>
                        <div style={{ width:24, height:24, borderRadius:4, background:'rgba(37,99,235,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <FileText size={13} color="#2563eb" />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={f.filename}>
                            {truncateFilename(f.filename)}
                          </div>
                        </div>
                        <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0, whiteSpace:'nowrap' }}>{formatSize(f.size)}</span>
                        <button
                          onClick={() => removeAiFile(f.id)}
                          style={{
                            width:20, height:20, borderRadius:4,
                            background:'transparent', border:'none',
                            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                            color:'var(--text-muted)', flexShrink:0,
                            transition:'all 0.15s ease',
                          }}
                          title="Remove file"
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'flex', gap:8, alignItems:'flex-end', background:'var(--card)', border:'1.5px solid var(--border)', borderRadius:10, padding:'6px 6px 6px 4px', transition:'border-color 0.2s' }}
                onFocusCapture={e => (e.currentTarget.style.borderColor = '#2563eb')}
                onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {/* File upload button */}
                <button
                  onClick={() => aiFileInputRef.current?.click()}
                  disabled={uploadingFile}
                  style={{
                    width:30, height:30, borderRadius:6, flexShrink:0,
                    background:'transparent', color:'var(--text-muted)',
                    border:'none', display:'flex', alignItems:'center', justifyContent:'center',
                    cursor: uploadingFile ? 'default' : 'pointer',
                    transition:'all 0.15s ease',
                  }}
                  title="Attach file"
                  onMouseEnter={e => { if (!uploadingFile) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {uploadingFile ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={15} />}
                </button>
                <input ref={aiFileInputRef} type="file" accept={ALLOWED_FILE_TYPES} style={{ display:'none' }} onChange={handleAiFileUpload} disabled={uploadingFile} />
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => { setInputText(e.target.value); e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                  onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Drop files here or message Resolv AI..."
                  disabled={aiLoading}
                  rows={1}
                  style={{ flex:1, background:'transparent', border:'none', outline:'none', resize:'none', fontSize:14, color:'var(--text)', fontFamily:'inherit', minHeight:32, maxHeight:120, padding:'4px 0' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputText.trim() || aiLoading}
                  style={{ width:32, height:32, borderRadius:8, border:'none', cursor: inputText.trim() && !aiLoading ? 'pointer' : 'default', background: inputText.trim() && !aiLoading ? 'linear-gradient(135deg,#2563eb,#4f46e5)' : 'var(--bg-tertiary)', color: inputText.trim() && !aiLoading ? 'white' : 'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s', flexShrink:0 }}
                  onMouseEnter={e => { if (inputText.trim() && !aiLoading) e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={e => { if (inputText.trim() && !aiLoading) e.currentTarget.style.opacity = '1'; }}
                >
                  <Send size={14} style={{ marginLeft:1 }} />
                </button>
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5, textAlign:'center' }}>Enter to send · Shift+Enter for new line</div>
            </div>
          </div>

          {/* ── Right Column: My Tickets + Submit ────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20, minWidth:0 }}>

            {/* Submit a Request */}
            <div className="ssp-card" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Plus size={14} color="white" />
                  </div>
                  <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Submit a Request</span>
                </div>
              </div>
              {!showTicketForm ? (
                <div style={{ padding:20 }}>
                  <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 16px', lineHeight:1.6 }}>
                    Can't find what you need? Submit a support request and our team will help you.
                  </p>
                  <button
                    onClick={() => setShowTicketForm(true)}
                    style={{ width:'100%', padding:'12px', background:'linear-gradient(135deg,#2563eb,#4f46e5)', color:'white', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.2s cubic-bezier(0.4,0,0.2,1)', boxShadow:'0 4px 14px rgba(37,99,235,0.25)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.35)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.25)'; }}
                  >
                    <Plus size={15} /> New Request
                  </button>
                </div>
              ) : ticketSuccess ? (
                <div style={{ padding:28, textAlign:'center' }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--success-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                    <CheckCircle2 size={24} color="var(--success)" />
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>Request submitted!</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:6, lineHeight:1.5 }}>We'll be in touch soon.</div>
                </div>
              ) : (
                <div
                  onDragOver={handleTicketDragOver}
                  onDragLeave={handleTicketDragLeave}
                  onDrop={handleTicketDrop}
                  style={{ position:'relative' }}
                >
                  {/* Drag-over overlay */}
                  {ticketDragOver && (
                    <div style={{
                      position:'absolute', inset:0, zIndex:10,
                      background:'rgba(37,99,235,0.08)',
                      border:'2px dashed #2563eb', borderRadius:8, margin:8,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      gap:8, fontSize:14, fontWeight:600, color:'#2563eb',
                      pointerEvents:'none',
                    }}>
                      <UploadCloud size={20} /> Drop files to attach
                    </div>
                  )}
                  <form onSubmit={submitTicket} style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
                  <input
                    autoFocus
                    className="input ssp-input"
                    value={ticketForm.title}
                    onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="What do you need help with?"
                    style={{ fontSize:13 }}
                  />
                  <textarea
                    className="textarea ssp-input"
                    value={ticketForm.description}
                    onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the issue..."
                    rows={3}
                    style={{ fontSize:13, resize:'vertical', minHeight:72 }}
                  />
                  {/* File Attachments */}
                  <input
                    ref={ticketFileInputRef}
                    type="file"
                    multiple
                    style={{ display:'none' }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setTicketFiles(prev => [...prev, ...files]);
                      if (e.target) e.target.value = '';
                    }}
                  />
                  {ticketFiles.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:6, padding:10, borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2 }}>Attachments</div>
                      {ticketFiles.map((file, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, background:'var(--card)', border:'1px solid var(--border)', fontSize:12 }}>
                          <div style={{ width:22, height:22, borderRadius:4, background:'rgba(37,99,235,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <FileText size={12} color="#2563eb" />
                          </div>
                          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)', fontWeight:500 }}>{file.name}</span>
                          <span style={{ color:'var(--text-muted)', flexShrink:0, fontSize:11 }}>{(file.size / 1024).toFixed(0)}KB</span>
                          <button type="button" onClick={() => setTicketFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, display:'flex', borderRadius:4, transition:'all 0.15s ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => ticketFileInputRef.current?.click()}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:8, border:'1.5px dashed var(--border)', background:'var(--bg-secondary)', color:'var(--text-muted)', cursor:'pointer', fontSize:12, justifyContent:'center', fontWeight:500, transition:'all 0.2s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-subtle)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  >
                    <UploadCloud size={14} />
                    {ticketFiles.length > 0 ? `${ticketFiles.length} file(s) attached` : 'Attach screenshots or files'}
                  </button>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <select className="select" value={ticketForm.priority} onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))} style={{ fontSize:12 }}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <select className="select" value={ticketForm.ticket_type} onChange={e => setTicketForm(f => ({ ...f, ticket_type: e.target.value }))} style={{ fontSize:12 }}>
                      <option value="incident">Incident</option>
                      <option value="service_request">Service Request</option>
                      <option value="problem">Problem</option>
                    </select>
                  </div>
                  {ticketError && <div style={{ fontSize:12, color:'var(--danger)', padding:'8px 12px', background:'var(--danger-bg)', borderRadius:8, border:'1px solid var(--danger-border)' }}>{ticketError}</div>}
                  <div style={{ display:'flex', gap:10, marginTop:4 }}>
                    <button type="submit" disabled={ticketLoading} className="btn btn-primary" style={{ flex:1, fontSize:13, height:40, borderRadius:10, boxShadow:'0 4px 14px rgba(37,99,235,0.2)', transition:'all 0.2s ease' }}
                      onMouseEnter={e => { if (!ticketLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.3)'; } }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.2)'; }}
                    >
                      {ticketLoading ? <Loader2 size={14} className="animate-spin" /> : 'Submit Request'}
                    </button>
                    <button type="button" onClick={() => { setShowTicketForm(false); setTicketError(''); }} className="btn btn-ghost" style={{ fontSize:13, height:40, borderRadius:10 }}>Cancel</button>
                  </div>
                </form>
                </div>
              )}
            </div>

            {/* My Tickets */}
            <div className="ssp-card" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)', flex:1 }}>
              <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <MessageSquare size={14} color="white" />
                  </div>
                  <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>My Requests</span>
                </div>
                <a href="/dashboard/tickets" style={{ fontSize:12, color:'var(--accent)', textDecoration:'none', display:'flex', alignItems:'center', gap:3, fontWeight:600, transition:'all 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  View all <ArrowRight size={12} />
                </a>
              </div>
              <div style={{ padding:'10px' }}>
                {ticketsLoading ? (
                  <div style={{ padding:28, textAlign:'center' }}><Loader2 size={20} className="animate-spin" color="#2563eb" /></div>
                ) : myTickets.length === 0 ? (
                  <div style={{ padding:'28px 20px', textAlign:'center' }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--success-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                      <CheckCircle2 size={20} color="var(--success)" />
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>All clear!</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4, lineHeight:1.5 }}>No open requests.</div>
                  </div>
                ) : myTickets.map(ticket => {
                  const s = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  return (
                    <a key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 10px', borderRadius:10, textDecoration:'none', transition:'all 0.2s ease', border:'1px solid transparent', marginBottom:4 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ width:28, height:28, borderRadius:8, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:700, color:s.color }}>
                        #{ticket.number}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ticket.title}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{new Date(ticket.created_at).toLocaleDateString()}</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:10, background:s.bg, color:s.color, flexShrink:0, letterSpacing:'0.02em' }}>{s.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Knowledge Base ─────────────────────────────────────────────────── */}
        <div className="ssp-card page-section" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom: isAdmin ? 24 : 0, animationDelay:'0.3s' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <BookOpen size={14} color="white" />
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Knowledge Base</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ position:'relative' }}>
                <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
                <input
                  value={kbSearch}
                  onChange={e => setKbSearch(e.target.value)}
                  placeholder="Search articles..."
                  style={{ padding:'6px 10px 6px 30px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--bg)', color:'var(--text)', outline:'none', width:180, transition:'border-color 0.2s, box-shadow 0.2s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <a href="/dashboard/knowledge" style={{ fontSize:12, color:'var(--accent)', textDecoration:'none', display:'flex', alignItems:'center', gap:3, fontWeight:600, transition:'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.transform = 'translateX(0)'; }}
              >
                Browse all <ArrowRight size={12} />
              </a>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, padding:16 }}>
            {kbArticles.length === 0 ? (
              <div style={{ gridColumn:'1/-1', padding:'32px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No articles found.</div>
            ) : kbArticles.map((article, i) => (
              <a
                key={article.id}
                href={`/dashboard/knowledge/${article.slug}`}
                className="kb-card"
                style={{
                  display:'flex', flexDirection:'column', gap:10, padding:'16px',
                  textDecoration:'none', color:'var(--text)',
                  background:'var(--card)',
                  border:'1px solid var(--border)',
                  borderRadius:12,
                  boxShadow:'var(--shadow-sm)',
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent-subtle)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <FileText size={14} color="var(--accent)" />
                  </div>
                  {article.category_name && (
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--accent)', background:'var(--accent-subtle)', padding:'2px 8px', borderRadius:6, border:'1px solid var(--accent-border)' }}>
                      {article.category_name}
                    </span>
                  )}
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.4, color:'var(--text)' }}>{article.title}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>
                  Read article <ArrowRight size={11} style={{ transition:'transform 0.2s ease' }} className="kb-arrow" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* ── Admin: SSP Documents ───────────────────────────────────────────── */}
        {isAdmin && (
          <div className="ssp-card page-section" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)', animationDelay:'0.4s' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Shield size={15} color="#8b5cf6" />
                <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Portal Documents</span>
                <span style={{ fontSize:11, padding:'2px 7px', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:10, fontWeight:600 }}>Admin</span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={docUploading}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'#7c3aed', color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <UploadCloud size={13} /> Upload Document
              </button>
              <input ref={fileInputRef} type="file" style={{ display:'none' }} accept=".pdf,.doc,.docx,.txt,.md" onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setDocUploading(true);
                // Simulate upload — in production wire to /api/attachments or a dedicated endpoint
                await new Promise(r => setTimeout(r, 1200));
                setSspDocs(prev => [...prev, { id: Date.now().toString(), title: file.name.replace(/\.[^.]+$/, ''), filename: file.name, url: '#', created_at: new Date().toISOString() }]);
                setDocUploading(false);
                e.target.value = '';
              }} />
            </div>
            <div style={{ padding:16 }}>
              {sspDocs.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', border:'2px dashed var(--border)', borderRadius:10 }}>
                  <UploadCloud size={28} color="var(--text-muted)" style={{ margin:'0 auto 8px' }} />
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text-muted)' }}>No documents uploaded yet</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Upload PDFs, Word docs, or text files to make them available in the portal.</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {sspDocs.map(doc => (
                    <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border-subtle)' }}>
                      <FileText size={14} color="#7c3aed" />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.title}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{doc.filename} · {new Date(doc.created_at).toLocaleDateString()}</div>
                      </div>
                      <a href={doc.url} style={{ color:'var(--text-muted)', display:'flex' }}><ExternalLink size={13} /></a>
                      <button onClick={() => setSspDocs(prev => prev.filter(d => d.id !== doc.id))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', transition:'color 0.15s ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      ><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
