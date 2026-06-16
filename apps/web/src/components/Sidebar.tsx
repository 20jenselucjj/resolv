'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  Ticket, Settings, LogOut,
  ChevronLeft, ChevronRight, Plus, Search,
  Bell, BookOpen, Shield, LayoutGrid, BarChart2,
  Sparkles, Monitor, AlertTriangle, CheckSquare,
  GitBranch, Users, Key,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavItem {
  href: string;
  icon: any;
  label: string;
  adminOnly?: boolean;
  agentAndAbove?: boolean; // agents + admins only, not regular users
  userOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'My Workspace',
    items: [
      { href: '/dashboard/portal',  icon: LayoutGrid, label: 'Self Service',   userOnly: true },
      { href: '/dashboard/tickets', icon: Ticket,     label: 'My Tickets',     userOnly: true },
    ],
  },
  {
    title: 'Service Desk',
    items: [
      { href: '/dashboard/tickets',   icon: Ticket,      label: 'Tickets',        agentAndAbove: true },
      { href: '/dashboard/approvals', icon: CheckSquare,  label: 'Approvals',      agentAndAbove: true },
      { href: '/dashboard/knowledge', icon: BookOpen,     label: 'Knowledge Base', agentAndAbove: true },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/dashboard/changes',          icon: GitBranch,      label: 'Changes',         agentAndAbove: true },
      { href: '/dashboard/problems',         icon: AlertTriangle,  label: 'Problems',         agentAndAbove: true },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { href: '/dashboard/assets',                icon: Monitor, label: 'Assets',        agentAndAbove: true },

      { href: '/dashboard/software-licenses',       icon: Key,     label: 'Licenses',      agentAndAbove: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/dashboard/admin',    icon: Shield,    label: 'Admin',         adminOnly: true },
      { href: '/dashboard/analytics',  icon: BarChart2, label: 'Analytics',       adminOnly: true },
    ],
  },
];

interface SidebarProps {
  onAiOpen?: () => void;
  onNewTicket?: () => void;
  onNotificationsOpen?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ onAiOpen, onNewTicket, onNotificationsOpen, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, unreadCount } = useStore();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    queueMicrotask(() => setIsMobile(mediaQuery.matches));
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('resolv_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const isMobileCollapsed = isMobile ? false : collapsed;
  const w = isMobileCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  const isUser = user?.role === 'user';
  const isAdmin = user?.role === 'admin';
  const isAgentOrAbove = user?.role === 'agent' || user?.role === 'admin';

  const filteredSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.adminOnly) return isAdmin;
        if (item.agentAndAbove) return isAgentOrAbove;
        if (item.userOnly) return isUser;
        return true;
      }),
    }))
    .filter(section => section.items.length > 0);

  const asideStyle: React.CSSProperties = isMobile ? {
    width: '224px',
    minWidth: '224px',
    background: 'var(--sidebar-bg)',
    borderRight: '1px solid var(--sidebar-border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'visible',
    position: 'fixed',
    left: mobileOpen ? 0 : -256,
    top: 0,
    zIndex: 1000,
    flexShrink: 0,
  } : {
    width: w,
    minWidth: w,
    background: 'var(--sidebar-bg)',
    borderRight: '1px solid var(--sidebar-border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'visible',
    position: 'relative',
    flexShrink: 0,
    zIndex: 10,
  };

  return (
    <>
      {isMobile && mobileOpen && (
        <div 
          onClick={onMobileClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
        />
      )}
      <aside 
        className={isMobile ? "" : "desktop-sidebar"}
        style={asideStyle}
      >

      {/* Drawer handle for collapse/expand */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute',
            right: -12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 24,
            height: 24,
            background: 'var(--sidebar-btn-bg)',
            border: '1px solid var(--sidebar-border)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 20,
            color: 'var(--sidebar-accent)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      {/* Internal wrapper for hidden overflow of contents */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        width: '100%',
      }}>
        
        {/* Logo */}
        <div style={{
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobileCollapsed ? '0 8px' : '0 14px',
          borderBottom: '3px solid var(--sidebar-border)',
          overflow: 'hidden',
        }}>
          <Image
            src="/logo.png"
            alt="Resolv"
            width={120}
            height={30}
            priority
            style={{
              maxWidth: isMobileCollapsed ? 80 : 120,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
        </div>

        {/* Quick actions */}
        {!isMobileCollapsed && (
          <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {isAgentOrAbove && (
              <button onClick={() => { onAiOpen?.(); onMobileClose?.(); }} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px',
                background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                transition: 'opacity var(--transition)',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={14} />
                  Ask AI
                </div>
              </button>
            )}
            {isAgentOrAbove && (
              <button onClick={() => { onNewTicket?.(); onMobileClose?.(); }} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px',
                background: 'var(--sidebar-btn-bg)',
                color: 'var(--sidebar-btn-text)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all var(--transition)',
                border: '1px solid var(--sidebar-border)',
                cursor: 'pointer',
                width: '100%',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.borderColor = 'var(--sidebar-text-muted)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--sidebar-btn-bg)'; e.currentTarget.style.borderColor = 'var(--sidebar-border)'; }}
              >
                <Plus size={14} />
                New Ticket
              </button>
            )}
          </div>
        )}
        {isMobileCollapsed && (
          <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {isAgentOrAbove && (
              <button onClick={() => { onAiOpen?.(); onMobileClose?.(); }} data-tooltip="Ask AI" style={{
                width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                transition: 'opacity var(--transition)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <div style={{ display: 'none' }}>⌘J</div>
                <Sparkles size={15} />
              </button>
            )}
            {isAgentOrAbove && (
              <button onClick={() => { onNewTicket?.(); onMobileClose?.(); }} data-tooltip="New Ticket" style={{
                width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--sidebar-btn-bg)',
                color: 'var(--sidebar-btn-text)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                transition: 'all var(--transition)',
                border: '1px solid var(--sidebar-border)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.borderColor = 'var(--sidebar-text-muted)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--sidebar-btn-bg)'; e.currentTarget.style.borderColor = 'var(--sidebar-border)'; }}
              >
                <Plus size={15} />
              </button>
            )}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {filteredSections.map((section, si) => (
            <div key={section.title} style={{ marginBottom: si < filteredSections.length - 1 ? 6 : 0 }}>
              {!isMobileCollapsed && (
                <div className="sidebar-section-title">
                  {section.title}
                </div>
              )}
              {section.items.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => onMobileClose?.()}
                    data-tooltip={isMobileCollapsed ? label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: isMobileCollapsed ? '9px' : '7px 9px',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: active ? 'var(--sidebar-text)' : 'var(--sidebar-text-secondary)',
                      background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                      fontWeight: active ? 600 : 400,
                      fontSize: 13,
                      marginBottom: 1,
                      transition: 'all var(--transition)',
                      justifyContent: isMobileCollapsed ? 'center' : 'flex-start',
                      position: 'relative',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'var(--sidebar-hover-bg)';
                      if (!active) e.currentTarget.style.color = 'var(--sidebar-text)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent';
                      if (!active) e.currentTarget.style.color = 'var(--sidebar-text-secondary)';
                    }}
                  >
                    {active && (
                      <div style={{
                        position: 'absolute', left: 0, top: '20%', bottom: '20%',
                        width: 3, borderRadius: '0 2px 2px 0',
                        background: 'var(--sidebar-accent)',
                      }} />
                    )}
                    <Icon size={15} style={{ flexShrink: 0 }} />
                    <span style={{ 
                      flex: 1,
                      transition: 'opacity 0.15s ease, max-width 0.25s ease',
                      opacity: isMobileCollapsed ? 0 : 1,
                      maxWidth: isMobileCollapsed ? 0 : 200,
                      overflow: 'hidden',
                    }}>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div style={{
          borderTop: '1px solid var(--sidebar-border)',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}>
          {/* Utility buttons row */}
          <div style={{ display: 'flex', gap: 4, justifyContent: isMobileCollapsed ? 'center' : 'flex-start' }}>
            {!isUser && (
              <button
                onClick={() => {
                  router.push('/dashboard/portal');
                  onMobileClose?.();
                }}
                data-tooltip={isMobileCollapsed ? 'Self Service Portal' : undefined}
                style={{
                  ...iconBtnStyle,
                  width: isMobileCollapsed ? 28 : 'auto',
                  padding: isMobileCollapsed ? 0 : '0 8px',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.borderColor = 'var(--sidebar-text-muted)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text-secondary)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--sidebar-border)'; }}
              >
                <LayoutGrid size={13} style={{ flexShrink: 0 }} />
                {!isMobileCollapsed && <span style={{ fontSize: 12, fontWeight: 500 }}>Self Service</span>}
              </button>
            )}
            <button
              data-tooltip={isMobileCollapsed ? 'Notifications' : undefined}
              style={{ ...iconBtnStyle, position: 'relative' }}
              onClick={() => {
                onNotificationsOpen?.();
                onMobileClose?.();
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.borderColor = 'var(--sidebar-text-muted)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text-secondary)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--sidebar-border)'; }}
            >
              <Bell size={13} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
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
                  border: '2px solid var(--sidebar-bg)',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {isAgentOrAbove && (
              <button
                onClick={() => {
                  router.push('/dashboard/settings');
                  onMobileClose?.();
                }}
                data-tooltip="Settings"
                style={{ ...iconBtnStyle }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.borderColor = 'var(--sidebar-text-muted)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text-secondary)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--sidebar-border)'; }}
              >
                <Settings size={13} style={{ flexShrink: 0 }} />
              </button>
            )}
          </div>

          {/* User row */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: isMobileCollapsed ? '6px 0' : '6px 4px',
              borderRadius: 'var(--radius-md)',
              justifyContent: isMobileCollapsed ? 'center' : 'flex-start',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--sidebar-active-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--sidebar-text)',
                flexShrink: 0,
                border: '2px solid var(--sidebar-text-muted)',
              }}>
                {user.name[0].toUpperCase()}
              </div>
              {!isMobileCollapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sidebar-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--sidebar-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {user.role}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    data-tooltip="Sign out"
                    style={{ ...iconBtnStyle, color: 'var(--danger)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'var(--danger)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LogOut size={13} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  </>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  background: 'transparent',
  border: '1px solid var(--sidebar-border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  color: 'var(--sidebar-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all var(--transition)',
  flexShrink: 0,
};
