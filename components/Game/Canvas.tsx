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
        type: 'ground' | 'air' | 'box' | 'box2' | 'box3';
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
    boxJumps: number;
    lastBoxJumpTime: number;
    lastObstacleType?: string;
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

const boxImage = typeof window !== 'undefined' ? new window.Image() : null;
if (boxImage) boxImage.src = '/assets/box.png';

const box2Image = typeof window !== 'undefined' ? new window.Image() : null;
if (box2Image) box2Image.src = '/assets/box2.png';

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
    boxJumps: 0,
    lastBoxJumpTime: 0,
    lastObstacleType: undefined,
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

// Add a constant for box height
const BOX_HEIGHT = OBSTACLE_SIZE * 2.5; // Original box height (1.5x taller than regular obstacles)
const BOX2_HEIGHT = OBSTACLE_SIZE * 7; // Make box2 taller to accommodate the gap
const BOX2_WIDTH = OBSTACLE_SIZE ; // Make box2 wider if needed

// Add with other box constants
const BOX3_HEIGHT = OBSTACLE_SIZE * 2.5;
const BOX3_WIDTH = OBSTACLE_SIZE;
const BOX3_FLOAT_HEIGHT = OBSTACLE_SIZE * 2; // Height above ground

// Update BOX_TYPES constant
const BOX_TYPES = {
    SOLID: 'box',
    PASSABLE: 'box2',
    FLOATING: 'box3'
} as const;

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
        const minDistance = MIN_OBSTACLE_DISTANCE;

        // Move existing obstacles
        state.obstacles = state.obstacles.filter(obstacle => {
            obstacle.x -= state.gameSpeed;
            return obstacle.x + OBSTACLE_SIZE > 0;
        });

        // Spawn new obstacles
        if (Math.random() < OBSTACLE_SPAWN_CHANCE &&
            (state.obstacles.length === 0 ||
                width - state.lastObstacleX > minDistance)) {

            // Get all possible obstacle types
            const obstacleTypes = ['ground', 'air', BOX_TYPES.SOLID, BOX_TYPES.PASSABLE, BOX_TYPES.FLOATING];
            
            // Filter out the last used type
            const availableTypes = obstacleTypes.filter(type => type !== state.lastObstacleType);
            
            // Randomly select from available types
            const obstacleType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            
            // Store the selected type for next spawn
            state.lastObstacleType = obstacleType;

            const obstacleY = obstacleType === 'ground' ? 
                height - groundHeight - OBSTACLE_SIZE :
                obstacleType === BOX_TYPES.SOLID ?
                height - groundHeight - BOX_HEIGHT :
                obstacleType === BOX_TYPES.PASSABLE ?
                height - groundHeight - BOX2_HEIGHT :
                obstacleType === BOX_TYPES.FLOATING ?
                height - groundHeight - BOX3_HEIGHT - BOX3_FLOAT_HEIGHT :
                height - groundHeight - OBSTACLE_SIZE * 2;

            state.obstacles.push({
                x: width + 100,
                y: obstacleY,
                width: obstacleType === BOX_TYPES.PASSABLE ? BOX2_WIDTH :
                       obstacleType === BOX_TYPES.FLOATING ? BOX3_WIDTH :
                       OBSTACLE_SIZE,
                height: obstacleType === BOX_TYPES.SOLID ? BOX_HEIGHT :
                       obstacleType === BOX_TYPES.PASSABLE ? BOX2_HEIGHT :
                       obstacleType === BOX_TYPES.FLOATING ? BOX3_HEIGHT :
                       OBSTACLE_SIZE,
                type: obstacleType,
                image: obstacleType === 'ground' ? obstacleImages.ground : 
                      obstacleType === 'air' ? obstacleImages.air : 
                      obstacleType === BOX_TYPES.PASSABLE ? box2Image : boxImage
            });
            state.lastObstacleX = width;
        }

        // Check collisions with special handling for boxes
        if (!state.powerupEffects.invincible) {
            const playerHitbox = {
                x: PLAYER_START_X,
                y: state.playerY,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE
            };

            for (const obstacle of state.obstacles) {
                if (obstacle.type === BOX_TYPES.SOLID) {
                    const playerBottom = playerHitbox.y + playerHitbox.height;
                    const boxTop = obstacle.y;
                    
                    // Check horizontal overlap
                    const isOverlappingX = playerHitbox.x < obstacle.x + obstacle.width &&
                                         playerHitbox.x + playerHitbox.width > obstacle.x;

                    // Define landing zone (top 20% of box)
                    const landingZoneHeight = obstacle.height * 0.2;
                    const isInLandingZone = playerBottom >= boxTop && 
                                          playerBottom <= boxTop + landingZoneHeight &&
                                          state.yVelocity > 0;

                    if (isOverlappingX) {
                        if (isInLandingZone) {
                            // Successful landing on box
                            state.playerY = boxTop - PLAYER_SIZE;
                            state.yVelocity = state.jumpStrength * 1.5;
                            state.isJumping = true;
                            state.jumpCount = 0;
                            
                            state.boxJumps++;
                            state.lastBoxJumpTime = Date.now();
                            state.floatingTexts.push({
                                text: `+1 Box Jump`,
                                x: obstacle.x,
                                y: obstacle.y - 30,
                                opacity: 1,
                                createdAt: Date.now()
                            });
                        } else if (playerHitbox.y + playerHitbox.height > boxTop + landingZoneHeight) {
                            // Collision with any part of the box except landing zone
                            onGameOver(state.score);
                            return;
                        }
                    }
                } else if (obstacle.type === BOX_TYPES.PASSABLE) {
                    const playerBottom = playerHitbox.y + playerHitbox.height;
                    const boxTop = obstacle.y;
                    
                    // Check horizontal overlap
                    const isOverlappingX = playerHitbox.x < obstacle.x + obstacle.width &&
                                         playerHitbox.x + playerHitbox.width > obstacle.x;

                    // Define sections of the passable box
                    const sectionHeight = obstacle.height / 3; // Split box into thirds
                    const topSection = boxTop + sectionHeight;
                    const bottomSection = boxTop + (sectionHeight * 2);

                    if (isOverlappingX) {
                        // Check if player is in top section landing zone
                        const isInTopLandingZone = playerBottom >= boxTop && 
                                                 playerBottom <= boxTop + (sectionHeight * 0.2) &&
                                                 state.yVelocity > 0;

                        // Check if player is in bottom section landing zone
                        const isInBottomLandingZone = playerBottom >= bottomSection && 
                                                    playerBottom <= bottomSection + (sectionHeight * 0.2) &&
                                                    state.yVelocity > 0;

                        if (isInTopLandingZone || isInBottomLandingZone) {
                            // Successful landing on either section
                            const landingY = isInTopLandingZone ? boxTop : bottomSection;
                            state.playerY = landingY - PLAYER_SIZE;
                            state.yVelocity = state.jumpStrength * 1.5;
                            state.isJumping = true;
                            state.jumpCount = 0;
                            
                            state.boxJumps++;
                            state.lastBoxJumpTime = Date.now();
                            state.floatingTexts.push({
                                text: `+1 Box Jump`,
                                x: obstacle.x,
                                y: obstacle.y - 30,
                                opacity: 1,
                                createdAt: Date.now()
                            });
                        } else if ((playerHitbox.y < topSection && playerHitbox.y + playerHitbox.height > sectionHeight) || 
                                  (playerHitbox.y < obstacle.y + obstacle.height && playerHitbox.y + playerHitbox.height > bottomSection)) {
                            // Collision with solid parts (top or bottom section)
                            onGameOver(state.score);
                            return;
                        }
                        // Middle section is passable - no collision check needed
                    }
                } else if (obstacle.type === BOX_TYPES.FLOATING) {
                    const playerBottom = playerHitbox.y + playerHitbox.height;
                    const boxTop = obstacle.y;
                    
                    // Check horizontal overlap
                    const isOverlappingX = playerHitbox.x < obstacle.x + obstacle.width &&
                                          playerHitbox.x + playerHitbox.width > obstacle.x;

                    // Define landing zone (top 20% of box)
                    const landingZoneHeight = obstacle.height * 0.2;
                    const isInLandingZone = playerBottom >= boxTop && 
                                           playerBottom <= boxTop + landingZoneHeight &&
                                           state.yVelocity > 0;

                    if (isOverlappingX) {
                        if (isInLandingZone) {
                            // Successful landing on floating box
                            state.playerY = boxTop - PLAYER_SIZE;
                            state.yVelocity = state.jumpStrength * 1.5;
                            state.isJumping = true;
                            state.jumpCount = 0;
                            
                            state.boxJumps++;
                            state.lastBoxJumpTime = Date.now();
                            state.floatingTexts.push({
                                text: `+1 Box Jump`,
                                x: obstacle.x,
                                y: obstacle.y - 30,
                                opacity: 1,
                                createdAt: Date.now()
                            });
                        } else if (playerHitbox.y < boxTop + landingZoneHeight) {
                            // Only collide if hitting the box from above or sides
                            onGameOver(state.score);
                            return;
                        }
                        // Space below box is passable - no collision check needed
                    }
                } else if (checkCollision(playerHitbox, obstacle)) {
                    // Normal collision with other obstacles
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
            const image = obstacle.type === 'ground' ? obstacleImages.ground : 
                         obstacle.type === 'air' ? obstacleImages.air :
                         obstacle.type === BOX_TYPES.PASSABLE ? box2Image : boxImage;
            
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