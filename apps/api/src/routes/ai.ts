import { FastifyInstance } from 'fastify'
import { pool } from '../db/pool'
import { retrieveContext } from './ai-training'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { pipeline } from 'stream/promises'

const AI_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'ai')
if (!fs.existsSync(AI_UPLOAD_DIR)) fs.mkdirSync(AI_UPLOAD_DIR, { recursive: true })

const PORTAL_TOOLS = [
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
      name: 'create_ticket',
      description: 'Create a support ticket. Ask follow-up questions if the issue description is vague. Create a concise title that describes the issue — do NOT put the user name in the title. You will automatically be set as the requester.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short, issue-focused title describing WHAT the problem is (not who needs it). Max 10 words. Example: "VPN connection failing after update" not "Alfonso needs VPN access".' },
          description: { type: 'string', description: 'Detailed description including what, when, and any troubleshooting already tried. Ask follow-up questions if the user gives too little detail.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'How urgent is this issue. Default medium.' },
          ticket_type: { type: 'string', enum: ['incident', 'service_request', 'problem', 'change'], description: 'Type of request. Default incident.' },
          category_name: { type: 'string', description: 'Must match an existing category name exactly. Available categories: IT Support, Network, Hardware, Software, Security, HR, Facilities. Example: "Network" for internet issues, "IT Support" for password resets.' },
          tags: { type: 'string', description: 'Comma-separated tags (optional)' },
          attachment_ids: { type: 'array', items: { type: 'string' }, description: 'IDs of files uploaded in this chat to attach to the ticket. Include any relevant uploaded files.' },
        },
        required: ['title', 'description']
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
]

const AGENT_TOOLS = [
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
      description: 'Create a new support ticket. Ask follow-up questions if details are vague. Create a concise title — do NOT put user names in the title. Names are matched to accounts automatically.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short issue-focused title describing WHAT the problem is (not who). Max 10 words. Example: "VPN connection failing after update" not "Alfonso needs VPN".' },
          description: { type: 'string', description: 'Full description. Ask follow-up questions if the user gives too little detail. Include: what happened, when, steps to reproduce, troubleshooting attempted.' },
          priority: { type: 'string', enum: ['low','medium','high','critical'], description: 'Issue priority level. Default medium.' },
          ticket_type: { type: 'string', enum: ['incident','service_request','problem','change'], description: 'Type of ticket. Default incident.' },
          status: { type: 'string', enum: ['open','in_progress','waiting','resolved','closed'], description: 'Ticket status (default: open)' },
          assigned_to_name: { type: 'string', description: 'Full name of the person to assign to (e.g. "Lucas"). Matched to user accounts by name.' },
          reporter_name: { type: 'string', description: 'Full name of the person reporting. Defaults to you if not set. (e.g. "Alfonso Bianca")' },
          category_name: { type: 'string', description: 'Must match an existing category name exactly. Available: IT Support, Network, Hardware, Software, Security, HR, Facilities. Example: "Network" for VPN issues, "IT Support" for password resets.' },
          due_date: { type: 'string', description: 'Due date in ISO 8601 (e.g. "2026-06-01"). If not set, automatically calculated from SLA policy.' },
          tags: { type: 'string', description: 'Comma-separated tags (optional)' },
          attachment_ids: { type: 'array', items: { type: 'string' }, description: 'IDs of files uploaded in chat to attach to the ticket. Include any relevant uploaded files.' },
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

export async function aiRoutes(app: FastifyInstance) {
  // Auto-create ai_chat_files table if it doesn't exist yet
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_chat_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      uploaded_by UUID NOT NULL REFERENCES users(id),
      filename VARCHAR(500) NOT NULL,
      original_name VARCHAR(500) NOT NULL,
      mime_type VARCHAR(200) NOT NULL,
      size_bytes BIGINT NOT NULL,
      storage_path TEXT NOT NULL,
      ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => { /* table may already exist */ })

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

  // POST /ai/upload — upload a file for AI chat context (can be attached to a ticket later)
  app.post('/ai/upload', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const data = await (req as any).file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = path.extname(data.filename)
    const uniqueName = `${crypto.randomUUID()}${ext}`
    const storagePath = path.join(AI_UPLOAD_DIR, uniqueName)

    await pipeline(data.file, fs.createWriteStream(storagePath))
    const stat = fs.statSync(storagePath)

    const { rows } = await pool.query(
      `INSERT INTO ai_chat_files (uploaded_by, filename, original_name, mime_type, size_bytes, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user.id, uniqueName, data.filename, data.mimetype, stat.size, storagePath]
    )

    return reply.send({ data: {
      id: rows[0].id,
      filename: rows[0].original_name,
      size: rows[0].size_bytes,
      mime_type: rows[0].mime_type,
    }})
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
            content: `${activeConfig.system_prompt}

--- Knowledge Base Context ---
${ragContext}
---`
          }
        }
      }
    } catch (ragErr) {
      // RAG failure is non-fatal — continue without context
      console.error('RAG retrieval error:', ragErr)
    }

    // Inject ticket creation behavior guidelines into system prompt
    // (appends to whatever the current system message is, whether or not RAG injected)
    const guidelines = `
--- Ticket Creation Guidelines ---
When creating tickets:
1. Ask follow-up questions if the issue description is vague or missing key details.
2. Write concise issue-focused titles — NEVER put user names in the title.
   ✅ Good: "VPN connection failing after update"
   ❌ Bad:  "Alfonso needs help with VPN"
3. Match user names to accounts automatically (the system handles name resolution).
4. Set appropriate priority based on the issue severity described.`

    if (messages[0] && messages[0].role === 'system') {
      // If RAG already injected, guidelines are already there — check to avoid duplication
      if (!messages[0].content.includes('Ticket Creation Guidelines')) {
        messages[0] = { role: 'system', content: messages[0].content + guidelines }
      }
    }

    // Define tools based on AI type
    const isPortalAI = isPortalUser
    const tools = isPortalAI ? PORTAL_TOOLS : AGENT_TOOLS

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
            // Resolve assignee name → ID (portal users cannot set assignee)
            let assignedToId = null
            if (args.assigned_to_name && !isPortalAI) {
              const { rows: assignee } = await pool.query(
                'SELECT id FROM users WHERE name ILIKE $1 LIMIT 1',
                [args.assigned_to_name]
              )
              if (assignee.length > 0) assignedToId = assignee[0].id
            }

            // Resolve reporter name → ID (defaults to current user)
            let createdById = user.id
            if (args.reporter_name && !isPortalAI) {
              const { rows: reporter } = await pool.query(
                'SELECT id FROM users WHERE name ILIKE $1 LIMIT 1',
                [args.reporter_name]
              )
              if (reporter.length > 0) createdById = reporter[0].id
            }

            // Resolve category name → ID (flexible matching)
            let categoryId = null
            if (args.category_name) {
              // Try exact match first, then partial
              const { rows: cat } = await pool.query(
                `SELECT id FROM categories
                 WHERE name ILIKE $1
                    OR name ILIKE '%' || $1 || '%'
                    OR $1 ILIKE '%' || name || '%'
                 LIMIT 1`,
                [args.category_name]
              )
              if (cat.length > 0) categoryId = cat[0].id
            }

            // Parse tags
            const tags = args.tags
              ? args.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
              : []

            // Auto-calculate due date from SLA policy based on priority
            let ticketDueDate = args.due_date || null
            if (!isPortalAI && args.due_date) {
              ticketDueDate = args.due_date
            } else if (!ticketDueDate) {
              const { rows: sla } = await pool.query(
                'SELECT resolution_time_hours FROM sla_policies WHERE priority=$1 AND is_active=true LIMIT 1',
                [args.priority || 'medium']
              )
              if (sla.length > 0) {
                ticketDueDate = new Date(Date.now() + sla[0].resolution_time_hours * 60 * 60 * 1000).toISOString()
              }
            }

            // Full ticket creation in a transaction
            const client = await pool.connect()
            try {
              await client.query('BEGIN')

              const insertRes = await client.query(
                `INSERT INTO tickets (title, description, priority, ticket_type, status, tags, created_by_id, assigned_to_id, category_id, due_date, requested_by_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING *`,
                [
                  args.title, args.description,
                  args.priority || 'medium',
                  args.ticket_type || 'incident',
                  isPortalAI ? 'open' : (args.status || 'open'),
                  tags,
                  createdById,
                  assignedToId,
                  categoryId,
                  ticketDueDate,
                  createdById,
                ]
              )

              const ticket = insertRes.rows[0]

              // Log activity
              await client.query(
                'INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value) VALUES ($1, $2, $3, $4)',
                [ticket.id, user.id, 'created', ticket.status]
              )

              // Create notification for assignee
              if (ticket.assigned_to_id) {
                await client.query(
                  `INSERT INTO notifications (user_id, type, title, body, ticket_id)
                   VALUES ($1, $2, $3, $4, $5)`,
                  [ticket.assigned_to_id, 'ticket_assigned',
                   `You have been assigned ticket #${ticket.number}: ${ticket.title}`, '', ticket.id]
                )
              }

              // Link any AI-uploaded files to the ticket
              if (args.attachment_ids && Array.isArray(args.attachment_ids)) {
                for (const fileId of args.attachment_ids) {
                  const { rows: chatFiles } = await client.query(
                    'SELECT * FROM ai_chat_files WHERE id=$1 AND ticket_id IS NULL',
                    [fileId]
                  )
                  if (chatFiles.length > 0) {
                    const cf = chatFiles[0]
                    await client.query(
                      `INSERT INTO ticket_attachments (ticket_id, uploaded_by, filename, original_name, mime_type, size_bytes, storage_path)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                      [ticket.id, cf.uploaded_by, cf.filename, cf.original_name, cf.mime_type, cf.size_bytes, cf.storage_path]
                    )
                    await client.query('UPDATE ai_chat_files SET ticket_id=$1 WHERE id=$2', [ticket.id, fileId])
                  }
                }
              }

              await client.query('COMMIT')

              // Emit socket events (non-critical)
              try {
                ;(app as any).io.emit('ticket:created', { ticket })
                if (ticket.assigned_to_id) {
                  ;(app as any).io.to(`user:${ticket.assigned_to_id}`).emit('notification:new', { ticketId: ticket.id })
                }
              } catch (_e) { /* socket emission is non-critical */ }

              result = {
                ticket: {
                  id: ticket.id,
                  number: ticket.number,
                  title: ticket.title,
                  status: ticket.status,
                  priority: ticket.priority,
                },
                message: `Ticket #${ticket.number} created successfully`,
              }
            } catch (e: any) {
              await client.query('ROLLBACK').catch(() => {})
              throw e
            } finally {
              client.release()
            }
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
