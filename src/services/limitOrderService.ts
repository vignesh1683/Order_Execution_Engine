// src/services/limitOrderService.ts

import { MockDexRouter } from '../dex/MockDexRouter';
import { orderService } from './orderService';
import { wsManager } from '../websocket/wsManager';
import { Order, WebSocketMessage } from '../types';

export class LimitOrderService {
  private dexRouter: MockDexRouter;
  private maxRetries = 3;
  private retryDelayMs = 3000;

  constructor() {
    this.dexRouter = new MockDexRouter();
  }

  /**
   * Process limit order through its full lifecycle
   */
  async processLimitOrder(order: Order): Promise<{
    success: boolean;
    executedPrice?: number;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Step 1: Routing
      await this.emitStatus(order.id, 'routing', {
        message: 'Fetching quotes from DEXes...',
      });

      const routeResult = await this.dexRouter.routeOrder(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      // Step 2: Limit check with retry logic
      await this.emitStatus(order.id, 'limit_check', {
        dex: routeResult.selectedDex,
        price: routeResult.effectivePrice,
        limitPrice: order.limitPrice,
      });

      const limitSatisfied = await this.checkLimitWithRetry(
        order.id,
        routeResult.effectivePrice,
        order.limitPrice!
      );

      if (!limitSatisfied) {
        throw new Error(
          `Limit price not reached after ${this.maxRetries} attempts. Best price: $${routeResult.effectivePrice.toFixed(2)}, Limit: $${order.limitPrice!.toFixed(2)}`
        );
      }

      // Step 3: Building
      await this.emitStatus(order.id, 'building', {
        message: 'Building transaction...',
      });
      await this.sleep(500);

      // Step 4: Submitted
      await this.emitStatus(order.id, 'submitted', {
        message: 'Submitting to network...',
      });

      // Step 5: Execute swap
      const swapResult = await this.dexRouter.executeSwap(
        routeResult.selectedDex,
        order.id
      );

      // Step 6: Confirmed
      await this.emitStatus(order.id, 'confirmed', {
        dex: routeResult.selectedDex,
        price: swapResult.executedPrice,
        txHash: swapResult.txHash,
      });

      await orderService.updateOrderStatus(order.id, 'confirmed', {
        dex: routeResult.selectedDex,
        executedPrice: swapResult.executedPrice,
        txHash: swapResult.txHash,
      });

      return {
        success: true,
        executedPrice: swapResult.executedPrice,
        txHash: swapResult.txHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.emitStatus(order.id, 'failed', {
        error: errorMessage,
      });

      await orderService.updateOrderStatus(order.id, 'failed', {
        errorReason: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check limit price with retry logic
   */
  private async checkLimitWithRetry(
    orderId: string,
    currentPrice: number,
    limitPrice: number,
    attempt: number = 1
  ): Promise<boolean> {
    if (this.dexRouter.checkLimitCondition(currentPrice, limitPrice)) {
      console.log(
        `[LIMIT CHECK] Order ${orderId} passed on attempt ${attempt}: $${currentPrice.toFixed(2)} <= $${limitPrice.toFixed(2)}`
      );
      return true;
    }

    if (attempt >= this.maxRetries) {
      console.log(
        `[LIMIT CHECK] Order ${orderId} failed after ${this.maxRetries} attempts. Best: $${currentPrice.toFixed(2)}, Limit: $${limitPrice.toFixed(2)}`
      );
      return false;
    }

    console.log(
      `[LIMIT CHECK] Attempt ${attempt}/${this.maxRetries} failed. Retrying in ${this.retryDelayMs}ms...`
    );

    await this.sleep(this.retryDelayMs);

    const newRoute = await this.dexRouter.routeOrder(
      'SOL',
      'USDC',
      1.5
    );

    return this.checkLimitWithRetry(
      orderId,
      newRoute.effectivePrice,
      limitPrice,
      attempt + 1
    );
  }

  /**
   * Emit WebSocket status update
   */
  private async emitStatus(
    orderId: string,
    status: string,
    data?: any
  ): Promise<void> {
    const message: WebSocketMessage = {
      orderId,
      status: status as any,
      data,
      timestamp: new Date(),
    };

    wsManager.emit(orderId, message);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const limitOrderService = new LimitOrderService();
