'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronDown, ChevronRight, HelpCircle, ExternalLink,
  Sparkles, X, BookOpen, ArrowUp, Menu,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { docSections, searchDocs, canAccess, SearchResult, DocArticle, DocSection, DocRole } from './help-data';

// ─── Icon Map ────────────────────────────────────────────────────────────
const iconMap: Record<string, string> = {
  Rocket: '🚀',
  Ticket: '🎫',
  BookOpen: '📚',
  Monitor: '💻',
  GitBranch: '🔧',
  AlertTriangle: '⚠️',
  AlertOctagon: '🚨',
  LayoutGrid: '🛒',
  CheckSquare: '✅',
  Sparkles: '🤖',
  BarChart: '📊',
  Shield: '⚙️',
  Settings: '👤',
  Terminal: '🖥️',
  HelpCircle: '❓',
};

// ─── Styles ──────────────────────────────────────────────────────────────
const styles = {
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg)',
  } as React.CSSProperties,
  // Left sidebar TOC
  tocSidebar: {
    width: 240,
    minWidth: 240,
    borderRight: '1px solid var(--card-border)',
    background: 'var(--card-bg)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
  tocHeader: {
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
    borderBottom: '1px solid var(--card-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  tocScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 0',
  } as React.CSSProperties,
  tocItem: (active: boolean, depth: number) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px 5px 14px',
    margin: '1px 6px',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    cursor: 'pointer',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    background: active ? 'var(--accent-bg, rgba(37,99,235,0.08))' : 'transparent',
    fontWeight: active ? 600 : 400,
    transition: 'all var(--transition)',
    border: 'none',
    textAlign: 'left' as const,
    width: 'calc(100% - 12px)',
  }),
  tocSectionBtn: (expanded: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px 6px 10px',
    margin: '1px 6px',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text)',
    background: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    width: 'calc(100% - 12px)',
    transition: 'all var(--transition)',
  }),
  // Main content area
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
  searchBar: {
    padding: '14px 24px',
    borderBottom: '1px solid var(--card-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  } as React.CSSProperties,
  searchInput: {
    flex: 1,
    height: 38,
    padding: '0 14px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--card-bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color var(--transition)',
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px 80px',
  } as React.CSSProperties,
  // Article card
  articleCard: {
    maxWidth: 800,
    margin: '0 auto',
  } as React.CSSProperties,
  articleTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 8,
  } as React.CSSProperties,
  articleDesc: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 24,
    lineHeight: 1.5,
  } as React.CSSProperties,
  articleBody: {
    fontSize: 14,
    lineHeight: 1.7,
    color: 'var(--text)',
  } as React.CSSProperties,
  // Search results
  searchResults: {
    maxWidth: 800,
    margin: '0 auto',
  } as React.CSSProperties,
  searchResultItem: {
    padding: '12px 16px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    background: 'var(--card-bg)',
  } as React.CSSProperties,
  // Section cards (when no article selected)
  sectionGrid: {
    maxWidth: 800,
    margin: '0 auto',
  } as React.CSSProperties,
  sectionCard: {
    padding: '16px 20px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 10,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    background: 'var(--card-bg)',
  } as React.CSSProperties,
  articleLink: {
    padding: '10px 14px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 6,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    background: 'var(--card-bg)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  // Related links
  relatedLinks: {
    marginTop: 32,
    padding: '16px 20px',
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
  } as React.CSSProperties,
  // AI Assistant panel
  aiPanel: {
    width: 340,
    minWidth: 340,
    borderLeft: '1px solid var(--card-border)',
    background: 'var(--card-bg)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
  aiHeader: {
    padding: '10px 14px',
    borderBottom: '1px solid var(--card-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,
  aiMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } as React.CSSProperties,
  aiMessage: (isUser: boolean) => ({
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    lineHeight: 1.5,
    maxWidth: '85%',
    alignSelf: isUser ? 'flex-end' : 'flex-start' as any,
    background: isUser ? 'var(--accent)' : 'var(--bg)',
    color: isUser ? 'var(--text-inverse, #fff)' : 'var(--text)',
    border: isUser ? 'none' : '1px solid var(--card-border)',
  }),
  aiInput: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid var(--card-border)',
  } as React.CSSProperties,
  aiInputField: {
    flex: 1,
    height: 34,
    padding: '0 10px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 12,
    outline: 'none',
  } as React.CSSProperties,
  // Landing page
  welcomeHeader: {
    textAlign: 'center' as const,
    padding: '40px 20px 32px',
  } as React.CSSProperties,
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: 'var(--text)',
    marginBottom: 8,
  } as React.CSSProperties,
  welcomeSub: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    maxWidth: 500,
    margin: '0 auto',
    lineHeight: 1.6,
  } as React.CSSProperties,
  // Mobile sidebar overlay
  mobileOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  mobileTocBtn: {
    display: 'none',
    background: 'transparent',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 8px',
    cursor: 'pointer',
    color: 'var(--text)',
    marginRight: 8,
  } as React.CSSProperties,
};

// ─── Themed Table component ──────────────────────────────────────────────
function ThemedTable({ content }: { content: string }) {
  // Wrap any <table> elements with styling
  const wrapped = content.replace(
    /<table>/g,
    '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;border:1px solid var(--card-border);border-radius:var(--radius-md);overflow:hidden">'
  ).replace(
    /<th>/g,
    '<th style="background:var(--card-bg);padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid var(--card-border);color:var(--text)">'
  ).replace(
    /<td>/g,
    '<td style="padding:8px 12px;border-bottom:1px solid var(--card-border);color:var(--text)">'
  ).replace(
    /<kbd>/g,
    '<kbd style="display:inline-block;padding:2px 6px;font-size:11px;font-family:inherit;background:var(--card-bg);border:1px solid var(--card-border);border-radius:4px;color:var(--text-secondary);box-shadow:0 1px 0 var(--card-border)">'
  ).replace(
    /<code>/g,
    '<code style="background:var(--card-bg);padding:1px 5px;border-radius:4px;font-size:12px;color:var(--accent);border:1px solid var(--card-border)">'
  ).replace(
    /<pre><code>/g,
    '<pre style="background:var(--card-bg);padding:12px 16px;border-radius:var(--radius-md);overflow-x:auto;border:1px solid var(--card-border);margin:12px 0"><code style="background:transparent;border:none;padding:0;color:var(--text);font-size:12px;line-height:1.6">'
  ).replace(
    /<\/pre>/g,
    '</code></pre>'
  ).replace(
    /<div class="note">/g,
    '<div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:var(--radius-md);padding:12px 16px;margin:16px 0;font-size:13px;color:var(--text)">'
  ).replace(
    /<h3>/g,
    '<h3 style="font-size:16px;font-weight:700;color:var(--text);margin:20px 0 10px">'
  ).replace(
    /<h4>/g,
    '<h4 style="font-size:14px;font-weight:600;color:var(--text);margin:16px 0 8px">'
  ).replace(
    /<p>/g,
    '<p style="margin:0 0 12px">'
  ).replace(
    /<ul>/g,
    '<ul style="margin:0 0 12px;padding-left:20px">'
  ).replace(
    /<ol>/g,
    '<ol style="margin:0 0 12px;padding-left:20px">'
  ).replace(
    /<li>/g,
    '<li style="margin-bottom:4px;line-height:1.6">'
  ).replace(
    /<strong>/g,
    '<strong style="font-weight:600;color:var(--text)">'
  );

  return <div dangerouslySetInnerHTML={{ __html: wrapped }} />;
}

// ─── Main HelpPage Component ─────────────────────────────────────────────
export function HelpPage() {
  const router = useRouter();
  const { user } = useStore();
  const userRole = user?.role;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));
  const [aiMessages, setAiMessages] = useState<{ text: string; isUser: boolean }[]>([
    { text: "Hi! I'm the Resolv documentation assistant. Ask me anything about using the platform, and I'll point you to the right documentation.", isUser: false },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Role-based filtering of documentation sections/articles ───────────
  const filteredSections: DocSection[] = useMemo(() => {
    return docSections
      .filter(section => canAccess(userRole, section.minRole))
      .map(section => ({
        ...section,
        articles: section.articles.filter(article => canAccess(userRole, article.minRole)),
      }))
      .filter(section => section.articles.length > 0);
  }, [userRole]);

  // Scroll AI messages to bottom
  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // Focus search on Cmd+K or /
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (!(e.target as HTMLElement).matches('input,textarea')) {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Search results (role-filtered via filteredSections)
  const searchResults = useMemo(() => searchDocs(searchQuery, userRole), [searchQuery, userRole]);

  // Get the selected article
  const selectedArticleData = useMemo(() => {
    if (!selectedSection || !selectedArticle) return null;
    const section = filteredSections.find(s => s.id === selectedSection);
    if (!section) return null;
    return section.articles.find(a => a.id === selectedArticle) || null;
  }, [selectedSection, selectedArticle, filteredSections]);

  const selectedSectionData = useMemo(() => {
    if (!selectedSection) return null;
    return filteredSections.find(s => s.id === selectedSection) || null;
  }, [selectedSection, filteredSections]);

  // Toggle section expansion in TOC
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
    // Always scroll to section on click
    setSelectedSection(sectionId);
    setSelectedArticle(null);
  }, []);

  // Select an article
  const selectArticle = useCallback((sectionId: string, articleId: string) => {
    setSelectedSection(sectionId);
    setSelectedArticle(articleId);
    setSearchQuery('');
    setExpandedSections(prev => new Set([...prev, sectionId]));
    contentRef.current?.scrollTo(0, 0);
    setMobileTocOpen(false);
  }, []);

  // Navigate to a search result
  const selectSearchResult = useCallback((result: SearchResult) => {
    selectArticle(result.sectionId, result.articleId);
  }, [selectArticle]);

  // AI Assistant - simple local Q&A matching
  const handleAiSend = useCallback(() => {
    const q = aiInput.trim();
    if (!q) return;
    setAiMessages(prev => [...prev, { text: q, isUser: true }]);
    setAiInput('');

    // Search docs for relevant content (respecting role access)
    const results = searchDocs(q, userRole);
    const lower = q.toLowerCase();

    setTimeout(() => {
      let answer = '';

      if (results.length > 0) {
        const top = results.slice(0, 3);
        answer = `Based on the documentation, here's what I found:\n\n`;
        top.forEach((r, i) => {
          answer += `${i + 1}. **${r.articleTitle}** (in ${r.sectionTitle})\n   ${r.description}\n`;
        });
        answer += `\nI've highlighted matching articles in the search results. Click any of them to read the full documentation.`;
      } else {
        // Generic answers for common questions
        if (lower.includes('password') || lower.includes('login')) {
          answer = `For password or login issues:\n\n• Use **"Forgot Password"** on the login page\n• Contact your administrator if locked out\n• Go to **Settings → Security** to change your password\n• Check the **FAQ** section for more details`;
        } else if (lower.includes('ticket') && (lower.includes('create') || lower.includes('new'))) {
          answer = `To create a ticket:\n\n• Press **C** on your keyboard for quick create\n• Click **"New Ticket"** in the sidebar\n• Use the **AI Assistant** to create one by asking\n• Check the **Ticket Management → Creating Tickets** section for full details`;
        } else if (lower.includes('agent') || lower.includes('install')) {
          answer = `For agent installation:\n\n• Download from **Admin → Agent Settings** or **Assets → Download Agent**\n• Run the installer as Administrator\n• The agent auto-installs as a Windows service\n• See the **Windows Agent** section for detailed instructions`;
        } else if (lower.includes('report') || lower.includes('analytics')) {
          answer = `For reports and analytics:\n\n• Go to **Administration → Analytics**\n• Browse the Overview, Operational, and Service Level sections\n• Create custom reports in the Reports tab\n• Export to CSV or Excel\n• See **Reports & Analytics** section for details`;
        } else if (lower.includes('ai') || lower.includes('assistant')) {
          answer = `The AI Assistant helps you work smarter:\n\n• Press **⌘J / Ctrl+J** or click **"Ask AI"** in the sidebar\n• Agents can search tickets, create/update tickets, and search KB\n• Portal users can search their tickets and the knowledge base\n• Configure AI in **Admin → AI Configuration**\n• See the **AI Assistant** section for full details`;
        } else if (lower.includes('sla')) {
          answer = `SLA Policies track response and resolution times:\n\n• Configure in **Admin → SLA Policies**\n• Set target times per priority level\n• Business hours and holidays are respected\n• Tickets show real-time SLA progress\n• See **Ticket Management → SLA Policies** for details`;
        } else if (lower.includes('email') || lower.includes('smtp')) {
          answer = `Email configuration:\n\n• **SMTP** — Outbound email for notifications (Admin → Email)\n• **IMAP** — Inbound email accounts for ticket creation\n• **SendGrid/Mailgun** — Webhook-based inbound email\n• **Auto-Reply Rules** — Automatic responses based on conditions\n• See **Administration → Email Configuration** for details`;
        } else {
          answer = `I couldn't find specific documentation matching "${q}". Try rephrasing your question, or browse the documentation sections on the left. Here are some common topics:\n\n• Creating and managing tickets\n• Installing the Windows Agent\n• Configuring email and notifications\n• Setting up SLA policies\n• Using the AI Assistant\n• Running reports and analytics`;
        }
      }

      setAiMessages(prev => [...prev, { text: answer, isUser: false }]);
    }, 500);
  }, [aiInput, searchDocs]);

  // Render the main content area
  const renderContent = () => {
    // Search mode
    if (searchQuery.trim().length >= 2) {
      return (
        <div style={styles.searchResults}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "<strong style={{ color: 'var(--text)' }}>{searchQuery}</strong>"
          </div>
          {searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
              No results found. Try different keywords or browse the documentation sections.
            </div>
          ) : (
            searchResults.map((r, i) => (
              <div
                key={`${r.sectionId}-${r.articleId}`}
                style={styles.searchResultItem}
                onClick={() => selectSearchResult(r)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg, rgba(37,99,235,0.04))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.background = 'var(--card-bg)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{iconMap[r.sectionIcon] || '📄'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>{r.sectionTitle}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{r.articleTitle}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.excerpt}</div>
              </div>
            ))
          )}
        </div>
      );
    }

    // Article view
    if (selectedArticleData && selectedSectionData) {
      return (
        <div style={styles.articleCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--card-bg)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}
              onClick={() => { setSelectedArticle(null); }}
            >
              ← {selectedSectionData.title}
            </span>
          </div>
          <h1 style={styles.articleTitle}>{selectedArticleData.title}</h1>
          <p style={styles.articleDesc}>{selectedArticleData.description}</p>
          <div style={styles.articleBody}>
            <ThemedTable content={selectedArticleData.content} />
          </div>

          {/* App link */}
          {selectedArticleData.appLink && (
            <div
              style={{
                ...styles.relatedLinks,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onClick={() => router.push(selectedArticleData.appLink!.href)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  {selectedArticleData.appLink.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Navigate to this feature directly
                </div>
              </div>
              <ExternalLink size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            </div>
          )}

          {/* Related links */}
          {selectedArticleData.relatedLinks && selectedArticleData.relatedLinks.length > 0 && (
            <div style={styles.relatedLinks}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Related Topics</div>
              {selectedArticleData.relatedLinks.map((link) => (
                <div
                  key={link.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer', color: 'var(--accent)', fontSize: 13 }}
                  onClick={() => router.push(link.href)}
                >
                  <ChevronRight size={12} />
                  {link.title}
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {selectedArticleData.tags && selectedArticleData.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 24 }}>
              {selectedArticleData.tags.map(tag => (
                <span key={tag} style={{
                  padding: '2px 8px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 12,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Section view (articles list)
    if (selectedSectionData && !selectedArticle) {
      return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 24 }}>{iconMap[selectedSectionData.icon] || '📄'}</span>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{selectedSectionData.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{selectedSectionData.description}</p>
            </div>
          </div>
          {selectedSectionData.articles.map(article => (
            <div
              key={article.id}
              style={styles.articleLink}
              onClick={() => setSelectedArticle(article.id)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg, rgba(37,99,235,0.04))'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.background = 'var(--card-bg)'; }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{article.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{article.description}</div>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      );
    }

    // Welcome/landing page
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={styles.welcomeHeader}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
          <h1 style={styles.welcomeTitle}>Help & Documentation</h1>
          <p style={styles.welcomeSub}>
            Welcome to the Resolv documentation. Browse the sections on the left, use the search bar above, or ask the AI assistant a question.
          </p>
        </div>

        {/* Quick links grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
          marginTop: 8,
        }}>
          {filteredSections.map(section => (
            <div
              key={section.id}
              style={{
                ...styles.sectionCard,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
              onClick={() => {
                setSelectedSection(section.id);
                setExpandedSections(prev => new Set([...prev, section.id]));
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{iconMap[section.icon] || '📄'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{section.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{section.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {section.articles.length} article{section.articles.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick tips */}
        <div style={{
          marginTop: 28,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(79,70,229,0.06))',
          border: '1px solid rgba(37,99,235,0.15)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>💡 Quick Tips</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <div>• Press <kbd style={kbdStyle}>/</kbd> to search docs</div>
            <div>• Press <kbd style={kbdStyle}>C</kbd> to create a ticket anywhere</div>
            <div>• Use the AI Assistant on the right for answers</div>
            <div>• Each doc section links to the relevant feature</div>
            <div>• Tags help you find related content</div>
            <div>• Browse categories for structured learning</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Mobile TOC toggle */}
      {mobileTocOpen && <div style={styles.mobileOverlay} onClick={() => setMobileTocOpen(false)} />}

      {/* TOC Sidebar */}
      <div
        className="help-toc-sidebar"
        style={{
          ...styles.tocSidebar,
          // On mobile, overlay as a fixed panel
          ...(typeof window !== 'undefined' && window.innerWidth <= 900 ? {
            position: 'fixed',
            left: mobileTocOpen ? 0 : -280,
            top: 0,
            height: '100vh',
            zIndex: 110,
            boxShadow: mobileTocOpen ? '4px 0 20px rgba(0,0,0,0.3)' : 'none',
          } : {}),
        }}
      >
        <div style={styles.tocHeader}>
          <BookOpen size={15} />
          Documentation
        </div>
        <div style={styles.tocScroll}>
          {filteredSections.map(section => {
            const isExpanded = expandedSections.has(section.id);
            const isActive = selectedSection === section.id;
            return (
              <div key={section.id}>
                <button
                  style={{
                    ...styles.tocSectionBtn(isExpanded),
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                  onClick={() => toggleSection(section.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-bg, rgba(37,99,235,0.05))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{iconMap[section.icon] || '📄'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.title}</span>
                  {isExpanded ? <ChevronDown size={12} style={{ flexShrink: 0 }} /> : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
                </button>
                {isExpanded && section.articles.map(article => {
                  const isArtActive = selectedArticle === article.id && selectedSection === section.id;
                  return (
                    <button
                      key={article.id}
                      style={styles.tocItem(isArtActive, 1)}
                      onClick={() => selectArticle(section.id, article.id)}
                      onMouseEnter={(e) => { if (!isArtActive) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--accent-bg, rgba(37,99,235,0.04))'; }}}
                      onMouseLeave={(e) => { if (!isArtActive) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1.2 }}>{isArtActive ? '▸' : '·'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{article.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {/* Search bar */}
        <div style={styles.searchBar}>
          <button
            style={styles.mobileTocBtn as React.CSSProperties}
            className="mobile-toc-btn"
            onClick={() => setMobileTocOpen(true)}
          >
            <Menu size={16} />
          </button>
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search documentation... (press / to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--card-border)'; }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={14} />
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {searchQuery.trim().length >= 2 ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}` : `${filteredSections.reduce((a, s) => a + s.articles.length, 0)} articles`}
          </span>
        </div>

        {/* Content */}
        <div ref={contentRef} style={styles.content}>
          {renderContent()}
        </div>
      </div>

      {/* AI Assistant Panel */}
      <div style={styles.aiPanel} className="help-ai-panel">
        <div style={styles.aiHeader}>
          <Sparkles size={14} style={{ color: 'var(--accent)' }} />
          Ask the Docs
        </div>
        <div style={styles.aiMessages}>
          {aiMessages.map((msg, i) => (
            <div key={i} style={styles.aiMessage(msg.isUser)}>
              {msg.text.split('\n').map((line, j) => {
                // Simple markdown-like formatting
                const formatted = line
                  .replace(/\*\*(.+?)\*\*/g, '<strong style="color:inherit">$1</strong>')
                  .replace(/•/g, '&bull;');
                return <div key={j} dangerouslySetInnerHTML={{ __html: formatted || '<br/>' }} />;
              })}
            </div>
          ))}
          <div ref={aiEndRef} />
        </div>
        <div style={styles.aiInput}>
          <input
            type="text"
            placeholder="Ask a question..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend(); }}
            style={styles.aiInputField}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--card-border)'; }}
          />
          <button
            onClick={handleAiSend}
            disabled={!aiInput.trim()}
            style={{
              height: 34,
              padding: '0 12px',
              background: aiInput.trim() ? 'var(--accent)' : 'var(--card-border)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: aiInput.trim() ? 'pointer' : 'default',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              opacity: aiInput.trim() ? 1 : 0.5,
            }}
          >
            Ask
          </button>
        </div>
      </div>

      {/* Scroll to top */}
      <button
        onClick={() => contentRef.current?.scrollTo(0, 0)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 380,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 50,
          opacity: 0.8,
          transition: 'opacity var(--transition)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
      >
        <ArrowUp size={16} />
      </button>

      <style>{`
        @media (max-width: 1200px) {
          .help-ai-panel { display: none !important; }
        }
        @media (max-width: 900px) {
          .help-toc-sidebar { display: none !important; }
          .mobile-toc-btn { display: flex !important; }
        }
        @media (max-width: 768px) {
          .help-toc-sidebar {
            display: flex !important;
            position: fixed !important;
            left: ${mobileTocOpen ? '0' : '-280px'} !important;
            top: 0 !important;
            height: 100vh !important;
            z-index: 110 !important;
            transition: left 0.25s ease !important;
            box-shadow: ${mobileTocOpen ? '4px 0 20px rgba(0,0,0,0.3)' : 'none'} !important;
          }
          .mobile-toc-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  fontSize: 11,
  fontFamily: 'inherit',
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  boxShadow: '0 1px 0 var(--card-border)',
};
