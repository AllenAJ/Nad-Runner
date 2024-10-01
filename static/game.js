// Global variables
let canvas, ctx;
let character;
let obstacles = [];
let score = 0;
let initialGameSpeed = 5;
let gameSpeed = initialGameSpeed;
let isGameOver = false;
let lastTime = 0;
let player;
let gameContainer;
let scoreElement;
let salmonadObstacle;
let startButton;

// Import the SalmonadObstacle class and spawnSalmonadObstacle function
import { SalmonadObstacle, spawnSalmonadObstacle } from './salmonad.js';
import { postScoreOnchain } from './web3.js';

function initializeGame() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    character = new Character(50, gameHeight - characterSize, characterSize, characterSize);
    console.log(`Initial character position: (${character.x}, ${character.y})`);

    gameContainer = document.getElementById('game-container');
    salmonadObstacle = new SalmonadObstacle();
    startButton = document.getElementById('start-button');

    // Make sure the canvas and start screen are visible
    canvas.style.display = 'block';
    document.getElementById('start-screen').style.display = 'flex';

    // Load images
    loadImages();

    // Initialize game state
    resetGame();

    // Add event listener for spacebar
    document.addEventListener('keydown', handleKeyDown);

    // Add event listener to start button
    startButton.addEventListener('click', startGame);

    // Draw the initial game state (including tutorial)
    requestAnimationFrame(drawInitialGameState);

    // Show the tutorial
    showTutorial();
}

// Add this new function to handle keydown events
function handleKeyDown(e) {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (!isGameOver) {
            character.jump();
        }
    }
}

function startGame() {
    console.log('Game started');
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    hideTutorial();

    // Reset game state
    resetGame();

    // Start the game loop
    lastTime = 0;
    isGameOver = false;
    requestAnimationFrame(gameLoop);
}

// Game dimensions
const originalGameWidth = 800;
const originalGameHeight = 400;
const aspectRatio = originalGameWidth / originalGameHeight;
let gameWidth = originalGameWidth;
let gameHeight = originalGameHeight;
let scale = 1;

// Asset dimensions
const characterSize = 40;
const obstacleSize = 40;
const obstacleSpawnChance = 0.02

// New game variables
let backgroundImage;
let molandakImage;
let chogImage;
let mouchImage;
let moyakiImage;
let salmonadImage;
let backgroundX = 0;

// Jump variables
let jumpCount = 0;

// Obstacle variables
const minObstacleDistance = 150;
let lastObstacleX = 0;

// Add these new variables
let powerups = [];
const powerupSize = 30;
const powerupScoreBoost = 100;
const powerupSpawnChance = 0.005; // Adjust this value to change spawn frequency
const powerupMinDistance = 200; // Minimum distance from obstacles

// Add this constant for maximum jump height
const maxJumpHeight = 150; // Adjust this value based on your game's physics

// Character class
class Character {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.yVelocity = 0;
        this.jumpStrength = -550; // Reverted to the previous value
        this.gravity = 1500; // Reverted to the previous value
        this.grounded = true;
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.image = molandakImage;
    }

    jump() {
        if (this.jumpCount < this.maxJumps) {
            this.yVelocity = this.jumpStrength;
            this.grounded = false;
            this.jumpCount++;
        }
    }

    update(deltaTime) {
        this.yVelocity += this.gravity * deltaTime;
        this.y += this.yVelocity * deltaTime;

        if (this.y + this.height > gameHeight) {
            this.y = gameHeight - this.height;
            this.yVelocity = 0;
            this.grounded = true;
            this.jumpCount = 0;
        }
    }

    draw() {
        if (this.image && this.image.complete) {
            const scaleFactor = 0.9; // Adjust this value to make the image smaller
            const newWidth = this.width * scaleFactor;
            const newHeight = this.height * scaleFactor;
            const xOffset = (this.width - newWidth) / 2;
            const yOffset = (this.height - newHeight) / 2;
            ctx.drawImage(this.image, this.x + xOffset, this.y + yOffset, newWidth, newHeight);
        }
    }

    reset() {
        this.y = gameHeight - this.height;
        this.yVelocity = 0;
        this.grounded = true;
        this.jumpCount = 0;
    }
}

// Obstacle class
class Obstacle {
    constructor(x, y, width, height, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.image = new Image();
        this.image.src = type === 'ground' ? '/static/chog.png' : '/static/mouch.png';
        this.rotation = 0;
        this.rotationSpeed = type === 'ground' ? Math.PI : 0; // Rotate ground obstacles (chog.png)
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    update(deltaTime) {
        this.x -= gameSpeed * 60 * deltaTime;
        this.rotation += this.rotationSpeed * deltaTime;
    }
}

// New Powerup class
class Powerup {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = moyakiImage;
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

    update(deltaTime) {
        this.x -= gameSpeed * 60 * deltaTime;
    }
}

// Game functions
function generateSVGBackground() {
    // ... (keep the existing SVG generation code) ...
}

function resetGame() {
    obstacles = [];
    powerups = [];
    score = 0;
    gameSpeed = initialGameSpeed;
    lastObstacleX = 0;
    lastTime = 0;
    character.reset();
    backgroundX = 0;
}

function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    character = new Character(50, gameHeight - characterSize, characterSize, characterSize);

    // Update event listeners for jump
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            character.jump();
        }
    });

    // Add touch event listener
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        character.jump();
    });

    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';

    // Load images
    loadImages();

    // Initialize game state
    resetGame();
}

function loadImages() {
    let imagesLoaded = 0;
    const totalImages = 6;

    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            console.log('All images loaded');
            requestAnimationFrame(drawInitialGameState);
        }
    }

    backgroundImage = new Image();
    backgroundImage.src = generateSVGBackground();
    backgroundImage.onload = onImageLoad;
    backgroundImage.onerror = () => {
        console.error('Background image failed to load');
        backgroundImage = null;
        onImageLoad();
    };

    molandakImage = new Image();
    molandakImage.src = '/static/molandak.png';
    molandakImage.onload = () => {
        console.log('Molandak image loaded');
        character.image = molandakImage; // Ensure the character uses the loaded image
        onImageLoad();
    };
    molandakImage.onerror = () => {
        console.error('Failed to load Molandak image');
        onImageLoad();
    };

    chogImage = new Image();
    chogImage.src = '/static/chog.png';
    chogImage.onload = onImageLoad;

    mouchImage = new Image();
    mouchImage.src = '/static/mouch.png';
    mouchImage.onload = onImageLoad;

    moyakiImage = new Image();
    moyakiImage.src = '/static/moyaki.png';
    moyakiImage.onload = onImageLoad;

    salmonadImage = new Image();
    salmonadImage.src = '/static/salmonad.png';
    salmonadImage.onload = onImageLoad;
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    scale = Math.min(containerWidth / originalGameWidth, containerHeight / originalGameHeight);

    gameWidth = containerWidth / scale;
    gameHeight = containerHeight / scale;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Adjust character position after resize
    if (character) {
        character.y = gameHeight - character.height;
        console.log(`Character position after resize: (${character.x}, ${character.y})`);
    }
}

function gameLoop(currentTime) {
    if (lastTime === 0) {
        lastTime = currentTime;
    }
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    update(deltaTime);

    // Add this line to update the Salmonad obstacle
    salmonadObstacle.update(deltaTime);

    if (isGameOver) {
        drawOverlay();
        gameOver();
    } else {
        requestAnimationFrame(gameLoop);
    }
}

function update(deltaTime) {
    ctx.clearRect(0, 0, gameWidth, gameHeight);
    drawBackground(deltaTime);

    // Debug: Draw game boundaries
    ctx.strokeStyle = 'green';
    ctx.strokeRect(0, 0, gameWidth, gameHeight);

    character.update(deltaTime);
    character.draw();

    // Generate obstacles
    if (Math.random() < obstacleSpawnChance * deltaTime * 60 && gameWidth - lastObstacleX > minObstacleDistance) {
        const isGroundObstacle = Math.random() < 0.6;
        const obstacleY = isGroundObstacle ? gameHeight - obstacleSize : gameHeight - 100;
        obstacles.push(new Obstacle(gameWidth, obstacleY, obstacleSize, obstacleSize, isGroundObstacle ? 'ground' : 'aerial'));
        lastObstacleX = gameWidth;
    }
    // Generate powerups
    if (Math.random() < powerupSpawnChance * deltaTime * 60) {
        const minY = gameHeight - maxJumpHeight - powerupSize;
        const maxY = gameHeight - 100; // Adjust this value if needed
        const powerupY = Math.random() * (maxY - minY) + minY;
        if (canSpawnPowerup(gameWidth, powerupY)) {
            powerups.push(new Powerup(gameWidth, powerupY, powerupSize, powerupSize));
        }
    }

    // Add this line to potentially spawn the Salmonad obstacle
    spawnSalmonadObstacle(salmonadObstacle);

    // Update and draw obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update(deltaTime);
        obstacles[i].draw();

        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            continue;
        }

        const groundBuffer = 8;
        const aerialBuffer = 15;
        const buffer = obstacles[i].type === 'ground' ? groundBuffer : aerialBuffer;

        if (
            character.x + groundBuffer < obstacles[i].x + obstacles[i].width &&
            character.x + character.width - groundBuffer > obstacles[i].x &&
            character.y + buffer < obstacles[i].y + obstacles[i].height &&
            character.y + character.height - buffer > obstacles[i].y
        ) {
            gameOver();
            return;
        }
    }

    // Update and draw powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].update(deltaTime);
        powerups[i].draw();

        if (powerups[i].x + powerups[i].width < 0) {
            powerups.splice(i, 1);
            continue;
        }

        // Collision detection with character
        if (
            character.x < powerups[i].x + powerups[i].width &&
            character.x + character.width > powerups[i].x &&
            character.y < powerups[i].y + powerups[i].height &&
            character.y + character.height > powerups[i].y
        ) {
            score += powerupScoreBoost;
            powerups.splice(i, 1);
            // You can add a sound effect or visual feedback here
        }
    }

    if (obstacles.length > 0) {
        lastObstacleX = obstacles[obstacles.length - 1].x;
    }

    score += deltaTime * 60;
    ctx.fillStyle = 'black';
    ctx.font = `bold ${20 / scale}px Inter, sans-serif`;
    const scoreText = `Score: ${Math.floor(score)}`;
    const textWidth = ctx.measureText(scoreText).width;
    const padding = 20 / scale; // Add some padding from the right edge
    ctx.fillText(scoreText, (gameWidth - textWidth - padding) / scale, 30 / scale);
}

function gameOver() {
    isGameOver = true;
    drawOverlay();
    const gameOverScreen = document.getElementById('game-over-screen');
    gameOverScreen.style.display = 'flex';
    document.getElementById('final-score').textContent = Math.floor(score);

    // Show the tutorial again
    showTutorial();

    // Remove any existing event listeners to prevent multiple listeners
    const restartButton = document.getElementById('restart-button');
    restartButton.removeEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
}

function drawBackground(deltaTime) {
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, backgroundX, 0, gameWidth, gameHeight);
        ctx.drawImage(backgroundImage, backgroundX + gameWidth, 0, gameWidth, gameHeight);
        backgroundX -= gameSpeed * 30 * deltaTime;
        if (backgroundX <= -gameWidth) {
            backgroundX = 0;
        }
    } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, gameWidth, gameHeight);
    }
}

function canSpawnPowerup(x, y) {
    for (let obstacle of obstacles) {
        const distance = Math.sqrt(Math.pow(x - obstacle.x, 2) + Math.pow(y - obstacle.y, 2));
        if (distance < powerupMinDistance) {
            return false;
        }
    }
    return true;
}

// Add this new function to draw the initial game state
function drawInitialGameState() {
    ctx.clearRect(0, 0, gameWidth, gameHeight);
    drawBackground(0);
    character.draw();
}

// Add this function to draw a semi-transparent overlay
function drawOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
}

// Add these new functions
function showTutorial() {
    document.getElementById('tutorial').style.display = 'flex';
}

function hideTutorial() {
    document.getElementById('tutorial').style.display = 'none';
}

// Initialize the game when the window loads
window.onload = initializeGame;