# 🎨 UI & API Guide - Order Execution Engine

## 🌐 Web Interface

### Access the UI
Once the server is running, open your browser and navigate to:
```
http://localhost:3000
```

### Features

#### 1. **Submit Orders**
- **Order Type**: Select LIMIT (currently implemented), MARKET, or SNIPER (future)
- **Token Pair**: Default SOL → USDC (customizable)
- **Amount**: Specify the amount to trade
- **Limit Price**: Set your target price (USD)
- **Slippage**: Tolerance percentage (default 2%)

#### 2. **Batch Testing**
- **"Submit 5 Orders" Button**: Automatically submits 5 orders with slight variations
- Demonstrates concurrent processing capability
- Tests queue management with up to 10 concurrent orders

#### 3. **Real-Time Updates**
- **WebSocket Status**: Shows connection state
- **Live Order Tracking**: Real-time status updates for all orders
- **Status Progression**:
  - 🟡 `pending` → Order received and queued
  - 🔵 `routing` → Comparing DEX prices (Raydium vs Meteora)
  - 🟣 `limit_check` → Verifying limit price condition
  - 🟠 `building` → Creating transaction
  - 🔵 `submitted` → Transaction sent to network
  - 🟢 `confirmed` → Success! (includes txHash and executed price)
  - 🔴 `failed` → Error occurred (includes reason)

#### 4. **System Statistics**
- **Total Orders**: All orders submitted
- **Confirmed**: Successfully executed orders
- **Failed**: Orders that couldn't be completed
- **Queue Active**: Currently processing orders
- **Queue Waiting**: Orders waiting in queue
- **Pending**: Orders awaiting execution

#### 5. **System Logs**
- Real-time console output
- WebSocket connection events
- Order processing updates
- DEX routing decisions
- Error messages

---

## 📮 Postman Collection

### Import the Collection

1. Open Postman
2. Click **Import** button
3. Select the file: `Order-Execution-Engine-API.postman_collection.json`
4. Collection will be imported with all endpoints

### Collection Structure

#### **Health & Status**
- `GET /health` - Health check
- `GET /api/stats` - System statistics

#### **Order Management**
- `POST /api/orders/execute` - Submit limit order
- `GET /api/orders` - Get all orders (with pagination)
- `GET /api/orders/:orderId` - Get specific order

#### **Test Scenarios**
- Submit 5 concurrent orders (use Runner)
- Low limit price order (tests retry logic)
- High limit price order (immediate execution)

### Environment Variables

The collection uses a variable:
- `baseUrl`: `http://localhost:3000`

You can modify this in Postman's environment settings.

---

## 🧪 Testing Concurrent Orders

### Method 1: Using UI
1. Click **"Submit 5 Orders"** button
2. Watch the queue process all orders
3. Observe DEX routing decisions in logs
4. See status updates in real-time

### Method 2: Using Postman Runner
1. Select the **"Submit 5 Concurrent Orders"** request
2. Click **Run** button
3. Set **Iterations**: 5
4. Set **Delay**: 0ms (for simultaneous)
5. Click **Run**
6. View results and order IDs in console

### Method 3: Using cURL Script
```bash
# Submit 5 orders simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/orders/execute \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"LIMIT\",
      \"tokenIn\": \"SOL\",
      \"tokenOut\": \"USDC\",
      \"amountIn\": $((10 + i)),
      \"limitPrice\": $((190 + i)),
      \"slippage\": 0.02
    }" &
done
wait
echo "All 5 orders submitted!"
```

---

## 🔌 WebSocket Integration

### Connect to WebSocket

**Endpoint**: `ws://localhost:3000/api/orders/ws`

### Subscribe to Order Updates

After submitting an order, subscribe to receive real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/ws');

ws.onopen = () => {
  // Subscribe to order
  ws.send(JSON.stringify({
    action: 'subscribe',
    orderId: 'your-order-id-here'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Order Update:', message);
  // message.status: pending, routing, limit_check, building, submitted, confirmed, failed
  // message.data: { dex, price, txHash, error, ... }
};
```

### Message Format

**Subscription Confirmation:**
```json
{
  "type": "subscribed",
  "orderId": "cmj9j03gf000056ufnk59ptnw",
  "timestamp": "2025-12-17T04:42:54.628Z"
}
```

**Status Updates:**
```json
{
  "orderId": "cmj9j03gf000056ufnk59ptnw",
  "status": "routing",
  "data": {
    "message": "Fetching quotes from DEXes..."
  },
  "timestamp": "2025-12-17T04:42:55.100Z"
}
```

**Confirmed Order:**
```json
{
  "orderId": "cmj9j03gf000056ufnk59ptnw",
  "status": "confirmed",
  "data": {
    "dex": "METEORA",
    "price": 184.07,
    "txHash": "LDk0G8w3DlIKK84ZqErQAWMb9HBVyjsdFWMZrPICMiRa..."
  },
  "timestamp": "2025-12-17T04:42:58.500Z"
}
```

---

## 📊 API Examples

### Submit a Limit Order

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "LIMIT",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 10,
    "limitPrice": 190,
    "slippage": 0.02
  }'
```

**Response:**
```json
{
  "success": true,
  "orderId": "cmj9j03gf000056ufnk59ptnw",
  "message": "Order queued successfully. Connect to WebSocket for updates."
}
```

### Get System Statistics

```bash
curl http://localhost:3000/api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": {
      "pending": 0,
      "routing": 0,
      "confirmed": 5,
      "failed": 0,
      "total": 5
    },
    "queue": {
      "waiting": 0,
      "active": 2,
      "completed": 3,
      "failed": 0,
      "delayed": 0,
      "total": 5
    }
  }
}
```

### Get All Orders

```bash
curl "http://localhost:3000/api/orders?limit=10&offset=0"
```

### Get Specific Order

```bash
curl http://localhost:3000/api/orders/cmj9j03gf000056ufnk59ptnw
```

---

## 🎯 Key Features Demonstrated

### ✅ Order Type: LIMIT
- Chosen for realistic trading scenarios
- Demonstrates price polling and conditional logic
- Includes retry mechanism with exponential backoff
- **Extensibility**:
  - **Market Orders**: Skip `limit_check` phase, execute immediately
  - **Sniper Orders**: Add token launch detection, instant execution on trigger

### ✅ DEX Routing
- Fetches quotes from both Raydium and Meteora
- Compares prices and fees
- Selects best execution venue automatically
- Logs routing decisions for transparency

### ✅ WebSocket Real-Time Updates
- Connects via single HTTP endpoint
- Upgrades to WebSocket for streaming
- Emits status at each processing stage
- Maintains connection for multiple orders

### ✅ Concurrent Processing
- BullMQ queue with Redis backend
- Up to 10 concurrent order processing
- 100 orders/minute capacity
- Retry logic: 3 attempts with exponential backoff

### ✅ Error Handling
- Comprehensive validation
- Detailed error messages
- Retry logic for transient failures
- Failed order persistence with reason

---

## 🚀 Quick Start Checklist

- [x] Server running on http://localhost:3000
- [x] Redis running and connected
- [x] PostgreSQL database initialized
- [x] UI accessible in browser
- [x] Postman collection imported
- [x] WebSocket connection working
- [x] Orders processing successfully
- [x] DEX routing functioning
- [x] System statistics displaying
- [x] Concurrent order handling tested

---

## 📝 Next Steps

1. **Test the UI**: Submit orders and watch real-time updates
2. **Test with Postman**: Import collection and run test scenarios
3. **Test Concurrent Processing**: Submit 5 orders simultaneously
4. **Monitor Logs**: Watch DEX routing decisions
5. **Check Database**: Verify order persistence

**The complete system is now ready for demonstration! 🎉**
