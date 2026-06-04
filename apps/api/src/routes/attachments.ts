import { FastifyInstance } from 'fastify'
import { pool } from '../db/pool'
import path from 'path'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/x-rar-compressed',
  'application/json', 'application/xml',
  'video/mp4', 'video/webm',
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (matches multipart config)

export async function attachmentRoutes(app: FastifyInstance) {
  // POST /tickets/:ticketId/attachments — upload file
  app.post('/tickets/:ticketId/attachments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { ticketId } = req.params as any

    // Verify ticket access
    const { rows: ticket } = await pool.query('SELECT * FROM tickets WHERE id=$1', [ticketId])
    if (ticket.length === 0) return reply.status(404).send({ error: 'Ticket not found' })
    if (user.role === 'user' && ticket[0].created_by_id !== user.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const data = await (req as any).file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const ext = path.extname(data.filename)
    const filename = `${crypto.randomUUID()}${ext}`
    const storagePath = path.join(UPLOAD_DIR, filename)

    await pipeline(data.file, fs.createWriteStream(storagePath))
    const stat = fs.statSync(storagePath)

    if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
      return reply.status(415).send({ error: `File type '${data.mimetype}' is not allowed` });
    }
    if (stat.size > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'File exceeds maximum size of 25MB' });
    }

    const { rows } = await pool.query(
      `INSERT INTO ticket_attachments (ticket_id, uploaded_by, filename, original_name, mime_type, size_bytes, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [ticketId, user.id, filename, data.filename, data.mimetype, stat.size, storagePath]
    )
    return reply.send({ data: rows[0] })
  })

  // GET /tickets/:ticketId/attachments — list attachments
  app.get('/tickets/:ticketId/attachments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { ticketId } = req.params as any

    const { rows: ticket } = await pool.query('SELECT * FROM tickets WHERE id=$1', [ticketId])
    if (ticket.length === 0) return reply.status(404).send({ error: 'Ticket not found' })
    if (user.role === 'user' && ticket[0].created_by_id !== user.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const { rows } = await pool.query(
      `SELECT a.*, u.name as uploader_name FROM ticket_attachments a
       LEFT JOIN users u ON a.uploaded_by=u.id
       WHERE a.ticket_id=$1 ORDER BY a.created_at DESC`,
      [ticketId]
    )
    return reply.send({ data: rows })
  })

  // GET /attachments/:id/download — download file
  app.get('/attachments/:id/download', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any

    const { rows } = await pool.query(
      'SELECT a.*, t.created_by_id as requester_id FROM ticket_attachments a JOIN tickets t ON a.ticket_id=t.id WHERE a.id=$1',
      [id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Attachment not found' })
    const att = rows[0]
    if (user.role === 'user' && att.requester_id !== user.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (!fs.existsSync(att.storage_path)) return reply.status(404).send({ error: 'File not found on disk' })

    reply.header('Content-Disposition', `attachment; filename="${att.original_name}"`)
    reply.header('Content-Type', att.mime_type)
    return reply.send(fs.createReadStream(att.storage_path))
  })

  // GET /attachments/:id/view — view file inline (browser-renderable formats)
  app.get('/attachments/:id/view', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any

    const { rows } = await pool.query(
      'SELECT a.*, t.created_by_id as requester_id FROM ticket_attachments a JOIN tickets t ON a.ticket_id=t.id WHERE a.id=$1',
      [id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Attachment not found' })
    const att = rows[0]
    if (user.role === 'user' && att.requester_id !== user.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (!fs.existsSync(att.storage_path)) return reply.status(404).send({ error: 'File not found on disk' })

    reply.header('Content-Disposition', `inline; filename="${att.original_name}"`)
    reply.header('Content-Type', att.mime_type)
    reply.header('Cache-Control', 'private, max-age=3600')
    return reply.send(fs.createReadStream(att.storage_path))
  })

  // DELETE /attachments/:id
  app.delete('/attachments/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any

    const { rows } = await pool.query(
      'SELECT a.*, t.created_by_id as requester_id FROM ticket_attachments a JOIN tickets t ON a.ticket_id=t.id WHERE a.id=$1',
      [id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Attachment not found' })
    const att = rows[0]
    if (user.role === 'user' && att.requester_id !== user.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }
    if (user.role === 'user' && att.uploaded_by !== user.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (fs.existsSync(att.storage_path)) fs.unlinkSync(att.storage_path)
    await pool.query('DELETE FROM ticket_attachments WHERE id=$1', [id])
    return reply.send({ data: { success: true } })
  })
}
