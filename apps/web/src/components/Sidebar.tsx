'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  Ticket, Settings, LogOut,
  Moon, Sun, ChevronLeft, ChevronRight, Plus, Search,
  Bell, BookOpen, Shield, LayoutGrid, BarChart2,
  Sparkles
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

const navItems: NavItem[] = [
  { href: '/dashboard/portal',    icon: LayoutGrid, label: 'Self Service',    userOnly: true },
  { href: '/dashboard/tickets',   icon: Ticket,     label: 'My Tickets',      userOnly: true },
  { href: '/dashboard/tickets',   icon: Ticket,     label: 'Tickets',         agentAndAbove: true },
  { href: '/dashboard/knowledge', icon: BookOpen,   label: 'Knowledge Base',  agentAndAbove: true },
  { href: '/dashboard/reports',   icon: BarChart2,  label: 'Reports',         agentAndAbove: true },
  { href: '/dashboard/admin',     icon: Shield,     label: 'Admin',           adminOnly: true },
  { href: '/dashboard/settings',  icon: Settings,   label: 'Settings',        agentAndAbove: true },
];

export function Sidebar({ onAiOpen, onNewTicket }: { onAiOpen?: () => void; onNewTicket?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, toggleTheme, theme, unreadCount } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  const w = collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  const isUser = user?.role === 'user';
  const isAdmin = user?.role === 'admin';
  const isAgentOrAbove = user?.role === 'agent' || user?.role === 'admin';

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.agentAndAbove) return isAgentOrAbove;
    if (item.userOnly) return isUser;
    return true;
  });

  return (
    <aside style={{
      width: w,
      minWidth: w,
      background: '#1E40AF',
      borderRight: '1px solid rgba(255,255,255,0.15)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'visible',
      position: 'relative',
      flexShrink: 0,
      zIndex: 10,
    }}>

      {/* Drawer handle for collapse/expand */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          right: -12,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 24,
          height: 24,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 20,
          color: '#1E40AF',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

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
          padding: collapsed ? '0 8px' : '0 14px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <img
            src="/logo.png"
            alt="Resolv"
            style={{
              width: collapsed ? 80 : 120,
              height: 'auto',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
        </div>

        {/* Quick actions */}
        {!collapsed && (
          <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => onAiOpen?.()} style={{
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
            {isAgentOrAbove && (
              <button onClick={() => onNewTicket?.()} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px',
                background: 'white',
                color: '#1E40AF',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                transition: 'background var(--transition)',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.9)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              >
                <Plus size={14} />
                New Ticket
              </button>
            )}
          </div>
        )}
        {collapsed && (
          <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <button onClick={() => onAiOpen?.()} data-tooltip="Ask AI" style={{
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
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ display: 'none' }}>⌘J</div>
              <Sparkles size={15} />
            </button>
            {isAgentOrAbove && (
              <button onClick={() => onNewTicket?.()} data-tooltip="New Ticket" style={{
                width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'white',
                color: '#1E40AF',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                transition: 'background var(--transition)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.9)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              >
                <Plus size={15} />
              </button>
            )}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {!collapsed && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px' }}>
              Navigation
            </div>
          )}
          {filteredNavItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-tooltip={collapsed ? label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: collapsed ? '9px' : '7px 9px',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: active ? 'white' : 'rgba(255,255,255,0.7)',
                  background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  marginBottom: 1,
                  transition: 'all var(--transition)',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  if (!active) e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                  if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: '0 2px 2px 0',
                    background: 'white',
                  }} />
                )}
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span style={{ 
                  flex: 1,
                  transition: 'opacity 0.15s ease, max-width 0.25s ease',
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : 200,
                  overflow: 'hidden',
                }}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.15)',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}>
          {/* Utility buttons row */}
          <div style={{ display: 'flex', gap: 4, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            {!isUser && (
              <button
                onClick={() => router.push('/dashboard/portal')}
                data-tooltip={collapsed ? 'Self Service Portal' : undefined}
                style={{
                  ...iconBtnStyle,
                  width: collapsed ? 28 : 'auto',
                  padding: collapsed ? 0 : '0 8px',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <LayoutGrid size={13} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ fontSize: 12, fontWeight: 500 }}>Self Service</span>}
              </button>
            )}
            <button
              onClick={toggleTheme}
              data-tooltip={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
              style={{
                ...iconBtnStyle,
                width: collapsed ? 28 : 'auto',
                padding: collapsed ? 0 : '0 8px',
                gap: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}
            >
              {theme === 'dark' ? <Sun size={13} style={{ flexShrink: 0 }} /> : <Moon size={13} style={{ flexShrink: 0 }} />}
              {!collapsed && (
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </span>
              )}
            </button>
            {!collapsed && (
              <button 
                data-tooltip="Notifications" 
                style={{ ...iconBtnStyle, position: 'relative' }}
                onClick={() => router.push('/dashboard/notifications')}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}
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
                    border: '2px solid #1E40AF',
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* User row */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: collapsed ? '6px 0' : '6px 4px',
              borderRadius: 'var(--radius-md)',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'white',
                flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.3)',
              }}>
                {user.name[0].toUpperCase()}
              </div>
              {!collapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all var(--transition)',
  flexShrink: 0,
};
