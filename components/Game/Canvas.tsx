import React from 'react';
import { useEffect, useRef } from 'react';
import styles from './Canvas.module.css';
import { BOX_ARRANGEMENTS, BOX_TYPES, BoxConfig } from './BoxConstants';

interface CanvasProps {
    width: number;
    height: number;
    isPlaying: boolean;
    onGameOver: (score: number, boxJumps: number) => void;
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
        type: 'ground' | 'air' | 'box' | 'box2' | 'box3' | 'split_gap' | 'chog_between';
        image?: HTMLImageElement | null;
        config?: BoxConfig;
    }>;
    lastObstacleX: number;
    powerups: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        type: 'score' | 'invincible' | 'doubleJump';
        active?: boolean;
    }>;
    powerupEffects: {
        invincible: boolean;
        doubleJump: boolean;
        scoreMultiplier: number;
    };
    timeSinceStart: number;
    scale: number;
    floatingTexts: Array<{
        text: string;
        x: number;
        y: number;
        opacity: number;
        createdAt: number;
    }>;
    invincibilityEndTime?: number;
    powerupTimeouts: {
        score?: NodeJS.Timeout;
        invincible?: NodeJS.Timeout;
        doubleJump?: NodeJS.Timeout;
    };
    boxJumps: number;
    lastBoxJumpTime: number;
    lastObstacleType?: 'ground' | 'air' | 'box' | 'box2' | 'box3';
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
    lastSpawnTime?: number;
}

interface Obstacle {
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'ground' | 'air' | 'box' | 'box2' | 'box3' | 'split_gap' | 'chog_between';
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

// Mobile-specific constants
const MOBILE_SCALE = 1;
const MOBILE_INITIAL_GAME_SPEED = 3; // Slower initial speed for mobile
const PLAYER_START_X = 20;

// Game constants
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
    powerups: [],
    powerupEffects: {
        invincible: false,
        doubleJump: false,
        scoreMultiplier: 1
    },
    timeSinceStart: 0,
    scale: 1,
    floatingTexts: [],
    invincibilityEndTime: undefined,
    powerupTimeouts: {},
    boxJumps: 0,
    lastBoxJumpTime: 0,
    lastObstacleType: undefined,
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
};

const PLAYER_SIZE = 50;
const OBSTACLE_SIZE = 50;
const POWERUP_SIZE = 40;
const getGroundHeight = (height: number) => Math.min(80, height * 0.15); // Dynamic ground height
const PLAYER_OFFSET_FROM_GROUND = 0;
const OBSTACLE_SPAWN_CHANCE = 0.95; // Increased spawn chance for more frequent obstacles
const POWERUP_SPAWN_CHANCE = 0.008;
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
type ObstacleType = 'ground' | 'air' | 'box' | 'box2' | 'box3';

// Load explosion sprite
// const explosionImage = typeof window !== 'undefined' ? new window.Image() : null;
// if (explosionImage) explosionImage.src = '/assets/explosion.png';

// Update box size constant
const BOX_SIZE = 50; // New box size (was 41)

// Add jump sound at the top with other assets
const jumpSound = typeof window !== 'undefined' ? new Audio('/assets/audio/jumpsound.mp3') : null;

// Add explosion sound at the top with other assets
const explosionSound = typeof window !== 'undefined' ? new Audio('/assets/audio/explode3.mp3') : null;

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

const Canvas: React.FC<CanvasProps> = ({ width, height, isPlaying, onGameOver }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<GameState>({ ...INITIAL_STATE });
    const lastTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const isMobileRef = useRef(width <= 768);

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
        };
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

    const updateObstacles = (deltaTime: number) => {
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);
        
        // Move existing obstacles
        state.obstacles = state.obstacles.filter(obstacle => {
            obstacle.x -= state.gameSpeed;
            return obstacle.x + obstacle.width > 0;
        });

        // Time-based obstacle spawning
        const currentTime = Date.now();
        if (!state.lastSpawnTime) {
            state.lastSpawnTime = currentTime;
        }

        if (currentTime - state.lastSpawnTime >= OBSTACLE_SPAWN_INTERVAL) {
            // Simply use the original BOX_ARRANGEMENTS array without duplicating any entries
            const boxConfig = BOX_ARRANGEMENTS[Math.floor(Math.random() * BOX_ARRANGEMENTS.length)];
            
            // Log the spawning box type and its configuration
            console.log('Spawning box:', {
                type: boxConfig.type,
                arrangement: boxConfig.arrangement,
                topCount: boxConfig.topCount,
                bottomCount: boxConfig.bottomCount,
                gapSize: boxConfig.gapSize
            });

            const obstacleY = height - groundHeight - 
                (boxConfig.arrangement === 'vertical' ? BOX_SIZE * boxConfig.count : BOX_SIZE);

            const newObstacle = {
                x: width + 100,
                y: obstacleY,
                width: boxConfig.arrangement === 'horizontal' && boxConfig.hasChog ? 
                    BOX_SIZE * 3 : // Width for two boxes plus chog
                    BOX_SIZE * (boxConfig.arrangement === 'horizontal' ? boxConfig.count : 1),
                height: BOX_SIZE * (boxConfig.arrangement === 'vertical' ? boxConfig.count : 1),
                type: boxConfig.type as Obstacle['type'],
                config: boxConfig
            };

            state.obstacles.push(newObstacle);
            
            // Update glass position for split_gap obstacles
            if (boxConfig.arrangement === 'split_gap' && boxConfig.gapSize && boxConfig.bottomCount) {
                const glassY = height - groundHeight - BOX_SIZE - (boxConfig.bottomCount * BOX_SIZE);
                state.glass = {
                    isBroken: false,
                    x: width + 100,
                    y: glassY - BOX_SIZE,
                    width: BOX_SIZE,
                    height: BOX_SIZE,
                    opacity: 1,
                    particles: []
                };
            }
            
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

                    if (arrangement === 'horizontal' && hasChog) {
                        // Check collision with first box
                        const box1Hitbox = {
                            x: obstacle.x,
                            y: obstacle.y,
                            width: BOX_SIZE,
                            height: BOX_SIZE
                        };
                        if (checkCollisionWithBox(playerHitbox, box1Hitbox)) {
                            handleCollision(obstacle.x, obstacle.y, obstacle);
                            return true;
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
                            return true;
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
                            return true;
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
                                return true;
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
                                return true;
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
                                return true;
                            }
                        }
                    }
                }
            }
        }

        // Update score with multiplier
        state.score += deltaTime * 10 * state.powerupEffects.scoreMultiplier;
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

            // Add landing particles with varied timing
            const particleCount = Math.floor(5 + Math.random() * 3);
            for (let i = 0; i < particleCount; i++) {
                setTimeout(() => {
                    if (state.currentBox) { // Check if still on box
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1 + Math.random() * 2;
                        state.particles.push({
                            x: state.playerX + PLAYER_SIZE / 2,
                            y: state.playerY + PLAYER_SIZE,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            rotation: Math.random() * Math.PI * 2,
                            rotationSpeed: Math.random() * 0.2,
                            size: 2 + Math.random() * 2,
                            color: '#FFFFFF',
                            opacity: 0.8,
                            fadeSpeed: 0.02
                        });
                    }
                }, i * 16); // Stagger particle creation
            }

            return false;
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

        // Move existing powerups
        state.powerups = state.powerups.filter(powerup => {
            powerup.x -= state.gameSpeed;
            return powerup.x + POWERUP_SIZE > 0;
        });

        // Spawn new powerups
        if (Math.random() < POWERUP_SPAWN_CHANCE && state.powerups.length < 2) {
            const powerupTypes: Array<'score' | 'invincible' | 'doubleJump'> = ['score', 'invincible', 'doubleJump'];
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

    const activatePowerup = (type: 'score' | 'invincible' | 'doubleJump', x: number, y: number) => {
        const state = gameStateRef.current;

        // Add floating text (moved slightly right)
        const powerupNames = {
            score: '2x Score!',
            invincible: 'Invincible!',
            doubleJump: 'Triple Jump!'
        };

        // Clear any existing timeouts for this power-up type
        if (state.powerupTimeouts?.[type]) {
            clearTimeout(state.powerupTimeouts[type]);
        }

        state.floatingTexts.push({
            text: powerupNames[type],
            x: x + POWERUP_SIZE,
            y,
            opacity: 1,
            createdAt: Date.now()
        });

        switch (type) {
            case 'score':
                state.powerupEffects.scoreMultiplier = 2;
                state.powerupTimeouts = {
                    ...state.powerupTimeouts,
                    score: setTimeout(() => {
                        state.powerupEffects.scoreMultiplier = 1;
                    }, 5000)
                };
                break;
            case 'invincible':
                state.powerupEffects.invincible = true;
                state.invincibilityEndTime = Date.now() + 3000;
                state.powerupTimeouts = {
                    ...state.powerupTimeouts,
                    invincible: setTimeout(() => {
                        state.powerupEffects.invincible = false;
                        state.invincibilityEndTime = undefined;
                    }, 3000)
                };
                break;
            case 'doubleJump':
                state.powerupEffects.doubleJump = true;
                state.maxJumps = 3;
                state.powerupTimeouts = {
                    ...state.powerupTimeouts,
                    doubleJump: setTimeout(() => {
                        state.powerupEffects.doubleJump = false;
                        state.maxJumps = 2;
                    }, 7000)
                };
                break;
        }
    };

    const updateGame = (deltaTime: number) => {
        const state = gameStateRef.current;

        // Update time and increase speed
        state.timeSinceStart += deltaTime;
        if (state.timeSinceStart > SPEED_INCREASE_INTERVAL) {
            state.timeSinceStart = 0;
            state.gameSpeed = Math.min(state.gameSpeed + SPEED_INCREASE_AMOUNT, MAX_GAME_SPEED);
        }

        // Update chog rotation
        state.chogRotation += CHOG_ROTATION_SPEED * deltaTime;
        if (state.chogRotation > Math.PI * 2) {
            state.chogRotation -= Math.PI * 2;
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

        updatePlayer(deltaTime);
        updateObstacles(deltaTime);
        updatePowerups(deltaTime);
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

            if (arrangement === 'horizontal' && hasChog) {
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
                    const boxY = height - groundHeight - ((i + 1) * BOX_SIZE); // Adjusted Y position
                    ctx.drawImage(
                        boxImage,
                        obstacle.x,
                        boxY,
                        BOX_SIZE,
                        BOX_SIZE
                    );
                }

                // Draw glass in the gap
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

                // Draw top boxes vertically stacked
                for (let i = 0; i < obstacle.config.topCount; i++) {
                    const boxY = height - groundHeight - ((i + obstacle.config.bottomCount + 2) * BOX_SIZE) - obstacle.config.gapSize;
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

        // Apply screen shake
        ctx.save();
        ctx.translate(shakeOffsetX, shakeOffsetY);

        // Clear canvas
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, width, height);

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

        // Draw player only if not in death animation
        if (!state.deathAnimation.active) {
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

        // Draw obstacles
        state.obstacles.forEach(obstacle => {
            drawObstacle(ctx, obstacle);
        });

        // Draw powerups with moyaki sprite
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

        // Draw power-up status
        if (state.powerupEffects.invincible || state.powerupEffects.doubleJump || state.powerupEffects.scoreMultiplier > 1) {
            ctx.fillStyle = '#000000';
            ctx.font = '16px Arial';
            let statusY = 60;
            if (state.powerupEffects.invincible) {
                ctx.fillText('Invincible!', 10, statusY);
                statusY += 20;
            }
            if (state.powerupEffects.doubleJump) {
                ctx.fillText('Triple Jump!', 10, statusY);
                statusY += 20;
            }
            if (state.powerupEffects.scoreMultiplier > 1) {
                ctx.fillText('2x Score!', 10, statusY);
            }
        }

        // Draw score and box jumps
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        const scoreText = `Score: ${Math.floor(state.score)}`;
        const boxJumpsText = `Box Jumps: ${state.boxJumps}`;

        // Draw score on the left
        ctx.textAlign = 'left';
        ctx.fillText(scoreText, 10, 30);

        // Draw box jumps to the right of score
        // First measure the width of the score text
        const scoreWidth = ctx.measureText(scoreText).width;
        ctx.fillText(boxJumpsText, scoreWidth + 40, 30); // Add 40px padding between texts

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

        // Draw death animation if active
        if (state.deathAnimation.active) {
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

        // Update particle fade out with variable speeds
        state.particles = state.particles.filter(particle => {
            if (particle.opacity <= 0) return false;

            ctx.save();
            ctx.globalAlpha = particle.opacity;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = particle.color;
            ctx.fill();
            ctx.restore();

            // Update particle
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.05;
            particle.opacity -= particle.fadeSpeed || 0.01;
            particle.size += 0.2;

            return true;
        });

        // Add debug visualization at the end
        drawDebugInfo(ctx, state);

        ctx.restore();
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
            resetGame();
            lastTimeRef.current = 0;
            return;
        }

        animationFrameRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying]);

    useEffect(() => {
        const handleJump = () => {
            const state = gameStateRef.current;
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

                // Add particles
                for (let i = 0; i < 10; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 3;
                    state.particles.push({
                        x: state.playerX + PLAYER_SIZE / 2,
                        y: state.playerY + PLAYER_SIZE / 2,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 2,
                        rotation: Math.random() * Math.PI * 2,
                        rotationSpeed: Math.random() * 0.2,
                        size: 3 + Math.random() * 3,
                        color: '#FFD700',
                        opacity: 1,
                        fadeSpeed: 0.02
                    });
                }
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
    }, [isPlaying]);

    const handleCollision = (x: number, y: number, obstacle?: Obstacle) => {
        const state = gameStateRef.current;
        
        // Prevent multiple collisions during death animation
        if (state.isColliding || state.deathAnimation.active) {
            return;
        }
        
        state.isColliding = true;

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

        // Create main cloud puffs
        const puffCount = 15; // Increased puff count
        const baseSize = 35; // Slightly larger base size
        
        // Create central explosion first
        state.particles.push({
            x,
            y,
            vx: 0,
            vy: -1,
            rotation: 0,
            rotationSpeed: 0,
            size: baseSize * 1.5,
            color: '#FFFFFF',
            opacity: 1
        });

        // Create cloud formation
        for (let i = 0; i < puffCount; i++) {
            const angle = (Math.PI * 2 * i) / puffCount;
            const radius = 25; // Slightly larger radius
            const puffX = x + Math.cos(angle) * radius;
            const puffY = y + Math.sin(angle) * radius;
            
            // Main puffs
            state.particles.push({
                x: puffX,
                y: puffY,
                vx: Math.cos(angle) * 1.5,
                vy: Math.sin(angle) * 1.5 - 1.5,
                rotation: 0,
                rotationSpeed: 0,
                size: baseSize + Math.random() * 15,
                color: '#FFFFFF',
                opacity: 0.9
            });

            // Detail puffs
            if (Math.random() > 0.3) { // Increased chance for detail puffs
                state.particles.push({
                    x: puffX + (Math.random() - 0.5) * 20,
                    y: puffY + (Math.random() - 0.5) * 20,
                    vx: Math.cos(angle) * 0.7,
                    vy: Math.sin(angle) * 0.7 - 0.7,
                    rotation: 0,
                    rotationSpeed: 0,
                    size: baseSize * 0.5,
                    color: '#FFFFFF',
                    opacity: 0.8
                });
            }
        }

        // Add orange/yellow/red glow rings
        const glowColors = ['#FF4500', '#FFA500', '#FFD700'];
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const radius = 30 + Math.random() * 20;
            state.particles.push({
                x: x + Math.cos(angle) * radius * 0.5,
                y: y + Math.sin(angle) * radius * 0.5,
                vx: Math.cos(angle) * 1,
                vy: Math.sin(angle) * 1,
                rotation: 0,
                rotationSpeed: 0,
                size: baseSize * (1.5 + Math.random()),
                color: glowColors[Math.floor(Math.random() * glowColors.length)],
                opacity: 0.4
            });
        }

        // Add sparks
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            state.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                rotation: angle,
                rotationSpeed: Math.random() * 0.5,
                size: 3 + Math.random() * 3,
                color: '#FFD700',
                opacity: 1
            });
        }

        // Add debris particles
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            state.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                rotation: angle,
                rotationSpeed: Math.random() * 0.2,
                size: 5 + Math.random() * 5,
                color: '#8B4513', // Brown debris
                opacity: 0.8
            });
        }

        // Show game over screen after 1.6 seconds
        setTimeout(() => {
            onGameOver(state.score, state.boxJumps);
        }, 1600);
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