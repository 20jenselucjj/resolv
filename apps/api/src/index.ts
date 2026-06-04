import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Server } from 'socket.io';
import multipart from '@fastify/multipart'
import helmet from '@fastify/helmet';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import userRoutes from './routes/users';
import categoryRoutes from './routes/categories';
import slaRoutes from './routes/sla';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';
import knowledgeRoutes from './routes/knowledge';
import { aiRoutes } from './routes/ai'
import { aiTrainingRoutes } from './routes/ai-training'
import { attachmentRoutes } from './routes/attachments'
import templateRoutes from './routes/templates'
import oauthRoutes from './routes/oauth';
import directorySyncRoutes from './routes/directory-sync';
import assetRoutes from './routes/assets';
import inboundEmailRoutes from './routes/inbound-email';
import autoReplyRoutes from './routes/auto-reply';
import notificationConfigRoutes from './routes/notification-config';
import watcherRoutes from './routes/watchers';
import satisfactionRoutes from './routes/satisfaction';
import { startInboundListener } from './services/inbound-email';
import { startScheduledNotifications } from './services/scheduled-notifications';
import { pool } from './db/pool';
import { JwtPayload } from './plugins/auth';

const fastify = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
  },
  bodyLimit: 10 * 1024 * 1024, // 10MB body size limit
});

// Socket.io presence tracking
const ticketPresence: Record<string, Set<string>> = {};

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

async function start() {
  const configuredWebUrl = process.env.WEB_URL;
  const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowedOrigins = Array.from(new Set([configuredWebUrl, ...defaultOrigins].filter(Boolean) as string[]));
  const isDev = process.env.NODE_ENV !== 'production';
  const isAllowedOrigin = (origin?: string) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.[0-9]{1,3}\.[0-9]{1,3})(:\d+)?$/i.test(origin)) return true;
    return false;
  };

  // Register plugins
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin || 'unknown'}`), false);
    },
    credentials: true,
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
  }
  await fastify.register(jwt, {
    secret: jwtSecret,
  });

  await fastify.register(authPlugin);

  await fastify.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } }) // 25MB limit

  // Socket.io setup — attaches to the shared HTTP server
  const io = new Server(fastify.server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`Socket CORS blocked origin: ${origin || 'unknown'}`), false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  fastify.decorate('io', io);

  io.use((socket, next) => {
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (!authToken) return next(new Error('Unauthorized'));
    try {
      const payload = fastify.jwt.verify<JwtPayload>(authToken);
      socket.data.user = payload;
    } catch {
      return next(new Error('Unauthorized'));
    }
    return next();
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    const err = error as Error & { code?: string; statusCode?: number };
    fastify.log.error(err);
    if (err.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: err.message });
    }
    if (err.code === '23505') {
      return reply.status(409).send({ error: 'Already exists' });
    }
    // In non-production, include the actual error message for debugging
    const isProd = process.env.NODE_ENV === 'production';
    return reply.status(500).send({
      error: 'Internal server error',
      ...(isProd ? {} : { message: err.message, code: err.code }),
    });
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api' });
  await fastify.register(ticketRoutes, { prefix: '/api' });
  await fastify.register(userRoutes, { prefix: '/api' });
  await fastify.register(categoryRoutes, { prefix: '/api' });
  await fastify.register(slaRoutes, { prefix: '/api' });
  await fastify.register(adminRoutes, { prefix: '/api' });
  await fastify.register(notificationRoutes, { prefix: '/api' });
  await fastify.register(knowledgeRoutes, { prefix: '/api' });
  await fastify.register(aiRoutes, { prefix: '/api' })
  await fastify.register(aiTrainingRoutes, { prefix: '/api' })
  await fastify.register(attachmentRoutes, { prefix: '/api' })
  await fastify.register(templateRoutes, { prefix: '/api' })
  await fastify.register(oauthRoutes, { prefix: '/api' });
  await fastify.register(directorySyncRoutes, { prefix: '/api' });
  await fastify.register(assetRoutes, { prefix: '/api' });
  await fastify.register(inboundEmailRoutes, { prefix: '/api' });
  await fastify.register(autoReplyRoutes, { prefix: '/api' });
  await fastify.register(notificationConfigRoutes, { prefix: '/api' });
  await fastify.register(watcherRoutes, { prefix: '/api' });
  await fastify.register(satisfactionRoutes, { prefix: '/api' });

  // Health check (under /api prefix so the frontend api helper can reach it)
  fastify.get('/api/health', async (request, reply) => {
    let dbHealthy = false;
    let emailHealthy = false;
    try {
      await pool.query('SELECT 1');
      dbHealthy = true;
    } catch { /* db down */ }

    // Check if email is configured (OAuth tokens or Directory Sync tokens)
    try {
      const result = await pool.query(
        "SELECT value FROM system_settings WHERE key IN ('smtp_oauth_tokens', 'directory_sync_tokens') LIMIT 1"
      );
      if (result.rows.length > 0) {
        const tokens = JSON.parse(result.rows[0].value);
        // Check if we have valid tokens with an access_token
        emailHealthy = !!(tokens.access_token && tokens.refresh_token);
      }
    } catch { /* ignore */ }

    return reply.send({ data: { api: true, db: dbHealthy, email: emailHealthy } });
  });

  const port = parseInt(process.env.PORT || '3001');
  const host = process.env.HOST || '127.0.0.1';

  // ─── Socket.IO event relay ────────────────────────────────────────────────
  io.on('connection', (socket) => {
    // Agent joins its asset room so the server can route events to it
    socket.on('agent:join', (data: { assetId: string; agentToken: string }) => {
      socket.data.assetId = data.assetId;
      socket.join(`asset:${data.assetId}`);
      socket.emit('agent:online', { assetId: data.assetId });
      io.to(`asset:${data.assetId}`).emit('asset:online', { assetId: data.assetId });
      fastify.log.info(`[API] agent joined asset room: ${data.assetId} socketId: ${socket.id}`);
    });

    // Web client requests a checkin from the agent
    socket.on('agent:request-checkin', (data: { assetId: string }) => {
      io.to(`asset:${data.assetId}`).emit('agent:request-checkin', data);
    });

    // Agent checkin broadcast
    socket.on('agent:checkin', (data: any) => {
      if (socket.data.assetId) {
        io.to(`asset:${socket.data.assetId}`).emit('agent:checkin', data);
      }
    });

    socket.on('disconnect', async () => {
      if (socket.data.assetId) {
        io.to(`asset:${socket.data.assetId}`).emit('asset:offline', { assetId: socket.data.assetId });
        // Sync DB to offline when agent WebSocket disconnects
        try {
          await pool.query(`UPDATE assets SET agent_status='offline' WHERE id=$1 AND agent_status='online'`, [socket.data.assetId]);
        } catch { /* non-critical */ }
      }
    });

    // Ticket presence
    socket.on('ticket:join', (data: { ticketId: string }) => {
      socket.join(`ticket:${data.ticketId}`);
      if (!ticketPresence[data.ticketId]) ticketPresence[data.ticketId] = new Set();
      const user = socket.data.user as JwtPayload | undefined;
      if (user) ticketPresence[data.ticketId].add(user.id);
      io.to(`ticket:${data.ticketId}`).emit('ticket:presence', { ticketId: data.ticketId, count: ticketPresence[data.ticketId].size });
    });

    socket.on('ticket:leave', (data: { ticketId: string }) => {
      socket.leave(`ticket:${data.ticketId}`);
      const user = socket.data.user as JwtPayload | undefined;
      if (user && ticketPresence[data.ticketId]) {
        ticketPresence[data.ticketId].delete(user.id);
        io.to(`ticket:${data.ticketId}`).emit('ticket:presence', { ticketId: data.ticketId, count: ticketPresence[data.ticketId].size });
      }
    });

    socket.on('ticket:typing', (data: { ticketId: string; userId: string; userName: string }) => {
      socket.to(`ticket:${data.ticketId}`).emit('ticket:typing', data);
    });

    // Per-user notification room
    socket.on('user:join', (data: { userId: string }) => {
      socket.join(`user:${data.userId}`);
    });


  });
  // ─── End Socket.IO relay ──────────────────────────────────────────────────

  await fastify.listen({ port, host });

  // Start email inbound listener (Gmail API via OAuth shared with directory sync)
  startInboundListener().catch(err => {
    fastify.log.error('[index] Failed to start inbound email listener:', err.message);
  });

  // Start scheduled notification runner (due date reminders, SLA warnings, escalations, surveys)
  startScheduledNotifications().catch(err => {
    fastify.log.error('[index] Failed to start scheduled notifications:', err.message);
  });

  fastify.log.info(`Resolv API running on http://${host}:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
