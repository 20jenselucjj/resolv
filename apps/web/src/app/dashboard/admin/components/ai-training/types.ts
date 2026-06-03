'use client';

export interface KnowledgeSource {
  id: string;
  name: string;
  source_type: 'manual' | 'url' | 'file' | 'kb_sync' | 'ticket_sync';
  raw_content?: string;
  url?: string;
  tags: string[];
  category: string;
  classification: 'unclassified' | 'sensitive' | 'confidential' | 'secret';
  status: 'pending' | 'processing' | 'ready' | 'error';
  chunk_count: number;
  is_active: boolean;
  created_at: string;
  scope?: string;
}

export interface Chunk {
  id: string;
  content: string;
  chunk_index: number;
  has_embedding?: boolean;
  content_tokens?: number;
  embedding_model?: string;
}

export interface QAPair {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  scope?: string;
}

export interface RAGConfig {
  enabled: boolean;
  retrieval_strategy: 'keyword' | 'semantic' | 'hybrid';
  top_k: number;
  similarity_threshold: number;
  chunk_size: number;
  chunk_overlap: number;
  citation_mode: 'inline' | 'footer' | 'none';
  inject_context: boolean;
  semantic_weight: number;
}

export interface TestResult {
  strategy: string;
  retrieval_ms: number;
  total_results: number;
  test_response?: string;
  qa_pairs?: {
    question: string;
    answer: string;
    score: number;
  }[];
  chunks?: {
    source_name: string;
    classification: 'unclassified' | 'sensitive' | 'confidential' | 'secret';
    content: string;
    score: number;
  }[];
}

export interface AnalyticsData {
  summary: {
    total_queries: number;
    avg_confidence: number;
    flagged_count: number;
    active_sources: number;
    total_sources: number;
  };
  daily_volume: { date: string; count: number }[];
  source_stats: {
    name: string;
    category: string;
    chunk_count: number;
    query_hits: number;
  }[];
  recent_queries: {
    id: string;
    query: string;
    user_name: string;
    created_at: string;
    confidence_score: number;
    flagged_for_review: boolean;
  }[];
}