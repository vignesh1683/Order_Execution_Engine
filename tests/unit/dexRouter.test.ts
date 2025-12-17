// tests/unit/dexRouter.test.ts

import { MockDexRouter } from '../../src/dex/MockDexRouter';

describe('MockDexRouter', () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  describe('getRaydiumQuote', () => {
    it('should return a quote with price and fee', async () => {
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 1);
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee');
      expect(quote.dex).toBe('RAYDIUM');
      expect(quote.fee).toBe(0.003);
    });

    it('should return price within variance range', async () => {
      const basePrice = 185.5;
      const quote = await router.getRaydiumQuote('SOL', 'USDC', 1);
      const variance = quote.price / basePrice;
      expect(variance).toBeGreaterThanOrEqual(0.98);
      expect(variance).toBeLessThanOrEqual(1.02);
    });
  });

  describe('getMeteorQuote', () => {
    it('should return a quote with price and fee', async () => {
      const quote = await router.getMeteorQuote('SOL', 'USDC', 1);
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee');
      expect(quote.dex).toBe('METEORA');
      expect(quote.fee).toBe(0.002);
    });

    it('should have lower fee than Raydium', async () => {
      const raydiumQuote = await router.getRaydiumQuote('SOL', 'USDC', 1);
      const meteoraQuote = await router.getMeteorQuote('SOL', 'USDC', 1);
      expect(meteoraQuote.fee).toBeLessThan(raydiumQuote.fee);
    });
  });

  describe('routeOrder', () => {
    it('should return best DEX routing', async () => {
      const result = await router.routeOrder('SOL', 'USDC', 1);
      expect(result).toHaveProperty('selectedDex');
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('fee');
      expect(result).toHaveProperty('effectivePrice');
      expect(['RAYDIUM', 'METEORA']).toContain(result.selectedDex);
    });

    it('should select DEX with lower effective price', async () => {
      const result = await router.routeOrder('SOL', 'USDC', 1);
      const effectivePrice = result.price * (1 - result.fee);
      expect(result.effectivePrice).toBe(effectivePrice);
    });

    it('should run in reasonable time', async () => {
      const start = Date.now();
      await router.routeOrder('SOL', 'USDC', 1);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('checkLimitCondition', () => {
    it('should return true when best price <= limit price', () => {
      const result = router.checkLimitCondition(180, 185);
      expect(result).toBe(true);
    });

    it('should return false when best price > limit price', () => {
      const result = router.checkLimitCondition(190, 185);
      expect(result).toBe(false);
    });

    it('should return true when prices are equal', () => {
      const result = router.checkLimitCondition(185, 185);
      expect(result).toBe(true);
    });
  });

  describe('executeSwap', () => {
    it('should return swap result with txHash and executedPrice', async () => {
      const result = await router.executeSwap('RAYDIUM', 'test-order-1');
      expect(result).toHaveProperty('txHash');
      expect(result).toHaveProperty('executedPrice');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.txHash).toBe('string');
      expect(result.txHash.length).toBe(88);
    });

    it('should simulate execution time', async () => {
      const start = Date.now();
      await router.executeSwap('METEORA', 'test-order-2');
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(duration).toBeLessThan(4000);
    });
  });
});
