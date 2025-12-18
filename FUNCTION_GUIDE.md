# Function Flow & Code Reference

This guide provides a function-by-function breakdown of the codebase, explaining exactly what each piece of code does and how it contributes to executing an order.

## 🔄 The Execution Flow: How It All Connects

Before diving into individual functions, here is the sequence of function calls for a single limit order:

1.  **API Layer**: User hits `POST /api/orders/execute`.
    *   Calls `orderService.createOrder()` to save to DB.
    *   Calls `addOrderToQueue()` to send to BullMQ.
2.  **Queue Worker**: Redis triggers the worker.
    *   `setupOrderWorker()`'s callback fires.
    *   Calls `limitOrderService.processLimitOrder()`.
3.  **Core Logic**: Inside `processLimitOrder()`:
    *   Calls `dexRouter.routeOrder()` asking for quotes.
    *   Calls `checkLimitWithRetry()` to validate price.
    *   Calls `dexRouter.executeSwap()` to "run" the transaction.
    *   Calls `orderService.updateOrderStatus()` to finalize DB.
4.  **Live Updates**: Throughout step 3:
    *   `wsManager.emit()` is called to push status to the frontend.

---

## 📚 Component Reference

### 1. Limit Order Service
**File**: `src/services/limitOrderService.ts`
**Role**: The "Brain" of the operation. It coordinates the entire lifecycle of a limit order.

| Function | What it does | Execution Role |
| :--- | :--- | :--- |
| **`processLimitOrder`** | Orchestrates the 6-step lifecycle: Routing → Limit Check → Building → Submitted → Executed → Confirmed. | **Main Entry Point**. Called by the Queue Worker to start processing a job. |
| **`checkLimitWithRetry`** | Recursively checks if `currentPrice <= limitPrice`. If not, it waits 3s and retries (up to 3 times). | **Gatekeeper**. Ensures we only execute when the price is right. Handles the "wait and see" logic. |
| **`emitStatus`** | Helper to format a status message and send it via WebSocket. | **Messenger**. Keeps the user informed of every state change in real-time. |
| **`sleep`** | `Promise` - based delay utility. | **Timer**. Used to create the 3-second pause between retries. |

### 2. Mock DEX Router
**File**: `src/dex/MockDexRouter.ts`
**Role**: The "Market". Simulates external exchanges like Raydium and Meteora.

| Function | What it does | Execution Role |
| :--- | :--- | :--- |
| **`getRaydiumQuote`** | Returns a mock price with free 0.3% and 2-4% variance. Simulates net delay. | **Data Source**. Provides simulated market data for Raydium. |
| **`getMeteorQuote`** | Returns a mock price with fee 0.2% and 2-5% variance. Simulates net delay. | **Data Source**. Provides simulated market data for Meteora. |
| **`routeOrder`** | Calls both quote functions **in parallel** (`Promise.all`) and selects the best one based on effective price (price - fees). | **Decision Maker**. Decides *where* to execute the trade for the best deal. |
| **`executeSwap`** | Simulates the 2-3s delay of building and sending a transaction. Returns a fake `txHash`. | **Executor**. The final step that "buys" the token on the blockchain. |
| **`checkLimitCondition`** | Simple boolean check: `price <= limit`. | **Validator**. Pure logic to verify if the trade conditions are met. |

### 3. Order Queue
**File**: `src/queue/orderQueue.ts`
**Role**: The "Traffic Controller". Manages concurrency and background processing.

| Function | What it does | Execution Role |
| :--- | :--- | :--- |
| **`setupOrderWorker`** | Configures the BullMQ worker. Defines **what** to do when a job arrives (call `limitOrderService`). | **Engine Starter**. Initializes the background processing system. |
| **`addOrderToQueue`** | Adds a job to Redis with retry configurations (exponential backoff). | **Dispatcher**. Moves the order from the API layer to the background worker. |
| **`getQueueStats`** | Returns counts of waiting, active, and completed jobs. | **Monitor**. Used by the `/api/stats` endpoint for dashboard monitoring. |

### 4. Order Service (Persistence)
**File**: `src/services/orderService.ts`
**Role**: The "Librarian". Handles all database read/write operations.

| Function | What it does | Execution Role |
| :--- | :--- | :--- |
| **`createOrder`** | Inserts a new row into the `Order` table with internal state `pending`. | **Initialization**. The very first thing that happens when a user submits an order. |
| **`updateOrderStatus`** | Updates the order status AND inserts a record into `OrderHistory`. | **Audit Trail**. crucial for tracking the lifecycle and debugging. |
| **`getOrderById`** | SELECT * FROM Order WHERE id = ... | **Fetcher**. Used by the worker to retrieve full order details before processing. |
| **`getStatistics`** | Aggregates counts by status (e.g., pending: 5, confirmed: 20). | **Reporting**. Powers the analytics dashboard. |

### 5. WebSocket Manager
**File**: `src/websocket/wsManager.ts`
**Role**: The "Broadcaster". Manages real-time connections.

| Function | What it does | Execution Role |
| :--- | :--- | :--- |
| **`register`** | Adds a client's socket to a set of listeners for a specific `orderId`. | **Subscription**. Connects a user's browser to a specific order's stream. |
| **`emit`** | Sends a JSON payload to all sockets listening to `orderId`. | **Broadcast**. Pushes status updates (e.g., "Order Confirmed") to the user. |
| **`unregister`** | Removes a socket when the connection closes. | **Cleanup**. Prevents memory leaks key for long-running servers. |
