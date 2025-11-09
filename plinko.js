// Matter.js setup
const { Engine, Render, World, Bodies, Body, Events, Runner } = Matter;

// Game state
let gameState = {
    balance: 1000,
    totalWagered: 0,
    totalWon: 0,
    currentRisk: 'low',
    autoDrop: false,
    autoDropInterval: null,
    houseEdge: 15 // percentage
};

// Base multipliers (EV = 100% before house edge is applied)
// These are calibrated so that with normal distribution, expected value = 1.0
const BASE_MULTIPLIERS = {
    low: {
        buckets: 8,
        multipliers: [5.6, 2.1, 1.1, 0.3, 0.3, 1.1, 2.1, 5.6]
    },
    medium: {
        buckets: 13,
        multipliers: [13, 8, 3, 1.3, 0.7, 0.2, 0.2, 0.2, 0.7, 1.3, 3, 8, 13]
    },
    high: {
        buckets: 17,
        multipliers: [26, 16, 10, 5, 3, 1.5, 0.5, 0.2, 0.2, 0.2, 0.5, 1.5, 3, 5, 10, 16, 26]
    }
};

// Get multipliers adjusted for house edge
function getAdjustedMultipliers(risk) {
    const base = BASE_MULTIPLIERS[risk];
    const adjustment = (100 - gameState.houseEdge) / 100;
    return base.multipliers.map(m => parseFloat((m * adjustment).toFixed(2)));
}

// Current risk config
const RISK_CONFIG = {};

// Canvas dimensions
const WIDTH = 700;
const HEIGHT = 850;

// Physics engine setup
const engine = Engine.create({
    gravity: { x: 0, y: 0.8 }
});

const canvas = document.getElementById('plinkoCanvas');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Game objects
let pegs = [];
let buckets = [];
let walls = [];
let activeBalls = new Map();

// Initialize game with risk level
function initializeGame() {
    // Clear existing objects
    World.clear(engine.world);
    pegs = [];
    buckets = [];
    walls = [];
    activeBalls.clear();

    // Build config with adjusted multipliers
    const baseConfig = BASE_MULTIPLIERS[gameState.currentRisk];
    const config = {
        buckets: baseConfig.buckets,
        multipliers: getAdjustedMultipliers(gameState.currentRisk)
    };
    const BUCKET_COUNT = config.buckets;
    const BUCKET_WIDTH = 35;

    const bucketY = HEIGHT - 120;
    const totalBucketWidth = BUCKET_COUNT * BUCKET_WIDTH;
    const bucketsStartX = (WIDTH - totalBucketWidth) / 2;
    const bucketsEndX = bucketsStartX + totalBucketWidth;

    // Create walls aligned with bucket edges
    const wallThickness = 20;
    const leftWall = Bodies.rectangle(
        bucketsStartX - wallThickness/2,
        HEIGHT/2,
        wallThickness,
        HEIGHT,
        {
            isStatic: true,
            render: { visible: false }
        }
    );
    const rightWall = Bodies.rectangle(
        bucketsEndX + wallThickness/2,
        HEIGHT/2,
        wallThickness,
        HEIGHT,
        {
            isStatic: true,
            render: { visible: false }
        }
    );
    walls = [leftWall, rightWall];
    World.add(engine.world, walls);

    // Create pegs in TRIANGLE formation aligned with buckets
    // The bottom row should have pegs at each bucket divider (BUCKET_COUNT + 1 pegs)
    // Each row up has one less peg, forming a triangle
    const PEG_ROWS = 15;
    const startY = 100;
    const verticalSpacing = 38;

    for (let row = 0; row < PEG_ROWS; row++) {
        // Number of pegs decreases as we go up (triangle formation)
        const pegsInRow = BUCKET_COUNT + 1 - Math.floor(row * (BUCKET_COUNT + 1) / PEG_ROWS);

        if (pegsInRow < 3) continue; // Don't draw rows with too few pegs

        // Calculate spacing for this row to align with buckets at bottom
        const rowWidth = (pegsInRow - 1) * BUCKET_WIDTH;
        const rowStartX = (WIDTH - rowWidth) / 2;

        for (let col = 0; col < pegsInRow; col++) {
            const x = rowStartX + col * BUCKET_WIDTH;
            const y = startY + row * verticalSpacing;

            const peg = Bodies.circle(x, y, 2.5, {
                isStatic: true,
                restitution: 0.8,
                friction: 0.001,
                frictionAir: 0,
                label: 'peg'
            });
            pegs.push(peg);
            World.add(engine.world, peg);
        }
    }

    // Create buckets
    for (let i = 0; i < BUCKET_COUNT; i++) {
        const x = bucketsStartX + i * BUCKET_WIDTH;
        const centerX = x + BUCKET_WIDTH / 2;

        // Bucket walls (invisible physics)
        const leftWallBucket = Bodies.rectangle(
            x,
            bucketY,
            2,
            60,
            {
                isStatic: true,
                render: { visible: false }
            }
        );

        // Last wall
        if (i === BUCKET_COUNT - 1) {
            const rightWallBucket = Bodies.rectangle(
                x + BUCKET_WIDTH,
                bucketY,
                2,
                60,
                {
                    isStatic: true,
                    render: { visible: false }
                }
            );
            World.add(engine.world, rightWallBucket);
        }

        // Floor sensor
        const floor = Bodies.rectangle(
            centerX,
            bucketY + 30,
            BUCKET_WIDTH - 4,
            2,
            {
                isStatic: true,
                isSensor: true,
                label: `bucket-${i}`
            }
        );

        buckets.push({
            floor,
            index: i,
            x: x,
            centerX: centerX,
            width: BUCKET_WIDTH,
            hitEffect: 0
        });

        World.add(engine.world, [leftWallBucket, floor]);
    }
}

// Generate random bucket index based on binomial distribution (normal-ish)
function getRandomBucket() {
    const baseConfig = BASE_MULTIPLIERS[gameState.currentRisk];
    const bucketCount = baseConfig.buckets;

    // Use binomial distribution to favor center buckets
    // Sum of multiple random values approaches normal distribution
    let sum = 0;
    const iterations = 8;
    for (let i = 0; i < iterations; i++) {
        sum += Math.random();
    }

    // Normalize to bucket range
    const normalized = sum / iterations; // 0 to 1, centered around 0.5
    const bucketIndex = Math.floor(normalized * bucketCount);

    return Math.min(bucketIndex, bucketCount - 1);
}

// Drop a ball
function dropBall() {
    const betAmount = parseInt(document.getElementById('betAmount').value);

    if (betAmount <= 0 || betAmount > gameState.balance) {
        // Stop auto drop if balance is insufficient
        if (gameState.autoDrop) {
            gameState.autoDrop = false;
            clearInterval(gameState.autoDropInterval);
            const autoBtn = document.getElementById('autoDrop');
            autoBtn.textContent = 'Auto Drop (Off)';
            autoBtn.classList.remove('active');
        }

        if (gameState.balance <= 0) {
            alert('Insufficient balance! Game over.');
        } else {
            alert('Bet amount exceeds balance!');
        }
        return;
    }

    gameState.balance -= betAmount;
    gameState.totalWagered += betAmount;
    updateStats();

    // PREDETERMINE THE RESULT (like real online casinos)
    const targetBucket = getRandomBucket();
    const adjustedMultipliers = getAdjustedMultipliers(gameState.currentRisk);
    const multiplier = adjustedMultipliers[targetBucket];
    const winAmount = Math.floor(betAmount * multiplier);

    // Calculate target X position for the predetermined bucket
    const baseConfig = BASE_MULTIPLIERS[gameState.currentRisk];
    const BUCKET_COUNT = baseConfig.buckets;
    const BUCKET_WIDTH = 35;
    const totalBucketWidth = BUCKET_COUNT * BUCKET_WIDTH;
    const bucketsStartX = (WIDTH - totalBucketWidth) / 2;
    const targetX = bucketsStartX + targetBucket * BUCKET_WIDTH + BUCKET_WIDTH / 2;

    // Start ball closer to target with some randomness for realism
    const startX = targetX + (Math.random() - 0.5) * 60;

    const ball = Bodies.circle(startX, 60, 5, {
        restitution: 0.7,
        friction: 0.001,
        frictionAir: 0.001,
        density: 0.002,
        label: 'ball'
    });

    activeBalls.set(ball.id, {
        ball,
        betAmount,
        startTime: Date.now(),
        targetBucket: targetBucket,
        targetX: targetX,
        predeterminedWin: winAmount,
        predeterminedMultiplier: multiplier
    });
    World.add(engine.world, ball);
}

// Handle ball landing in bucket
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;

        const ball = bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : null;
        const bucket = bodyA.label?.startsWith('bucket-') ? bodyA :
                      bodyB.label?.startsWith('bucket-') ? bodyB : null;

        if (ball && bucket && activeBalls.has(ball.id)) {
            const ballData = activeBalls.get(ball.id);

            // Use the PREDETERMINED result (like real online casinos)
            const winAmount = ballData.predeterminedWin;
            const multiplier = ballData.predeterminedMultiplier;
            const targetBucket = ballData.targetBucket;

            gameState.balance += winAmount;
            gameState.totalWon += winAmount;
            updateStats();

            // Trigger bucket effect on the target bucket (not necessarily where it landed)
            buckets[targetBucket].hitEffect = 1;

            addHistory(ballData.betAmount, winAmount, multiplier, targetBucket);

            setTimeout(() => {
                World.remove(engine.world, ball);
                activeBalls.delete(ball.id);
            }, 200);
        }
    });
});

// Apply subtle guidance force to balls towards their target
Events.on(engine, 'beforeUpdate', () => {
    activeBalls.forEach((data, id) => {
        const ball = data.ball;
        const targetX = data.targetX;

        // Only apply force if ball is still above the buckets and moving
        if (ball.position.y < HEIGHT - 150) {
            const dx = targetX - ball.position.x;

            // Gentle horizontal guidance
            const horizontalForce = dx * 0.00003;

            // Small downward force to prevent sticking
            const downwardForce = 0.0001;

            Body.applyForce(ball, ball.position, {
                x: horizontalForce,
                y: downwardForce
            });
        }

        // If ball is stuck (velocity too low), give it a push
        const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
        if (speed < 0.5 && ball.position.y < HEIGHT - 150) {
            Body.setVelocity(ball, {
                x: ball.velocity.x + (Math.random() - 0.5) * 0.5,
                y: ball.velocity.y + 0.5
            });
        }
    });
});

// Update stats display
function updateStats() {
    document.getElementById('balance').textContent = gameState.balance.toFixed(0);
    document.getElementById('totalWagered').textContent = gameState.totalWagered.toFixed(0);
    document.getElementById('totalWon').textContent = gameState.totalWon.toFixed(0);

    const profit = gameState.totalWon - gameState.totalWagered;
    const profitEl = document.getElementById('profit');
    profitEl.textContent = profit.toFixed(0);
    profitEl.className = 'stat-value profit ' + (profit >= 0 ? 'positive' : 'negative');
}

// Add to history
function addHistory(bet, win, multiplier, bucketIndex) {
    const historyList = document.getElementById('historyList');
    const emptyMsg = historyList.querySelector('.history-empty');
    if (emptyMsg) emptyMsg.remove();

    const profit = win - bet;
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <span class="history-bet">Bet: ${bet}</span>
        <span class="history-multiplier">${multiplier}x</span>
        <span class="history-win ${profit >= 0 ? 'positive' : 'negative'}">
            ${profit >= 0 ? '+' : ''}${profit}
        </span>
    `;

    historyList.insertBefore(historyItem, historyList.firstChild);

    while (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

// Rendering
function customRender() {
    const baseConfig = BASE_MULTIPLIERS[gameState.currentRisk];
    const adjustedMultipliers = getAdjustedMultipliers(gameState.currentRisk);
    const bucketY = HEIGHT - 120;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw subtle grid
    ctx.strokeStyle = '#f8f8f8';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < WIDTH; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, HEIGHT);
        ctx.stroke();
    }
    for (let i = 0; i < HEIGHT; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(WIDTH, i);
        ctx.stroke();
    }

    // Draw pegs
    ctx.fillStyle = '#000000';
    pegs.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.position.x, peg.position.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw buckets
    ctx.lineWidth = 1;
    buckets.forEach((bucket, i) => {
        const mult = adjustedMultipliers[i];

        // Bucket divider
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(bucket.x, bucketY - 30);
        ctx.lineTo(bucket.x, bucketY + 30);
        ctx.stroke();

        // Last divider
        if (i === buckets.length - 1) {
            ctx.beginPath();
            ctx.moveTo(bucket.x + bucket.width, bucketY - 30);
            ctx.lineTo(bucket.x + bucket.width, bucketY + 30);
            ctx.stroke();
        }

        // Floor with effect
        const floorY = bucketY + 30;

        // Hit effect (fills background when ball passes through)
        if (bucket.hitEffect > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${bucket.hitEffect * 0.15})`;
            ctx.fillRect(bucket.x + 1, bucketY - 30, bucket.width - 1, 60);
            bucket.hitEffect -= 0.05;
            if (bucket.hitEffect < 0) bucket.hitEffect = 0;
        }

        // Floor line (the "sol")
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bucket.x + 2, floorY);
        ctx.lineTo(bucket.x + bucket.width - 2, floorY);
        ctx.stroke();
        ctx.lineWidth = 1;

        // Multiplier label below floor
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000000';
        ctx.fillText(`${mult}x`, bucket.centerX, bucketY + 50);
    });

    // Draw balls
    activeBalls.forEach((data, id) => {
        const ball = data.ball;
        const x = ball.position.x;
        const y = ball.position.y;

        // Ball shadow/outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Ball body
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x - 1.5, y - 1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
    });

    requestAnimationFrame(customRender);
}

// Event listeners
document.getElementById('dropBall').addEventListener('click', dropBall);

document.getElementById('autoDrop').addEventListener('click', (e) => {
    gameState.autoDrop = !gameState.autoDrop;
    e.target.textContent = gameState.autoDrop ? 'Auto Drop (On)' : 'Auto Drop (Off)';
    e.target.classList.toggle('active');

    if (gameState.autoDrop) {
        gameState.autoDropInterval = setInterval(() => {
            if (activeBalls.size < 5) {
                dropBall();
            }
        }, 700);
    } else {
        clearInterval(gameState.autoDropInterval);
    }
});

document.querySelectorAll('.risk-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const oldRisk = gameState.currentRisk;
        const newRisk = e.target.dataset.risk;

        if (oldRisk !== newRisk) {
            document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            gameState.currentRisk = newRisk;

            // Reinitialize game with new risk level
            initializeGame();
        }
    });
});

// House edge slider
document.getElementById('houseEdge').addEventListener('input', (e) => {
    gameState.houseEdge = parseInt(e.target.value);
    document.getElementById('houseEdgeValue').textContent = `${gameState.houseEdge}%`;

    // Reinitialize to update multipliers
    initializeGame();
});

// Info panel toggle
document.getElementById('infoBtn').addEventListener('click', () => {
    document.getElementById('infoPanel').classList.add('active');
    // Reset to page 1 when opening
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`infoPage${i}`).classList.remove('active');
    }
    document.getElementById('infoPage1').classList.add('active');
});

document.getElementById('infoPanelClose').addEventListener('click', () => {
    document.getElementById('infoPanel').classList.remove('active');
});

// Close info panel when clicking backdrop
document.getElementById('infoPanel').addEventListener('click', (e) => {
    if (e.target.id === 'infoPanel') {
        document.getElementById('infoPanel').classList.remove('active');
    }
});

// Info panel page navigation
document.querySelectorAll('.info-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const nextPage = e.target.dataset.next;
        const prevPage = e.target.dataset.prev;
        const targetPage = nextPage || prevPage;

        if (targetPage) {
            // Hide all pages
            for (let i = 1; i <= 5; i++) {
                document.getElementById(`infoPage${i}`).classList.remove('active');
            }
            // Show target page
            document.getElementById(`infoPage${targetPage}`).classList.add('active');
        }
    });
});

// Clean up old balls
setInterval(() => {
    activeBalls.forEach((data, id) => {
        if (Date.now() - data.startTime > 15000) {
            World.remove(engine.world, data.ball);
            activeBalls.delete(id);
        }
    });
}, 1000);

// Custom Cursor
const cursorDot = document.querySelector('.cursor-dot');
const cursorRing = document.querySelector('.cursor-ring');

let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function updateCursor() {
    // Smooth cursor movement
    cursorX += (mouseX - cursorX) * 0.2;
    cursorY += (mouseY - cursorY) * 0.2;

    cursorDot.style.left = cursorX + 'px';
    cursorDot.style.top = cursorY + 'px';

    cursorRing.style.left = cursorX + 'px';
    cursorRing.style.top = cursorY + 'px';

    requestAnimationFrame(updateCursor);
}

updateCursor();

// Hover effect on clickable elements
const clickableElements = 'button, a, input[type="range"], input[type="number"], .risk-btn, .info-nav-btn';

document.querySelectorAll(clickableElements).forEach(el => {
    el.addEventListener('mouseenter', () => {
        cursorRing.classList.add('hover');
    });

    el.addEventListener('mouseleave', () => {
        cursorRing.classList.remove('hover');
    });
});

// Initialize and start
initializeGame();

const runner = Runner.create();
Runner.run(runner, engine);

customRender();
updateStats();
