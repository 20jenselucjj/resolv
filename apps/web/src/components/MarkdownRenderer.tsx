'use client';

import React from 'react';

/**
 * Lightweight markdown renderer — handles the subset of markdown
 * commonly used in ITSM ticket descriptions and comments.
 *
 * Supports: bold, italic, inline code, code blocks, links, lists,
 * headings, blockquotes, horizontal rules, paragraphs, auto-links, images.
 */

function renderMarkdown(text: string): string {
  // Escape HTML entities first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```...```) — must process before inline code
  html = html.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
    const escaped = code
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    return `<pre><code>${escapeHtml(escaped)}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Horizontal rules
  html = html.replace(/^---\s*$/gm, '<hr />');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Images ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%;height:auto;border-radius:var(--radius);margin:1em 0;display:block" />'
  );

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Auto-link bare URLs
  html = html.replace(
    /(?<!=")(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Unordered lists
  html = html.replace(/^(\s*[-*]\s+.+(\n|$))+/gm, (match) => {
    const items = match
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => `<li>${l.replace(/^[\s]*[-*]\s+/, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/^(\s*\d+\.\s+.+(\n|$))+/gm, (match) => {
    const items = match
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => `<li>${l.replace(/^[\s]*\d+\.\s+/, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: wrap consecutive lines of text in <p> tags
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // If it's already a block-level element, don't wrap in <p>
      if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|div|table)/i.test(trimmed)) {
        return trimmed;
      }
      // Handle single line breaks within paragraph
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export function MarkdownRenderer({ content, className, style }: MarkdownRendererProps) {
  if (!content) return null;
  const html = renderMarkdown(content);

  return (
    <div
      className={className}
      style={{
        lineHeight: 1.7,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
