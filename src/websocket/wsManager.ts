// src/websocket/wsManager.ts

import { WebSocket } from 'ws';
import { WebSocketMessage } from '../types';

class WebSocketManager {
  private connections: Map<string, Set<WebSocket>> = new Map();

  /**
   * Register a WebSocket connection for an order
   */
  register(orderId: string, socket: WebSocket): void {
    if (!this.connections.has(orderId)) {
      this.connections.set(orderId, new Set());
    }
    this.connections.get(orderId)!.add(socket);
    console.log(`[WS] Client subscribed to order ${orderId}`);
  }

  /**
   * Unregister a WebSocket connection
   */
  unregister(orderId: string, socket: WebSocket): void {
    const sockets = this.connections.get(orderId);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.connections.delete(orderId);
      }
    }
  }

  /**
   * Emit status update to all connected clients for an order
   */
  emit(orderId: string, message: WebSocketMessage): void {
    const sockets = this.connections.get(orderId);
    if (!sockets) {
      console.log(`[WS] No active connections for order ${orderId}`);
      return;
    }

    const payload = JSON.stringify(message);
    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    });

    console.log(`[WS] Emitted ${message.status} to ${sockets.size} client(s) for order ${orderId}`);
  }

  /**
   * Get number of active connections for an order
   */
  getConnectionCount(orderId: string): number {
    return this.connections.get(orderId)?.size || 0;
  }

  /**
   * Clean up all connections
   */
  cleanup(): void {
    this.connections.forEach((sockets) => {
      sockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      });
    });
    this.connections.clear();
  }
}

export const wsManager = new WebSocketManager();
