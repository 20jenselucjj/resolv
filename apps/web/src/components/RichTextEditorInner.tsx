'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { API_BASE, getToken } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Loader2, Image as ImageIcon, UploadCloud } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  preview?: 'live' | 'edit' | 'preview';
  allowImageUpload?: boolean;
}

export function RichTextEditorInner({
  value,
  onChange,
  height = 400,
  placeholder,
  preview = 'live',
  allowImageUpload = true
}: RichTextEditorProps) {
  const { theme } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    setUploadProgress(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = typeof window !== 'undefined' ? getToken() : null;
      const apiBase = API_BASE;
      const res = await fetch(`${apiBase}/knowledge/images`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadProgress('');
      // Convert the relative URL to absolute so images render in the editor preview
      const relativeUrl = data.data.url;
      const origin = new URL(apiBase).origin;
      return origin + relativeUrl;
    } catch (err) {
      console.error('Image upload failed:', err);
      setUploadProgress('');
      return null;
    }
  }, []);

  const insertImageMarkdown = useCallback((url: string, alt: string) => {
    const mdImage = `\n![${alt}](${url})\n`;
    onChange(value + mdImage);
  }, [onChange, value]);

  // Global drag-and-drop listeners - handles drops anywhere in the editor area
  useEffect(() => {
    if (!allowImageUpload) return;

    const el = containerRef.current;
    if (!el) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      // Only show overlay for image files
      if (e.dataTransfer?.types.includes('Files')) {
        setDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setDragOver(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setDragOver(false);

      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) return;

      setUploading(true);
      for (const file of files) {
        const url = await uploadImage(file);
        if (url) {
          const alt = file.name.replace(/\.[^.]+$/, '');
          insertImageMarkdown(url, alt);
        }
      }
      setUploading(false);
    };

    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);

    return () => {
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('drop', handleDrop);
    };
  }, [allowImageUpload, uploadImage, insertImageMarkdown]);

  // Custom image toolbar button that triggers file input
  const imageUploadCommand: commands.ICommand = {
    name: 'image-upload',
    keyCommand: 'image-upload',
    buttonProps: { 'aria-label': 'Upload image', title: 'Upload image' },
    icon: <ImageIcon size={14} />,
    execute: (_state, _api) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files || []);
        if (files.length === 0) return;
        setUploading(true);
        for (const file of files) {
          const url = await uploadImage(file);
          if (url) {
            const alt = file.name.replace(/\.[^.]+$/, '');
            insertImageMarkdown(url, alt);
          }
        }
        setUploading(false);
      };
      input.click();
    },
  };

  const allCommands = allowImageUpload
    ? [...commands.getCommands(), commands.divider, imageUploadCommand]
    : commands.getCommands();

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', minHeight: height }}
      data-color-mode={theme}
    >
      {/* Drag-over overlay — rendered above the editor */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(37,99,235,0.1)',
          border: '3px dashed #2563eb',
          borderRadius: 'var(--radius-md)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, fontSize: 15, fontWeight: 700, color: '#2563eb',
          pointerEvents: 'none',
          backdropFilter: 'blur(2px)',
        }}>
          <UploadCloud size={36} />
          <span>Drop images here to upload</span>
          <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>PNG, JPEG, GIF, WebP supported</span>
        </div>
      )}

      {/* Uploading indicator */}
      {(uploading || uploadProgress) && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 51,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent)', color: 'white',
          fontSize: 12, fontWeight: 600,
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}>
          <Loader2 size={14} className="animate-spin" />
          {uploadProgress || 'Uploading...'}
        </div>
      )}

      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview={preview}
        commands={allCommands}
        extraCommands={[]}
        textareaProps={{
          placeholder: placeholder || 'Write your content in Markdown... Drag and drop images here.',
        }}
        visibleDragbar={true}
      />
    </div>
  );
}
