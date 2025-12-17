// src/services/orderService.ts

import prisma from '../db/prisma';
import { Order, OrderStatus, OrderType } from '../types';

export class OrderService {
  /**
   * Create a new order in the database
   */
  async createOrder(
    type: OrderType,
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    limitPrice?: number,
    slippage: number = 0.02
  ): Promise<Order> {
    const order = await prisma.order.create({
      data: {
        type,
        tokenIn,
        tokenOut,
        amountIn,
        limitPrice,
        slippage,
        status: 'pending',
      },
    });

    return order as Order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(id: string): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where: { id },
    });

    return order as Order | null;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    data?: {
      dex?: string;
      executedPrice?: number;
      txHash?: string;
      errorReason?: string;
    }
  ): Promise<Order> {
    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...data,
      },
    });

    // Log status change to history
    if (data) {
      await prisma.orderHistory.create({
        data: {
          orderId: id,
          previousStatus: (await this.getOrderById(id))?.status || 'unknown',
          newStatus: status,
          dex: data.dex,
          price: data.executedPrice,
        },
      });
    }

    return order as Order;
  }

  /**
   * Get all orders
   */
  async getAllOrders(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ orders: Order[]; total: number }> {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count(),
    ]);

    return { orders: orders as Order[], total };
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });

    return orders as Order[];
  }

  /**
   * Increment order attempts
   */
  async incrementAttempts(id: string): Promise<void> {
    await prisma.order.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  /**
   * Get order statistics
   */
  async getStatistics() {
    const [pending, routing, confirmed, failed, total] = await Promise.all([
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.count({ where: { status: 'routing' } }),
      prisma.order.count({ where: { status: 'confirmed' } }),
      prisma.order.count({ where: { status: 'failed' } }),
      prisma.order.count(),
    ]);

    return { pending, routing, confirmed, failed, total };
  }
}

export const orderService = new OrderService();
