# .gitignore

```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

# components/Game/Canvas.module.css

```css
.canvas {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 1rem;
    background: #87CEEB;
    image-rendering: auto;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transform: translateZ(0);
    backface-visibility: hidden;
}
```

# components/Game/Canvas.tsx

```tsx
import React from 'react';
import { useEffect, useRef } from 'react';
import styles from './Canvas.module.css';

interface CanvasProps {
    width: number;
    height: number;
    isPlaying: boolean;
    onGameOver: (score: number) => void;
}

interface GameState {
    playerY: number;
    yVelocity: number;
    gravity: number;
    jumpStrength: number;
    isJumping: boolean;
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
        type: 'ground' | 'air';
        image?: HTMLImageElement | null;
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
}

// Update image references to use window.Image
const characterImage = typeof window !== 'undefined' ? new window.Image() : null;
if (characterImage) characterImage.src = '/assets/molandak.png';

const obstacleImages = {
    ground: typeof window !== 'undefined' ? new window.Image() : null,
    air: typeof window !== 'undefined' ? new window.Image() : null
};
if (obstacleImages.ground) obstacleImages.ground.src = '/assets/chog.png';
if (obstacleImages.air) obstacleImages.air.src = '/assets/mouch.png';

const powerupImage = typeof window !== 'undefined' ? new window.Image() : null;
if (powerupImage) powerupImage.src = '/assets/moyaki.png';

// Mobile-specific constants
const MOBILE_SCALE = 1;
const MOBILE_INITIAL_GAME_SPEED = 3; // Slower initial speed for mobile
const PLAYER_START_X = 20;

// Game constants
const INITIAL_STATE: GameState = {
    playerY: 0,
    yVelocity: 0,
    gravity: 1500,
    jumpStrength: -550,
    isJumping: false,
    jumpCount: 0,
    maxJumps: 2,
    rotation: 0,
    rotationSpeed: Math.PI * 5,
    gameSpeed: 5, // Default speed for desktop
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
};

const PLAYER_SIZE = 50;
const OBSTACLE_SIZE = 50;
const POWERUP_SIZE = 40;
const getGroundHeight = (height: number) => Math.min(80, height * 0.15); // Dynamic ground height
const PLAYER_OFFSET_FROM_GROUND = 0;
const OBSTACLE_SPAWN_CHANCE = 0.02;
const POWERUP_SPAWN_CHANCE = 0.008;
const MIN_OBSTACLE_DISTANCE = 200;
const SPEED_INCREASE_INTERVAL = 3;
const SPEED_INCREASE_AMOUNT = 0.5;
const MAX_GAME_SPEED = 15;

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
            scale: isMobile ? MOBILE_SCALE : 1
        };
    };

    const updatePlayer = (deltaTime: number) => {
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);

        state.yVelocity += state.gravity * deltaTime;
        state.playerY += state.yVelocity * deltaTime;
        state.rotation += state.rotationSpeed * deltaTime;

        // Ground collision with dynamic ground height
        if (state.playerY + PLAYER_SIZE > height - groundHeight - PLAYER_OFFSET_FROM_GROUND) {
            state.playerY = height - groundHeight - PLAYER_SIZE - PLAYER_OFFSET_FROM_GROUND;
            state.yVelocity = 0;
            state.isJumping = false;
            state.jumpCount = 0;
        }
    };

    const updateObstacles = (deltaTime: number) => {
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);
        const minDistance = MIN_OBSTACLE_DISTANCE; // Use default distance
        const maxSpeed = MAX_GAME_SPEED; // Use default max speed

        // Move existing obstacles
        state.obstacles = state.obstacles.filter(obstacle => {
            obstacle.x -= state.gameSpeed;
            return obstacle.x + OBSTACLE_SIZE > 0;
        });

        // Spawn new obstacles
        if (Math.random() < OBSTACLE_SPAWN_CHANCE &&
            (state.obstacles.length === 0 ||
                width - state.lastObstacleX > minDistance)) {

            const isGroundObstacle = Math.random() > 0.5;
            const obstacleY = isGroundObstacle ?
                height - groundHeight - OBSTACLE_SIZE :
                height - groundHeight - OBSTACLE_SIZE * 2;

            state.obstacles.push({
                x: width + 100, // Add fixed extra distance for all devices
                y: obstacleY,
                width: OBSTACLE_SIZE,
                height: OBSTACLE_SIZE,
                type: isGroundObstacle ? 'ground' : 'air',
                image: isGroundObstacle ? obstacleImages.ground : obstacleImages.air
            });
            state.lastObstacleX = width;
        }

        // Check collisions only if not invincible
        if (!state.powerupEffects.invincible) {
            const playerHitbox = {
                x: PLAYER_START_X, // Use new starting position
                y: state.playerY,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE
            };

            for (const obstacle of state.obstacles) {
                if (checkCollision(playerHitbox, obstacle)) {
                    onGameOver(state.score);
                    return;
                }
            }
        }

        // Update score with multiplier
        state.score += deltaTime * 10 * state.powerupEffects.scoreMultiplier;
    };

    const HITBOX_PADDING = 5; // Smaller hitbox than the sprite

    const checkCollision = (rect1: any, rect2: any) => {
        // Add padding to make hitbox smaller than visual sprite
        const hitbox1 = {
            x: rect1.x + HITBOX_PADDING,
            y: rect1.y + HITBOX_PADDING,
            width: rect1.width - (HITBOX_PADDING * 2),
            height: rect1.height - (HITBOX_PADDING * 2)
        };

        const hitbox2 = {
            x: rect2.x + HITBOX_PADDING,
            y: rect2.y + HITBOX_PADDING,
            width: rect2.width - (HITBOX_PADDING * 2),
            height: rect2.height - (HITBOX_PADDING * 2)
        };

        return hitbox1.x < hitbox2.x + hitbox2.width &&
            hitbox1.x + hitbox1.width > hitbox2.x &&
            hitbox1.y < hitbox2.y + hitbox2.height &&
            hitbox1.y + hitbox1.height > hitbox2.y;
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
            x: PLAYER_START_X, // Update to use new player position (was hardcoded to 100)
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

        updatePlayer(deltaTime);
        updateObstacles(deltaTime);
        updatePowerups(deltaTime);
    };

    const drawGame = (ctx: CanvasRenderingContext2D) => {
        const state = gameStateRef.current;
        const groundHeight = getGroundHeight(height);

        // Clear canvas
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, width, height);

        // Draw ground
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, height - groundHeight, width, groundHeight);

        // Draw player with sprite and invincibility timer
        ctx.save();
        ctx.translate(PLAYER_START_X + PLAYER_SIZE / 2, state.playerY + PLAYER_SIZE / 2);
        ctx.rotate(state.rotation);

        // Add glow effect when invincible
        if (state.powerupEffects.invincible) {
            ctx.shadowColor = '#6c5ce7';
            ctx.shadowBlur = 20;
            ctx.globalAlpha = 0.8 + Math.sin(Date.now() / 100) * 0.2;
        }

        if (characterImage && characterImage.complete) {
            ctx.drawImage(
                characterImage,
                -PLAYER_SIZE / 2,
                -PLAYER_SIZE / 2,
                PLAYER_SIZE,
                PLAYER_SIZE
            );

            // Draw invincibility timer if active
            if (state.invincibilityEndTime) {
                const timeLeft = Math.max(0, Math.ceil((state.invincibilityEndTime - Date.now()) / 1000));
                ctx.save();
                ctx.rotate(-state.rotation); // Counter-rotate to keep text upright
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#6c5ce7';
                ctx.textAlign = 'center';
                ctx.fillText(timeLeft.toString(), 0, -PLAYER_SIZE / 2 - 5);
                ctx.restore();
            }
        }
        ctx.restore();

        // Draw obstacles with sprites
        state.obstacles.forEach(obstacle => {
            const image = obstacle.type === 'ground' ? obstacleImages.ground : obstacleImages.air;
            if (image && image.complete) {
                ctx.drawImage(
                    image,
                    obstacle.x,
                    obstacle.y,
                    obstacle.width,
                    obstacle.height
                );
            }
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

        // Draw score
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        ctx.fillText(`Score: ${Math.floor(state.score)}`, 10, 30);

        // Draw floating texts
        state.floatingTexts.forEach(text => {
            ctx.save();
            ctx.font = 'bold 24px Inter';
            ctx.fillStyle = `rgba(99, 102, 241, ${text.opacity})`;
            ctx.textAlign = 'center';
            ctx.fillText(text.text, text.x + POWERUP_SIZE / 2, text.y);
            ctx.restore();
        });
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
            if (!state.isJumping || (state.jumpCount < state.maxJumps)) {
                state.yVelocity = state.jumpStrength;
                state.isJumping = true;
                state.jumpCount++;
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                handleJump();
            }
        };

        if (isPlaying) {
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('touchstart', handleJump);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleJump);
        };
    }, [isPlaying]);

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
```

# components/Game/GameContainer.module.css

```css
.container {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    padding: 0;
}

.gameWrapper {
    position: relative;
    width: 100%;
    max-width: 1200px;
    height: 100%;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 1rem;
}

.menuContainer {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 2rem;
    border-radius: 1.5rem;
    text-align: center;
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15);
    max-width: 90%;
    width: 320px;
    z-index: 10;
}

.menuContainer button {
    width: 100%;
    padding: 1rem 2rem;
    margin: 1rem 0;
    border: none;
    border-radius: 1rem;
    background: #6366f1;
    color: white;
    font-size: 1.2rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.menuContainer button:hover {
    background: #4f46e5;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
}

.gameOverContainer {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 2rem;
    border-radius: 1.5rem;
    text-align: center;
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15);
    max-width: 90%;
    width: 320px;
    z-index: 20;
}

.gameOverContainer h2 {
    margin: 0 0 1rem;
}

.gameOverContainer p {
    margin: 0 0 1rem;
    font-size: 1.5rem;
    color: #6366f1;
}

.gameOverContainer button {
    width: 100%;
    padding: 0.75rem;
    margin: 0.5rem 0;
    border: none;
    border-radius: 0.5rem;
    background: #6366f1;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
}

.gameOverContainer button:hover {
    background: #4f46e5;
}

.gameOverContainer button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
}

.leaderboard {
    margin-top: 1rem;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: #6366f1 #e5e7eb;
}

.leaderboard::-webkit-scrollbar {
    width: 6px;
}

.leaderboard::-webkit-scrollbar-track {
    background: #e5e7eb;
    border-radius: 3px;
}

.leaderboard::-webkit-scrollbar-thumb {
    background-color: #6366f1;
    border-radius: 3px;
}

.leaderboardEntry {
    display: grid;
    grid-template-columns: 40px 1fr 80px;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.9rem;
}

.rank {
    color: #6366f1;
    font-weight: bold;
}

.name {
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.score {
    color: #6366f1;
    font-weight: bold;
}

.instructions {
    margin-bottom: 1.5rem;
}

.key {
    display: inline-block;
    padding: 0.4rem 0.8rem;
    background: #6366f1;
    color: white;
    border-radius: 0.5rem;
    font-family: monospace;
    margin: 0 0.25rem;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
}

.gameOverContainer input {
    padding: 0.8rem 1rem;
    font-size: 1.2rem;
    border: 2px solid #6366f1;
    border-radius: 8px;
    width: calc(100% - 2rem);
    background-color: white;
    transition: border-color 0.2s, box-shadow 0.2s;
    margin-bottom: 0.5rem;
}

.gameOverContainer input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.gameOverContainer input::placeholder {
    color: #9ca3af;
}

@media (max-width: 768px) {
    .gameWrapper {
        padding: 0 0.5rem;
    }

    .menuContainer,
    .gameOverContainer {
        width: 90%;
        max-width: 320px;
        padding: 1rem;
    }

    .instructions {
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }
}

.mintStatus {
    margin: 10px 0;
    padding: 10px;
    border-radius: 8px;
    text-align: center;
}

.mintStatus p {
    font-size: 0.8rem;
}

.mintStatus.error {
    background-color: #fee2e2;
    border: 1px solid #ef4444;
    color: #dc2626;
}

.errorDetails {
    margin-top: 8px;
    font-size: 0.9em;
    color: #dc2626;
}

.mintStatus.success {
    background-color: #dcfce7;
    border: 1px solid #22c55e;
    color: #16a34a;
}

.mintStatus.pending,
.mintStatus.mining {
    background-color: #e0f2fe;
    border: 1px solid #0ea5e9;
    color: #0284c7;
}

.txLink {
    display: inline-block;
    margin-top: 0.25rem;
    color: #6366f1;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.75rem;
    text-decoration: underline;
}
```

# components/Game/GameContainer.tsx

```tsx
import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';
import { mintScore, TransactionStatus } from '../../utils/web3';

interface GameState {
    isPlaying: boolean;
    score: number;
    playerName: string;
    hasEnteredName: boolean;
}

interface LeaderboardEntry {
    name: string;
    score: number;
    date: string;
}

const GAME_WIDTH = 1200;
const MOBILE_GAME_WIDTH = 400;
const GAME_HEIGHT = 650;
const MOBILE_GAME_HEIGHT = 500;
const MAX_LEADERBOARD_ENTRIES = 100;

export default function GameContainer() {
    const [gameState, setGameState] = useState<GameState>({
        isPlaying: false,
        score: 0,
        playerName: '',
        hasEnteredName: false
    });
    const [gameStartTime, setGameStartTime] = useState<number>(0);
    const [gameEndTime, setGameEndTime] = useState<number>(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [mintStatus, setMintStatus] = useState<TransactionStatus | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [gameWidth, setGameWidth] = useState(GAME_WIDTH);
    const [gameHeight, setGameHeight] = useState(GAME_HEIGHT);

    useEffect(() => {
        // Load global leaderboard from API
        console.log('Fetching leaderboard...');
        fetch('/api/scores')
            .then(res => {
                console.log('Leaderboard response:', res.status);
                return res.json();
            })
            .then(scores => {
                console.log('Received scores:', scores);
                setLeaderboard(scores);
            })
            .catch(error => {
                console.error('Error loading leaderboard:', error);
            });

        // Check if already connected
        if (typeof window !== 'undefined' && window.ethereum) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
            // Check if already connected
            web3Provider.listAccounts().then(accounts => {
                setIsConnected(accounts.length > 0);
            }).catch(error => {
                console.log('Not connected to wallet:', error);
            });
        }
    }, []);

    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth <= 768;
            setGameHeight(isMobile ? MOBILE_GAME_HEIGHT : GAME_HEIGHT);
            setGameWidth(isMobile ? Math.min(window.innerWidth - 16, MOBILE_GAME_WIDTH) : GAME_WIDTH);
        };

        handleResize(); // Set initial dimensions
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleConnect = async () => {
        try {
            if (isConnected) {
                // Disconnect logic
                setIsConnected(false);
                setProvider(null);
                return;
            }

            // Check if MetaMask is installed
            if (!window.ethereum) {
                setMintStatus({
                    status: 'error',
                    message: 'Please open this website in your MetaMask browser or install MetaMask'
                });
                return;
            }

            // This will trigger Web3Modal on both desktop and mobile
            await window.ethereum.request({ method: "eth_requestAccounts" });

            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);

            const network = await web3Provider.getNetwork();
            if (network.chainId !== 8453n) { // Base mainnet chainId
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0x2105" }], // Base mainnet chainId in hex
                });
            }

            setIsConnected(true);
        } catch (error) {
            console.error('Failed to connect:', error);
            setIsConnected(false);
            // Show a user-friendly error message
            setMintStatus({
                status: 'error',
                message: 'Please open this website in your MetaMask mobile browser'
            });
        }
    };

    const handleMintScore = async () => {
        if (!provider || !gameState.score) return;
        setIsMinting(true);
        setMintStatus(null);
        try {
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            await mintScore(
                address,
                gameState.score,
                gameStartTime,
                gameEndTime,
                (status: TransactionStatus) => {
                    console.log('Minting status:', status);
                    setMintStatus(status);
                    if (status.status === 'error') {
                        console.error('Minting error:', status.error);
                    }
                }
            );
        } catch (error) {
            console.error('Failed to mint:', error);
            setMintStatus({
                status: 'error',
                message: 'Failed to mint. Please try again.',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setIsMinting(false);
        }
    };

    const handleStartGame = () => {
        const startTime = Date.now() / 1000;
        setGameStartTime(startTime);
        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            score: 0,
            hasEnteredName: false,
            playerName: ''
        }));
        setIsGameOver(false);
    };

    const handleGameOver = (finalScore: number) => {
        const endTime = Date.now() / 1000;
        setGameEndTime(endTime);
        const roundedScore = Math.floor(finalScore);
        setGameState(prev => ({ ...prev, isPlaying: false, score: roundedScore }));
        setIsGameOver(true);
    };

    const handleNameSubmit = async () => {
        // Only add to leaderboard if name is provided
        if (gameState.playerName) {
            try {
                const response = await fetch('/api/scores', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: gameState.playerName,
                        score: gameState.score,
                        walletAddress: isConnected ? await provider?.getSigner().then(signer => signer.getAddress()) : undefined
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to save score');
                }

                // Refresh leaderboard
                const updatedScores = await fetch('/api/scores').then(res => res.json());
                setLeaderboard(updatedScores);
            } catch (error) {
                console.error('Error saving score:', error);
            }
        }
        setGameState(prev => ({ ...prev, hasEnteredName: true }));
    };

    const handlePlayAgain = () => {
        const startTime = Date.now() / 1000;
        setGameStartTime(startTime);
        setGameState({
            isPlaying: true,
            score: 0,
            playerName: '',
            hasEnteredName: false
        });
        setIsGameOver(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.gameWrapper}>
                <Canvas
                    width={gameWidth}
                    height={gameHeight}
                    isPlaying={gameState.isPlaying}
                    onGameOver={handleGameOver}
                />
                {!gameState.isPlaying && !isGameOver && (
                    <div className={styles.menuContainer}>
                        <div className={styles.instructions}>
                            <h3>How to Play</h3>
                            <p>Press <span className={styles.key}>Space</span> or <span className={styles.key}>Tap</span> to jump</p>
                            <p>Collect Moyaki for power-ups, and avoid Chog and Mooch!</p>
                            <p>The longer you survive, the higher your score!</p>
                        </div>
                        <button onClick={handleStartGame}>Start Game</button>
                        {leaderboard.length > 0 && (
                            <div className={styles.leaderboard}>
                                <h3>Top Scores</h3>
                                {leaderboard.map((entry, index) => (
                                    <div key={index} className={styles.leaderboardEntry}>
                                        <span className={styles.rank}>#{index + 1}</span>
                                        <span className={styles.name}>{entry.name}</span>
                                        <span className={styles.score}>{Math.floor(entry.score)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {isGameOver && !gameState.hasEnteredName && (
                    <div className={styles.gameOverContainer}>
                        <h2>Game Over!</h2>
                        <p>Score: {Math.floor(gameState.score)}</p>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={gameState.playerName}
                            onChange={(e) => setGameState(prev => ({ ...prev, playerName: e.target.value }))}
                        />
                        <button onClick={handleNameSubmit}>Submit Score</button>
                    </div>
                )}
                {isGameOver && gameState.hasEnteredName && (
                    <div className={styles.gameOverContainer}>
                        <h2>Game Over!</h2>
                        <p>Score: {Math.floor(gameState.score)}</p>
                        <button onClick={handleConnect}>
                            {isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
                        </button>
                        <button
                            onClick={handleMintScore}
                            disabled={isMinting || !isConnected}
                        >
                            {isMinting ? 'Minting...' : 'Mint Score'}
                        </button>
                        {mintStatus && (
                            <div className={`${styles.mintStatus} ${styles[mintStatus.status]}`}>
                                <p>{mintStatus.message}</p>
                                {mintStatus.status === 'error' &&
                                    mintStatus.message.includes('foul play') && (
                                        <p className={styles.errorDetails}>
                                            Please play the game normally.
                                        </p>
                                    )}
                                {mintStatus.hash && (
                                    <a
                                        href={`https://explorer.monad-devnet.devnet101.com/tx/${mintStatus.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.txLink}
                                    >
                                        View Transaction
                                    </a>
                                )}
                            </div>
                        )}
                        <button onClick={handlePlayAgain}>
                            Play Again
                        </button>
                        {leaderboard.length > 0 && (
                            <div className={styles.leaderboard}>
                                <h3>Top Scores</h3>
                                {leaderboard.map((entry, index) => (
                                    <div key={index} className={styles.leaderboardEntry}>
                                        <span className={styles.rank}>#{index + 1}</span>
                                        <span className={styles.name}>{entry.name}</span>
                                        <span className={styles.score}>{Math.floor(entry.score)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
} 
```

# contexts/Web3Context.tsx

```tsx
import React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface Web3ContextType {
    account: string | null;
    connectWallet: () => Promise<void>;
    mintTokens: (score: number) => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
    const [account, setAccount] = useState<string | null>(null);

    // Contract details
    const CONTRACT_ADDRESS = "0xF507dE1de9b36eD3E98c0D4b882C6a82b8C1E2dc";

    const connectWallet = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });
                setAccount(accounts[0]);
            } else {
                alert('Please install a Web3 wallet like MetaMask or Rabby!');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    };

    const mintTokens = async (score: number) => {
        try {
            if (!account) throw new Error('Wallet not connected');

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // Get contract interface
            const abi = ["function mint(address to, uint256 amount) public"];
            const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

            // Mint tokens equal to score
            const tx = await contract.mint(account, ethers.parseEther(score.toString()));
            await tx.wait();

            alert(`Successfully minted ${score} tokens!`);
        } catch (error) {
            console.error('Error minting tokens:', error);
            alert('Failed to mint tokens. See console for details.');
        }
    };

    return (
        <Web3Context.Provider value={{ account, connectWallet, mintTokens }}>
            {children}
        </Web3Context.Provider>
    );
}

export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (!context) throw new Error('useWeb3 must be used within a Web3Provider');
    return context;
}; 
```

# contracts/NadrunnerToken.sol

```sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract NadrunnerToken is ERC20, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 public constant MAX_GAME_MINT = 10000 ether;  // 10,000 tokens with 18 decimals
    address public signer;  // Address authorized to sign mint requests
    
    // Mapping to track used nonces
    mapping(bytes32 => bool) public usedSignatures;
    
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    
    constructor() ERC20("Nadrunner", "NADR") Ownable(msg.sender) {
        signer = msg.sender; // Initially set owner as signer
    }

    // Update signer address - only owner can call
    function setSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer address");
        address oldSigner = signer;
        signer = newSigner;
        emit SignerUpdated(oldSigner, newSigner);
    }

    // Admin mint function for testing
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // Verify and mint game score
    function mintGameScore(uint256 score, bytes memory signature) public {
        require(score <= MAX_GAME_MINT, "Score exceeds maximum allowed mint");
        
        // Create message hash
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,    // Player address
            score,         // Score amount
            block.chainid  // Chain ID for cross-chain replay protection
        ));

        // Convert to Ethereum Signed Message hash
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Verify signature
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        require(recoveredSigner == signer, "Invalid signature");

        // Mark signature as used
        usedSignatures[messageHash] = true;

        // Mint tokens
        _mint(msg.sender, score);
    }
} 
```

# docs/PROJECT_PLAN.md

```md
# MonadRun Token Integration Documentation

## Overview
Integration of ERC20 token minting functionality into MonadRun game, allowing players to mint tokens based on their game scores on Base Testnet.

## Technical Specifications

### Smart Contract
- **Type**: ERC20 Token
- **Network**: Base Testnet
- **Features**:
  - No maximum supply
  - No minting cooldown
  - Minting amount equals game score
  - Only legitimate game sessions can trigger mints

### Token Details
- **Minting Rules**:
  - 1 score point = 1 token
  - Minimum score required: 1
  - No maximum minting limit
  - Score verification required to prevent manipulation

### Web3 Integration
- **Libraries**: ethers.js
- **Supported Wallets**:
  - MetaMask
  - Rabby
- **Connection Flow**:
  - Wallet connect prompt only shown on game over screen
  - Transaction confirmation and status messages
  - Error handling for failed transactions

### Security Considerations
- Score verification system
- Prevention of client-side manipulation
- Secure wallet connection handling
- Transaction error handling

## Implementation Steps
1. Create and deploy ERC20 smart contract
2. Implement web3 connection functionality
3. Add score verification system
4. Integrate minting functionality
5. Add UI elements for wallet connection and minting
6. Implement transaction status feedback
7. Add error handling and user feedback

## Testing Plan
1. Smart contract testing on testnet
2. Score verification testing
3. Wallet connection testing
4. Minting functionality testing
5. UI/UX testing
6. Error handling testing 
```

# hardhat.config.ts

```ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const DEVNET_RPC_URL = process.env.DEVNET_RPC_URL || "https://testnet-rpc.monad.xyz";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        monadDevnet: {
            url: DEVNET_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 20143,
            gasPrice: "auto"
        }
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};

export default config; 
```

# lib/db.ts

```ts
import { sql } from '@vercel/postgres';

export async function createScoresTable() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                wallet_address VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log('Scores table created successfully');
    } catch (error) {
        console.error('Error creating scores table:', error);
        throw error;
    }
}

export async function saveScore(name: string, score: number, walletAddress?: string) {
    try {
        const result = await sql`
            INSERT INTO scores (name, score, wallet_address)
            VALUES (${name}, ${score}, ${walletAddress})
            RETURNING *;
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Error saving score:', error);
        throw error;
    }
}

export async function getTopScores(limit = 100) {
    try {
        const result = await sql`
            SELECT name, score, wallet_address, created_at
            FROM scores
            ORDER BY score DESC
            LIMIT ${limit};
        `;
        return result.rows;
    } catch (error) {
        console.error('Error getting top scores:', error);
        throw error;
    }
} 
```

# next-env.d.ts

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.

```

# next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                // matching all API routes
                source: "/api/:path*",
                headers: [
                    { key: "Access-Control-Allow-Credentials", value: "true" },
                    { key: "Access-Control-Allow-Origin", value: "*" },
                    { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
                    { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
                ]
            },
            {
                // matching all pages
                source: "/:path*",
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors 'self' https://auth.magic.link"
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'ALLOW-FROM https://auth.magic.link'
                    }
                ]
            }
        ]
    }
};

module.exports = nextConfig; 
```

# package.json

```json
{
  "name": "nadrunner",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "init-db": "ts-node scripts/init-db.ts"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.1.0",
    "@tanstack/react-query": "^5.62.11",
    "@vercel/postgres": "^0.10.0",
    "@web3modal/ethereum": "^2.7.1",
    "@web3modal/react": "^2.7.1",
    "@web3modal/wagmi": "^5.1.11",
    "ethers": "^6.0.0",
    "next": "14.0.4",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "viem": "^2.22.1",
    "wagmi": "^2.14.6"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "dotenv": "^16.3.1",
    "hardhat": "^2.19.4",
    "ts-node": "^10.9.2",
    "typescript": "^5"
  }
}
```

# pages/_app.tsx

```tsx
import React from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, WagmiConfig } from 'wagmi';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { CHAIN } from '../utils/chains';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!;

const metadata = {
    name: 'Nadrunner',
    description: 'Nadrunner Game',
    url: 'https://nadrunner.vercel.app',
    icons: ['https://nadrunner.vercel.app/favicon.ico']
};

const wagmiConfig = defaultWagmiConfig({
    projectId,
    metadata,
    chains: [CHAIN as any] // Type assertion needed due to chain definition differences
});

createWeb3Modal({
    wagmiConfig,
    projectId,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-font-family': 'Roboto, sans-serif'
    }
});

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <WagmiConfig config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <Component {...pageProps} />
            </QueryClientProvider>
        </WagmiConfig>
    );
}

export default MyApp;

```

# pages/api/generate-score-signature.ts

```ts
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

// Load environment variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY!;
const CHAIN_ID = process.env.MONAD_CHAIN_ID || '20143'; // Fallback to Monad Devnet

type RequestData = {
    playerAddress: string;
    score: number;
    gameStartTime: number;
    gameEndTime: number;
    sessionId?: string; // Optional: for additional verification
};

type ResponseData = {
    signature?: string;  // Make signature optional
    score: number;
    error?: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://nadrunner.vercel.app');  // Replace with your domain
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');  // Only needed methods
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'  // Only needed headers
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    console.log('API called with body:', req.body);
    console.log('Environment variables:', {
        hasPrivateKey: !!SIGNER_PRIVATE_KEY,
        chainId: CHAIN_ID
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', score: 0 } as ResponseData);
    }

    try {
        const { playerAddress, score, gameStartTime, gameEndTime, sessionId } = req.body as RequestData;
        console.log('Processing request for:', { playerAddress, score, gameStartTime, gameEndTime, sessionId });

        // Basic input validation
        if (!playerAddress || !score || !gameStartTime || !gameEndTime) {
            return res.status(400).json({
                error: 'Missing required fields',
                score: 0
            });
        }

        // Add score validation rules
        const MIN_GAME_DURATION = 1;      // Minimum seconds needed to achieve any score
        const MAX_SCORE_PER_SECOND = 25;  // Accounts for base rate (10) * 2x multiplier + buffer


        // Time-based validation
        const gameDuration = gameEndTime - gameStartTime;

        if (gameDuration < MIN_GAME_DURATION) {
            return res.status(400).json({
                error: 'Invalid gameplay detected. Game duration too short.',
                score: 0
            });
        }

        // Validate score based on actual play time
        const maxPossibleScore = gameDuration * MAX_SCORE_PER_SECOND;
        if (score > maxPossibleScore) {
            return res.status(400).json({
                error: 'Foul play detected. Please play the game normally.',
                score: 0
            });
        }

        // Validate Ethereum address
        if (!ethers.isAddress(playerAddress)) {
            return res.status(400).json({
                error: 'Invalid player address',
                score: 0
            });
        }

        // Optional: Verify session validity
        // if (sessionId) {
        //   const isValidSession = await verifyGameSession(sessionId);
        //   if (!isValidSession) {
        //     return res.status(401).json({ 
        //       error: 'Invalid game session', 
        //       score: 0 
        //     });
        //   }
        // }

        // Create wallet instance for signing
        const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

        // Convert score to the same format as the contract expects
        const scoreInWei = ethers.parseUnits(Math.floor(score).toString(), 18);

        // Create message hash - must match contract's hash creation exactly
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'uint256'],
            [playerAddress, scoreInWei, BigInt(CHAIN_ID)]  // Convert CHAIN_ID to BigInt
        );

        // Sign the message hash directly
        const signature = await signer.signMessage(ethers.getBytes(messageHash));

        console.log('Debug values:', {
            playerAddress,
            scoreInWei: scoreInWei.toString(),
            chainId: CHAIN_ID,
            messageHash,
            signature
        });

        // Return the signature
        return res.status(200).json({
            signature,
            score
        });

    } catch (error) {
        console.error('Signature generation error:', error);
        return res.status(500).json({
            error: 'Failed to generate signature',
            score: 0
        });
    }
} 
```

# pages/api/scores.ts

```ts
import { NextApiRequest, NextApiResponse } from 'next';
import { saveScore, getTopScores, createScoresTable } from '../../lib/db';

// Create table on module initialization
createScoresTable().catch(console.error);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const { name, score, walletAddress } = req.body;
            if (!name || typeof score !== 'number') {
                return res.status(400).json({ error: 'Name and score are required' });
            }
            const result = await saveScore(name, score, walletAddress);
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error saving score:', error);
            return res.status(500).json({ error: 'Error saving score' });
        }
    } else if (req.method === 'GET') {
        try {
            const scores = await getTopScores();
            return res.status(200).json(scores);
        } catch (error) {
            console.error('Error getting scores:', error);
            return res.status(500).json({ error: 'Error getting scores' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
} 
```

# pages/index.tsx

```tsx
import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import GameContainer from '../components/Game/GameContainer';
import styles from '../styles/Home.module.css';

const Home: NextPage = () => {
    return (
        <div className={styles.container}>
            <Head>
                <title>NadRunner</title>
                <meta name="description" content="An endless runner game with Molandak." />
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <div className={styles.dot1} />
                <div className={styles.dot2} />
                <div className={styles.dot3} />

                <Image
                    src="/assets/molandak.png"
                    alt="Molandak mascot"
                    width={80}
                    height={80}
                    className={styles.mascotLeft}
                />

                <Image
                    src="/assets/molandak.png"
                    alt="Molandak mascot"
                    width={80}
                    height={80}
                    className={styles.mascotRight}
                />

                <h1 className={styles.title}>NadRunner</h1>
                <GameContainer />
            </main>
        </div>
    );
};

export default Home;

```

# public/assets/chog.png

This is a binary file of the type: Image

# public/assets/images/chog.png

This is a binary file of the type: Image

# public/assets/images/molandak.png

This is a binary file of the type: Image

# public/assets/images/mouch.png

This is a binary file of the type: Image

# public/assets/images/moyaki.png

This is a binary file of the type: Image

# public/assets/images/salmonad.png

This is a binary file of the type: Image

# public/assets/molandak.png

This is a binary file of the type: Image

# public/assets/mouch.png

This is a binary file of the type: Image

# public/assets/moyaki.png

This is a binary file of the type: Image

# public/assets/salmonad.png

This is a binary file of the type: Image

# scripts/deploy-monad.ts

```ts
import { ethers } from "hardhat";
import { verify } from "./verify";

async function main() {
    console.log("🚀 Starting deployment to Monad...");

    try {
        const [deployer] = await ethers.getSigners();
        const deployerAddress = await deployer.getAddress();

        console.log("🔑 Deploying with account:", deployerAddress);
        console.log("💰 Account balance:", (await deployer.provider.getBalance(deployerAddress)).toString());

        // Deploy the contract
        console.log("\n🏗 Deploying NadrunnerToken...");
        const NadrunnerToken = await ethers.getContractFactory("NadrunnerToken");
        const token = await NadrunnerToken.deploy();

        console.log("⏱ Waiting for deployment transaction...");
        const deployTxHash = token.deploymentTransaction()?.hash;
        console.log("📝 Deployment transaction hash:", deployTxHash);

        await token.waitForDeployment();
        const tokenAddress = await token.getAddress();

        console.log("\n✅ NadrunnerToken deployed successfully!");
        console.log("📄 Contract address:", tokenAddress);
        console.log("\n⚡ Deployment complete! ⚡\n");

        // Save this address for your configuration
        console.log("-----------------------------------");
        console.log("🔔 Important: Update your configuration!");
        console.log("Copy this address to your web3.ts CONTRACT_ADDRESS:");
        console.log(tokenAddress);
        console.log("-----------------------------------");

        // Verify the contract if we're on a network that supports verification
        if (process.env.CHAIN_ENV === "devnet") {
            console.log("\n🔍 Verifying contract on Monad Explorer...");
            try {
                await verify(tokenAddress, []);
                console.log("✅ Contract verified successfully!");
            } catch (error) {
                console.log("⚠️ Verification failed:", error);
            }
        }

    } catch (error) {
        console.error("\n❌ Deployment failed!");
        console.error(error);
        process.exitCode = 1;
    }
}

main(); 
```

# scripts/deploy.ts

```ts
import { ethers } from "hardhat";

async function main() {
    console.log("Deploying Nadrunner Token to Base mainnet...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    const Token = await ethers.getContractFactory("contracts/NadrunnerToken.sol:NadrunnerToken");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const address = await token.getAddress();
    console.log("Token deployed to:", address);

    console.log("\nVerification command:");
    console.log(`npx hardhat verify --network base ${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 
```

# scripts/init-db.ts

```ts
import { createScoresTable } from '../lib/db';

async function init() {
    try {
        await createScoresTable();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

init(); 
```

# scripts/mint.ts

```ts
import { ethers } from "hardhat";

async function main() {
    // Store the address where we deployed our contract
    const CONTRACT_ADDRESS = "0xF507dE1de9b36eD3E98c0D4b882C6a82b8C1E2dc";

    // Get a reference to our deployed contract
    // ethers.getContractAt(ContractName, ContractAddress) creates an interface to interact with the contract
    const token = await ethers.getContractAt("MonadRunTestToken", CONTRACT_ADDRESS);

    // Convert 100 tokens to the correct number of decimals (18)
    // 1 token = 1000000000000000000 (18 zeros)
    // parseEther("100") = 100000000000000000000
    const amountToMint = ethers.parseEther("100");

    // Get the wallet address that will send the transaction
    // This uses the private key from our .env file
    const [signer] = await ethers.getSigners();

    // Call the mint function on our contract
    // tx is the transaction object
    const tx = await token.mint(signer.address, amountToMint);

    // Wait for the transaction to be confirmed on the blockchain
    await tx.wait();

    // Log how many tokens we minted and to which address
    console.log(`Minted ${ethers.formatEther(amountToMint)} tokens to ${signer.address}`);

    // Check the balance after minting
    // balanceOf is a standard ERC20 function
    const balance = await token.balanceOf(signer.address);
    console.log(`New balance: ${ethers.formatEther(balance)} tokens`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 
```

# scripts/setSigner.ts

```ts
import { ethers } from "hardhat";

async function main() {
    // Get the private key from environment variable
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
        throw new Error("SIGNER_PRIVATE_KEY not found in environment variables");
    }

    // Calculate the signer address from the private key
    const wallet = new ethers.Wallet(signerPrivateKey);
    const signerAddress = wallet.address;

    console.log("Setting signer address:", signerAddress);

    // Get the contract
    const token = await ethers.getContractAt(
        "contracts/NadrunnerToken.sol:NadrunnerToken",
        "0xBC1994792878aed2B372E7f5a0Cc52a39CB6fBfF"
    );

    // Set the signer
    const tx = await token.setSigner(signerAddress);
    await tx.wait();

    console.log("Signer address set successfully!");
    console.log("Transaction hash:", tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 
```

# scripts/verify.ts

```ts
import { run } from "hardhat";

export async function verify(contractAddress: string, args: any[]) {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
} 
```

# styles/Home.module.css

```css
.container {
    height: 100vh;
    height: 100dvh;
    padding: 0;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #f5f7fa 0%, #e4e7eb 100%);
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    position: fixed;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    background: transparent;
    position: relative;
    z-index: 1;
    overflow: hidden;
    padding: 0;
    height: 100%;
}

.title {
    font-size: min(4rem, 15vw);
    text-align: center;
    margin: 0;
    margin-bottom: 0.5rem;
    background: linear-gradient(45deg, #4F46E5, #7C3AED);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    position: relative;
    font-weight: 800;
    letter-spacing: -0.03em;
}

.mascot {
    width: 80px;
    height: 80px;
    position: absolute;
    animation: float 3s ease-in-out infinite;
    z-index: 0;
    opacity: 0.8;
}

.mascotLeft {
    width: 80px;
    height: 80px;
    position: absolute;
    z-index: 0;
    opacity: 0.8;
    left: 5%;
    top: 20%;
    animation: floatLeft 4s ease-in-out infinite;
}

.mascotRight {
    width: 80px;
    height: 80px;
    position: absolute;
    z-index: 0;
    opacity: 0.8;
    right: 5%;
    top: 30%;
    animation: floatRight 4s ease-in-out infinite;
}

@keyframes float {

    0%,
    100% {
        transform: translateY(0) rotate(0deg);
    }

    50% {
        transform: translateY(-20px) rotate(360deg);
    }
}

@keyframes floatLeft {

    0%,
    100% {
        transform: translateY(0) rotate(0deg) scale(0.8);
    }

    50% {
        transform: translateY(-30px) rotate(360deg) scale(1);
    }
}

@keyframes floatRight {

    0%,
    100% {
        transform: translateY(-20px) rotate(0deg) scale(0.9);
    }

    50% {
        transform: translateY(10px) rotate(-360deg) scale(1.1);
    }
}

.decorativeDot {
    position: absolute;
    border-radius: 50%;
    background: linear-gradient(45deg, #4F46E5, #7C3AED);
    opacity: 0.1;
    z-index: 0;
}

.dot1 {
    position: absolute;
    border-radius: 50%;
    background: linear-gradient(45deg, #4F46E5, #7C3AED);
    opacity: 0.1;
    z-index: 0;
    width: 200px;
    height: 200px;
    left: -100px;
    top: 20%;
}

.dot2 {
    position: absolute;
    border-radius: 50%;
    background: linear-gradient(45deg, #4F46E5, #7C3AED);
    opacity: 0.1;
    z-index: 0;
    width: 150px;
    height: 150px;
    right: -50px;
    top: 40%;
}

.dot3 {
    position: absolute;
    border-radius: 50%;
    background: linear-gradient(45deg, #4F46E5, #7C3AED);
    opacity: 0.1;
    z-index: 0;
    width: 100px;
    height: 100px;
    left: 20%;
    bottom: 10%;
}

@media (max-width: 768px) {
    .main {
        padding: 0.5rem;
    }

    .title {
        font-size: min(2.5rem, 10vw);
        margin-bottom: 0.25rem;
    }

    .mascot {
        width: 60px;
        height: 60px;
    }

    .mascotLeft {
        left: 2%;
    }

    .mascotRight {
        right: 2%;
    }
}
```

# tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "preserve",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "moduleResolution": "node",
    "isolatedModules": true
  },
  "include": [
    "hardhat.config.ts",
    "./scripts",
    "./test",
    "./components/**/*",
    "./pages/**/*"
  ],
  "files": [
    "hardhat.config.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}

```

# utils/chains.ts

```ts
import { defineChain } from "viem";

const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_DEVNET_RPC_URL!;
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '20143');
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL!;

export const monadDevnet = defineChain({
    id: CHAIN_ID,
    name: "Monad Devnet",
    nativeCurrency: {
        name: "DMON",
        symbol: "DMON",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [DEVNET_RPC_URL],
        },
    },
    blockExplorers: {
        default: {
            name: "Monad Explorer",
            url: EXPLORER_URL,
        },
    },
    chainNamespace: "eip155",
    caipNetworkId: `eip155:${CHAIN_ID}`,
});

export const monadTestnet = defineChain({
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: {
        name: "TMON",
        symbol: "TMON",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ["https://rpc.monad-testnet.category.xyz/rpc/K1E4kI8vesB3xIk9Kh9vflrTnE7wzFL0EGbeZAYc"],
        },
    },
    blockExplorers: {
        default: {
            name: "Monad Testnet",
            url: "https://explorer.monad-testnet.category.xyz",
        },
    },
    chainNamespace: "eip155",
    caipNetworkId: "eip155:10143",
});

// Use devnet by default since that's where we deployed
export const CHAIN = monadDevnet; 
```

# utils/web3.ts

```ts
declare global {
    interface Window {
        ethereum?: any;
    }
}

import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { CHAIN } from './chains';
import * as ethers from 'ethers';

// Contract deployed with signature verification
export const CONTRACT_ADDRESS = "0xF507dE1de9b36eD3E98c0D4b882C6a82b8C1E2dc";

// ABI for the mint function
export const CONTRACT_ABI = [
    "function mint(address to, uint256 amount) public",
    "function mintGameScore(uint256 score, bytes memory signature) public",
    "function balanceOf(address account) public view returns (uint256)"
] as const;

// Create Viem public client
export const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(CHAIN.rpcUrls.default.http[0])
});

// Create wallet client when needed
export const createWallet = () => {
    if (!window.ethereum) throw new Error("No Web3 Provider found");
    return createWalletClient({
        chain: CHAIN,
        transport: custom(window.ethereum)
    });
};

// Function to switch network
async function switchToMonadNetwork(provider: any) {
    const chainIdHex = `0x${CHAIN.id.toString(16)}`;
    console.log('Attempting to switch to chain:', {
        chainId: CHAIN.id,
        chainIdHex,
        name: CHAIN.name,
        rpcUrl: CHAIN.rpcUrls.default.http[0]
    });

    try {
        // First try to switch
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
        });
    } catch (switchError: any) {
        console.log('Switch error:', switchError);

        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902 || switchError.code === -32603) {
            try {
                console.log('Adding network to wallet...');
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: chainIdHex,
                        chainName: CHAIN.name,
                        nativeCurrency: {
                            name: CHAIN.nativeCurrency.name,
                            symbol: CHAIN.nativeCurrency.symbol,
                            decimals: CHAIN.nativeCurrency.decimals
                        },
                        rpcUrls: CHAIN.rpcUrls.default.http,
                        blockExplorerUrls: CHAIN.blockExplorers?.default ? [CHAIN.blockExplorers.default.url] : undefined
                    }]
                });

                // After adding, try switching again
                console.log('Network added, attempting to switch again...');
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chainIdHex }],
                });
            } catch (addError: any) {
                console.error('Error adding network:', addError);
                throw new Error(`Failed to add Monad network. Please add it manually with:\nNetwork Name: ${CHAIN.name}\nRPC URL: ${CHAIN.rpcUrls.default.http[0]}\nChain ID: ${CHAIN.id}\nSymbol: ${CHAIN.nativeCurrency.symbol}`);
            }
        } else if (switchError.code === 4001) {
            throw new Error('User rejected the network switch. Please try again and approve the network switch in your wallet.');
        } else {
            console.error('Error switching network:', switchError);
            throw new Error(`Please add Monad network to your wallet manually:\nNetwork Name: ${CHAIN.name}\nRPC URL: ${CHAIN.rpcUrls.default.http[0]}\nChain ID: ${CHAIN.id}\nSymbol: ${CHAIN.nativeCurrency.symbol}`);
        }
    }

    // Verify we're on the correct network
    try {
        const currentChainId = await provider.request({ method: 'eth_chainId' });
        if (currentChainId.toLowerCase() !== chainIdHex.toLowerCase()) {
            throw new Error(`Network switch failed. Expected ${chainIdHex}, got ${currentChainId}`);
        }
    } catch (error) {
        console.error('Error verifying network:', error);
        throw new Error('Failed to verify network switch. Please ensure you are on the Monad network.');
    }
}

export const getContract = async (provider: any) => {
    if (!provider) throw new Error("No provider available");
    try {
        const signer = await provider.getSigner();
        return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    } catch (error) {
        console.error("Error getting contract:", error);
        throw error;
    }
};

export type TransactionStatus = {
    status: 'pending' | 'mining' | 'success' | 'error';
    message: string;
    hash?: string;
    error?: string;
};

export const mintScore = async (
    address: string,
    score: number,
    gameStartTime: number,
    gameEndTime: number,
    onStatus: (status: TransactionStatus) => void
) => {
    if (!window.ethereum) {
        throw new Error("No Web3 Provider found. Please install a wallet.");
    }

    try {
        onStatus({
            status: 'pending',
            message: 'Getting signature from server...'
        });

        // Get signature from our API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nadrunner.vercel.app';
        const signatureResponse = await fetch(`${apiUrl}/api/generate-score-signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerAddress: address,
                score: score,
                gameStartTime: gameStartTime,
                gameEndTime: gameEndTime
            })
        });

        const data = await signatureResponse.json();

        if (!signatureResponse.ok) {
            throw new Error(data.error || 'Failed to get signature from server');
        }

        if (!data.signature) {
            throw new Error('No signature received from server');
        }

        onStatus({
            status: 'pending',
            message: 'Preparing transaction...'
        });

        // First ensure we're on the right network
        onStatus({
            status: 'pending',
            message: 'Checking network...'
        });

        await switchToMonadNetwork(window.ethereum);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = await getContract(provider);

        // Convert score to a whole number and shift by 18 decimals
        const scoreAmount = ethers.parseUnits(Math.floor(score).toString(), 18);

        onStatus({
            status: 'pending',
            message: 'Please confirm the transaction in your wallet'
        });

        // Send transaction with fixed gas limit for Monad
        const tx = await contract.mintGameScore(scoreAmount, data.signature, {
            gasLimit: 500000 // Fixed gas limit for Monad
        });

        onStatus({
            status: 'mining',
            message: 'Transaction is being mined...',
            hash: tx.hash
        });

        const receipt = await tx.wait();

        onStatus({
            status: 'success',
            message: 'Score minted successfully! 🎉',
            hash: tx.hash
        });

        return tx;
    } catch (error: any) {
        console.error('Detailed error:', error);

        let errorMessage = 'Failed to mint score. Please try again.';

        // Check if it's a validation error from our API
        if (error.message.includes('foul play') || error.message.includes('Invalid gameplay')) {
            errorMessage = error.message;
        }
        // Check if it's a network switching error
        else if (error.message.includes('network')) {
            errorMessage = error.message;
        }
        // Check if it's a revert error
        else if (error.code === 'CALL_EXCEPTION') {
            errorMessage = 'Transaction failed: Score might exceed maximum allowed (10,000 tokens)';
        }
        // Check if it's a gas estimation error
        else if (error.message.includes('estimateGas')) {
            errorMessage = 'Failed to estimate gas: The transaction might revert.';
        }

        onStatus({
            status: 'error',
            message: errorMessage,
            error: error.message
        });

        throw error;
    }
}; 
```

