import { FastifyInstance } from 'fastify'
import { pool } from '../db/pool'
import path from 'path'
import { PDFParse } from 'pdf-parse'
import * as XLSX from 'xlsx'
import { cosineSimilarity, recursiveChunkText, getEmbedding, processSource, normalizeScores } from './ai-training/helpers'

interface AiConfig {
  api_key?: string;
  base_url?: string;
  model?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  embedding_model?: string;
  enabled?: boolean;
}

interface RagConfig {
  retrieval_strategy?: string;
  top_k?: number;
  similarity_threshold?: number | string;
  semantic_weight?: number | string;
  chunk_size?: number;
  chunk_overlap?: number;
  enabled?: boolean;
  inject_context?: boolean;
}

const DEFAULT_RAG_CONFIG: RagConfig = { chunk_size: 512, chunk_overlap: 64 };

async function loadAiConfig(): Promise<{ cfg: AiConfig | null; ragCfg: RagConfig }> {
  const [{ rows: cfgRows }, { rows: ragRows }] = await Promise.all([
    pool.query('SELECT * FROM ai_config LIMIT 1'),
    pool.query('SELECT * FROM ai_rag_config LIMIT 1'),
  ]);
  return { cfg: cfgRows[0] || null, ragCfg: ragRows[0] || DEFAULT_RAG_CONFIG };
}

// ─── RAG Retrieval (exported for use in ai.ts) ───────────────────────────────
export async function retrieveContext(
  query: string,
  cfg: AiConfig | null,
  ragCfg: RagConfig,
  persona?: 'agent' | 'portal'
): Promise<{ chunks: any[]; qaPairs: any[]; strategy: string }> {
  const strategy = ragCfg.retrieval_strategy || 'hybrid'
  const topK = ragCfg.top_k || 5
  const threshold = parseFloat(ragCfg.similarity_threshold as any) || 0.70
  const semanticWeight = parseFloat(ragCfg.semantic_weight as any) || 0.6 // weight for semantic vs keyword in hybrid

  let chunks: any[] = []
  let qaPairs: any[] = []

  // ── Keyword search (always fast, always available) ──
  if (strategy === 'keyword' || strategy === 'hybrid') {
    const safeQuery = query.replace(/[^\w\s]/g, ' ').trim()
    const terms = safeQuery.split(/\s+/).filter(Boolean)
    const tsQuery = terms.join(' & ')

    if (tsQuery) {
      const scopeCond = persona ? `AND s.scope IN ('both', $3)` : ''
      const { rows: kwChunks } = await pool.query(
        `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                s.name as source_name, s.category, s.classification,
                ts_rank(c.search_vector, to_tsquery('english', $1)) as rank
         FROM ai_knowledge_chunks c
         JOIN ai_knowledge_sources s ON c.source_id = s.id
         WHERE s.is_active = true AND s.status = 'ready'
           AND c.search_vector @@ to_tsquery('english', $1)
           ${scopeCond}
         ORDER BY rank DESC
         LIMIT $2`,
        persona ? [tsQuery, topK * 3, persona] : [tsQuery, topK * 3]
      )
      chunks.push(...kwChunks.map(r => ({ ...r, score: parseFloat(r.rank), method: 'keyword' })))

      const qaScopeCond = persona ? `AND scope IN ('both', $3)` : ''
      const { rows: kwQA } = await pool.query(
        `SELECT id, question, answer, category, tags,
                ts_rank(search_vector, to_tsquery('english', $1)) as rank
         FROM ai_knowledge_qa
         WHERE is_active = true AND search_vector @@ to_tsquery('english', $1)
           ${qaScopeCond}
         ORDER BY rank DESC
         LIMIT $2`,
        persona ? [tsQuery, Math.ceil(topK / 2), persona] : [tsQuery, Math.ceil(topK / 2)]
      )
      qaPairs.push(...kwQA.map(r => ({ ...r, score: parseFloat(r.rank), method: 'keyword' })))
    }

    // Fallback: if keyword search returned nothing and we have terms,
    // try simple ILIKE matching (catches cases where stop words removed everything)
    if (chunks.length === 0 && terms.length > 0) {
      const likeConditions = terms.map((_, i) => `c.content ILIKE $${i + 2}`).join(' AND ')
      const likeParams = terms.map(t => `%${t}%`)
      const likeScopeCond = persona ? `AND s.scope IN ('both', $${terms.length + 2})` : ''
      const { rows: likeChunks } = await pool.query(
        `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                s.name as source_name, s.category, s.classification, 0 as rank
         FROM ai_knowledge_chunks c
         JOIN ai_knowledge_sources s ON c.source_id = s.id
         WHERE s.is_active = true AND s.status = 'ready'
           AND ${likeConditions}
           ${likeScopeCond}
         LIMIT $1`,
        persona ? [topK, ...likeParams, persona] : [topK, ...likeParams]
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
        const semScopeCond = persona ? `AND s.scope IN ('both', $2)` : ''
        const { rows } = await pool.query(
          `SELECT c.id, c.content, c.source_id, c.chunk_index, c.embedding,
                  s.name as source_name, s.category, s.classification
           FROM ai_knowledge_chunks c
           JOIN ai_knowledge_sources s ON c.source_id = s.id
           WHERE s.is_active = true AND s.status = 'ready' AND c.embedding IS NOT NULL
             ${semScopeCond}
           ORDER BY c.id
           LIMIT $1`,
          persona ? [topK * 4, persona] : [topK * 4]
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
        const qaSemScopeCond = persona ? `AND scope IN ('both', $2)` : ''
        const { rows } = await pool.query(
          `SELECT id, question, answer, category, tags, embedding
           FROM ai_knowledge_qa WHERE is_active = true AND embedding IS NOT NULL ${qaSemScopeCond} LIMIT $1`,
          persona ? [Math.ceil(topK), persona] : [Math.ceil(topK)]
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

// ─── Exported helper: sync a single closed/resolved ticket into knowledge base ─
// Used by the tickets PATCH handler so AI can learn from closed tickets.
export async function syncTicketToKnowledgeBase(ticketId: string, userId: string) {
  try {
    const { rows: tickets } = await pool.query(
      `SELECT t.id, t.title, t.description, t.close_notes, t.status, t.priority,
              c.name as category_name,
              (SELECT array_agg(body ORDER BY created_at ASC) FROM ticket_comments WHERE ticket_id = t.id AND body IS NOT NULL) as comments
       FROM tickets t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = $1
       GROUP BY t.id, t.title, t.description, t.close_notes, t.status, t.priority, c.name`,
      [ticketId]
    )
    if (tickets.length === 0) return

    const ticket = tickets[0]
    const comments = Array.isArray(ticket.comments) ? ticket.comments : []
    const content = [
      `Title: ${ticket.title}`,
      `Category: ${ticket.category_name || ticket.category || 'General'}`,
      `Priority: ${ticket.priority}`,
      `Status: ${ticket.status}`,
      ticket.description ? `\nDescription:\n${ticket.description}` : '',
      ticket.close_notes ? `\nClosing Notes:\n${ticket.close_notes}` : '',
      comments.length > 0 ? `\nResolution Thread:\n${comments.join('\n\n')}` : ''
    ].filter(Boolean).join('\n')

    if (!content.trim()) return

    const sourceName = `Ticket #${ticket.id}: ${ticket.title}`
    const { rows: existing } = await pool.query(
      `SELECT id FROM ai_knowledge_sources WHERE source_type='ticket_sync' AND name=$1`,
      [sourceName]
    )

    const { cfg, ragCfg } = await loadAiConfig()

    if (existing.length > 0) {
      await pool.query(
        `UPDATE ai_knowledge_sources SET raw_content=$1, status='pending', updated_at=NOW() WHERE id=$2`,
        [content, existing[0].id]
      )
      processSource(existing[0].id, content, cfg, ragCfg).catch(console.error)
    } else {
      const { rows: newSource } = await pool.query(
        `INSERT INTO ai_knowledge_sources (name, source_type, content_type, raw_content, category, tags, uploaded_by, status, is_active)
         VALUES ($1,'ticket_sync','text/plain',$2,$3,$4,$5,'pending',false) RETURNING id`,
        [sourceName, content, ticket.category_name || 'Support Tickets',
         ['ticket', ticket.priority, ticket.status].filter(Boolean),
         userId]
      )
      processSource(newSource[0].id, content, cfg, ragCfg).catch(console.error)
    }
  } catch (err) {
    console.error(`[syncTicketToKnowledgeBase] Error syncing ticket ${ticketId}:`, err)
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
export async function aiTrainingRoutes(app: FastifyInstance) {

  // ── GET /ai/rag/config ──────────────────────────────────────────────────────
  app.get('/ai/rag/config', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO ai_rag_config (enabled, retrieval_strategy, top_k, similarity_threshold, chunk_size, chunk_overlap, reranking_enabled, citation_mode, inject_context, semantic_weight)
         VALUES (true, 'hybrid', 5, 0.70, 512, 64, false, 'inline', true, 0.6)`
      )
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
        `INSERT INTO ai_rag_config (enabled, retrieval_strategy, top_k, similarity_threshold, chunk_size, chunk_overlap, reranking_enabled, citation_mode, inject_context, semantic_weight)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [body.enabled ?? true, body.retrieval_strategy ?? 'hybrid', body.top_k ?? 5,
         body.similarity_threshold ?? 0.70, body.chunk_size ?? 512, body.chunk_overlap ?? 64,
         body.reranking_enabled ?? false, body.citation_mode ?? 'inline', body.inject_context ?? true,
         body.semantic_weight ?? 0.6]
      )
      return reply.send({ data: rows[0] })
    }

    const { rows } = await pool.query(
      `UPDATE ai_rag_config SET enabled=$1, retrieval_strategy=$2, top_k=$3, similarity_threshold=$4,
       chunk_size=$5, chunk_overlap=$6, reranking_enabled=$7, citation_mode=$8, inject_context=$9, semantic_weight=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [body.enabled ?? true, body.retrieval_strategy ?? 'hybrid', body.top_k ?? 5,
       body.similarity_threshold ?? 0.70, body.chunk_size ?? 512, body.chunk_overlap ?? 64,
       body.reranking_enabled ?? false, body.citation_mode ?? 'inline', body.inject_context ?? true,
       body.semantic_weight ?? 0.6,
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
    const { name, source_type, raw_content, url, tags, category, classification, content_type, original_filename, scope } = body

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
      `INSERT INTO ai_knowledge_sources (name, source_type, content_type, original_filename, url, raw_content, tags, category, classification, scope, uploaded_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING *`,
      [name.trim(), source_type || 'manual', content_type || 'text/plain', original_filename || null,
       url || null, finalContent, tags || [], category || null, classification || 'unclassified',
       scope || 'both', user.id]
    )

    const source = rows[0]

    // Load configs for processing
    const { cfg, ragCfg } = await loadAiConfig()

    // Process asynchronously (don't await — return immediately)
    processSource(source.id, finalContent, cfg, ragCfg).catch(console.error)

    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'create_knowledge_source', 'ai_knowledge_sources', $2, $3)`,
      [user.id, source.id, JSON.stringify({ name, source_type })]
    )

    return reply.status(201).send({ data: source })
  })

  // ── POST /ai/knowledge/sources/upload ───────────────────────────────────────
  // Upload a file (PDF, Excel, CSV, text, markdown) and extract text content
  app.post('/ai/knowledge/sources/upload', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const user = (req as any).user

    const data = await (req as any).file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    // Read file stream into buffer
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      data.file.on('data', (chunk: Buffer) => chunks.push(chunk))
      data.file.on('end', () => resolve(Buffer.concat(chunks)))
      data.file.on('error', reject)
    })

    const ext = path.extname(data.filename).toLowerCase()
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (buffer.length > maxSize) return reply.status(400).send({ error: 'File too large (max 25MB)' })

    // Extract text based on file type
    let extractedText = ''
    let contentType = data.mimetype || 'application/octet-stream'

    try {
      if (ext === '.pdf') {
        const pdf = new PDFParse({ data: buffer, verbosity: 0 })
        await (pdf as any).load()
        const result = await (pdf as any).getText()
        extractedText = (typeof result === 'string' ? result : (result?.text || result?.content || '')) || ''
        contentType = 'application/pdf'
      } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        extractedText = workbook.SheetNames
          .map(name => `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`)
          .join('\n\n')
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      } else if (ext === '.csv') {
        extractedText = buffer.toString('utf-8')
        contentType = 'text/csv'
      } else if (ext === '.txt' || ext === '.md' || ext === '.text') {
        extractedText = buffer.toString('utf-8')
        contentType = 'text/plain'
      } else if (ext === '.json') {
        const raw = buffer.toString('utf-8')
        // Try to pretty-print JSON for better chunking
        try { extractedText = JSON.stringify(JSON.parse(raw), null, 2) }
        catch { extractedText = raw }
        contentType = 'application/json'
      } else if (ext === '.html' || ext === '.htm') {
        const html = buffer.toString('utf-8')
        extractedText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        contentType = 'text/html'
      } else {
        return reply.status(400).send({
          error: `Unsupported file type: ${ext}. Supported: .pdf, .xlsx, .xls, .csv, .txt, .md, .json, .html`
        })
      }
    } catch (e: any) {
      return reply.status(400).send({ error: `Failed to parse file: ${e.message}` })
    }

    if (!extractedText.trim()) {
      return reply.status(400).send({ error: 'Could not extract any text content from the file' })
    }

    // Get metadata fields from multipart (or derive from filename)
    const fields = data.fields || {}
    const name = fields.name?.value || data.filename.replace(ext, '')
    const category = fields.category?.value || null
    const tags = fields.tags?.value ? fields.tags.value.split(',').map((t: string) => t.trim()).filter(Boolean) : []
    const classification = fields.classification?.value || 'unclassified'
    const scope = fields.scope?.value || 'both'

    const { rows } = await pool.query(
      `INSERT INTO ai_knowledge_sources (name, source_type, content_type, original_filename, raw_content, category, tags, classification, scope, uploaded_by, status)
       VALUES ($1,'file',$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING *`,
      [name.trim(), contentType, data.filename, extractedText, category, tags, classification, scope, user.id]
    )

    const source = rows[0]

    // Load configs for processing
    const { cfg, ragCfg } = await loadAiConfig()

    // Process asynchronously
    processSource(source.id, extractedText, cfg, ragCfg).catch(console.error)

    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'create_knowledge_source', 'ai_knowledge_sources', $2, $3)`,
      [user.id, source.id, JSON.stringify({ name, source_type: 'file', original_filename: data.filename })]
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
       raw_content=COALESCE($5,raw_content),
       scope=COALESCE($6,scope),
       is_active=COALESCE($7,is_active), updated_at=NOW() WHERE id=$8 RETURNING *`,
      [body.name, body.tags, body.category, body.classification, body.raw_content, body.scope, body.is_active, id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Source not found' })

    const updated = rows[0]

    // If raw_content changed, reprocess the source
    if (body.raw_content !== undefined) {
      const { cfg, ragCfg } = await loadAiConfig()
      processSource(id, body.raw_content, cfg, ragCfg).catch(console.error)
    }

    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'update_knowledge_source', 'ai_knowledge_sources', $2, $3)`,
      [(req as any).user.id, id, JSON.stringify({ name: updated.name, is_active: updated.is_active, category: updated.category })]
    )

    return reply.send({ data: updated })
  })

  // ── DELETE /ai/knowledge/sources/:id ───────────────────────────────────────
  app.delete('/ai/knowledge/sources/:id', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const { rows } = await pool.query('SELECT name FROM ai_knowledge_sources WHERE id=$1', [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Source not found' })
    await pool.query('DELETE FROM ai_knowledge_sources WHERE id=$1', [id])
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'delete_knowledge_source', 'ai_knowledge_sources', $2, $3)`,
      [user.id, id, JSON.stringify({ name: rows[0].name })]
    )
    return reply.send({ data: { success: true } })
  })

  // ── POST /ai/knowledge/sources/:id/reprocess ───────────────────────────────
  app.post('/ai/knowledge/sources/:id/reprocess', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const { rows } = await pool.query('SELECT * FROM ai_knowledge_sources WHERE id=$1', [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Source not found' })

    const source = rows[0]
    const { cfg, ragCfg } = await loadAiConfig()

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
    const { question, answer, category, tags, scope } = body

    if (!question?.trim() || !answer?.trim()) {
      return reply.status(400).send({ error: 'Question and answer are required' })
    }

    const { cfg } = await loadAiConfig()
    const embedding = cfg?.api_key ? await getEmbedding(`${question} ${answer}`, cfg) : null

    const { rows } = await pool.query(
      `INSERT INTO ai_knowledge_qa (question, answer, category, tags, embedding, embedding_model, created_by, scope)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [question.trim(), answer.trim(), category || null, tags || [],
       embedding ? JSON.stringify(embedding) : null,
       embedding ? (cfg?.embedding_model || 'text-embedding-3-small') : null,
       user.id, scope || 'both']
    )

    return reply.status(201).send({ data: rows[0] })
  })

  // ── PATCH /ai/knowledge/qa/:id ──────────────────────────────────────────────
  app.patch('/ai/knowledge/qa/:id', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any

    const { cfg } = await loadAiConfig()

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
         scope=COALESCE($7,scope),
         updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [body.question, body.answer, body.category, body.tags, body.is_active,
       embedding !== undefined ? (embedding ? JSON.stringify(embedding) : null) : undefined,
       body.scope,
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

    const { cfg, ragCfg } = await loadAiConfig()

    const startTime = Date.now()
    let chunks: any[] = []
    let qaPairs: any[] = []
    let strategy = 'error'
    try {
      const result = await retrieveContext(query, cfg, ragCfg)
      chunks = result.chunks
      qaPairs = result.qaPairs
      strategy = result.strategy
    } catch (e: any) {
      console.error('[Test] RAG retrieval error:', e)
      return reply.send({
        data: {
          query, strategy: 'error',
          retrieval_ms: Date.now() - startTime,
          error: e.message || 'RAG retrieval failed',
          chunks: [], qa_pairs: [],
          context_preview: '', test_response: null,
          total_results: 0
        }
      })
    }
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
        const aiRes = await fetch(`${(cfg.base_url || '').replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: 'system', content: `${cfg.system_prompt}\n\nUse the following context to answer:\n\n${contextPreview}` },
              { role: 'user', content: query }
            ],
            temperature: parseFloat(cfg.temperature as any),
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
        error: null,
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

    const { cfg, ragCfg } = await loadAiConfig()

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
      `SELECT t.id, t.title, t.description, t.close_notes, t.status, t.priority,
              c.name as category_name,
              (SELECT array_agg(body ORDER BY created_at ASC) FROM ticket_comments WHERE ticket_id = t.id AND body IS NOT NULL) as comments
       FROM tickets t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.status IN ('resolved','closed')
       GROUP BY t.id, t.title, t.description, t.close_notes, t.status, t.priority, c.name
       ORDER BY t.updated_at DESC
       LIMIT $1`,
      [limit]
    )

    const { cfg, ragCfg } = await loadAiConfig()

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
        ticket.close_notes ? `\nClosing Notes:\n${ticket.close_notes}` : '',
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
          `INSERT INTO ai_knowledge_sources (name, source_type, content_type, raw_content, category, tags, uploaded_by, status, is_active)
           VALUES ($1,'ticket_sync','text/plain',$2,$3,$4,$5,'pending',false) RETURNING id`,
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
