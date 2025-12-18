# Order Execution Engine

A high-performance order execution system built with Node.js and TypeScript. Features real-time WebSocket updates, intelligent DEX routing, and robust queue management for processing limit orders.

## Features

- **Smart DEX Routing** — Automatically compares Raydium and Meteora quotes to get the best price
- **Real-time Updates** — WebSocket-based status updates throughout the order lifecycle
- **Queue Management** — BullMQ-powered concurrent processing (10 workers, ~100 orders/min)
- **Retry Logic** — Exponential backoff with configurable retry attempts
- **Persistent Storage** — PostgreSQL database with full order history
- **Web Dashboard** — Built-in UI for monitoring and submitting orders

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| Framework | Fastify |
| Database | PostgreSQL + Prisma ORM |
| Queue | BullMQ + Redis |
| WebSocket | @fastify/websocket |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Clone the repository
git clone https://github.com/vignesh1683/Order_Execution_Engine.git
cd Order_Execution_Engine

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Setup database
npx prisma migrate dev --name init

# Start the server
npm run dev
```

The server will start at `http://localhost:3000`

## API Reference

### Submit Order

```bash
POST /api/orders/execute
Content-Type: application/json

{
  "type": "LIMIT",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 1.5,
  "limitPrice": 185.50,
  "slippage": 0.02
}
```

### Get Order Status

```bash
GET /api/orders/:id
```

### Get Statistics

```bash
GET /api/stats
```

### Health Check

```bash
GET /health
```

## WebSocket

Connect to `ws://localhost:3000/api/orders/ws` for real-time order updates.

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    orderId: 'your-order-id'
  }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(update.status, update.data);
};
```

### Order Status Flow

```
pending -> routing -> limit_check -> building -> submitted -> confirmed
                                                                                        \ 
                                                                                      failed
```

## Project Structure

```
├── src/
│   ├── server.ts           # Application entry point
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic
│   ├── dex/                # DEX integration (mock)
│   ├── queue/              # BullMQ configuration
│   ├── websocket/          # WebSocket manager
│   └── types/              # TypeScript definitions
├── prisma/
│   └── schema.prisma       # Database schema
├── public/                 # Web dashboard
└── tests/                  # Test suites
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://username:password@localhost:5432/tablename` |
| `REDIS_URL` | Redis connection string | `redis://127.0.0.1:6379` |
| `NODE_ENV` | Environment | `development` |

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```


