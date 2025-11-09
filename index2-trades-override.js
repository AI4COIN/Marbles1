// Override trades.js colors for black/white theme
// This file patches the drawing functions in trades.js to use black/white/gray instead of green/red/orange

// Color scheme:
// - Buy trades: black (0, 0, 0)
// - Sell trades: gray (102, 102, 102)
// - Positive values: black (0, 0, 0)
// - Negative values: gray (102, 102, 102)
// - Nodes/connections: black on white
// - Text: black (#000000) or gray (#666666)

// Wait for trades.js to load
let patchAttempts = 0;
const maxAttempts = 50;

function patchTradesJS() {
    patchAttempts++;

    // Check if trades.js is loaded
    if (typeof TradeParticle === 'undefined' || patchAttempts > maxAttempts) {
        if (patchAttempts <= maxAttempts) {
            setTimeout(patchTradesJS, 100);
        }
        return;
    }

    console.log('[INDEX2] Patching trades.js colors for black/white theme');

    // Patch the canvas context to intercept color assignments
    const ctx = tradesCtx;
    const originalStrokeStyleDescriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'strokeStyle');
    const originalFillStyleDescriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
    const originalShadowColorDescriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowColor');

    // Override strokeStyle setter to replace white with black
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'strokeStyle', {
        set: function(value) {
            // Replace white lines with black
            if (value === 'rgba(255, 255, 255, 0.1)') {
                value = 'rgba(0, 0, 0, 0.15)';
            } else if (value === 'rgba(255, 255, 255, 0.4)') {
                value = 'rgba(0, 0, 0, 0.6)';
            }
            originalStrokeStyleDescriptor.set.call(this, value);
        },
        get: originalStrokeStyleDescriptor.get
    });

    // Override fillStyle setter to replace green/red with dark green/dark red
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'fillStyle', {
        set: function(value) {
            // Replace bright green (buy) with dark green
            if (typeof value === 'string') {
                if (value.includes('0, 255, 100') || value.includes('0,255,100')) {
                    value = value.replace(/0,\s*255,\s*100/g, '0, 128, 64'); // Dark green
                }
                // Replace bright red (sell) with dark red
                if (value.includes('255, 50, 50') || value.includes('255,50,50')) {
                    value = value.replace(/255,\s*50,\s*50/g, '139, 0, 0'); // Dark red
                }
                // Replace yellow with dark orange/amber
                if (value.includes('255, 200, 0') || value.includes('255,200,0')) {
                    value = value.replace(/255,\s*200,\s*0/g, '180, 100, 0'); // Dark amber
                }
                // Replace white fills with appropriate colors
                if (value === 'rgba(255, 255, 255, 0.05)') {
                    value = 'rgba(255, 255, 255, 0.95)';
                }
                if (value === 'rgba(255, 255, 255, 0.9)') {
                    value = 'rgba(0, 0, 0, 0.9)';
                }
                if (value === 'rgba(255, 255, 255, 0.7)') {
                    value = 'rgba(0, 0, 0, 0.7)';
                }
            }
            originalFillStyleDescriptor.set.call(this, value);
        },
        get: originalFillStyleDescriptor.get
    });

    // Override shadowColor setter to replace green/red with dark green/dark red
    if (originalShadowColorDescriptor) {
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowColor', {
            set: function(value) {
                if (typeof value === 'string') {
                    // Replace green shadows with dark green
                    if (value.includes('0, 255, 100') || value.includes('0,255,100')) {
                        value = value.replace(/0,\s*255,\s*100/g, '0, 128, 64');
                    }
                    // Replace red shadows with dark red
                    if (value.includes('255, 50, 50') || value.includes('255,50,50')) {
                        value = value.replace(/255,\s*50,\s*50/g, '139, 0, 0');
                    }
                }
                originalShadowColorDescriptor.set.call(this, value);
            },
            get: originalShadowColorDescriptor.get
        });
    }

    // Patch clock delta color
    const clockDelta = document.getElementById('clockDelta');
    if (clockDelta) {
        // Override the style updates
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const currentColor = clockDelta.style.color;
                    // Replace bright colors with dark colors
                    if (currentColor.includes('255, 50, 50')) {
                        // Red -> Dark red
                        clockDelta.style.color = 'rgba(139, 0, 0, 0.9)';
                    } else if (currentColor.includes('255, 200, 0')) {
                        // Yellow -> Dark amber
                        clockDelta.style.color = 'rgba(180, 100, 0, 0.9)';
                    } else if (currentColor.includes('0, 255, 100')) {
                        // Green -> Dark green
                        clockDelta.style.color = 'rgba(0, 128, 64, 0.9)';
                    }
                }
            });
        });
        observer.observe(clockDelta, { attributes: true });
    }

    // Patch node positioning to avoid UI overlap
    const originalGenerateNodes = window.generateNodes;
    if (originalGenerateNodes) {
        window.generateNodes = function() {
            const nodes = originalGenerateNodes.call(this);

            // Adjust exchange positions to avoid UI overlap
            // UI safe zones:
            // - Top-left (clock): 0-0.18 x, 0-0.15 y
            // - Top-right (stats): 0.82-1.0 x, 0-0.15 y
            // - Bottom (bottom stats): 0-1.0 x, 0.85-1.0 y

            // Adjust binance position (avoid top-left overlap)
            if (nodes.binance) {
                // Move inward and down from 0.15, 0.2
                if (nodes.binance.x <= 0.18 && nodes.binance.y <= 0.25) {
                    nodes.binance.x = Math.max(nodes.binance.x, 0.22);
                    nodes.binance.y = Math.max(nodes.binance.y, 0.28);
                }
            }

            // Adjust bybit position (avoid top-right overlap)
            if (nodes.bybit) {
                // Move inward and down from 0.85, 0.2
                if (nodes.bybit.x >= 0.82 && nodes.bybit.y <= 0.25) {
                    nodes.bybit.x = Math.min(nodes.bybit.x, 0.78);
                    nodes.bybit.y = Math.max(nodes.bybit.y, 0.28);
                }
            }

            // Adjust aggregated exchange position if needed
            if (nodes.exchange) {
                // If it's near the top, move it down slightly
                if (nodes.exchange.y <= 0.22) {
                    nodes.exchange.y = Math.max(nodes.exchange.y, 0.28);
                }
            }

            return nodes;
        };

        // Regenerate nodes with new positions
        if (window.nodes) {
            window.nodes = window.generateNodes();
        }
    }

    // Patch symbols management to use Save button instead of auto-reload
    let pendingSymbols = [...activeSymbols];
    let hasUnsavedChanges = false;

    // Update save button state
    function updateSaveButtonState() {
        const saveBtn = document.getElementById('saveSymbolsBtn');
        if (saveBtn) {
            saveBtn.disabled = !hasUnsavedChanges;
        }
    }

    // Custom render function for pending symbols
    function renderPendingSymbols() {
        const symbolsList = document.getElementById('symbolsList');
        if (!symbolsList) return;

        symbolsList.innerHTML = '';
        pendingSymbols.forEach(symbol => {
            const item = document.createElement('div');
            item.className = 'symbol-item';
            item.innerHTML = `
                <span class="symbol-name">${symbol}</span>
                <button class="remove-btn" data-symbol="${symbol}">Remove</button>
            `;
            symbolsList.appendChild(item);
        });

        // Add click handlers for remove buttons
        symbolsList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const symbol = btn.getAttribute('data-symbol');

                if (pendingSymbols.length <= 1) {
                    alert('At least one symbol must remain');
                    return;
                }

                pendingSymbols = pendingSymbols.filter(s => s !== symbol);
                hasUnsavedChanges = true;
                renderPendingSymbols();
                updateSaveButtonState();
            });
        });
    }

    // Override renderSymbolsList to use pending symbols
    const originalRenderSymbolsList = window.renderSymbolsList;
    window.renderSymbolsList = renderPendingSymbols;

    // Override addSymbol button
    const addSymbolBtn = document.getElementById('addSymbolBtn');
    if (addSymbolBtn) {
        // Remove existing event listeners by cloning
        const newAddBtn = addSymbolBtn.cloneNode(true);
        addSymbolBtn.parentNode.replaceChild(newAddBtn, addSymbolBtn);

        newAddBtn.addEventListener('click', (e) => {
            e.preventDefault();

            const symbolInput = document.getElementById('symbolInput');
            const symbol = symbolInput.value.trim().toUpperCase();

            if (!symbol) {
                alert('Please enter a symbol');
                return;
            }

            if (pendingSymbols.includes(symbol)) {
                alert('Symbol already exists');
                return;
            }

            if (pendingSymbols.length >= 10) {
                alert('Maximum 10 symbols allowed');
                return;
            }

            pendingSymbols.push(symbol);
            symbolInput.value = '';
            hasUnsavedChanges = true;
            renderPendingSymbols();
            updateSaveButtonState();
        });
    }

    // Handle Enter key on input
    const symbolInput = document.getElementById('symbolInput');
    if (symbolInput) {
        const newSymbolInput = symbolInput.cloneNode(true);
        symbolInput.parentNode.replaceChild(newSymbolInput, symbolInput);

        newSymbolInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('addSymbolBtn').click();
            }
        });
    }

    // Add save button handler
    const saveSymbolsBtn = document.getElementById('saveSymbolsBtn');
    if (saveSymbolsBtn) {
        saveSymbolsBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // Save pending changes
            localStorage.setItem('activeSymbols', JSON.stringify(pendingSymbols));
            hasUnsavedChanges = false;
            updateSaveButtonState();

            // Reload page to apply changes
            window.location.reload();
        });

        // Set initial disabled state
        updateSaveButtonState();
    }

    console.log('[INDEX2] Trades.js colors patched successfully');
    console.log('[INDEX2] Symbols save button initialized');
}

// Start patching
patchTradesJS();
