'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { API_BASE, getToken } from '@/lib/api';
import { useStore } from '@/lib/store';
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Quote, Link, Image as ImageIcon, Loader2, UploadCloud,
  Undo, Redo
} from 'lucide-react';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
});

interface WYSIWYGEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
}

export function WYSIWYGEditor({ value, onChange, height = 300, placeholder }: WYSIWYGEditorProps) {
  const store = useStore();
  const theme = (store as any).theme || 'light';
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const isUpdatingRef = useRef(false);

  // Convert markdown to HTML for the editor
  const mdToHtml = useCallback((md: string) => {
    if (!md) return '';
    try {
      return marked.parse(md, { async: false }) as string;
    } catch {
      return md;
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ImageExt.configure({
        inline: false,
        allowBase64: false,
      }),
      LinkExt.configure({
        openOnClick: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write your content...',
      }),
    ],
    content: mdToHtml(value),
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      const html = editor.getHTML();
      try {
        const md = turndown.turndown(html);
        onChange(md);
      } catch {
        // fallback: send HTML if turndown fails
        onChange(html);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        style: `min-height: ${height - 48}px; padding: 16px; color: var(--text); line-height: 1.7;`,
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (!editor) return;
    // Convert current editor HTML to markdown and compare
    const currentMd = turndown.turndown(editor.getHTML());
    if (currentMd !== value) {
      isUpdatingRef.current = true;
      editor.commands.setContent(mdToHtml(value));
      isUpdatingRef.current = false;
    }
  }, [value, editor, mdToHtml]);

  // Cleanup
  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  // Image upload
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
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
      const relativeUrl = data.data.url;
      const origin = new URL(apiBase).origin;
      return origin + relativeUrl;
    } catch (err) {
      console.error('Image upload failed:', err);
      return null;
    }
  }, []);

  // Insert image at cursor
  const insertImage = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    setUploading(false);
  }, [editor, uploadImage]);

  // Toolbar button click handlers
  const toolbarActions = {
    bold: () => editor?.chain().focus().toggleBold().run(),
    italic: () => editor?.chain().focus().toggleItalic().run(),
    h1: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    h2: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    bulletList: () => editor?.chain().focus().toggleBulletList().run(),
    orderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    blockquote: () => editor?.chain().focus().toggleBlockquote().run(),
    link: () => {
      if (!editor) return;
      const prevUrl = editor.getAttributes('link').href;
      const url = window.prompt('URL:', prevUrl || 'https://');
      if (url === null) return;
      if (url === '') {
        editor.chain().focus().unsetLink().run();
      } else {
        editor.chain().focus().setLink({ href: url }).run();
      }
    },
    image: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files || []);
        for (const file of files) {
          await insertImage(file);
        }
      };
      input.click();
    },
    undo: () => editor?.chain().focus().undo().run(),
    redo: () => editor?.chain().focus().redo().run(),
  };

  // Drag-and-drop image upload
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes('Files')) setDragOver(true);
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragOver(false); }
    };
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
      for (const file of files) await insertImage(file);
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
  }, [insertImage]);

  const btnStyle = (active: boolean) => ({
    background: active ? 'var(--accent-subtle)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    padding: '6px 7px',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500 as const,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.12s',
  });

  return (
    <div
      ref={containerRef}
      data-color-mode={theme}
      style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--card)' }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(37,99,235,0.1)',
          border: '3px dashed #2563eb',
          borderRadius: 'var(--radius-md)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, fontSize: 15, fontWeight: 700, color: '#2563eb',
          pointerEvents: 'none', backdropFilter: 'blur(2px)',
        }}>
          <UploadCloud size={36} />
          <span>Drop images here to upload</span>
        </div>
      )}

      {uploading && (
        <div style={{
          position: 'absolute', top: 48, right: 10, zIndex: 51,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent)', color: 'white',
          fontSize: 12, fontWeight: 600,
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}>
          <Loader2 size={14} className="animate-spin" />
          Uploading...
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '6px 8px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)', flexWrap: 'wrap',
      }}>
        <button style={btnStyle(editor?.isActive('bold') || false)} onClick={toolbarActions.bold} title="Bold"><Bold size={15} /></button>
        <button style={btnStyle(editor?.isActive('italic') || false)} onClick={toolbarActions.italic} title="Italic"><Italic size={15} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btnStyle(editor?.isActive('heading', { level: 1 }) || false)} onClick={toolbarActions.h1} title="Heading 1"><Heading1 size={15} /></button>
        <button style={btnStyle(editor?.isActive('heading', { level: 2 }) || false)} onClick={toolbarActions.h2} title="Heading 2"><Heading2 size={15} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btnStyle(editor?.isActive('bulletList') || false)} onClick={toolbarActions.bulletList} title="Bullet list"><List size={15} /></button>
        <button style={btnStyle(editor?.isActive('orderedList') || false)} onClick={toolbarActions.orderedList} title="Ordered list"><ListOrdered size={15} /></button>
        <button style={btnStyle(editor?.isActive('blockquote') || false)} onClick={toolbarActions.blockquote} title="Blockquote"><Quote size={15} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btnStyle(editor?.isActive('link') || false)} onClick={toolbarActions.link} title="Link"><Link size={15} /></button>
        <button style={btnStyle(false)} onClick={toolbarActions.image} title="Upload image"><ImageIcon size={15} /></button>
        <div style={{ flex: 1 }} />
        <button style={btnStyle(false)} onClick={toolbarActions.undo} title="Undo"><Undo size={14} /></button>
        <button style={btnStyle(false)} onClick={toolbarActions.redo} title="Redo"><Redo size={14} /></button>
      </div>

      {/* Editor content area */}
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--text-muted);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: var(--radius-sm);
          margin: 8px 0;
          display: block;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
        }
        .ProseMirror blockquote {
          border-left: 3px solid var(--border);
          padding-left: 12px;
          color: var(--text-secondary);
          margin: 8px 0;
        }
        .ProseMirror code {
          background: var(--bg-secondary);
          border-radius: 3px;
          padding: 2px 5px;
          font-size: 0.9em;
        }
        .ProseMirror pre {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 12px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .ProseMirror a {
          color: var(--accent);
          text-decoration: underline;
        }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  );
}
