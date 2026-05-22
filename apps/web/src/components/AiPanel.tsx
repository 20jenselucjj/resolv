'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  Sparkles, X, Trash2, Send, Plus,
  User as UserIcon, Check, Loader2, Paperclip,
  Ticket, Search, AlertTriangle, BarChart2, UserPlus, FileText,
  Minimize2, Maximize2, History
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  tool_calls?: ToolCall[];
}

const SUGGESTED_PROMPTS = [
  { icon: Ticket, label: 'Create a ticket', prompt: 'Create a ticket for my issue' },
  { icon: FileText, label: 'My open tickets', prompt: 'Show my open tickets' },
  { icon: Search, label: 'Search KB', prompt: 'Find KB articles about password reset' },
  { icon: AlertTriangle, label: 'Critical tickets', prompt: 'Show open critical tickets' },
  { icon: BarChart2, label: 'Stats', prompt: 'How many tickets are open right now?' },
  { icon: UserPlus, label: 'Assign ticket', prompt: 'Assign ticket to me' },
];

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
  
  const [contextTicketId, setContextTicketId] = useState<string | null>(null);

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
      setMessages(res?.data || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/dashboard\/tickets\/([^/]+)/);
      if (match && match[1] !== 'new') {
        setContextTicketId(match[1]);
      } else {
        setContextTicketId(null);
      }
    }
  }, [isOpen]);

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
      fetchMessages(activeSessionId);
    } else if (!activeSessionId) {
      setMessages([]);
    }
  }, [activeSessionId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, historyOpen]);

  useEffect(() => {
    if (minimized) {
      setHistoryOpen(false);
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
    if (contextTicketId && !overrideText) {
       content = `[Context: Ticket #${contextTicketId}]\n${content}`;
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

      const res = await api.post<{ data: { session_id: string; content: string; tool_calls?: any[] } }>('/ai/chat', { 
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
                                {user?.avatarUrl ? <img src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="User" /> : <UserIcon size={14} color="var(--text-muted)" />}
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

              {/* Input Area */}
              <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg)' }}>
                {contextTicketId && (
                  <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: 4, 
                    padding: '4px 8px', background: 'rgba(37,99,235,0.1)', 
                    color: '#2563eb', borderRadius: 4, fontSize: 11, fontWeight: 500,
                    marginBottom: 8
                  }}>
                    <Paperclip size={12} /> Viewing Ticket #{contextTicketId}
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
                    placeholder="Message Resolv AI..."
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
      `}} />
    </>
  );
}
