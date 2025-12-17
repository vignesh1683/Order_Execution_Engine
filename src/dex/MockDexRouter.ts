// src/dex/MockDexRouter.ts

import { DexQuote, DexRouterResult, SwapResult, DexType } from '../types';

export class MockDexRouter {
  private basePrice = 185.50; // Mock SOL/USDC price

  /**
   * Simulate Raydium quote with network delay
   */
  async getRaydiumQuote(
    _tokenIn: string,
    _tokenOut: string,
    _amount: number
  ): Promise<DexQuote> {
    await this.simulateNetworkDelay(200);
    
    const variance = 0.98 + Math.random() * 0.04; // 2-4% variance
    return {
      price: this.basePrice * variance,
      fee: 0.003,
      dex: 'RAYDIUM',
    };
  }

  /**
   * Simulate Meteora quote with network delay
   */
  async getMeteorQuote(
    _tokenIn: string,
    _tokenOut: string,
    _amount: number
  ): Promise<DexQuote> {
    await this.simulateNetworkDelay(200);
    
    const variance = 0.97 + Math.random() * 0.05; // 2-5% variance
    return {
      price: this.basePrice * variance,
      fee: 0.002,
      dex: 'METEORA',
    };
  }

  /**
   * Fetch quotes from both DEXes and select best price
   */
  async routeOrder(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexRouterResult> {
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount),
    ]);

    // Calculate effective price (price minus fees)
    const raydiumEffective = raydiumQuote.price * (1 - raydiumQuote.fee);
    const meteoraEffective = meteoraQuote.price * (1 - meteoraQuote.fee);

    const selectedDex = raydiumEffective < meteoraEffective ? 'RAYDIUM' : 'METEORA';
    const selectedQuote = selectedDex === 'RAYDIUM' ? raydiumQuote : meteoraQuote;

    console.log(`[DEX ROUTING] Raydium: $${raydiumQuote.price.toFixed(2)} | Meteora: $${meteoraQuote.price.toFixed(2)} | Selected: ${selectedDex}`);

    return {
      selectedDex,
      price: selectedQuote.price,
      fee: selectedQuote.fee,
      effectivePrice: selectedQuote.price * (1 - selectedQuote.fee),
    };
  }

  /**
   * Check if current best price satisfies limit price
   */
  checkLimitCondition(bestPrice: number, limitPrice: number): boolean {
    // For buy orders: bestPrice should be <= limitPrice
    return bestPrice <= limitPrice;
  }

  /**
   * Simulate swap execution
   */
  async executeSwap(dex: DexType, orderId: string): Promise<SwapResult> {
    // Simulate transaction building and submission (2-3 seconds)
    const executionTime = 2000 + Math.random() * 1000;
    await this.simulateNetworkDelay(executionTime);

    const txHash = this.generateMockTxHash();
    const executedPrice = this.basePrice * (0.99 + Math.random() * 0.02);

    console.log(`[SWAP EXECUTED] Order: ${orderId} | DEX: ${dex} | Price: $${executedPrice.toFixed(2)} | TxHash: ${txHash}`);

    return {
      txHash,
      executedPrice,
      timestamp: new Date(),
    };
  }

  /**
   * Simulate network delay in milliseconds
   */
  private async simulateNetworkDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate mock transaction hash
   */
  private generateMockTxHash(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let hash = '';
    for (let i = 0; i < 88; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  }
}
