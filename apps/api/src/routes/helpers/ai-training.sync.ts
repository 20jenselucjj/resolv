import { pool } from '../../db/pool'
import { processSource } from './ai-training.utils'

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

    const { rows: cfgRows } = await pool.query('SELECT * FROM ai_config LIMIT 1')
    const { rows: ragRows } = await pool.query('SELECT * FROM ai_rag_config LIMIT 1')
    const cfg = cfgRows[0] || null
    const ragCfg = ragRows[0] || { chunk_size: 512, chunk_overlap: 64 }

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