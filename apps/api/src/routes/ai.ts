import { FastifyInstance } from 'fastify'
import { pool } from '../db/pool'
import { retrieveContext } from './ai-training'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { pipeline } from 'stream/promises'

const AI_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'ai')
if (!fs.existsSync(AI_UPLOAD_DIR)) fs.mkdirSync(AI_UPLOAD_DIR, { recursive: true })

/**
 * Strip chain-of-thought reasoning, internal tags, and gibberish from AI responses.
 * Some models leak their reasoning or system instructions into the visible output.
 */
function sanitizeResponse(text: string): string {
  if (!text) return text

  // Strip <internal_reminder>...</internal_reminder> and similar XML thinking tags
  text = text.replace(/<internal_reminder>[\s\S]*?<\/internal_reminder>/gi, '')
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')

  // Strip leaked tool-call syntax in text (e.g. "to=create_ticket" appearing inline)
  text = text.replace(/\bto=\w+\b/gi, '')
  // Strip leaked tool-call reasoning (e.g. "assistant to=get_ticket to=commentary 天天彩票软件json")
  text = text.replace(/assistant\s+to=\w+(?:\s+to=\w+)*[\s\S]*?(?=\{)/gi, '')
  text = text.replace(/\b(?:assistant|user|system)\s+[to=]+\s*\w+/gi, '')

  // Strip leading "to" artifact left over from tool-call reasoning
  // e.g. "toTicket #42" → "Ticket #42", "toRTLU" → removed
  text = text.replace(/^to(?=[A-Z])/, '')
  // Aggressive: strip any line that starts with "to" + all-caps gibberish (e.g. "toRTLU")
  text = text.replace(/^to[A-Z]{2,}[^\n]*\n*/gm, '')
  // Strip orphan "to" at start of line followed by non-word then newline
  text = text.replace(/^to\s*[^a-zA-Z\n]*\n+/gm, '')
  // Strip lines that are purely non-English gibberish (non-sentence, non-JSON)
  // Matches lines of < 40 chars with >50% uppercase that don't look like English
  text = text.replace(/^(?!.*[a-z]{3})(?=[A-Z\s\d]{4,40}$).+\n*/gm, '')

  // Strip leading chain-of-thought reasoning lines
  text = text.replace(/^(?:Since the user |Let me |I should |First, I need |Looking at |The user (?:is|has|wants) |Based on the |I can see that ).*?\n+/i, '')

  // Strip leading/trailing content that contains CJK characters (hallucinated artifacts)
  text = text.replace(/^[^a-zA-Z\n]*[\u4e00-\u9fff][^\n]*\n*/gm, '')
  text = text.replace(/\n[^\n]*[\u4e00-\u9fff][^\n]*$/gm, '')

  // Collapse multiple blank lines that tag removal may leave behind
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  // Strip trailing content after the last natural sentence end if it contains CJK artifacts
  const lastSentenceEnd = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'))
  if (lastSentenceEnd > text.length * 0.5 && lastSentenceEnd < text.length - 3) {
    const trailing = text.slice(lastSentenceEnd + 1).trim()
    if (trailing.length < 50 && /[\u4e00-\u9fff]/.test(trailing)) {
      text = text.slice(0, lastSentenceEnd + 1).trimEnd()
    }
  }

  // Strip any leading gibberish that isn't the start of a real English sentence
  // A real sentence starts with: capitalized word, bullet, or common greeting
  const realStart = text.search(/(?:^|\n)(?:[A-Z][a-z]{2,}|[-•*]\s|Hi,?\b|Hello,?\b|I[' ]|You[' ]|Your|The |This |That |We |It |Let |Can |Would|Could|May |Do |Does|Is |Are |Was |Were|Has |Have|Here|There|Please|Thanks|Sorry|Okay|Sure|Great|Good|Absolutely)/m)
  if (realStart > 0) {
    text = text.slice(realStart).trim()
  }

  // If after all stripping nothing meaningful remains, return empty
  if (text.length < 2 || !/[A-Za-z]{3,}/.test(text)) return ''

  // If the text starts cleanly with ASCII English, return as-is
  if (/^[A-Za-z0-9\s'"\-.,!?;:•\-*①-⑳]/.test(text)) return text

  // Find the first capitalized English sentence and discard everything before it
  const match = text.match(/[A-Z][a-z]+[^a-zA-Z]*(?:[a-zA-Z]+[^a-zA-Z]*)*[.!?\n]|^[-•*]\s/m)
  if (match && match.index && match.index > 0) {
    return text.slice(match.index).trim()
  }
  return text
}

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
      description: 'Get details of a specific ticket by ID or number',
      parameters: {
        type: 'object',
        properties: { ticket_id: { type: 'string', description: 'The ticket UUID or number (e.g. "41" or "#41").' } },
        required: ['ticket_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_ticket',
      description: 'Create a support ticket. Only call this when you have enough detail (what is happening, what is affected). If the user is vague, ask 1-2 clarifying questions first before creating. When you have enough info, summarize and ask if they want you to create the ticket.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Use the user\'s actual words as the title. Only expand if they said something generic like "I need help" — then make a short summary from context.' },
          description: { type: 'string', description: 'Use the user\'s exact description. If they only gave one sentence, that\'s the description. You may add relevant context you already know, but never fabricate details.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'medium by default. Use high only if user says they are blocked from working. Critical only for security breaches or org-wide outages.' },
          ticket_type: { type: 'string', enum: ['incident', 'service_request', 'problem', 'change'], description: 'Infer from context. "incident" = something broken or not working (error, outage, failure). "service_request" = new access, new equipment, new permission, standard request. "problem" = investigating root cause of recurring incidents. "change" = planned modification, update, migration. Default: service_request for new access requests and "I need" requests; incident for "broken" or "not working" reports.' },
          category_name: { type: 'string', description: 'Category name. Available: Network & Connectivity, Software / Applications, Hardware Issues, Account & Access, VPN & Remote Access, Email & Communication, Printer & Peripherals, Server & Infrastructure, Security Incident, Software Installation, Data & Backup, Phone & Mobile. Use the category that best matches the issue type.' },
          tags: { type: 'string', description: 'Optional comma-separated tags like "vpn,remote-access,onboarding". Extract relevant keywords from context.' },
          attachment_ids: { type: 'array', items: { type: 'string' }, description: 'IDs of files uploaded in this chat to attach to the ticket.' },
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
  },
  {
    type: 'function',
    function: {
      name: 'search_users',
      description: 'Search for users in the system by name or email. Always call this first when someone asks you to look up a user or create a ticket for someone else.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or email to search for. Partial matches work.' },
          limit: { type: 'number', description: 'Max results (default 10)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Add a comment to one of your tickets. Use when you need to add a reply, update, or follow-up to an existing ticket.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket UUID or number (e.g. "41" or "#41").' },
          body: { type: 'string', description: 'The comment text.' },
        },
        required: ['ticket_id', 'body']
      }
    }
  }
]

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_tickets',
      description: 'Search for tickets by keyword, status, priority, or ticket number. Use this to find tickets when you have a search term. For getting details of ONE specific ticket by its ID or number, use get_ticket instead.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keyword, ticket number (e.g. "41" or "#41"), or partial text to match against title and description.' },
          status: { type: 'string', enum: ['open','in_progress','resolved','closed'] },
          priority: { type: 'string', enum: ['low','medium','high','critical'] },
          limit: { type: 'number', description: 'Max results to return (default 10)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ticket',
      description: 'Get full details of ONE specific ticket. Accepts either a UUID (ticket ID) or a number (ticket #). Use this when the user asks about a specific ticket they name or reference. For broader searches use search_tickets.',
      parameters: {
        type: 'object',
        properties: { ticket_id: { type: 'string', description: 'The ticket UUID or number (e.g. "41" or "#41" or a full UUID).' } },
        required: ['ticket_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_ticket',
      description: 'Create a new support ticket. Only call this when you have enough detail (what is happening, what is affected, who is affected). If creating for someone else, use search_users first. If the user is vague, ask 1-2 clarifying questions before creating. When you have enough info, summarize and ask if they want the ticket created.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Use the user\'s actual words as the title. Only expand if they said something generic like "I need help" — then make a short summary.' },
          description: { type: 'string', description: 'Use the user\'s exact description. If they only gave one sentence, that\'s the description. Add context you know but never fabricate.' },
          priority: { type: 'string', enum: ['low','medium','high','critical'], description: 'Infer from context. "critical" = security breach, system down company-wide, data loss, production outage. "high" = blocking work entirely for someone, no workaround. "medium" = impacting work but has workaround, or new access/service request. "low" = cosmetic, minor inconvenience, nice-to-have. Default: medium.' },
          ticket_type: { type: 'string', enum: ['incident','service_request','problem','change'], description: 'Infer from context. "incident" = something broken or not working (error, outage, failure). "service_request" = new access, new equipment, new permission, standard request. "problem" = investigating root cause of recurring incidents. "change" = planned modification, update, migration. Default: service_request for new access requests ("I need / they need"); incident for broken/not-working reports.' },
          status: { type: 'string', enum: ['open','in_progress','waiting','resolved','closed'], description: 'Ticket status. Default: open for new tickets that need triage.' },
          assigned_to_name: { type: 'string', description: 'Full name of the person to assign this ticket to. Only set if the user specifies who should handle it.' },
          reporter_name: { type: 'string', description: 'Full name of the person who needs help (the person reporting the issue). Required when creating a ticket for someone else. Always use search_users() first to confirm the name is correct.' },
          category_name: { type: 'string', description: 'Category matching the issue type. Use the Category Mapping guide in the system prompt to pick the right one. Examples: "VPN & Remote Access" for VPN requests, "Account & Access" for password/access issues, "Network & Connectivity" for network problems.' },
          due_date: { type: 'string', description: 'Due date in ISO 8601. Only set if the user specifies a deadline. Otherwise SLA auto-calculates from priority.' },
          tags: { type: 'string', description: 'Comma-separated tags. Extract relevant keywords from context. e.g. "vpn,remote-access,onboarding" or "password-reset,account-locked". Derive from the issue type and details.' },
          attachment_ids: { type: 'array', items: { type: 'string' }, description: 'IDs of files uploaded in chat to attach to the ticket.' },
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
  },
  {
    type: 'function',
    function: {
      name: 'search_users',
      description: 'Search for users in the system by name or email. Always call this first when someone asks you to look up a user or create a ticket for someone else. Use the result to fill reporter_name in create_ticket.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or email to search for. Partial matches work.' },
          role: { type: 'string', enum: ['admin', 'agent', 'user'], description: 'Filter by role (optional)' },
          limit: { type: 'number', description: 'Max results (default 10)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_ticket',
      description: 'Update an existing ticket. Use this when the user asks to change, edit, or modify a ticket\'s fields. Ask for missing details if the user is vague. Only include fields that need to change.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket UUID or number (e.g. "41" or "#41"). Required.' },
          title: { type: 'string', description: 'New title (if changing). Must be 3-500 characters.' },
          description: { type: 'string', description: 'New description (if changing). Provide detailed update notes.' },
          status: { type: 'string', enum: ['open','in_progress','waiting','resolved','closed'], description: 'New status. "resolved"/"closed" only when confirmed fixed. "in_progress" when working on it. "waiting" when waiting on user/external.' },
          priority: { type: 'string', enum: ['low','medium','high','critical'], description: 'New priority if changing.' },
          ticket_type: { type: 'string', enum: ['incident','service_request','problem','change'], description: 'New type if changing.' },
          assigned_to_name: { type: 'string', description: 'Assign or reassign to this person\'s full name. Matched to accounts automatically.' },
          category_name: { type: 'string', description: 'New category if changing.' },
          due_date: { type: 'string', description: 'New due date in ISO 8601.' },
          tags: { type: 'string', description: 'Comma-separated tags to replace existing tags.' },
          close_notes: { type: 'string', description: 'Closing/resolution notes. Required when status is "closed".' },
        },
        required: ['ticket_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Add a comment or internal note to a ticket. Use when the user asks to leave a reply, update, note, or follow-up on a ticket.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket UUID or number (e.g. "41" or "#41").' },
          body: { type: 'string', description: 'The comment text. Be detailed and helpful.' },
          is_internal: { type: 'boolean', description: 'Internal notes visible only to agents/admins. Use true for "internal note" or "note to team". Default false (visible to requester).' },
        },
        required: ['ticket_id', 'body']
      }
    }
  }
]

const MAX_SESSIONS_PER_USER = 10

// ─── Session cleanup: keep only the most recent N sessions ─────────────────
async function cleanupOldSessions(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM ai_sessions WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY updated_at DESC) as rn
        FROM ai_sessions WHERE user_id=$1
      ) sub WHERE rn > $2
    )`,
    [userId, MAX_SESSIONS_PER_USER]
  )
}

// ─── Text-based tool call fallback parser ──────────────────────────────────
// Some AI providers/models don't properly support function calling via the API.
// Instead they output TEXT that looks like a function call (e.g., "create_ticket({...})").
// This parser brute-force scans for these patterns and converts them into real tool executions.
const KNOWN_FUNCTIONS = ['search_tickets', 'get_ticket', 'create_ticket', 'get_my_tickets', 'search_knowledge', 'get_stats', 'search_users', 'update_ticket', 'add_comment']

function parseTextToolCalls(content: string): {
  toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
  cleanedText: string
} | null {
  if (!content) return null

  let workingContent = content
  const toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> = []

  // For each known function, find its position and try to extract JSON-ish args
  for (const fnName of KNOWN_FUNCTIONS) {
    let searchPos = 0
    while (true) {
      const fnIdx = workingContent.indexOf(fnName, searchPos)
      if (fnIdx === -1) break

      // From fnIdx, find the first '{' after the function name
      const braceStart = workingContent.indexOf('{', fnIdx)
      if (braceStart === -1) { searchPos = fnIdx + 1; continue }

      // Find the matching closing brace (track depth)
      let depth = 1
      let braceEnd = -1
      for (let i = braceStart + 1; i < workingContent.length; i++) {
        if (workingContent[i] === '{') depth++
        else if (workingContent[i] === '}') {
          depth--
          if (depth === 0) { braceEnd = i; break }
        }
      }
      if (braceEnd === -1) { searchPos = braceStart + 1; continue }

      // Extract the raw JSON-like text between braces
      const rawJson = workingContent.substring(braceStart, braceEnd + 1)

      // Attempt to parse — clean it up first
      let parsed: Record<string, any> | null = null

      // Try 1: direct parse
      try { parsed = JSON.parse(rawJson) } catch {}

      // Try 2: quote unquoted keys, fix single quotes, trailing commas
      if (!parsed) {
        try {
          const fixed = rawJson
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
            .replace(/'/g, '"')
            .replace(/,\s*}/g, '}')
            .replace(/,(\s*])/g, '$1')
          parsed = JSON.parse(fixed)
        } catch {}
      }

      // Try 3: simple key-value extraction as last resort
      if (!parsed) {
        try {
          const obj: Record<string, any> = {}
          const kvRegex = /["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g
          let m: RegExpExecArray | null
          while ((m = kvRegex.exec(rawJson)) !== null) obj[m[1]] = m[2]
          if (Object.keys(obj).length > 0) parsed = obj
        } catch {}
      }

      if (parsed && Object.keys(parsed).length > 0) {
        toolCalls.push({
          id: crypto.randomUUID(),
          type: 'function',
          function: {
            name: fnName,
            arguments: JSON.stringify(parsed),
          },
        })
        // Remove this entire block from the working content
        // First, find how far back to clean: include any "to=function_name" prefix
        let cleanStart = fnIdx
        const prefixMatch = workingContent.substring(0, fnIdx).match(/(?:^|\n)\s*to=\w*\s*/)
        if (prefixMatch && prefixMatch.index !== undefined) {
          cleanStart = prefixMatch.index
        } else {
          // Fallback: find last newline before the function name, or back up a bit
          const lastNL = workingContent.lastIndexOf('\n', fnIdx)
          cleanStart = lastNL >= 0 ? lastNL : Math.max(0, fnIdx - 10)
        }
        // Trim trailing garbage after closing brace until next sentence or newline
        let cleanEnd = braceEnd + 1
        const afterBlock = workingContent.substring(cleanEnd)
        const nextSentence = afterBlock.search(/(?:\n|\.\s|[A-Z][a-z]{2,}\s)/)
        if (nextSentence > 0 && nextSentence < 120) {
          cleanEnd += nextSentence
        }
        workingContent = workingContent.substring(0, cleanStart) + workingContent.substring(cleanEnd)
        workingContent = workingContent.trim()
        break // restart scan for this function from top of modified content
      }

      searchPos = braceEnd + 1
    }
  }

  return toolCalls.length > 0 ? { toolCalls, cleanedText: workingContent } : null
}

/**
 * Detect when the model text-simulates ticket creation by saying things like
 * "I've created a ticket #1012 – My computer is slow" without calling the tool.
 * Extract the fields and return them so the real create_ticket handler can execute.
 */
function extractSimulatedTicket(content: string): Record<string, any> | null {
  const text = content.replace(/<\/?internal_reminder>[\s\S]*?$/gi, '').trim()

  // Extract title — look for patterns like:
  //   "ticket #1012 – My computer is slow"
  //   "ticket for you: #42 – Install Office"
  //   "created ticket: "Some Title""
  const titleMatch = text.match(/(?:ticket|#)\s*(?:#?\d+\s*[–\-:]\s*["']?)([^"'\n]+?)(?:["']?[\.\n]|$)/i)
    || text.match(/(?:ticket|request).*?["']([^"']{3,80})["']/i)
    || text.match(/(?:created|opened|logged|filed).*?["']([^"']{3,80})["']/i)
  const title = titleMatch ? titleMatch[1].trim().replace(/^#\d+\s*[–\-:]\s*/i, '').replace(/[\.]$/, '').trim() : null
  if (!title || title.length < 2) return null

  // Extract structured fields
  const typeMatch = text.match(/(?:type|ticket.type)[\s:]*("[^"]+"|incident|service_request|problem|change)/i)
  const priorityMatch = text.match(/(?:priority)[\s:]*("[^"]+"|low|medium|high|critical)/i)
  const categoryMatch = text.match(/(?:category)[\s:]*("[^"]+"|[A-Za-z][^,\n]{2,40}?)(?:\s*[\n,]|$)/i)
  const tagsMatch = text.match(/(?:tags?)[\s:]*([^\n]{2,80}?)(?:[\n]|$)/i)

  const ticketType = typeMatch ? typeMatch[1].replace(/"/g, '').trim() : 'incident'
  const priority = priorityMatch ? priorityMatch[1].replace(/"/g, '').trim() : 'medium'
  const categoryName = categoryMatch ? categoryMatch[1].replace(/"/g, '').trim().replace(/\s*$/, '') : null
  const tags = tagsMatch ? tagsMatch[1].replace(/"/g, '').trim().replace(/\s*$/, '') : ''

  // Build description from user-like content in the chat
  const descMatch = text.match(/(?:description|details captured)[\s:]*\n?((?:.|\n)*?)(?:\n\s*(?:\n|•|Type|Priority|Category|Tags|One quick|Thanks|Is this|If you|I've also))/i)
  const description = descMatch ? descMatch[1].trim() : `User reports: "${title}"`

  return {
    title: title.substring(0, 200),
    description: description.substring(0, 4000),
    priority: priority.toLowerCase(),
    ticket_type: ticketType.toLowerCase(),
    category_name: categoryName || undefined,
    tags: tags || undefined,
  }
}

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
      portal_allowed_roles: ['user'],
      tools: { searchTickets: true, createTickets: true, getTicketDetails: true, getMyTickets: true, searchKnowledge: true, getStats: true },
      behavior: { responseLength: 'medium', includeCitations: true, includeSources: true, fallbackToWeb: false, maxCitations: 3 },
      rules: []
    } })
    const cfg = { ...rows[0] }
    return reply.send({ data: cfg })
  })

  // PUT /ai/config — admin only
  app.put('/ai/config', { preHandler: [app.authenticate, app.requireRole(['admin'])] }, async (req, reply) => {
    const body = req.body as any
    const { rows: existing } = await pool.query('SELECT id, api_key FROM ai_config LIMIT 1')
    const apiKey = body.api_key ?? ''
    if (existing.length === 0) {
      const { rows } = await pool.query(
        `INSERT INTO ai_config (provider, base_url, api_key, model, temperature, max_tokens, system_prompt, enabled, allowed_roles, max_messages_per_day, portal_enabled, portal_model, portal_temperature, portal_max_tokens, portal_system_prompt, portal_allowed_roles, tools, behavior, rules)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [body.provider||'openai', body.base_url||'https://api.openai.com/v1', apiKey, body.model||'gpt-4o-mini',
         body.temperature??0.7, body.max_tokens??1024, body.system_prompt||'You are a helpful IT support assistant.',
         body.enabled??false, body.allowed_roles||['admin','agent','user'], body.max_messages_per_day??100,
         body.portal_enabled??false, body.portal_model||'gpt-4o-mini', body.portal_temperature??0.7, body.portal_max_tokens??1024,
         body.portal_system_prompt||'You are a helpful customer support assistant. Help customers find answers to their questions and resolve common issues on their own.',
         body.portal_allowed_roles||['user'],
         body.tools || { searchTickets: true, createTickets: true, getTicketDetails: true, getMyTickets: true, searchKnowledge: true, getStats: true },
         body.behavior || { responseLength: 'medium', includeCitations: true, includeSources: true, fallbackToWeb: false, maxCitations: 3 },
         body.rules || []]
      )
      const cfg = { ...rows[0], api_key: rows[0].api_key }
      return reply.send({ data: cfg })
    } else {
      const { rows } = await pool.query(
        `UPDATE ai_config SET provider=$1, base_url=$2, api_key=$3, model=$4, temperature=$5, max_tokens=$6,
         system_prompt=$7, enabled=$8, allowed_roles=$9, max_messages_per_day=$10, 
         portal_enabled=$11, portal_model=$12, portal_temperature=$13, portal_max_tokens=$14, portal_system_prompt=$15, portal_allowed_roles=$16,
         tools=$17, behavior=$18, rules=$19,
         updated_at=NOW()
         WHERE id=$20 RETURNING *`,
        [body.provider||'openai', body.base_url||'https://api.openai.com/v1', apiKey, body.model||'gpt-4o-mini',
         body.temperature??0.7, body.max_tokens??1024, body.system_prompt||'You are a helpful IT support assistant.',
         body.enabled??false, body.allowed_roles||['admin','agent','user'], body.max_messages_per_day??100,
         body.portal_enabled??false, body.portal_model||'gpt-4o-mini', body.portal_temperature??0.7, body.portal_max_tokens??1024,
         body.portal_system_prompt||'You are a helpful customer support assistant. Help customers find answers to their questions and resolve common issues on their own.',
         body.portal_allowed_roles||['user'],
         body.tools || { searchTickets: true, createTickets: true, getTicketDetails: true, getMyTickets: true, searchKnowledge: true, getStats: true },
         body.behavior || { responseLength: 'medium', includeCitations: true, includeSources: true, fallbackToWeb: false, maxCitations: 3 },
         body.rules || [],
         existing[0].id]
      )
      const cfg = { ...rows[0], api_key: rows[0].api_key }
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

  // POST /ai/sessions — create new session (auto-cleanup to max 10)
  app.post('/ai/sessions', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { rows } = await pool.query(
      'INSERT INTO ai_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
      [user.id, 'New Chat']
    )
    cleanupOldSessions(user.id).catch(() => {}) // non-blocking
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

    // Admin tool config: map function names to config keys for filtering
    const cfgTools = cfg.tools || {}
    const toolNameToConfigKey: Record<string, string> = {
      search_tickets: 'searchTickets',
      get_ticket: 'getTicketDetails',
      create_ticket: 'createTickets',
      get_my_tickets: 'getMyTickets',
      search_knowledge: 'searchKnowledge',
      get_stats: 'getStats',
    }

    // Admin rules & behavior text (injected into system prompt later)
    let adminRulesText = ''
    if (cfg.rules && Array.isArray(cfg.rules) && cfg.rules.length > 0) {
      adminRulesText = '\n\n--- CUSTOM RULES ---\n' + cfg.rules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') + '\n---'
    }
    let behaviorText = ''
    if (cfg.behavior) {
      const b = cfg.behavior
      const parts: string[] = []
      if (b.responseLength === 'short') parts.push('Keep your responses very short and concise — one paragraph max.')
      if (b.responseLength === 'long') parts.push('Provide detailed, thorough responses with full context.')
      if (b.includeCitations === false) parts.push('Do NOT include citation numbers or references.')
      if (b.includeSources === false) parts.push('Do NOT cite or mention source documents.')
      if (b.fallbackToWeb) parts.push('You may use web search for up-to-date information when needed.')
      if (parts.length > 0) behaviorText = '\n\n--- BEHAVIOR CONFIG ---\n' + parts.join('\n') + '\n---'
    }

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
      cleanupOldSessions(user.id).catch(() => {}) // non-blocking
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

    // ── Deterministic ticket pre-fetch ──────────────────────────────────────
    // Prevent hallucination: if the user mentions ticket numbers, fetch them
    // from the DB NOW and inject as authoritative context. The AI must use
    // this data rather than fabricating ticket details.
    let preFetchedTicketContext = ''
    const ticketNumberPattern = /#(\d+)|\bticket\s*#?\s*(\d+)|(?:number|track|status|check|lookup|find|show|get|pull|view)\s+#?(\d+)/gi
    const referencedNumbers: string[] = []
    let numMatch: RegExpExecArray | null
    while ((numMatch = ticketNumberPattern.exec(message)) !== null) {
      const num = numMatch[1] || numMatch[2] || numMatch[3]
      if (num && !referencedNumbers.includes(num)) referencedNumbers.push(num)
    }
    // Also catch bare numbers — e.g., user replies "42" after being asked for a ticket number
    const bareNumberMatch = message.trim().match(/^#?\s*(\d+)\s*$/)
    if (bareNumberMatch && !referencedNumbers.includes(bareNumberMatch[1])) {
      referencedNumbers.push(bareNumberMatch[1])
    }
    if (referencedNumbers.length > 0) {
      const fetchedParts: string[] = []
      for (const num of referencedNumbers) {
        try {
          const { rows } = await pool.query(
            `SELECT t.*, u.name as requester_name
             FROM tickets t LEFT JOIN users u ON t.created_by_id=u.id
             WHERE t.number::text=$1`, [num]
          )
          if (rows.length > 0) {
            const ticket = rows[0]
            if (isPortalUser && ticket.created_by_id !== user.id) {
              fetchedParts.push(`Ticket #${ticket.number}: This ticket belongs to another user. Tell the user they can only view their own tickets.`)
            } else {
              // Format key fields the AI needs — omit internal UUIDs, full arrays
              const summary: Record<string, any> = {
                number: ticket.number,
                title: ticket.title,
                description: ticket.description?.substring(0, 500),
                status: ticket.status,
                priority: ticket.priority,
                ticket_type: ticket.ticket_type,
                category_id: ticket.category_id,
                tags: ticket.tags,
                created_at: ticket.created_at,
                updated_at: ticket.updated_at,
                resolved_at: ticket.resolved_at,
                closed_at: ticket.closed_at,
                due_date: ticket.due_date,
                assigned_to_id: ticket.assigned_to_id,
                requester_name: ticket.requester_name,
                close_notes: ticket.close_notes?.substring(0, 300),
                sla_breached: ticket.sla_breached,
              }
              fetchedParts.push(`Ticket #${ticket.number} (REAL DATA — use this, do not fabricate): ${JSON.stringify(summary)}`)
            }
          } else {
            fetchedParts.push(`Ticket #${num}: DOES NOT EXIST in the database. Tell the user this ticket was not found.`)
          }
        } catch { /* pre-fetch failure is non-fatal */ }
      }
      if (fetchedParts.length > 0) {
        preFetchedTicketContext = '\n\n--- Pre-Fetched Tickets (authoritative — do not fabricate) ---\n' + fetchedParts.join('\n') + '\n---'
      }
    }

    // Inject current user info so the AI doesn't have to ask who they are
    const userContext = `\n\n--- Current User ---\nName: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}\n---`

    const messages = [
      { role: 'system', content: activeConfig.system_prompt + userContext + preFetchedTicketContext },
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
--- CRITICAL: TICKET LOOKUP RULE (read first) ---
When a user mentions ANY ticket number (e.g. "42", "#42", "ticket 42", "ticket #42", "track 42", "status of 42"), you MUST call get_ticket({ticket_id: "42"}) as your very first action. Do NOT fabricate ticket details. Do NOT guess titles, statuses, priorities, dates, assignees, or comments. Do NOT skip the tool call and respond from memory. If you respond about a ticket without calling get_ticket first, you are giving the user FALSE information.

Pre-fetched ticket data may appear in the system prompt above. If it does, use it. If it does NOT, and the user asks about a ticket, you still MUST call get_ticket().

If get_ticket returns "Ticket not found", tell the user that ticket number does not exist. If it returns "Access denied", tell the user they can only view their own tickets.

--- AUTONOMOUS EXECUTION RULES ---
CONVERSATIONAL TONE: Be warm, friendly, and helpful — like a knowledgeable IT coworker, not a robot. Use natural language. Show empathy when users are frustrated. Avoid cold bullet lists — weave suggestions into a natural flow. Use "you" and "your" to stay personal. Keep responses concise but never terse.

You have full authority to use tools. Never ask permission for read-only actions (get_ticket, search_knowledge, get_my_tickets, search_users, search_tickets, get_stats). For write actions like creating tickets or adding comments, you may proceed when you have enough information.

Do not announce your intent to call a tool. No meta-commentary like "Let me look that up" or "I'll search for that". Just call the tool silently.

Do NOT output your reasoning, chain-of-thought, or internal monologue. Never start a response with "Since the user...", "Let me think...", "I should...", or "First, I need to...". Your final response to the user must be direct and conversational — no planning text whatsoever.

--- TICKET CREATION RULES ---
Your goal is to help users quickly and create tickets only when needed. Follow this flow:

1. ASSESS: Read the user's message. Is this a problem (something broken/not working) or a request (new access, equipment, software)?
   - If the user is vague (e.g., "I need help with my computer" or "something is wrong"): Ask 1-2 clarifying questions. Good questions: "What's happening exactly — any error messages?" or "Which software or device is affected?"
   - If they describe a specific problem but also clearly want a ticket (e.g., "I need a ticket for my crashing Outlook"): Skip to step 3.

2. TROUBLESHOOT FIRST: If the user describes a common problem, offer 1-2 quick self-help steps before creating a ticket.

   TONE: Be warm and helpful, like a friendly IT colleague. Start with empathy ("That's frustrating — let's try a couple of things first"). Give suggestions in a natural, conversational flow — not a cold bullet list. Use "you" and "your" to make it personal. Keep it brief.

   Examples of good troubleshooting responses:
   - Boot loop: "That's never fun. First thing to try — unplug any USB devices or docks, then hold the power button until it shuts off completely. Wait a few seconds, power back on, and see if it starts normally. If it's still looping, let me know where it gets stuck and I'll create a ticket for you."
   - Slow computer: "Let's try the quick fixes first — a restart often clears things up if it's been running a while. If that doesn't help, check Task Manager (Ctrl+Shift+Esc) to see if anything's eating up your CPU. Still slow? I can create a ticket and IT will dig deeper."
   - Can't connect to VPN: "VPN hiccups are pretty common. Try disconnecting and reconnecting first — sometimes that's all it takes. If it still won't connect, double-check your password hasn't expired. Want me to create a ticket if neither of those works?"
   - No internet: "Let's rule out the easy stuff — is your wifi turned on and connected to the right network? If you're on wifi, try toggling it off and back on. Still nothing? I can get a ticket going for you."
   - Password not working: "Before we create a ticket — make sure caps lock is off (it gets everyone!). If you have access to the self-service password reset portal, that's usually the fastest fix. Still stuck? I'll create a ticket right now."

   End each suggestion naturally — never a canned sign-off. Something like: "If that doesn't do it, just say the word and I'll create a ticket for you."

   Skip troubleshooting if: the user explicitly asked for a ticket, it's clearly a hardware failure, or they've already tried the obvious steps.

3. GATHER (only if a ticket is needed): Ask only what you need. One question at a time. Stop when you have:
   - What's happening (the problem)
   - What's affected (software, computer, service)
   - Rough urgency (are they blocked from working?)

4. DECIDE TO CREATE: Two paths:
   - If the user EXPLICITLY told you to create a ticket (e.g., "create a ticket for me", "make a ticket", "put in a ticket", "open a ticket"): Create it immediately. Do NOT ask "want me to go ahead?" — they already asked you to do it.
   - If the user described a problem but did NOT ask for a ticket: Summarize what you have and ask "I can create a ticket for this. Want me to go ahead?" Then create it when they say yes.

5. CREATE: When you create the ticket:
   - title: short summary of the issue in the user's own words
   - description: what the user told you, in their words, plus any context and troubleshooting already attempted
   - priority: medium unless clearly urgent (blocked from working = high, security/outage = critical)
   - ticket_type: incident for broken things, service_request for new access/equipment/software
   - category_name: best match from the category list
   - tags: 2-4 relevant keywords

6. CONFIRM CREATION: After creating, confirm the ticket number. You may ask ONE more question if a detail is still missing, but don't interrogate.

--- PRIORITY GUIDELINES ---
- "critical" = security breach, company-wide outage, data loss
- "high" = user completely blocked from working, no workaround
- "medium" = issue exists but user can still work (DEFAULT)
- "low" = cosmetic, minor inconvenience, nice-to-have

--- TICKET TYPE GUIDELINES ---
- "incident" = something is broken, not working, error, crash
- "service_request" = user needs something new (access, equipment, software, permission)
- "problem" = investigating root cause of recurring incidents
- "change" = planned modification, update, migration

--- CATEGORY NAME GUIDELINES ---
- Hardware Issues → PC, laptop, monitor, printer, peripherals, power
- Software / Applications → app crashes, software bugs
- Account & Access → password reset, account unlock, MFA
- Network & Connectivity → wifi, ethernet, internet, VPN
- Email & Communication → Outlook, email, Teams
- Security Incident → phishing, malware, unauthorized access
- Software Installation → need software installed
- Phone & Mobile → mobile device, VoIP

--- TICKET EDITING WORKFLOW ---
When someone asks you to update or change a ticket:
Step 1: Call get_ticket() to fetch the current ticket details first.
Step 2: Call update_ticket() with only the fields that need to change.
Step 3: Summarize what changed.

--- COMMENT WORKFLOW ---
When someone asks you to add a note, reply, or comment to a ticket:
Step 1: Call add_comment() with the ticket_id and body text.
Step 2: Use is_internal=true only when the user explicitly says "internal note" or "note to team".
Step 3: Confirm the comment was added.

IMPORTANT: All enum values must be LOWERCASE. priority: low|medium|high|critical. status: open|in_progress|waiting|resolved|closed. ticket_type: incident|service_request|problem|change.`

    if (messages[0] && messages[0].role === 'system') {
      // If RAG already injected, guidelines are already there — check to avoid duplication
      if (!messages[0].content.includes('AUTONOMOUS EXECUTION RULES')) {
        messages[0] = { role: 'system', content: messages[0].content + guidelines + adminRulesText + behaviorText }
      }
    }

    // Define tools based on AI type, filtered by admin config
    const isPortalAI = isPortalUser
    const allTools = isPortalAI ? PORTAL_TOOLS : AGENT_TOOLS
    const tools = allTools.filter(t => {
      const configKey = toolNameToConfigKey[t.function.name]
      return configKey ? cfgTools[configKey] !== false : true
    })

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

    // ── Fallback: Parse text-simulated tool calls ──────────────────────────
    // Some providers don't support function calling via the API. The AI instead
    // outputs text like `search_tickets({query: "41"})` as plain text. Catch
    // those here and convert them into real tool executions.
    if (!assistantMsg.tool_calls?.length) {
      const result = parseTextToolCalls(finalContent)
      if (result) {
        console.log(`[AI Fallback] Parsed ${result.toolCalls.length} text-simulated tool call(s):`, result.toolCalls.map(t => t.function.name))
        finalContent = result.cleanedText
        assistantMsg.content = result.cleanedText
        assistantMsg.tool_calls = result.toolCalls
      }

      // ── Fallback: Detect conversational ticket creation ──────────────────
      // Some models text-simulate by saying "I've created a ticket #X – Title"
      // and listing fields like Type/Priority/Category without ever calling the
      // tool. Extract the details and actually create the ticket.
      if (!assistantMsg.tool_calls?.length && /created (a |the )?ticket/i.test(finalContent)) {
        const extracted = extractSimulatedTicket(finalContent)
        if (extracted) {
          console.log(`[AI Fallback] Detected text-simulated create_ticket: "${extracted.title}"`)
          assistantMsg.tool_calls = [{
            id: crypto.randomUUID(),
            type: 'function',
            function: { name: 'create_ticket', arguments: JSON.stringify(extracted) },
          }]
        }
      }
    }

    if (assistantMsg.tool_calls?.length) {
      // Skip saving the first assistant message here — many models output
      // premature text alongside tool calls (e.g. "Your ticket has been
      // created: #2262") that contains hallucinated details. The final
      // verified response from the second AI call will be saved instead.

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
            if (args.query) {
              // If query looks like a number, search by ticket number too
              const numberMatch = args.query.match(/^#?(\d+)$/)
              if (numberMatch) {
                params.push(parseInt(numberMatch[1])); q += ` AND (number=$${params.length} OR title ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`
                params.push(`%${args.query}%`)
              } else {
                params.push(`%${args.query}%`); q += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`
              }
            }
            q += ` ORDER BY created_at DESC LIMIT ${args.limit || 10}`
            const { rows } = await pool.query(q, params)
            result = { tickets: rows, count: rows.length }
          } else if (tc.function.name === 'get_ticket') {
            // Accept both UUID and ticket number (with or without # prefix)
            const rawId = (args.ticket_id || '').replace(/^#/, '').trim()
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
            const { rows } = await pool.query(
              isUuid
                ? 'SELECT t.*, u.name as requester_name FROM tickets t LEFT JOIN users u ON t.created_by_id=u.id WHERE t.id=$1'
                : 'SELECT t.*, u.name as requester_name FROM tickets t LEFT JOIN users u ON t.created_by_id=u.id WHERE t.number::text=$1',
              [rawId]
            )
            if (user.role === 'user' && rows[0]?.created_by_id !== user.id) {
              result = { error: 'Access denied' }
            } else {
              result = rows[0] || { error: 'Ticket not found' }
            }
          } else if (tc.function.name === 'create_ticket') {
            // Normalize enum values — AI models often send wrong casing
            const normalizedPriority = (args.priority || 'medium').toString().toLowerCase()
            const normalizedStatus = (args.status || 'open').toString().toLowerCase()
            const normalizedTicketType = (args.ticket_type || 'incident').toString().toLowerCase()

            // Accept common AI parameter aliases
            const categoryName = args.category_name || args.category || ''

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
            if (categoryName) {
              // Try exact match first, then partial
              const { rows: cat } = await pool.query(
                `SELECT id FROM categories
                 WHERE name ILIKE $1
                    OR name ILIKE '%' || $1 || '%'
                    OR $1 ILIKE '%' || name || '%'
                 LIMIT 1`,
                [categoryName]
              )
              if (cat.length > 0) categoryId = cat[0].id
            }

            // Parse tags — models sometimes send arrays, sometimes comma-strings
            const tags = args.tags
              ? (Array.isArray(args.tags) ? args.tags : String(args.tags).split(',').map((t: string) => t.trim()).filter(Boolean))
              : []

            // Auto-calculate due date from SLA policy based on priority
            let ticketDueDate = args.due_date || null
            if (!isPortalAI && args.due_date) {
              ticketDueDate = args.due_date
            } else if (!ticketDueDate) {
              const { rows: sla } = await pool.query(
                'SELECT resolution_time_hours FROM sla_policies WHERE priority=$1 AND is_active=true LIMIT 1',
                [normalizedPriority]
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
                  normalizedPriority,
                  normalizedTicketType,
                  isPortalAI ? 'open' : normalizedStatus,
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
          } else if (tc.function.name === 'search_users') {
            const likePattern = `%${args.query}%`
            const params: any[] = [likePattern]
            let q = "SELECT id, name, email, role, department FROM users WHERE is_active=true AND (name ILIKE $1 OR email ILIKE $1)"
            if (args.role) { params.push(args.role); q += ` AND role=$${params.length}` }
            q += ' ORDER BY name LIMIT $' + (params.length + 1)
            params.push(args.limit || 10)
            const { rows } = await pool.query(q, params)
            result = { users: rows, count: rows.length }
          } else if (tc.function.name === 'update_ticket') {
            // Accept both UUID and ticket number
            const rawId = (args.ticket_id || '').replace(/^#/, '').trim()

            // Resolve assigned_to_name → ID if provided
            let assigneeId: string | null = null
            if (args.assigned_to_name) {
              const { rows: a } = await pool.query('SELECT id FROM users WHERE name ILIKE $1 LIMIT 1', [args.assigned_to_name])
              if (a.length > 0) assigneeId = a[0].id
            }

            // Resolve category_name → ID if provided
            let catId: string | null = null
            if (args.category_name) {
              const { rows: c } = await pool.query(
                `SELECT id FROM categories WHERE name ILIKE $1 OR name ILIKE '%' || $1 || '%' OR $1 ILIKE '%' || name || '%' LIMIT 1`,
                [args.category_name]
              )
              if (c.length > 0) catId = c[0].id
            }

            // Build dynamic UPDATE
            const updates: string[] = []
            const params: any[] = []
            let idx = 1
            if (args.title !== undefined) { updates.push(`title=$${idx++}`); params.push(args.title) }
            if (args.description !== undefined) { updates.push(`description=$${idx++}`); params.push(args.description) }
            if (args.status) { updates.push(`status=$${idx++}`); params.push(args.status.toString().toLowerCase()) }
            if (args.priority) { updates.push(`priority=$${idx++}`); params.push(args.priority.toString().toLowerCase()) }
            if (args.ticket_type) { updates.push(`ticket_type=$${idx++}`); params.push(args.ticket_type.toString().toLowerCase()) }
            if (args.tags) { updates.push(`tags=$${idx++}`); params.push(Array.isArray(args.tags) ? args.tags : String(args.tags).split(',').map((t: string) => t.trim()).filter(Boolean)) }
            if (assigneeId) { updates.push(`assigned_to_id=$${idx++}`); params.push(assigneeId) }
            if (catId) { updates.push(`category_id=$${idx++}`); params.push(catId) }
            if (args.due_date) { updates.push(`due_date=$${idx++}`); params.push(args.due_date) }
            if (args.close_notes) { updates.push(`close_notes=$${idx++}`); params.push(args.close_notes) }
            if (args.status === 'resolved') updates.push('resolved_at=NOW()')
            if (args.status === 'closed') updates.push('closed_at=NOW()')
            updates.push('updated_at=NOW()')

            // Determine if it's a UUID or number lookup
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
            const whereClause = isUuid ? 'id=$' + idx : 'number::text=$' + idx

            if (updates.length > 1) { // more than just updated_at
              const { rowCount, rows: updated } = await pool.query(
                `UPDATE tickets SET ${updates.join(', ')} WHERE ${whereClause} RETURNING *`,
                [...params, rawId]
              )
              if (rowCount === 0) {
                result = { error: 'Ticket not found' }
              } else {
                // Log activity for status changes
                if (args.status) {
                  await pool.query(
                    `INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value)
                     VALUES ($1, $2, 'status_changed', $3)`,
                    [updated[0].id, user.id, args.status]
                  ).catch(() => {})
                }
                result = { ticket: { id: updated[0].id, number: updated[0].number, status: updated[0].status, title: updated[0].title }, message: 'Ticket updated successfully' }
              }
            } else {
              result = { message: 'No changes to apply' }
            }
          } else if (tc.function.name === 'add_comment') {
            const rawTicketId = (args.ticket_id || '').replace(/^#/, '').trim()
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTicketId)

            // Find ticket
            const ticketQuery = isUuid
              ? 'SELECT id, number, title, created_by_id FROM tickets WHERE id=$1'
              : 'SELECT id, number, title, created_by_id FROM tickets WHERE number::text=$1'
            const { rows: tickets } = await pool.query(ticketQuery, [rawTicketId])
            if (tickets.length === 0) {
              result = { error: 'Ticket not found' }
            } else {
              const ticket = tickets[0]
              // Portal users can only comment on their own tickets
              if (user.role === 'user' && ticket.created_by_id !== user.id) {
                result = { error: 'Access denied' }
              } else {
                // Restrict is_internal for non-agents
                const isInternal = (user.role === 'admin' || user.role === 'agent') && args.is_internal === true
                const { rows: comment } = await pool.query(
                  `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal)
                   VALUES ($1, $2, $3, $4) RETURNING id`,
                  [ticket.id, user.id, args.body, isInternal]
                )
                // Log activity
                await pool.query(
                  'INSERT INTO ticket_activity (ticket_id, actor_id, action) VALUES ($1, $2, $3)',
                  [ticket.id, user.id, isInternal ? 'internal_note' : 'commented']
                ).catch(() => {})

                // Notify ticket creator if commenter is someone else and comment is not internal
                if (ticket.created_by_id !== user.id && !isInternal) {
                  pool.query(
                    `INSERT INTO notifications (user_id, type, title, body, ticket_id)
                     VALUES ($1, 'new_comment', $2, '', $3)`,
                    [ticket.created_by_id, `New reply on ticket #${ticket.number}: ${ticket.title}`, ticket.id]
                  ).catch(() => {})
                }

                result = { comment_id: comment[0].id, message: 'Comment added successfully' }
              }
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

    // ── Fix hallucinated ticket numbers after creation ──────────────────
    // If a create_ticket tool was called, the real ticket number is in the
    // tool result. If the AI response mentions a different number, fix it.
    const createTc = assistantMsg.tool_calls?.find((tc: any) => tc.function?.name === 'create_ticket')
    if (createTc && toolResults.length > 0) {
      // Extract real ticket number from the tool result
      for (const tr of toolResults) {
        try {
          const parsed = JSON.parse(tr.content)
          if (parsed.ticket?.number) {
            const realNumber = String(parsed.ticket.number)
            // Find any ticket number reference in the response (e.g. "#399", "ticket #399")
            const wrongNumberMatch = finalContent.match(/(?:ticket\s*)?#(\d+)/gi)
            if (wrongNumberMatch) {
              for (const match of wrongNumberMatch) {
                const num = match.match(/\d+/)?.[0]
                if (num && num !== realNumber) {
                  finalContent = finalContent.replace(
                    new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                    match.replace(/\d+/, realNumber)
                  )
                }
              }
            }
            break
          }
        } catch {}
      }
    }

    // Strip leading gibberish that some small models hallucinate
    finalContent = sanitizeResponse(finalContent)

    // ── Hallucination guard: detect fabricated ticket details ──────────────
    // Only fires when the user explicitly named a ticket number (e.g. "status of 42")
    // but the AI described ticket details without calling get_ticket or create_ticket.
    // If no ticket number was mentioned, the AI may be referencing conversation context.
    const hasTicketDetails = /\b(?:Title|Status|Priority|Category|Assigned To|Latest note)\s*:/i.test(finalContent)
      || /\b(?:ticket|#)\s*#?\d+\s+is\b/i.test(finalContent)
    const calledGetTicket = assistantMsg.tool_calls?.some((tc: any) => tc.function?.name === 'get_ticket')
    const calledCreateTicket = assistantMsg.tool_calls?.some((tc: any) => tc.function?.name === 'create_ticket')
    // Only fire if the user cited a specific ticket number AND the AI didn't actually look it up
    if (referencedNumbers.length > 0 && hasTicketDetails && !calledGetTicket && !calledCreateTicket && !preFetchedTicketContext) {
      console.warn('[AI Guard] Detected possible hallucination — AI mentioned ticket details without calling get_ticket/create_ticket. Response replaced.')
      finalContent = `I need to look up that ticket from our system. Let me check ticket #${referencedNumbers.join(', #')} for you.`
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
