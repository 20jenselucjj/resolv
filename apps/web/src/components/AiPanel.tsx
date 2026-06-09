'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { api, getToken } from '@/lib/api';
import {
  Sparkles, X, Trash2, Send, Plus,
  User as UserIcon, Check, Loader2, Paperclip,
  Ticket, Search, AlertTriangle, BarChart2, BarChart3, UserPlus, FileText, BookOpen,
  Minimize2, Maximize2, History, UploadCloud
} from 'lucide-react';

interface Session {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

interface ToolCall {
  name: string;
  status: 'pending' | 'success' | 'error';
  result?: string;
}

interface Suggestion {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at?: string;
  tool_calls?: ToolCall[];
  suggestions?: Suggestion[];
}

const SUGGESTED_PROMPTS = [
  { icon: Ticket, label: 'Create a ticket', prompt: 'Create a ticket for my issue' },
  { icon: FileText, label: 'My open tickets', prompt: 'Show my open tickets' },
  { icon: Search, label: 'Search KB', prompt: 'Find KB articles about password reset' },
  { icon: AlertTriangle, label: 'Critical tickets', prompt: 'Show open critical tickets' },
  { icon: BarChart2, label: 'Stats', prompt: 'How many tickets are open right now?' },
  { icon: UserPlus, label: 'Assign ticket', prompt: 'Assign ticket to me' },
];

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  ticket: <Ticket size={14} />,
  list: <FileText size={14} />,
  search: <Search size={14} />,
  user: <UserIcon size={14} />,
  stats: <BarChart3 size={14} />,
  book: <BookOpen size={14} />,
  userPlus: <UserPlus size={14} />,
};

const FormattedMessage = ({ text }: { text: string }) => {
  const html = text
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 6px; margin: 8px 0; overflow-x: auto; font-size: 13px; border: 1px solid var(--border);"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 13px; border: 1px solid var(--border);">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: none; font-weight: 500;" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/- ([^\n]+)/g, '• $1');

  return (
    <div 
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '14px', lineHeight: '1.6' }}
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
}

export function AiPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useStore();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const newChatIntentRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);
  
  // Ticket context — auto-detected from URL, can be dismissed
  const [contextTicketId, setContextTicketId] = useState<string | null>(null);
  const [contextTicketNumber, setContextTicketNumber] = useState<number | null>(null);
  const [contextTicketDismissed, setContextTicketDismissed] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; filename: string; size: number }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropSuccess, setDropSuccess] = useState(false);

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
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${baseUrl}/ai/upload`, {
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

  // Keep ref in sync so async callbacks read latest value
  useEffect(() => { activeSessionRef.current = activeSessionId; }, [activeSessionId]);

  const fetchSessions = async (skipAutoSelect = false) => {
    try {
      const res = await api.get<{ data: Session[] }>('/ai/sessions');
      const data = res?.data || [];
      setSessions(data);
      if (!skipAutoSelect && data.length > 0 && !activeSessionRef.current) {
        setActiveSessionId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const res = await api.get<{ data: Message[] }>(`/ai/sessions/${sessionId}/messages`);
      // Filter out:
      // 1. Raw tool-result messages (role='tool') that contain internal JSON
      // 2. Intermediate assistant messages with tool_calls (these are not final responses)
      // Only show the final assistant responses to the user
      setMessages((res?.data || []).filter(m => {
        if (m.role === 'tool') return false;
        // Skip assistant messages that have tool_calls (intermediate steps)
        // These are followed by a final assistant message without tool_calls
        if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) return false;
        return true;
      }));
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  // Detect ticket context from URL when panel opens
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/dashboard\/tickets\/([^/]+)/);
      if (match && match[1] !== 'new') {
        const ticketUuid = match[1];
        queueMicrotask(() => {
          setContextTicketId(ticketUuid);
          setContextTicketDismissed(false);
        });
        // Fetch the human-readable ticket number
        api.get<{ data: { number: number } }>(`/tickets/${ticketUuid}`)
          .then(res => setContextTicketNumber(res.data?.number ?? null))
          .catch(() => setContextTicketNumber(null));
      } else {
        queueMicrotask(() => {
          setContextTicketId(null);
          setContextTicketNumber(null);
        });
      }
    }
  }, [isOpen]);

  const dismissTicketContext = () => setContextTicketDismissed(true);

  useEffect(() => {
    if (isOpen) {
      // If there's no new chat intent, do a full fetch with auto-select
      fetchSessions(newChatIntentRef.current);
      if (!activeSessionId) {
        setTimeout(() => inputRef.current?.focus(), 300);
      }
    }
  }, [isOpen, activeSessionId]);

  useEffect(() => {
    if (activeSessionId && isOpen) {
      queueMicrotask(() => fetchMessages(activeSessionId));
    } else if (!activeSessionId) {
      setMessages([]);
    }
  }, [activeSessionId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, historyOpen]);

  useEffect(() => {
    if (minimized) {
      queueMicrotask(() => setHistoryOpen(false));
    }
  }, [minimized]);

  const createNewChat = () => {
    newChatIntentRef.current = true;
    setActiveSessionId(null);
    setMessages([]);
    setInputText('');
    setTimeout(() => { inputRef.current?.focus(); }, 100);
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai/sessions/${id}`);
      setSessions(prev => {
        const filtered = prev.filter(s => s.id !== id);
        // If the deleted session was active, switch to next available
        if (activeSessionRef.current === id) {
          const nextId = filtered.length > 0 ? filtered[0].id : null;
          setActiveSessionId(nextId);
        }
        return filtered;
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim() || loading) return;

    let content = textToSend.trim();

    // Auto-inject ticket context (unless user dismissed it)
    if (contextTicketId && !contextTicketDismissed && !overrideText) {
      const ticketLabel = contextTicketNumber ? `#${contextTicketNumber}` : contextTicketId.slice(0, 8);
      content = `[Context: Ticket ${ticketLabel}]\n${content}`;
    }

    // Append uploaded file IDs to message context so AI can reference them
    if (uploadedFiles.length > 0 && !overrideText) {
      const fileIds = uploadedFiles.map(f => f.id).join(',');
      content = `${content}\n[Attached Files: ${fileIds}]`;
      setUploadedFiles([]);
    }

    if (overrideText === undefined) {
      setInputText('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }

    const tempId = Math.random().toString(36).substr(2, 9);
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: textToSend.trim(), created_at: new Date().toISOString() }]);
    setLoading(true);

    try {
      let currentSessionId = activeSessionRef.current;
      if (!currentSessionId) {
        const res = await api.post<{ data: Session }>('/ai/sessions', { title: textToSend.substring(0, 30) + '...' });
        const newSession = res.data;
        currentSessionId = newSession.id;
        // Clear new chat intent so fetchSessions auto-select works properly
        newChatIntentRef.current = false;
        setActiveSessionId(newSession.id);
        setSessions(prev => [newSession, ...prev]);
      }

      const res = await api.post<{ data: { session_id: string; content: string; tool_calls?: any[]; suggestions?: Suggestion[] } }>('/ai/chat', { 
        session_id: currentSessionId, 
        message: content 
      });
      const response = res.data;

      setMessages(prev => [
        ...prev, 
        { 
          id: Math.random().toString(36).substr(2, 9) + 'ai', 
          role: 'assistant', 
          content: response.content,
          tool_calls: response.tool_calls,
          suggestions: (response as any).suggestions || [],
          created_at: new Date().toISOString()
        }
      ]);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const msg = err?.message || 'Sorry, I encountered an error.';
      setMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9) + 'ai', role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${baseUrl}/ai/upload`, {
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

  const removeFile = (fileId: string) => {
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

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Backdrop (subtle) */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(1px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
      />

      {/* Panel */}
      <div 
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: minimized ? 280 : (historyOpen ? 680 : 480),
          maxHeight: minimized ? 52 : 'calc(100vh - 48px)',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 64px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1), max-height 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          borderBottom: minimized ? 'none' : '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          cursor: minimized ? 'pointer' : 'default',
        }}
          onClick={minimized ? () => setMinimized(false) : undefined}
        >
          <div style={{ 
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
          }}>
            <Sparkles size={14} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Resolv AI</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} title="Online"></span>
            {minimized && (
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {messages.length > 0 ? messages[messages.length - 1].content : 'Ask AI...'}
              </span>
            )}
          </div>
          {!minimized && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button 
                onClick={(e) => { e.stopPropagation(); createNewChat(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
                title="New Chat"
              >
                <Plus size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setHistoryOpen(!historyOpen); }}
                style={{ 
                  background: historyOpen ? 'rgba(0,0,0,0.05)' : 'none', 
                  border: 'none', cursor: 'pointer', color: historyOpen ? '#2563eb' : 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 
                }}
                title="History"
              >
                <History size={16} />
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMinimized(m => !m); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
              title={minimized ? 'Expand' : 'Minimize'}
            >
              {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!minimized && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left Column (History) */}
            <div style={{ 
              width: historyOpen ? 200 : 0, 
              borderRight: historyOpen ? '1px solid var(--border)' : 'none',
              background: 'var(--bg)',
              transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              flexShrink: 0
            }}>
              <div style={{ padding: '12px', minWidth: 200, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <button
                  onClick={createNewChat}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                    borderRadius: 6, cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, color: 'var(--text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  <Plus size={14} /> New Chat
                </button>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }} className="custom-scrollbar">
                  {sessions.map(s => (
                    <div 
                      key={s.id}
                      onClick={() => { setActiveSessionId(s.id); }}
                      className="session-item"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 6,
                        background: activeSessionId === s.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        color: activeSessionId === s.id ? '#2563eb' : 'var(--text)',
                        cursor: 'pointer', fontSize: 13,
                        transition: 'background 0.2s',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: activeSessionId === s.id ? 500 : 400 }}>{s.title || 'New Chat'}</span>
                      <div className="session-actions" style={{ display: 'flex', opacity: activeSessionId === s.id ? 1 : 0.4 }}>
                        <Trash2 
                          size={14} 
                          style={{ marginLeft: 8 }} 
                          onClick={(e) => deleteSession(e, s.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (Chat Area) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 480 }}>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }} className="custom-scrollbar">
                {messages.length === 0 && !loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 20px', textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 16,
                      background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', marginBottom: 20,
                      boxShadow: '0 12px 24px -6px rgba(37,99,235,0.4)'
                    }}>
                      <Sparkles size={28} />
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text)' }}>How can I help?</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32, maxWidth: 360, lineHeight: 1.5 }}>
                      Your AI assistant for IT support. Ask about tickets, search the knowledge base, or get help with anything.
                    </p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 440 }}>
                      {SUGGESTED_PROMPTS.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(p.prompt)}
                          className="prompt-card"
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
                            padding: '16px', background: 'var(--bg)',
                            border: '1px solid var(--border)', borderRadius: 12,
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div className="prompt-icon-wrapper" style={{ 
                            width: 32, height: 32, borderRadius: 8, 
                            background: 'transparent', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s'
                          }}>
                            <p.icon size={18} color="#2563eb" />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <div key={msg.id} style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        animation: 'fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards'
                      }}>
                        {msg.role === 'user' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: '85%' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{
                                background: '#2563eb', color: 'white',
                                padding: '10px 14px', borderRadius: '16px 16px 4px 16px',
                                fontSize: 14, lineHeight: 1.5,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                              }}>
                                {msg.content}
                              </div>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: 'rgba(0,0,0,0.1)', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                              }}>
                                {user?.avatarUrl ? <Image src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="User" width={28} height={28} /> : <UserIcon size={14} color="var(--text-muted)" />}
                              </div>
                            </div>
                            {msg.created_at && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingRight: 36 }}>{formatTime(msg.created_at)}</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, maxWidth: '95%' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                                background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                              }}>
                                <Sparkles size={14} />
                              </div>
                              <div style={{ 
                                flex: 1, minWidth: 0, color: 'var(--text)', 
                                background: 'var(--bg-secondary)', 
                                padding: '10px 14px', 
                                borderRadius: '4px 16px 16px 16px',
                                border: '1px solid var(--border-subtle)',
                                fontSize: 14
                              }}>
                                {msg.tool_calls && msg.tool_calls.map((tool, ti) => (
                                  <div key={ti} style={{ 
                                    display: 'inline-flex', alignItems: 'center', gap: 6, 
                                    fontSize: 12, color: '#2563eb', marginBottom: 8,
                                    background: 'rgba(37,99,235,0.08)',
                                    border: '1px solid rgba(37,99,235,0.2)',
                                    borderRadius: 20, padding: '3px 10px',
                                    marginRight: 6
                                  }}>
                                    {tool.status === 'pending' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} color="#10b981" />}
                                    {tool.name}
                                  </div>
                                ))}
                                <FormattedMessage text={msg.content} />
                                {(msg as any).suggestions?.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {(msg as any).suggestions.map((s: Suggestion) => (
                                      <button
                                        key={s.id}
                                        onClick={() => sendMessage(s.prompt)}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 5,
                                          padding: '5px 12px', fontSize: 12, fontWeight: 500,
                                          background: 'var(--card)', border: '1px solid var(--border)',
                                          borderRadius: 16, cursor: 'pointer', color: 'var(--text)',
                                          transition: 'all 0.2s',
                                        }}
                                        className="suggestion-chip"
                                      >
                                        {SUGGESTION_ICONS[s.icon] || null}
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {msg.created_at && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 40 }}>{formatTime(msg.created_at)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {loading && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeInUp 0.3s ease-out' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                          }}>
                            <Sparkles size={14} />
                          </div>
                          <div style={{ 
                            display: 'flex', alignItems: 'center', gap: 8, height: 36,
                            background: 'var(--bg-secondary)', padding: '0 16px',
                            borderRadius: '4px 16px 16px 16px', border: '1px solid var(--border-subtle)'
                          }}>
                            <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', animationDelay: '0ms' }}></div>
                            <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', animationDelay: '200ms' }}></div>
                            <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', animationDelay: '400ms' }}></div>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>Resolv AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area — supports drag-and-drop file upload */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg)',
                  position: 'relative',
                  outline: dragOver ? '2px dashed #2563eb' : 'none',
                  outlineOffset: dragOver ? -2 : 0,
                  transition: 'outline 0.15s ease',
                }}
              >
                {/* Drag-over overlay */}
                {dragOver && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    background: 'rgba(37, 99, 235, 0.06)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, fontSize: 14, fontWeight: 600, color: '#2563eb',
                    pointerEvents: 'none',
                  }}>
                    <UploadCloud size={20} /> Drop files here
                  </div>
                )}

                {/* Drop success flash */}
                {dropSuccess && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, fontSize: 14, fontWeight: 600, color: '#10b981',
                    pointerEvents: 'none',
                    animation: 'fadeInUp 0.2s ease-out',
                  }}>
                    <Check size={18} /> Files added
                  </div>
                )}
                {/* Removable ticket context chip */}
                {contextTicketId && !contextTicketDismissed && (
                  <div style={{
                    marginBottom: 8, padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, color: '#2563eb',
                  }}>
                    <Ticket size={14} />
                    <span style={{ flex: 1, fontWeight: 500 }}>Referring to Ticket {contextTicketNumber ? `#${contextTicketNumber}` : `#${contextTicketId.slice(0, 8)}`}</span>
                    <button
                      onClick={dismissTicketContext}
                      style={{
                        width: 20, height: 20, borderRadius: 4,
                        background: 'transparent', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#2563eb', flexShrink: 0,
                      }}
                      title="Remove ticket context"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {/* Uploaded files preview */}
                {uploadedFiles.length > 0 && (
                  <div style={{
                    marginBottom: 8, padding: 8, borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} attached
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {uploadedFiles.map(f => (
                        <div key={f.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 8px', borderRadius: 6,
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                        }}>
                          {isImageFile(f.filename) ? (
                            <div style={{ width: 24, height: 24, borderRadius: 4, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText size={13} color="#2563eb" />
                            </div>
                          ) : (
                            <div style={{ width: 24, height: 24, borderRadius: 4, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText size={13} color="#6366f1" />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.filename}>
                              {truncateFilename(f.filename)}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatSize(f.size)}</span>
                          <button
                            onClick={() => removeFile(f.id)}
                            style={{
                              width: 20, height: 20, borderRadius: 4,
                              background: 'transparent', border: 'none',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--text-muted)', flexShrink: 0,
                              transition: 'all 0.15s',
                            }}
                            title="Remove file"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'flex-end', gap: 8,
                  border: `1.5px solid ${inputFocused ? '#2563eb' : 'var(--border)'}`, 
                  borderRadius: 12,
                  padding: 6, background: 'var(--bg-secondary)',
                  boxShadow: inputFocused ? '0 0 0 3px rgba(37,99,235,0.1)' : '0 2px 6px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}>
                  {/* File upload button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: uploadingFile ? 'default' : 'pointer',
                      transition: 'all 0.2s', marginBottom: 2, marginLeft: 2,
                    }}
                    title="Attach file"
                  >
                    {uploadingFile ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_FILE_TYPES}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                    }}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder="Drop files here or message Resolv AI..."
                    style={{
                      flex: 1, minHeight: 36, maxHeight: 150,
                      background: 'transparent', border: 'none', outline: 'none',
                      resize: 'none', padding: '8px 12px', fontSize: 14,
                      color: 'var(--text)', fontFamily: 'inherit'
                    }}
                    rows={1}
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!inputText.trim() || loading}
                    style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: (!inputText.trim() || loading) ? 'rgba(0,0,0,0.05)' : 'linear-gradient(135deg, #2563eb, #4f46e5)',
                      color: (!inputText.trim() || loading) ? 'var(--text-muted)' : 'white',
                      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: (!inputText.trim() || loading) ? 'default' : 'pointer',
                      transition: 'all 0.2s', marginBottom: 2, marginRight: 2
                    }}
                  >
                    <Send size={16} style={{ marginLeft: 2 }} />
                  </button>
                </div>
                {inputText.trim() && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, animation: 'fadeInUp 0.2s ease-out' }}>
                    Press <kbd style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', fontSize: 10 }}>Enter</kbd> to send, <kbd style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', fontSize: 10 }}>Shift + Enter</kbd> for new line
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUpPanel {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .typing-dot {
          animation: typingBounce 1.4s infinite ease-in-out;
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        .prompt-card:hover {
          background: var(--bg-secondary) !important;
          border-color: #2563eb !important;
        }
        .prompt-card:hover .prompt-icon-wrapper {
          background: rgba(37,99,235,0.1) !important;
        }
        .session-item:hover .session-actions {
          opacity: 1 !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
        .suggestion-chip:hover {
          background: var(--accent) !important;
          color: #fff !important;
          border-color: var(--accent) !important;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(37,99,235,0.2);
        }
      `}} />
    </>
  );
}
