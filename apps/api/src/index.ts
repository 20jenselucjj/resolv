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

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

async function start() {
  // Register plugins
  await fastify.register(cors, {
    origin: process.env.WEB_URL || 'http://localhost:3000',
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
      origin: process.env.WEB_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  fastify.decorate('io', io);

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: error.message });
    }
    if (error.code === '23505') {
      return reply.status(409).send({ error: 'Already exists' });
    }
    return reply.status(500).send({ error: 'Internal server error' });
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

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

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
    });
  });

  await fastify.listen({ port, host });

  fastify.log.info(`Resolv API running on http://${host}:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
