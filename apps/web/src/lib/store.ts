import { create } from 'zustand';
import { API_BASE } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'user';
  avatarUrl?: string;
  department?: string;
  phone?: string;
  is_active?: boolean;
  passwordResetRequired?: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  ticket_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  is_active: boolean;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  body: string;
  is_internal: boolean;
  is_system?: boolean;
  is_edited?: boolean;
  type?: 'comment' | 'system';
  created_at: string;
}

export interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_by_id: string;
  assigned_to_id?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  created_by_name?: string;
  assigned_to_name?: string | null;
  assigned_to_avatar?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  ticket_type?: 'incident' | 'service_request' | 'problem' | 'change';
  due_date?: string | null;
  close_notes?: string | null;
  sla_breached?: boolean;
  first_response_at?: string | null;
  closed_at?: string | null;
  asset_id?: string | null;
  location?: string | null;
  requested_by_id?: string;
  requested_by_name?: string;
  merged_into_id?: string | null;
  merge_reason?: string | null;
  merged_into_number?: number | null;
  merged_into_title?: string | null;
  comments?: Comment[];
}

interface AppState {
  user: User | null;
  token: string | null;
  tickets: Ticket[];
  notifications: Notification[];
  unreadCount: number;
  categories: Category[];
  theme: 'light' | 'dark';
  density: 'compact' | 'spacious';
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setTickets: (tickets: Ticket[]) => void;
  updateTicket: (id: string, updates: Partial<Ticket>) => void;
  addTicket: (ticket: Ticket) => void;
  removeTicket: (id: string) => void;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (n: Notification) => void;
  markNotificationRead: (id: string) => void;
  setCategories: (categories: Category[]) => void;
  toggleTheme: () => void;
  setDensity: (density: 'compact' | 'spacious') => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('resolv_token') : null,
  tickets: [],
  notifications: [],
  unreadCount: 0,
  categories: [],
  theme: typeof window !== 'undefined' ? (localStorage.getItem('resolv_theme') as 'light' | 'dark') || 'dark' : 'dark',
  density: typeof window !== 'undefined' ? (localStorage.getItem('resolv_density') as 'compact' | 'spacious') || 'spacious' : 'spacious',
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) localStorage.setItem('resolv_token', token);
    else localStorage.removeItem('resolv_token');
    set({ token });
  },
  setTickets: (tickets) => set({ tickets }),
  updateTicket: (id, updates) =>
    set((state) => ({
      tickets: state.tickets.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  addTicket: (ticket) => set((state) => ({ tickets: [ticket, ...state.tickets] })),
  removeTicket: (id) => set((state) => ({ tickets: state.tickets.filter((t) => t.id !== id) })),
  setNotifications: (notifications) => set({ 
    notifications, 
    unreadCount: notifications.filter(n => !n.is_read).length 
  }),
  addNotification: (n) => set((state) => {
    const notifications = [n, ...state.notifications];
    return { 
      notifications,
      unreadCount: notifications.filter(notif => !notif.is_read).length
    };
  }),
  markNotificationRead: (id) => {
    // Optimistic update
    set((state) => {
      const notifications = state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
      return {
        notifications,
        unreadCount: notifications.filter(n => !n.is_read).length
      };
    });
    // Persist to API (fire and forget)
    const token = typeof window !== 'undefined' ? localStorage.getItem('resolv_token') : null;
    if (token) {
      fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}); // silent fail — optimistic update already applied
    }
  },
  setCategories: (categories) => set({ categories }),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('resolv_theme', next);
      return { theme: next };
    }),
  setDensity: (density) => {
    localStorage.setItem('resolv_density', density);
    set({ density });
  },
  logout: () => {
    localStorage.removeItem('resolv_token');
    localStorage.removeItem('resolv_refresh_token');
    localStorage.removeItem('resolv_remember_me');
    localStorage.removeItem('resolv_remembered_email');
    set({ user: null, token: null, tickets: [], notifications: [], unreadCount: 0, categories: [] });
  },
}));
