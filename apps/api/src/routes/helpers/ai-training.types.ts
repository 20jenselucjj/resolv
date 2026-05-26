// ─── AI Training Types ────────────────────────────────────────────────────────

export interface AiConfig {
  api_key?: string
  base_url?: string
  provider?: string
  embedding_model?: string
  enabled?: boolean
  model?: string
  system_prompt?: string
  temperature?: string | number
  max_tokens?: number
}

export interface RagConfig {
  enabled?: boolean
  retrieval_strategy?: string
  top_k?: number
  similarity_threshold?: string | number
  chunk_size?: number
  chunk_overlap?: number
  reranking_enabled?: boolean
  citation_mode?: string
  inject_context?: boolean
  semantic_weight?: string | number
}

export interface ChunkResult {
  id: string
  content: string
  source_id: string
  chunk_index: number
  embedding?: string | number[] | null
  source_name?: string
  category?: string
  classification?: string
  score: number
  method: string
  rank?: number
  original_scores?: { keyword: number; semantic: number }
}

export interface QAResult {
  id: string
  question: string
  answer: string
  category?: string
  tags?: string[]
  embedding?: string | number[] | null
  score: number
  method: string
  rank?: number
  original_scores?: { keyword: number; semantic: number }
}

export interface RetrievalResult {
  chunks: ChunkResult[]
  qaPairs: QAResult[]
  strategy: string
}