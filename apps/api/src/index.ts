import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Server } from 'socket.io';
import multipart from '@fastify/multipart'
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import authPlugin from './plugins/auth';
import swaggerPlugin from './plugins/swagger';
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
import azureAdSyncRoutes from './routes/azure-ad-sync';
import assetRoutes from './routes/assets';
import inboundEmailRoutes from './routes/inbound-email';
import autoReplyRoutes from './routes/auto-reply';
import notificationConfigRoutes from './routes/notification-config';
import watcherRoutes from './routes/watchers';
import satisfactionRoutes from './routes/satisfaction';
import classificationRulesRoutes from './routes/classification-rules';
import customFieldRoutes from './routes/custom-fields';
import ssoRoutes from './routes/sso';
import problemRoutes from './routes/problems';
import approvalRoutes from './routes/approvals';
import changeRoutes from './routes/changes';
import searchRoutes from './routes/search';
import serviceCatalogRoutes from './routes/service-catalog';
import emailAccountRoutes from './routes/email-accounts';
import advancedReportRoutes from './routes/advanced-reports';
import softwareLicenseRoutes from './routes/software-licenses';
import workflowDesignerRoutes from './routes/workflow-designer';
import itsmReportsRoutes from './routes/itsm-reports';
import reportsAggregationRoutes from './routes/reports-aggregation';
import emailCommandRoutes from './routes/email-commands';
import gmailPushRoutes from './routes/gmail-push';
import pinboardRoutes from './routes/pinboard';
import scriptRoutes from './routes/scripts';
import softwarePackageRoutes from './routes/software-packages';
import agentVersionRoutes from './routes/agent-versions';
import roleRulesRoutes from './routes/role-rules';
import approvalRoutingRulesRoutes from './routes/approval-routing-rules';
import { startInboundListener } from './services/inbound-email';
import { startScheduledNotifications, stopScheduledNotifications } from './services/scheduled-notifications';
import { startReportScheduler, stopReportScheduler } from './services/report-scheduler';
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
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
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

  // Rate limiting — global default: 200 requests per 15 minutes per IP
  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '15 minutes',
    allowList: ['127.0.0.1', '::1'], // Skip rate limiting for localhost
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for'] as string || request.ip;
    },
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
  }
  await fastify.register(jwt, {
    secret: jwtSecret,
  });

  // OpenAPI/Swagger documentation — registered before auth so /api/docs is public
  await fastify.register(swaggerPlugin);

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

  io.use(async (socket, next) => {
    // Web client auth (JWT)
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken) {
      try {
        const payload = fastify.jwt.verify<JwtPayload>(authToken);
        socket.data.user = payload;
        socket.data.clientType = 'web';
        return next();
      } catch {
        return next(new Error('Unauthorized'));
      }
    }

    // Agent auth (agentToken + assetId)
    const agentToken = socket.handshake.auth?.agentToken as string | undefined;
    const assetId = socket.handshake.auth?.assetId as string | undefined;
    if (agentToken && assetId) {
      try {
        const result = await pool.query(
          `SELECT id FROM assets WHERE id=$1 AND agent_token=$2`,
          [assetId, agentToken]
        );
        if (result.rows.length > 0) {
          socket.data.assetId = assetId;
          socket.data.clientType = 'agent';
          return next();
        }
      } catch {}
      return next(new Error('Unauthorized'));
    }

    return next(new Error('Unauthorized'));
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
  await fastify.register(azureAdSyncRoutes, { prefix: '/api' });
  await fastify.register(assetRoutes, { prefix: '/api' });
  await fastify.register(inboundEmailRoutes, { prefix: '/api' });
  await fastify.register(autoReplyRoutes, { prefix: '/api' });
  await fastify.register(notificationConfigRoutes, { prefix: '/api' });
  await fastify.register(watcherRoutes, { prefix: '/api' });
  await fastify.register(satisfactionRoutes, { prefix: '/api' });
  await fastify.register(classificationRulesRoutes, { prefix: '/api' });
  await fastify.register(customFieldRoutes, { prefix: '/api' });
  await fastify.register(ssoRoutes, { prefix: '/api' });
  await fastify.register(problemRoutes, { prefix: '/api' });
  await fastify.register(approvalRoutes, { prefix: '/api' });
  await fastify.register(changeRoutes, { prefix: '/api' });
  await fastify.register(searchRoutes, { prefix: '/api' });
  await fastify.register(serviceCatalogRoutes, { prefix: '/api' });
  await fastify.register(emailAccountRoutes, { prefix: '/api' });
  await fastify.register(advancedReportRoutes, { prefix: '/api' });
  await fastify.register(softwareLicenseRoutes, { prefix: '/api' });
  await fastify.register(workflowDesignerRoutes, { prefix: '/api' });
  await fastify.register(itsmReportsRoutes, { prefix: '/api' });
  await fastify.register(reportsAggregationRoutes, { prefix: '/api' });
  await fastify.register(emailCommandRoutes, { prefix: '/api' });
  await fastify.register(gmailPushRoutes, { prefix: '/api' });
  await fastify.register(pinboardRoutes, { prefix: '/api' });
  await fastify.register(scriptRoutes, { prefix: '/api' });
  await fastify.register(softwarePackageRoutes, { prefix: '/api' });
  await fastify.register(agentVersionRoutes, { prefix: '/api' });
  await fastify.register(roleRulesRoutes, { prefix: '/api' });
  await fastify.register(approvalRoutingRulesRoutes, { prefix: '/api' });

  // Health check (under /api prefix so the frontend api helper can reach it)
  fastify.get('/api/health', async (request, reply) => {
    let dbHealthy = false;
    let emailHealthy = false;
    try {
      await pool.query('SELECT 1');
      dbHealthy = true;
    } catch { /* db down */ }

    // Check if email is configured (OAuth tokens, Directory Sync tokens, or email_accounts)
    try {
      const oauthResult = await pool.query(
        "SELECT value FROM system_settings WHERE key IN ('smtp_oauth_tokens', 'directory_sync_tokens') LIMIT 1"
      );
      if (oauthResult.rows.length > 0) {
        const tokens = JSON.parse(oauthResult.rows[0].value);
        if (tokens.access_token && tokens.refresh_token) {
          emailHealthy = true;
        }
      }
      if (!emailHealthy) {
        // Check for SMTP/IMAP email accounts
        const accountResult = await pool.query(
          "SELECT id FROM email_accounts WHERE is_active = true AND direction IN ('outbound', 'both') LIMIT 1"
        );
        if (accountResult.rows.length > 0) {
          emailHealthy = true;
        }
      }
    } catch { /* ignore */ }

    return reply.send({ data: { api: true, db: dbHealthy, email: emailHealthy } });
  });

  const port = parseInt(process.env.PORT || '3001');
  const host = process.env.HOST || '127.0.0.1';

  // ─── Socket.IO event relay ────────────────────────────────────────────────
  io.on('connection', (socket) => {
    // Agent joins its asset room so the server can route events to it
    socket.on('agent:join', (data: { assetId: string }) => {
      // Auth already verified in middleware — just join the room
      const assetId = socket.data.assetId || data.assetId;
      socket.data.assetId = assetId;
      socket.join(`asset:${assetId}`);
      socket.emit('agent:online', { assetId });
      io.to(`asset:${assetId}`).emit('asset:online', { assetId });
      fastify.log.info(`[API] agent joined asset room: ${assetId} socketId: ${socket.id}`);
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

  // Start report scheduler daemon (executes scheduled reports)
  startReportScheduler().catch(err => {
    fastify.log.error('[index] Failed to start report scheduler:', err.message);
  });

  fastify.log.info(`Resolv API running on http://${host}:${port}`);
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  console.log(`[index] Received ${signal}, shutting down gracefully...`);
  try {
    await stopReportScheduler();
    await stopScheduledNotifications();
    await fastify.close();
    console.log('[index] Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[index] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
