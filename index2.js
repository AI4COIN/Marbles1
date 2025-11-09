// Disable right click context menu globally
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Mouse position variables (needed by particles and cursor)
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let cursorX = mouseX;
let cursorY = mouseY;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Grid Animation with movement (BLACK on WHITE)
const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let offsetX = 0;
let offsetY = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gridSize = 60;

    // Move grid slowly
    offsetX += 0.3;
    offsetY += 0.2;

    // Reset offset to prevent overflow
    if (offsetX > gridSize) offsetX = 0;
    if (offsetY > gridSize) offsetY = 0;

    ctx.strokeStyle = '#e5e5e5'; // Light gray for white background
    ctx.lineWidth = 1;

    // Vertical lines with offset
    for (let x = -gridSize + offsetX; x < canvas.width + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Horizontal lines with offset
    for (let y = -gridSize + offsetY; y < canvas.height + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    requestAnimationFrame(drawGrid);
}

drawGrid();

// DVD Bouncing Images
class DVDImage {
    constructor(element, index) {
        this.element = element;
        this.x = Math.random() * (window.innerWidth - 120);
        this.y = Math.random() * (window.innerHeight - 120);
        this.speedX = (Math.random() * 0.8 + 0.5) * (Math.random() > 0.5 ? 1 : -1);
        this.speedY = (Math.random() * 0.8 + 0.5) * (Math.random() > 0.5 ? 1 : -1);
        this.width = 120;
        this.height = 120;

        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
    }

    launch() {
        // Launch in random direction with random force
        const angle = Math.random() * Math.PI * 2;
        const force = Math.random() * 3 + 2;
        this.speedX = Math.cos(angle) * force;
        this.speedY = Math.sin(angle) * force;
    }

    update(allImages) {
        this.x += this.speedX;
        this.y += this.speedY;

        // Get actual dimensions
        const rect = this.element.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        // Bounce off edges
        if (this.x <= 0 || this.x + this.width >= window.innerWidth) {
            this.speedX *= -1;
            this.x = Math.max(0, Math.min(this.x, window.innerWidth - this.width));
        }

        if (this.y <= 0 || this.y + this.height >= window.innerHeight) {
            this.speedY *= -1;
            this.y = Math.max(0, Math.min(this.y, window.innerHeight - this.height));
        }

        // Check collision with other images
        allImages.forEach(other => {
            if (other !== this) {
                if (this.checkCollision(other)) {
                    const centerX1 = this.x + this.width / 2;
                    const centerY1 = this.y + this.height / 2;
                    const centerX2 = other.x + other.width / 2;
                    const centerY2 = other.y + other.height / 2;

                    const dx = centerX1 - centerX2;
                    const dy = centerY1 - centerY2;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance > 0) {
                        const nx = dx / distance;
                        const ny = dy / distance;

                        const relativeVelX = this.speedX - other.speedX;
                        const relativeVelY = this.speedY - other.speedY;
                        const velocityAlongNormal = relativeVelX * nx + relativeVelY * ny;

                        if (velocityAlongNormal < 0) {
                            const restitution = 0.9;
                            const impulse = -(1 + restitution) * velocityAlongNormal / 2;

                            this.speedX += impulse * nx;
                            this.speedY += impulse * ny;
                            other.speedX -= impulse * nx;
                            other.speedY -= impulse * ny;
                        }

                        const repulsionForce = 1.5;
                        this.speedX += nx * repulsionForce;
                        this.speedY += ny * repulsionForce;
                        other.speedX -= nx * repulsionForce;
                        other.speedY -= ny * repulsionForce;

                        const maxSpeed = 4;
                        const thisSpeed = Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY);
                        const otherSpeed = Math.sqrt(other.speedX * other.speedX + other.speedY * other.speedY);

                        if (thisSpeed > maxSpeed) {
                            this.speedX = (this.speedX / thisSpeed) * maxSpeed;
                            this.speedY = (this.speedY / thisSpeed) * maxSpeed;
                        }

                        if (otherSpeed > maxSpeed) {
                            other.speedX = (other.speedX / otherSpeed) * maxSpeed;
                            other.speedY = (other.speedY / otherSpeed) * maxSpeed;
                        }

                        const overlap = (this.width / 2 + other.width / 2) - distance;
                        const separateX = nx * overlap * 0.5;
                        const separateY = ny * overlap * 0.5;
                        this.x += separateX;
                        this.y += separateY;
                        other.x -= separateX;
                        other.y -= separateY;
                    }
                }
            }
        });

        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
    }

    checkCollision(other) {
        const centerX1 = this.x + this.width / 2;
        const centerY1 = this.y + this.height / 2;
        const centerX2 = other.x + other.width / 2;
        const centerY2 = other.y + other.height / 2;

        const dx = centerX1 - centerX2;
        const dy = centerY1 - centerY2;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < (this.width / 2 + other.width / 2);
    }
}

// Initialize DVD images
const dvdImages = [];

function initDVDImages() {
    const images = document.querySelectorAll('.dvd-image');
    images.forEach((img, index) => {
        if (img.complete) {
            setupDVDImage(img, index);
        } else {
            img.addEventListener('load', () => {
                setupDVDImage(img, index);
            });
        }
    });
}

function setupDVDImage(img, index) {
    const dvd = new DVDImage(img, index);
    dvdImages.push(dvd);

    // Left click - open modal
    img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        modalImage.src = img.src;
        modal.classList.add('active');
    });

    // Right click - launch in random direction
    img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dvd.launch();
    });
}

function animateDVD() {
    dvdImages.forEach(dvd => dvd.update(dvdImages));
    requestAnimationFrame(animateDVD);
}

// Start DVD animation when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initDVDImages();
        animateDVD();
    });
} else {
    initDVDImages();
    animateDVD();
}

// Modal close handlers
const modal = document.getElementById('imageModal');
const modalClose = document.querySelector('.modal-close');
const modalBackdrop = document.querySelector('.modal-backdrop');

if (modalClose) {
    modalClose.addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

if (modalBackdrop) {
    modalBackdrop.addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

// Custom Cursor
const cursorDot = document.querySelector('.cursor-dot');
const cursorRing = document.querySelector('.cursor-ring');

function updateCursor() {
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
const clickableElements = 'button, a, input[type="range"], input[type="number"], input[type="text"]';

function hasBlackBackground(element) {
    const style = window.getComputedStyle(element);
    const bgColor = style.backgroundColor;

    // Check if background is black or very dark
    // rgb(0, 0, 0) or rgba(0, 0, 0, x)
    if (bgColor.includes('rgb(0, 0, 0)') || bgColor.includes('rgba(0, 0, 0,')) {
        return true;
    }

    // Also check for #000000 converted to rgb
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        // Consider very dark colors (sum < 30) as black
        return (r + g + b) < 30;
    }

    return false;
}

let colorCheckInterval = null;

function attachCursorHoverEffect(element) {
    element.addEventListener('mouseenter', () => {
        cursorRing.classList.add('hover');

        // Check color continuously during hover to handle CSS transitions
        function checkColor() {
            if (hasBlackBackground(element)) {
                cursorDot.classList.add('inverted');
                cursorRing.classList.add('inverted');
            } else {
                cursorDot.classList.remove('inverted');
                cursorRing.classList.remove('inverted');
            }
        }

        // Check immediately
        checkColor();

        // Keep checking every 50ms during hover for transitions
        colorCheckInterval = setInterval(checkColor, 50);
    });

    element.addEventListener('mouseleave', () => {
        cursorRing.classList.remove('hover');
        cursorDot.classList.remove('inverted');
        cursorRing.classList.remove('inverted');

        // Stop checking color
        if (colorCheckInterval) {
            clearInterval(colorCheckInterval);
            colorCheckInterval = null;
        }
    });
}

document.querySelectorAll(clickableElements).forEach(el => {
    attachCursorHoverEffect(el);
});

// Observe for dynamically added elements
const cursorObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
                // Check if the node itself matches
                if (node.matches && node.matches(clickableElements)) {
                    attachCursorHoverEffect(node);
                }
                // Check children
                if (node.querySelectorAll) {
                    node.querySelectorAll(clickableElements).forEach(el => {
                        attachCursorHoverEffect(el);
                    });
                }
            }
        });
    });
});

cursorObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        if (href !== '#') {
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Scroll to Live Trades Button
const scrollToLiveBtn = document.getElementById('scrollToLiveBtn');
if (scrollToLiveBtn) {
    scrollToLiveBtn.addEventListener('click', () => {
        const liveSection = document.getElementById('live');
        if (liveSection) {
            liveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

// Fun Mode Toggle
const funModeBtn = document.getElementById('funModeBtn');
const floatingImages = document.getElementById('floatingImages');
let funModeActive = false;

if (funModeBtn) {
    funModeBtn.addEventListener('click', () => {
        funModeActive = !funModeActive;

        if (funModeActive) {
            floatingImages.style.display = 'block';
            funModeBtn.textContent = 'Fun Mode (On)';
            funModeBtn.classList.add('active');
        } else {
            floatingImages.style.display = 'none';
            funModeBtn.textContent = 'Fun Mode (Off)';
            funModeBtn.classList.remove('active');
        }
    });
}

// Hide images when on live trades section and show/hide live UI
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.target.id === 'live' && entry.isIntersecting) {
            if (floatingImages && funModeActive) floatingImages.style.display = 'none';
            // Show live section UI
            entry.target.classList.add('active');
        } else if (entry.target.id === 'live' && !entry.isIntersecting) {
            // Hide live section UI
            entry.target.classList.remove('active');
        } else if (entry.target.id === 'home' && entry.isIntersecting) {
            if (floatingImages && funModeActive) floatingImages.style.display = 'block';
        }
    });
}, { threshold: 0.5 });

const homeSection = document.getElementById('home');
const liveSection = document.getElementById('live');
if (homeSection) observer.observe(homeSection);
if (liveSection) observer.observe(liveSection);

// Settings Modal is handled by trades.js
// Trades.js color overrides are handled by index2-trades-override.js
