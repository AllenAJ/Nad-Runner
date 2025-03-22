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
let leaderboard = [];
const MAX_LEADERBOARD_ENTRIES = 10;

let isScoreSubmitted = false;

// Game dimensions
const originalGameWidth = 1200;
const originalGameHeight = 600;
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
const powerupSpawnChance = 0.005;
const powerupMinDistance = 200;

const maxJumpHeight = 150;

// Add this near the top of the file with other game variables
const speedIncreaseInterval = 3; // Increase speed every 10 seconds
const speedIncreaseAmount = 0.5; // Increase speed by 0.5 each time

// Make initializeGame globally available
window.initializeGame = function () {
    console.log('Initializing game...');

    // Get all required DOM elements with safety checks
    canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    const startScreen = document.getElementById('start-screen');
    if (!startScreen) {
        console.error('Start screen not found');
        return;
    }

    const startButton = document.getElementById('start-button');
    if (!startButton) {
        console.error('Start button not found');
        return;
    }

    gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
        console.error('Game container not found');
        return;
    }

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    character = new Character(50, gameHeight - characterSize, characterSize, characterSize);
    console.log(`Initial character position: (${character.x}, ${character.y})`);

    if (window.SalmonadObstacle) {
        salmonadObstacle = new window.SalmonadObstacle();
    } else {
        console.error('SalmonadObstacle not found');
    }

    canvas.style.display = 'block';
    startScreen.style.display = 'flex';

    loadImages();
    resetGame();

    document.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('touchstart', handleTouch);

    startButton.addEventListener('click', startGame);
    console.log('Added click event listener to start button');

    requestAnimationFrame(drawInitialGameState);

    const storedLeaderboard = localStorage.getItem('leaderboard');
    if (storedLeaderboard) {
        leaderboard = JSON.parse(storedLeaderboard);
    }

    // Add event listeners with safety checks
    const submitButton = document.getElementById('submit-score');
    const closeLeaderboardButton = document.getElementById('close-leaderboard');
    const showLeaderboardButton = document.getElementById('show-leaderboard');

    if (submitButton) {
        submitButton.addEventListener('click', submitScore);
    }
    if (closeLeaderboardButton) {
        closeLeaderboardButton.addEventListener('click', hideLeaderboard);
    }
    if (showLeaderboardButton) {
        showLeaderboardButton.addEventListener('click', showLeaderboard);
    }
}

function handleKeyDown(e) {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (!isGameOver) {
            character.jump();
        }
    }
}

// Add this function to handle touch events
function handleTouch(e) {
    e.preventDefault();
    if (!isGameOver) {
        character.jump();
    }
}

function startGame() {
    console.log('Start game function called');
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    hideLeaderboard();
    hideTutorial();

    resetGame();

    isScoreSubmitted = false;
    const submitButton = document.getElementById('submit-score');
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Score';

    lastTime = 0;
    isGameOver = false;
    requestAnimationFrame(gameLoop);
}

class Character {
    constructor(x, y, width, height, yOffset = -10) {
        this.x = x;
        this.y = y + yOffset;
        this.width = width;
        this.height = height;
        this.yVelocity = 0;
        this.jumpStrength = -550;
        this.gravity = 1500;
        this.grounded = true;
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.image = molandakImage;
        this.rotation = 0;
        this.rotationSpeed = Math.PI * 5;
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
        this.rotation += this.rotationSpeed * deltaTime;

        if (this.y + this.height > gameHeight) {
            this.y = gameHeight - this.height;
            this.yVelocity = 0;
            this.grounded = true;
            this.jumpCount = 0;
        }
    }

    draw() {
        if (this.image && this.image.complete) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(this.rotation);
            const scaleFactor = 0.9;
            const newWidth = this.width * scaleFactor;
            const newHeight = this.height * scaleFactor;
            const xOffset = (this.width - newWidth) / 2;
            const yOffset = (this.height - newHeight) / 2;
            ctx.drawImage(this.image, -newWidth / 2 - xOffset, -newHeight / 2 - yOffset, newWidth, newHeight);
            ctx.restore();
        }
    }

    reset() {
        this.y = gameHeight - this.height;
        this.yVelocity = 0;
        this.grounded = true;
        this.jumpCount = 0;
        this.rotation = 0;
    }
}

class Obstacle {
    constructor(x, y, width, height, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.image = new Image();
        this.image.src = type === 'ground' ? '/assets/chog.png' : '/assets/mouch.png';
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

function loadImages() {
    let imagesLoaded = 0;
    const totalImages = 5;

    function onImageLoad() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            console.log('All images loaded');
            requestAnimationFrame(drawInitialGameState);
        }
    }

    molandakImage = new Image();
    molandakImage.src = '/assets/molandak.png';
    molandakImage.onload = () => {
        console.log('Molandak image loaded');
        character.image = molandakImage;
        onImageLoad();
    };
    molandakImage.onerror = () => {
        console.error('Failed to load Molandak image');
        onImageLoad();
    };

    chogImage = new Image();
    chogImage.src = '/assets/chog.png';
    chogImage.onload = onImageLoad;

    mouchImage = new Image();
    mouchImage.src = '/assets/mouch.png';
    mouchImage.onload = onImageLoad;

    moyakiImage = new Image();
    moyakiImage.src = '/assets/moyaki.png';
    moyakiImage.onload = onImageLoad;

    salmonadImage = new Image();
    salmonadImage.src = '/assets/salmonad.png';
    salmonadImage.onload = onImageLoad;
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Set canvas dimensions to match container
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Calculate scale to maintain aspect ratio
    scale = Math.min(containerWidth / originalGameWidth, containerHeight / originalGameHeight);

    // Update game dimensions
    gameWidth = containerWidth / scale;
    gameHeight = containerHeight / scale;

    // Apply scale transform to context
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    if (character) {
        character.y = gameHeight - character.height;
    }
}

function gameLoop(currentTime) {
    if (lastTime === 0) {
        lastTime = currentTime;
    }
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    update(deltaTime);

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

    ctx.strokeStyle = 'green';
    ctx.strokeRect(0, 0, gameWidth, gameHeight);

    character.update(deltaTime);
    character.draw();

    if (Math.random() < obstacleSpawnChance * deltaTime * 60 && gameWidth - lastObstacleX > minObstacleDistance) {
        const isGroundObstacle = Math.random() < 0.6;
        const obstacleY = isGroundObstacle ? gameHeight - obstacleSize : gameHeight - 100;
        obstacles.push(new Obstacle(gameWidth, obstacleY, obstacleSize, obstacleSize, isGroundObstacle ? 'ground' : 'aerial'));
        lastObstacleX = gameWidth;
    }

    if (Math.random() < powerupSpawnChance * deltaTime * 60) {
        const minY = gameHeight - maxJumpHeight - powerupSize;
        const maxY = gameHeight - 100;
        const powerupY = Math.random() * (maxY - minY) + minY;
        if (canSpawnPowerup(gameWidth, powerupY)) {
            powerups.push(new Powerup(gameWidth, powerupY, powerupSize, powerupSize));
        }
    }

    spawnSalmonadObstacle(salmonadObstacle);

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

    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].update(deltaTime);
        powerups[i].draw();

        if (powerups[i].x + powerups[i].width < 0) {
            powerups.splice(i, 1);
            continue;
        }

        if (
            character.x < powerups[i].x + powerups[i].width &&
            character.x + character.width > powerups[i].x &&
            character.y < powerups[i].y + powerups[i].height &&
            character.y + character.height > powerups[i].y
        ) {
            score += powerupScoreBoost;
            powerups.splice(i, 1);
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
    const padding = 20 / scale;
    ctx.fillText(scoreText, (gameWidth - textWidth - padding) / scale, 30 / scale);

    // Increase game speed over time
    if (Math.floor(score / 60) % speedIncreaseInterval === 0 && Math.floor(score / 60) > 0) {
        gameSpeed += speedIncreaseAmount * deltaTime;
    }
}

function gameOver() {
    isGameOver = true;
    const gameOverScreen = document.getElementById('game-over-screen');
    gameOverScreen.style.display = 'flex';
    document.getElementById('final-score').textContent = Math.floor(score);

    const restartButton = document.getElementById('restart-button');
    restartButton.removeEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    updateLeaderboardDisplay();
}

function drawBackground(deltaTime) {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
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

function drawInitialGameState() {
    ctx.clearRect(0, 0, gameWidth, gameHeight);
    drawBackground(0);
    character.draw();
}

function drawOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
}

function showTutorial() {
    document.getElementById('tutorial').style.display = 'flex';
}

function hideTutorial() {
    document.getElementById('tutorial').style.display = 'none';
}

function submitScore() {
    const playerName = document.getElementById('player-name').value;
    const submitButton = document.getElementById('submit-score');
    if (playerName && !isScoreSubmitted) {
        leaderboard.push({ name: playerName, score: Math.floor(score) });
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
        updateLeaderboardDisplay();
        document.getElementById('player-name').value = '';
        submitButton.disabled = true;
        submitButton.textContent = 'Score Submitted';
        isScoreSubmitted = true;
    }
}

function updateLeaderboardDisplay() {
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '';
    leaderboard.forEach((entry, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${entry.name}: ${entry.score}`;
        leaderboardList.appendChild(li);
    });
}

function showLeaderboard() {
    document.getElementById('leaderboard-container').style.display = 'block';
}

function hideLeaderboard() {
    document.getElementById('leaderboard-container').style.display = 'none';
}

window.addEventListener('load', initializeGame);
console.log('Added load event listener to window');