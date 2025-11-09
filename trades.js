// Live Trades Visualization
const tradesCanvas = document.getElementById('tradesCanvas');
const tradesCtx = tradesCanvas.getContext('2d');

let canvasWidth = window.innerWidth;
let canvasHeight = window.innerHeight;

function resizeTradesCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    tradesCanvas.width = canvasWidth;
    tradesCanvas.height = canvasHeight;
}

resizeTradesCanvas();
window.addEventListener('resize', resizeTradesCanvas);

// Load symbols from localStorage or use defaults
let activeSymbols = JSON.parse(localStorage.getItem('activeSymbols')) || ['ETH', 'BTC', 'SOL'];

// Generate HTML for stats boxes at page load
function initializeStatsHTML() {
    // Generate top stats (trades/s)
    const liveStats = document.getElementById('liveStats');
    if (liveStats) {
        liveStats.innerHTML = activeSymbols.map(symbol => `
            <div class="stat-box">
                <div class="stat-title">${symbol}</div>
                <div class="stat-value" id="${symbol.toLowerCase()}Count">0</div>
                <div class="stat-label">Trades/s</div>
            </div>
        `).join('');
    }

    // Generate bottom stats (volume & volatility)
    const bottomStats = document.getElementById('bottomStats');
    if (bottomStats) {
        bottomStats.innerHTML = `
            <div class="stats-row">
                <div class="row-label">Volume/s (USD)</div>
                <div class="row-boxes">
                    ${activeSymbols.map(symbol => `
                        <div class="stat-box-bottom">
                            <div class="stat-title">${symbol}</div>
                            <div class="stat-value" id="${symbol.toLowerCase()}Volume">$0</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="stats-row">
                <div class="row-label">Volatility (BP)</div>
                <div class="row-boxes">
                    ${activeSymbols.map(symbol => `
                        <div class="stat-box-bottom">
                            <div class="stat-title">${symbol}</div>
                            <div class="stat-value" id="${symbol.toLowerCase()}Volatility">0</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// Initialize stats HTML immediately
initializeStatsHTML();

// Layout settings (must be before generateNodes)
let layoutPreset = localStorage.getItem('layoutPreset') || 'spider'; // spider, centered, aligned
let aggregateExchanges = localStorage.getItem('aggregateExchanges') === 'true'; // Default false

// Migrate old 'aggregated' layout to new system
if (layoutPreset === 'aggregated') {
    layoutPreset = 'aligned';
    aggregateExchanges = true;
    localStorage.setItem('layoutPreset', 'aligned');
    localStorage.setItem('aggregateExchanges', 'true');
}

let showCryptoConnections = localStorage.getItem('showCryptoConnections') !== 'false'; // Default true
let showTradeGlow = localStorage.getItem('showTradeGlow') !== 'false'; // Default true
let showSpreadInfo = localStorage.getItem('showSpreadInfo') !== 'false'; // Default true

// Generate nodes dynamically based on active symbols and layout preset
function generateNodes() {
    const nodes = {};
    const numAssets = activeSymbols.length;

    // Create exchange nodes based on aggregation setting
    if (aggregateExchanges) {
        // Single aggregated exchange node
        if (layoutPreset === 'spider') {
            nodes.exchange = { x: 0.5, y: 0.2, name: 'EXCHANGES', prices: {} };
        } else if (layoutPreset === 'centered') {
            nodes.exchange = { x: 0.5, y: 0.5, name: 'EXCHANGES', prices: {} };
        } else if (layoutPreset === 'aligned') {
            nodes.exchange = { x: 0.5, y: 0.2, name: 'EXCHANGES', prices: {} };
        } else {
            // Default to spider position if unknown preset
            nodes.exchange = { x: 0.5, y: 0.2, name: 'EXCHANGES', prices: {} };
        }

        // Initialize exchange prices
        activeSymbols.forEach(symbol => {
            nodes.exchange.prices[symbol] = 0;
        });
    } else {
        // Separate exchange nodes
        if (layoutPreset === 'spider') {
            nodes.binance = { x: 0.15, y: 0.2, name: 'BINANCE', prices: {} };
            nodes.bybit = { x: 0.85, y: 0.2, name: 'BYBIT', prices: {} };
        } else if (layoutPreset === 'centered') {
            nodes.binance = { x: 0.45, y: 0.5, name: 'BINANCE', prices: {} };
            nodes.bybit = { x: 0.55, y: 0.5, name: 'BYBIT', prices: {} };
        } else if (layoutPreset === 'aligned') {
            nodes.binance = { x: 0.4, y: 0.2, name: 'BINANCE', prices: {} };
            nodes.bybit = { x: 0.6, y: 0.2, name: 'BYBIT', prices: {} };
        } else {
            // Default to spider layout if unknown preset
            nodes.binance = { x: 0.15, y: 0.2, name: 'BINANCE', prices: {} };
            nodes.bybit = { x: 0.85, y: 0.2, name: 'BYBIT', prices: {} };
        }

        // Initialize exchange prices
        activeSymbols.forEach(symbol => {
            nodes.binance.prices[symbol] = 0;
            nodes.bybit.prices[symbol] = 0;
        });
    }

    // Create asset nodes based on layout preset
    if (layoutPreset === 'spider') {
        // Spider: Assets in middle (circular or grid)
        activeSymbols.forEach((symbol, index) => {
            let x, y;

            if (numAssets === 1) {
                x = 0.5;
                y = 0.5;
            } else if (numAssets === 2) {
                x = 0.3 + (index * 0.4);
                y = 0.6;
            } else if (numAssets === 3) {
                if (index === 0) { x = 0.5; y = 0.3; }
                else if (index === 1) { x = 0.3; y = 0.6; }
                else { x = 0.7; y = 0.6; }
            } else {
                // Circular layout for 4+ assets
                const angle = (index / numAssets) * Math.PI * 2 - Math.PI / 2;
                const radius = 0.25;
                x = 0.5 + Math.cos(angle) * radius;
                y = 0.5 + Math.sin(angle) * radius;
            }

            nodes[symbol.toLowerCase()] = {
                x, y,
                name: symbol,
                spread: 0,
                lastUpdate: 0
            };
        });

    } else if (layoutPreset === 'centered') {
        // Centered: Assets in a circle around the center
        activeSymbols.forEach((symbol, index) => {
            const angle = (index / numAssets) * Math.PI * 2 - Math.PI / 2;
            const radius = 0.3;
            const x = 0.5 + Math.cos(angle) * radius;
            const y = 0.5 + Math.sin(angle) * radius;

            nodes[symbol.toLowerCase()] = {
                x, y,
                name: symbol,
                spread: 0,
                lastUpdate: 0
            };
        });

    } else if (layoutPreset === 'aligned') {
        // Aligned: Assets horizontally aligned below exchanges
        activeSymbols.forEach((symbol, index) => {
            let x, y;

            if (numAssets === 1) {
                x = 0.5;
                y = 0.7;
            } else if (numAssets === 2) {
                x = 0.4 + (index * 0.2);
                y = 0.7;
            } else {
                // Spread horizontally
                const spacing = Math.min(0.8 / (numAssets - 1), 0.15);
                const startX = 0.5 - ((numAssets - 1) * spacing / 2);
                x = startX + index * spacing;
                y = 0.7;
            }

            nodes[symbol.toLowerCase()] = {
                x, y,
                name: symbol,
                spread: 0,
                lastUpdate: 0
            };
        });
    }

    return nodes;
}

// Node positions - web layout
let nodes = generateNodes();

// Trade notifications system
class TradeNotification {
    constructor(exchange, symbol, quantity, timestamp, isBuy) {
        this.exchange = exchange; // 'binance' or 'bybit'
        this.symbol = symbol;
        this.quantity = quantity;
        this.timestamp = timestamp;
        this.isBuy = isBuy; // true for buy, false for sell
        this.createdAt = performance.now();
        this.duration = 2000 / playbackSpeed; // 2 seconds (adjusted by playback speed)
    }

    isExpired(currentTime) {
        return (currentTime - this.createdAt) >= this.duration;
    }

    getOpacity(currentTime) {
        const elapsed = currentTime - this.createdAt;
        const progress = elapsed / this.duration;

        // Fade out in the last 500ms
        if (progress > 0.75) {
            return 1 - ((progress - 0.75) / 0.25);
        }
        return 1;
    }

    getYOffset(currentTime) {
        const elapsed = currentTime - this.createdAt;
        const progress = Math.min(elapsed / this.duration, 1);

        // Move up slowly over time
        return progress * -30; // Move up 30 pixels over the duration
    }
}

// Store notifications for each exchange (max 5 per exchange)
const tradeNotifications = {
    binance: [],
    bybit: []
};
const MAX_NOTIFICATIONS = 5;

// Add a trade notification
function addTradeNotification(exchange, symbol, quantity, isBuy) {
    // Skip if notifications are disabled for performance
    if (disableTradeNotifications) return;

    const notification = new TradeNotification(exchange, symbol, quantity, Date.now(), isBuy);

    // Add to the list
    tradeNotifications[exchange].push(notification);

    // Keep only the most recent MAX_NOTIFICATIONS
    if (tradeNotifications[exchange].length > MAX_NOTIFICATIONS) {
        tradeNotifications[exchange].shift(); // Remove oldest
    }
}

// Clean up expired notifications
function cleanupNotifications(currentTime) {
    Object.keys(tradeNotifications).forEach(exchange => {
        tradeNotifications[exchange] = tradeNotifications[exchange].filter(
            notification => !notification.isExpired(currentTime)
        );
    });
}

// Trade particles
class TradeParticle {
    constructor(exchange, asset, price, quantity, isBuy) {
        this.exchange = exchange;
        this.asset = asset;
        this.price = price;
        this.quantity = quantity;
        this.isBuy = isBuy;
        this.progress = 0;
        this.speed = 0.015;

        // Calculate size based on USD value
        const usdValue = quantity * price;
        this.size = Math.min(Math.log(usdValue + 1) * 2.5, 15);
        this.opacity = 1;

        // Get start node based on aggregation setting
        let startNode;
        if (aggregateExchanges) {
            startNode = nodes.exchange;
        } else {
            startNode = nodes[exchange];
        }

        const endNode = nodes[asset.toLowerCase()];

        if (startNode && endNode) {
            this.startX = startNode.x * canvasWidth;
            this.startY = startNode.y * canvasHeight;
            this.endX = endNode.x * canvasWidth;
            this.endY = endNode.y * canvasHeight;
        } else {
            // Fallback if nodes not found
            this.startX = 0;
            this.startY = 0;
            this.endX = 0;
            this.endY = 0;
        }
    }

    update() {
        this.progress += this.speed;
        if (this.progress > 0.6) {
            this.opacity = Math.max(0, 1 - (this.progress - 0.6) / 0.4);
        }
        return this.progress < 1;
    }

    draw() {
        // Update positions based on current canvas size
        let startNode;
        if (aggregateExchanges) {
            startNode = nodes.exchange;
        } else {
            startNode = nodes[this.exchange];
        }

        const endNode = nodes[this.asset.toLowerCase()];
        if (!startNode || !endNode) return; // Safety check

        this.startX = startNode.x * canvasWidth;
        this.startY = startNode.y * canvasHeight;
        this.endX = endNode.x * canvasWidth;
        this.endY = endNode.y * canvasHeight;

        const x = this.startX + (this.endX - this.startX) * this.progress;
        const y = this.startY + (this.endY - this.startY) * this.progress;

        tradesCtx.beginPath();
        tradesCtx.arc(x, y, this.size, 0, Math.PI * 2);
        const color = this.isBuy ? '0, 255, 100' : '255, 50, 50';
        tradesCtx.fillStyle = `rgba(${color}, ${this.opacity})`;

        // Apply glow effect if enabled
        if (showTradeGlow) {
            tradesCtx.shadowBlur = 10;
            tradesCtx.shadowColor = `rgba(${color}, ${this.opacity * 0.5})`;
        }

        tradesCtx.fill();

        // Reset shadow
        if (showTradeGlow) {
            tradesCtx.shadowBlur = 0;
        }
    }
}

const tradeParticles = [];
let MAX_PARTICLES = parseInt(localStorage.getItem('maxParticles')) || 500; // Limit for performance

// Initialize data structures dynamically
let tradeCounts = {};
let volumeAccumulator = {};
const priceHistory = {};
const lastPrices = {
    binance: {},
    bybit: {}
};

activeSymbols.forEach(symbol => {
    tradeCounts[symbol] = 0;
    volumeAccumulator[symbol] = 0;
    priceHistory[symbol] = [];
    lastPrices.binance[symbol] = 0;
    lastPrices.bybit[symbol] = 0;
});

const VOLATILITY_WINDOW_MS = 10000; // 10 seconds

// WebSocket connections - will be stored dynamically
let binanceWebSockets = {};
let bybitWs;

// Clock base time for replay mode (must be before lastTradeEventTime)
let clockBaseRealTime = Date.now();
let clockBaseVirtualTime = performance.now();

// Last trade event timestamp (high-resolution) - uses virtual time
let lastTradeEventTime = performance.now();
let previousTradeEventTime = performance.now();

// Store last 100 deltas for statistics
const deltaHistory = [];
const MAX_DELTA_HISTORY = 100;

// Performance settings
let playbackSpeed = parseFloat(localStorage.getItem('playbackSpeed')) || 1.0; // 0.25, 0.5, 0.75, 1.0
let tradeAggregationMs = parseInt(localStorage.getItem('tradeAggregationMs')) || 0; // 0-1000ms
let replayBufferLimitSeconds = parseInt(localStorage.getItem('replayBufferLimitSeconds')) || 60; // Replay buffer limit in seconds
let disableBackgroundEffects = localStorage.getItem('disableBackgroundEffects') === 'true';
let disableTradeNotifications = localStorage.getItem('disableTradeNotifications') === 'true';
let targetFPS = parseInt(localStorage.getItem('targetFPS')) || 60;

// Trade aggregation buffer
const tradeBuffer = {
    binance: {},
    bybit: {}
};
let aggregationTimeout = null;

// Replay system
const replayBuffer = []; // Array of {timestamp, exchange, symbol, price, quantity, isBuy}
let replayStartTime = null; // When we started replaying
let firstEventTimestamp = null; // Timestamp of first event in current replay session
let replayTimeoutId = null;
let isReplayMode = false;

// Virtual time system for replay mode
let virtualTimeOffset = 0; // Offset to add to real time
let lastRealTime = null; // Last real time we updated virtual time
let lastVirtualTime = null; // Last virtual time value

// Get current time (virtual in replay mode, real in live mode)
function getVirtualTime() {
    const realTime = performance.now();

    if (playbackSpeed >= 1.0) {
        // Live mode: return real time
        lastRealTime = realTime;
        lastVirtualTime = realTime;
        virtualTimeOffset = 0;
        return realTime;
    } else {
        // Replay mode: time moves slower
        if (lastRealTime === null) {
            // Initialize
            lastRealTime = realTime;
            lastVirtualTime = realTime;
            virtualTimeOffset = 0;
        }

        const realDelta = realTime - lastRealTime;
        const virtualDelta = realDelta * playbackSpeed; // Slow down time
        lastVirtualTime = lastVirtualTime + virtualDelta;
        lastRealTime = realTime;

        return lastVirtualTime;
    }
}

// Reset virtual time when switching modes
function resetVirtualTime() {
    const now = performance.now();
    lastRealTime = now;
    lastVirtualTime = now;
    virtualTimeOffset = 0;

    // Reset clock base times
    clockBaseRealTime = Date.now();
    clockBaseVirtualTime = now;
}

// Add event to replay buffer
function addToReplayBuffer(exchange, symbol, price, quantity, isBuy) {
    const now = performance.now();
    replayBuffer.push({
        timestamp: now,
        exchange,
        symbol,
        price,
        quantity,
        isBuy
    });

    // Clean old events from buffer
    const cutoffTime = now - (replayBufferLimitSeconds * 1000);
    while (replayBuffer.length > 0 && replayBuffer[0].timestamp < cutoffTime) {
        replayBuffer.shift();
    }
}

// Clear replay buffer and stop replay
function clearReplayBuffer() {
    replayBuffer.length = 0;
    replayStartTime = null;
    firstEventTimestamp = null;
    if (replayTimeoutId) {
        clearTimeout(replayTimeoutId);
        replayTimeoutId = null;
    }
    resetVirtualTime();
    console.log('[REPLAY] Buffer cleared, switching to live mode');
}

// Start replay mode
function startReplayMode() {
    if (isReplayMode) return;

    isReplayMode = true;
    replayStartTime = null; // Will be set when we start processing
    firstEventTimestamp = null;
    resetVirtualTime();
    console.log('[REPLAY] Starting replay mode at speed', playbackSpeed);
    processReplayBuffer();
}

// Stop replay mode and switch to live
function stopReplayMode() {
    if (!isReplayMode) return;

    isReplayMode = false;
    clearReplayBuffer();
    resetVirtualTime();
    console.log('[REPLAY] Stopped, switching to live mode');
}

// Process events from replay buffer
function processReplayBuffer() {
    if (!isReplayMode || playbackSpeed >= 1.0) return;

    const now = performance.now();

    // Initialize replay start time on first call
    if (replayStartTime === null && replayBuffer.length > 0) {
        replayStartTime = now;
        firstEventTimestamp = replayBuffer[0].timestamp;
        console.log('[REPLAY] Initialized replay at', now, 'first event at', firstEventTimestamp);
    }

    // Process all events that should have been played by now
    let eventsProcessed = 0;
    while (replayBuffer.length > 0) {
        const event = replayBuffer[0];

        // Calculate when this event should be played in replay time
        const deltaFromFirst = event.timestamp - firstEventTimestamp; // Real time delta
        const replayDelta = deltaFromFirst / playbackSpeed; // Adjusted for playback speed
        const playTime = replayStartTime + replayDelta;

        // Check if it's time to play this event
        if (now >= playTime) {
            replayBuffer.shift(); // Remove from buffer

            // Process the event
            executeTradeProcessing(
                event.exchange,
                event.symbol,
                event.price,
                event.quantity,
                event.isBuy
            );

            eventsProcessed++;

            // Limit events per cycle to avoid blocking
            if (eventsProcessed >= 50) break;
        } else {
            // Events are time-ordered, so if this one isn't ready, none of the rest are
            break;
        }
    }

    // If buffer is empty, reset for next batch
    if (replayBuffer.length === 0) {
        replayStartTime = null;
        firstEventTimestamp = null;
    }

    // Schedule next replay cycle
    const nextInterval = Math.max(10, 16); // Run at roughly 60fps
    replayTimeoutId = setTimeout(processReplayBuffer, nextInterval);
}

// Handle incoming trade event (live or buffered)
function handleTradeEvent(exchange, symbol, price, quantity, isBuy) {
    if (playbackSpeed >= 1.0) {
        // Live mode: process with aggregation if enabled
        processTrade(exchange, symbol, price, quantity, isBuy);
    } else {
        // Replay mode: add to buffer
        addToReplayBuffer(exchange, symbol, price, quantity, isBuy);

        // Start replay if not already running
        if (!isReplayMode) {
            startReplayMode();
        }
    }
}

function calculateSpreadBP(binancePrice, bybitPrice) {
    if (!binancePrice || !bybitPrice || binancePrice === 0 || bybitPrice === 0) return 0;
    const spread = ((binancePrice - bybitPrice) / bybitPrice * 10000);
    if (!isFinite(spread) || isNaN(spread)) return 0;
    return spread.toFixed(2);
}

// Calculate volatility in basis points using returns
function calculateVolatility(prices) {
    if (!prices || prices.length < 2) return '0.00';

    // Calculate returns: (price_current - price_previous) / price_previous
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i - 1] === 0) continue; // Avoid division by zero
        const returnValue = (prices[i] - prices[i - 1]) / prices[i - 1];
        if (isFinite(returnValue)) { // Only add valid returns
            returns.push(returnValue);
        }
    }

    if (returns.length === 0) return '0.00';

    // Calculate mean of returns
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate standard deviation of returns
    const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Convert to basis points (1 BP = 0.01%)
    const volatilityBP = stdDev * 10000;

    // Return 0 if result is NaN or infinite
    if (!isFinite(volatilityBP)) return '0.00';
    return volatilityBP.toFixed(2);
}

// Format large numbers with K/M suffix
function formatVolume(value) {
    if (!isFinite(value) || isNaN(value)) return '$0';

    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    } else if (value >= 1000) {
        return '$' + (value / 1000).toFixed(2) + 'K';
    }
    return '$' + value.toFixed(2);
}

// Track price for volatility calculation
function trackPrice(asset, price) {
    const now = Date.now();
    priceHistory[asset].push({ price, timestamp: now });

    // Remove prices older than the window
    priceHistory[asset] = priceHistory[asset].filter(
        entry => now - entry.timestamp <= VOLATILITY_WINDOW_MS
    );
}

// Process trade with aggregation support
function processTrade(exchange, symbol, price, quantity, isBuy) {
    if (tradeAggregationMs === 0) {
        // No aggregation, process immediately
        executeTradeProcessing(exchange, symbol, price, quantity, isBuy);
    } else {
        // Buffer the trade
        const key = `${exchange}_${symbol}`;
        if (!tradeBuffer[exchange][key]) {
            tradeBuffer[exchange][key] = {
                symbol,
                totalQuantity: 0,
                lastPrice: price,
                trades: [],
                buyCount: 0,
                sellCount: 0
            };
        }

        const buffer = tradeBuffer[exchange][key];
        buffer.totalQuantity += quantity;
        buffer.lastPrice = price;
        buffer.trades.push({ price, quantity, isBuy });
        if (isBuy) buffer.buyCount++;
        else buffer.sellCount++;

        // Schedule flush
        if (!aggregationTimeout) {
            aggregationTimeout = setTimeout(() => {
                flushTradeBuffer();
            }, tradeAggregationMs / playbackSpeed); // Adjust by playback speed
        }
    }
}

// Flush aggregated trades
function flushTradeBuffer() {
    Object.entries(tradeBuffer).forEach(([exchange, buffers]) => {
        Object.entries(buffers).forEach(([key, buffer]) => {
            if (buffer.trades.length > 0) {
                // Determine if it's mostly buy or sell
                const isBuy = buffer.buyCount >= buffer.sellCount;

                // Process aggregated trade
                executeTradeProcessing(
                    exchange,
                    buffer.symbol,
                    buffer.lastPrice,
                    buffer.totalQuantity,
                    isBuy
                );
            }
        });
    });

    // Clear buffers
    tradeBuffer.binance = {};
    tradeBuffer.bybit = {};
    aggregationTimeout = null;
}

// Execute actual trade processing
function executeTradeProcessing(exchange, symbol, price, quantity, isBuy) {
    const symbolLower = symbol.toLowerCase();

    // Update prices
    lastPrices[exchange][symbol] = price;

    if (aggregateExchanges) {
        // In aggregated mode, update the single exchange node
        if (nodes.exchange) {
            nodes.exchange.prices[symbol] = price;
        }
        // No spread calculation in aggregated mode
    } else {
        // Normal mode, update individual exchange nodes
        if (nodes[exchange]) {
            nodes[exchange].prices[symbol] = price;
        }

        // Update spreads
        const assetNode = nodes[symbolLower];
        if (assetNode) {
            assetNode.spread = calculateSpreadBP(lastPrices.binance[symbol], lastPrices.bybit[symbol]);
            assetNode.lastUpdate = Date.now();
        }
    }

    // Update counters
    tradeCounts[symbol]++;

    // Track volume and price
    volumeAccumulator[symbol] += quantity * price;
    trackPrice(symbol, price);

    // Add notification
    addTradeNotification(exchange, symbol, quantity, isBuy);

    // Add particle (with playback speed)
    if (tradeParticles.length < MAX_PARTICLES) {
        const particle = new TradeParticle(exchange, symbol, price, quantity, isBuy);
        particle.speed = particle.speed * playbackSpeed; // Adjust particle speed
        tradeParticles.push(particle);
    }

    // Play sound (with playback speed affecting timing)
    if (exchange === 'binance') {
        playBinanceSound();
    } else {
        playBybitSound();
    }
}

// Dynamic Binance WebSocket connection
function connectBinance(symbol) {
    const symbolLower = symbol.toLowerCase();
    const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbolLower}usdt@trade`);

    ws.onmessage = (event) => {
        // Update last trade event time and calculate delta using virtual time
        const currentTime = getVirtualTime();
        const eventDelta = currentTime - lastTradeEventTime;

        // Store delta in history
        deltaHistory.push(eventDelta);
        if (deltaHistory.length > MAX_DELTA_HISTORY) {
            deltaHistory.shift(); // Remove oldest
        }

        previousTradeEventTime = lastTradeEventTime;
        lastTradeEventTime = currentTime;

        const trade = JSON.parse(event.data);
        const price = parseFloat(trade.p);
        const quantity = parseFloat(trade.q);
        const isBuy = trade.m === false; // m is 'is maker', false means taker (buyer)

        // Handle trade (live or replay mode)
        handleTradeEvent('binance', symbol, price, quantity, isBuy);
    };

    ws.onclose = () => setTimeout(() => connectBinance(symbol), 3000);

    binanceWebSockets[symbol] = ws;
}

// Bybit WebSocket - dynamic subscription
function connectBybit() {
    bybitWs = new WebSocket('wss://stream.bybit.com/v5/public/linear');

    bybitWs.onopen = () => {
        // Subscribe to all active symbols
        const subscriptions = activeSymbols.map(symbol => `publicTrade.${symbol}USDT`);
        bybitWs.send(JSON.stringify({
            op: 'subscribe',
            args: subscriptions
        }));
    };

    bybitWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.topic && data.topic.startsWith('publicTrade.') && data.data) {
            // Update last trade event time and calculate delta using virtual time
            const currentTime = getVirtualTime();
            const eventDelta = currentTime - lastTradeEventTime;

            // Store delta in history
            deltaHistory.push(eventDelta);
            if (deltaHistory.length > MAX_DELTA_HISTORY) {
                deltaHistory.shift(); // Remove oldest
            }

            previousTradeEventTime = lastTradeEventTime;
            lastTradeEventTime = currentTime;

            const symbol = data.topic.split('.')[1].replace('USDT', '');

            // Check if this symbol is still active
            if (!activeSymbols.includes(symbol)) return;

            data.data.forEach(trade => {
                const price = parseFloat(trade.p);
                const quantity = parseFloat(trade.v);
                const isBuy = trade.S === 'Buy';

                // Handle trade (live or replay mode)
                handleTradeEvent('bybit', symbol, price, quantity, isBuy);
            });
        }
    };

    bybitWs.onclose = () => setTimeout(connectBybit, 3000);
}

// Draw functions
function drawNode(node, x, y, radius, label, price, spread) {
    // Node circle
    tradesCtx.beginPath();
    tradesCtx.arc(x, y, radius, 0, Math.PI * 2);
    tradesCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    tradesCtx.fill();
    tradesCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    tradesCtx.lineWidth = 2;
    tradesCtx.stroke();

    // Label
    tradesCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    tradesCtx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI"';
    tradesCtx.textAlign = 'center';
    tradesCtx.fillText(label, x, y - 5);

    // Price or spread
    if (price) {
        tradesCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI"';
        tradesCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        tradesCtx.fillText(`$${price.toFixed(2)}`, x, y + 15);
    } else if (spread !== undefined && spread !== 0) {
        tradesCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI"';
        const spreadColor = spread > 0 ? 'rgba(0, 255, 100, 0.9)' : 'rgba(255, 50, 50, 0.9)';
        tradesCtx.fillStyle = spreadColor;
        tradesCtx.fillText(`${spread} BP`, x, y + 15);
    }
}

function drawConnection(x1, y1, x2, y2) {
    tradesCtx.beginPath();
    tradesCtx.moveTo(x1, y1);
    tradesCtx.lineTo(x2, y2);
    tradesCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    tradesCtx.lineWidth = 1;
    tradesCtx.stroke();
}

// Update trade stats every second - dynamic
setInterval(() => {
    activeSymbols.forEach(symbol => {
        const symbolLower = symbol.toLowerCase();

        // Update trade counts
        const countEl = document.getElementById(`${symbolLower}Count`);
        if (countEl) {
            const count = tradeCounts[symbol] || 0;
            countEl.textContent = isNaN(count) ? 0 : count;
        }

        // Update volume
        const volumeEl = document.getElementById(`${symbolLower}Volume`);
        if (volumeEl) {
            const volume = volumeAccumulator[symbol] || 0;
            volumeEl.textContent = isNaN(volume) ? '$0' : formatVolume(volume);
        }

        // Update volatility
        const volatilityEl = document.getElementById(`${symbolLower}Volatility`);
        if (volatilityEl) {
            const prices = (priceHistory[symbol] || []).map(entry => entry.price);
            const vol = calculateVolatility(prices);
            volatilityEl.textContent = isNaN(vol) || vol === 'NaN' ? '0' : vol;
        }

        // Reset counters
        tradeCounts[symbol] = 0;
        volumeAccumulator[symbol] = 0;
    });
}, 1000);

// Animation loop with FPS optimization
let lastFrameTime = Date.now();
let frameDelay = 1000 / targetFPS;

function animateTrades() {
    const now = Date.now();
    const perfNow = performance.now();
    const elapsed = now - lastFrameTime;

    // Update frame delay based on current targetFPS
    frameDelay = 1000 / targetFPS;

    if (elapsed < frameDelay) {
        requestAnimationFrame(animateTrades);
        return;
    }

    lastFrameTime = now - (elapsed % frameDelay);

    tradesCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Calculate positions
    const positions = {};
    Object.entries(nodes).forEach(([key, node]) => {
        positions[key] = {
            x: node.x * canvasWidth,
            y: node.y * canvasHeight
        };
    });

    // Draw all connections (spider web) - dynamic
    // Batch all connection draws for better performance
    tradesCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    tradesCtx.lineWidth = 1;
    tradesCtx.beginPath();

    if (aggregateExchanges) {
        // Aggregated: Connect single exchange node to all assets
        if (positions.exchange) {
            activeSymbols.forEach(symbol => {
                const assetKey = symbol.toLowerCase();
                if (positions[assetKey]) {
                    tradesCtx.moveTo(positions.exchange.x, positions.exchange.y);
                    tradesCtx.lineTo(positions[assetKey].x, positions[assetKey].y);
                }
            });
        }
    } else {
        // Separate exchanges: Connect both exchanges to assets
        activeSymbols.forEach(symbol => {
            const assetKey = symbol.toLowerCase();
            if (positions[assetKey]) {
                if (positions.binance) {
                    tradesCtx.moveTo(positions.binance.x, positions.binance.y);
                    tradesCtx.lineTo(positions[assetKey].x, positions[assetKey].y);
                }
                if (positions.bybit) {
                    tradesCtx.moveTo(positions.bybit.x, positions.bybit.y);
                    tradesCtx.lineTo(positions[assetKey].x, positions[assetKey].y);
                }
            }
        });
    }

    // Connect assets to each other (only if enabled)
    if (showCryptoConnections) {
        for (let i = 0; i < activeSymbols.length; i++) {
            for (let j = i + 1; j < activeSymbols.length; j++) {
                const key1 = activeSymbols[i].toLowerCase();
                const key2 = activeSymbols[j].toLowerCase();
                if (positions[key1] && positions[key2]) {
                    tradesCtx.moveTo(positions[key1].x, positions[key1].y);
                    tradesCtx.lineTo(positions[key2].x, positions[key2].y);
                }
            }
        }
    }

    tradesCtx.stroke();

    // Update and draw particles (batch removal for performance)
    const particlesToRemove = [];
    for (let i = 0; i < tradeParticles.length; i++) {
        const particle = tradeParticles[i];
        if (!particle.update()) {
            particlesToRemove.push(i);
        } else {
            particle.draw();
        }
    }

    // Remove dead particles in reverse order
    for (let i = particlesToRemove.length - 1; i >= 0; i--) {
        tradeParticles.splice(particlesToRemove[i], 1);
    }

    // Draw nodes
    if (aggregateExchanges) {
        // Draw single aggregated exchange node
        if (positions.exchange) {
            drawNode(nodes.exchange, positions.exchange.x, positions.exchange.y, 40, 'EXCHANGES');
        }
    } else {
        // Draw separate exchange nodes
        if (positions.binance) {
            drawNode(nodes.binance, positions.binance.x, positions.binance.y, 40, 'BINANCE');
        }
        if (positions.bybit) {
            drawNode(nodes.bybit, positions.bybit.x, positions.bybit.y, 40, 'BYBIT');
        }
    }

    // Draw asset nodes with prices - dynamic
    activeSymbols.forEach(symbol => {
        let avgPrice;

        if (aggregateExchanges) {
            avgPrice = nodes.exchange.prices[symbol] || 0;
        } else {
            const binancePrice = nodes.binance.prices[symbol] || 0;
            const bybitPrice = nodes.bybit.prices[symbol] || 0;
            if (binancePrice > 0 && bybitPrice > 0) {
                avgPrice = (binancePrice + bybitPrice) / 2;
            }
        }

        if (avgPrice > 0) {
            const assetKey = symbol.toLowerCase();
            const node = nodes[assetKey];
            const pos = positions[assetKey];
            if (node && pos) {
                drawNode(node, pos.x, pos.y, 50, symbol, avgPrice);
            }
        }
    });

    // Draw spreads on asset nodes - dynamic (only if enabled and not aggregated)
    if (showSpreadInfo && !aggregateExchanges) {
        activeSymbols.forEach(symbol => {
            const assetKey = symbol.toLowerCase();
            const node = nodes[assetKey];
            if (node && node.spread !== 0 && Date.now() - node.lastUpdate < 5000) {
                const pos = positions[assetKey];
                if (pos) {
                    tradesCtx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI"';
                    const spread = parseFloat(node.spread);
                    const spreadColor = spread > 0 ? 'rgba(0, 255, 100, 0.9)' : 'rgba(255, 50, 50, 0.9)';
                    tradesCtx.fillStyle = spreadColor;
                    tradesCtx.textAlign = 'center';
                    const spreadText = isNaN(spread) ? '0 BP' : `${node.spread} BP`;
                    tradesCtx.fillText(spreadText, pos.x, pos.y + 35);
                }
            }
        });
    }

    // Draw trade notifications above exchanges
    drawTradeNotifications(perfNow, positions);

    // Clean up expired notifications
    cleanupNotifications(perfNow);

    requestAnimationFrame(animateTrades);
}

// Draw trade notifications above exchange nodes
function drawTradeNotifications(currentTime, positions) {
    // In aggregated mode, merge all notifications to the single exchange node
    if (aggregateExchanges) {
        const exchangePos = positions.exchange;
        if (!exchangePos) return;

        // Merge notifications from both exchanges
        const allNotifications = [
            ...tradeNotifications.binance,
            ...tradeNotifications.bybit
        ].sort((a, b) => a.createdAt - b.createdAt); // Sort by time

        // Draw up to MAX_NOTIFICATIONS
        const limitedNotifications = allNotifications.slice(-MAX_NOTIFICATIONS);

        limitedNotifications.forEach((notification, index) => {
            const opacity = notification.getOpacity(currentTime);
            const yOffset = notification.getYOffset(currentTime);

            // Stack notifications
            const stackOffset = index * 25;
            const baseYOffset = -60;
            const finalY = exchangePos.y + baseYOffset - stackOffset + yOffset;

            // Format quantity
            let formattedQty;
            if (notification.quantity >= 1) {
                formattedQty = notification.quantity.toFixed(2);
            } else if (notification.quantity >= 0.01) {
                formattedQty = notification.quantity.toFixed(4);
            } else {
                formattedQty = notification.quantity.toFixed(6);
            }

            const prefix = notification.isBuy ? '+' : '-';
            const quantityText = `${prefix}${formattedQty} ${notification.symbol}`;
            const color = notification.isBuy ? 'rgba(0, 255, 100, 0.95)' : 'rgba(255, 50, 50, 0.95)';

            tradesCtx.save();
            tradesCtx.globalAlpha = opacity;

            // Shadow
            tradesCtx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI"';
            tradesCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            tradesCtx.textAlign = 'center';
            tradesCtx.fillText(quantityText, exchangePos.x + 1, finalY + 1);

            // Text
            tradesCtx.fillStyle = color;
            tradesCtx.fillText(quantityText, exchangePos.x, finalY);

            tradesCtx.restore();
        });
        return;
    }

    // Normal mode: separate notifications for each exchange
    Object.entries(tradeNotifications).forEach(([exchange, notifications]) => {
        if (notifications.length === 0) return;

        const exchangePos = positions[exchange];
        if (!exchangePos) return;

        // Draw each notification, stacked from bottom to top
        notifications.forEach((notification, index) => {
            const opacity = notification.getOpacity(currentTime);
            const yOffset = notification.getYOffset(currentTime);

            // Stack notifications (newer ones push older ones up)
            const stackOffset = index * 25; // 25 pixels MaxSafe each notification
            const baseYOffset = -60; // Start 60 pixels above the exchange node
            const finalY = exchangePos.y + baseYOffset - stackOffset + yOffset;

            // Format quantity (adjust decimals based on size)
            let formattedQty;
            if (notification.quantity >= 1) {
                formattedQty = notification.quantity.toFixed(2);
            } else if (notification.quantity >= 0.01) {
                formattedQty = notification.quantity.toFixed(4);
            } else {
                formattedQty = notification.quantity.toFixed(6);
            }

            // Prefix with + for buy, - for sell
            const prefix = notification.isBuy ? '+' : '-';
            const quantityText = `${prefix}${formattedQty} ${notification.symbol}`;

            // Color: green for buy, red for sell
            const color = notification.isBuy ? 'rgba(0, 255, 100, 0.95)' : 'rgba(255, 50, 50, 0.95)';

            // Draw text with shadow for better visibility
            tradesCtx.save();
            tradesCtx.globalAlpha = opacity;

            // Shadow
            tradesCtx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI"';
            tradesCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            tradesCtx.textAlign = 'center';
            tradesCtx.fillText(quantityText, exchangePos.x + 1, finalY + 1);

            // Text (green for buy, red for sell)
            tradesCtx.fillStyle = color;
            tradesCtx.fillText(quantityText, exchangePos.x, finalY);

            tradesCtx.restore();
        });
    });
}

// Initialize timestamps
lastTradeEventTime = getVirtualTime();
previousTradeEventTime = lastTradeEventTime;

// Start everything - but only when live section is visible (lazy loading)
let tradesInitialized = false;

function initializeTrades() {
    if (tradesInitialized) return;
    tradesInitialized = true;

    console.log('[TRADES] Initializing WebSocket connections...');

    activeSymbols.forEach(symbol => {
        connectBinance(symbol);
    });
    connectBybit();
    animateTrades();
}

// Check if we're already in the live section
const liveSectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        console.log('[TRADES] Intersection observed:', entry.target.id, 'intersecting:', entry.isIntersecting, 'ratio:', entry.intersectionRatio);
        if (entry.target.id === 'live' && entry.isIntersecting) {
            console.log('[TRADES] Live section is visible, initializing trades...');
            initializeTrades();
        }
    });
}, { threshold: 0.01, rootMargin: '0px' }); // Lower threshold and no margin

const liveSectionForTrades = document.getElementById('live');
if (liveSectionForTrades) {
    console.log('[TRADES] Observing live section...');
    liveSectionObserver.observe(liveSectionForTrades);

    // Also check immediately if live section is visible (in case we load directly to it)
    setTimeout(() => {
        const rect = liveSectionForTrades.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        console.log('[TRADES] Initial check - Live section visible:', isVisible);
        if (isVisible) {
            console.log('[TRADES] Live section already visible, initializing immediately...');
            initializeTrades();
        }
    }, 100);
} else {
    console.error('[TRADES] Live section not found!');
}

// Cleanup
window.addEventListener('beforeunload', () => {
    // Close all Binance WebSockets
    Object.values(binanceWebSockets).forEach(ws => {
        if (ws) ws.close();
    });
    // Close Bybit WebSocket
    if (bybitWs) bybitWs.close();
});

// ============================================
// Symbol Management System
// ============================================

// Modal handlers
const menuBtn = document.getElementById('menuBtn');
const symbolsModal = document.getElementById('symbolsModal');
const symbolsModalClose = document.getElementById('symbolsModalClose');
const symbolsList = document.getElementById('symbolsList');
const addSymbolBtn = document.getElementById('addSymbolBtn');
const symbolInput = document.getElementById('symbolInput');

if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        symbolsModal.classList.add('active');
        renderSymbolsList();
    });
}

if (symbolsModalClose) {
    symbolsModalClose.addEventListener('click', () => {
        symbolsModal.classList.remove('active');
    });
}

// Close modal when clicking backdrop
const symbolsModalBackdrop = document.querySelector('.symbols-modal .modal-backdrop');
if (symbolsModalBackdrop) {
    symbolsModalBackdrop.addEventListener('click', () => {
        symbolsModal.classList.remove('active');
    });
}

// Render symbols list
function renderSymbolsList() {
    symbolsList.innerHTML = '';
    activeSymbols.forEach(symbol => {
        const item = document.createElement('div');
        item.className = 'symbol-item';
        item.innerHTML = `
            <span class="symbol-name">${symbol}</span>
            <button class="remove-btn" data-symbol="${symbol}">Remove</button>
        `;
        symbolsList.appendChild(item);
    });

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const symbol = e.target.getAttribute('data-symbol');
            removeSymbol(symbol);
        });
    });
}

// Save to localStorage and reload
function saveAndReload() {
    localStorage.setItem('activeSymbols', JSON.stringify(activeSymbols));
    window.location.reload();
}

// Add symbol
function addSymbol() {
    const symbol = symbolInput.value.trim().toUpperCase();

    if (!symbol) {
        alert('Please enter a symbol');
        return;
    }

    if (activeSymbols.includes(symbol)) {
        alert('Symbol already exists');
        return;
    }

    if (activeSymbols.length >= 10) {
        alert('Maximum 10 symbols allowed');
        return;
    }

    activeSymbols.push(symbol);
    symbolInput.value = '';
    saveAndReload();
}

// Remove symbol
function removeSymbol(symbol) {
    if (activeSymbols.length <= 1) {
        alert('At least one symbol must remain');
        return;
    }

    activeSymbols = activeSymbols.filter(s => s !== symbol);
    saveAndReload();
}

// Add symbol button handler
if (addSymbolBtn) {
    addSymbolBtn.addEventListener('click', addSymbol);
}

// Add symbol on Enter key
if (symbolInput) {
    symbolInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSymbol();
        }
    });
}

// ============================================
// Live Clock
// ============================================

const clockDate = document.getElementById('clockDate');
const clockTime = document.getElementById('clockTime');
const clockDelta = document.getElementById('clockDelta');

// Pad numbers with leading zeros
function pad(num, size) {
    let s = num.toString();
    while (s.length < size) s = '0' + s;
    return s;
}

// Calculate statistics for delta history
function calculateDeltaStats() {
    if (deltaHistory.length === 0) {
        return { mean: 0, stdDev: 0 };
    }

    // Calculate mean
    const mean = deltaHistory.reduce((sum, delta) => sum + delta, 0) / deltaHistory.length;

    // Calculate standard deviation
    const squaredDiffs = deltaHistory.map(delta => Math.pow(delta - mean, 2));
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / deltaHistory.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
}

// Update clock at high frequency (every 10ms for smooth milliseconds)
function updateClock() {
    // Get virtual time (slower in replay mode)
    const virtualTime = getVirtualTime();

    // Calculate virtual date/time based on clock base + virtual time delta
    const virtualTimeDelta = virtualTime - clockBaseVirtualTime; // How much virtual time has passed
    const virtualTimestamp = clockBaseRealTime + virtualTimeDelta; // Real timestamp + virtual delta
    const now = new Date(virtualTimestamp);

    // Date: DD/MM/YYYY
    const day = pad(now.getDate(), 2);
    const month = pad(now.getMonth() + 1, 2);
    const year = now.getFullYear();

    // Time: HH:MM:SS.mmm.µµµ
    const hours = pad(now.getHours(), 2);
    const minutes = pad(now.getMinutes(), 2);
    const seconds = pad(now.getSeconds(), 2);
    const milliseconds = pad(now.getMilliseconds(), 3);

    // Get high-resolution microseconds from virtual time
    const microseconds = pad(Math.floor((virtualTime % 1) * 1000), 3);

    if (clockDate) {
        clockDate.textContent = `${day}/${month}/${year}`;
    }

    if (clockTime) {
        clockTime.textContent = `${hours}:${minutes}:${seconds}.${milliseconds}.${microseconds}`;
    }

    // Calculate delta since last trade event using virtual time
    if (clockDelta) {
        const deltaMs = virtualTime - lastTradeEventTime;

        // Convert to seconds, milliseconds, microseconds format
        const totalSeconds = Math.floor(deltaMs / 1000);
        const remainingMs = deltaMs % 1000;
        const deltaMilliseconds = pad(Math.floor(remainingMs), 3);
        const deltaMicroseconds = pad(Math.floor((remainingMs % 1) * 1000), 3);

        // Format as +S.mmm.µµµs
        clockDelta.textContent = `+${totalSeconds}.${deltaMilliseconds}.${deltaMicroseconds}s`;

        // Calculate dynamic thresholds based on delta history statistics
        if (deltaHistory.length >= 10) { // Need at least 10 samples
            const { mean, stdDev } = calculateDeltaStats();

            // Define color thresholds based on standard deviations from mean
            const yellowThreshold = mean + stdDev;
            const redThreshold = mean + (2 * stdDev);

            // Change color dynamically based on statistics
            if (deltaMs >= redThreshold) {
                clockDelta.style.color = 'rgba(255, 50, 50, 0.9)'; // Red: > mean + 2*stdDev
            } else if (deltaMs >= yellowThreshold) {
                clockDelta.style.color = 'rgba(255, 200, 0, 0.9)'; // Yellow: > mean + stdDev
            } else {
                clockDelta.style.color = 'rgba(0, 255, 100, 0.9)'; // Green: <= mean + stdDev
            }
        } else {
            // Fallback to fixed thresholds if not enough data
            if (deltaMs > 5000) {
                clockDelta.style.color = 'rgba(255, 50, 50, 0.9)'; // Red
            } else if (deltaMs > 1000) {
                clockDelta.style.color = 'rgba(255, 200, 0, 0.9)'; // Yellow
            } else {
                clockDelta.style.color = 'rgba(0, 255, 100, 0.9)'; // Green
            }
        }
    }
}

// Update clock every 10ms for smooth animation
setInterval(updateClock, 10);

// Initial update
updateClock();

// ============================================
// 8-bit Audio System
// ============================================

// Audio context (lazy initialized on user interaction)
let audioContext = null;
let audioEnabled = false;
let audioVolume = parseFloat(localStorage.getItem('audioVolume')) || 0.5; // 0.0 to 1.0
let audioThrottleMs = parseInt(localStorage.getItem('audioThrottleMs')) || 0; // Minimum time MaxSafe sounds
let lastAudioPlayTime = 0; // Last time audio was played

// Audio button elements
const audioBtn = document.getElementById('audioBtn');
const audioOnIcon = document.getElementById('audioOnIcon');
const audioOffIcon = document.getElementById('audioOffIcon');

// Volume slider elements
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

// Audio throttle slider elements
const audioThrottleSlider = document.getElementById('audioThrottleSlider');
const audioThrottleValue = document.getElementById('audioThrottleValue');

// Initialize audio context (must be done after user gesture)
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Check if audio can be played (throttle check)
function canPlayAudio() {
    if (!audioEnabled) return false;

    const now = performance.now();

    // Check throttle
    if (audioThrottleMs > 0) {
        if (now - lastAudioPlayTime < audioThrottleMs) {
            return false; // Too soon, skip
        }
    }

    // Update last play time
    lastAudioPlayTime = now;
    return true;
}

// Generate 8-bit style sound for Binance (higher pitched beep)
function playBinanceSound() {
    if (!canPlayAudio()) return;

    // Initialize audio context if not already done
    if (!audioContext) {
        initAudioContext();
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // 8-bit square wave
    oscillator.type = 'square';

    // Binance: Quick ascending arpeggio (C5 -> E5)
    oscillator.frequency.setValueAtTime(523.25, now); // C5
    oscillator.frequency.setValueAtTime(659.25, now + 0.05); // E5

    // Volume envelope (quick attack and decay) with user volume control
    const maxVolume = 0.15 * audioVolume; // Scale by user volume preference
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(maxVolume, now + 0.01); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15); // Decay

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
}

// Generate 8-bit style sound for Bybit (lower pitched blip)
function playBybitSound() {
    if (!canPlayAudio()) return;

    // Initialize audio context if not already done
    if (!audioContext) {
        initAudioContext();
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // 8-bit square wave
    oscillator.type = 'square';

    // Bybit: Quick descending arpeggio (G4 -> C4)
    oscillator.frequency.setValueAtTime(392.00, now); // G4
    oscillator.frequency.setValueAtTime(261.63, now + 0.05); // C4

    // Volume envelope (quick attack and decay) with user volume control
    const maxVolume = 0.15 * audioVolume; // Scale by user volume preference
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(maxVolume, now + 0.01); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15); // Decay

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
}

// Toggle audio on/off
function toggleAudio() {
    audioEnabled = !audioEnabled;

    if (audioEnabled) {
        initAudioContext();
        audioBtn.classList.add('active');
        audioOnIcon.style.display = 'block';
        audioOffIcon.style.display = 'none';

        // Play test sound
        playBinanceSound();
    } else {
        audioBtn.classList.remove('active');
        audioOnIcon.style.display = 'none';
        audioOffIcon.style.display = 'block';
    }

    // Save preference to localStorage
    localStorage.setItem('audioEnabled', audioEnabled);
}

// Load audio preference from localStorage
const savedAudioPref = localStorage.getItem('audioEnabled');
if (savedAudioPref === 'true') {
    audioEnabled = true;
    if (audioBtn) audioBtn.classList.add('active');
    if (audioOnIcon) audioOnIcon.style.display = 'block';
    if (audioOffIcon) audioOffIcon.style.display = 'none';
    // Note: audioContext will be initialized on first sound play (after user interaction)
} else {
    audioEnabled = false;
    if (audioOnIcon) audioOnIcon.style.display = 'none';
    if (audioOffIcon) audioOffIcon.style.display = 'block';
}

// Audio button click handler
if (audioBtn) {
    audioBtn.addEventListener('click', toggleAudio);
}

// Initialize audio context on first user interaction if audio is enabled
if (audioEnabled && !audioContext) {
    const initOnInteraction = () => {
        initAudioContext();
        document.removeEventListener('click', initOnInteraction);
        document.removeEventListener('keydown', initOnInteraction);
    };
    document.addEventListener('click', initOnInteraction);
    document.addEventListener('keydown', initOnInteraction);
}

// Volume slider handler
if (volumeSlider && volumeValue) {
    // Set initial slider value from saved volume
    volumeSlider.value = Math.round(audioVolume * 100);
    volumeValue.textContent = `${Math.round(audioVolume * 100)}%`;

    volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        audioVolume = volume / 100; // Convert to 0-1 range
        volumeValue.textContent = `${volume}%`;

        // Save to localStorage
        localStorage.setItem('audioVolume', audioVolume.toString());

        // Play test sound if audio is enabled
        if (audioEnabled) {
            // Temporarily bypass throttle for testing
            const tempThrottle = audioThrottleMs;
            audioThrottleMs = 0;
            playBinanceSound();
            audioThrottleMs = tempThrottle;
        }
    });
}

// Audio throttle slider handler
if (audioThrottleSlider && audioThrottleValue) {
    // Set initial value from saved setting
    audioThrottleSlider.value = audioThrottleMs;
    audioThrottleValue.textContent = `${audioThrottleMs}ms`;

    audioThrottleSlider.addEventListener('input', (e) => {
        audioThrottleMs = parseInt(e.target.value);
        audioThrottleValue.textContent = `${audioThrottleMs}ms`;

        // Save to localStorage
        localStorage.setItem('audioThrottleMs', audioThrottleMs.toString());

        console.log('[AUDIO] Throttle set to', audioThrottleMs, 'ms');
    });
}

// ============================================
// Performance Settings
// ============================================

// Replay buffer limit slider handler
const replayBufferSlider = document.getElementById('replayBufferSlider');
const replayBufferValue = document.getElementById('replayBufferValue');

if (replayBufferSlider && replayBufferValue) {
    // Set initial value from saved setting
    replayBufferSlider.value = replayBufferLimitSeconds;
    replayBufferValue.textContent = `${replayBufferLimitSeconds}s`;

    replayBufferSlider.addEventListener('input', (e) => {
        const seconds = parseInt(e.target.value);
        replayBufferLimitSeconds = seconds;
        replayBufferValue.textContent = `${seconds}s`;

        // Save to localStorage
        localStorage.setItem('replayBufferLimitSeconds', replayBufferLimitSeconds.toString());
    });
}

// Handle speed change (switch MaxSafe live and replay modes)
function onSpeedChange(newSpeed) {
    const wasLive = playbackSpeed >= 1.0;
    const isNowLive = newSpeed >= 1.0;

    playbackSpeed = newSpeed;

    // If switching from replay to live, clear buffer
    if (!wasLive && isNowLive) {
        console.log('[MODE] Switching from replay to live');
        stopReplayMode();
        // Re-sync timestamps
        const now = getVirtualTime();
        lastTradeEventTime = now;
        previousTradeEventTime = now;
    }
    // If switching from live to replay, start replay mode
    else if (wasLive && !isNowLive) {
        console.log('[MODE] Switching from live to replay at speed', newSpeed);
        resetVirtualTime();
        // Re-sync timestamps
        const now = getVirtualTime();
        lastTradeEventTime = now;
        previousTradeEventTime = now;
        // Replay mode will be started automatically when first event comes in
    }
    // If already in replay mode, just update the speed
    else if (isReplayMode && !isNowLive) {
        console.log('[MODE] Updating replay speed to', newSpeed);
    }
}

// Speed buttons handler
const speedButtons = document.querySelectorAll('.speed-btn');
speedButtons.forEach(btn => {
    // Set initial active state
    const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
    if (btnSpeed === playbackSpeed) {
        btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
        const newSpeed = parseFloat(btn.getAttribute('data-speed'));

        // Handle mode switching
        onSpeedChange(newSpeed);

        // Update active state
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update speed slider (will be defined later)
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        if (speedSlider && speedValue) {
            speedSlider.value = newSpeed;
            speedValue.textContent = `${newSpeed.toFixed(2)}x`;
        }

        // Update toggle button label (will be defined later)
        const speedLabel = document.querySelector('.speed-label');
        if (speedLabel) {
            speedLabel.textContent = `${newSpeed}x`;
        }

        // Save to localStorage
        localStorage.setItem('playbackSpeed', playbackSpeed.toString());
    });
});

// Aggregation slider handler
const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationValue = document.getElementById('aggregationValue');

if (aggregationSlider && aggregationValue) {
    // Set initial value from saved setting
    aggregationSlider.value = tradeAggregationMs;
    aggregationValue.textContent = `${tradeAggregationMs}ms`;

    aggregationSlider.addEventListener('input', (e) => {
        const ms = parseInt(e.target.value);
        tradeAggregationMs = ms;
        aggregationValue.textContent = `${ms}ms`;

        // Save to localStorage
        localStorage.setItem('tradeAggregationMs', tradeAggregationMs.toString());

        // Clear any pending aggregation
        if (aggregationTimeout) {
            clearTimeout(aggregationTimeout);
            aggregationTimeout = null;
        }

        // Flush current buffer if switching to no aggregation
        if (ms === 0 && (Object.keys(tradeBuffer.binance).length > 0 || Object.keys(tradeBuffer.bybit).length > 0)) {
            flushTradeBuffer();
        }
    });
}

// ============================================
// Speed Toggle Button (Quick Access)
// ============================================

const speedToggleBtn = document.getElementById('speedToggleBtn');
const speedLabel = speedToggleBtn ? speedToggleBtn.querySelector('.speed-label') : null;
const presetSpeeds = [0.25, 0.5, 0.75, 1.0];

// Update speed toggle label
function updateSpeedToggleLabel(speed) {
    if (speedLabel) {
        speedLabel.textContent = `${speed}x`;
    }
}

// Initialize label
updateSpeedToggleLabel(playbackSpeed);

// Speed toggle button handler - cycles through preset speeds
if (speedToggleBtn) {
    speedToggleBtn.addEventListener('click', () => {
        // Find current speed index
        let currentIndex = presetSpeeds.indexOf(playbackSpeed);

        // If current speed is not in presets, find closest one
        if (currentIndex === -1) {
            currentIndex = presetSpeeds.findIndex(s => s >= playbackSpeed);
            if (currentIndex === -1) currentIndex = 0;
        }

        // Move to next speed (cycle back to first)
        const nextIndex = (currentIndex + 1) % presetSpeeds.length;
        const newSpeed = presetSpeeds[nextIndex];

        // Handle mode switching
        onSpeedChange(newSpeed);

        // Update UI
        updateSpeedToggleLabel(newSpeed);

        // Update preset buttons active state
        speedButtons.forEach(btn => {
            const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
            if (btnSpeed === newSpeed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update speed slider if exists
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        if (speedSlider && speedValue) {
            speedSlider.value = newSpeed;
            speedValue.textContent = `${newSpeed.toFixed(2)}x`;
        }

        // Save to localStorage
        localStorage.setItem('playbackSpeed', playbackSpeed.toString());
    });
}

// ============================================
// Fine-Grained Speed Slider
// ============================================

const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

if (speedSlider && speedValue) {
    // Set initial value from saved setting
    speedSlider.value = playbackSpeed;
    speedValue.textContent = `${playbackSpeed.toFixed(2)}x`;

    speedSlider.addEventListener('input', (e) => {
        const newSpeed = parseFloat(e.target.value);

        // Handle mode switching
        onSpeedChange(newSpeed);

        // Update UI
        speedValue.textContent = `${newSpeed.toFixed(2)}x`;
        updateSpeedToggleLabel(newSpeed);

        // Update preset buttons active state (only if matching exactly)
        speedButtons.forEach(btn => {
            const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
            if (btnSpeed === newSpeed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Save to localStorage
        localStorage.setItem('playbackSpeed', playbackSpeed.toString());
    });
}

// ============================================
// Performance Settings Handlers
// ============================================

// Apply/remove background effects based on setting
function applyBackgroundEffectsSetting() {
    const grain = document.querySelector('.grain');
    const gridCanvas = document.getElementById('grid');
    const particlesCanvas = document.getElementById('particles');
    const cursorGlow = document.querySelector('.cursor-glow');
    const cursorTrails = document.querySelectorAll('.cursor-trail');

    if (disableBackgroundEffects) {
        // Hide all background effects
        if (grain) grain.style.display = 'none';
        if (gridCanvas) gridCanvas.style.display = 'none';
        if (particlesCanvas) particlesCanvas.style.display = 'none';
        if (cursorGlow) cursorGlow.style.display = 'none';
        cursorTrails.forEach(trail => trail.style.display = 'none');
    } else {
        // Show all background effects
        if (grain) grain.style.display = 'block';
        if (gridCanvas) gridCanvas.style.display = 'block';
        if (particlesCanvas) particlesCanvas.style.display = 'block';
        if (cursorGlow) cursorGlow.style.display = 'block';
        cursorTrails.forEach(trail => trail.style.display = 'block');
    }
}

// Background effects toggle
const disableBackgroundEffectsCheckbox = document.getElementById('disableBackgroundEffects');
if (disableBackgroundEffectsCheckbox) {
    disableBackgroundEffectsCheckbox.checked = disableBackgroundEffects;
    applyBackgroundEffectsSetting(); // Apply on load

    disableBackgroundEffectsCheckbox.addEventListener('change', (e) => {
        disableBackgroundEffects = e.target.checked;
        localStorage.setItem('disableBackgroundEffects', disableBackgroundEffects);
        applyBackgroundEffectsSetting();
    });
}

// Trade notifications toggle
const disableTradeNotificationsCheckbox = document.getElementById('disableTradeNotifications');
if (disableTradeNotificationsCheckbox) {
    disableTradeNotificationsCheckbox.checked = disableTradeNotifications;

    disableTradeNotificationsCheckbox.addEventListener('change', (e) => {
        disableTradeNotifications = e.target.checked;
        localStorage.setItem('disableTradeNotifications', disableTradeNotifications);

        // Clear existing notifications
        if (disableTradeNotifications) {
            Object.keys(tradeNotifications).forEach(exchange => {
                tradeNotifications[exchange] = [];
            });
        }
    });
}

// Max particles slider
const maxParticlesSlider = document.getElementById('maxParticlesSlider');
const maxParticlesValue = document.getElementById('maxParticlesValue');

if (maxParticlesSlider && maxParticlesValue) {
    maxParticlesSlider.value = MAX_PARTICLES;
    maxParticlesValue.textContent = MAX_PARTICLES;

    maxParticlesSlider.addEventListener('input', (e) => {
        MAX_PARTICLES = parseInt(e.target.value);
        maxParticlesValue.textContent = MAX_PARTICLES;
        localStorage.setItem('maxParticles', MAX_PARTICLES);

        // Trim particles if over new limit
        while (tradeParticles.length > MAX_PARTICLES) {
            tradeParticles.shift();
        }
    });
}

// FPS buttons
const fpsButtons = document.querySelectorAll('.fps-btn');
fpsButtons.forEach(btn => {
    const fps = parseInt(btn.getAttribute('data-fps'));
    if (fps === targetFPS) {
        btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
        targetFPS = parseInt(btn.getAttribute('data-fps'));

        // Update active state
        fpsButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Save to localStorage
        localStorage.setItem('targetFPS', targetFPS);

        console.log('[PERF] Target FPS set to', targetFPS);
    });
});

// ============================================
// Layout Settings Handlers
// ============================================

// Layout preset buttons
const layoutButtons = document.querySelectorAll('.layout-btn');
layoutButtons.forEach(btn => {
    const layout = btn.getAttribute('data-layout');
    if (layout === layoutPreset) {
        btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
        layoutPreset = btn.getAttribute('data-layout');

        // Update active state
        layoutButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Save to localStorage
        localStorage.setItem('layoutPreset', layoutPreset);

        // Regenerate nodes with new layout
        nodes = generateNodes();

        console.log('[LAYOUT] Switched to', layoutPreset);
    });
});

// Aggregate exchanges checkbox
const aggregateExchangesCheckbox = document.getElementById('aggregateExchanges');
if (aggregateExchangesCheckbox) {
    aggregateExchangesCheckbox.checked = aggregateExchanges;

    aggregateExchangesCheckbox.addEventListener('change', (e) => {
        aggregateExchanges = e.target.checked;
        localStorage.setItem('aggregateExchanges', aggregateExchanges);

        // Regenerate nodes with new aggregation setting
        nodes = generateNodes();

        console.log('[LAYOUT] Aggregate exchanges:', aggregateExchanges);
    });
}

// Show crypto connections checkbox
const showCryptoConnectionsCheckbox = document.getElementById('showCryptoConnections');
if (showCryptoConnectionsCheckbox) {
    showCryptoConnectionsCheckbox.checked = showCryptoConnections;

    showCryptoConnectionsCheckbox.addEventListener('change', (e) => {
        showCryptoConnections = e.target.checked;
        localStorage.setItem('showCryptoConnections', showCryptoConnections);
        console.log('[LAYOUT] Crypto connections:', showCryptoConnections);
    });
}

// Show trade glow checkbox
const showTradeGlowCheckbox = document.getElementById('showTradeGlow');
if (showTradeGlowCheckbox) {
    showTradeGlowCheckbox.checked = showTradeGlow;

    showTradeGlowCheckbox.addEventListener('change', (e) => {
        showTradeGlow = e.target.checked;
        localStorage.setItem('showTradeGlow', showTradeGlow);
        console.log('[LAYOUT] Trade glow:', showTradeGlow);
    });
}

// Show spread info checkbox
const showSpreadInfoCheckbox = document.getElementById('showSpreadInfo');
if (showSpreadInfoCheckbox) {
    showSpreadInfoCheckbox.checked = showSpreadInfo;

    showSpreadInfoCheckbox.addEventListener('change', (e) => {
        showSpreadInfo = e.target.checked;
        localStorage.setItem('showSpreadInfo', showSpreadInfo);
        console.log('[LAYOUT] Spread info:', showSpreadInfo);
    });
}

// ============================================
// Modal Tabs System
// ============================================

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Restore last visited tab (default to 'general')
const lastTab = localStorage.getItem('lastVisitedTab') || 'general';
tabButtons.forEach(b => b.classList.remove('active'));
tabContents.forEach(c => c.classList.remove('active'));
const lastTabBtn = document.querySelector(`.tab-btn[data-tab="${lastTab}"]`);
const lastTabContent = document.getElementById(`${lastTab}Tab`);
if (lastTabBtn && lastTabContent) {
    lastTabBtn.classList.add('active');
    lastTabContent.classList.add('active');
}

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        // Save last visited tab
        localStorage.setItem('lastVisitedTab', targetTab);

        // Remove active class from all buttons and contents
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active class to clicked button
        btn.classList.add('active');

        // Show corresponding tab content
        const targetContent = document.getElementById(`${targetTab}Tab`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
    });
});

// ============================================
// Graphics and Performance Presets
// ============================================

function applyGraphicsPreset(level) {
    if (level === 'low') {
        // Low: Disable all visual effects
        document.getElementById('disableBackgroundEffects').checked = true;
        document.getElementById('showCryptoConnections').checked = false;
        document.getElementById('showTradeGlow').checked = false;
        document.getElementById('showSpreadInfo').checked = false;

        disableBackgroundEffects = true;
        showCryptoConnections = false;
        showTradeGlow = false;
        showSpreadInfo = false;

        localStorage.setItem('disableBackgroundEffects', 'true');
        localStorage.setItem('showCryptoConnections', 'false');
        localStorage.setItem('showTradeGlow', 'false');
        localStorage.setItem('showSpreadInfo', 'false');

        applyBackgroundEffectsSetting();
    } else if (level === 'normal') {
        // Normal: Enable some effects
        document.getElementById('disableBackgroundEffects').checked = false;
        document.getElementById('showCryptoConnections').checked = false;
        document.getElementById('showTradeGlow').checked = true;
        document.getElementById('showSpreadInfo').checked = true;

        disableBackgroundEffects = false;
        showCryptoConnections = false;
        showTradeGlow = true;
        showSpreadInfo = true;

        localStorage.setItem('disableBackgroundEffects', 'false');
        localStorage.setItem('showCryptoConnections', 'false');
        localStorage.setItem('showTradeGlow', 'true');
        localStorage.setItem('showSpreadInfo', 'true');

        applyBackgroundEffectsSetting();
    } else if (level === 'high') {
        // High: Enable all visual effects
        document.getElementById('disableBackgroundEffects').checked = false;
        document.getElementById('showCryptoConnections').checked = true;
        document.getElementById('showTradeGlow').checked = true;
        document.getElementById('showSpreadInfo').checked = true;

        disableBackgroundEffects = false;
        showCryptoConnections = true;
        showTradeGlow = true;
        showSpreadInfo = true;

        localStorage.setItem('disableBackgroundEffects', 'false');
        localStorage.setItem('showCryptoConnections', 'true');
        localStorage.setItem('showTradeGlow', 'true');
        localStorage.setItem('showSpreadInfo', 'true');

        applyBackgroundEffectsSetting();
    }
}

function applyPerformancePreset(level) {
    if (level === 'low') {
        // Low: Optimize for performance
        targetFPS = 30;
        MAX_PARTICLES = 50;
        document.getElementById('disableTradeNotifications').checked = true;
        document.getElementById('maxParticlesSlider').value = 50;
        document.getElementById('maxParticlesValue').textContent = '50';
        document.getElementById('aggregationSlider').value = 500;
        document.getElementById('aggregationValue').textContent = '500ms';

        disableTradeNotifications = true;
        tradeAggregationMs = 500;

        localStorage.setItem('targetFPS', '30');
        localStorage.setItem('maxParticles', '50');
        localStorage.setItem('disableTradeNotifications', 'true');
        localStorage.setItem('tradeAggregationMs', '500');

        // Update FPS buttons
        document.querySelectorAll('.fps-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-fps') === '30');
        });
    } else if (level === 'normal') {
        // Normal: Balanced settings
        targetFPS = 60;
        MAX_PARTICLES = 200;
        document.getElementById('disableTradeNotifications').checked = false;
        document.getElementById('maxParticlesSlider').value = 200;
        document.getElementById('maxParticlesValue').textContent = '200';
        document.getElementById('aggregationSlider').value = 100;
        document.getElementById('aggregationValue').textContent = '100ms';

        disableTradeNotifications = false;
        tradeAggregationMs = 100;

        localStorage.setItem('targetFPS', '60');
        localStorage.setItem('maxParticles', '200');
        localStorage.setItem('disableTradeNotifications', 'false');
        localStorage.setItem('tradeAggregationMs', '100');

        // Update FPS buttons
        document.querySelectorAll('.fps-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-fps') === '60');
        });
    } else if (level === 'high') {
        // High: Maximum quality
        targetFPS = 60;
        MAX_PARTICLES = 500;
        document.getElementById('disableTradeNotifications').checked = false;
        document.getElementById('maxParticlesSlider').value = 500;
        document.getElementById('maxParticlesValue').textContent = '500';
        document.getElementById('aggregationSlider').value = 0;
        document.getElementById('aggregationValue').textContent = '0ms';

        disableTradeNotifications = false;
        tradeAggregationMs = 0;

        localStorage.setItem('targetFPS', '60');
        localStorage.setItem('maxParticles', '500');
        localStorage.setItem('disableTradeNotifications', 'false');
        localStorage.setItem('tradeAggregationMs', '0');

        // Update FPS buttons
        document.querySelectorAll('.fps-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-fps') === '60');
        });
    }
}

// Preset buttons event listeners
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        const level = btn.getAttribute('data-level');

        if (preset === 'graphics') {
            applyGraphicsPreset(level);
        } else if (preset === 'performance') {
            applyPerformancePreset(level);
        }
    });
});

// Reset All button
document.getElementById('resetAllBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset ALL settings? This will reload the page.')) {
        localStorage.clear();
        location.reload();
    }
});

// Restore Defaults button
document.getElementById('resetDefaultBtn').addEventListener('click', () => {
    if (confirm('Restore default settings? (ETH/BTC/SOL, Normal graphics & performance)')) {
        // Set default symbols
        activeSymbols = ['ETH', 'BTC', 'SOL'];
        localStorage.setItem('activeSymbols', JSON.stringify(activeSymbols));

        // Apply default presets
        applyGraphicsPreset('normal');
        applyPerformancePreset('normal');

        // Reset other settings to defaults
        localStorage.setItem('layoutPreset', 'spider');
        localStorage.setItem('aggregateExchanges', 'false');
        localStorage.setItem('playbackSpeed', '1');
        localStorage.setItem('volume', '0.5');
        localStorage.setItem('audioThrottle', '0');
        localStorage.setItem('replayBufferLimit', '60');

        alert('Default settings restored. Reloading page...');
        location.reload();
    }
});
