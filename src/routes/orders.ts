// src/routes/orders.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { orderService } from '../services/orderService';
import { wsManager } from '../websocket/wsManager';
import { addOrderToQueue, getQueueStats } from '../queue/orderQueue';
import { CreateOrderRequest } from '../types';

const CreateOrderSchema = z.object({
  type: z.enum(['LIMIT', 'MARKET', 'SNIPER']),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  slippage: z.number().min(0).max(1).default(0.02),
});

export async function registerOrderRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/orders/execute
   * HTTP handler: Create order and return orderId
   */
  fastify.post('/api/orders/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body
      const validationResult = CreateOrderSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid request body',
          details: validationResult.error.errors,
        });
      }

      const orderData = validationResult.data as CreateOrderRequest;

      // Limit orders must have limitPrice
      if (orderData.type === 'LIMIT' && !orderData.limitPrice) {
        return reply.code(400).send({
          success: false,
          error: 'Limit price is required for LIMIT orders',
        });
      }

      // Create order in database
      const order = await orderService.createOrder(
        orderData.type,
        orderData.tokenIn,
        orderData.tokenOut,
        orderData.amountIn,
        orderData.limitPrice,
        orderData.slippage
      );

      console.log(`[API] Created order ${order.id}`);

      // Add to queue for processing
      await addOrderToQueue(order.id, {
        orderId: order.id,
        type: orderData.type,
        tokenIn: orderData.tokenIn,
        tokenOut: orderData.tokenOut,
        amountIn: orderData.amountIn,
        limitPrice: orderData.limitPrice,
        slippage: orderData.slippage || 0.02,
      });

      return reply.code(202).send({
        success: true,
        orderId: order.id,
        message:
          'Order queued successfully. Connect to WebSocket for updates.',
      });
    } catch (error) {
      console.error('[API] Error creating order:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create order',
      });
    }
  });

  /**
   * GET /api/orders/ws - WebSocket endpoint for order updates
   */
  fastify.get('/api/orders/ws', { websocket: true }, (socket, _request) => {
      console.log('[WS] New WebSocket connection');

      socket.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.action === 'subscribe') {
            const { orderId } = data;
            wsManager.register(orderId, socket);

            // Send confirmation
            socket.send(
              JSON.stringify({
                type: 'subscribed',
                orderId,
                timestamp: new Date(),
              })
            );
          } else if (data.action === 'unsubscribe') {
            const { orderId } = data;
            wsManager.unregister(orderId, socket);
          }
        } catch (error) {
          console.error('[WS] Error handling message:', error);
          socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
            })
          );
        }
      });

    socket.on('close', () => {
      console.log('[WS] Client disconnected');
    });

    socket.on('error', (error: Error) => {
      console.error('[WS] Socket error:', error);
    });
  });

  /**
   * GET /api/orders
   * Get all orders with pagination
   */
  fastify.get(
    '/api/orders',
    async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>, reply: FastifyReply) => {
      try {
        const limit = Math.min(parseInt(request.query.limit || '50'), 100);
        const offset = parseInt(request.query.offset || '0');

        const result = await orderService.getAllOrders(limit, offset);

        return reply.send({
          success: true,
          data: result.orders,
          pagination: { limit, offset, total: result.total },
        });
      } catch (error) {
        console.error('[API] Error fetching orders:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch orders' });
      }
    }
  );

  /**
   * GET /api/orders/:id
   * Get specific order by ID
   */
  fastify.get(
    '/api/orders/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const order = await orderService.getOrderById(request.params.id);

        if (!order) {
          return reply.code(404).send({ success: false, error: 'Order not found' });
        }

        return reply.send({ success: true, data: order });
      } catch (error) {
        console.error('[API] Error fetching order:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch order' });
      }
    }
  );

  /**
   * GET /api/stats
   * Get system statistics
   */
  fastify.get('/api/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orderStats = await orderService.getStatistics();
      const queueStats = await getQueueStats();

      return reply.send({
        success: true,
        data: {
          orders: orderStats,
          queue: queueStats,
        },
      });
    } catch (error) {
      console.error('[API] Error fetching stats:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /health
   * Health check
   */
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date(),
    });
  });
}
