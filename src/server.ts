// src/server.ts

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { registerOrderRoutes } from './routes/orders';
import { setupOrderWorker } from './queue/orderQueue';
import prisma from './db/prisma';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

async function start() {
  try {
    // Initialize Fastify
    const fastify = Fastify({
      logger: true,
    });

    // Register CORS
    await fastify.register(fastifyCors, {
      origin: true,
    });

    // Register WebSocket plugin
    await fastify.register(fastifyWebsocket);

    // Register static files
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, '../public'),
      prefix: '/',
    });

    // Register order routes
    await registerOrderRoutes(fastify);

    // Setup queue worker
    const worker = await setupOrderWorker();

    // Start server
    await fastify.listen({ port: PORT, host: HOST });

    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`POST /api/orders/execute to submit orders`);
    console.log(`GET /api/stats for system statistics`);
    console.log(`GET /health for health check`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        await worker.close();
        await fastify.close();
        await prisma.$disconnect();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
