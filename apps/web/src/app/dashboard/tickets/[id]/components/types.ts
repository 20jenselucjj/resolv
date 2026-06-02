'use client';

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  original_name: string;
  uploader_name: string;
  created_at: string;
}