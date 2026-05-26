import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { Server } from 'socket.io';
import multipart from '@fastify/multipart'
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
import { pool } from './db/pool';
import { JwtPayload } from './plugins/auth';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

// Socket.io presence tracking
const ticketPresence: Record<string, Set<string>> = {};
const remoteViewers: Record<string, Set<string>> = {};
const remoteSessionAssets: Record<string, string> = {};

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

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  await fastify.register(jwt, {
    secret: jwtSecret || 'resolv-dev-secret-change-in-production',
  });

  await fastify.register(authPlugin);

  await fastify.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } }) // 25MB limit

  // Socket.io setup — must be decorated BEFORE routes are registered
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
    if (!authToken) return next();
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
    fastify.log.error(error);
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: error.message });
    }
    if (error.code === '23505') {
      return reply.status(409).send({ error: 'Already exists' });
    }
    // In non-production, include the actual error message for debugging
    const isProd = process.env.NODE_ENV === 'production';
    return reply.status(500).send({
      error: 'Internal server error',
      ...(isProd ? {} : { message: error.message, code: error.code }),
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

  // Health check (under /api prefix so the frontend api helper can reach it)
  fastify.get('/api/health', async (request, reply) => {
    let dbHealthy = false;
    try {
      await pool.query('SELECT 1');
      dbHealthy = true;
    } catch { /* db down */ }
    return reply.send({ data: { api: true, db: dbHealthy, queue: true } });
  });

  const port = parseInt(process.env.PORT || '3001');
  const host = process.env.HOST || '0.0.0.0';

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);

    socket.on('ticket:join', (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
      if (!ticketPresence[ticketId]) ticketPresence[ticketId] = new Set();
      ticketPresence[ticketId].add(socket.data.userId || socket.id);
      io.to(`ticket:${ticketId}`).emit('ticket:presence', {
        ticketId,
        users: Array.from(ticketPresence[ticketId]),
      });
    });

    socket.on('user:join', (userId: string) => {
      socket.join(`user:${userId}`);
      socket.data.userId = userId;
    });

    socket.on('ticket:leave', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
      ticketPresence[ticketId]?.delete(socket.data.userId || socket.id);
      io.to(`ticket:${ticketId}`).emit('ticket:presence', {
        ticketId,
        users: Array.from(ticketPresence[ticketId] || []),
      });
    });

    socket.on('ticket:typing', ({ ticketId, user }: { ticketId: string; user: any }) => {
      socket.to(`ticket:${ticketId}`).emit('ticket:typing', { user });
    });

    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
      for (const [ticketId, users] of Object.entries(ticketPresence)) {
        users.delete(socket.id);
      }
      for (const [sessionId, viewers] of Object.entries(remoteViewers)) {
        if (!viewers.has(socket.id)) continue;
        viewers.delete(socket.id);
        if (viewers.size === 0) {
          delete remoteViewers[sessionId];
          const assetId = remoteSessionAssets[sessionId];
          if (assetId) {
            io.to(`asset:${assetId}`).emit('remote:leave', { sessionId, assetId, reason: 'viewer_disconnected' });
            delete remoteSessionAssets[sessionId];
          }
        }
      }
      // Mark agent offline if this was an agent socket
      if (socket.data.assetId) {
        pool.query(
          `UPDATE assets SET agent_status='offline', agent_socket_id=NULL WHERE id=$1`,
          [socket.data.assetId]
        ).catch(() => {});
      }
    });

    // ─── Asset Agent Socket Events ──────────────────────────────────────────
    socket.on('agent:join', (data: { assetId: string; agentToken: string }) => {
      pool.query(`SELECT id FROM assets WHERE id=$1 AND agent_token=$2`, [data.assetId, data.agentToken])
        .then(result => {
          if (result.rows.length === 0) return;
          socket.join(`asset:${data.assetId}`);
          socket.data.assetId = data.assetId;
          pool.query(
            `UPDATE assets SET agent_status='online', agent_last_seen=NOW(), agent_socket_id=$1 WHERE id=$2`,
            [socket.id, data.assetId]
          ).catch(() => {});
          io.to(`asset:${data.assetId}`).emit('agent:online', { assetId: data.assetId });
        }).catch(() => {});
    });

    // Remote desktop relay: web client → agent (start session with quality/speed settings)
    socket.on('remote:session:start', (data: { sessionId: string; assetId: string; quality?: number; interval?: number }) => {
      const user = socket.data.user as JwtPayload | undefined;
      if (user && !['admin', 'agent'].includes(user.role)) return;
      remoteSessionAssets[data.sessionId] = data.assetId;
      io.to(`asset:${data.assetId}`).emit('remote:session:start', { sessionId: data.sessionId, quality: data.quality, interval: data.interval });
    });

    // Remote desktop relay: web client → agent (frame request with optional quality)
    socket.on('remote:frame:request', (data: { sessionId: string; assetId: string; quality?: number }) => {
      const user = socket.data.user as JwtPayload | undefined;
      if (user && !['admin', 'agent'].includes(user.role)) return;
      io.to(`asset:${data.assetId}`).emit('remote:frame:request', { sessionId: data.sessionId, quality: data.quality });
    });

    // Remote desktop relay: agent → web client (frames, binary supported via Buffer)
    socket.on('remote:frame', (data: { sessionId: string; frame: string | Buffer; width: number; height: number }) => {
      const len = typeof data.frame === 'string' ? data.frame.length : (data.frame as Buffer)?.length || 0;
      fastify.log.info({ sessionId: data.sessionId, frameLength: len }, 'Relaying remote frame');
      io.to(`remote:${data.sessionId}`).emit('remote:frame', data);
    });

    // Remote desktop relay: web client → agent (mouse/keyboard events)
    socket.on('remote:input', (data: { sessionId: string; assetId: string; type: string; payload: any }) => {
      const user = socket.data.user as JwtPayload | undefined;
      if (user && !['admin', 'agent'].includes(user.role)) return;
      io.to(`asset:${data.assetId}`).emit('remote:input', data);
    });

    // WebRTC signaling relay: viewer ↔ agent (via asset and remote rooms)
    socket.on('webrtc:description', (data: { sessionId: string; assetId?: string; description: any }) => {
      if (socket.data.assetId) {
        // Sent by agent's main-process socket → forward to viewers in remote room
        socket.to(`remote:${data.sessionId}`).emit('webrtc:description', { ...data, from: 'agent' });
      } else {
        // Sent by web viewer → forward to agent in asset room
        if (data.assetId) {
          socket.to(`asset:${data.assetId}`).emit('webrtc:description', { ...data, from: 'viewer' });
        }
      }
    });

    socket.on('webrtc:ice-candidate', (data: { sessionId: string; assetId?: string; candidate: any }) => {
      if (socket.data.assetId) {
        // Agent → viewer
        socket.to(`remote:${data.sessionId}`).emit('webrtc:ice-candidate', { ...data, from: 'agent' });
      } else {
        // Viewer → agent
        if (data.assetId) {
          socket.to(`asset:${data.assetId}`).emit('webrtc:ice-candidate', { ...data, from: 'viewer' });
        }
      }
    });

    // WebRTC error relay: agent → viewer
    socket.on('webrtc:error', (data: { sessionId: string; error: string; assetId?: string }) => {
      if (socket.data.assetId) {
        socket.to(`remote:${data.sessionId}`).emit('webrtc:error', { ...data, from: 'agent' });
      }
    });

    // H.264 streaming relay: agent → viewer (fMP4 for MSE)
    socket.on('remote:h264:init', (data: { sessionId: string; codec: string; data: Buffer }) => {
      if (socket.data.assetId) {
        socket.to(`remote:${data.sessionId}`).emit('remote:h264:init', data);
      }
    });

    socket.on('remote:h264:fragment', (data: { sessionId: string; data: Buffer }) => {
      if (socket.data.assetId) {
        socket.to(`remote:${data.sessionId}`).emit('remote:h264:fragment', data);
      }
    });

    socket.on('remote:h264:error', (data: { sessionId: string; error: string }) => {
      if (socket.data.assetId) {
        socket.to(`remote:${data.sessionId}`).emit('remote:h264:error', data);
      }
    });

    // WebRTC ended relay: agent → viewer
    socket.on('webrtc:ended', (data: { sessionId: string; assetId?: string }) => {
      if (socket.data.assetId) {
        socket.to(`remote:${data.sessionId}`).emit('webrtc:ended', { ...data, from: 'agent' });
      }
    });

    // Web client joins remote session room
    socket.on('remote:join', (sessionId: string) => {
      socket.join(`remote:${sessionId}`);
      if (!remoteViewers[sessionId]) remoteViewers[sessionId] = new Set();
      remoteViewers[sessionId].add(socket.id);
    });

    socket.on('remote:leave', (payload: string | { sessionId?: string; assetId?: string }) => {
      const sessionId = typeof payload === 'string' ? payload : payload?.sessionId;
      if (!sessionId) return;
      socket.leave(`remote:${sessionId}`);
      const viewers = remoteViewers[sessionId];
      if (viewers) {
        viewers.delete(socket.id);
      }
      const assetId = typeof payload !== 'string' ? payload?.assetId : remoteSessionAssets[sessionId];
      if (!viewers || viewers.size === 0) {
        delete remoteViewers[sessionId];
        if (assetId) {
          io.to(`asset:${assetId}`).emit('remote:leave', { sessionId, assetId, reason: 'viewer_left' });
          delete remoteSessionAssets[sessionId];
        }
      }
    });

    // Web client requests agent to re-check-in immediately
    socket.on('agent:request-checkin', (data: { assetId: string }) => {
      io.to(`asset:${data.assetId}`).emit('agent:request-checkin', {});
    });
  });

  await fastify.listen({ port, host });

  fastify.log.info(`Resolv API running on http://${host}:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
