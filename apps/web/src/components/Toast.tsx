'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// Global toast store (simple event-based, no extra deps)
type Listener = (toasts: ToastItem[]) => void;
let toasts: ToastItem[] = [];
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach(l => l([...toasts]));
}

export const toast = {
  show(item: Omit<ToastItem, 'id'>) {
    const id = Math.random().toString(36).slice(2);
    toasts = [...toasts, { ...item, id }];
    notify();
    const duration = item.duration ?? (item.type === 'error' ? 6000 : 4000);
    setTimeout(() => toast.dismiss(id), duration);
    return id;
  },
  success(title: string, message?: string) { return toast.show({ type: 'success', title, message }); },
  error(title: string, message?: string) { return toast.show({ type: 'error', title, message, duration: 7000 }); },
  warning(title: string, message?: string) { return toast.show({ type: 'warning', title, message }); },
  info(title: string, message?: string) { return toast.show({ type: 'info', title, message }); },
  dismiss(id: string) {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  },
};

const TOAST_CONFIG = {
  success: { icon: CheckCircle2, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', titleColor: '#065f46' },
  error:   { icon: XCircle,      color: '#ef4444', bg: '#fef2f2', border: '#fecaca', titleColor: '#991b1b' },
  warning: { icon: AlertTriangle,color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', titleColor: '#92400e' },
  info:    { icon: Info,         color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', titleColor: '#1e40af' },
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => setItems(t);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {items.map(item => {
        const cfg = TOAST_CONFIG[item.type];
        const Icon = cfg.icon;
        return (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px',
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: 280, maxWidth: 380,
            animation: 'toastIn 0.25s cubic-bezier(0.16,1,0.3,1)',
            pointerEvents: 'all',
          }}>
            <Icon size={16} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: cfg.titleColor }}>{item.title}</div>
              {item.message && <div style={{ fontSize: 12, color: cfg.titleColor, opacity: 0.8, marginTop: 2, lineHeight: 1.4 }}>{item.message}</div>}
            </div>
            <button onClick={() => toast.dismiss(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, opacity: 0.6, display: 'flex', padding: 0, flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
