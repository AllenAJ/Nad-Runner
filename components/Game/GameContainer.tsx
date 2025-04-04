import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';
import { mintScore, TransactionStatus, switchToMonadNetwork } from '../../utils/web3';
import { preloadGameAssets, loadLeaderboard } from '../../utils/image-preloader';

// Import components
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
const GAME_HEIGHT = 700;
const MOBILE_GAME_WIDTH = 400;
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

interface UserData {
    username: string;
    level: number;
    coins: number;
    xp: number;
    xp_to_next_level: number;
    prestige: number;
    status: string;
}

interface PlayerData {
    playerStats: {
        highScore: number;
        boxJumps: number;
        highScoreBoxJumps: number;
        coins: number;
        rounds: number;
        level: number;
        xp: number;
        xpToNextLevel: number;
        status: string;
        username: string;
    };
}

export default function GameContainer() {
    // Game state
    const [gameState, setGameState] = useState<GameState>({
        isPlaying: false,
        score: 0,
        playerName: '',
        hasEnteredName: false,
        currentScreen: 'loading'
    });
    
    // Game timers and scores
    const [gameStartTime, setGameStartTime] = useState<number>(0);
    const [gameEndTime, setGameEndTime] = useState<number>(0);
    const [isGameOver, setIsGameOver] = useState(false);
    
    // Web3 state
    const [isMinting, setIsMinting] = useState(false);
    const [mintStatus, setMintStatus] = useState<TransactionStatus | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnectingWallet, setIsConnectingWallet] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string>("");
    
    // Game data
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [gameWidth, setGameWidth] = useState(GAME_WIDTH);
    const [gameHeight, setGameHeight] = useState(GAME_HEIGHT);
    
    // Loading state
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);
    const [assetsLoaded, setAssetsLoaded] = useState(false);

    // User data
    const [isNewUser, setIsNewUser] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);

    // Player data
    const [playerData, setPlayerData] = useState<PlayerData | null>(null);

    // Add zoom check state
    const [isZoom100, setIsZoom100] = useState(true);

    // Add isUpdatingStats flag
    const [isUpdatingStats, setIsUpdatingStats] = useState(false);

    // Initialize the game
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth <= 768;
            setGameHeight(isMobile ? MOBILE_GAME_HEIGHT : GAME_HEIGHT);
            setGameWidth(isMobile ? Math.min(window.innerWidth - 16, MOBILE_GAME_WIDTH) : GAME_WIDTH);
        };

        // Initial resize
        handleResize();
        window.addEventListener('resize', handleResize);

        // Check if wallet is already connected
        checkWalletConnection();

        // Setup wallet change listeners
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', () => window.location.reload());
        }

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    // Handle wallet account changes
    const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
            // User disconnected their wallet
            setIsConnected(false);
            setWalletAddress("");
            setProvider(null);
            
            // Reset game state if playing
            if (gameState.isPlaying) {
                setGameState(prev => ({
                    ...prev,
                    isPlaying: false,
                    currentScreen: 'loading'
                }));
            }
        } else {
            // New account connected
            setIsConnected(true);
            setWalletAddress(accounts[0]);
            
            // If we were in loading screen, load game data
            if (gameState.currentScreen === 'loading' && !leaderboardLoaded) {
                loadGameData();
            }
        }
    };

    // Check if wallet is already connected
    const checkWalletConnection = async () => {
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);
                
                const accounts = await web3Provider.listAccounts();
                if (accounts.length > 0) {
                    setIsConnected(true);
                    setWalletAddress(accounts[0].address);
                    
                    // If connected, load game data
                    loadGameData();
                } else {
                    console.log('No connected accounts');
                    setIsConnected(false);
                }
            } catch (error) {
                console.log('Wallet connection check error:', error);
                setIsConnected(false);
            }
        } else {
            console.log('No Ethereum provider detected');
            setIsConnected(false);
        }
    };

    // Load game data (leaderboard and assets)
    const loadGameData = async () => {
        try {
            setLoadingProgress(0);
            
            // Start loading both leaderboard and assets in parallel
            const [leaderboardData] = await Promise.all([
                loadLeaderboard(),
                preloadGameAssets((progress) => {
                    // Asset loading is 80% of total progress, leaderboard is 20%
                    setLoadingProgress(20 + (progress * 0.8));
                })
            ]);

            // Update states
            setLeaderboard(leaderboardData);
            setLeaderboardLoaded(true);
            setAssetsLoaded(true);
            setLoadingProgress(100);
            
            // Only transition to menu if user is still in loading state
            if (gameState.currentScreen === 'loading') {
                // Give a slight delay for visual polish
                setTimeout(() => {
                    setGameState(prev => ({
                        ...prev,
                        currentScreen: 'menu'
                    }));
                }, 1000);
            }
        } catch (error) {
            console.error('Error loading game data:', error);
        }
    };

    // Connect wallet method
    const handleConnect = async () => {
        setIsConnectingWallet(true);
        try {
            if (isConnected) {
                // Disconnect wallet (this is a UI-only disconnect, users must disconnect from their wallet)
                setIsConnected(false);
                setWalletAddress("");
                setProvider(null);
                setIsConnectingWallet(false);
                return;
            }

            // Check for wallet
            if (!window.ethereum) {
                setMintStatus({
                    status: 'error',
                    message: 'No wallet detected. Please install MetaMask or use a Web3 browser.'
                });
                setIsConnectingWallet(false);
                return;
            }

            // Request account access
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            
            if (accounts.length > 0) {
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);
                setWalletAddress(accounts[0]);
                setIsConnected(true);
                
                // Try to switch to correct network
                try {
                    await switchToMonadNetwork(window.ethereum);
                } catch (error) {
                    console.warn('Network switching failed, but proceeding with wallet connection:', error);
                }
                
                // Load game data
                loadGameData();
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            setMintStatus({
                status: 'error',
                message: 'Failed to connect wallet. Please try again.'
            });
        } finally {
            setIsConnectingWallet(false);
        }
    };

    // Transition to menu when assets are loaded
    const handleAssetsLoaded = () => {
        setGameState(prev => ({
            ...prev,
            currentScreen: 'menu'
        }));
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
        // Don't allow starting if not connected
        if (!isConnected) {
            handleConnect();
            return;
        }
        
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
    const handleGameOver = async (finalScore: number, boxJumps: number) => {
        const roundedScore = Math.floor(finalScore);

        setGameState(prev => ({
            ...prev,
            isPlaying: false,
            score: roundedScore,
            currentScreen: 'gameOver'
        }));
        setIsGameOver(true);
        setGameEndTime(Date.now() / 1000);

        if (isConnected && walletAddress && !isUpdatingStats) {
            try {
                setIsUpdatingStats(true);
                // Update player stats
                const response = await fetch('/api/user/update-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress,
                        score: roundedScore,
                        boxJumps
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update player stats');
                }

                // Refresh player data
                const updatedData = await response.json();
                setPlayerData(updatedData);

                // Only submit to leaderboard if we have a valid username
                if (updatedData.playerStats && updatedData.playerStats.username) {
                    // Submit score to leaderboard
                    const leaderboardResponse = await fetch('/api/scores', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: updatedData.playerStats.username,
                            score: roundedScore,
                            walletAddress
                        }),
                    });

                    if (leaderboardResponse.ok) {
                        // Refresh leaderboard
                        const updatedScores = await fetch('/api/scores').then(res => res.json());
                        setLeaderboard(updatedScores);
                    } else {
                        const errorData = await leaderboardResponse.json();
                        console.error('Failed to submit score to leaderboard:', errorData.error);
                    }
                } else {
                    console.error('Cannot submit to leaderboard: No username available');
                }
            } catch (error) {
                console.error('Error updating game data:', error);
            } finally {
                setIsUpdatingStats(false);
            }
        }
    };

    // Name submission method
    const handleNameSubmit = async () => {
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
                        walletAddress: walletAddress || undefined
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
        setIsUpdatingStats(false); // Reset the flag when starting a new game
    };

    // Navigation method
    const navigateTo = (screen: Exclude<GameState['currentScreen'], 'loading'>) => {
        setGameState(prev => ({
            ...prev,
            currentScreen: screen
        }));
    };

    // Check if wallet disconnected during play
    useEffect(() => {
        if (gameState.isPlaying && !isConnected) {
            // Handle wallet disconnection during gameplay
            setGameState(prev => ({
                ...prev,
                isPlaying: false,
                currentScreen: 'loading'
            }));
        }
    }, [isConnected, gameState.isPlaying]);

    // Check if user exists
    useEffect(() => {
        if (isConnected && walletAddress) {
            checkUserExists();
        }
    }, [isConnected, walletAddress]);

    const checkUserExists = async () => {
        try {
            const normalizedWalletAddress = walletAddress.toLowerCase();
            const response = await fetch(`/api/user/check?walletAddress=${normalizedWalletAddress}`);
            const data = await response.json();
            
            if (response.ok) {
                setUserData(data.user);
                setIsNewUser(false);
            } else {
                setIsNewUser(true);
            }
        } catch (error) {
            console.error('Error checking user:', error);
            setIsNewUser(true);
        }
    };

    const handleUsernameSubmit = async (username: string) => {
        try {
            const normalizedWalletAddress = walletAddress.toLowerCase();
            // First check if user exists
            const checkResponse = await fetch(`/api/user/check?walletAddress=${normalizedWalletAddress}`);
            const checkData = await checkResponse.json();
            
            if (checkResponse.ok) {
                // User exists, set the data and continue
                setUserData(checkData.user);
                setPlayerData({
                    playerStats: checkData.playerStats
                });
                setIsNewUser(false);
                return;
            }

            // If user doesn't exist, create new user
            const createResponse = await fetch('/api/user/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: normalizedWalletAddress,
                    username,
                }),
            });

            const createData = await createResponse.json();

            if (!createResponse.ok) {
                throw new Error(createData.error || 'Failed to create user');
            }

            setUserData(createData.user);
            // Set player data for new user
            setPlayerData({
                playerStats: {
                    highScore: 0,
                    boxJumps: 0,
                    highScoreBoxJumps: 0,
                    coins: 0,
                    rounds: 0,
                    level: 1,
                    xp: 0,
                    xpToNextLevel: 150,
                    status: 'Newbie',
                    username: username
                }
            });
            setIsNewUser(false);
        } catch (error) {
            console.error('Error in handleUsernameSubmit:', error);
            throw error;
        }
    };

    // Add zoom detection
    useEffect(() => {
        const checkZoom = () => {
            const zoom = Math.round((window.outerWidth / window.innerWidth) * 100);
            setIsZoom100(zoom === 100);
        };

        // Check initially
        checkZoom();

        // Check on resize
        window.addEventListener('resize', checkZoom);
        return () => window.removeEventListener('resize', checkZoom);
    }, []);

    // Render different screens based on current state
    const renderScreen = () => {
        switch (gameState.currentScreen) {
            case 'loading':
                return (
                    <LoadingScreen 
                        loadingProgress={loadingProgress}
                        leaderboardLoaded={leaderboardLoaded}
                        isConnected={isConnected}
                        onConnect={handleConnect}
                        assetsLoaded={assetsLoaded}
                        onAssetsLoaded={handleAssetsLoaded}
                        walletAddress={walletAddress}
                        onPlayerDataLoaded={(data) => setPlayerData(data)}
                    />
                );
            case 'menu':
                return (
                    <MainMenu 
                        leaderboard={leaderboard} 
                        onStartGame={handleStartGame}
                        onNavigateTo={navigateTo}
                        isConnected={isConnected}
                        onConnect={handleConnect}
                        walletAddress={walletAddress}
                        isNewUser={isNewUser}
                        onUsernameSubmit={handleUsernameSubmit}
                        nextUpdate={{
                            hours: 66,
                            minutes: 43,
                            seconds: 56
                        }}
                        playerStats={playerData?.playerStats || {
                            highScore: 0,
                            boxJumps: 0,
                            highScoreBoxJumps: 0,
                            coins: 0,
                            rounds: 0,
                            level: 1,
                            xp: 0,
                            xpToNextLevel: 150,
                            status: 'Newbie',
                            username: ''
                        }}
                    />
                );
            case 'shop':
                return <ShopScreen onBackToMenu={() => navigateTo('menu')} />;
            case 'inventory':
                return <InventoryScreen onBackToMenu={() => navigateTo('menu')} />;
            case 'multiplayer':
                return (
                    <MultiplayerScreen 
                        onBackToMenu={() => navigateTo('menu')}
                        walletAddress={walletAddress}
                        username={playerData?.playerStats.username || ''}
                    />
                );
            case 'gameOver':
                return (
                    <GameOverScreen 
                        score={gameState.score}
                        hasEnteredName={!!playerData}
                        playerName={playerData?.playerStats.username || gameState.playerName}
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
        <>
            {!isZoom100 && (
                <div className={styles.zoomWarning}>
                    <div className={styles.zoomWarningContent}>
                        <h2>Please set your browser zoom to 100%</h2>
                        <p>This game requires 100% zoom level for the best experience.</p>
                        <p>Current zoom is not 100%</p>
                        <p>Use Ctrl + 0 (Windows) or Cmd + 0 (Mac) to reset zoom</p>
                    </div>
                </div>
            )}
            
            {isZoom100 && (
                <div 
                    className={styles.container}
                    style={{
                        minHeight: '100vh',
                        position: 'relative'
                    }}
                >
                    {/* Always show game canvas when in game or game over state */}
                    {(gameState.currentScreen === 'game' || gameState.currentScreen === 'gameOver') && (
                        <div className={styles.gameWrapper}>
                            <Canvas
                                width={gameWidth}
                                height={gameHeight}
                                isPlaying={gameState.isPlaying}
                                onGameOver={handleGameOver}
                            />
                        </div>
                    )}
                    
                    <div className={styles.overlayContainer}>
                        {renderScreen()}
                        
                        {isConnectingWallet && (
                            <div className={styles.overlay}>
                                <div className={styles.connectingWallet}>
                                    <div className={styles.loadingCharacter}>
                                        <img 
                                            src="/assets/mainchar.svg"
                                            alt="Loading character" 
                                            className={styles.spinningCharacter} 
                                        />
                                    </div>
                                    <p>Connecting wallet...</p>
                                </div>
                            </div>
                        )}
                        
                        {gameState.isPlaying && !isConnected && (
                            <div className={styles.overlay}>
                                <div className={styles.walletAlert}>
                                    <h3>Wallet Disconnected</h3>
                                    <p>Your wallet has been disconnected. Please reconnect to continue.</p>
                                    <button onClick={handleConnect} className={styles.primaryButton}>
                                        Reconnect Wallet
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}