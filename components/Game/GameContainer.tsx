import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';
import { mintScore, TransactionStatus } from '../../utils/web3';
import { preloadGameAssets } from '../../utils/image-preloader';

interface GameState {
    isPlaying: boolean;
    score: number;
    playerName: string;
    hasEnteredName: boolean;
    currentScreen: 'loading' | 'menu' | 'game' | 'gameOver' | 'shop' | 'inventory' | 'multiplayer';
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
        hasEnteredName: false,
        currentScreen: 'loading'
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
    const [loadingProgress, setLoadingProgress] = useState(0);

    useEffect(() => {
        const initializeGame = async () => {
            try {
                // Resize logic
                const handleResize = () => {
                    const isMobile = window.innerWidth <= 768;
                    setGameHeight(isMobile ? MOBILE_GAME_HEIGHT : GAME_HEIGHT);
                    setGameWidth(isMobile ? Math.min(window.innerWidth - 16, MOBILE_GAME_WIDTH) : GAME_WIDTH);
                };

                // Initial resize
                handleResize();
                window.addEventListener('resize', handleResize);

                // Simulate loading progress
                const progressInterval = setInterval(() => {
                    setLoadingProgress(prev => {
                        const newProgress = prev + 10;
                        return newProgress > 100 ? 0 : newProgress;
                    });
                }, 200);

                // Load leaderboard
                const leaderboardResponse = await fetch('/api/scores');
                const leaderboardData = await leaderboardResponse.json();
                setLeaderboard(leaderboardData);

                // Preload game assets
                await preloadGameAssets();

                // Clear progress interval
                clearInterval(progressInterval);

                // Check if already connected
                if (typeof window !== 'undefined' && window.ethereum) {
                    const web3Provider = new ethers.BrowserProvider(window.ethereum);
                    setProvider(web3Provider);
                    
                    web3Provider.listAccounts().then(accounts => {
                        setIsConnected(accounts.length > 0);
                    }).catch(error => {
                        console.log('Not connected to wallet:', error);
                    });
                }

                // Transition to menu
                setGameState(prev => ({
                    ...prev,
                    currentScreen: 'menu'
                }));

                // Cleanup
                return () => window.removeEventListener('resize', handleResize);
            } catch (error) {
                console.error('Game initialization failed:', error);
                // Fallback to menu in case of error
                setGameState(prev => ({
                    ...prev,
                    currentScreen: 'menu'
                }));
            }
        };

        initializeGame();
    }, []);

    // Render loading screen
    if (gameState.currentScreen === 'loading') {
        return (
            <div 
                className={styles.gameWrapper} 
                style={{ 
                    width: gameWidth, 
                    height: gameHeight 
                }}
            >
                <div className={styles.menuContainer}>
                    <div className={styles.versionLabel}>beta 1.9</div>
                    
                    <div className={styles.loadingCharacter}>
                        <img 
                            src="/assets/molandak.png" 
                            alt="Molandak loading" 
                            className={styles.spinningCharacter} 
                        />
                    </div>
                                        
                    <div className={styles.loadingBar}>
                        <div 
                            className={styles.loadingProgress} 
                            style={{width: `${loadingProgress}%`}}
                        ></div>
                    </div>
                    
                    <div className={styles.loadingText}>
                        {leaderboard.length > 0 
                            ? 'Loading game assets...' 
                            : 'Loading leaderboard...'}
                    </div>
                </div>
            </div>
        );
    }

    // Rest of the existing methods remain the same as in the original implementation
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
            playerName: '',
            currentScreen: 'game'
        }));
        setIsGameOver(false);
    };

    const handleGameOver = (finalScore: number) => {
        const endTime = Date.now() / 1000;
        setGameEndTime(endTime);
        const roundedScore = Math.floor(finalScore);
        setGameState(prev => ({ 
            ...prev, 
            isPlaying: false, 
            score: roundedScore,
            currentScreen: 'gameOver'
        }));
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
            hasEnteredName: false,
            currentScreen: 'game'
        });
        setIsGameOver(false);
    };

    const navigateTo = (screen: Exclude<GameState['currentScreen'], 'loading'>) => {
        setGameState(prev => ({
            ...prev,
            currentScreen: screen
        }));
    };

    // Existing render methods remain the same
    const renderMainMenu = () => (
        <div className={styles.menuContainer}>
            <div className={styles.mainButtons}>
                <button onClick={handleStartGame} className={styles.primaryButton}>
                    PLAY
                </button>
                <button onClick={() => navigateTo('multiplayer')} className={styles.menuButton}>
                    MULTIPLAYER
                </button>
                <button onClick={() => navigateTo('shop')} className={styles.menuButton}>
                    SHOP
                </button>
                <button onClick={() => navigateTo('inventory')} className={styles.menuButton}>
                    INVENTORY
                </button>
            </div>

            {leaderboard.length > 0 && (
                <div className={styles.leaderboard}>
                    <h3>TOP PLAYERS</h3>
                    <div className={styles.leaderboardContent}>
                        {leaderboard.slice(0, 10).map((entry, index) => (
                            <div key={index} className={styles.leaderboardEntry}>
                                <span className={styles.rank}>#{index + 1}</span>
                                <span className={styles.name}>{entry.name}</span>
                                <span className={styles.score}>{Math.floor(entry.score)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderShop = () => (
        <div className={styles.menuContainer}>
            <h2>Shop</h2>
            <p>Coming soon! Buy upgrades and customizations.</p>
            <button onClick={() => navigateTo('menu')} className={styles.menuButton}>
                Back to Menu
            </button>
        </div>
    );

    const renderInventory = () => (
        <div className={styles.menuContainer}>
            <h2>Inventory</h2>
            <p>Your items and collectibles will appear here.</p>
            <button onClick={() => navigateTo('menu')} className={styles.menuButton}>
                Back to Menu
            </button>
        </div>
    );

    const renderMultiplayer = () => (
        <div className={styles.menuContainer}>
            <h2>Multiplayer</h2>
            <p>Challenge your friends! Coming soon.</p>
            <button onClick={() => navigateTo('menu')} className={styles.menuButton}>
                Back to Menu
            </button>
        </div>
    );

    const renderGameOverScreen = () => (
        <div className={styles.gameOverContainer}>
            <h2>Game Over!</h2>
            <p>Score: {Math.floor(gameState.score)}</p>
            
            {!gameState.hasEnteredName ? (
                <>
                    <input
                        type="text"
                        placeholder="Enter your name"
                        value={gameState.playerName}
                        onChange={(e) => setGameState(prev => ({ ...prev, playerName: e.target.value }))}
                    />
                    <button onClick={handleNameSubmit}>Submit Score</button>
                </>
            ) : (
                <>
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
                                    href={`https://testnet.monadexplorer.com/tx/${mintStatus.hash}`}
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
                    <button onClick={() => navigateTo('menu')}>
                        Back to Menu
                    </button>
                </>
            )}
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.gameWrapper}>
                <Canvas
                    width={gameWidth}
                    height={gameHeight}
                    isPlaying={gameState.isPlaying}
                    onGameOver={handleGameOver}
                />
                
                {gameState.currentScreen === 'menu' && renderMainMenu()}
                {gameState.currentScreen === 'shop' && renderShop()}
                {gameState.currentScreen === 'inventory' && renderInventory()}
                {gameState.currentScreen === 'multiplayer' && renderMultiplayer()}
                {gameState.currentScreen === 'gameOver' && renderGameOverScreen()}
            </div>
        </div>
    );
}