'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore, Ticket, Category, Comment, User } from '@/lib/store';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { connectSocket } from '@/lib/socket';
import {
  ArrowLeft, Send, Lock,
  AlertTriangle, CheckCircle,
  Edit2, Check, X,
  MessageSquare, Activity, FileText, Book,
  Paperclip, Trash2, User as UserIcon,
  Download
} from 'lucide-react';
import {
  formatSize,
  TopBar,
  PropertiesCard,
  AttachmentPreviewModal,
} from './components';
import type { Attachment } from './components';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, updateTicket } = useStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comment, setComment] = useState('');
  const [replyMode, setReplyMode] = useState<'note' | 'message' | 'resolution'>('message');
  const [submitting, setSubmitting] = useState(false);
  const [presence, setPresence] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [rightTab, setRightTab] = useState<'journey' | 'attachments' | 'activity'>('journey');
  const [isClosing, setIsClosing] = useState(false);
  const [closeNotesDraft, setCloseNotesDraft] = useState('');
  const [sendEmailOnClose, setSendEmailOnClose] = useState(true);
  const [sendEmailOnResolution, setSendEmailOnResolution] = useState(true);
  
  // New UI states
  const [showMenu, setShowMenu] = useState(false);
  const [cannedMenuOpen, setCannedMenuOpen] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [cannedResponses, setCannedResponses] = useState<string[]>([
    "Hi there, we've received your request and are looking into it.",
    "Could you please provide more details or screenshots to help us investigate?",
    "We have resolved the issue. Please confirm if everything is working for you now.",
    "Closing this ticket due to inactivity. Feel free to reply if you still need help."
  ]);
  const [dragOver, setDragOver] = useState(false);
  const [previewAttach, setPreviewAttach] = useState<Attachment | null>(null);
  
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    api.get<{ data: Ticket }>(`/tickets/${id}`)
      .then((res) => { 
        setTicket(res.data); 
        setTitleDraft(res.data.title);
        setDescDraft(res.data.description || '');
        setCloseNotesDraft(res.data.close_notes || '');
      })
      .catch((err) => console.error('Failed to load ticket:', err))
      .finally(() => setLoading(false));

    api.get<{ data: Category[] }>('/categories').then(res => setCategories(res.data)).catch(() => {});
    api.get<{ data: Attachment[] }>(`/tickets/${id}/attachments`).then(res => setAttachments(res.data)).catch(() => {});
    api.get<{ data: User[] }>('/users').then(res => setAllUsers(res.data)).catch(() => {});
    api.get<{ data: string[] }>('/settings/canned-responses')
      .then(res => {
        if (res.data?.length) setCannedResponses(res.data);
      })
      .catch(() => {});

    const socket = connectSocket();
    socket.emit('ticket:join', id);
    socket.on('ticket:presence', ({ users }: { users: string[] }) => setPresence(users));
    socket.on(`ticket:comment:${id}`, ({ comment: c }: { comment: Comment }) => {
      setTicket((prev) => prev ? { ...prev, comments: [c, ...(prev.comments || [])] } : prev);
    });
    socket.on(`ticket:updated:${id}`, ({ ticket: t }: { ticket: Partial<Ticket> }) => {
      setTicket((prev) => prev ? { ...prev, ...t } as Ticket : prev);
      updateTicket(id, t);
    });
    socket.on('ticket:typing', ({ user: u }: { user: { name: string } }) => {
      setTypingUsers((prev) => [...new Set([...prev, u.name])]);
      setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== u.name)), 3000);
    });

    return () => {
      socket.emit('ticket:leave', id);
      socket.off(`ticket:comment:${id}`);
      socket.off(`ticket:updated:${id}`);
      socket.off('ticket:presence');
      socket.off('ticket:typing');
    };
  }, [id, updateTicket]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches('input,textarea,select')) return;
      if (e.key === 'r') commentRef.current?.focus();
      if (e.key === 'Escape') router.back();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  async function handleFiles(files: File[]) {
    setUploading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const token = localStorage.getItem('resolv_token');
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${baseUrl}/tickets/${id}/attachments`, {
          method: 'POST',
          body: formData,
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok) {
          const data = await res.json();
          setAttachments(prev => [...prev, data.data]);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    setUploading(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFiles(Array.from(files));
  }

  async function updateField(field: string, value: string | number | boolean | null) {
    try {
      const res = await api.patch<{ data: Ticket }>(`/tickets/${id}`, { [field]: value });
      setTicket((prev) => prev ? ({ ...prev, ...res.data }) : null);
      updateTicket(id, res.data);
    } catch (err: unknown) {
      console.error('Update failed:', err);
    }
  }

  async function handleAssignToMe() {
    if (!user?.id) return;
    const selectedUser = allUsers.find(u => u.id === user.id);
    setTicket((prev) => prev ? { ...prev, assigned_to_id: user.id, assigned_to_name: selectedUser?.name || user.name } : prev);
    await updateField('assigned_to_id', user.id);
  }

  async function handleAssignToUser(userId: string | null) {
    const selectedUser = userId ? allUsers.find(u => u.id === userId) : null;
    setTicket((prev) => prev ? { ...prev, assigned_to_id: userId, assigned_to_name: selectedUser?.name || null } : prev);
    await updateField('assigned_to_id', userId);
  }

  async function handleReporterChange(userId: string | null) {
    if (!userId) return;
    const selectedUser = allUsers.find(u => u.id === userId);
    setTicket((prev) => prev ? { ...prev, created_by_id: userId, created_by_name: selectedUser?.name || undefined } : prev);
    await updateField('created_by_id', userId);
  }

  async function saveTitle() {
    if (!ticket || !titleDraft.trim() || titleDraft === ticket.title) { setEditingTitle(false); return; }
    await updateField('title', titleDraft);
    setEditingTitle(false);
  }

  async function saveDesc() {
    if (!ticket) { setEditingDesc(false); return; }
    await updateField('description', descDraft);
    setEditingDesc(false);
  }

  async function submitComment(asResolution = false) {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await api.post<{ data: Comment }>(`/tickets/${id}/comments`, { 
        body: comment, 
        is_internal: replyMode === 'note',
      });
      
      if (asResolution) {
        const resTicket = await api.patch<{ data: Ticket }>(`/tickets/${id}`, { 
          status: 'closed',
          close_notes: comment,
          send_email: sendEmailOnResolution,
        });
        setTicket((prev) => prev ? ({ ...prev, ...resTicket.data }) : null);
        updateTicket(id, resTicket.data);
      }
      
      setComment('');
      if (asResolution) setReplyMode('message');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseTicket() {
    if (!closeNotesDraft.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.patch<{ data: Ticket }>(`/tickets/${id}`, { 
        status: 'closed', 
        close_notes: closeNotesDraft,
        send_email: sendEmailOnClose,
      });
      setTicket((prev) => prev ? ({ ...prev, ...res.data }) : null);
      updateTicket(id, res.data);
      setIsClosing(false);
      setCloseNotesDraft('');
      setSendEmailOnClose(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === 'closed') {
      setCloseNotesDraft(ticket?.close_notes || '');
      setIsClosing(true);
      return;
    }
    await updateField('status', newStatus);
  }

  function handleTyping() {
    const socket = connectSocket();
    socket.emit('ticket:typing', { ticketId: id, user: { name: user?.name } });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {}, 3000);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = localStorage.getItem('resolv_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${baseUrl}/tickets/${id}/attachments`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setAttachments(prev => [...prev, data.data]);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    try {
      await api.delete(`/attachments/${attachmentId}`);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  async function saveCommentEdit(commentId: string) {
    if (!editCommentBody.trim()) return;
    try {
      await api.patch(`/tickets/${id}/comments/${commentId}`, { content: editCommentBody });
      setTicket(prev => {
        if (!prev) return null;
        return {
          ...prev,
          comments: prev.comments?.map(c => c.id === commentId ? { ...c, body: editCommentBody, is_edited: true } : c)
        };
      });
      setEditingComment(null);
    } catch (err) {
      console.error('Edit failed:', err);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 24, width: 200 }} />
        <div className="skeleton" style={{ height: 36, width: '60%' }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Ticket not found</div>
        <button onClick={() => router.push('/dashboard/tickets')} className="btn btn-secondary" style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';
  
  const descIsLong = (ticket.description?.length || 0) > 300;
  const displayDesc = (descIsLong && !showFullDesc) ? ticket.description?.substring(0, 300) + '...' : ticket.description;

  return (
    <div className="print-ticket-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>{`
        @media print {
          nav, aside, [data-no-print] { display: none !important; }
          .print-ticket-content { display: block !important; }
          body { background: white; }
        }
      `}</style>
      <TopBar
        ticket={ticket}
        isAdminOrAgent={isAdminOrAgent}
        isClosing={isClosing}
        closeNotesDraft={closeNotesDraft}
        setCloseNotesDraft={setCloseNotesDraft}
        setIsClosing={setIsClosing}
        handleCloseTicket={handleCloseTicket}
        submitting={submitting}
        presence={presence}
        handleStatusChange={handleStatusChange}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        sendEmailOnClose={sendEmailOnClose}
        setSendEmailOnClose={setSendEmailOnClose}
      />

      {/* Main Two-Column Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Column (55%) */}
        <div style={{ flex: 1.2, padding: '24px 32px', overflow: 'auto' }}>
          {/* Title */}
          <div style={{ marginBottom: 24 }}>
            {editingTitle ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="input"
                  style={{ fontSize: 24, fontWeight: 700, height: 48, flex: 1 }}
                />
                <button onClick={saveTitle} className="btn btn-primary btn-icon"><Check size={16} /></button>
                <button onClick={() => setEditingTitle(false)} className="btn btn-ghost btn-icon"><X size={16} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <h1
                  onClick={() => { if (isAdminOrAgent) { setEditingTitle(true); setTitleDraft(ticket.title); } }}
                  style={{
                    fontSize: 24, fontWeight: 700, color: 'var(--text)', flex: 1, lineHeight: 1.3,
                    cursor: isAdminOrAgent ? 'text' : 'default',
                    padding: isAdminOrAgent ? '4px 8px' : '0',
                    margin: isAdminOrAgent ? '-4px -8px 0 0' : '0',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (isAdminOrAgent) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {ticket.title}
                </h1>
                {isAdminOrAgent && (
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="btn btn-ghost btn-icon btn-sm"
                    data-tooltip="Edit title"
                    style={{ marginTop: 4, opacity: 0.4 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          <PropertiesCard
            ticket={ticket}
            categories={categories}
            allUsers={allUsers}
            isAdminOrAgent={isAdminOrAgent}
            updateField={updateField}
            handleStatusChange={handleStatusChange}
            handleAssignToUser={handleAssignToUser}
            handleReporterChange={handleReporterChange}
          />

          {/* Request Details Card */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0' }}>Request Details</h3>
            {editingDesc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea
                  className="textarea"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  rows={8}
                  style={{ fontSize: 14, lineHeight: 1.7, resize: 'vertical', minHeight: 120 }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingDesc(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={saveDesc} className="btn btn-primary btn-sm">Save</button>
                </div>
              </div>
            ) : (
              <>
                {ticket.description ? (
                  <>
                    <div
                      onClick={() => { if (isAdminOrAgent) { setEditingDesc(true); setDescDraft(ticket.description || ''); } }}
                      style={{
                        fontSize: 14,
                        lineHeight: 1.7,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        cursor: isAdminOrAgent ? 'text' : 'default',
                        padding: isAdminOrAgent ? '4px 8px' : '0',
                        margin: isAdminOrAgent ? '-4px -8px' : '0',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (isAdminOrAgent) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {displayDesc}
                    </div>
                    {descIsLong && (
                      <button onClick={() => setShowFullDesc(!showFullDesc)} className="btn btn-ghost btn-sm" style={{ marginTop: 12, padding: 0, color: 'var(--accent)' }}>
                        {showFullDesc ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </>
                ) : (
                  <div
                    onClick={() => { if (isAdminOrAgent) { setEditingDesc(true); setDescDraft(''); } }}
                    style={{
                      fontSize: 14,
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      cursor: isAdminOrAgent ? 'pointer' : 'default',
                      padding: isAdminOrAgent ? '8px' : '0',
                      border: isAdminOrAgent ? '1px dashed var(--border)' : 'none',
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'center',
                    }}
                  >
                    {isAdminOrAgent ? 'Click to add a description' : 'No description provided.'}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Attachments Section */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ background: dragOver ? 'var(--accent-subtle)' : 'var(--card)', border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px', transition: 'all 0.2s' }}
          >
            {dragOver && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--accent)', fontWeight: 600, fontSize: 14, marginBottom: '16px' }}>
                Drop files here to upload
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Attachments</h3>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', gap: 6, color: 'var(--accent)' }}>
                <Paperclip size={14} />
                {uploading ? 'Uploading...' : 'Attach File'}
                <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} multiple />
              </label>
            </div>

            {attachments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: 13 }}>
                Drag & drop files here or click "Attach File" to upload
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setPreviewAttach(a)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <FileText size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.original_name || a.filename}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatSize(a.size)} &bull; {a.uploader_name} &bull; {formatDate(a.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/attachments/${a.id}/download?token=${localStorage.getItem('resolv_token')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Download"
                      >
                        <Download size={14} />
                      </a>
                      {isAdminOrAgent && (
                        <button onClick={() => handleDeleteAttachment(a.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (45%) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', background: 'var(--card)', padding: '0 16px' }}>
            {([
              { key: 'journey' as const, label: 'Journey' },
              { key: 'attachments' as const, label: 'Attachments' },
              { key: 'activity' as const, label: 'Activity' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRightTab(key)}
                style={{
                  padding: '16px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: rightTab === key ? 600 : 500,
                  color: rightTab === key ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: `2px solid ${rightTab === key ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: -1, transition: 'all var(--transition)',
                }}
                onMouseEnter={e => { if (rightTab !== key) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; } }}
                onMouseLeave={e => { if (rightTab !== key) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none'; } }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Feed Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'journey' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Closing Note (shown at top of journey if ticket is closed) */}
                {ticket.status === 'closed' && ticket.close_notes && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--success-bg)', border: '1px solid var(--success-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CheckCircle size={16} color="var(--success)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        background: 'var(--success-bg)',
                        border: '1px solid var(--success-border)',
                        borderRadius: 'var(--radius-lg)', padding: '16px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>Ticket Closed</span>
                            {(ticket as any).closed_by_name && (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                by {(ticket as any).closed_by_name}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {formatDateTime(ticket.closed_at || ticket.updated_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                          {ticket.close_notes}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(!ticket.comments || ticket.comments.length === 0) && !ticket.close_notes && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                    No activity yet.
                  </div>
                )}
                
                {ticket.comments?.map((c: Comment, idx: number) => {
                  if (c.type === 'system' || c.is_system) {
                    return (
                      <div key={`${c.id}-${idx}`} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 36, display: 'flex', justifyContent: 'center' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)' }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.body}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(c.created_at)}</span>
                        </div>
                      </div>
                    );
                  }

                  const isNote = c.is_internal;
                  const canEdit = isAdminOrAgent || (user?.id === c.author_id && (new Date().getTime() - new Date(c.created_at).getTime()) < 15 * 60 * 1000);
                  const isEditing = editingComment === c.id;

                  return (
                    <div key={`${c.id}-${idx}`} style={{ display: 'flex', gap: 12, position: 'relative' }} className="group">
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isNote ? 'var(--warning-bg)' : `hsl(${(c.author_name?.charCodeAt(0) * 37 || 200) % 360}, 55%, 45%)`,
                        border: isNote ? '1px solid var(--warning-border)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: isNote ? 'var(--warning)' : '#fff', flexShrink: 0,
                      }}>
                        {c.author_name?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          background: isNote ? 'var(--warning-bg)' : 'var(--card)',
                          border: `1px solid ${isNote ? 'var(--warning-border)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-lg)', padding: '16px', position: 'relative'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.author_name}</span>
                              {isNote && (
                                <span style={{ fontSize: 10, background: 'var(--warning)', color: '#fff', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>INTERNAL</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {c.is_edited && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>(edited)</span>
                              )}
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(c.created_at)}</span>
                              {canEdit && !isEditing && (
                                <button 
                                  onClick={() => { setEditingComment(c.id); setEditCommentBody(c.body); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', transition: 'color 0.15s ease' }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <textarea 
                                className="input" 
                                value={editCommentBody} 
                                onChange={e => setEditCommentBody(e.target.value)}
                                style={{ minHeight: '80px', fontSize: 14, background: 'var(--bg)' }}
                                autoFocus
                              />
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => setEditingComment(null)} className="btn btn-ghost btn-sm">Cancel</button>
                                <button onClick={() => saveCommentEdit(c.id)} className="btn btn-primary btn-sm">Save</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                              {c.body}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typingUsers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 48 }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[0,1,2].map((i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {rightTab === 'attachments' && (
              attachments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                  No attachments uploaded.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setPreviewAttach(a)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <FileText size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.original_name || a.filename}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatSize(a.size)} &bull; {a.uploader_name} &bull; {formatDate(a.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/attachments/${a.id}/download?token=${localStorage.getItem('resolv_token')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                        {isAdminOrAgent && (
                          <button onClick={() => handleDeleteAttachment(a.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            
            {rightTab === 'activity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {(!(ticket as any).activity || (ticket as any).activity.length === 0) && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                    No activity recorded.
                  </div>
                )}
                
                {(ticket as any).activity?.map((act: any) => {
                  let IconComponent = Activity;
                  let iconColor = 'var(--text-muted)';
                  
                  if (act.action === 'status') {
                    IconComponent = CheckCircle;
                    iconColor = 'var(--success)';
                  } else if (act.action === 'assigned_to_id' || act.action === 'assignee') {
                    IconComponent = UserIcon;
                    iconColor = 'var(--info)';
                  } else if (act.action === 'priority') {
                    IconComponent = AlertTriangle;
                    iconColor = 'var(--warning)';
                  }

                  const oldVal = act.old_value !== null && act.old_value !== undefined ? act.old_value : 'none';
                  const newVal = act.new_value !== null && act.new_value !== undefined ? act.new_value : 'none';
                  const actionText = `${act.actor_name || 'System'} changed ${act.action} from ${oldVal} to ${newVal}`;

                  return (
                    <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ 
                        width: 28, height: 28, borderRadius: '50%', 
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComponent size={14} color={iconColor} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {actionText}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatDateTime(act.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Reply Box */}
          {ticket.status !== 'closed' && rightTab === 'journey' && (
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--card)', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
                {[
                  { id: 'note' as const, label: 'Note', icon: Lock },
                  { id: 'message' as const, label: 'Message', icon: MessageSquare },
                  { id: 'resolution' as const, label: 'Close', icon: CheckCircle },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setReplyMode(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: replyMode === t.id ? 600 : 500,
                      color: replyMode === t.id ? 'var(--text)' : 'var(--text-muted)',
                      borderBottom: replyMode === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                      paddingBottom: 4,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { if (replyMode !== t.id) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.opacity = '0.7'; } }}
                    onMouseLeave={e => { if (replyMode !== t.id) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '1'; } }}
                  >
                    <t.icon size={14} /> {t.label}
                  </button>
                ))}
              </div>

              <div style={{ 
                border: `1px solid ${replyMode === 'note' ? 'var(--warning-border)' : replyMode === 'resolution' ? 'var(--success-border)' : 'var(--border)'}`, 
                borderRadius: 'var(--radius-lg)', 
                background: replyMode === 'note' ? 'var(--warning-bg)' : 'var(--bg)',
                display: 'flex', flexDirection: 'column',
                transition: 'all 0.2s', overflow: 'hidden'
              }}>
                {replyMode === 'note' && (
                  <div style={{ padding: '8px 16px', background: 'var(--warning-bg)', borderBottom: '1px solid var(--warning-border)', fontSize: 12, color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={12} /> Internal — not visible to users
                  </div>
                )}
                
                <textarea
                  ref={commentRef}
                  value={comment}
                  onChange={(e) => { setComment(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitComment(replyMode === 'resolution');
                  }}
                  placeholder={replyMode === 'note' ? 'Write an internal note...' : replyMode === 'resolution' ? 'Write a closing note (ticket will be closed)...' : 'Write a public reply...'}
                  rows={4}
                  style={{
                    width: '100%', padding: '16px',
                    background: 'none', border: 'none', outline: 'none',
                    color: 'var(--text)', fontSize: 14, resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.6,
                    boxSizing: 'border-box',
                  }}
                />
                
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                }}>
                  {isAdminOrAgent ? (
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setCannedMenuOpen(!cannedMenuOpen)} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-secondary)' }}>
                        <Book size={14} /> Canned Responses
                      </button>
                      {cannedMenuOpen && (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: 280, zIndex: 20, padding: 6 }}>
                          {cannedResponses.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => { setComment(prev => prev ? prev + '\n' + r : r); setCannedMenuOpen(false); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', borderRadius: 'var(--radius-sm)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              {r.length > 50 ? r.substring(0, 50) + '...' : r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <div />}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {replyMode === 'resolution' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sendEmailOnResolution} onChange={e => setSendEmailOnResolution(e.target.checked)} style={{ cursor: 'pointer' }} />
                        Email user
                      </label>
                    )}
                    {replyMode === 'resolution' ? (
                      <button onClick={() => submitComment(true)} disabled={submitting || !comment.trim()} className="btn btn-primary btn-sm" style={{ background: 'var(--success)', color: '#fff' }}>
                        <CheckCircle size={14} /> Close Ticket
                      </button>
                    ) : (
                      <button onClick={() => submitComment(false)} disabled={submitting || !comment.trim()} className="btn btn-primary btn-sm">
                        <Send size={14} /> {submitting ? 'Sending...' : 'Send'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {previewAttach && (
        <AttachmentPreviewModal
          attachment={previewAttach}
          onClose={() => setPreviewAttach(null)}
        />
      )}
    </div>
  );
}
