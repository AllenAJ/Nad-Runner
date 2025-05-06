import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
// Remove Image from 'next/image' as we'll use HTMLImageElement
// import Image from 'next/image'; 
import styles from './FlappyBug.module.css';
import { InventoryContext } from '../../contexts/InventoryContext';
import { MINIPET_FRAMES } from '../Character/MiniPet'; // Assuming MiniPet.tsx exports this
import { INITIAL_ITEMS } from '../../constants/inventory'; // Changed from ALL_ITEMS to INITIAL_ITEMS

interface FlappyBugProps {
    onBackToMenu: () => void;
}

// Game Constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const GRAVITY = 0.3;
const JUMP_STRENGTH = -6;
const PIPE_WIDTH = 60;
const PIPE_GAP = 120; // Vertical gap between pipes
const PIPE_SPEED = 2;
const PIPE_SPAWN_RATE = 150; // Lower number = faster spawning (frames)
const BUG_SIZE = 40;
const BUG_RADIUS = BUG_SIZE / 2; // Define bug radius
const BUG_X_POSITION = 50; // This will now be the X for the bug's center
const BUG_ANIMATION_SPEED = 10; // Frames per SVG change

// Explosion Constants
const EXPLOSION_SVG_COUNT = 20;
const EXPLOSION_FRAME_DURATION = 50; // ms per frame (50ms = 20fps for explosion)
const EXPLOSION_SIZE = 80; // Size to draw the explosion

// Add Canvas Specific Constants
const BACKGROUND_COLOR = '#70c5ce'; // Flappy Bird sky color
const PIPE_COLOR = '#74BF2E';
const PIPE_BORDER_COLOR = '#548C2C';
const SCORE_COLOR = 'white';
const OVERLAY_TEXT_COLOR = 'white';
const OVERLAY_BG_COLOR = 'rgba(0, 0, 0, 0.5)';

// Add background image reference
// const backgroundImage = new window.Image(); // Moved to useEffect
// backgroundImage.src = '/background_flappy.png'; 

type GameStatus = 'ready' | 'playing' | 'gameOver';

interface Pipe {
    id: number;
    x: number;
    topHeight: number;
    scored?: boolean; // Add optional scored flag
}

const FlappyBug: React.FC<FlappyBugProps> = ({ onBackToMenu }) => {
    const [status, setStatus] = useState<GameStatus>('ready');
    const [bugY, setBugY] = useState(GAME_HEIGHT / 2); // BugY is now center Y
    const [bugVelocity, setBugVelocity] = useState(0);
    const [pipes, setPipes] = useState<Pipe[]>([]);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [showGameOverPopup, setShowGameOverPopup] = useState(false);
    const [backgroundX, setBackgroundX] = useState(0); // State for background X position
    const [isBackgroundLoaded, setIsBackgroundLoaded] = useState(false); // <-- New state
    const [activeExplosions, setActiveExplosions] = useState<Array<{ x: number; y: number; startTime: number }>>([]);

    const inventoryContext = useContext(InventoryContext);
    const equippedItems = inventoryContext?.equippedItems;

    const petId = equippedItems?.minipet || 'bug'; // Default to 'bug'
    const currentPetDetails = INITIAL_ITEMS.find(item => item.id === petId && item.subCategory === 'minipet');
    const petName = currentPetDetails ? currentPetDetails.name : 'Bug'; // Default to 'Bug' name if not found
    
    // Ensure petName is a valid key for MINIPET_FRAMES before accessing
    const typedPetName = petName as keyof typeof MINIPET_FRAMES;
    const numFrames = MINIPET_FRAMES[typedPetName] || 8; // Default to 8 frames if pet not in MINIPET_FRAMES

    const [bugFrame, setBugFrame] = useState(1); // Initialize bugFrame state based on potentially dynamic numFrames

    const backgroundImageRef = useRef<HTMLImageElement | null>(null); // Ref for background image
    const explosionImagesRef = useRef<HTMLImageElement[]>([]); // Ref for explosion images
    const pipeNorthImageRef = useRef<HTMLImageElement | null>(null);
    const pipeSouthImageRef = useRef<HTMLImageElement | null>(null);

    const flySoundRef = useRef<HTMLAudioElement | null>(null);
    const scoreSoundRef = useRef<HTMLAudioElement | null>(null);

    const gameLoopRef = useRef<number | null>(null);
    const frameCountRef = useRef(0); // For pipe spawning and animation
    const lastTimestampRef = useRef<number | null>(null);

    // Refs for DOM elements to avoid re-querying
    const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas Ref
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null); // Context Ref

    // Preload Bug SVGs into Image objects
    const bugImages = useRef<HTMLImageElement[]>([]);
    useEffect(() => {
        bugImages.current = []; // Clear on effect run
        // Ensure petName and numFrames are valid before loading
        if (petName && numFrames > 0) {
            for (let i = 1; i <= numFrames; i++) {
                const img = new window.Image();
                // Make sure petName corresponds to a directory name in /public/Mini pets/
                // The petName from INITIAL_ITEMS should match the directory name.
                img.src = `/Mini pets/${petName}/${i}.svg`;
                bugImages.current.push(img);
                // Optional: Add onload/onerror handlers for each image
                img.onload = () => { /* console.log(`Loaded ${petName} frame ${i}`); */ };
                img.onerror = () => { console.error(`Failed to load /Mini pets/${petName}/${i}.svg`); };
            }
        }
    }, [petName, numFrames]); // Rerun when petName or numFrames changes

    // Load background image on client-side
    useEffect(() => {
        const img = new window.Image();
        img.src = 'bg/background_flappy.jpg'; // Assuming it's in /public/
        img.onload = () => {
            backgroundImageRef.current = img;
            setIsBackgroundLoaded(true); // <-- Trigger re-render/update state
            console.log('Background image loaded:', img.width, img.height);
        };
        img.onerror = () => {
            console.error('Failed to load background image.');
            setIsBackgroundLoaded(false); // Or handle error appropriately
        };
        // backgroundImageRef.current = img; // Assign earlier if you prefer, but onload is safer
    }, []);

    // Load explosion images on client-side
    useEffect(() => {
        const images: HTMLImageElement[] = [];
        let loadedCount = 0;
        for (let i = 1; i <= EXPLOSION_SVG_COUNT; i++) {
            const img = new window.Image();
            img.src = `/Explosion/${i}.svg`;
            img.onload = () => {
                loadedCount++;
                if (loadedCount === EXPLOSION_SVG_COUNT) {
                    console.log('All explosion images loaded.');
                    // Optionally, set a state here if other logic depends on all explosions being loaded
                }
            };
            img.onerror = () => console.error(`Failed to load explosion image /Explosion/${i}.svg`);
            images.push(img);
        }
        explosionImagesRef.current = images;
    }, []);

    // Load pipe images on client-side
    useEffect(() => {
        const northPipe = new window.Image();
        northPipe.src = 'assets/pipeNorth.png'; // Assuming in /public/
        northPipe.onload = () => {
            pipeNorthImageRef.current = northPipe;
            console.log('Pipe North image loaded.');
        };
        northPipe.onerror = () => console.error('Failed to load pipeNorth.png');

        const southPipe = new window.Image();
        southPipe.src = 'assets/pipeSouth.png'; // Assuming in /public/
        southPipe.onload = () => {
            pipeSouthImageRef.current = southPipe;
            console.log('Pipe South image loaded.');
        };
        southPipe.onerror = () => console.error('Failed to load pipeSouth.png');
    }, []);

    // Preload sounds
    useEffect(() => {
        flySoundRef.current = new Audio('assets/audio/sounds_fly.mp3');
        scoreSoundRef.current = new Audio('assets/audio/sounds_score.mp3');
        
        // You can add error handling for audio loading if desired
        flySoundRef.current.onerror = () => console.error("Failed to load sound_fly.mp3");
        scoreSoundRef.current.onerror = () => console.error("Failed to load sounds_score.mp3");

        // Optional: try to load them to catch errors early, though browsers often load on demand
        flySoundRef.current.load();
        scoreSoundRef.current.load();
    }, []);

    // Setup Canvas Context
    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = GAME_WIDTH;
            canvas.height = GAME_HEIGHT;
            ctxRef.current = canvas.getContext('2d');
        }
    }, []); // Run once on mount

    // --- Game Loop --- 
    useEffect(() => {
        // The loop should run if playing or if game over (to show explosion)
        if (status === 'ready') { // Only stop if truly in ready state, not yet playing
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
                gameLoopRef.current = null;
            }
            return;
        }

        const loop = (timestamp: number) => {
            if (!lastTimestampRef.current) {
                lastTimestampRef.current = timestamp;
                gameLoopRef.current = requestAnimationFrame(loop);
                return;
            }

            // Increment frame counter
            frameCountRef.current += 1;

            // Only run game physics and updates if status is 'playing'
            if (status === 'playing') {
                // --- Update Bug Position (Gravity) --- 
                const newVelocity = bugVelocity + GRAVITY;
                const newBugY = bugY + newVelocity;
                setBugVelocity(newVelocity);
                setBugY(newBugY);

                // --- Scroll Background ---
                const backgroundScrollSpeed = PIPE_SPEED * 0.5;
                const currentBgImage = backgroundImageRef.current;
                if (currentBgImage && currentBgImage.naturalWidth > 0) {
                    const imageWidth = currentBgImage.naturalWidth;
                    setBackgroundX(prevX => {
                        const newX = prevX - backgroundScrollSpeed;
                        // Ensure newX wraps around the image width correctly for seamless scrolling.
                        return newX % imageWidth;
                    });
                } else {
                    // Fallback or if image not loaded yet, though typically covered by isBackgroundLoaded in draw
                    // If you want to keep old behavior as a fallback:
                    // setBackgroundX(prevX => (prevX - backgroundScrollSpeed) % GAME_WIDTH);
                }

                // --- Bug Animation --- 
                if (frameCountRef.current % BUG_ANIMATION_SPEED === 0) {
                    setBugFrame(prev => (prev % numFrames) + 1);
                }

                // --- Update Pipe Positions & Generate New Pipes --- 
                const updatedPipes = pipes
                    .map(pipe => ({ ...pipe, x: pipe.x - PIPE_SPEED }))
                    .filter(pipe => pipe.x > -PIPE_WIDTH);

                if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
                    const topHeight = Math.random() * (GAME_HEIGHT - PIPE_GAP - 100) + 50;
                    updatedPipes.push({
                        id: Date.now(),
                        x: GAME_WIDTH,
                        topHeight: topHeight,
                        scored: false
                    });
                }

                // --- Collision Detection & Scoring (Only if playing) ---
                let collisionDetected = false;
                for (const pipe of updatedPipes) {
                    if (collisionDetected) continue;

                    const bugCenterX = BUG_X_POSITION;
                    const bugCenterY = newBugY; // Use the newBugY for current frame collision check

                    // Collision with Top Pipe
                    let closestX = Math.max(pipe.x, Math.min(bugCenterX, pipe.x + PIPE_WIDTH));
                    let closestY = Math.max(0, Math.min(bugCenterY, pipe.topHeight));
                    let distanceX = bugCenterX - closestX;
                    let distanceY = bugCenterY - closestY;
                    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
                    if (distanceSquared < (BUG_RADIUS * BUG_RADIUS)) {
                        gameOver(); // This will change status, current loop continues, next loop iteration sees 'gameOver'
                        collisionDetected = true;
                        continue;
                    }

                    // Collision with Bottom Pipe
                    const bottomPipeRectY = pipe.topHeight + PIPE_GAP;
                    const bottomPipeRectHeight = GAME_HEIGHT - bottomPipeRectY;
                    closestX = Math.max(pipe.x, Math.min(bugCenterX, pipe.x + PIPE_WIDTH));
                    closestY = Math.max(bottomPipeRectY, Math.min(bugCenterY, bottomPipeRectY + bottomPipeRectHeight));
                    distanceX = bugCenterX - closestX;
                    distanceY = bugCenterY - closestY;
                    distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
                    if (distanceSquared < (BUG_RADIUS * BUG_RADIUS)) {
                        gameOver();
                        collisionDetected = true;
                        continue;
                    }

                    if (!pipe.scored && bugCenterX > pipe.x + PIPE_WIDTH) {
                        setScore(prev => prev + 1);
                        pipe.scored = true;
                        scoreSoundRef.current?.play().catch(e => console.error("Error playing score sound:", e));
                    }
                }

                if (collisionDetected) {
                    // If collision detected, the status is now 'gameOver'. 
                    // We let this frame finish drawing, then the next loop iteration will skip physics.
                } else {
                     // Ground collision (Only if playing and no pipe collision)
                    if (newBugY + BUG_RADIUS > GAME_HEIGHT) {
                        gameOver();
                    } else if (newBugY - BUG_RADIUS < 0) { // Ceiling collision
                        setBugY(BUG_RADIUS);
                        setBugVelocity(0);
                    }
                }
                setPipes(updatedPipes); // Update pipes state only if playing
            } // End of if (status === 'playing') block

            // --- Update Active Explosions (Always do this to let them play out) ---
            const now = Date.now();
            setActiveExplosions(prevExplosions => 
                prevExplosions.filter(exp => 
                    now - exp.startTime < EXPLOSION_SVG_COUNT * EXPLOSION_FRAME_DURATION
                )
            );

            // --- Drawing --- 
            drawGame();

            // Continue loop
            lastTimestampRef.current = timestamp;
            gameLoopRef.current = requestAnimationFrame(loop);
        };

        // Start the loop
        gameLoopRef.current = requestAnimationFrame(loop);

        // Cleanup function
        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
                gameLoopRef.current = null;
            }
        };
    }, [status, bugY, bugVelocity, pipes, score]); // Dependencies that affect the loop

    // --- Game State Management --- 
    const resetGameForPlay = () => {
        setBugY(GAME_HEIGHT / 2); // BugY is center Y
        
        // Pre-spawn an initial pipe
        const initialPipes: Pipe[] = [];
        const firstPipeTopHeight = Math.random() * (GAME_HEIGHT - PIPE_GAP - 100) + 50;
        initialPipes.push({
            id: Date.now(),
            x: GAME_WIDTH * 0.7, // Start closer to the player
            topHeight: firstPipeTopHeight,
            scored: false
        });
        setPipes(initialPipes);
        
        // setScore(0); // Score is reset in startGame which calls this
        setBackgroundX(0); // Reset background position
        setShowGameOverPopup(false);
        setActiveExplosions([]); // Clear active explosions
        setStatus('playing');
        frameCountRef.current = 0;
        lastTimestampRef.current = null;
        setBugVelocity(0); // Reset velocity here
    };

    const startGame = () => { // This function is essentially the restart logic now
        resetGameForPlay();
        setScore(0); // Reset score here when a new game starts
    };

    const gameOver = () => {
        setStatus('gameOver');
        setShowGameOverPopup(true);

        if (score > bestScore) {
            setBestScore(score);
        }

        setActiveExplosions(prev => [
            ...prev,
            { x: BUG_X_POSITION, y: bugY, startTime: Date.now() }
        ]);

        // DO NOT cancel animation frame here anymore
        /* if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        } */
    };

    // --- Jump Logic --- 
    const jump = useCallback(() => {
        // Apply jump impulse only if playing
        if (status === 'playing') {
            setBugVelocity(JUMP_STRENGTH);
            flySoundRef.current?.play().catch(e => console.error("Error playing fly sound:", e));
        } 
        // Removed 'ready' state handling from here
    }, [status]); // Dependency on status is important

    // --- Input Handling --- 
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent page scrolling
                if (status === 'ready') {
                    // Start game and apply first jump
                    resetGameForPlay(); 
                    setBugVelocity(JUMP_STRENGTH); // Apply first jump impulse
                    flySoundRef.current?.play().catch(e => console.error("Error playing fly sound:", e));
                } else if (status === 'playing') {
                    jump(); // Normal jump during play
                } else if (status === 'gameOver') {
                    // Restart only on Space when game over
                    startGame(); // Calls resetGameForPlay
                }
            }
        };

        const handleClick = () => {
            // Click/Tap only starts from ready or jumps if playing
            if (status === 'ready') {
                // Start game and apply first jump
                resetGameForPlay();
                setBugVelocity(JUMP_STRENGTH); // Apply first jump impulse
                flySoundRef.current?.play().catch(e => console.error("Error playing fly sound:", e));
            } else if (status === 'playing') {
                jump();
            }
            // Click/Tap does NOT restart the game from gameOver
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('click', handleClick);
        window.addEventListener('touchstart', handleClick); // For mobile

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('touchstart', handleClick);
        };
    }, [status, jump]); // Re-bind if jump function changes (due to status change)

    // --- Drawing Functions --- 
    const drawGame = () => {
        const ctx = ctxRef.current;
        if (!ctx) return;

        const currentBackgroundImage = backgroundImageRef.current;

        // Clear canvas (or draw background image)
        if (isBackgroundLoaded && currentBackgroundImage && currentBackgroundImage.complete && currentBackgroundImage.naturalWidth > 0) {
            ctx.save(); // Save context state before applying filter
            ctx.filter = 'blur(1px)'; // Apply blur filter - adjust px for more/less blur
            
            // Calculate how many times the image needs to be drawn to fill the width
            const numImages = Math.ceil(GAME_WIDTH / currentBackgroundImage.naturalWidth) + 1; // +1 for smooth scrolling
            for (let i = 0; i < numImages; i++) {
                ctx.drawImage(
                    currentBackgroundImage,
                    backgroundX + i * currentBackgroundImage.naturalWidth,
                    0,
                    currentBackgroundImage.naturalWidth,
                    GAME_HEIGHT // Draw image to fill canvas height, maintain aspect ratio for width
                );
            }
            ctx.restore(); // Restore context state (removes filter for subsequent drawings)
        } else {
            // Fallback background color if image not loaded
            ctx.fillStyle = BACKGROUND_COLOR;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }

        // Draw Pipes
        const northImg = pipeNorthImageRef.current;
        const southImg = pipeSouthImageRef.current;

        pipes.forEach(pipe => {
            // Top Pipe
            if (northImg && northImg.complete) {
                ctx.drawImage(northImg, pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
            } else {
                // Fallback drawing if image not loaded
                ctx.fillStyle = PIPE_COLOR;
                ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
            }
            
            // Bottom Pipe
            const bottomPipeY = pipe.topHeight + PIPE_GAP;
            const bottomPipeHeight = GAME_HEIGHT - bottomPipeY;
            if (southImg && southImg.complete) {
                ctx.drawImage(southImg, pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
            } else {
                // Fallback drawing if image not loaded
                ctx.fillStyle = PIPE_COLOR;
                ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
            }
        });

        // Draw Bug
        const currentBugImage = bugImages.current[bugFrame - 1];
        if (currentBugImage && currentBugImage.complete) { // Check if image is loaded
             // Simple rotation based on velocity for visual effect
            const rotation = Math.atan2(bugVelocity, 10) * 0.3; // Adjust multiplier for effect strength
            
            ctx.save();
            ctx.translate(BUG_X_POSITION, bugY); // Translate to bug's center
            ctx.rotate(rotation);
            ctx.drawImage(
                currentBugImage,
                -BUG_RADIUS, // Draw centered around the new origin (0,0 after translate)
                -BUG_RADIUS,
                BUG_SIZE, // Keep drawing size as BUG_SIZE
                BUG_SIZE
            );
            ctx.restore();
        } else {
            // Fallback: Draw simple rectangle if image not loaded
            ctx.fillStyle = 'red'; 
            ctx.fillRect(BUG_X_POSITION, bugY, BUG_SIZE, BUG_SIZE);
        }

        // --- Draw Explosions ---
        const currentTime = Date.now();
        activeExplosions.forEach(explosion => {
            const elapsedTime = currentTime - explosion.startTime;
            const frameIndex = Math.floor(elapsedTime / EXPLOSION_FRAME_DURATION);

            if (frameIndex < EXPLOSION_SVG_COUNT) {
                const explosionImg = explosionImagesRef.current[frameIndex];
                if (explosionImg && explosionImg.complete) {
                    ctx.drawImage(
                        explosionImg,
                        explosion.x - EXPLOSION_SIZE / 2, // Center the explosion
                        explosion.y - EXPLOSION_SIZE / 2,
                        EXPLOSION_SIZE,
                        EXPLOSION_SIZE
                    );
                }
            }
        });

        // Draw Score and Best Score (New Style)
        const currentScoreText = score.toString();
        const bestScoreText = `BEST: ${bestScore}`;
        const leftMargin = 10;
        const topMargin = 34;
        const bestScoreY = topMargin + 22;

        // Draw main score at top left
        ctx.textAlign = 'left';
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(currentScoreText, leftMargin, topMargin);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(currentScoreText, leftMargin, topMargin);

        // Draw best score below in smaller font
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(bestScoreText, leftMargin, bestScoreY);
        ctx.fillStyle = '#888888'; // Grey color for best score text
        ctx.fillText(bestScoreText, leftMargin, bestScoreY);

        // Draw Overlays
        if (status === 'ready') {
            drawOverlay('Ready!', 'Spacebar or Tap to Jump');
        } else if (status === 'gameOver') {
            drawOverlay('Game Over!', `Final Score: ${score}`);
            // Note: Retry button is now handled outside the canvas via event listeners
        }
    };

    const drawOverlay = (title: string, subtitle: string) => {
        const ctx = ctxRef.current;
        if (!ctx) return;

        ctx.fillStyle = OVERLAY_BG_COLOR;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.fillStyle = OVERLAY_TEXT_COLOR;
        ctx.textAlign = 'center';
        
        ctx.font = '40px Arial';
        ctx.fillText(title, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
        
        ctx.font = '20px Arial';
        ctx.fillText(subtitle, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
        
        // Draw Start instruction
        if (status === 'ready') {
            ctx.font = '16px Arial';
            ctx.fillText('(Click or Spacebar to Start)', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
        } 
        // Removed gameOver drawing logic from here
        /* else if (status === 'gameOver') {
            ctx.font = '16px Arial';
            ctx.fillText('(Press Spacebar to Retry)', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
        } */
    };

    // TODO: Update render logic with actual game elements

    return (
        <div className={styles.flappyContainer}>
            <div 
                className={styles.gameAreaWrapper} 
                style={{
                    width: `${GAME_WIDTH}px`,
                    height: `${GAME_HEIGHT}px`,
                }}
            >
                <canvas 
                    ref={canvasRef} 
                    className={styles.gameCanvas} // Renamed from gameArea for clarity
                    // Canvas width/height are set by its attributes in JS, 
                    // but wrapper needs explicit size for positioning overlay
                />
                {showGameOverPopup && (
                    <div className={styles.gameOverPopupOverlay}>
                        <div className={styles.gameOverPopupContent}>
                            <h2>Game Over!</h2>
                            <p>Final Score: {score}</p>
                            <button 
                                onClick={startGame} 
                                className={styles.retryButtonPopup}
                            >
                                Retry (Spacebar)
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <button onClick={onBackToMenu} className={styles.backButton}>
                Back to Menu
            </button>
        </div>
    );
};

export default FlappyBug; 