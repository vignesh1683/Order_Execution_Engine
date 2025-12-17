# Order Execution Engine - Limit Order Setup Guide

## Project Overview

A Node.js + TypeScript backend that:
- Processes **limit orders** with DEX routing (Raydium vs Meteora)
- Manages concurrent orders with BullMQ + Redis queue
- Streams real-time updates via WebSocket
- Persists order history in PostgreSQL
- Includes 15+ unit/integration tests

## Installation & Setup (Step by Step)

### 1. System Dependencies

#### Ubuntu/Debian:
```bash
# Redis (in-memory queue)
sudo apt update
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping  # Should print PONG

# PostgreSQL (order history)
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Node.js (v18+)
node --version  # Check if already installed
```

### 2. Database Setup

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Run inside psql:
CREATE USER order_user WITH PASSWORD '123';
CREATE DATABASE order_execution OWNER order_user;
GRANT ALL PRIVILEGES ON DATABASE order_execution TO order_user;
\q
```

### 3. Project Setup

```bash
# Clone or create project
mkdir order-execution-engine
cd order-execution-engine

# Initialize npm
npm init -y

# Install all dependencies (see package.json below)
npm install

# Create .env file
cat > .env << EOF
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://order_user:123@localhost:5432/order_execution"
REDIS_URL="redis://127.0.0.1:6379"
EOF

# Initialize Prisma
npx prisma init

# Run migrations
npx prisma migrate dev --name init

# Seed database (optional)
npm run seed
```

### 4. Running the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production build & run
npm run build
npm run start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### 5. Verify Setup

```bash
# Health check
curl http://localhost:3000/health

# Submit a test order (see API section below)
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "LIMIT",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 1.5,
    "limitPrice": 185.50
  }'
```

## API Usage

### Endpoint: POST /api/orders/execute

**Request:**
```json
{
  "type": "LIMIT",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 1.5,
  "limitPrice": 185.50,
  "slippage": 0.02
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "clh7k3j4k3j4k3j4",
  "message": "Order queued successfully. Connect to WebSocket for updates."
}
```

### WebSocket Connection

After receiving `orderId`, upgrade to WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/execute');
ws.onopen = () => {
  ws.send(JSON.stringify({ action: 'subscribe', orderId: 'clh7k3j4k3j4k3j4' }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(`Order ${update.orderId}: ${update.status}`);
  // Status: pending → routing → limit_check → building → submitted → confirmed/failed
};
```

## Limit Order Logic

**What happens when you submit a limit order:**

1. **pending**: Order stored in DB, queued for processing
2. **routing**: Fetches quotes from both Raydium & Meteora (~200ms each)
3. **limit_check**: Compares best price against your `limitPrice`
   - If `bestPrice ≤ limitPrice` (for buy): Execute ✅
   - If `bestPrice > limitPrice`: Retry up to 3 times (polling every 3-5 sec)
   - If never satisfied: Status → `failed`
4. **building**: Creating mock transaction
5. **submitted**: Simulating network submission (2-3 sec)
6. **confirmed**: Execution successful with `txHash` and final price

## Directory Structure

```
order-execution-engine/
├── src/
│   ├── server.ts                 # Fastify bootstrap
│   ├── routes/
│   │   └── orders.ts             # POST /api/orders/execute
│   ├── services/
│   │   ├── orderService.ts       # Order CRUD & business logic
│   │   └── limitOrderService.ts  # Limit order specific logic
│   ├── dex/
│   │   └── MockDexRouter.ts      # Raydium/Meteora mock quotes
│   ├── queue/
│   │   ├── orderQueue.ts         # BullMQ setup & worker
│   │   └── jobProcessor.ts       # Worker job logic
│   ├── websocket/
│   │   └── wsManager.ts          # WebSocket connection management
│   ├── db/
│   │   └── prisma.ts             # Prisma client
│   └── types/
│       └── index.ts              # TypeScript interfaces
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/
├── tests/
│   ├── unit/
│   │   ├── dexRouter.test.ts
│   │   ├── orderService.test.ts
│   │   └── limitOrderService.test.ts
│   ├── integration/
│   │   ├── api.test.ts
│   │   ├── websocket.test.ts
│   │   └── queue.test.ts
│   └── fixtures/
│       └── mockData.ts
├── postman/
│   └── Order-Execution-Engine.postman_collection.json
├── .env
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- dexRouter.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

## Deployment

### Option 1: Render.com (Free tier)

```bash
# Create git repo
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Push to GitHub, then connect Render.com
# Set environment variables in Render dashboard:
# DATABASE_URL, REDIS_URL, NODE_ENV=production

# Render will auto-deploy from git push
```

### Option 2: Railway.app

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login & create project
railway login
railway init

# Deploy
railway up
```

## Why Limit Order?

**Chosen for this implementation because:**
1. **More realistic**: Traders always use limit orders to protect against slippage
2. **Extensible**: Easy to add market orders (no limit check) and sniper orders (token launch detection)
3. **Demonstrates core architecture**: Queue, routing, retry logic, WebSocket—all still needed

**Extension paths:**
- **Market Order**: Skip limit_check phase, execute immediately at best price
- **Sniper Order**: Add token launch detection (monitor blockchain for new token mints, auto-execute at target price)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redis connection refused | `sudo systemctl start redis-server` |
| PostgreSQL permission denied | Check `.env` DATABASE_URL credentials |
| Port 3000 already in use | Change `PORT=3001` in `.env` |
| WebSocket timeout | Ensure server is running on correct port |
| Tests fail | Run `npm run db:reset` to clear test DB |

## References

- [Fastify Docs](https://www.fastify.io/)
- [BullMQ Docs](https://docs.bullmq.io/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

