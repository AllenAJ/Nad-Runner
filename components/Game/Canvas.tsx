import React from 'react';
import { useEffect, useRef } from 'react';
import styles from './Canvas.module.css';
import { BOX_ARRANGEMENTS, BOX_TYPES, BoxConfig } from './BoxConstants';

interface CanvasProps {
    width: number;
    height: number;
    isPlaying: boolean;
    onGameOver: (results: { score: number; boxJumps: number; coinCount: number; xp: number; }) => void;
}

interface GameState {
    playerY: number;
    playerX: number;
    yVelocity: number;
    xVelocity: number;
    gravity: number;
    jumpStrength: number;
    moveSpeed: number;
    isJumping: boolean;
    isMovingLeft: boolean;
    isMovingRight: boolean;
    jumpDirection: 'none' | 'left' | 'right';
    jumpCount: number;
    maxJumps: number;
    rotation: number;
    rotationSpeed: number;
    gameSpeed: number;
    score: number;
    obstacles: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        type: typeof BOX_TYPES[keyof typeof BOX_TYPES];
        image?: HTMLImageElement | null;
        config?: BoxConfig;
    }>;
    lastObstacleX: number;
    powerups: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        type: 'score' | 'doubleJump' | 'coinMagnet' | 'timeReset';
        active?: boolean;
    }>;
    powerupEffects: {
        invincible: boolean;
        doubleJump: boolean;
        scoreMultiplier: number;
        coinMagnet: boolean;
        timeResetActive: boolean;
    };
    timeSinceStart: number;
    scale: number;
    floatingTexts: Array<{
        text: string;
        x: number;
        y: number;
        opacity: number;
        createdAt: number;
        scale?: number;
        color?: string;
    }>;
    invincibilityEndTime?: number;
    powerupTimeouts: {
        score?: NodeJS.Timeout;
        invincible?: NodeJS.Timeout;
        doubleJump?: NodeJS.Timeout;
        coinMagnet?: NodeJS.Timeout;
        timeReset?: NodeJS.Timeout;
    };
    boxJumps: number;
    lastBoxJumpTime: number;
    lastObstacleType?: typeof BOX_TYPES[keyof typeof BOX_TYPES];
    explosions: Array<{
        x: number;
        y: number;
        frame: number;
        createdAt: number;
    }>;
    particles: Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
        rotation: number;
        rotationSpeed: number;
        size: number;
        color: string;
        opacity: number;
        fadeSpeed?: number;
    }>;
    screenShake: {
        intensity: number;
        duration: number;
        startTime: number;
    };
    deathAnimation: {
        active: boolean;
        characterPos: { x: number; y: number };
        characterVel: { x: number; y: number };
        characterRotation: number;
        characterRotationSpeed: number;
        characterOpacity: number;
        trail: Array<{
            x: number;
            y: number;
            rotation: number;
            opacity: number;
        }>;
        stars: Array<{
            x: number;
            y: number;
            rotation: number;
            size: number;
            opacity: number;
        }>;
        complete: boolean;
    };
    isColliding: boolean;
    glass: {
        isBroken: boolean;
        x: number;
        y: number;
        width: number;
        height: number;
        breakStartTime?: number;
        opacity: number;
        particles: Array<{
            x: number;
            y: number;
            vx: number;
            vy: number;
            rotation: number;
            size: number;
            opacity: number;
        }>;
    };
    debug: {
        enabled: boolean;
        showHitboxes: boolean;
        lastDeathCause?: {
            type: string;
            x: number;
            y: number;
            velocity: number;
        };
    };
    chogRotation: number;
    isOnBox: boolean;
    currentBoxTop: number;
    justJumped: boolean;
    canBoxJump: boolean;
    currentBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    backgroundX: number; // Add this for background position
    lastSpawnTime?: number;
    coins: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        collected: boolean;
        frame: number;
        lastFrameUpdate: number;
        value: number;
    }>;
    coinCount: number;
    coinImages: (HTMLImageElement | null)[];
    // --- New Jump Bar State ---
    jumpBarValue: number;
    maxJumpBarValue: number;
    jumpBarDepletionRate: number;
    jumpBarReplenishAmount: number;
    gameOverReason: 'collision' | 'jumpBarDepleted' | null; // To track why game ended
    xp: number; // XP gained from box jumps
    bestScore: number; // Track best score
    // --- Add state for power-up display animation ---
    powerupDisplay: {
        type: PowerupType | null;
        startTime: number | null;
        scale: number;
        opacity: number;
    } | null;
    // --- End power-up display state ---
    lastPowerupSpawnScore: number; // Track score at last powerup spawn
    // --- Particle Pooling --- 
    particlePool: Array<Particle>; // Pool of inactive particles
    activeParticles: Array<Particle>; // Currently visible/active particles
    // --- End Particle Pooling ---
}

// Define the Particle type separately for clarity
interface Particle {
    id: number; // Unique ID for management
    active: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    size: number;
    color: string;
    opacity: number;
    fadeSpeed: number;
    createdAt: number; // To track lifetime
    lifeSpan: number; // How long the particle should live (ms)
}

interface Obstacle {
    x: number;
    y: number;
    width: number;
    height: number;
    type: typeof BOX_TYPES[keyof typeof BOX_TYPES];
    config?: BoxConfig;
}

// Update image references to use window.Image
const characterImages = {
    body: typeof window !== 'undefined' ? new window.Image() : null,
    fur: typeof window !== 'undefined' ? new window.Image() : null,
    eyes: typeof window !== 'undefined' ? new window.Image() : null,
    nose: typeof window !== 'undefined' ? new window.Image() : null,
    mouth: typeof window !== 'undefined' ? new window.Image() : null
};

if (characterImages.body) characterImages.body.src = '/Char_layers/Body.png';
if (characterImages.fur) characterImages.fur.src = '/Char_layers/Fur.png';
if (characterImages.eyes) characterImages.eyes.src = '/Char_layers/Eyes.png';
if (characterImages.nose) characterImages.nose.src = '/Char_layers/Nose.png';
if (characterImages.mouth) characterImages.mouth.src = '/Char_layers/Mouth.png';

const obstacleImages = {
    ground: typeof window !== 'undefined' ? new window.Image() : null,
    air: typeof window !== 'undefined' ? new window.Image() : null
};
if (obstacleImages.ground) obstacleImages.ground.src = '/assets/chog.png';
if (obstacleImages.air) obstacleImages.air.src = '/assets/mouch.png';

const powerupImage = typeof window !== 'undefined' ? new window.Image() : null;
if (powerupImage) powerupImage.src = '/assets/moyaki.png';

const boxImage = typeof window !== 'undefined' ? new window.Image() : null;
if (boxImage) boxImage.src = '/assets/images/box.svg';

const box2Image = typeof window !== 'undefined' ? new window.Image() : null;
if (box2Image) box2Image.src = '/assets/box2.png';

const box3Image = typeof window !== 'undefined' ? new window.Image() : null;
if (box3Image) box3Image.src = '/assets/box3.png';

const cityBackgroundImage = typeof window !== 'undefined' ? new window.Image() : null;
if (cityBackgroundImage) cityBackgroundImage.src = '/bg/city_background.svg'; // Updated path

// Add after other images at the top
const coinIconImage = typeof window !== 'undefined' ? new window.Image() : null;
if (coinIconImage) coinIconImage.src = '/Display_Icon/coin.svg';

// Add Power-up Icon Images
const powerupIconImages = {
    coinMagnet: typeof window !== 'undefined' ? new window.Image() : null,
    doubleScore: typeof window !== 'undefined' ? new window.Image() : null,
    timeReset: typeof window !== 'undefined' ? new window.Image() : null,
    tripleJump: typeof window !== 'undefined' ? new window.Image() : null,
};
if (powerupIconImages.coinMagnet) powerupIconImages.coinMagnet.src = '/Powerup/Coin Magnet.svg';
if (powerupIconImages.doubleScore) powerupIconImages.doubleScore.src = '/Powerup/Double Score.svg';
if (powerupIconImages.timeReset) powerupIconImages.timeReset.src = '/Powerup/Time Reset.svg';
if (powerupIconImages.tripleJump) powerupIconImages.tripleJump.src = '/Powerup/Triple Jump.svg';

// Mobile-specific constants
const MOBILE_SCALE = 1;
const MOBILE_INITIAL_GAME_SPEED = 3; // Slower initial speed for mobile
const PLAYER_START_X = 20;

// Define all possible power-up types
type PowerupType = 'score' | 'invincible' | 'doubleJump' | 'coinMagnet' | 'timeReset';

// Game constants
const MAX_PARTICLES = 200; // Limit the total number of concurrent particles
let nextParticleId = 0;

const INITIAL_STATE: GameState = {
    playerY: 0,
    playerX: PLAYER_START_X,
    yVelocity: 0,
    xVelocity: 0,
    gravity: 1500,
    jumpStrength: -550,
    moveSpeed: 5,
    isJumping: false,
    isMovingLeft: false,
    isMovingRight: false,
    jumpDirection: 'none',
    jumpCount: 0,
    maxJumps: 2,
    rotation: 0,
    rotationSpeed: Math.PI * 5,
    gameSpeed: 5,
    score: 0,
    obstacles: [],
    lastObstacleX: 0,
    lastObstacleType: undefined,
    powerups: [],
    powerupEffects: {
        invincible: false,
        doubleJump: false,
        scoreMultiplier: 1,
        coinMagnet: false,
        timeResetActive: false,
    },
    timeSinceStart: 0,
    scale: 1,
    floatingTexts: [],
    invincibilityEndTime: undefined,
    powerupTimeouts: {},
    boxJumps: 0,
    lastBoxJumpTime: 0,
    explosions: [],
    particles: [],
    screenShake: {
        intensity: 0,
        duration: 0,
        startTime: 0
    },
    deathAnimation: {
        active: false,
        characterPos: { x: 0, y: 0 },
        characterVel: { x: 0, y: 0 },
        characterRotation: 0,
        characterRotationSpeed: 0,
        characterOpacity: 1,
        trail: [],
        stars: [],
        complete: false
    },
    isColliding: false,
    glass: {
        isBroken: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        opacity: 1,
        particles: []
    },
    debug: {
        enabled: false,
        showHitboxes: false
    },
    chogRotation: 0,
    isOnBox: false,
    currentBoxTop: 0,
    justJumped: false,
    canBoxJump: false,
    currentBox: null,
    backgroundX: 0,
    lastSpawnTime: undefined,
    coins: [],
    coinCount: 0,
    coinImages: Array.from({ length: 16 }, (_, i) => {
        const img = typeof window !== 'undefined' ? new window.Image() : null;
        if (img) img.src = `/Coin/${i + 1}.svg`;
        return img;
    }),
    maxJumpBarValue: 100,
    jumpBarValue: 100,
    jumpBarDepletionRate: 5, // Points per second
    jumpBarReplenishAmount: 10, // Points per box jump
    gameOverReason: null,
    powerupDisplay: null, // Initialize powerup display state
    xp: 0, // Initialize XP to 0
    bestScore: 0, // Initialize best score
    lastPowerupSpawnScore: 0, // Initialize last powerup spawn score
    // --- Particle Pooling Init --- 
    particlePool: Array.from({ length: MAX_PARTICLES }, (_, i) => ({
        id: i,
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        rotation: 0, rotationSpeed: 0,
        size: 0, color: '', opacity: 0,
        fadeSpeed: 0.01, createdAt: 0, lifeSpan: 1000
    })),
    activeParticles: [],
    // --- End Particle Pooling Init ---
};

const PLAYER_SIZE = 50;
const OBSTACLE_SIZE = 50;
const POWERUP_SIZE = 40;
const getGroundHeight = (height: number) => Math.min(80, height * 0.15); // Dynamic ground height
const PLAYER_OFFSET_FROM_GROUND = 0;
const OBSTACLE_SPAWN_CHANCE = 0.95; // Increased spawn chance for more frequent obstacles
const MIN_OBSTACLE_DISTANCE = 5; // Reduced distance for closer obstacle spawning
const SPEED_INCREASE_INTERVAL = 3;
const SPEED_INCREASE_AMOUNT = 0.5;
const MAX_GAME_SPEED = 15;

// Add a constant for box height
const BOX_HEIGHT = OBSTACLE_SIZE * 2.5; // Original box height (1.5x taller than regular obstacles)
const BOX2_HEIGHT = OBSTACLE_SIZE * 7; // Make box2 taller to accommodate the gap
const BOX2_WIDTH = OBSTACLE_SIZE ; // Make box2 wider if needed

// Update the box3 constants
const BOX3_HEIGHT = OBSTACLE_SIZE ; // Height for 3 boxes stacked
const BOX3_WIDTH = OBSTACLE_SIZE * 3;  // Width for 3 boxes side by side
const BOX3_FLOAT_HEIGHT = OBSTACLE_SIZE * 2; // Height above ground to make it higher

// First, define a type for all possible obstacle types
type ObstacleType = typeof BOX_TYPES[keyof typeof BOX_TYPES];

// Load explosion sprite
// const explosionImage = typeof window !== 'undefined' ? new window.Image() : null;
// if (explosionImage) explosionImage.src = '/assets/explosion.png';

// Update box size constant
const BOX_SIZE = 50; // New box size (was 41)

// Add jump sound at the top with other assets
const jumpSound = typeof window !== 'undefined' ? new Audio('/assets/audio/jumpsound.mp3') : null;

// Add explosion sound at the top with other assets
const explosionSound = typeof window !== 'undefined' ? new Audio('/assets/audio/explode3.mp3') : null;

// Add ticking clock sound for low jump bar
const tickingSound = typeof window !== 'undefined' ? new Audio('/assets/audio/clockticking.mp3') : null;
if (tickingSound) {
    tickingSound.loop = true; // Make the sound loop continuously
    tickingSound.volume = 0.5; // Set volume to 50%
}

// Add combo sounds at the top with other assets
const comboSounds = [
    typeof window !== 'undefined' ? new Audio('/assets/audio/3_combo1.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/4_combo2.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/5_combo3.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/6_combo4.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/7_combo5.mp3') : null
];

const CHOG_ROTATION_SPEED = Math.PI; // Rotate 180 degrees per second

// Adjust physics constants for snappier movement
const DIRECTIONAL_JUMP_HORIZONTAL_BOOST = 600; // Increased from 400 for faster horizontal movement
const DIRECTIONAL_JUMP_STRENGTH_MULTIPLIER = 1.3; // Increased from 1.2 for stronger directional jumps
const AIR_RESISTANCE = 0.95; // Increased from 0.99 for less floaty feel
const AIR_CONTROL_MULTIPLIER = 2.5; // New constant for stronger air control
const INITIAL_MOVE_SPEED = 400; // Base movement speed

// Add hit sounds at the top with other assets
const hitSounds = [
    typeof window !== 'undefined' ? new Audio('/assets/audio/10_hit1.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/11_hit2.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/12_hit3.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/13_hit4.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/14_hit5.mp3') : null,
    typeof window !== 'undefined' ? new Audio('/assets/audio/15_hit6.mp3') : null
];

// Add this constant at the top with other constants
const OBSTACLE_SPAWN_INTERVAL = 2000; // Spawn obstacle every 1 second

// Coin Magnet Constants
const COIN_MAGNET_RADIUS = 150; // Pixel radius around the player
const COIN_MAGNET_STRENGTH = 400; // Speed at which coins are pulled (pixels per second)

// Helper function to draw power-up icons
const drawPowerupIcons = (ctx: CanvasRenderingContext2D, state: GameState, width: number) => {
    const iconSize = 32; // Size of each icon
    const padding = 8; // Padding between icons
    const topMargin = 10; // Margin from the top edge
    const rightMargin = 10; // Margin from the right edge

    // Explicitly type the keys of iconMap and activeStatusMap
    const icons: PowerupType[] = ['coinMagnet', 'score', 'timeReset', 'doubleJump'];
    const iconMap: { [key in PowerupType]?: HTMLImageElement | null } = {
        coinMagnet: powerupIconImages.coinMagnet,
        score: powerupIconImages.doubleScore, // Use 'score' key for Double Score icon
        timeReset: powerupIconImages.timeReset,
        doubleJump: powerupIconImages.tripleJump // Use 'doubleJump' key for Triple Jump icon
        // Note: 'invincible' icon is not loaded/handled here
    };
    const activeStatusMap: { [key in PowerupType]?: boolean } = {
        coinMagnet: state.powerupEffects.coinMagnet,
        score: state.powerupEffects.scoreMultiplier > 1,
        timeReset: state.powerupEffects.timeResetActive,
        doubleJump: state.powerupEffects.doubleJump
    };

    const startX = width - rightMargin - iconSize;
    let currentY = topMargin;

    ctx.save(); // Save context for filter changes

    icons.forEach(iconType => {
        const img = iconMap[iconType];
        const isActive = activeStatusMap[iconType];

        if (img && img.complete) {
            if (!isActive) {
                // Apply desaturation filter for inactive icons
                ctx.filter = 'saturate(0) opacity(0.5)';
            } else {
                // Ensure no filter for active icons
                ctx.filter = 'none';
            }

            ctx.drawImage(
                img,
                startX,
                currentY,
                iconSize,
                iconSize
            );

            // Reset filter for the next draw operation within the loop
            ctx.filter = 'none'; 

            // Move down for the next icon
            currentY += iconSize + padding;
        }
    });

    ctx.restore(); // Restore original context state (including filter)
};

const Canvas: React.FC<CanvasProps> = ({ width, height, isPlaying, onGameOver }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<GameState>({ ...INITIAL_STATE });
    const lastTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const isMobileRef = useRef(width <= 768);

    // --- Particle Pool Helpers ---
    const getParticleFromPool = (): Particle | null => {
        const state = gameStateRef.current;
        if (state.particlePool.length > 0) {
            const particle = state.particlePool.pop()!;
            particle.active = true;
            particle.opacity = 1; // Reset opacity
            particle.createdAt = Date.now(); // Set creation time
            state.activeParticles.push(particle);
            return particle;
        }
        // Optional: Log if pool is empty, maybe increase pool size if needed
        // console.warn("Particle pool empty!");
        return null; // Pool is empty
    };

    const returnParticleToPool = (particle: Particle) => {
        const state = gameStateRef.current;
        particle.active = false;
        // Remove from active list
        const index = state.activeParticles.findIndex(p => p.id === particle.id);
        if (index > -1) {
            state.activeParticles.splice(index, 1);
        }
        // Add back to pool if pool is not full (shouldn't happen with fixed size)
        if (state.particlePool.length < MAX_PARTICLES) {
            state.particlePool.push(particle);
        }
    };
    // --- End Particle Pool Helpers ---

    // Update isMobileRef when width changes
    useEffect(() => {
        const isMobile = width <= 768;
        isMobileRef.current = isMobile;
        console.log('Device type:', isMobile ? 'mobile' : 'desktop', 'width:', width);

        // Reset game speed if game is not playing
        if (!isPlaying) {
            gameStateRef.current.gameSpeed = isMobile ? MOBILE_INITIAL_GAME_SPEED : INITIAL_STATE.gameSpeed;
            console.log('Initial game speed set to:', gameStateRef.current.gameSpeed);
        }
    }, [width]);

    // Setup high DPI canvas with mobile scaling
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Set initial scale and speed
        gameStateRef.current.scale = 1;
        gameStateRef.current.gameSpeed = INITIAL_STATE.gameSpeed;
    }, [width, height]);

    const resetGame = () => {
        const groundHeight = getGroundHeight(height);
        const isMobile = isMobileRef.current;
        const initialSpeed = isMobile ? MOBILE_INITIAL_GAME_SPEED : INITIAL_STATE.gameSpeed;
        console.log('Resetting game for:', isMobile ? 'mobile' : 'desktop', 'speed:', initialSpeed);

        // Get the current best score before resetting
        const currentBestScore = gameStateRef.current ? Math.max(gameStateRef.current.bestScore, Math.floor(gameStateRef.current.score)) : 0;

        gameStateRef.current = {
            ...INITIAL_STATE,
            gameSpeed: initialSpeed,
            playerY: height - groundHeight - PLAYER_SIZE - PLAYER_OFFSET_FROM_GROUND,
            scale: isMobile ? MOBILE_SCALE : 1,
            boxJumps: 0,
            lastBoxJumpTime: 0,
            isColliding: false,
            canBoxJump: false,
            currentBox: null,
            backgroundX: 0, // Reset background position
            // --- Reset Jump Bar State ---
            jumpBarValue: INITIAL_STATE.maxJumpBarValue, // Start full
            gameOverReason: null,
            xp: 0, // Reset XP
            bestScore: currentBestScore, // Preserve best score
            lastPowerupSpawnScore: 0, // Reset powerup spawn score tracking
        };

        // Also reset active particles on game reset
        gameStateRef.current.activeParticles.forEach(p => {
            p.active = false; // Mark as inactive
            if (gameStateRef.current.particlePool.length < MAX_PARTICLES) {
                 gameStateRef.current.particlePool.push(p);
            }
        });
        gameStateRef.current.activeParticles = [];

        // Ensure pool is full (optional, but good practice)
        // If any particles were somehow lost, recreate them
        const currentPoolSize = gameStateRef.current.particlePool.length + gameStateRef.current.activeParticles.length;
        if (currentPoolSize < MAX_PARTICLES) {
            for (let i = currentPoolSize; i < MAX_PARTICLES; i++) {
                 gameStateRef.current.particlePool.push({
                    id: nextParticleId++, // Need a global counter if pool size changes
                    active: false, x: 0, y: 0, vx: 0, vy: 0,
                    rotation: 0, rotationSpeed: 0, size: 0, color: '',
                    opacity: 0, fadeSpeed: 0.01, createdAt: 0, lifeSpan: 1000
                 });
            }
        }
    };

    const updatePlayer = (deltaTime: number) => {
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);

        // Update vertical movement
        state.yVelocity += state.gravity * deltaTime;
        state.playerY += state.yVelocity * deltaTime;

        // Update horizontal movement
        if (state.isJumping) {
            state.playerX += state.xVelocity * deltaTime;
            state.xVelocity *= AIR_RESISTANCE;

            if (state.isMovingLeft) {
                state.xVelocity = Math.max(
                    state.xVelocity - (INITIAL_MOVE_SPEED * AIR_CONTROL_MULTIPLIER * deltaTime),
                    -DIRECTIONAL_JUMP_HORIZONTAL_BOOST
                );
            } else if (state.isMovingRight) {
                state.xVelocity = Math.min(
                    state.xVelocity + (INITIAL_MOVE_SPEED * AIR_CONTROL_MULTIPLIER * deltaTime),
                    DIRECTIONAL_JUMP_HORIZONTAL_BOOST
                );
            }
        } else {
            if (state.isMovingLeft) {
                state.xVelocity = -INITIAL_MOVE_SPEED;
            } else if (state.isMovingRight) {
                state.xVelocity = INITIAL_MOVE_SPEED;
            } else {
                state.xVelocity = 0;
            }
            state.playerX += state.xVelocity * deltaTime;
        }

        // Ground collision
        const groundY = height - groundHeight - PLAYER_SIZE - PLAYER_OFFSET_FROM_GROUND;
        if (state.playerY > groundY) {
            state.playerY = groundY;
            state.yVelocity = 0;
            state.isJumping = false;
            state.jumpCount = 0;
            state.currentBox = null;
            state.xVelocity = 0;
            // Removed rotation reset to preserve spinning
        }

        // Check if player has fallen off current box
        if (state.currentBox) {
            const boxRight = state.currentBox.x + state.currentBox.width;
            const boxLeft = state.currentBox.x;
            
            if (state.playerX < boxLeft || 
                state.playerX + PLAYER_SIZE > boxRight || 
                state.playerY > state.currentBox.y - PLAYER_SIZE) {
                console.log('Falling off box');
                state.currentBox = null;
            }
        }

        // Horizontal bounds
        const minX = 0;
        const maxX = width - PLAYER_SIZE;
        state.playerX = Math.max(minX, Math.min(maxX, state.playerX));

        // Update rotation
        state.rotation += state.rotationSpeed * deltaTime;
        if (state.rotation > Math.PI * 2) {
            state.rotation -= Math.PI * 2;
        }
    };

    const updateObstacles = (deltaTime: number): boolean => { // Return boolean
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);
        
        // Move existing obstacles
        state.obstacles = state.obstacles.filter(obstacle => {
            obstacle.x -= state.gameSpeed;
            
            // Calculate the full width based on obstacle type
            let fullWidth = obstacle.width;
            if (obstacle.type === BOX_TYPES.STACKED_WALL) {
                // Account for front box, gap, and stacked boxes
                fullWidth = BOX_SIZE + 300 + BOX_SIZE; // Front box + gap + last stacked box
            }
            
            return obstacle.x + fullWidth > 0;
        });

        // Time-based obstacle spawning
        const currentTime = Date.now();
        if (!state.lastSpawnTime) {
            state.lastSpawnTime = currentTime;
        }

        if (currentTime - state.lastSpawnTime >= OBSTACLE_SPAWN_INTERVAL) {
            // Filter out arrangements of the same type as the last obstacle
            const availableArrangements = BOX_ARRANGEMENTS.filter(
                arrangement => arrangement.type !== state.lastObstacleType
            );

            // Select a random arrangement from the filtered list
            const boxConfig = availableArrangements[Math.floor(Math.random() * availableArrangements.length)];
            
            // Store the current type as the last type for next spawn
            state.lastObstacleType = boxConfig.type;

            // Calculate the full width for the new obstacle
            let obstacleWidth = BOX_SIZE;
            if (boxConfig.type === BOX_TYPES.STACKED_WALL) {
                obstacleWidth = BOX_SIZE + 300 + BOX_SIZE; // Front box + gap + last stacked box
            } else if (boxConfig.arrangement === 'horizontal') {
                obstacleWidth = BOX_SIZE * (boxConfig.hasChog ? 3 : boxConfig.count);
            }

            const obstacleY = height - groundHeight - 
                (boxConfig.arrangement === 'vertical' ? BOX_SIZE * boxConfig.count : BOX_SIZE);

            const newObstacle = {
                x: width + 100,
                y: obstacleY,
                width: obstacleWidth,
                height: BOX_SIZE * (boxConfig.arrangement === 'vertical' ? boxConfig.count : 1),
                type: boxConfig.type as Obstacle['type'],
                config: boxConfig
            };

            state.obstacles.push(newObstacle);
            state.lastSpawnTime = currentTime;
        }

        // Check collisions with boxes
        if (!state.powerupEffects.invincible && !state.deathAnimation.active) {
            const playerHitbox = {
                x: state.playerX,
                y: state.playerY,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE
            };

            for (const obstacle of state.obstacles) {
                if (obstacle.config) {
                    const { arrangement, count, hasChog } = obstacle.config;

                    if (obstacle.type === BOX_TYPES.STACKED_WALL) {
                        // Check collision with front box
                        const frontBoxHitbox = {
                            x: obstacle.x,
                            y: height - groundHeight - BOX_SIZE,
                            width: BOX_SIZE,
                            height: BOX_SIZE
                        };
                        if (checkCollisionWithBox(playerHitbox, frontBoxHitbox)) {
                            handleCollision(obstacle.x, frontBoxHitbox.y, obstacle);
                            return true; // Indicate collision occurred
                        }

                        // Check collision with stacked boxes
                        for (let i = 0; i < 4; i++) {
                            const stackedBoxHitbox = {
                                x: obstacle.x + BOX_SIZE * 3,  // Match the new visual position (3 box widths gap)
                                y: height - groundHeight - ((i + 1) * BOX_SIZE),
                                width: BOX_SIZE,
                                height: BOX_SIZE
                            };
                            if (checkCollisionWithBox(playerHitbox, stackedBoxHitbox)) {
                                handleCollision(stackedBoxHitbox.x, stackedBoxHitbox.y, obstacle);
                                return true; // Indicate collision occurred
                            }
                        }
                    } else if (arrangement === 'horizontal' && hasChog) {
                        // Check collision with first box
                        const box1Hitbox = {
                            x: obstacle.x,
                            y: obstacle.y,
                            width: BOX_SIZE,
                            height: BOX_SIZE
                        };
                        if (checkCollisionWithBox(playerHitbox, box1Hitbox)) {
                            handleCollision(obstacle.x, obstacle.y, obstacle);
                            return true; // Indicate collision occurred
                        }

                        // Check collision with chog (middle)
                        const chogHitbox = {
                            x: obstacle.x + BOX_SIZE,
                            y: obstacle.y,
                            width: BOX_SIZE,
                            height: BOX_SIZE
                        };
                        if (checkCollisionWithBox(playerHitbox, chogHitbox)) {
                            handleCollision(obstacle.x + BOX_SIZE, obstacle.y, obstacle);
                            return true; // Indicate collision occurred
                        }

                        // Check collision with second box
                        const box2Hitbox = {
                            x: obstacle.x + BOX_SIZE * 2,
                            y: obstacle.y,
                            width: BOX_SIZE,
                            height: BOX_SIZE
                        };
                        if (checkCollisionWithBox(playerHitbox, box2Hitbox)) {
                            handleCollision(obstacle.x + BOX_SIZE * 2, obstacle.y, obstacle);
                            return true; // Indicate collision occurred
                        }
                    } else if (obstacle.type === 'split_gap' && obstacle.config.gapSize && obstacle.config.bottomCount && obstacle.config.topCount) {
                        // Bottom boxes collision
                        for (let i = 0; i < obstacle.config.bottomCount; i++) {
                            const boxY = height - groundHeight - ((i + 1) * BOX_SIZE); // Adjusted Y position
                            const boxHitbox = {
                                x: obstacle.x,
                                y: boxY,
                                width: BOX_SIZE,
                                height: BOX_SIZE
                            };
                            
                            if (checkCollisionWithBox(playerHitbox, boxHitbox)) {
                                handleCollision(obstacle.x, boxY, obstacle);
                                return true; // Indicate collision occurred
                            }
                        }

                        // Check glass collision
                        const glassY = height - groundHeight - BOX_SIZE - (obstacle.config.bottomCount * BOX_SIZE);
                        const glassHitbox = {
                            x: obstacle.x,
                            y: glassY - BOX_SIZE,
                            width: BOX_SIZE,
                            height: BOX_SIZE
                        };

                        if (!state.glass.isBroken && checkCollision(playerHitbox, glassHitbox)) {
                            // Break the glass
                            state.glass.isBroken = true;
                            state.glass.breakStartTime = Date.now();
                            
                            // Create glass breaking particles with improved variety
                            const centerX = glassHitbox.x + BOX_SIZE / 2;
                            const centerY = glassHitbox.y + BOX_SIZE / 2;
                            const particleCount = 30;
                            
                            for (let i = 0; i < particleCount; i++) {
                                const angle = (Math.PI * 2 * i) / particleCount;
                                const speed = 5 + Math.random() * 7;
                                const distance = Math.random() * BOX_SIZE * 0.5;
                                
                                state.glass.particles.push({
                                    x: centerX + Math.cos(angle) * distance,
                                    y: centerY + Math.sin(angle) * distance,
                                    vx: Math.cos(angle) * speed,
                                    vy: Math.sin(angle) * speed - 2, // Add upward boost
                                    rotation: Math.random() * Math.PI * 2,
                                    size: 3 + Math.random() * 5,
                                    opacity: 1
                                });
                            }
                            
                            // Add breaking sound effect
                            if (typeof window !== 'undefined') {
                                const breakSound = new Audio('/assets/audio/glass-break.mp3');
                                breakSound.play().catch(error => {
                                    console.log('Glass break sound playback failed:', error);
                                });
                            }
                        }

                        // Top boxes collision
                        for (let i = 0; i < obstacle.config.topCount; i++) {
                            const boxY = height - groundHeight - ((i + obstacle.config.bottomCount + 2) * BOX_SIZE) - obstacle.config.gapSize;
                            const boxHitbox = {
                                x: obstacle.x,
                                y: boxY,
                                width: BOX_SIZE,
                                height: BOX_SIZE
                            };
                            
                            if (checkCollisionWithBox(playerHitbox, boxHitbox)) {
                                handleCollision(obstacle.x, boxY, obstacle);
                                return true; // Indicate collision occurred
                            }
                        }
                    } else {
                        // Handle other box arrangements
                        for (let i = 0; i < count; i++) {
                            const offsetX = arrangement === 'horizontal' ? i * BOX_SIZE : 0;
                            const offsetY = arrangement === 'vertical' ? i * BOX_SIZE : 0;

                            const boxHitbox = {
                                x: obstacle.x + offsetX,
                                y: obstacle.y + offsetY,
                                width: BOX_SIZE,
                                height: BOX_SIZE
                            };

                            if (checkCollisionWithBox(playerHitbox, boxHitbox)) {
                                handleCollision(obstacle.x + offsetX, obstacle.y + offsetY, obstacle);
                                return true; // Indicate collision occurred
                            }
                        }
                    }
                }
            }
        }

        // Update score with multiplier
        state.score += deltaTime * 10 * state.powerupEffects.scoreMultiplier;
        return false; // No collision occurred
    };

    const HITBOX_PADDING = 5; // Smaller hitbox than the sprite

    // Simple collision check for powerups
    const checkCollision = (rect1: any, rect2: any) => {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    };

    // More complex collision check for boxes with landing zones and directional jumping
    const checkCollisionWithBox = (playerHitbox: any, boxHitbox: any) => {
        const state = gameStateRef.current;
        // --- Prevent collision checks if game over ---
        if (state.gameOverReason || state.deathAnimation.active) return false;
        // ---

        // Get player's bottom center point
        const playerBottomCenterX = playerHitbox.x + playerHitbox.width / 2;
        const playerBottom = playerHitbox.y + playerHitbox.height;
        const boxTop = boxHitbox.y;

        // Check if player is falling
        const isFalling = state.yVelocity > 0;

        // Calculate horizontal overlap
        const isWithinHorizontalBounds = 
            playerBottomCenterX >= boxHitbox.x && 
            playerBottomCenterX <= boxHitbox.x + boxHitbox.width;

        // Calculate vertical overlap for landing with smoother transition zone
        const landingZoneHeight = 15; // Reduced landing zone height
        const isInLandingZone = 
            playerBottom >= boxTop - landingZoneHeight && 
            playerBottom <= boxTop + 5; // Reduced tolerance for more precise landing

        // For horizontal boxes, we want to be more lenient with the landing zone
        const isHorizontalBox = boxHitbox.width > BOX_SIZE;
        const landingThreshold = isHorizontalBox ? 20 : 15; // Reduced thresholds

        // Check for landing with smoother transition
        if (isFalling && isWithinHorizontalBounds && isInLandingZone) {
            // Smooth landing transition
            const landingProgress = (playerBottom - (boxTop - landingZoneHeight)) / landingZoneHeight;
            const smoothedVelocity = state.yVelocity * (1 - Math.min(1, landingProgress));

            // Safe landing
            state.currentBox = {
                x: boxHitbox.x,
                y: boxHitbox.y,
                width: boxHitbox.width,
                height: boxHitbox.height
            };

            // Position player on top of box with minimal interpolation
            state.playerY = boxTop - PLAYER_SIZE;  // Removed interpolation
            state.yVelocity = 0;  // Removed smoothing for immediate stop
            state.isJumping = false;
            state.jumpCount = 0;

            return false; // Landed successfully
        }

        // Check for collision with the box body with improved precision
        const hasVerticalOverlap = 
            playerHitbox.y < boxHitbox.y + boxHitbox.height - 2 && // Small tolerance
            playerHitbox.y + playerHitbox.height > boxHitbox.y + 2; // Small tolerance

        const hasHorizontalOverlap = 
            playerHitbox.x < boxHitbox.x + boxHitbox.width - 2 && // Small tolerance
            playerHitbox.x + playerHitbox.width > boxHitbox.x + 2; // Small tolerance

        // Add protection for side collisions when jumping
        if (state.isJumping && hasVerticalOverlap && hasHorizontalOverlap) {
            // Calculate how much the player overlaps horizontally with the box
            const playerRight = playerHitbox.x + playerHitbox.width;
            const boxRight = boxHitbox.x + boxHitbox.width;
            
            // Check if the player is mostly on the side of the box
            const leftOverlap = playerRight - boxHitbox.x;
            const rightOverlap = boxRight - playerHitbox.x;
            const minOverlap = Math.min(leftOverlap, rightOverlap);
            
            // If overlap is small and player is moving, push them to the side instead of killing them
            if (minOverlap < PLAYER_SIZE * 0.4) {
                // Player is more on the left side of the box
                if (leftOverlap < rightOverlap) {
                    state.playerX = boxHitbox.x - PLAYER_SIZE - 1;
                    state.xVelocity = Math.min(state.xVelocity, -100); // Push player left
                } 
                // Player is more on the right side of the box
                else {
                    state.playerX = boxRight + 1;
                    state.xVelocity = Math.max(state.xVelocity, 100); // Push player right
                }
                return false; // No collision, just repositioning
            }
            
            // Also check for barely-miss vertical collisions
            // If player's bottom is very close to the top of the box, snap to the top instead
            if (Math.abs(playerBottom - boxTop) < 10) {
                state.playerY = boxTop - PLAYER_SIZE;
                state.yVelocity = 0;
                state.isJumping = false;
                state.jumpCount = 0;
                
                state.currentBox = {
                    x: boxHitbox.x,
                    y: boxHitbox.y,
                    width: boxHitbox.width,
                    height: boxHitbox.height
                };
                
                return false;
            }
        }

        // Return true if there's both vertical and horizontal overlap and not in landing zone
        return hasVerticalOverlap && hasHorizontalOverlap && !isInLandingZone;
    };

    const updatePowerups = (deltaTime: number) => {
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);

        // --- Don't update if game over ---
        if (state.gameOverReason || state.deathAnimation.active) return;
        // ---

        // Move existing powerups
        state.powerups = state.powerups.filter(powerup => {
            powerup.x -= state.gameSpeed;
            return powerup.x + POWERUP_SIZE > 0;
        });

        // Spawn new powerups based on score interval
        const POWERUP_SPAWN_INTERVAL_SCORE = 200;
        if (state.score - state.lastPowerupSpawnScore >= POWERUP_SPAWN_INTERVAL_SCORE && state.powerups.length < 2) {
            const powerupTypes: Array<'score' | 'doubleJump' | 'coinMagnet' | 'timeReset'> = ['score', 'doubleJump', 'coinMagnet', 'timeReset']; // Add new types
            const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];

            // Position powerups at varying heights above ground
            const powerupY = height - groundHeight - POWERUP_SIZE -
                Math.random() * (PLAYER_SIZE * 3);

            state.powerups.push({
                x: width,
                y: powerupY,
                width: POWERUP_SIZE,
                height: POWERUP_SIZE,
                type
            });
            state.lastPowerupSpawnScore = Math.floor(state.score); // Update the score at which the last powerup was spawned
        }

        // Check collisions with powerups
        const playerHitbox = {
            x: state.playerX,
            y: state.playerY,
            width: PLAYER_SIZE,
            height: PLAYER_SIZE
        };

        state.powerups = state.powerups.filter(powerup => {
            if (!powerup.active && checkCollision(playerHitbox, powerup)) {
                activatePowerup(powerup.type, powerup.x, powerup.y);
                return false;
            }
            return true;
        });

        // Update floating texts
        state.floatingTexts = state.floatingTexts.filter(text => {
            const age = (Date.now() - text.createdAt) / 1000;
            if (age > 1) return false; // Remove after 1 second
            text.y -= 50 * deltaTime; // Float upward
            text.opacity = 1 - age; // Fade out
            return true;
        });
    };

    const activatePowerup = (type: 'score' | 'doubleJump' | 'coinMagnet' | 'timeReset', x: number, y: number) => {
        const state = gameStateRef.current;

        // Define power-up names and durations
        const powerupInfo = {
            score: { name: '2x Score!', duration: 5000 },
            doubleJump: { name: 'Triple Jump!', duration: 7000 },
            coinMagnet: { name: 'Coin Magnet!', duration: 5000 }, // Assuming 5s duration
            timeReset: { name: 'Time Warp!', duration: 3000 }   // Assuming 3s duration
        };

        // Clear any existing timeouts for this power-up type
        if (state.powerupTimeouts?.[type]) {
            clearTimeout(state.powerupTimeouts[type]);
        }

        // Replenish jump bar by 1 unit
        state.jumpBarValue = Math.min(
            state.maxJumpBarValue,
            state.jumpBarValue + 1
        );
        console.log('Jump Bar +1 from power-up:', state.jumpBarValue);

        // Add floating text
        state.floatingTexts.push({
            text: powerupInfo[type].name,
            x: x + POWERUP_SIZE,
            y,
            opacity: 1,
            createdAt: Date.now()
        });

        // --- Trigger Power-up Display Animation ---
        state.powerupDisplay = {
            type: type,
            startTime: Date.now(),
            scale: 0,
            opacity: 0,
        };
        // ---

        const duration = powerupInfo[type].duration;

        // Apply effect and set timeout to remove it
        switch (type) {
            case 'score':
                state.powerupEffects.scoreMultiplier = 2;
                state.powerupTimeouts.score = setTimeout(() => {
                    state.powerupEffects.scoreMultiplier = 1;
                }, duration);
                break;
            case 'doubleJump':
                state.powerupEffects.doubleJump = true;
                state.maxJumps = 3;
                state.powerupTimeouts.doubleJump = setTimeout(() => {
                    state.powerupEffects.doubleJump = false;
                    state.maxJumps = 2;
                }, duration);
                break;
            case 'coinMagnet':
                state.powerupEffects.coinMagnet = true;
                // TODO: Implement coin magnet logic in updateCoins?
                console.log('Coin Magnet Activated!');
                state.powerupTimeouts.coinMagnet = setTimeout(() => {
                    state.powerupEffects.coinMagnet = false;
                    console.log('Coin Magnet Deactivated.');
                }, duration);
                break;
            case 'timeReset':
                state.powerupEffects.timeResetActive = true;
                // TODO: Implement time reset logic (e.g., slower jump bar depletion?)
                console.log('Time Reset Activated!');
                
                // --- Reset Jump Bar --- 
                state.jumpBarValue = state.maxJumpBarValue;
                console.log('Jump Bar Reset by Time Warp:', state.jumpBarValue);
                // ---
                
                state.powerupTimeouts.timeReset = setTimeout(() => {
                    state.powerupEffects.timeResetActive = false;
                    console.log('Time Reset Deactivated.');
                }, duration);
                break;
        }
    };

    const updateParticles = (deltaTime: number) => {
        const state = gameStateRef.current;
        const now = Date.now();

        for (let i = state.activeParticles.length - 1; i >= 0; i--) {
            const particle = state.activeParticles[i];
            const age = now - particle.createdAt;

            // Check lifetime or opacity
            if (!particle.active || age > particle.lifeSpan || particle.opacity <= 0) {
                returnParticleToPool(particle);
                continue; // Skip update for this particle
            }

            // Update particle physics
            particle.x += particle.vx * deltaTime * 60; // Scale velocity by time
            particle.y += particle.vy * deltaTime * 60;
            particle.vy += 0.05; // Simple gravity
            particle.rotation += particle.rotationSpeed * deltaTime * 60;
            particle.opacity -= particle.fadeSpeed * deltaTime * 60; // Fade based on time
            particle.opacity = Math.max(0, particle.opacity); // Clamp opacity
            // Optional: Update size over time if needed
        }
    };

    const updateGame = (deltaTime: number) => {
        const state = gameStateRef.current;

        // --- Check for game over conditions FIRST --- 
        if (state.jumpBarValue <= 0 && !state.gameOverReason) {
            state.gameOverReason = 'jumpBarDepleted';
            console.log('Game Over: Jump Bar Depleted');
            if (tickingSound) {
                tickingSound.pause();
                tickingSound.currentTime = 0;
            }
            // Trigger game over immediately - Pass results object
            onGameOver({ 
                score: Math.floor(state.score), 
                boxJumps: state.boxJumps, 
                coinCount: state.coinCount, 
                xp: state.xp 
            });
            // We can potentially return here if needed, as game logic stops
            // return;
        }
        
        // --- Core Update Logic (Runs unless explicitly game over) --- 
        if (!state.gameOverReason) { 
            // Update best score if current score is higher
            if (Math.floor(state.score) > state.bestScore) {
                state.bestScore = Math.floor(state.score);
            }

            // Update time and increase speed (Only if not in death animation)
            if (!state.deathAnimation.active) {
                state.timeSinceStart += deltaTime;
                if (state.timeSinceStart > SPEED_INCREASE_INTERVAL) {
                    state.timeSinceStart = 0;
                    state.gameSpeed = Math.min(state.gameSpeed + SPEED_INCREASE_AMOUNT, MAX_GAME_SPEED);
                }
            }
            
            // Update background position (always scrolls)
            const backgroundScrollSpeed = state.gameSpeed * 0.2; 
            state.backgroundX -= backgroundScrollSpeed;

            // Update chog rotation (always rotates)
            state.chogRotation += CHOG_ROTATION_SPEED * deltaTime;
            if (state.chogRotation > Math.PI * 2) {
                state.chogRotation -= Math.PI * 2;
            }
            
            // Update Gameplay elements only if death animation is not active
            if (!state.deathAnimation.active) {
                updatePlayer(deltaTime);
                const collided = updateObstacles(deltaTime); 
                if (collided) {
                    // Collision is handled by handleCollision, which sets gameOverReason
                    // We don't need to return here anymore, let the loop continue for animation
                } else {
                    // Only update these if no collision occurred this frame
                    updatePowerups(deltaTime);
                    updateCoins(deltaTime);
                }
                
                // Jump Bar Logic (depletion)
                state.jumpBarValue -= state.jumpBarDepletionRate * deltaTime;
                state.jumpBarValue = Math.max(0, state.jumpBarValue); 
                
                // Handle ticking sound based on jump bar value
                if (tickingSound) {
                    if (state.jumpBarValue <= 10 && state.jumpBarValue > 0) {
                        if (tickingSound.paused) {
                            tickingSound.play().catch(error => console.log('Ticking sound failed:', error));
                        }
                    } else {
                        if (!tickingSound.paused) {
                            tickingSound.pause();
                            tickingSound.currentTime = 0;
                        }
                    }
                }
            }
        }
        
        // --- Update Animations (Run even during death sequence) --- 
        // Update Power-up Display Animation
        if (state.powerupDisplay && state.powerupDisplay.startTime) {
            const animationDuration = 1500; // Total duration in ms (1.5 seconds)
            const scaleUpDuration = 300; // Time to scale up (0.3s)
            const holdDuration = 700; // Time to hold full size (0.7s)
            const fadeOutStartTime = scaleUpDuration + holdDuration; // Start fading after 1s
            
            const elapsed = Date.now() - state.powerupDisplay.startTime;

            if (elapsed < animationDuration) {
                if (elapsed < scaleUpDuration) {
                    // Phase 1: Scale up and fade in
                    const progress = elapsed / scaleUpDuration;
                    state.powerupDisplay.scale = progress * 1.2; // Scale up slightly bigger
                    state.powerupDisplay.opacity = progress;
                } else if (elapsed < fadeOutStartTime) {
                    // Phase 2: Hold (scale down slightly)
                    state.powerupDisplay.scale = 1.0;
                    state.powerupDisplay.opacity = 1;
                } else {
                    // Phase 3: Fade out
                    const fadeProgress = (elapsed - fadeOutStartTime) / (animationDuration - fadeOutStartTime);
                    state.powerupDisplay.opacity = 1 - fadeProgress;
                    state.powerupDisplay.scale = 1.0; // Keep scale during fade
                }
            } else {
                // Animation complete
                state.powerupDisplay = null;
            }
        }

        // Update glass breaking animation
        if (state.glass.isBroken && state.glass.breakStartTime) {
            const breakDuration = 0.5; // Duration of break animation in seconds
            const elapsed = (Date.now() - state.glass.breakStartTime) / 1000;
            if (elapsed < breakDuration) {
                // Smooth fade out
                state.glass.opacity = 1 - (elapsed / breakDuration);
            } else {
                state.glass.opacity = 0;
            }
        }

        // Update Particles (Always run to let them fade out)
        updateParticles(deltaTime);
        
        // Update Death Animation state if active
        if (state.deathAnimation.active) {
            state.deathAnimation.characterPos.x += state.deathAnimation.characterVel.x;
            state.deathAnimation.characterPos.y += state.deathAnimation.characterVel.y;
            state.deathAnimation.characterVel.y += 0.7; // Gravity for death animation
            state.deathAnimation.characterRotation += state.deathAnimation.characterRotationSpeed;
            // Potentially add fade out or other effects here
            // Check if animation is complete (e.g., character off screen)
            if (state.deathAnimation.characterPos.y > height + PLAYER_SIZE) { // Example completion condition
                 state.deathAnimation.complete = true;
                 // Note: onGameOver is called by handleCollision's setTimeout
            }
        }
    };

    const updateCoins = (deltaTime: number) => {
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);

        // Player center coordinates
        const playerCenterX = state.playerX + PLAYER_SIZE / 2;
        const playerCenterY = state.playerY + PLAYER_SIZE / 2;

        // Move existing coins
        state.coins = state.coins.filter(coin => {
            if (coin.collected) return false;

            // --- Basic Coin Movement --- 
            coin.x -= state.gameSpeed * deltaTime * 60; // Adjusted for deltaTime

            // Update coin animation frame every 50ms
            const now = Date.now();
            if (now - coin.lastFrameUpdate > 50) {
                coin.frame = (coin.frame + 1) % 16; // 16 frames total
                coin.lastFrameUpdate = now;
            }

            // --- Coin Collection Logic --- 
            const coinCenterX = coin.x + coin.width / 2;
            const coinCenterY = coin.y + coin.height / 2;

            // Check if Coin Magnet is active
            if (state.powerupEffects.coinMagnet) {
                const dx = playerCenterX - coinCenterX;
                const dy = playerCenterY - coinCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // If coin is within magnet radius
                if (distance < COIN_MAGNET_RADIUS) {
                    // Calculate normalized direction vector towards player
                    const directionX = dx / distance;
                    const directionY = dy / distance;

                    // Apply magnet force
                    coin.x += directionX * COIN_MAGNET_STRENGTH * deltaTime;
                    coin.y += directionY * COIN_MAGNET_STRENGTH * deltaTime;

                    // Check for collection based on proximity (e.g., within half player size)
                    if (distance < PLAYER_SIZE / 2) {
                        collectCoin(coin);
                        return false; // Remove coin after collection
                    }
                } else {
                    // If outside radius, check for normal collision
                    const playerHitbox = { x: state.playerX, y: state.playerY, width: PLAYER_SIZE, height: PLAYER_SIZE };
                    const coinHitbox = { x: coin.x, y: coin.y, width: coin.width, height: coin.height };
                    if (checkCollision(playerHitbox, coinHitbox)) {
                        collectCoin(coin);
                        return false; // Remove coin after collection
                    }
                }
            } else {
                // If magnet is not active, perform standard collision check
                const playerHitbox = { x: state.playerX, y: state.playerY, width: PLAYER_SIZE, height: PLAYER_SIZE };
                const coinHitbox = { x: coin.x, y: coin.y, width: coin.width, height: coin.height };
                if (checkCollision(playerHitbox, coinHitbox)) {
                    collectCoin(coin);
                    return false; // Remove coin after collection
                }
            }

            // Keep coin if still on screen
            return coin.x + coin.width > 0;
        });

        // Spawn new coins (keep existing spawn logic)
        if (Math.random() < 0.03 && state.coins.length < 5) { // Adjust spawn rate as needed
            const coinSize = 30;
            const minHeight = height - groundHeight - PLAYER_SIZE * 3;
            const maxHeight = height - groundHeight - coinSize;
            const coinY = minHeight + Math.random() * (maxHeight - minHeight);

            state.coins.push({
                x: width + coinSize,
                y: coinY,
                width: coinSize,
                height: coinSize,
                collected: false,
                frame: 0,
                lastFrameUpdate: Date.now(),
                value: 10
            });
        }
    };

    const collectCoin = (coin: GameState['coins'][0]) => {
        const state = gameStateRef.current;
        
        // Add score
        state.score += coin.value * state.powerupEffects.scoreMultiplier;
        state.coinCount++;

        // Replenish jump bar by 1 unit
        state.jumpBarValue = Math.min(
            state.maxJumpBarValue,
            state.jumpBarValue + 1
        );
        console.log('Jump Bar +1 from coin:', state.jumpBarValue);

        // Play coin collection sound
        const coinSound = new Audio('/assets/audio/coin.mp3');
        coinSound.volume = 0.3;
        coinSound.play().catch(error => {
            console.log('Coin sound playback failed:', error);
        });

        // Add sparkle particles using the pool
        for (let i = 0; i < 8; i++) {
            const particle = getParticleFromPool();
            if (particle) {
                const angle = (Math.PI * 2 * i) / 8;
                const speed = 2 + Math.random() * 2;
                particle.x = coin.x + coin.width / 2;
                particle.y = coin.y + coin.height / 2;
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed - 2; // Slight upward drift
                particle.rotation = Math.random() * Math.PI * 2;
                particle.rotationSpeed = Math.random() * 0.2;
                particle.size = 3 + Math.random() * 3;
                particle.color = '#FFD700'; // Gold color
                particle.opacity = 1;
                particle.fadeSpeed = 0.025 + Math.random() * 0.01;
                particle.lifeSpan = 400 + Math.random() * 200; // Shorter lifespan for sparkles
            }
        }
    };

    const drawGlass = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, isBroken: boolean, opacity: number) => {
        if (opacity <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Draw glass background with gradient for more realistic look
        const glassGradient = ctx.createLinearGradient(x, y, x + width, y + height);
        glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        glassGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        glassGradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
        ctx.fillStyle = glassGradient;
        ctx.fillRect(x, y, width, height);
        
        // Draw glass border with gradient
        const borderGradient = ctx.createLinearGradient(x, y, x + width, y);
        borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        borderGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
        ctx.strokeStyle = borderGradient;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Draw glass reflections
        ctx.beginPath();
        ctx.moveTo(x + width * 0.1, y);
        ctx.lineTo(x + width * 0.3, y + height * 0.3);
        ctx.lineTo(x + width * 0.7, y + height * 0.3);
        ctx.lineTo(x + width * 0.9, y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();
        
        if (isBroken) {
            // Draw crack pattern
            ctx.beginPath();
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            
            // Create a radial crack pattern
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i) / 8;
                const length = Math.min(width, height) * 0.4;
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(
                    centerX + Math.cos(angle) * length,
                    centerY + Math.sin(angle) * length
                );
            }
            
            // Add some random connecting cracks
            for (let i = 0; i < 5; i++) {
                const angle1 = Math.random() * Math.PI * 2;
                const angle2 = Math.random() * Math.PI * 2;
                const radius = Math.min(width, height) * 0.3;
                const x1 = centerX + Math.cos(angle1) * radius;
                const y1 = centerY + Math.sin(angle1) * radius;
                const x2 = centerX + Math.cos(angle2) * radius;
                const y2 = centerY + Math.sin(angle2) * radius;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        ctx.restore();
    };

    const drawObstacle = (ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
        if (obstacle.config && boxImage && boxImage.complete) {
            const { arrangement, count, hasChog } = obstacle.config;
            const groundHeight = getGroundHeight(height);

            if (obstacle.type === BOX_TYPES.STACKED_WALL) {
                // Draw the stacked boxes first (in the back)
                for (let i = 0; i < 4; i++) {
                    ctx.drawImage(
                        boxImage,
                        obstacle.x + BOX_SIZE * 3,  // Increased to 3 box widths (150px) gap
                        height - groundHeight - ((i + 1) * BOX_SIZE),
                        BOX_SIZE,
                        BOX_SIZE
                    );
                }

                // Draw the single box in front
                ctx.drawImage(
                    boxImage,
                    obstacle.x,
                    height - groundHeight - BOX_SIZE,
                    BOX_SIZE,
                    BOX_SIZE
                );
            } else if (arrangement === 'horizontal' && hasChog) {
                // Draw first box
                ctx.drawImage(
                    boxImage,
                    obstacle.x,
                    obstacle.y,
                    BOX_SIZE,
                    BOX_SIZE
                );

                // Draw rotating chog in the middle
                if (obstacleImages.ground && obstacleImages.ground.complete) {
                    ctx.save();
                    // Set rotation center to middle of the chog
                    ctx.translate(
                        obstacle.x + BOX_SIZE + BOX_SIZE / 2,
                        obstacle.y + BOX_SIZE / 2
                    );
                    ctx.rotate(gameStateRef.current.chogRotation);
                    ctx.drawImage(
                        obstacleImages.ground,
                        -BOX_SIZE / 2, // Adjust x position for centered rotation
                        -BOX_SIZE / 2, // Adjust y position for centered rotation
                        BOX_SIZE,
                        BOX_SIZE
                    );
                    ctx.restore();
                }

                // Draw second box
                ctx.drawImage(
                    boxImage,
                    obstacle.x + BOX_SIZE * 2,
                    obstacle.y,
                    BOX_SIZE,
                    BOX_SIZE
                );
            } else if (obstacle.type === 'split_gap' && obstacle.config.gapSize && obstacle.config.bottomCount && obstacle.config.topCount) {
                // Draw bottom boxes vertically stacked from ground level
                for (let i = 0; i < obstacle.config.bottomCount; i++) {
                    const boxY = height - groundHeight - ((i + 1) * BOX_SIZE);
                    ctx.drawImage(
                        boxImage,
                        obstacle.x,
                        boxY,
                        BOX_SIZE,
                        BOX_SIZE
                    );
                }

                // Draw glass in the gap
                if (obstacle.config.gapSize > 0) {
                    const glassY = height - groundHeight - BOX_SIZE - (obstacle.config.bottomCount * BOX_SIZE);
                    const glassHeight = BOX_SIZE;
                    drawGlass(
                        ctx,
                        obstacle.x,
                        glassY - glassHeight,
                        BOX_SIZE,
                        glassHeight,
                        gameStateRef.current.glass.isBroken,
                        gameStateRef.current.glass.opacity
                    );
                }

                // Draw top boxes vertically stacked
                for (let i = 0; i < obstacle.config.topCount; i++) {
                    const boxY = height - groundHeight - ((i + obstacle.config.bottomCount + 2) * BOX_SIZE) - 
                        (obstacle.config.gapSize || 0);
                    ctx.drawImage(
                        boxImage,
                        obstacle.x,
                        boxY,
                        BOX_SIZE,
                        BOX_SIZE
                    );
                }
            } else {
                // Handle existing arrangements
                for (let i = 0; i < count; i++) {
                    const offsetX = arrangement === 'horizontal' ? i * BOX_SIZE : 0;
                    const offsetY = arrangement === 'vertical' ? i * BOX_SIZE : 0;

                    ctx.drawImage(
                        boxImage,
                        obstacle.x + offsetX,
                        obstacle.y + offsetY,
                        BOX_SIZE,
                        BOX_SIZE
                    );
                }
            }
        }
    };

    const drawDebugInfo = (ctx: CanvasRenderingContext2D, state: GameState) => {
        if (!state.debug.enabled) return;

        ctx.save();
        
        // Set debug drawing style
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.lineWidth = 2;

        // Draw player hitbox
        const playerHitbox = {
            x: state.playerX + HITBOX_PADDING,
            y: state.playerY + HITBOX_PADDING,
            width: PLAYER_SIZE - (HITBOX_PADDING * 2),
            height: PLAYER_SIZE - (HITBOX_PADDING * 2)
        };
        
        ctx.strokeRect(playerHitbox.x, playerHitbox.y, playerHitbox.width, playerHitbox.height);
        ctx.fillRect(playerHitbox.x, playerHitbox.y, playerHitbox.width, playerHitbox.height);

        // Draw player velocity vector
        ctx.beginPath();
        ctx.strokeStyle = 'blue';
        ctx.moveTo(state.playerX + PLAYER_SIZE / 2, state.playerY + PLAYER_SIZE / 2);
        ctx.lineTo(
            state.playerX + PLAYER_SIZE / 2 + state.xVelocity * 0.1,
            state.playerY + PLAYER_SIZE / 2 + state.yVelocity * 0.1
        );
        ctx.stroke();

        // Draw obstacles hitboxes and landing zones
        state.obstacles.forEach(obstacle => {
            if (obstacle.config) {
                const { arrangement, count, hasChog } = obstacle.config;

                // Draw landing zones in green
                ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';

                if (arrangement === 'horizontal' && hasChog) {
                    // Draw landing zones for horizontal arrangement with chog
                    [0, 2].forEach(i => {
                        ctx.fillRect(
                            obstacle.x + i * BOX_SIZE,
                            obstacle.y - 40,
                            BOX_SIZE,
                            40
                        );
                        ctx.strokeRect(
                            obstacle.x + i * BOX_SIZE,
                            obstacle.y - 40,
                            BOX_SIZE,
                            40
                        );
                    });
                } else {
                    // Draw landing zones for other arrangements
                    for (let i = 0; i < count; i++) {
                        const offsetX = arrangement === 'horizontal' ? i * BOX_SIZE : 0;
                        const offsetY = arrangement === 'vertical' ? i * BOX_SIZE : 0;
                        
                        ctx.fillRect(
                            obstacle.x + offsetX,
                            obstacle.y + offsetY - 40,
                            BOX_SIZE,
                            40
                        );
                        ctx.strokeRect(
                            obstacle.x + offsetX,
                            obstacle.y + offsetY - 40,
                            BOX_SIZE,
                            40
                        );
                    }
                }

                // Draw hitboxes in red
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';

                if (arrangement === 'horizontal' && hasChog) {
                    // Draw hitboxes for all three parts
                    for (let i = 0; i < 3; i++) {
                        ctx.strokeRect(
                            obstacle.x + i * BOX_SIZE + HITBOX_PADDING,
                            obstacle.y + HITBOX_PADDING,
                            BOX_SIZE - (HITBOX_PADDING * 2),
                            BOX_SIZE - (HITBOX_PADDING * 2)
                        );
                        ctx.fillRect(
                            obstacle.x + i * BOX_SIZE + HITBOX_PADDING,
                            obstacle.y + HITBOX_PADDING,
                            BOX_SIZE - (HITBOX_PADDING * 2),
                            BOX_SIZE - (HITBOX_PADDING * 2)
                        );
                    }
                } else {
                    // Draw hitboxes for other arrangements
                    for (let i = 0; i < count; i++) {
                        const offsetX = arrangement === 'horizontal' ? i * BOX_SIZE : 0;
                        const offsetY = arrangement === 'vertical' ? i * BOX_SIZE : 0;
                        
                        ctx.strokeRect(
                            obstacle.x + offsetX + HITBOX_PADDING,
                            obstacle.y + offsetY + HITBOX_PADDING,
                            BOX_SIZE - (HITBOX_PADDING * 2),
                            BOX_SIZE - (HITBOX_PADDING * 2)
                        );
                        ctx.fillRect(
                            obstacle.x + offsetX + HITBOX_PADDING,
                            obstacle.y + offsetY + HITBOX_PADDING,
                            BOX_SIZE - (HITBOX_PADDING * 2),
                            BOX_SIZE - (HITBOX_PADDING * 2)
                        );
                    }
                }
            }
        });

        // Draw debug text
        ctx.font = '14px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        
        const debugInfo = [
            `Debug Mode: ON`,
            `Position: (${Math.round(state.playerX)}, ${Math.round(state.playerY)})`,
            `Velocity: (${Math.round(state.xVelocity)}, ${Math.round(state.yVelocity)})`,
            `Jumping: ${state.isJumping}`,
            `Jump Count: ${state.jumpCount}/${state.maxJumps}`,
            `On Box: ${state.currentBox ? 'Yes' : 'No'}`
        ];

        // Add death cause if available
        if (state.deathAnimation.active && state.debug.lastDeathCause) {
            debugInfo.push(
                `Death Cause:`,
                `- Type: ${state.debug.lastDeathCause.type}`,
                `- Position: (${Math.round(state.debug.lastDeathCause.x)}, ${Math.round(state.debug.lastDeathCause.y)})`,
                `- Impact Velocity: ${Math.round(state.debug.lastDeathCause.velocity)}`
            );
        }

        debugInfo.forEach((text, i) => {
            ctx.fillText(text, 10, height - 120 + (i * 20));
        });
        
        ctx.restore();
    };

    // Update drawGame to call drawPowerupIcons
    const drawGame = (ctx: CanvasRenderingContext2D) => {
        const state = gameStateRef.current; 
        const groundHeight = getGroundHeight(height);

        // Calculate screen shake offset
        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        
        if (state.screenShake.duration > 0) {
            const elapsed = Date.now() - state.screenShake.startTime;
            const progress = elapsed / state.screenShake.duration;
            
            if (progress < 1) {
                const decreasing = state.screenShake.intensity * (1 - progress);
                shakeOffsetX = (Math.random() - 0.5) * 2 * decreasing;
                shakeOffsetY = (Math.random() - 0.5) * 2 * decreasing;
            }
        }

        ctx.save(); 
        ctx.translate(shakeOffsetX, shakeOffsetY);

        // Clear canvas
        ctx.fillStyle = '#87CEEB'; // Or use SVG's sky gradient if preferred
        ctx.fillRect(0, 0, width, height);

        // Draw scrolling city background
        if (cityBackgroundImage && cityBackgroundImage.complete && cityBackgroundImage.width > 0) {
            const bgRatio = height / cityBackgroundImage.height; // Scale based on canvas height
            const bgWidth = cityBackgroundImage.width * bgRatio; // Scaled width of the bg image
            const bgHeight = height;

            if (bgWidth > 0) {
                // Calculate the effective X offset for drawing, ensuring it wraps correctly
                // Add bgWidth before modulo to handle negative backgroundX values properly
                const effectiveX = ((state.backgroundX % bgWidth) + bgWidth) % bgWidth;

                // Draw the first instance of the background
                ctx.drawImage(cityBackgroundImage, effectiveX, 0, bgWidth, bgHeight);

                // Draw the second instance immediately to the left of the first to cover the wrap-around
                ctx.drawImage(cityBackgroundImage, effectiveX - bgWidth, 0, bgWidth, bgHeight);
                
                // OPTIONAL: Draw a third instance if canvas is wider than 2x bgWidth (unlikely needed with wide SVG)
                // if (width > bgWidth) { // Draw if needed to fill space beyond the second image
                //     ctx.drawImage(cityBackgroundImage, effectiveX + bgWidth, 0, bgWidth, bgHeight);
                // }
            }
        }

        // Draw cartoon-style ground
        ctx.save();

        // Create main ground gradient with more vibrant colors
        const groundGradient = ctx.createLinearGradient(0, height - groundHeight, 0, height);
        groundGradient.addColorStop(0, '#9B6647');    // Lighter warm brown at top
        groundGradient.addColorStop(0.4, '#7D4B32');  // Mid warm brown
        groundGradient.addColorStop(1, '#5C3522');    // Dark warm brown at bottom

        ctx.fillStyle = groundGradient;
        ctx.fillRect(0, height - groundHeight, width, groundHeight);

        // Add playful wavy pattern on top
        ctx.beginPath();
        ctx.moveTo(0, height - groundHeight);
        for (let x = 0; x <= width; x += 60) {
            const waveHeight = 2;
            const y = height - groundHeight + Math.sin(x * 0.05) * waveHeight;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = '#8B5E3C';
        ctx.fill();

        // Add cartoon-style dots/spots pattern with reduced density
        ctx.fillStyle = 'rgba(123, 63, 0, 0.15)';
        for (let x = 0; x < width; x += 40) {
            for (let y = height - groundHeight + 10; y < height; y += 40) {
                const spotSize = 3 + Math.random() * 3;
                const randomOffset = Math.random() * 5;
                ctx.beginPath();
                ctx.arc(x + randomOffset, y + randomOffset, spotSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Add grass tufts with reduced density
        for (let x = 0; x < width; x += 25) {
            const grassHeight = 3 + Math.random() * 4;
            const grassWidth = 2;
            
            // Draw each tuft as a small triangle
            ctx.beginPath();
            ctx.moveTo(x, height - groundHeight);
            ctx.lineTo(x + grassWidth, height - groundHeight - grassHeight);
            ctx.lineTo(x + grassWidth * 2, height - groundHeight);
            ctx.closePath();
            
            // Random grass colors with reduced contrast
            ctx.fillStyle = Math.random() > 0.5 ? '#3A7734' : '#2D5A27';
            ctx.fill();
        }

        // Add highlight line with reduced frequency
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height - groundHeight + 2);
        for (let x = 0; x <= width; x += 80) {
            const y = height - groundHeight + 2 + Math.sin(x * 0.03) * 1.5;
            ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.restore();

        // Draw obstacles
        state.obstacles.forEach(obstacle => {
            drawObstacle(ctx, obstacle);
        });

        // Update and draw glass particles
        if (state.glass.isBroken) {
            state.glass.particles = state.glass.particles.filter(particle => {
                if (particle.opacity <= 0) return false;

                ctx.save();
                ctx.globalAlpha = particle.opacity;
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.rotation);
                
                // Draw glass shard
                ctx.beginPath();
                ctx.moveTo(0, -particle.size);
                ctx.lineTo(particle.size, 0);
                ctx.lineTo(0, particle.size);
                ctx.lineTo(-particle.size, 0);
                ctx.closePath();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.stroke();
                
                ctx.restore();

                // Update particle
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.vy += 0.5; // Add gravity
                particle.rotation += 0.1;
                particle.opacity -= 0.02;
                particle.size *= 0.99;

                return true;
            });
        }

        // Draw player OR death animation character
        if (state.deathAnimation.active) {
            // Draw the character at the death animation position/rotation
            ctx.save();
            ctx.translate(
                state.deathAnimation.characterPos.x + PLAYER_SIZE / 2,
                state.deathAnimation.characterPos.y + PLAYER_SIZE / 2
            );
            ctx.rotate(state.deathAnimation.characterRotation);
            // Apply fade out if implemented
            // ctx.globalAlpha = state.deathAnimation.characterOpacity; 

            // Check images are loaded AND not null before drawing
            if (characterImages.body && characterImages.body.complete) {
                ctx.drawImage(characterImages.body, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            }
            if (characterImages.fur && characterImages.fur.complete) {
                ctx.drawImage(characterImages.fur, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            }
            if (characterImages.eyes && characterImages.eyes.complete) {
                ctx.drawImage(characterImages.eyes, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            }
            if (characterImages.nose && characterImages.nose.complete) {
                ctx.drawImage(characterImages.nose, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            }
            if (characterImages.mouth && characterImages.mouth.complete) {
                ctx.drawImage(characterImages.mouth, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            }
            ctx.restore();
        } else if (!state.gameOverReason) {
             // Draw the normal player if not game over and not in death animation
             ctx.save();
             ctx.translate(state.playerX + PLAYER_SIZE / 2, state.playerY + PLAYER_SIZE / 2);
             ctx.rotate(state.rotation);

            // Add glow effect when invincible
            if (state.powerupEffects.invincible) {
                ctx.shadowColor = '#6c5ce7';
                ctx.shadowBlur = 20;
                ctx.globalAlpha = 0.8 + Math.sin(Date.now() / 100) * 0.2;
            }

            // Draw layered character
            if (characterImages.body?.complete && 
                characterImages.fur?.complete && 
                characterImages.eyes?.complete && 
                characterImages.nose?.complete && 
                characterImages.mouth?.complete) {
                
                // Draw each layer
                ctx.drawImage(
                    characterImages.body,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.fur,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.eyes,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.nose,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.mouth,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );

                // Draw invincibility timer if active
                if (state.invincibilityEndTime) {
                    const timeLeft = Math.max(0, Math.ceil((state.invincibilityEndTime - Date.now()) / 1000));
                    ctx.save();
                    ctx.rotate(-state.rotation);
                    ctx.font = 'bold 16px Arial';
                    ctx.fillStyle = '#6c5ce7';
                    ctx.textAlign = 'center';
                    ctx.fillText(timeLeft.toString(), 0, -PLAYER_SIZE / 2 - 5);
                    ctx.restore();
                }
            }
            ctx.restore();
        }

        // Draw powerups (collectable items)
        state.powerups.forEach(powerup => {
            if (powerupImage && powerupImage.complete) {
                ctx.save();
                // Add a slight hover effect based on time
                const hoverOffset = Math.sin(Date.now() / 200) * 5;
                ctx.drawImage(
                    powerupImage,
                    powerup.x,
                    powerup.y + hoverOffset,
                    powerup.width,
                    powerup.height
                );
                ctx.restore();
            }
        });

        // --- Draw Power-up Status Icons (Top Right) ---
        drawPowerupIcons(ctx, state, width);
        // ---

        // Draw score and coins collected side-by-side
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        ctx.textAlign = 'left';

        // Draw score in the style of the reference image but positioned in the top left
        const currentScore = Math.floor(state.score).toString();
        const bestScore = `BEST: ${state.bestScore}`;
        const coinCount = state.coinCount.toString();

        // Position settings - keep everything in top left
        const leftMargin = 10;
        const topMargin = 34; // Increased from 30 for more padding
        const bestScoreY = topMargin + 22;
        const coinY = bestScoreY + 30; // Position for coin display

        // Draw main score at top left
        ctx.textAlign = 'left';
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(currentScore, leftMargin, topMargin);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(currentScore, leftMargin, topMargin);

        // Draw best score below in smaller font
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(bestScore, leftMargin, bestScoreY);
        ctx.fillStyle = '#888888';
        ctx.fillText(bestScore, leftMargin, bestScoreY);

        // Draw coin count with icon in yellow
        if (coinIconImage && coinIconImage.complete) {
            // Draw coin icon first
            ctx.drawImage(
                coinIconImage,
                leftMargin, // Position at left
                coinY - 20, // Align with text
                24, // Width
                24 // Height
            );
            
            // Draw yellow coin count next to the icon
            ctx.font = 'bold 24px Arial, sans-serif';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(coinCount, leftMargin + 30, coinY);
            ctx.fillStyle = '#FFD700'; // Gold/yellow color
            ctx.fillText(coinCount, leftMargin + 30, coinY);
        }

        // Reset text alignment
        ctx.textAlign = 'left';

        // --- Draw Jump Bar ---
        drawJumpBar(ctx, state);
        // ---

        // Draw floating texts
        state.floatingTexts.forEach(text => {
            ctx.save();
            ctx.font = 'bold 24px Inter';
            ctx.fillStyle = `rgba(99, 102, 241, ${text.opacity})`;
            ctx.textAlign = 'center';
            ctx.fillText(text.text, text.x + POWERUP_SIZE / 2, text.y);
            ctx.restore();
        });

        // Draw explosions
        state.explosions = state.explosions.filter(explosion => {
            const frameSize = 64; // Size of each frame in the sprite sheet
            const totalFrames = 8; // Total number of frames
            const frameDuration = 50; // Duration of each frame in ms
            const currentFrame = Math.floor((Date.now() - explosion.createdAt) / frameDuration);

            if (currentFrame >= totalFrames) return false;

            // if (explosionImage && explosionImage.complete) {
            //     ctx.drawImage(
            //         explosionImage,
            //         currentFrame * frameSize, 0, frameSize, frameSize,
            //         explosion.x - frameSize/2, explosion.y - frameSize/2, frameSize, frameSize
            //     );
            // }
            return true;
        });

        // Draw death animation if active (collision only)
        if (state.deathAnimation.active && state.gameOverReason === 'collision') {
            // Update character position with more dramatic physics
            state.deathAnimation.characterPos.x += state.deathAnimation.characterVel.x;
            state.deathAnimation.characterPos.y += state.deathAnimation.characterVel.y;
            state.deathAnimation.characterVel.y += 0.7; // Stronger gravity
            state.deathAnimation.characterRotation += state.deathAnimation.characterRotationSpeed;
            
            // Draw the character
            ctx.save();
            ctx.translate(
                state.deathAnimation.characterPos.x + PLAYER_SIZE / 2,
                state.deathAnimation.characterPos.y + PLAYER_SIZE / 2
            );
            ctx.rotate(state.deathAnimation.characterRotation);

            if (characterImages.body?.complete && 
                characterImages.fur?.complete && 
                characterImages.eyes?.complete && 
                characterImages.nose?.complete && 
                characterImages.mouth?.complete) {
                
                // Draw each layer
                ctx.drawImage(
                    characterImages.body,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.fur,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.eyes,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.nose,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
                
                ctx.drawImage(
                    characterImages.mouth,
                    -PLAYER_SIZE / 2,
                    -PLAYER_SIZE / 2,
                    PLAYER_SIZE,
                    PLAYER_SIZE
                );
            }
            ctx.restore();
        }

        // --- Update and Draw Active Particles --- 
        // No need to declare state again, use the one from the top of drawGame
        for (let i = state.activeParticles.length - 1; i >= 0; i--) {
            const particle = state.activeParticles[i];

            if (!particle.active || particle.opacity <= 0) {
                 continue;
            }

            // Draw particle
            ctx.save();
            ctx.globalAlpha = particle.opacity;
            ctx.fillStyle = particle.color;
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            
            ctx.beginPath();
            ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        // --- End Particle Draw ---

        // Draw coins
        state.coins.forEach(coin => {
            if (coin.collected) return;
            const coinImage = state.coinImages[coin.frame];
            if (coinImage && coinImage.complete) {
                ctx.save();
                ctx.translate(coin.x + coin.width / 2, coin.y + coin.height / 2);
                ctx.drawImage(
                    coinImage,
                    -coin.width / 2,
                    -coin.height / 2,
                    coin.width,
                    coin.height
                );
                ctx.restore();
            }
        });

        // Draw debug info
        drawDebugInfo(ctx, state); // Pass the state declared at the top

        // --- Draw Animated Power-up Icon & Text ---
        if (state.powerupDisplay && state.powerupDisplay.type) {
            const iconType = state.powerupDisplay.type;

            // Define mapping for the animation display
            const animationIconMap: { [key in PowerupType]?: HTMLImageElement | null } = {
                coinMagnet: powerupIconImages.coinMagnet,
                score: powerupIconImages.doubleScore,
                timeReset: powerupIconImages.timeReset,
                doubleJump: powerupIconImages.tripleJump
            };
            // Mapping for power-up names (excluding invincible as it's not animated)
            const powerupNamesMap: { [key in Exclude<PowerupType, 'invincible'>]?: string } = {
                score: '2x Score!',
                doubleJump: 'Triple Jump!',
                coinMagnet: 'Coin Magnet!',
                timeReset: 'Time Warp!'
            };

            const img = animationIconMap[iconType];
            // Type assertion needed because iconType could theoretically be 'invincible' here,
            // but the outer if checks state.powerupDisplay.type which is set only for animatable types.
            const powerupName = powerupNamesMap[iconType as Exclude<PowerupType, 'invincible'>];

            if (img && img.complete && powerupName) {
                const displaySize = 100; // Size of the displayed icon
                const textPadding = 15; // Padding between icon and text

                // Set text style *before* measuring width
                ctx.font = 'bold 28px Arial, sans-serif'; 
                const textWidth = ctx.measureText(powerupName).width;

                const totalWidth = displaySize + textPadding + textWidth; // Calculate total width
                const startX = (width - totalWidth) / 2; // Center the whole group
                const iconX = startX;
                const textX = startX + displaySize + textPadding;
                const centerY = height / 2 - 50; // Vertical position for icon and text

                ctx.save(); // Save context before applying alpha
                ctx.globalAlpha = state.powerupDisplay.opacity; // Apply fade to both icon and text

                // --- Draw Icon --- 
                ctx.save(); // Save context before icon transformations
                ctx.translate(iconX + displaySize / 2, centerY);
                ctx.scale(state.powerupDisplay.scale, state.powerupDisplay.scale);
                ctx.drawImage(
                    img,
                    -displaySize / 2,
                    -displaySize / 2,
                    displaySize,
                    displaySize
                );
                ctx.restore(); // Restore from icon transformations

                // --- Draw Text --- 
                // Font is already set from width calculation
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                // Text shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillText(powerupName, textX + 2, centerY + 2);

                // Text fill (White)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(powerupName, textX, centerY);
                
                ctx.restore(); // Restore original alpha
            }
        }
        // ---

        ctx.restore(); // Restore from screen shake
    };

    const gameLoop = (currentTime: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!canvas || !ctx) return;

        if (lastTimeRef.current === 0) {
            lastTimeRef.current = currentTime;
        }

        const deltaTime = (currentTime - lastTimeRef.current) / 1000;
        lastTimeRef.current = currentTime;

        updateGame(deltaTime);
        drawGame(ctx);

        animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => {
        if (!isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            
            // Stop ticking sound when game is paused/stopped
            if (tickingSound) {
                tickingSound.pause();
                tickingSound.currentTime = 0;
                console.log('Stopped ticking sound - game paused');
            }
            
            resetGame();
            lastTimeRef.current = 0;
            return;
        }

        animationFrameRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            
            // Stop ticking sound when component unmounts
            if (tickingSound) {
                tickingSound.pause();
                tickingSound.currentTime = 0;
                console.log('Stopped ticking sound - component cleanup');
            }
        };
    }, [isPlaying]);

    useEffect(() => {
        const handleJump = () => {
            const state = gameStateRef.current;
            // --- Prevent jumping if game over ---
            if (state.gameOverReason || state.deathAnimation.active) return;
            // ---

            console.log('Jump triggered:', {
                currentBox: state.currentBox,
                isJumping: state.isJumping,
                jumpCount: state.jumpCount
            });

            // Check if we're on a box
            if (state.currentBox && !state.isJumping) {
                console.log('Performing box jump');
                
                // Play random combo sound for box jump
                const randomComboSound = comboSounds[Math.floor(Math.random() * comboSounds.length)];
                if (randomComboSound) {
                    randomComboSound.currentTime = 0;
                    randomComboSound.play().catch(error => {
                        console.log('Combo sound playback failed:', error);
                    });
                }

                // --- Replenish Jump Bar ---
                state.jumpBarValue = Math.min(
                    state.maxJumpBarValue,
                    state.jumpBarValue + state.jumpBarReplenishAmount
                );
                console.log('Jump Bar Replenished:', state.jumpBarValue);
                // ---

                // --- Increase XP ---
                state.xp += 2;
                console.log('XP increased:', state.xp);
                // ---

                // Calculate jump direction and strength
                let jumpStrength = state.jumpStrength * 1.2;
                let horizontalBoost = 0;

                if (state.isMovingLeft) {
                    horizontalBoost = -DIRECTIONAL_JUMP_HORIZONTAL_BOOST;
                    jumpStrength *= DIRECTIONAL_JUMP_STRENGTH_MULTIPLIER;
                } else if (state.isMovingRight) {
                    horizontalBoost = DIRECTIONAL_JUMP_HORIZONTAL_BOOST;
                    jumpStrength *= DIRECTIONAL_JUMP_STRENGTH_MULTIPLIER;
                }

                // Apply jump forces
                state.yVelocity = jumpStrength;
                state.xVelocity = horizontalBoost;
                state.isJumping = true;
                state.jumpCount = 0;
                state.currentBox = null;

                // Increment box jumps counter
                state.boxJumps++;
                state.lastBoxJumpTime = Date.now();

                // Add visual feedback
                state.floatingTexts.push({
                    text: `+1 Box Jump`,
                    x: state.playerX,
                    y: state.playerY - 30,
                    opacity: 1,
                    createdAt: Date.now()
                });

            } else if (!state.isJumping || state.jumpCount < state.maxJumps) {
                // Normal jump - play regular jump sound
                if (jumpSound) {
                    jumpSound.currentTime = 0;
                    jumpSound.play().catch(error => {
                        console.log('Jump sound playback failed:', error);
                    });
                }
                
                // Normal jump physics
                state.yVelocity = state.jumpStrength;
                state.isJumping = true;
                state.jumpCount++;
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const state = gameStateRef.current;
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    state.justJumped = true;
                    handleJump();
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    e.preventDefault();
                    state.isMovingLeft = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    e.preventDefault();
                    state.isMovingRight = true;
                    break;
                case 'KeyP':
                    e.preventDefault();
                    state.debug.enabled = !state.debug.enabled;
                    console.log('Debug mode:', state.debug.enabled ? 'ON' : 'OFF');
                    break;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const state = gameStateRef.current;
            switch (e.code) {
                case 'Space':
                    state.justJumped = false;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    state.isMovingLeft = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    state.isMovingRight = false;
                    break;
            }
        };

        // Touch controls
        let touchStartX = 0;
        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
            handleJump();
        };

        const handleTouchMove = (e: TouchEvent) => {
            const state = gameStateRef.current;
            // Only allow movement if not jumping
            if (!state.isJumping) {
                const touchX = e.touches[0].clientX;
                const diffX = touchX - touchStartX;
                
                // Reset movement flags
                state.isMovingLeft = false;
                state.isMovingRight = false;
                
                // Set movement based on touch position difference
                if (Math.abs(diffX) > 30) { // Add some threshold to prevent accidental movement
                    if (diffX < 0) {
                        state.isMovingLeft = true;
                    } else {
                        state.isMovingRight = true;
                    }
                }
            }
        };

        const handleTouchEnd = () => {
            const state = gameStateRef.current;
            state.isMovingLeft = false;
            state.isMovingRight = false;
        };

        if (isPlaying) {
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            window.addEventListener('touchstart', handleTouchStart);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isPlaying]); // Keep dependencies

    const handleCollision = (x: number, y: number, obstacle?: Obstacle) => {
        const state = gameStateRef.current;

        // Prevent multiple collisions during death animation or if game already over
        if (state.isColliding || state.deathAnimation.active || state.gameOverReason) {
            return;
        }

        state.isColliding = true;
        state.gameOverReason = 'collision'; // Set the reason
        
        // Stop ticking sound if it's playing
        if (tickingSound) {
            tickingSound.pause();
            tickingSound.currentTime = 0;
            console.log('Stopped ticking sound - collision occurred');
        }

        // Store death cause information for debug mode
        if (state.debug.enabled && obstacle) {
            state.debug.lastDeathCause = {
                type: obstacle.type,
                x: x,
                y: y,
                velocity: state.yVelocity
            };
        }

        // Play random hit sound followed by explosion sound
        const randomHitSound = hitSounds[Math.floor(Math.random() * hitSounds.length)];
        if (randomHitSound) {
            randomHitSound.currentTime = 0;
            randomHitSound.play()
                .then(() => {
                    // Play explosion sound after hit sound finishes
                    if (explosionSound) {
                        explosionSound.currentTime = 0;
                        explosionSound.play().catch(error => {
                            console.log('Explosion sound playback failed:', error);
                        });
                    }
                })
                .catch(error => {
                    console.log('Hit sound playback failed:', error);
                });
        }
        
        // Start death animation with faster spinning
        state.deathAnimation = {
            active: true,
            characterPos: { x: state.playerX, y: state.playerY },
            characterVel: { 
                x: 15 + Math.random() * 8,
                y: -20 - Math.random() * 5
            },
            characterRotation: 0,
            characterRotationSpeed: Math.PI * 4,
            characterOpacity: 1,
            trail: [],
            stars: [],
            complete: false
        };

        // Add more dramatic screen shake
        state.screenShake = {
            intensity: 30, // Increased shake intensity
            duration: 500,
            startTime: Date.now()
        };

        // --- Create Explosion Particles using Pool --- 
        const baseSize = 35; 
        
        // Create central explosion puff
        let particle = getParticleFromPool();
        if (particle) {
            particle.x = x;
            particle.y = y;
            particle.vx = 0;
            particle.vy = -1;
            particle.rotation = 0;
            particle.rotationSpeed = 0;
            particle.size = baseSize * 1.5;
            particle.color = '#FFFFFF';
            particle.opacity = 1;
            particle.fadeSpeed = 0.01;
            particle.lifeSpan = 800; // Longer life for main puff
        }

        // Create cloud formation puffs
        const puffCount = 15; 
        for (let i = 0; i < puffCount; i++) {
            const angle = (Math.PI * 2 * i) / puffCount;
            const radius = 25; 
            const puffX = x + Math.cos(angle) * radius;
            const puffY = y + Math.sin(angle) * radius;
            
            // Main puffs
            particle = getParticleFromPool();
            if (particle) {
                particle.x = puffX;
                particle.y = puffY;
                particle.vx = Math.cos(angle) * 1.5;
                particle.vy = Math.sin(angle) * 1.5 - 1.5;
                particle.rotation = 0;
                particle.rotationSpeed = 0;
                particle.size = baseSize + Math.random() * 15;
                particle.color = '#FFFFFF';
                particle.opacity = 0.9;
                particle.fadeSpeed = 0.015 + Math.random() * 0.005;
                particle.lifeSpan = 700 + Math.random() * 200;
            }

            // Detail puffs
            if (Math.random() > 0.3) { 
                particle = getParticleFromPool();
                if (particle) {
                    particle.x = puffX + (Math.random() - 0.5) * 20;
                    particle.y = puffY + (Math.random() - 0.5) * 20;
                    particle.vx = Math.cos(angle) * 0.7;
                    particle.vy = Math.sin(angle) * 0.7 - 0.7;
                    particle.rotation = 0;
                    particle.rotationSpeed = 0;
                    particle.size = baseSize * 0.5;
                    particle.color = '#FFFFFF';
                    particle.opacity = 0.8;
                    particle.fadeSpeed = 0.02 + Math.random() * 0.01;
                    particle.lifeSpan = 500 + Math.random() * 200;
                }
            }
        }

        // Add orange/yellow/red glow rings
        const glowColors = ['#FF4500', '#FFA500', '#FFD700'];
        for (let i = 0; i < 12; i++) {
            particle = getParticleFromPool();
            if (particle) {
                const angle = (Math.PI * 2 * i) / 12;
                const radius = 30 + Math.random() * 20;
                particle.x = x + Math.cos(angle) * radius * 0.5;
                particle.y = y + Math.sin(angle) * radius * 0.5;
                particle.vx = Math.cos(angle) * 1;
                particle.vy = Math.sin(angle) * 1;
                particle.rotation = 0;
                particle.rotationSpeed = 0;
                particle.size = baseSize * (1.5 + Math.random());
                particle.color = glowColors[Math.floor(Math.random() * glowColors.length)];
                particle.opacity = 0.4;
                particle.fadeSpeed = 0.01 + Math.random() * 0.005;
                particle.lifeSpan = 600 + Math.random() * 300;
            }
        }

        // Add sparks
        for (let i = 0; i < 20; i++) {
            particle = getParticleFromPool();
            if (particle) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 4;
                particle.x = x;
                particle.y = y;
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed - 2;
                particle.rotation = angle;
                particle.rotationSpeed = Math.random() * 0.5;
                particle.size = 3 + Math.random() * 3;
                particle.color = '#FFD700';
                particle.opacity = 1;
                particle.fadeSpeed = 0.03 + Math.random() * 0.01;
                particle.lifeSpan = 300 + Math.random() * 200;
            }
        }

        // Add debris particles
        for (let i = 0; i < 10; i++) {
            particle = getParticleFromPool();
            if (particle) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 3;
                particle.x = x;
                particle.y = y;
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed - 1;
                particle.rotation = angle;
                particle.rotationSpeed = Math.random() * 0.2;
                particle.size = 5 + Math.random() * 5;
                particle.color = '#8B4513'; // Brown debris
                particle.opacity = 0.8;
                particle.fadeSpeed = 0.015 + Math.random() * 0.005;
                particle.lifeSpan = 700 + Math.random() * 300;
            }
        }
        // --- End Particle Creation using Pool --- 

        // Show game over screen after delay
        setTimeout(() => {
            console.log('[Canvas] Collision timeout: Calling onGameOver with results:', {
                score: Math.floor(state.score),
                boxJumps: state.boxJumps,
                coinCount: state.coinCount,
                xp: state.xp
            });
            onGameOver({ 
                score: Math.floor(state.score), 
                boxJumps: state.boxJumps, 
                coinCount: state.coinCount, 
                xp: state.xp 
            });
        }, 1600);
    };

    // Define the drawing function for the jump bar
    const drawJumpBar = (ctx: CanvasRenderingContext2D, state: GameState) => {
        // Calculate dimensions and positions
        const barWidth = Math.min(width * 0.7, 500); // Wider bar for better visual
        const barHeight = 24; // Slightly taller
        const barX = (width - barWidth) / 2; // Center horizontally
        const barY = 10; // Position near the top
        const cornerRadius = 6; // Rounded corners
        
        // Calculate fill width
        const fillPercentage = state.jumpBarValue / state.maxJumpBarValue;
        const fillWidth = Math.max(cornerRadius * 2, barWidth * fillPercentage); // Ensure minimum width for rounded corners
        
        // Draw background with rounded corners
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, cornerRadius);
        
        // Create dark gradient background (dark purple to black)
        const bgGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
        bgGradient.addColorStop(0, '#1a0b33');
        bgGradient.addColorStop(1, '#080325');
        ctx.fillStyle = bgGradient;
        ctx.fill();
        
        // Create border
        ctx.strokeStyle = '#443366';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw fill with gradient if there's any fill to show
        if (fillWidth > 0) {
            ctx.beginPath();
            ctx.roundRect(barX, barY, fillWidth, barHeight, cornerRadius);
            
            // Create purple gradient for the fill
            const fillGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
            fillGradient.addColorStop(0, '#a64dff'); // Lighter purple at top
            fillGradient.addColorStop(0.5, '#8430cc'); // Medium purple
            fillGradient.addColorStop(1, '#6a1b9a'); // Darker purple at bottom
            
            ctx.fillStyle = fillGradient;
            ctx.fill();
            
            // Add shine effect on top
            ctx.beginPath();
            ctx.roundRect(barX, barY, fillWidth, barHeight/3, cornerRadius);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
        }
        
        // Display numerical value in the middle of the bar
        const currentValue = Math.round(state.jumpBarValue);
        const maxValue = state.maxJumpBarValue;
        const displayText = `${currentValue}/${maxValue}`;
        
        // Set text style
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add text shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        // Draw text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(displayText, barX + barWidth / 2, barY + barHeight / 2);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.restore();
    };

    return (
        <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{
                width: `${width}px`,
                height: `${height}px`
            }}
        />
    );
};

export default Canvas; 