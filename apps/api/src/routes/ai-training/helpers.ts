import { pool } from '../../db/pool'

// ─── Utility: Cosine Similarity ──────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ─── Utility: Recursive chunk text ───────────────────────────────────────────
// Splits text on semantic boundaries (paragraphs → lines → sentences → words)
// and reassembles into chunks of approximately `chunkSize` length with overlap
export function recursiveChunkText(text: string, chunkSize = 512, overlap = 64): string[] {
  if (!text || text.trim().length === 0) return []

  // Recursive splitter: try separators from most to least semantic
  function splitRecursive(t: string, seps: string[]): string[] {
    if (seps.length === 0) return t.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0) // sentence fallback
    if (t.length <= chunkSize * 1.5) return [t] // small enough, don't split further

    const sep = seps[0]
    if (!sep) return t.split(/(?<=[.?!])\s+/) // sentence split at last resort

    const parts: string[] = []
    let start = 0
    let idx: number
    while ((idx = t.indexOf(sep, start)) !== -1) {
      if (idx > start) parts.push(t.slice(start, idx))
      start = idx + sep.length
    }
    if (start < t.length) parts.push(t.slice(start))

    // If we only got one part, try next separator
    if (parts.length <= 1) return splitRecursive(t, seps.slice(1))

    // Recursively split each part if still too large
    const result: string[] = []
    for (const part of parts) {
      if (part.length > chunkSize * 1.5) {
        result.push(...splitRecursive(part, seps.slice(1)))
      } else if (part.trim()) {
        result.push(part.trim())
      }
    }
    return result
  }

  // Split into segments using recursive boundary detection
  const separators = ['\n\n', '\n', '. ']
  const segments = splitRecursive(text, separators)
  if (segments.length === 0) return []

  // Merge segments into chunks of approximately chunkSize characters
  const chunks: string[] = []
  let currentChunk = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    // If adding this segment would exceed chunkSize, finalize current chunk
    if (currentChunk.length > 0 && currentChunk.length + segment.length + 1 > chunkSize) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim())

      // Start new chunk with overlap from previous
      if (overlap > 0 && currentChunk.length > 0) {
        const overlapStart = Math.max(0, currentChunk.length - overlap)
        // Find nearest sentence/paragraph boundary near overlap point
        const overlapText = currentChunk.slice(overlapStart)
        currentChunk = overlapText + ' ' + segment
      } else {
        currentChunk = segment
      }
    } else {
      currentChunk = currentChunk ? currentChunk + (segment.startsWith('\n') ? '' : ' ') + segment : segment
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim())

  // Handle any chunks that still exceed chunkSize (force-split at word boundaries)
  return chunks.flatMap(chunk => {
    if (chunk.length <= chunkSize) return [chunk]
    const forced: string[] = []
    const words = chunk.split(/\s+/)
    let sub = ''
    for (const word of words) {
      if (sub.length + word.length + 1 > chunkSize && sub) {
        forced.push(sub.trim())
        sub = word
      } else {
        sub = sub ? sub + ' ' + word : word
      }
    }
    if (sub.trim()) forced.push(sub.trim())
    return forced
  })
}

// ─── Utility: Get embeddings from AI provider ────────────────────────────────
export async function getEmbedding(text: string, cfg: any): Promise<number[] | null> {
  try {
    // Fix #1: strip trailing slash to avoid double-slash URL (same bug as chat)
    const apiBase = (cfg.base_url || '').replace(/\/+$/, '')
    // Fix #2: default embedding model — detect provider to use appropriate default
    const provider = (cfg.provider || '').toLowerCase()
    const defaultEmbedModel = (provider === 'google' || provider === 'openrouter' || apiBase.includes('googleapis'))
      ? 'gemini-embedding-001'
      : 'text-embedding-3-small'
    const embedModel = cfg.embedding_model || defaultEmbedModel

    // Fix #3: add a 15-second timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${apiBase}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.api_key}`
      },
      body: JSON.stringify({
        model: embedModel,
        input: text.substring(0, 8000)
      }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      // If embedding endpoint 404s (common for Gemini OpenAI compat), log and return null
      if (res.status === 404) {
        console.warn(`Embedding endpoint not found (404) — provider may not support /embeddings. Using keyword-only search.`)
      }
      return null
    }
    const data = await res.json() as any
    return data.data?.[0]?.embedding || null
  } catch {
    return null
  }
}

// ─── Utility: Process a source (chunk + embed) ───────────────────────────────
export async function processSource(sourceId: string, rawContent: string, cfg: any, ragCfg: any) {
  await pool.query(`UPDATE ai_knowledge_sources SET status='processing' WHERE id=$1`, [sourceId])

  try {
    // Delete existing chunks
    await pool.query(`DELETE FROM ai_knowledge_chunks WHERE source_id=$1`, [sourceId])

    const chunks = recursiveChunkText(rawContent, ragCfg.chunk_size || 512, ragCfg.chunk_overlap || 64)

    if (chunks.length === 0) {
      await pool.query(
        `UPDATE ai_knowledge_sources SET status='error', error_message='No content chunks could be extracted.', updated_at=NOW() WHERE id=$1`,
        [sourceId]
      )
      return
    }

    // Process chunks in parallel batches of 5 to avoid overwhelming the embedding API
    const batchSize = 5
    let embeddingsAttempted = false

    for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
      const batch = chunks.slice(batchStart, batchStart + batchSize)
      const results = await Promise.all(
        batch.map(async (chunk, batchIdx) => {
          const chunkIndex = batchStart + batchIdx
          const wordCount = chunk.split(/\s+/).filter(Boolean).length

          let embedding = null
          let embedModel = null
          if (cfg?.api_key) {
            embeddingsAttempted = true
            try {
              embedding = await getEmbedding(chunk, cfg)
              if (embedding) {
                const provider = (cfg.provider || '').toLowerCase()
                const apiBase = (cfg.base_url || '').replace(/\/+$/, '')
                embedModel = cfg.embedding_model || (
                  (provider === 'google' || provider === 'openrouter' || apiBase.includes('googleapis'))
                    ? 'gemini-embedding-001'
                    : 'text-embedding-3-small'
                )
              }
            } catch {
              // embedding failure is non-fatal — chunk still works for keyword search
            }
          }

          return {
            chunkIndex,
            content: chunk,
            wordCount,
            embedding: embedding ? JSON.stringify(embedding) : null,
            embedModel,
            hasEmbed: !!embedding
          }
        })
      )

      // Batch insert all chunks in this batch
      for (const r of results) {
        await pool.query(
          `INSERT INTO ai_knowledge_chunks (source_id, chunk_index, content, content_tokens, embedding, embedding_model)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sourceId, r.chunkIndex, r.content, r.wordCount, r.embedding, r.embedModel]
        )
      }
    }

    const embedCount = embeddingsAttempted
      ? 'partial' // at least tried, some may have embeddings even if not all
      : 'skipped'

    await pool.query(
      `UPDATE ai_knowledge_sources SET status='ready', chunk_count=$1, updated_at=NOW() WHERE id=$2`,
      [chunks.length, sourceId]
    )

    console.log(
      `[processSource] Source ${sourceId}: ${chunks.length} chunks created. ` +
      `Embeddings: ${embedCount}. Keyword search available.`
    )
  } catch (e: any) {
    console.error(`[processSource] Error processing source ${sourceId}:`, e.message)
    await pool.query(
      `UPDATE ai_knowledge_sources SET status='error', error_message=$1, updated_at=NOW() WHERE id=$2`,
      [e.message, sourceId]
    )
  }
}

// ─── Score normalizer: min-max scale scores to [0, 1] ────────────────────────
export function normalizeScores(items: any[]): any[] {
  if (items.length === 0) return items
  const scores = items.map(i => i.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  if (max - min < 0.001) return items.map(i => ({ ...i, score: 1 }))
  return items.map(i => ({ ...i, score: (i.score - min) / (max - min) }))
}
