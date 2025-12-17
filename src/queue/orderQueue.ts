// src/queue/orderQueue.ts

import { Queue, Worker } from 'bullmq';
import { limitOrderService } from '../services/limitOrderService';
import { orderService } from '../services/orderService';
import { JobData } from '../types';

const redisConnection = {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
};

export const ordersQueue = new Queue<JobData>('orders', redisConnection);

/**
 * Create and configure the queue worker
 */
export async function setupOrderWorker() {
  const worker = new Worker<JobData>(
    'orders',
    async (job) => {
      try {
        console.log(`[WORKER] Processing job ${job.id} for order ${job.data.orderId}`);

        // Get order from database
        const order = await orderService.getOrderById(job.data.orderId);
        if (!order) {
          throw new Error(`Order ${job.data.orderId} not found`);
        }

        // Update attempts
        await orderService.incrementAttempts(order.id);

        // Process limit order
        const result = await limitOrderService.processLimitOrder(order);

        if (!result.success) {
          throw new Error(result.error || 'Order processing failed');
        }

        console.log(
          `[WORKER] Successfully completed order ${job.data.orderId}`
        );

        return {
          success: true,
          orderId: job.data.orderId,
          executedPrice: result.executedPrice,
          txHash: result.txHash,
        };
      } catch (error) {
        console.error(`[WORKER] Job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      ...redisConnection,
      concurrency: 10,
      removeOnComplete: {
        age: 3600, // Keep for 1 hour
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    }
  );

  // Event listeners
  worker.on('completed', (job) => {
    console.log(`[WORKER] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[WORKER] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[WORKER] Worker error:', error);
  });

  return worker;
}

/**
 * Add order to queue
 */
export async function addOrderToQueue(
  orderId: string,
  jobData: JobData
): Promise<void> {
  await ordersQueue.add('process-limit-order', jobData, {
    jobId: orderId,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  });

  console.log(`[QUEUE] Order ${orderId} added to queue`);
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    ordersQueue.getWaitingCount(),
    ordersQueue.getActiveCount(),
    ordersQueue.getCompletedCount(),
    ordersQueue.getFailedCount(),
    ordersQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Clear the queue
 */
export async function clearQueue(): Promise<void> {
  await ordersQueue.drain();
  console.log('[QUEUE] Queue cleared');
}
