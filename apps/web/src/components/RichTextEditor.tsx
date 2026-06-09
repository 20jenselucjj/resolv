'use client';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  preview?: 'live' | 'edit' | 'preview';
  allowImageUpload?: boolean;
}

// Dynamic import saves ~347KB gzipped from initial bundle.
// @uiw/react-md-editor is only loaded when this component first renders.
const RichTextEditor = dynamic<RichTextEditorProps>(
  () => import('./RichTextEditorInner').then((mod) => mod.RichTextEditorInner),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 14,
        gap: 8,
      }}>
        <Loader2 size={20} className="animate-spin" />
        Loading editor...
      </div>
    ),
  }
);

export { RichTextEditor };
