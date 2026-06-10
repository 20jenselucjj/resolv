'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface PinButtonProps {
  isPinned: boolean;
  onPin: () => void | Promise<void>;
  onUnpin: () => void | Promise<void>;
  size?: number;
}

const PinButton: React.FC<PinButtonProps> = ({ isPinned, onPin, onUnpin, size = 16 }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (isPinned) {
        await onUnpin();
      } else {
        await onPin();
      }
    } catch {
      // Silently fail — errors logged in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={isPinned ? 'Unpin metric' : 'Pin metric to dashboard'}
      style={{
        background: 'none',
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        padding: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'inherit',
        opacity: loading ? 0.5 : isPinned ? 1 : 0.4,
        transition: 'opacity 0.2s, transform 0.15s',
        borderRadius: 6,
        color: isPinned ? 'var(--warning, #F59E0B)' : 'var(--text-muted, #9CA3AF)',
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = isPinned ? 'scale(1.2)' : 'scale(1.15)';
          e.currentTarget.style.transition = isPinned ? 'opacity 0.2s, transform 0.15s, filter 0.3s' : 'opacity 0.2s, transform 0.15s';
          if (isPinned) {
            e.currentTarget.style.filter = 'brightness(1.2) drop-shadow(0 0 4px rgba(245,158,11,0.4))';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          e.currentTarget.style.opacity = isPinned ? '1' : '0.4';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.filter = 'none';
        }
      }}
    >
      <Star
        size={size}
        fill={isPinned ? 'var(--warning, #F59E0B)' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
      />
    </button>
  );
};

export default PinButton;
