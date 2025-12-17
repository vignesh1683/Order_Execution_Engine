// src/types/index.ts

export type OrderStatus = 
  | 'pending' 
  | 'routing' 
  | 'limit_check' 
  | 'building' 
  | 'submitted' 
  | 'confirmed' 
  | 'failed';

export type OrderType = 'LIMIT' | 'MARKET' | 'SNIPER';

export type DexType = 'RAYDIUM' | 'METEORA';

export interface CreateOrderRequest {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  limitPrice?: number;
  slippage?: number;
}

export interface Order {
  id: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  limitPrice?: number;
  slippage: number;
  status: OrderStatus;
  dex?: DexType;
  executedPrice?: number;
  txHash?: string;
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DexQuote {
  price: number;
  fee: number;
  dex: DexType;
}

export interface DexRouterResult {
  selectedDex: DexType;
  price: number;
  fee: number;
  effectivePrice: number;
}

export interface SwapResult {
  txHash: string;
  executedPrice: number;
  timestamp: Date;
}

export interface WebSocketMessage {
  orderId: string;
  status: OrderStatus;
  data?: {
    dex?: DexType;
    price?: number;
    txHash?: string;
    error?: string;
    [key: string]: any;
  };
  timestamp: Date;
}

export interface JobData {
  orderId: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  limitPrice?: number;
  slippage: number;
}
