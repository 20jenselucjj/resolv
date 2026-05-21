import { FastifyInstance } from 'fastify'
import { pool } from '../db/pool'

// ─── Utility: Cosine Similarity ──────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
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

// ─── Utility: Chunk text ─────────────────────────────────────────────────────
function chunkText(text: string, chunkSize = 512, overlap = 64): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk.trim())
    i += chunkSize - overlap
    if (i >= words.length) break
  }
  return chunks
}

// ─── Utility: Get embeddings from AI provider ────────────────────────────────
async function getEmbedding(text: string, cfg: any): Promise<number[] | null> {
  try {
    const res = await fetch(`${cfg.base_url}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.api_key}`
      },
      body: JSON.stringify({
        model: cfg.embedding_model || 'text-embedding-3-small',
        input: text.substring(0, 8000)
      })
    })
    if (!res.ok) return null
    const data = await res.json() as any
    return data.data?.[0]?.embedding || null
  } catch {
    return null
  }
}

// ─── Utility: Process a source (chunk + embed) ───────────────────────────────
async function processSource(sourceId: string, rawContent: string, cfg: any, ragCfg: any) {
  await pool.query(`UPDATE ai_knowledge_sources SET status='processing' WHERE id=$1`, [sourceId])

  try {
    // Delete existing chunks
    await pool.query(`DELETE FROM ai_knowledge_chunks WHERE source_id=$1`, [sourceId])

    const chunks = chunkText(rawContent, ragCfg.chunk_size || 512, ragCfg.chunk_overlap || 64)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = cfg?.api_key ? await getEmbedding(chunk, cfg) : null
      const wordCount = chunk.split(/\s+/).length

      await pool.query(
        `INSERT INTO ai_knowledge_chunks (source_id, chunk_index, content, content_tokens, embedding, embedding_model)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sourceId, i, chunk, wordCount,
          embedding ? JSON.stringify(embedding) : null,
          embedding ? (cfg.embedding_model || 'text-embedding-3-small') : null
        ]
      )
    }

    await pool.query(
      `UPDATE ai_knowledge_sources SET status='ready', chunk_count=$1, updated_at=NOW() WHERE id=$2`,
      [chunks.length, sourceId]
    )
  } catch (e: any) {
    await pool.query(
      `UPDATE ai_knowledge_sources SET status='error', error_message=$1, updated_at=NOW() WHERE id=$2`,
      [e.message, sourceId]
    )
  }
}

// ─── RAG Retrieval (exported for use in ai.ts) ───────────────────────────────
export async function retrieveContext(
  query: string,
  cfg: any,
  ragCfg: any
): Promise<{ chunks: any[]; qaPairs: any[]; strategy: string }> {
  const strategy = ragCfg.retrieval_strategy || 'hybrid'
  const topK = ragCfg.top_k || 5
  const threshold = parseFloat(ragCfg.similarity_threshold) || 0.70

  let chunks: any[] = []
  let qaPairs: any[] = []

  // ── Keyword search (always fast, always available) ──
  if (strategy === 'keyword' || strategy === 'hybrid') {
    const safeQuery = query.replace(/[^\w\s]/g, ' ').trim()
    const tsQuery = safeQuery.split(/\s+/).filter(Boolean).join(' & ')

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
        [tsQuery, topK * 2]
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
  }

  // ── Semantic search (if embeddings available) ──
  if ((strategy === 'semantic' || strategy === 'hybrid') && cfg?.api_key) {
    const queryEmbedding = await getEmbedding(query, cfg)
    if (queryEmbedding) {
      // Load all active chunks with embeddings
      const { rows: allChunks } = await pool.query(
        `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                s.name as source_name, s.category, s.classification
         FROM ai_knowledge_chunks c
         JOIN ai_knowledge_sources s ON c.source_id = s.id
         WHERE s.is_active = true AND s.status = 'ready' AND c.embedding IS NOT NULL
         LIMIT 2000`
      )

      const scored = allChunks
        .map(row => {
          const emb = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding
          const score = cosineSimilarity(queryEmbedding, emb)
          return { ...row, score, method: 'semantic' }
        })
        .filter(r => r.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

      // Merge with keyword results (deduplicate by id, prefer higher score)
      for (const sc of scored) {
        const existing = chunks.find(c => c.id === sc.id)
        if (!existing) {
          chunks.push(sc)
        } else if (sc.score > existing.score) {
          existing.score = sc.score
          existing.method = 'hybrid'
        }
      }

      // Q&A semantic search
      const { rows: allQA } = await pool.query(
        `SELECT id, question, answer, category, tags, embedding
         FROM ai_knowledge_qa WHERE is_active = true AND embedding IS NOT NULL LIMIT 500`
      )
      const scoredQA = allQA
        .map(row => {
          const emb = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding
          const score = cosineSimilarity(queryEmbedding, emb)
          return { ...row, score, method: 'semantic' }
        })
        .filter(r => r.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.ceil(topK / 2))

      for (const sq of scoredQA) {
        const existing = qaPairs.find(q => q.id === sq.id)
        if (!existing) qaPairs.push(sq)
      }
    }
  }

  // Sort and deduplicate final results
  chunks = chunks
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  qaPairs = qaPairs
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.ceil(topK / 2))

  return { chunks, qaPairs, strategy }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
export async function aiTrainingRoutes(app: FastifyInstance) {

  // ── GET /ai/rag/config ──────────────────────────────────────────────────────
  app.get('/ai/rag/config', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    if (rows.length === 0) {
      await pool.query('INSERT INTO ai_rag_config DEFAULT VALUES')
      const { rows: r2 } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
      return reply.send({ data: r2[0] })
    }
    return reply.send({ data: rows[0] })
  })

  // ── PUT /ai/rag/config ──────────────────────────────────────────────────────
  app.put('/ai/rag/config', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const body = req.body as any
    const { rows: existing } = await pool.query('SELECT id FROM ai_rag_config LIMIT 1')

    if (existing.length === 0) {
      const { rows } = await pool.query(
        `INSERT INTO ai_rag_config (enabled, retrieval_strategy, top_k, similarity_threshold, chunk_size, chunk_overlap, reranking_enabled, citation_mode, inject_context)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [body.enabled ?? true, body.retrieval_strategy ?? 'hybrid', body.top_k ?? 5,
         body.similarity_threshold ?? 0.70, body.chunk_size ?? 512, body.chunk_overlap ?? 64,
         body.reranking_enabled ?? false, body.citation_mode ?? 'inline', body.inject_context ?? true]
      )
      return reply.send({ data: rows[0] })
    }

    const { rows } = await pool.query(
      `UPDATE ai_rag_config SET enabled=$1, retrieval_strategy=$2, top_k=$3, similarity_threshold=$4,
       chunk_size=$5, chunk_overlap=$6, reranking_enabled=$7, citation_mode=$8, inject_context=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [body.enabled ?? true, body.retrieval_strategy ?? 'hybrid', body.top_k ?? 5,
       body.similarity_threshold ?? 0.70, body.chunk_size ?? 512, body.chunk_overlap ?? 64,
       body.reranking_enabled ?? false, body.citation_mode ?? 'inline', body.inject_context ?? true,
       existing[0].id]
    )

    await pool.query(`INSERT INTO audit_log (actor_id, action, entity_type) VALUES ($1, 'update_rag_config', 'ai_rag_config')`, [(req as any).user.id])
    return reply.send({ data: rows[0] })
  })

  // ── GET /ai/knowledge/sources ───────────────────────────────────────────────
  app.get('/ai/knowledge/sources', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT s.*, u.name as uploaded_by_name
       FROM ai_knowledge_sources s
       LEFT JOIN users u ON s.uploaded_by = u.id
       ORDER BY s.created_at DESC`
    )
    return reply.send({ data: rows })
  })

  // ── POST /ai/knowledge/sources ──────────────────────────────────────────────
  app.post('/ai/knowledge/sources', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const user = (req as any).user
    const body = req.body as any
    const { name, source_type, raw_content, url, tags, category, classification, content_type, original_filename } = body

    if (!name?.trim()) return reply.status(400).send({ error: 'Name is required' })
    if (!raw_content?.trim() && source_type !== 'url') return reply.status(400).send({ error: 'Content is required' })

    let finalContent = raw_content || ''

    // Fetch URL content if source_type is url
    if (source_type === 'url' && url) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Resolv-ITSM-RAG/1.0' } })
        const html = await res.text()
        // Strip HTML tags for plain text
        finalContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      } catch (e: any) {
        return reply.status(400).send({ error: `Failed to fetch URL: ${e.message}` })
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO ai_knowledge_sources (name, source_type, content_type, original_filename, url, raw_content, tags, category, classification, uploaded_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [name.trim(), source_type || 'manual', content_type || 'text/plain', original_filename || null,
       url || null, finalContent, tags || [], category || null, classification || 'unclassified', user.id]
    )

    const source = rows[0]

    // Load configs for processing
    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const { rows: ragRows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    const cfg = cfgRows[0] || null
    const ragCfg = ragRows[0] || { chunk_size: 512, chunk_overlap: 64 }

    // Process asynchronously (don't await — return immediately)
    processSource(source.id, finalContent, cfg, ragCfg).catch(console.error)

    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'create_knowledge_source', 'ai_knowledge_sources', $2, $3)`,
      [user.id, source.id, JSON.stringify({ name, source_type })]
    )

    return reply.status(201).send({ data: source })
  })

  // ── GET /ai/knowledge/sources/:id ──────────────────────────────────────────
  app.get('/ai/knowledge/sources/:id', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const { rows } = await pool.query(
      `SELECT s.*, u.name as uploaded_by_name FROM ai_knowledge_sources s
       LEFT JOIN users u ON s.uploaded_by = u.id WHERE s.id=$1`,
      [id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Source not found' })
    return reply.send({ data: rows[0] })
  })

  // ── PATCH /ai/knowledge/sources/:id ────────────────────────────────────────
  app.patch('/ai/knowledge/sources/:id', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { rows } = await pool.query(
      `UPDATE ai_knowledge_sources SET name=COALESCE($1,name), tags=COALESCE($2,tags),
       category=COALESCE($3,category), classification=COALESCE($4,classification),
       is_active=COALESCE($5,is_active), updated_at=NOW() WHERE id=$6 RETURNING *`,
      [body.name, body.tags, body.category, body.classification, body.is_active, id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Source not found' })
    return reply.send({ data: rows[0] })
  })

  // ── DELETE /ai/knowledge/sources/:id ───────────────────────────────────────
  app.delete('/ai/knowledge/sources/:id', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const { rows } = await pool.query('SELECT name FROM ai_knowledge_sources WHERE id=$1', [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Source not found' })
    await pool.query('DELETE FROM ai_knowledge_sources WHERE id=$1', [id])
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id)
       VALUES ($1, 'delete_knowledge_source', 'ai_knowledge_sources', $2)`,
      [user.id, id]
    )
    return reply.send({ data: { success: true } })
  })

  // ── POST /ai/knowledge/sources/:id/reprocess ───────────────────────────────
  app.post('/ai/knowledge/sources/:id/reprocess', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const { rows } = await pool.query('SELECT * FROM ai_knowledge_sources WHERE id=$1', [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Source not found' })

    const source = rows[0]
    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const { rows: ragRows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    const cfg = cfgRows[0] || null
    const ragCfg = ragRows[0] || { chunk_size: 512, chunk_overlap: 64 }

    processSource(source.id, source.raw_content, cfg, ragCfg).catch(console.error)

    return reply.send({ data: { success: true, message: 'Reprocessing started' } })
  })

  // ── GET /ai/knowledge/sources/:id/chunks ───────────────────────────────────
  app.get('/ai/knowledge/sources/:id/chunks', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const { rows } = await pool.query(
      `SELECT id, chunk_index, content, content_tokens, embedding_model,
              CASE WHEN embedding IS NOT NULL THEN true ELSE false END as has_embedding
       FROM ai_knowledge_chunks WHERE source_id=$1 ORDER BY chunk_index ASC`,
      [id]
    )
    return reply.send({ data: rows })
  })

  // ── GET /ai/knowledge/qa ────────────────────────────────────────────────────
  app.get('/ai/knowledge/qa', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT q.*, u.name as created_by_name,
              CASE WHEN q.embedding IS NOT NULL THEN true ELSE false END as has_embedding
       FROM ai_knowledge_qa q
       LEFT JOIN users u ON q.created_by = u.id
       ORDER BY q.created_at DESC`
    )
    return reply.send({ data: rows })
  })

  // ── POST /ai/knowledge/qa ───────────────────────────────────────────────────
  app.post('/ai/knowledge/qa', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const user = (req as any).user
    const body = req.body as any
    const { question, answer, category, tags } = body

    if (!question?.trim() || !answer?.trim()) {
      return reply.status(400).send({ error: 'Question and answer are required' })
    }

    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const cfg = cfgRows[0] || null
    const embedding = cfg?.api_key ? await getEmbedding(`${question} ${answer}`, cfg) : null

    const { rows } = await pool.query(
      `INSERT INTO ai_knowledge_qa (question, answer, category, tags, embedding, embedding_model, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [question.trim(), answer.trim(), category || null, tags || [],
       embedding ? JSON.stringify(embedding) : null,
       embedding ? (cfg.embedding_model || 'text-embedding-3-small') : null,
       user.id]
    )

    return reply.status(201).send({ data: rows[0] })
  })

  // ── PATCH /ai/knowledge/qa/:id ──────────────────────────────────────────────
  app.patch('/ai/knowledge/qa/:id', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any

    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const cfg = cfgRows[0] || null

    let embedding = undefined
    if (body.question || body.answer) {
      const { rows: existing } = await pool.query('SELECT question, answer FROM ai_knowledge_qa WHERE id=$1', [id])
      if (existing.length > 0) {
        const q = body.question || existing[0].question
        const a = body.answer || existing[0].answer
        embedding = cfg?.api_key ? await getEmbedding(`${q} ${a}`, cfg) : null
      }
    }

    const { rows } = await pool.query(
      `UPDATE ai_knowledge_qa SET
         question=COALESCE($1,question), answer=COALESCE($2,answer),
         category=COALESCE($3,category), tags=COALESCE($4,tags),
         is_active=COALESCE($5,is_active),
         embedding=COALESCE($6,embedding),
         updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [body.question, body.answer, body.category, body.tags, body.is_active,
       embedding !== undefined ? (embedding ? JSON.stringify(embedding) : null) : undefined,
       id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Q&A pair not found' })
    return reply.send({ data: rows[0] })
  })

  // ── DELETE /ai/knowledge/qa/:id ─────────────────────────────────────────────
  app.delete('/ai/knowledge/qa/:id', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    await pool.query('DELETE FROM ai_knowledge_qa WHERE id=$1', [id])
    return reply.send({ data: { success: true } })
  })

  // ── POST /ai/rag/test ───────────────────────────────────────────────────────
  app.post('/ai/rag/test', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const body = req.body as any
    const { query } = body
    if (!query?.trim()) return reply.status(400).send({ error: 'Query is required' })

    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const { rows: ragRows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    const cfg = cfgRows[0] || null
    const ragCfg = ragRows[0] || { retrieval_strategy: 'hybrid', top_k: 5, similarity_threshold: 0.70 }

    const startTime = Date.now()
    const { chunks, qaPairs, strategy } = await retrieveContext(query, cfg, ragCfg)
    const retrievalMs = Date.now() - startTime

    // Build context string for preview
    let contextPreview = ''
    if (qaPairs.length > 0) {
      contextPreview += qaPairs.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
    }
    if (chunks.length > 0) {
      if (contextPreview) contextPreview += '\n\n---\n\n'
      contextPreview += chunks.map(c => `[${c.source_name}] ${c.content}`).join('\n\n')
    }

    // Optionally call AI with context for a test response
    let testResponse = null
    if (cfg?.enabled && cfg?.api_key && contextPreview) {
      try {
        const aiRes = await fetch(`${cfg.base_url}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: 'system', content: `${cfg.system_prompt}\n\nUse the following context to answer:\n\n${contextPreview}` },
              { role: 'user', content: query }
            ],
            temperature: parseFloat(cfg.temperature),
            max_tokens: cfg.max_tokens
          })
        })
        if (aiRes.ok) {
          const aiData = await aiRes.json() as any
          testResponse = aiData.choices?.[0]?.message?.content || null
        }
      } catch {}
    }

    return reply.send({
      data: {
        query,
        strategy,
        retrieval_ms: retrievalMs,
        chunks: chunks.map(c => ({
          id: c.id,
          source_name: c.source_name,
          category: c.category,
          classification: c.classification,
          content: c.content,
          score: Math.round(c.score * 1000) / 1000,
          method: c.method
        })),
        qa_pairs: qaPairs.map(q => ({
          id: q.id,
          question: q.question,
          answer: q.answer,
          score: Math.round(q.score * 1000) / 1000,
          method: q.method
        })),
        context_preview: contextPreview,
        test_response: testResponse,
        total_results: chunks.length + qaPairs.length
      }
    })
  })

  // ── GET /ai/rag/analytics ───────────────────────────────────────────────────
  app.get('/ai/rag/analytics', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const [
      { rows: totalQueries },
      { rows: recentQueries },
      { rows: sourceStats },
      { rows: flaggedQueries },
      { rows: dailyVolume }
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, AVG(confidence_score) as avg_confidence FROM ai_rag_queries`),
      pool.query(`SELECT q.*, u.name as user_name FROM ai_rag_queries q LEFT JOIN users u ON q.user_id=u.id ORDER BY q.created_at DESC LIMIT 20`),
      pool.query(`
        SELECT s.name, s.category, s.chunk_count, s.status, s.is_active,
               COUNT(DISTINCT rq.id) as query_hits
        FROM ai_knowledge_sources s
        LEFT JOIN ai_rag_queries rq ON rq.retrieved_chunk_ids && ARRAY(SELECT id FROM ai_knowledge_chunks WHERE source_id=s.id)
        GROUP BY s.id, s.name, s.category, s.chunk_count, s.status, s.is_active
        ORDER BY query_hits DESC
      `),
      pool.query(`SELECT * FROM ai_rag_queries WHERE flagged_for_review=true ORDER BY created_at DESC LIMIT 10`),
      pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM ai_rag_queries
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `)
    ])

    return reply.send({
      data: {
        summary: {
          total_queries: parseInt(totalQueries[0]?.total || '0'),
          avg_confidence: parseFloat(totalQueries[0]?.avg_confidence || '0'),
          flagged_count: flaggedQueries.length,
          active_sources: sourceStats.filter(s => s.is_active && s.status === 'ready').length,
          total_sources: sourceStats.length
        },
        recent_queries: recentQueries,
        source_stats: sourceStats,
        flagged_queries: flaggedQueries,
        daily_volume: dailyVolume
      }
    })
  })

  // ── POST /ai/knowledge/kb-sync ──────────────────────────────────────────────
  // Sync existing knowledge base articles into RAG
  app.post('/ai/knowledge/kb-sync', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const user = (req as any).user
    const { rows: articles } = await pool.query(
      `SELECT id, title, body, tags FROM knowledge_articles WHERE status='published'`
    )

    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const { rows: ragRows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    const cfg = cfgRows[0] || null
    const ragCfg = ragRows[0] || { chunk_size: 512, chunk_overlap: 64 }

    let synced = 0
    for (const article of articles) {
      // Check if already synced
      const { rows: existing } = await pool.query(
        `SELECT id FROM ai_knowledge_sources WHERE source_type='kb_sync' AND name=$1`,
        [article.title]
      )

      if (existing.length > 0) {
        // Update existing
        await pool.query(
          `UPDATE ai_knowledge_sources SET raw_content=$1, status='pending', updated_at=NOW() WHERE id=$2`,
          [article.body, existing[0].id]
        )
        processSource(existing[0].id, article.body, cfg, ragCfg).catch(console.error)
      } else {
        // Create new
        const { rows: newSource } = await pool.query(
          `INSERT INTO ai_knowledge_sources (name, source_type, content_type, raw_content, tags, uploaded_by, status)
           VALUES ($1,'kb_sync','text/markdown',$2,$3,$4,'pending') RETURNING id`,
          [article.title, article.body, article.tags || [], user.id]
        )
        processSource(newSource[0].id, article.body, cfg, ragCfg).catch(console.error)
      }
      synced++
    }

    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type) VALUES ($1, 'kb_sync', 'ai_knowledge_sources')`,
      [user.id]
    )

    return reply.send({ data: { synced, message: `Synced ${synced} knowledge base articles` } })
  })

  // ── POST /ai/knowledge/ticket-sync ─────────────────────────────────────────
  // Ingest closed/resolved tickets + comments as knowledge sources
  app.post('/ai/knowledge/ticket-sync', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const user = (req as any).user
    const body = req.body as any
    const limit = body.limit || 200 // max tickets to sync per run

    const { rows: tickets } = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
              c.name as category_name,
              array_agg(DISTINCT tc.body ORDER BY tc.created_at ASC) FILTER (WHERE tc.body IS NOT NULL) as comments
       FROM tickets t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN ticket_comments tc ON tc.ticket_id = t.id
       WHERE t.status IN ('resolved','closed')
       GROUP BY t.id, t.title, t.description, t.status, t.priority, t.category, c.name
       ORDER BY t.updated_at DESC
       LIMIT $1`,
      [limit]
    )

    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const { rows: ragRows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    const cfg = cfgRows[0] || null
    const ragCfg = ragRows[0] || { chunk_size: 512, chunk_overlap: 64 }

    let synced = 0
    for (const ticket of tickets) {
      const sourceName = `Ticket #${ticket.id}: ${ticket.title}`
      const comments = Array.isArray(ticket.comments) ? ticket.comments : []
      const content = [
        `Title: ${ticket.title}`,
        `Category: ${ticket.category_name || ticket.category || 'General'}`,
        `Priority: ${ticket.priority}`,
        `Status: ${ticket.status}`,
        ticket.description ? `\nDescription:\n${ticket.description}` : '',
        comments.length > 0 ? `\nResolution Thread:\n${comments.join('\n\n')}` : ''
      ].filter(Boolean).join('\n')

      if (!content.trim()) continue

      const { rows: existing } = await pool.query(
        `SELECT id FROM ai_knowledge_sources WHERE source_type='ticket_sync' AND name=$1`,
        [sourceName]
      )

      if (existing.length > 0) {
        await pool.query(
          `UPDATE ai_knowledge_sources SET raw_content=$1, status='pending', updated_at=NOW() WHERE id=$2`,
          [content, existing[0].id]
        )
        processSource(existing[0].id, content, cfg, ragCfg).catch(console.error)
      } else {
        const { rows: newSource } = await pool.query(
          `INSERT INTO ai_knowledge_sources (name, source_type, content_type, raw_content, category, tags, uploaded_by, status)
           VALUES ($1,'ticket_sync','text/plain',$2,$3,$4,$5,'pending') RETURNING id`,
          [sourceName, content, ticket.category_name || 'Support Tickets',
           ['ticket', ticket.priority, ticket.status].filter(Boolean),
           user.id]
        )
        processSource(newSource[0].id, content, cfg, ragCfg).catch(console.error)
      }
      synced++
    }

    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type) VALUES ($1, 'ticket_sync', 'ai_knowledge_sources')`,
      [user.id]
    )

    return reply.send({ data: { synced, message: `Synced ${synced} resolved tickets into knowledge base` } })
  })

  // ── PATCH /ai/rag/queries/:id/flag ─────────────────────────────────────────
  app.patch('/ai/rag/queries/:id/flag', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any
    await pool.query(
      `UPDATE ai_rag_queries SET flagged_for_review=$1 WHERE id=$2`,
      [body.flagged ?? true, id]
    )
    return reply.send({ data: { success: true } })
  })
}
