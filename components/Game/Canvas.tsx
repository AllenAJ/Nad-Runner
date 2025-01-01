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
    timeSinceStart: 0
};

const PLAYER_SIZE = 50;
const OBSTACLE_SIZE = 50;
const POWERUP_SIZE = 40;
const GROUND_HEIGHT = 80;
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

    // Setup high DPI canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Get the device pixel ratio
        const dpr = window.devicePixelRatio || 1;

        // Set the canvas size in actual pixels
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        // Scale the context to ensure correct drawing operations
        ctx.scale(dpr, dpr);

        // Set the "style" size of the canvas
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        // Enable image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }, [width, height]);

    const resetGame = () => {
        gameStateRef.current = {
            ...INITIAL_STATE,
            playerY: height - GROUND_HEIGHT - PLAYER_SIZE - PLAYER_OFFSET_FROM_GROUND
        };
    };

    const updatePlayer = (deltaTime: number) => {
        const state = gameStateRef.current;

        state.yVelocity += state.gravity * deltaTime;
        state.playerY += state.yVelocity * deltaTime;
        state.rotation += state.rotationSpeed * deltaTime;

        // Ground collision with new ground height
        if (state.playerY + PLAYER_SIZE > height - GROUND_HEIGHT - PLAYER_OFFSET_FROM_GROUND) {
            state.playerY = height - GROUND_HEIGHT - PLAYER_SIZE - PLAYER_OFFSET_FROM_GROUND;
            state.yVelocity = 0;
            state.isJumping = false;
            state.jumpCount = 0;
        }
    };

    const updateObstacles = (deltaTime: number) => {
        const state = gameStateRef.current;

        // Move existing obstacles
        state.obstacles = state.obstacles.filter(obstacle => {
            obstacle.x -= state.gameSpeed;
            return obstacle.x + OBSTACLE_SIZE > 0;
        });

        // Spawn new obstacles
        if (Math.random() < OBSTACLE_SPAWN_CHANCE &&
            (state.obstacles.length === 0 ||
                width - state.lastObstacleX > MIN_OBSTACLE_DISTANCE)) {

            const isGroundObstacle = Math.random() > 0.5;
            const obstacleY = isGroundObstacle ?
                height - GROUND_HEIGHT - OBSTACLE_SIZE :
                height - GROUND_HEIGHT - OBSTACLE_SIZE * 2.5;

            state.obstacles.push({
                x: width,
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
                x: 100,
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
            const powerupY = height - GROUND_HEIGHT - POWERUP_SIZE -
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
            x: 100,
            y: state.playerY,
            width: PLAYER_SIZE,
            height: PLAYER_SIZE
        };

        state.powerups = state.powerups.filter(powerup => {
            if (!powerup.active && checkCollision(playerHitbox, powerup)) {
                activatePowerup(powerup.type);
                return false;
            }
            return true;
        });
    };

    const activatePowerup = (type: 'score' | 'invincible' | 'doubleJump') => {
        const state = gameStateRef.current;

        switch (type) {
            case 'score':
                state.powerupEffects.scoreMultiplier = 2;
                setTimeout(() => {
                    state.powerupEffects.scoreMultiplier = 1;
                }, 5000);
                break;
            case 'invincible':
                state.powerupEffects.invincible = true;
                setTimeout(() => {
                    state.powerupEffects.invincible = false;
                }, 3000);
                break;
            case 'doubleJump':
                state.powerupEffects.doubleJump = true;
                state.maxJumps = 3;
                setTimeout(() => {
                    state.powerupEffects.doubleJump = false;
                    state.maxJumps = 2;
                }, 7000);
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

        // Clear canvas
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, width, height);

        // Draw ground
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, height - GROUND_HEIGHT, width, GROUND_HEIGHT);

        // Draw player with sprite
        ctx.save();
        ctx.translate(100 + PLAYER_SIZE / 2, state.playerY + PLAYER_SIZE / 2);
        ctx.rotate(state.rotation);

        // Add glow effect when invincible
        if (state.powerupEffects.invincible) {
            ctx.shadowColor = '#6c5ce7';
            ctx.shadowBlur = 20;
            ctx.globalAlpha = 0.8 + Math.sin(Date.now() / 100) * 0.2; // Pulsing effect
        }

        if (characterImage && characterImage.complete) {
            ctx.drawImage(
                characterImage,
                -PLAYER_SIZE / 2,
                -PLAYER_SIZE / 2,
                PLAYER_SIZE,
                PLAYER_SIZE
            );
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
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleJump = (e: KeyboardEvent) => {
            if (e.code === 'Space' && gameStateRef.current.jumpCount < gameStateRef.current.maxJumps) {
                e.preventDefault();
                gameStateRef.current.yVelocity = gameStateRef.current.jumpStrength;
                gameStateRef.current.isJumping = true;
                gameStateRef.current.jumpCount++;
            }
        };

        const handleTouch = (e: TouchEvent) => {
            e.preventDefault();
            if (gameStateRef.current.jumpCount < gameStateRef.current.maxJumps) {
                gameStateRef.current.yVelocity = gameStateRef.current.jumpStrength;
                gameStateRef.current.isJumping = true;
                gameStateRef.current.jumpCount++;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden && isPlaying) {
                onGameOver(gameStateRef.current.score);
            }
        };

        if (isPlaying) {
            resetGame();
            lastTimeRef.current = 0;
            window.addEventListener('keydown', handleJump);
            canvas.addEventListener('touchstart', handleTouch);
            document.addEventListener('visibilitychange', handleVisibilityChange);
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        }

        return () => {
            window.removeEventListener('keydown', handleJump);
            canvas.removeEventListener('touchstart', handleTouch);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying]);

    return (
        <canvas
            ref={canvasRef}
            className={styles.canvas}
            width={width}
            height={height}
        />
    );
};

export default Canvas; 