import { pool } from '../../db/pool'
import { cosineSimilarity, getEmbedding, normalizeScores } from './ai-training.utils'
import type { AiConfig, RagConfig, RetrievalResult } from './ai-training.types'

// ─── RAG Retrieval (exported for use in ai.ts) ───────────────────────────────
export async function retrieveContext(
  query: string,
  cfg: AiConfig | null,
  ragCfg: RagConfig
): Promise<RetrievalResult> {
  const strategy = ragCfg.retrieval_strategy || 'hybrid'
  const topK = ragCfg.top_k || 5
  const threshold = parseFloat(String(ragCfg.similarity_threshold)) || 0.70
  const semanticWeight = parseFloat(String(ragCfg.semantic_weight)) || 0.6 // weight for semantic vs keyword in hybrid

  let chunks: any[] = []
  let qaPairs: any[] = []

  // ── Keyword search (always fast, always available) ──
  if (strategy === 'keyword' || strategy === 'hybrid') {
    const safeQuery = query.replace(/[^\w\s]/g, ' ').trim()
    const terms = safeQuery.split(/\s+/).filter(Boolean)
    const tsQuery = terms.join(' & ')

    if (tsQuery) {
      const { rows: kwChunks } = await pool.query(
        `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                s.name as source_name, s.category, s.classification,
                ts_rank(c.search_vector, to_tsquery('english', $1)) as rank
         FROM ai_knowledge_chunks c
         JOIN ai_knowledge_sources s ON c.source_id = s.id
         WHERE s.is_active = true AND s.status = 'ready'
           AND c.search_vector @@ to_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $2`,
        [tsQuery, topK * 3]
      )
      chunks.push(...kwChunks.map(r => ({ ...r, score: parseFloat(r.rank), method: 'keyword' })))

      const { rows: kwQA } = await pool.query(
        `SELECT id, question, answer, category, tags,
                ts_rank(search_vector, to_tsquery('english', $1)) as rank
         FROM ai_knowledge_qa
         WHERE is_active = true AND search_vector @@ to_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $2`,
        [tsQuery, Math.ceil(topK / 2)]
      )
      qaPairs.push(...kwQA.map(r => ({ ...r, score: parseFloat(r.rank), method: 'keyword' })))
    }

    // Fallback: if keyword search returned nothing and we have terms,
    // try simple ILIKE matching (catches cases where stop words removed everything)
    if (chunks.length === 0 && terms.length > 0) {
      const likeConditions = terms.map((_, i) => `c.content ILIKE $${i + 2}`).join(' AND ')
      const likeParams = terms.map(t => `%${t}%`)
      const { rows: likeChunks } = await pool.query(
        `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                s.name as source_name, s.category, s.classification, 0 as rank
         FROM ai_knowledge_chunks c
         JOIN ai_knowledge_sources s ON c.source_id = s.id
         WHERE s.is_active = true AND s.status = 'ready'
           AND ${likeConditions}
         LIMIT $1`,
        [topK, ...likeParams]
      )
      chunks.push(...likeChunks.map(r => ({ ...r, score: 0.5, method: 'keyword-fallback' })))
    }
  }

  // ── Semantic search (if embeddings available) ──
  // Uses two-stage approach for scalability:
  //   1. Get candidate IDs from keyword results (or use a broader keyword query)
  //   2. Re-rank those candidates with semantic similarity
  // This avoids loading ALL embeddings into memory.
  if ((strategy === 'semantic' || strategy === 'hybrid') && cfg?.api_key) {
    const queryEmbedding = await getEmbedding(query, cfg)
    if (queryEmbedding) {
      // Collect candidate IDs from keyword results if in hybrid mode
      let candidateIds: string[] = []
      if (strategy === 'hybrid' && chunks.length > 0) {
        candidateIds = chunks.map(c => c.id)
      }

      let semanticCandidates: any[]
      if (candidateIds.length > 0) {
        // Stage 1: Narrow search — only re-rank keyword candidates semantically
        const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(',')
        const { rows } = await pool.query(
          `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                  s.name as source_name, s.category, s.classification
           FROM ai_knowledge_chunks c
           JOIN ai_knowledge_sources s ON c.source_id = s.id
           WHERE c.id IN (${placeholders}) AND c.embedding IS NOT NULL`,
          candidateIds
        )
        semanticCandidates = rows
      } else {
        // Pure semantic or hybrid without keyword matches — use a broader sample
        // Fetch up to topK*4 chunks (more scalable than the previous 2000 limit)
        const { rows } = await pool.query(
          `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                  s.name as source_name, s.category, s.classification
           FROM ai_knowledge_chunks c
           JOIN ai_knowledge_sources s ON c.source_id = s.id
           WHERE s.is_active = true AND s.status = 'ready' AND c.embedding IS NOT NULL
           ORDER BY c.id
           LIMIT $1`,
          [topK * 4]
        )
        semanticCandidates = rows
      }

      // Score candidates with semantic similarity
      const scored = semanticCandidates
        .map(row => {
          const emb = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding
          const score = cosineSimilarity(queryEmbedding, emb)
          return { ...row, score, method: 'semantic' }
        })
        .filter(r => r.score >= threshold)

      if (strategy === 'hybrid') {
        // Hybrid scoring: normalize keyword scores, then combine with semantic
        if (chunks.length > 0) {
          const kwIds = new Set(chunks.map(c => c.id))
          const kwOnly = chunks.filter(c => !scored.some(s => s.id === c.id))
          const scoredByKwId = new Map(scored.map(s => [s.id, s]))

          chunks = chunks.map(c => {
            const sem = scoredByKwId.get(c.id)
            if (!sem) return c // no semantic score, keep keyword score
            // Normalize both scores to [0, 1] and combine with weighted average
            const kwScore = c.score
            const semScore = sem.score
            const combined = (kwScore * (1 - semanticWeight) + semScore * semanticWeight)
            return { ...c, score: combined, method: 'hybrid', original_scores: { keyword: kwScore, semantic: semScore } }
          })

          // Add chunks found only by semantic search
          for (const sc of scored) {
            if (!kwIds.has(sc.id)) {
              chunks.push(sc)
            }
          }
        } else {
          // No keyword results — use semantic results directly
          chunks.push(...scored)
        }
      } else {
        // Pure semantic — use scored results directly
        chunks = scored
      }

      // Q&A semantic search — two-stage with keyword candidates when possible
      let qaCandidates: any[]
      const qaKwIds = new Set(qaPairs.map(q => q.id))
      if (qaKwIds.size > 0) {
        // Re-rank keyword QA results semantically
        const placeholders = [...qaKwIds].map((_, i) => `$${i + 1}`).join(',')
        const { rows } = await pool.query(
          `SELECT id, question, answer, category, tags, embedding
           FROM ai_knowledge_qa WHERE id IN (${placeholders}) AND embedding IS NOT NULL`,
          [...qaKwIds]
        )
        qaCandidates = rows
      } else {
        // Broader search — limited sample
        const { rows } = await pool.query(
          `SELECT id, question, answer, category, tags, embedding
           FROM ai_knowledge_qa WHERE is_active = true AND embedding IS NOT NULL LIMIT $1`,
          [Math.ceil(topK)]
        )
        qaCandidates = rows
      }

      const scoredQA = qaCandidates
        .map(row => {
          const emb = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding
          const score = cosineSimilarity(queryEmbedding, emb)
          return { ...row, score, method: 'semantic' }
        })
        .filter(r => r.score >= threshold)

      for (const sq of scoredQA) {
        const existing = qaPairs.find(q => q.id === sq.id)
        if (!existing) {
          qaPairs.push(sq)
        } else {
          // Update keyword QA with hybrid score if applicable
          const combined = existing.score * (1 - semanticWeight) + sq.score * semanticWeight
          existing.score = combined
          existing.method = 'hybrid'
          existing.original_scores = { keyword: existing.score, semantic: sq.score }
        }
      }
    }
  }

  // Normalize all scores to [0, 1] for consistent ranking
  chunks = normalizeScores(chunks)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  qaPairs = normalizeScores(qaPairs)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.ceil(topK / 2))

  return { chunks, qaPairs, strategy }
}