# Order Execution Engine - Limit Order Implementation

A production-ready Node.js + TypeScript backend that processes **limit orders** with mock DEX routing (Raydium vs Meteora), concurrent order queue management via BullMQ, and real-time WebSocket status updates.

## 🎯 Core Features

- **Limit Order Processing**: Execute orders only when target price is reached
- **DEX Routing**: Automatically compares Raydium and Meteora quotes, selects best price
- **Mock DEX Integration**: Realistic price variations (2-5%) and execution simulations
- **WebSocket Real-time Updates**: `pending → routing → limit_check → building → submitted → confirmed/failed`
- **BullMQ Queue Management**: Up to 10 concurrent orders, 100 orders/minute capacity
- **Retry Logic**: Exponential backoff with up to 3 attempts for failed orders
- **PostgreSQL Persistence**: Full order history and audit trail
- **Production Ready**: Comprehensive error handling, logging, and monitoring

## 📋 Why Limit Orders?

Chosen for this implementation because:
1. **Most realistic**: Traders always protect against slippage with limit orders
2. **Demonstrates full architecture**: Includes price polling, conditional logic, and retry mechanisms
3. **Easily extensible**: 
   - **Market Orders**: Skip `limit_check` phase, execute immediately
   - **Sniper Orders**: Add token launch detection and instant execution

## 🚀 Quick Start

### Prerequisites

```bash
# Check versions
node --version  # v18+
npm --version   # v9+
```

### 1. System Setup (Ubuntu/Debian)

```bash
# Install Redis
sudo apt update
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping  # Should print PONG

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2. Database Setup

```bash
# Create PostgreSQL user and database
sudo -u postgres psql << EOF
CREATE USER order_user WITH PASSWORD '123';
CREATE DATABASE order_execution OWNER order_user;
GRANT ALL PRIVILEGES ON DATABASE order_execution TO order_user;
\q
EOF
```

### 3. Project Setup

```bash
# Clone repo
git clone <repo-url>
cd order-execution-engine

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Update DATABASE_URL if needed

# Initialize database
npx prisma migrate dev --name init

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm run build
npm run start
```

**Expected output:**
```
✅ Server running at http://localhost:3000
📝 POST /api/orders/execute to submit orders
📊 GET /api/stats for system statistics
💚 GET /health for health check
```

## 📡 API Usage

### 1. Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### 2. Submit Limit Order

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "LIMIT",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 1.5,
    "limitPrice": 185.50,
    "slippage": 0.02
  }'
```

**Response:**
```json
{
  "success": true,
  "orderId": "clh7k3j4k3j4k3j4",
  "message": "Order queued successfully. Connect to WebSocket for updates."
}
```

### 3. WebSocket Connection

Open a WebSocket connection to receive real-time updates:

```javascript
// Client-side (Node.js or browser)
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/api/orders/execute');

ws.on('open', () => {
  // Subscribe to order updates
  ws.send(JSON.stringify({
    action: 'subscribe',
    orderId: 'clh7k3j4k3j4k3j4'
  }));
});

ws.on('message', (data) => {
  const update = JSON.parse(data);
  console.log(`${update.status}: `, update.data);
});

// Sample output:
// pending: { message: "Order received and queued" }
// routing: { message: "Fetching quotes from DEXes..." }
// limit_check: { dex: "RAYDIUM", price: 185.42, limitPrice: 185.50 }
// building: { message: "Building transaction..." }
// submitted: { message: "Submitting to network..." }
// confirmed: { 
//   dex: "RAYDIUM", 
//   price: 185.38, 
//   txHash: "Abcd...xyz" 
// }
```

### 4. Get All Orders

```bash
curl 'http://localhost:3000/api/orders?limit=10&offset=0'
```

### 5. Get Single Order

```bash
curl http://localhost:3000/api/orders/clh7k3j4k3j4k3j4
```

### 6. System Statistics

```bash
curl http://localhost:3000/api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": {
      "pending": 2,
      "routing": 1,
      "confirmed": 25,
      "failed": 3,
      "total": 31
    },
    "queue": {
      "waiting": 2,
      "active": 1,
      "completed": 25,
      "failed": 3,
      "delayed": 0,
      "total": 31
    }
  }
}
```

## 🧪 Testing

### Run All Tests

```bash
# Standard mode
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage
```

### Test Coverage

The codebase includes **15+ unit and integration tests**:

**Unit Tests:**
- ✅ DEX Router (price quotes, routing logic, limit conditions)
- ✅ Order Service (CRUD operations, status updates)
- ✅ WebSocket Manager (connection lifecycle)

**Integration Tests:**
- ✅ API endpoints (order submission, retrieval)
- ✅ Queue processing (job queueing, retry logic)
- ✅ WebSocket lifecycle (subscription, updates, unsubscription)

**Example Test Output:**
```
PASS  tests/unit/dexRouter.test.ts
  MockDexRouter
    getRaydiumQuote
      ✓ should return a quote with price and fee
      ✓ should return price within variance range
    getMeteorQuote
      ✓ should return a quote with price and fee
      ✓ should have lower fee than Raydium
    routeOrder
      ✓ should return best DEX routing
      ✓ should select DEX with lower effective price
    checkLimitCondition
      ✓ should return true when best price <= limit price
      ✓ should return false when best price > limit price
    executeSwap
      ✓ should return swap result with txHash
      ✓ should simulate execution time
```

## 🏗️ Architecture

### System Flow

```
User Submits Order (POST /api/orders/execute)
        ↓
API validates & creates Order in DB
        ↓
Returns orderId & queues job in BullMQ
        ↓
Client connects via WebSocket with orderId
        ↓
Queue Worker picks up job (concurrent: 10)
        ↓
Emit: pending
        ↓
Fetch Raydium & Meteora quotes in parallel
        ↓
Emit: routing
        ↓
Compare effective prices, select best DEX
        ↓
Check if current price ≤ limit price
        ↓
Emit: limit_check
        ↓
If NO: Retry up to 3 times with 3-sec delays
        ↓
If YES or all retries failed:
        ├─ YES: Proceed to execution
        └─ NO: Emit failed, return error
        ↓
Emit: building
        ↓
Emit: submitted
        ↓
Execute mock swap (2-3 sec simulation)
        ↓
Emit: confirmed with txHash & final price
        ↓
Update DB, mark order as completed
```

### Directory Structure

```
order-execution-engine/
├── src/
│   ├── server.ts              # Fastify bootstrap, WebSocket setup
│   ├── routes/
│   │   └── orders.ts          # POST /api/orders/execute, GET endpoints
│   ├── services/
│   │   ├── orderService.ts    # Order CRUD operations
│   │   └── limitOrderService.ts # Limit order business logic
│   ├── dex/
│   │   └── MockDexRouter.ts   # Mock Raydium/Meteora quotes
│   ├── queue/
│   │   └── orderQueue.ts      # BullMQ queue setup & worker
│   ├── websocket/
│   │   └── wsManager.ts       # WebSocket connection tracking
│   ├── db/
│   │   └── prisma.ts          # Prisma client
│   └── types/
│       └── index.ts           # TypeScript interfaces
├── prisma/
│   └── schema.prisma          # Database schema (Order, OrderHistory)
├── tests/
│   ├── unit/
│   │   ├── dexRouter.test.ts
│   │   └── orderService.test.ts
│   └── integration/
│       ├── api.test.ts
│       └── queue.test.ts
├── postman/
│   └── Order-Execution-Engine.postman_collection.json
├── .env
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 🗄️ Database Schema

### Orders Table

```sql
CREATE TABLE "Order" (
  id              String      PRIMARY KEY
  type            String      -- LIMIT, MARKET, SNIPER
  tokenIn         String
  tokenOut        String
  amountIn        Float
  limitPrice      Float       -- NULL for market orders
  slippage        Float       DEFAULT 0.02
  status          String      -- pending, routing, limit_check, building, submitted, confirmed, failed
  dex             String      -- RAYDIUM, METEORA
  executedPrice   Float
  txHash          String      UNIQUE
  errorReason     String
  attempts        Int         DEFAULT 0
  createdAt       DateTime    DEFAULT now()
  updatedAt       DateTime    DEFAULT now()
  
  INDEXES: status, createdAt
);

CREATE TABLE "OrderHistory" (
  id              String      PRIMARY KEY
  orderId         String      FOREIGN KEY
  previousStatus  String
  newStatus       String
  dex             String
  price           Float
  timestamp       DateTime    DEFAULT now()
  
  INDEXES: orderId, timestamp
);
```

## 📊 Queue Configuration

### BullMQ Settings

- **Concurrency**: 10 workers (process up to 10 orders simultaneously)
- **Throughput**: ~100 orders/minute capacity
- **Retry Strategy**: Exponential backoff (1s, 2s, 4s delays)
- **Max Retries**: 3 attempts per order
- **Job TTL**: 1 hour (completed), 24 hours (failed)
- **Connection**: Redis (localhost:6379 by default)

### Queue States

```
submitted → waiting → active → completed
                        ↓
                      failed → waiting (retry) → ...
```

## 🔌 WebSocket Message Format

### Status Updates

```json
{
  "orderId": "clh7k3j4k3j4k3j4",
  "status": "confirmed",
  "data": {
    "dex": "RAYDIUM",
    "price": 185.38,
    "txHash": "AbCdEfGhIjKlMnOpQrStUvWxYz..."
  },
  "timestamp": "2024-01-15T10:35:20.456Z"
}
```

### All Status Types

| Status | Description | Data Payload |
|--------|-------------|--------------|
| `pending` | Order received, queued for processing | `{ message }` |
| `routing` | Fetching quotes from DEXes | `{ message }` |
| `limit_check` | Comparing price with limit | `{ dex, price, limitPrice }` |
| `building` | Creating transaction | `{ message }` |
| `submitted` | Sending to network | `{ message }` |
| `confirmed` | ✅ Execution successful | `{ dex, price, txHash }` |
| `failed` | ❌ Order failed | `{ error }` |

## 📦 Deployment

### Option 1: Railway.app

```bash
# Install Railway CLI
npm i -g @railway/cli

# Create & deploy project
railway init
railway up

# Set environment variables in Railway dashboard:
# DATABASE_URL, REDIS_URL, NODE_ENV=production
```

### Option 2: Render.com

1. Create GitHub repo with this code
2. Go to https://render.com → New Web Service
3. Connect GitHub, select repo
4. Add environment variables in Render dashboard:
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   NODE_ENV=production
   ```
5. Deploy! 🚀

### Environment Variables

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
REDIS_HOST=host
REDIS_PORT=6379
LOG_LEVEL=info
```

## 🎬 Demo Video Script

**Goal**: 1-2 minute video showing the engine in action

**Content:**
1. **Show Code** (15 sec): Quick tour of architecture (MockDexRouter, orderService, queue setup)
2. **Start Server** (10 sec): `npm run dev` → Server boots up
3. **Submit Orders** (30 sec): Use Postman to send 5 concurrent limit orders
4. **Watch WebSocket** (30 sec): Live terminal showing `pending → routing → limit_check → confirmed`
5. **Show Logs** (15 sec): Console output showing DEX routing decisions and pricing
6. **Show Queue** (15 sec): Redis CLI showing 5 jobs processed, throughput stats
7. **Database** (10 sec): Quick `SELECT * FROM "Order"` showing all completed orders
8. **API Response** (10 sec): GET /api/stats showing success/failure breakdown

**Key talking points to mention:**
- "This demonstrates limit order execution with automatic DEX routing"
- "5 orders processed concurrently using BullMQ queue"
- "Real-time WebSocket updates show the entire order lifecycle"
- "Automatic retry logic with exponential backoff handles failures gracefully"
- "Production-ready with 15+ tests and PostgreSQL persistence"

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `redis://127.0.0.1:6379` connection refused | `sudo systemctl start redis-server` |
| PostgreSQL permission denied | Check `.env` `DATABASE_URL` credentials |
| Port 3000 in use | Change `PORT=3001` in `.env` |
| WebSocket timeout | Ensure server is running: `curl http://localhost:3000/health` |
| Tests fail | Run `npm run db:reset` to clear test database |
| Prisma client not generated | Run `npx prisma generate` |

## 📚 References

- [Fastify Documentation](https://www.fastify.io/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Redis Documentation](https://redis.io/documentation)

## 📝 Next Steps (Future Enhancements)

- Add real Raydium/Meteora SDK integration (currently mocked)
- Implement devnet execution with actual Solana transactions
- Add Sniper Order type (token launch detection)
- Add Market Order type (no limit check)
- WebSocket client UI dashboard
- Metrics & monitoring (Prometheus/Grafana)
- CI/CD pipeline (GitHub Actions)
- Rate limiting & API authentication

## 📄 License

MIT

---

**Built with ❤️ for Eterna Backend Task-2**

