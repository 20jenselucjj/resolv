import { FastifyInstance } from 'fastify'
import { pool } from '../db/pool'
import { retrieveContext } from './ai-training'

export async function aiRoutes(app: FastifyInstance) {
  // GET /ai/config — admin only
  app.get('/ai/config', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    if (rows.length === 0) return reply.send({ data: { 
      enabled: false, provider: 'openai', base_url: 'https://api.openai.com/v1', 
      model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 2048, 
      system_prompt: '', allowed_roles: ['admin', 'agent'], max_messages_per_day: 50,
      portal_enabled: false, portal_model: 'gpt-4o-mini', portal_temperature: 0.7, portal_max_tokens: 1024,
      portal_system_prompt: 'You are a helpful customer support assistant. Help customers find answers to their questions and resolve common issues on their own.',
      portal_allowed_roles: ['user']
    } })
    const cfg = { ...rows[0] }
    cfg.api_key = cfg.api_key ? '***' : ''
    return reply.send({ data: cfg })
  })

  // PUT /ai/config — admin only
  app.put('/ai/config', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const body = req.body as any
    const { rows: existing } = await pool.query('SELECT id, api_key FROM ai_config LIMIT 1')
    const apiKey = body.api_key === '***' ? (existing[0]?.api_key ?? '') : (body.api_key ?? '')
    if (existing.length === 0) {
      const { rows } = await pool.query(
        `INSERT INTO ai_config (provider, base_url, api_key, model, temperature, max_tokens, system_prompt, enabled, allowed_roles, max_messages_per_day, portal_enabled, portal_model, portal_temperature, portal_max_tokens, portal_system_prompt, portal_allowed_roles)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [body.provider||'openai', body.base_url||'https://api.openai.com/v1', apiKey, body.model||'gpt-4o-mini',
         body.temperature??0.7, body.max_tokens??1024, body.system_prompt||'You are a helpful IT support assistant.',
         body.enabled??false, body.allowed_roles||['admin','agent','user'], body.max_messages_per_day??100,
         body.portal_enabled??false, body.portal_model||'gpt-4o-mini', body.portal_temperature??0.7, body.portal_max_tokens??1024,
         body.portal_system_prompt||'You are a helpful customer support assistant. Help customers find answers to their questions and resolve common issues on their own.',
         body.portal_allowed_roles||['user']]
      )
      const cfg = { ...rows[0], api_key: rows[0].api_key ? '***' : '' }
      return reply.send({ data: cfg })
    } else {
      const { rows } = await pool.query(
        `UPDATE ai_config SET provider=$1, base_url=$2, api_key=$3, model=$4, temperature=$5, max_tokens=$6,
         system_prompt=$7, enabled=$8, allowed_roles=$9, max_messages_per_day=$10, 
         portal_enabled=$11, portal_model=$12, portal_temperature=$13, portal_max_tokens=$14, portal_system_prompt=$15, portal_allowed_roles=$16,
         updated_at=NOW()
         WHERE id=$17 RETURNING *`,
        [body.provider||'openai', body.base_url||'https://api.openai.com/v1', apiKey, body.model||'gpt-4o-mini',
         body.temperature??0.7, body.max_tokens??1024, body.system_prompt||'You are a helpful IT support assistant.',
         body.enabled??false, body.allowed_roles||['admin','agent','user'], body.max_messages_per_day??100,
         body.portal_enabled??false, body.portal_model||'gpt-4o-mini', body.portal_temperature??0.7, body.portal_max_tokens??1024,
         body.portal_system_prompt||'You are a helpful customer support assistant. Help customers find answers to their questions and resolve common issues on their own.',
         body.portal_allowed_roles||['user'], existing[0].id]
      )
      const cfg = { ...rows[0], api_key: rows[0].api_key ? '***' : '' }
      return reply.send({ data: cfg })
    }
  })

  // GET /ai/sessions — list user's sessions
  app.get('/ai/sessions', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { rows } = await pool.query(
      'SELECT * FROM ai_sessions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50',
      [user.id]
    )
    return reply.send({ data: rows })
  })

  // POST /ai/sessions — create new session
  app.post('/ai/sessions', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { rows } = await pool.query(
      'INSERT INTO ai_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
      [user.id, 'New Chat']
    )
    return reply.send({ data: rows[0] })
  })

  // DELETE /ai/sessions/:id
  app.delete('/ai/sessions/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    await pool.query('DELETE FROM ai_sessions WHERE id=$1 AND user_id=$2', [id, user.id])
    return reply.send({ data: { success: true } })
  })

  // GET /ai/sessions/:id/messages
  app.get('/ai/sessions/:id/messages', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const { rows: session } = await pool.query('SELECT * FROM ai_sessions WHERE id=$1 AND user_id=$2', [id, user.id])
    if (session.length === 0) return reply.status(404).send({ error: 'Session not found' })
    const { rows } = await pool.query('SELECT * FROM ai_messages WHERE session_id=$1 ORDER BY created_at ASC', [id])
    return reply.send({ data: rows })
  })

  // POST /ai/chat — main chat endpoint
  app.post('/ai/chat', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const body = req.body as any
    const { session_id, message } = body

    if (!message?.trim()) return reply.status(400).send({ error: 'Message is required' })

    // Load AI config
    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    if (cfgRows.length === 0) {
      return reply.status(503).send({ error: 'AI assistant is not configured or disabled.' })
    }
    const cfg = cfgRows[0]

    // Determine which AI config to use based on user role
    // Self-service portal AI is for 'user' role customers
    const isPortalUser = user.role === 'user' && cfg.portal_enabled
    const activeConfig = isPortalUser ? {
      model: cfg.portal_model || cfg.model,
      temperature: cfg.portal_temperature ?? cfg.temperature,
      max_tokens: cfg.portal_max_tokens ?? cfg.max_tokens,
      system_prompt: cfg.portal_system_prompt || cfg.system_prompt,
      allowed_roles: cfg.portal_allowed_roles || ['user'],
    } : {
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: cfg.max_tokens,
      system_prompt: cfg.system_prompt,
      allowed_roles: cfg.allowed_roles || ['admin', 'agent'],
    }

    // Check role access
    if (!activeConfig.allowed_roles.includes(user.role)) {
      return reply.status(403).send({ error: 'You do not have access to the AI assistant.' })
    }

    // Validate/get session
    let sessionId = session_id
    if (!sessionId) {
      const { rows } = await pool.query(
        'INSERT INTO ai_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
        [user.id, message.substring(0, 80)]
      )
      sessionId = rows[0].id
    } else {
      const { rows } = await pool.query('SELECT * FROM ai_sessions WHERE id=$1 AND user_id=$2', [sessionId, user.id])
      if (rows.length === 0) return reply.status(404).send({ error: 'Session not found' })
    }

    // Save user message
    await pool.query(
      'INSERT INTO ai_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message]
    )

    // Load conversation history
    const { rows: history } = await pool.query(
      'SELECT role, content, tool_calls, tool_call_id FROM ai_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [sessionId]
    )

    const messages = [
      { role: 'system', content: activeConfig.system_prompt },
      ...history.map((m: any) => {
        const msg: any = { role: m.role, content: m.content }
        if (m.tool_calls) msg.tool_calls = m.tool_calls
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
        return msg
      })
    ]

    // ── RAG: Retrieve relevant context ──────────────────────────────────────
    let ragContext = ''
    let ragChunkIds: string[] = []
    let ragQaIds: string[] = []
    let ragStrategy = 'none'
    let ragConfidence = 0

    try {
      const { rows: ragCfgRows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
      const ragCfg = ragCfgRows[0]

      if (ragCfg?.enabled && ragCfg?.inject_context) {
        const { chunks, qaPairs, strategy } = await retrieveContext(message, cfg, ragCfg)
        ragStrategy = strategy
        ragChunkIds = chunks.map(c => c.id)
        ragQaIds = qaPairs.map(q => q.id)

        if (qaPairs.length > 0 || chunks.length > 0) {
          const parts: string[] = []

          if (qaPairs.length > 0) {
            parts.push('**Relevant Q&A from Knowledge Base:**\n' +
              qaPairs.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n'))
          }

          if (chunks.length > 0) {
            parts.push('**Relevant Documents:**\n' +
              chunks.map(c => c.content).join('\n\n'))
          }

          ragContext = parts.join('\n\n')
          ragConfidence = Math.max(
            ...chunks.map(c => c.score || 0),
            ...qaPairs.map(q => q.score || 0)
          )

          // Inject context into system message
          messages[0] = {
            role: 'system',
            content: `${activeConfig.system_prompt}\n\n---\nUse the following knowledge base context to answer accurately.\n\n${ragContext}\n---`
          }
        }
      }
    } catch (ragErr) {
      // RAG failure is non-fatal — continue without context
      console.error('RAG retrieval error:', ragErr)
    }

    // Define tools based on AI type
    // Portal AI (self-service) has limited tools - read-only access
    // Admin/Agent AI has full tool access
    const isPortalAI = isPortalUser
    const tools = isPortalAI ? [
      // Self-service portal tools - read-only, customer-focused
      {
        type: 'function',
        function: {
          name: 'get_my_tickets',
          description: 'Get your submitted tickets',
          parameters: {
            type: 'object',
            properties: { status: { type: 'string', enum: ['open','in_progress','resolved','closed','all'] } }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_ticket',
          description: 'Get details of your ticket by ID',
          parameters: {
            type: 'object',
            properties: { ticket_id: { type: 'string' } },
            required: ['ticket_id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_knowledge',
          description: 'Search the knowledge base for helpful articles',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query']
          }
        }
      }
    ] : [
      // Admin/Agent AI tools - full access
      {
        type: 'function',
        function: {
          name: 'search_tickets',
          description: 'Search tickets by keyword, status, or priority',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              status: { type: 'string', enum: ['open','in_progress','resolved','closed'] },
              priority: { type: 'string', enum: ['low','medium','high','critical'] },
              limit: { type: 'number' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_ticket',
          description: 'Get details of a specific ticket by ID',
          parameters: {
            type: 'object',
            properties: { ticket_id: { type: 'string' } },
            required: ['ticket_id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_ticket',
          description: 'Create a new support ticket',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: ['low','medium','high','critical'] }
            },
            required: ['title', 'description']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_my_tickets',
          description: 'Get tickets submitted by the current user',
          parameters: {
            type: 'object',
            properties: { status: { type: 'string', enum: ['open','in_progress','resolved','closed','all'] } }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_knowledge',
          description: 'Search the knowledge base for articles',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_stats',
          description: 'Get ticket statistics (admin/agent only)',
          parameters: { type: 'object', properties: {} }
        }
      }
    ]

    // Call AI API with appropriate settings
    const apiBase = (cfg.base_url || '').replace(/\/+$/, '')
    const aiResponse = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.api_key}`
      },
      body: JSON.stringify({
        model: activeConfig.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: parseFloat(String(activeConfig.temperature)),
        max_tokens: activeConfig.max_tokens
      })
    })

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text().catch(() => '')
      const detail = errBody || `AI provider returned ${aiResponse.status} ${aiResponse.statusText}`
      return reply.status(502).send({ error: `AI API error: ${detail}` })
    }

    const aiData = await aiResponse.json() as any
    const choice = aiData.choices?.[0]
    if (!choice) return reply.status(502).send({ error: 'No response from AI' })

    const assistantMsg = choice.message
    let finalContent = assistantMsg.content || ''
    const toolResults: any[] = []

    if (assistantMsg.tool_calls?.length) {
      await pool.query(
        'INSERT INTO ai_messages (session_id, role, content, tool_calls) VALUES ($1, $2, $3, $4)',
        [sessionId, 'assistant', assistantMsg.content || '', JSON.stringify(assistantMsg.tool_calls)]
      )

      for (const tc of assistantMsg.tool_calls) {
        const args = JSON.parse(tc.function.arguments || '{}')
        let result: any = {}

        try {
          if (tc.function.name === 'search_tickets') {
            let q = 'SELECT id, title, status, priority, created_at FROM tickets WHERE 1=1'
            const params: any[] = []
            if (user.role === 'user') { params.push(user.id); q += ` AND created_by_id=$${params.length}` }
            if (args.status) { params.push(args.status); q += ` AND status=$${params.length}` }
            if (args.priority) { params.push(args.priority); q += ` AND priority=$${params.length}` }
            if (args.query) { params.push(`%${args.query}%`); q += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})` }
            q += ` ORDER BY created_at DESC LIMIT ${args.limit || 10}`
            const { rows } = await pool.query(q, params)
            result = { tickets: rows, count: rows.length }
          } else if (tc.function.name === 'get_ticket') {
            const { rows } = await pool.query(
              'SELECT t.*, u.name as requester_name FROM tickets t LEFT JOIN users u ON t.created_by_id=u.id WHERE t.id=$1',
              [args.ticket_id]
            )
            if (user.role === 'user' && rows[0]?.created_by_id !== user.id) {
              result = { error: 'Access denied' }
            } else {
              result = rows[0] || { error: 'Ticket not found' }
            }
          } else if (tc.function.name === 'create_ticket') {
            const { rows } = await pool.query(
              `INSERT INTO tickets (title, description, priority, status, created_by_id)
               VALUES ($1, $2, $3, 'open', $4) RETURNING *`,
              [args.title, args.description, args.priority || 'medium', user.id]
            )
            result = { ticket: rows[0], message: `Ticket created with ID ${rows[0].id}` }
          } else if (tc.function.name === 'get_my_tickets') {
            let q = 'SELECT id, title, status, priority, created_at FROM tickets WHERE created_by_id=$1'
            const params: any[] = [user.id]
            if (args.status && args.status !== 'all') { params.push(args.status); q += ` AND status=$${params.length}` }
            q += ' ORDER BY created_at DESC LIMIT 20'
            const { rows } = await pool.query(q, params)
            result = { tickets: rows, count: rows.length }
          } else if (tc.function.name === 'search_knowledge') {
            // Search both knowledge_articles AND AI training sources (RAG chunks)
            const query = args.query || ''
            const likePattern = `%${query}%`
            const terms = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean)
            const likeConds = terms.map((_: string, i: number) => `c.content ILIKE $${i + 1}`).join(' AND ')

            const { rows: articles } = await pool.query(
              `SELECT id, title, LEFT(body, 300) AS excerpt FROM knowledge_articles WHERE status='published' AND (title ILIKE $1 OR body ILIKE $1) LIMIT 5`,
              [likePattern]
            )
            // Also search AI training chunks (RAG knowledge base)
            let ragChunks: any[] = []
            if (terms.length > 0 && likeConds) {
              const { rows } = await pool.query(
                `SELECT c.content, s.name as source_name, s.category
                 FROM ai_knowledge_chunks c
                 JOIN ai_knowledge_sources s ON c.source_id = s.id
                 WHERE s.is_active = true AND s.status = 'ready' AND ${likeConds}
                 LIMIT 5`,
                 terms.map((t: string) => `%${t}%`)
              )
              ragChunks = rows
            }
            // Format results as readable text so the AI doesn't regurgitate raw JSON
            const textParts: string[] = []
            if (articles.length > 0) {
              textParts.push('Knowledge Base Articles:\n' + articles.map((a: any) => `- ${a.title}: ${a.excerpt}`).join('\n'))
            }
            if (ragChunks.length > 0) {
              textParts.push('RAG Knowledge Sources:\n' + ragChunks.map((r: any) => `[${r.source_name}${r.category ? ` / ${r.category}` : ''}]\n${r.content}`).join('\n\n---\n\n'))
            }
            result = textParts.length > 0
              ? { summary: textParts.join('\n\n'), count: articles.length + ragChunks.length }
              : { summary: 'No matching knowledge found.', count: 0 }
          } else if (tc.function.name === 'get_stats') {
            if (user.role === 'user') {
              result = { error: 'Access denied' }
            } else {
              const { rows } = await pool.query(`
                SELECT
                  COUNT(*) FILTER (WHERE status='open') as open_count,
                  COUNT(*) FILTER (WHERE status='in_progress') as in_progress_count,
                  COUNT(*) FILTER (WHERE status='resolved') as resolved_count,
                  COUNT(*) FILTER (WHERE status='closed') as closed_count,
                  COUNT(*) FILTER (WHERE priority='critical' AND status NOT IN ('resolved','closed')) as critical_open
                FROM tickets
              `)
              result = rows[0]
            }
          }
        } catch (e: any) {
          result = { error: e.message }
        }

        const toolResultStr = JSON.stringify(result)
        toolResults.push({ tool_call_id: tc.id, content: toolResultStr })
        await pool.query(
          'INSERT INTO ai_messages (session_id, role, content, tool_call_id) VALUES ($1, $2, $3, $4)',
          [sessionId, 'tool', toolResultStr, tc.id]
        )
      }

      // Second AI call with tool results
      const messages2 = [
        messages[0], // preserves RAG context (if any) injected earlier
        ...history.map((m: any) => {
          const msg: any = { role: m.role, content: m.content }
          if (m.tool_calls) msg.tool_calls = m.tool_calls
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
          return msg
        }),
        { role: 'assistant', content: assistantMsg.content || '', tool_calls: assistantMsg.tool_calls },
        ...toolResults.map(tr => ({ role: 'tool', content: tr.content, tool_call_id: tr.tool_call_id }))
      ]

      const aiResponse2 = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
        body: JSON.stringify({ model: activeConfig.model, messages: messages2, temperature: parseFloat(String(activeConfig.temperature)), max_tokens: activeConfig.max_tokens })
      })

      if (aiResponse2.ok) {
        const aiData2 = await aiResponse2.json() as any
        finalContent = aiData2.choices?.[0]?.message?.content || finalContent
      }
    }

    // Save final assistant message
    await pool.query(
      'INSERT INTO ai_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'assistant', finalContent]
    )

    // Log RAG query for analytics
    if (ragStrategy !== 'none') {
      pool.query(
        `INSERT INTO ai_rag_queries (session_id, user_id, query, retrieved_chunk_ids, retrieved_qa_ids, retrieval_strategy_used, confidence_score, response_had_context)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [sessionId, user.id, message,
         ragChunkIds.length > 0 ? ragChunkIds : null,
         ragQaIds.length > 0 ? ragQaIds : null,
         ragStrategy, ragConfidence || null,
         ragContext.length > 0]
      ).catch(console.error)
    }

    // Update session title/timestamp
    const { rows: msgCount } = await pool.query('SELECT COUNT(*) FROM ai_messages WHERE session_id=$1', [sessionId])
    if (parseInt(msgCount[0].count) <= 3) {
      await pool.query('UPDATE ai_sessions SET title=$1, updated_at=NOW() WHERE id=$2', [message.substring(0, 80), sessionId])
    } else {
      await pool.query('UPDATE ai_sessions SET updated_at=NOW() WHERE id=$1', [sessionId])
    }

    return reply.send({
      data: {
        session_id: sessionId,
        content: finalContent,
        tool_calls: assistantMsg.tool_calls || [],
        rag: ragContext ? {
          strategy: ragStrategy,
          sources_used: ragChunkIds.length + ragQaIds.length,
          confidence: ragConfidence
        } : null
      }
    })
  })
}
