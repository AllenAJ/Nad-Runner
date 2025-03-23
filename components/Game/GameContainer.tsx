import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';
import { mintScore, TransactionStatus } from '../../utils/web3';
import { preloadGameAssets } from '../../utils/image-preloader';

// Import new components
import { LoadingScreen } from './LoadingScreens';
import { MainMenu } from './MainMenu';
import { GameOverScreen } from './GameOverScreen';
import { 
    ShopScreen, 
    InventoryScreen, 
    MultiplayerScreen 
} from './GameScreenComponents';

// Constants
const GAME_WIDTH = 1200;
const MOBILE_GAME_WIDTH = 400;
const GAME_HEIGHT = 650;
const MOBILE_GAME_HEIGHT = 500;

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
            <LoadingScreen 
                loadingProgress={loadingProgress} 
                leaderboardLoaded={leaderboard.length > 0} 
            />
        );
    }

    // Connect wallet method
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

    // Mint score method
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

    // Start game method
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

    // Game over method
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

    // Name submission method
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

    // Play again method
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

    // Navigation method
    const navigateTo = (screen: Exclude<GameState['currentScreen'], 'loading'>) => {
        setGameState(prev => ({
            ...prev,
            currentScreen: screen
        }));
    };

    // Render different screens based on current state
    const renderScreen = () => {
        switch (gameState.currentScreen) {
            case 'menu':
                return (
                    <MainMenu 
                        leaderboard={leaderboard} 
                        onStartGame={handleStartGame}
                        onNavigateTo={navigateTo}
                    />
                );
            case 'shop':
                return <ShopScreen onBackToMenu={() => navigateTo('menu')} />;
            case 'inventory':
                return <InventoryScreen onBackToMenu={() => navigateTo('menu')} />;
            case 'multiplayer':
                return <MultiplayerScreen onBackToMenu={() => navigateTo('menu')} />;
            case 'gameOver':
                return (
                    <GameOverScreen 
                        score={gameState.score}
                        hasEnteredName={gameState.hasEnteredName}
                        playerName={gameState.playerName}
                        isConnected={isConnected}
                        isMinting={isMinting}
                        mintStatus={mintStatus}
                        onPlayerNameChange={(name) => setGameState(prev => ({ ...prev, playerName: name }))}
                        onNameSubmit={handleNameSubmit}
                        onConnect={handleConnect}
                        onMintScore={handleMintScore}
                        onPlayAgain={handlePlayAgain}
                        onBackToMenu={() => navigateTo('menu')}
                    />
                );
            default:
                return null;
        }
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
                
                {renderScreen()}
            </div>
        </div>
    );
}