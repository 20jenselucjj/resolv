import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Resolv ITSM API',
        description: 'IT Service Management Platform API',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3001/api', description: 'Local development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'tickets', description: 'Ticket management' },
        { name: 'users', description: 'User management' },
        { name: 'categories', description: 'Ticket categories' },
        { name: 'sla', description: 'SLA policies' },
        { name: 'admin', description: 'Admin operations' },
        { name: 'knowledge', description: 'Knowledge base' },
        { name: 'ai', description: 'AI assistant' },
        { name: 'assets', description: 'Asset management' },
        { name: 'notifications', description: 'Notifications' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
  });
}

export default fp(swaggerPlugin, {
  name: 'swagger',
  dependencies: ['@fastify/cors'],
});
