// Configuration
const API_BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/orders/ws';

// State
let ws = null;
let orders = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// DOM Elements
const orderForm = document.getElementById('orderForm');
const submitBtn = document.getElementById('submitBtn');
const submit5Btn = document.getElementById('submit5Btn');
const clearBtn = document.getElementById('clearBtn');
const refreshStatsBtn = document.getElementById('refreshStatsBtn');
const orderList = document.getElementById('orderList');
const alertContainer = document.getElementById('alertContainer');
const wsStatus = document.getElementById('wsStatus');
const logContainer = document.getElementById('logContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    loadStats();
    
    // Set up event listeners
    orderForm.addEventListener('submit', handleSubmitOrder);
    submit5Btn.addEventListener('click', handleSubmit5Orders);
    clearBtn.addEventListener('click', handleClearOrders);
    refreshStatsBtn.addEventListener('click', loadStats);
    
    // Auto-refresh stats every 5 seconds
    setInterval(loadStats, 5000);
});

// WebSocket Connection
function connectWebSocket() {
    try {
        addLog('[WS] Connecting to WebSocket...');
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            addLog('[WS] Connected to WebSocket');
            updateWSStatus(true);
            reconnectAttempts = 0;
        };
        
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWSMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onerror = (error) => {
            addLog('[WS] WebSocket error', 'error');
            console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
            addLog('[WS] WebSocket disconnected');
            updateWSStatus(false);
            
            // Attempt to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
                addLog(`[WS] Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(connectWebSocket, delay);
            }
        };
    } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        addLog('[WS] Failed to connect to WebSocket', 'error');
    }
}

function updateWSStatus(connected) {
    if (connected) {
        wsStatus.className = 'ws-status ws-connected';
        wsStatus.innerHTML = '<span>●</span> WebSocket: Connected';
    } else {
        wsStatus.className = 'ws-status ws-disconnected';
        wsStatus.innerHTML = '<span class="pulse">●</span> WebSocket: Disconnected';
    }
}

function handleWSMessage(message) {
    addLog(`[WS] Received: ${message.type || message.status}`);
    
    if (message.type === 'subscribed') {
        addLog(`[WS] Subscribed to order ${message.orderId}`);
    } else if (message.orderId) {
        // Order status update
        updateOrderStatus(message);
    }
}

// API Functions
async function submitOrder(orderData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit order');
        }
        
        addLog(`[API] Order created: ${data.orderId}`);
        return data;
    } catch (error) {
        console.error('Error submitting order:', error);
        throw error;
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        const data = await response.json();
        
        if (data.success) {
            updateStats(data.data);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateStats(data) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = `
        <div class="stat-box">
            <div class="value">${data.orders.total || 0}</div>
            <div class="label">Total Orders</div>
        </div>
        <div class="stat-box">
            <div class="value">${data.orders.confirmed || 0}</div>
            <div class="label">Confirmed</div>
        </div>
        <div class="stat-box">
            <div class="value">${data.orders.failed || 0}</div>
            <div class="label">Failed</div>
        </div>
        <div class="stat-box">
            <div class="value">${data.queue.active || 0}</div>
            <div class="label">Queue Active</div>
        </div>
        <div class="stat-box">
            <div class="value">${data.queue.waiting || 0}</div>
            <div class="label">Queue Waiting</div>
        </div>
        <div class="stat-box">
            <div class="value">${data.orders.pending || 0}</div>
            <div class="label">Pending</div>
        </div>
    `;
}

// Event Handlers
async function handleSubmitOrder(e) {
    e.preventDefault();
    
    const orderData = {
        type: document.getElementById('orderType').value,
        tokenIn: document.getElementById('tokenIn').value,
        tokenOut: document.getElementById('tokenOut').value,
        amountIn: parseFloat(document.getElementById('amountIn').value),
        limitPrice: parseFloat(document.getElementById('limitPrice').value),
        slippage: parseFloat(document.getElementById('slippage').value) / 100,
    };
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        const result = await submitOrder(orderData);
        
        // Add order to UI
        addOrder(result.orderId, orderData);
        
        // Subscribe to order updates via WebSocket
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: 'subscribe',
                orderId: result.orderId,
            }));
        }
        
        showAlert('Order submitted successfully! Order ID: ' + result.orderId, 'success');
        loadStats();
    } catch (error) {
        showAlert('Failed to submit order: ' + error.message, 'error');
        addLog(`[ERROR] ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Order';
    }
}

async function handleSubmit5Orders() {
    submit5Btn.disabled = true;
    submit5Btn.textContent = 'Submitting 5 Orders...';
    
    const baseOrderData = {
        type: 'LIMIT',
        tokenIn: document.getElementById('tokenIn').value,
        tokenOut: document.getElementById('tokenOut').value,
        amountIn: parseFloat(document.getElementById('amountIn').value),
        limitPrice: parseFloat(document.getElementById('limitPrice').value),
        slippage: parseFloat(document.getElementById('slippage').value) / 100,
    };
    
    try {
        // Submit 5 orders with slight variations
        const promises = [];
        for (let i = 0; i < 5; i++) {
            const orderData = {
                ...baseOrderData,
                amountIn: baseOrderData.amountIn + (i * 0.5),
                limitPrice: baseOrderData.limitPrice + (i * 1),
            };
            promises.push(submitOrder(orderData));
        }
        
        const results = await Promise.all(promises);
        
        results.forEach((result, index) => {
            const orderData = {
                ...baseOrderData,
                amountIn: baseOrderData.amountIn + (index * 0.5),
                limitPrice: baseOrderData.limitPrice + (index * 1),
            };
            addOrder(result.orderId, orderData);
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    action: 'subscribe',
                    orderId: result.orderId,
                }));
            }
        });
        
        showAlert('5 orders submitted successfully!', 'success');
        addLog('[BATCH] Submitted 5 orders simultaneously');
        loadStats();
    } catch (error) {
        showAlert('Failed to submit orders: ' + error.message, 'error');
        addLog(`[ERROR] Batch submission failed: ${error.message}`, 'error');
    } finally {
        submit5Btn.disabled = false;
        submit5Btn.textContent = 'Submit 5 Orders';
    }
}

function handleClearOrders() {
    if (confirm('Clear all orders from the display?')) {
        orders.clear();
        renderOrders();
        addLog('[UI] Cleared all orders from display');
    }
}

// Order Management
function addOrder(orderId, orderData) {
    orders.set(orderId, {
        id: orderId,
        ...orderData,
        status: 'pending',
        createdAt: new Date(),
        updates: [],
    });
    renderOrders();
}

function updateOrderStatus(message) {
    const order = orders.get(message.orderId);
    if (!order) {
        // Order not in our local state, add it
        orders.set(message.orderId, {
            id: message.orderId,
            status: message.status,
            updates: [message],
            createdAt: new Date(),
        });
    } else {
        order.status = message.status;
        order.updates.push(message);
        
        // Store execution details
        if (message.data) {
            if (message.data.dex) order.dex = message.data.dex;
            if (message.data.price) order.executedPrice = message.data.price;
            if (message.data.txHash) order.txHash = message.data.txHash;
            if (message.data.error) order.error = message.data.error;
        }
    }
    
    renderOrders();
    loadStats();
    
    // Log the update
    addLog(`[ORDER ${message.orderId.substring(0, 8)}] Status: ${message.status}`);
}

function renderOrders() {
    if (orders.size === 0) {
        orderList.innerHTML = `
            <div class="empty-state">
                <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                </svg>
                <p>No orders yet. Submit an order to get started!</p>
            </div>
        `;
        return;
    }
    
    const ordersArray = Array.from(orders.values()).reverse();
    
    orderList.innerHTML = ordersArray.map(order => `
        <div class="order-item ${order.status === 'confirmed' ? 'confirmed' : order.status === 'failed' ? 'failed' : ''}">
            <div class="order-id">Order ID: ${order.id}</div>
            <span class="order-status status-${order.status}">${order.status}</span>
            <div class="order-details">
                <div><strong>Type:</strong> ${order.type || 'LIMIT'}</div>
                <div><strong>Pair:</strong> ${order.tokenIn || 'SOL'} → ${order.tokenOut || 'USDC'}</div>
                <div><strong>Amount:</strong> ${order.amountIn?.toFixed(2) || 'N/A'} ${order.tokenIn || 'SOL'}</div>
                ${order.limitPrice ? `<div><strong>Limit Price:</strong> $${order.limitPrice.toFixed(2)}</div>` : ''}
                ${order.dex ? `<div><strong>DEX:</strong> ${order.dex}</div>` : ''}
                ${order.executedPrice ? `<div><strong>Executed Price:</strong> $${order.executedPrice.toFixed(2)}</div>` : ''}
                ${order.txHash ? `<div><strong>TX Hash:</strong> ${order.txHash.substring(0, 20)}...</div>` : ''}
                ${order.error ? `<div style="color: #dc3545;"><strong>Error:</strong> ${order.error}</div>` : ''}
                <div><strong>Created:</strong> ${order.createdAt.toLocaleTimeString()}</div>
            </div>
        </div>
    `).join('');
}

// UI Helpers
function showAlert(message, type = 'success') {
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    const alert = document.createElement('div');
    alert.className = `alert ${alertClass}`;
    alert.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    if (type === 'error') {
        logEntry.style.color = '#ff6b6b';
    } else if (type === 'success') {
        logEntry.style.color = '#51cf66';
    }
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Keep only last 50 logs
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// Export for debugging
window.debugApp = {
    orders,
    ws,
    reconnect: connectWebSocket,
    loadStats,
};
