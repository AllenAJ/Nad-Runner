import React, { useEffect, useState, useRef } from 'react';
import { ethers } from 'ethers';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';
import { mintScore, TransactionStatus, switchToMonadNetwork } from '../../utils/web3';
import { preloadGameAssets, loadLeaderboard } from '../../utils/image-preloader';
import { LayeredCharacter } from '../Character/LayeredCharacter';

// Import components
import { LoadingScreen } from './LoadingScreens';
import { MainMenu } from './MainMenu';
import { GameOverScreen } from './GameOverScreen';
import Shop from '../../src/components/Shop';
import { 
    InventoryScreen, 
    MultiplayerScreen 
} from './GameScreenComponents';
import NotificationContainer from '../Notifications/NotificationContainer';
import { NotificationData } from '../Notifications/AchievementNotification';
import { Achievement } from '../../constants/achievements'; // Import Achievement type

// Constants
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 700;
const MOBILE_GAME_WIDTH = 400;
const MOBILE_GAME_HEIGHT = 500;

// Define types for game state and screens
type GameScreen = 'loading' | 'menu' | 'game' | 'gameOver' | 'shop' | 'inventory' | 'multiplayer';

interface GameState {
    currentScreen: GameScreen;
    isPlaying: boolean;
    score: number;
    playerName: string;
    hasEnteredName: boolean;
    boxJumps: number;
    coinCount: number;
    xp: number;
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

// Define the structure for the PlayerData state
interface PlayerStats {
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
    achievements_bitmap: string; // Use string from API
}

interface PlayerInventory {
    items: any[]; // Define more specific item type later
    loadouts: any[]; // Define more specific loadout type later
}

interface PlayerDataState {
    playerStats: PlayerStats;
    inventory: PlayerInventory;
}

// Define the expected API response structure for update-stats
interface UpdateStatsApiResponse {
    playerStats: RawPlayerStats; // Use a raw type for the API response
    unlockedAchievements: Achievement[];
}

// Define the raw structure coming from the API (snake_case)
interface RawPlayerStats {
    profile_id: number;
    wallet_address: string;
    level: number;
    coins: number;
    xp: number;
    xp_to_next_level: number;
    high_score: number;
    box_jumps: number;
    high_score_box_jumps: number;
    rounds: number;
    status: string;
    username: string;
    achievements_bitmap: string;
    // Add any other snake_case fields returned by the API
}

export default function GameContainer() {
    // Game state
    const [gameState, setGameState] = useState<GameState>({
        isPlaying: false,
        score: 0,
        playerName: '',
        hasEnteredName: false,
        currentScreen: 'loading',
        boxJumps: 0,
        coinCount: 0,
        xp: 0
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
    const [playerData, setPlayerData] = useState<PlayerDataState | null>(null);

    // Add zoom check state
    const [isZoom100, setIsZoom100] = useState(true);

    // Add isUpdatingStats flag
    const [isUpdatingStats, setIsUpdatingStats] = useState(false);

    // Audio state - default to false (unmuted)
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const gameOverSoundRef = useRef<HTMLAudioElement | null>(null);

    // Add state for the new notification system
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const notificationIdCounter = useRef(0);

    // Function to add a new notification
    const addNotification = (notification: Omit<NotificationData, 'id'>) => {
        const newId = notificationIdCounter.current++;
        setNotifications(prev => [...prev, { ...notification, id: newId }]);
    };

    // Function to remove a notification by ID
    const removeNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Function to get default player stats structure
    const getDefaultPlayerStats = (username = ''): PlayerStats => ({
        highScore: 0,
        boxJumps: 0,
        highScoreBoxJumps: 0,
        coins: 0,
        rounds: 0,
        level: 1,
        xp: 0,
        xpToNextLevel: 150,
        status: 'Newbie',
        username: username,
        achievements_bitmap: '0'
    });

    // Handler to update coin balance from Shop/other components
    const handleUpdateCoins = (newBalance: number) => {
        setPlayerData(prevData => {
            if (!prevData?.playerStats) return prevData; // Return previous state if no stats
            return {
                ...prevData,
                playerStats: {
                    ...prevData.playerStats,
                    coins: newBalance
                }
            };
        });
    };

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
            console.log('Wallet disconnected.');
            setIsConnected(false);
            setWalletAddress("");
            setProvider(null);
            setUserData(null); // Clear user data
            setPlayerData(null); // Clear player data
            setIsNewUser(false); // Reset new user status
            
            // Always navigate back to the main menu on disconnect
            setGameState(prev => ({
                ...prev,
                isPlaying: false, // Ensure game stops if playing
                currentScreen: 'menu' 
            }));
            
            // Stop any ongoing minting process if necessary
            if (isMinting) {
                setIsMinting(false);
                setMintStatus({ status: 'error', message: 'Wallet disconnected during minting.' });
            }

        } else {
            // New account connected or switched
            console.log('Wallet connected/changed:', accounts[0]);
            const newAddress = accounts[0];
            setIsConnected(true);
            setWalletAddress(newAddress);
            
            // Re-check user status and load data for the new/switched account
            if (!provider && window.ethereum) {
                setProvider(new ethers.BrowserProvider(window.ethereum));
            }
            checkUserExistsAndLoadData(); // Fetch data for new account
            
            // Reload necessary game assets if they weren't loaded
            if (!leaderboardLoaded || !assetsLoaded) {
                loadGameData(); 
            }
            // If currently in menu, stay there. If somehow in loading, maybe transition.
            // If playing, maybe prompt user or restart? For now, we let game continue if it was already running.
        }
    };

    // Check wallet connection on initial load
    const checkWalletConnection = async () => {
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);
                
                const accounts = await web3Provider.listAccounts();
                if (accounts.length > 0 && accounts[0]) {
                    const connectedAddress = accounts[0].address;
                    console.log('Already connected:', connectedAddress);
                    setIsConnected(true);
                    setWalletAddress(connectedAddress);
                    
                    // If connected, load user data and other game data
                    await checkUserExistsAndLoadData(); // Fetch user data
                    await loadGameData(); // Load leaderboard/assets
                } else {
                    console.log('No connected accounts found initially.');
                    setIsConnected(false);
                    setWalletAddress("");
                    setPlayerData(null);
                    // Transition to menu even if not connected, after loading basic assets
                    await loadGameData(); // Load assets/leaderboard regardless
                }
            } catch (error) {
                console.log('Wallet connection check error:', error);
                setIsConnected(false);
                setPlayerData(null);
                await loadGameData(); // Try loading assets anyway
            }
        } else {
            console.log('No Ethereum provider detected.');
            setIsConnected(false);
            setPlayerData(null);
            await loadGameData(); // Load assets/leaderboard
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
            setIsMuted(false);
        }
    };

    // Start game method
    const handleStartGame = () => {
        // Don't allow starting if not connected
        if (!isConnected) {
            handleConnect();
            return;
        }
        
        // --- Start background music on game start (user interaction) ---
        if (audioRef.current && !isMuted) {
            audioRef.current.currentTime = 0; // Start from beginning
            audioRef.current.play().catch(error => {
                console.log('Background music playback failed on start:', error);
                // Optionally notify user or disable audio if needed
            });
        }
        // --- End music start ---
        
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

    // Game over method - Updated to use new notification system
    const handleGameOver = async (results: { score: number; boxJumps: number; coinCount: number; xp: number; }) => {
        console.log('[GameContainer] handleGameOver triggered with results:', results);
        const roundedScore = Math.floor(results.score);

        // Play game over sound if not muted
        if (gameOverSoundRef.current && !isMuted) {
            gameOverSoundRef.current.currentTime = 0; // Reset to start
            gameOverSoundRef.current.play().catch(error => {
                console.log('Game over sound playback failed:', error);
            });
        }

        console.log('[GameContainer] Setting gameState: isPlaying=false, currentScreen=gameOver');
        setGameState(prev => ({
            ...prev,
            isPlaying: false,
            score: roundedScore,
            boxJumps: results.boxJumps,
            coinCount: results.coinCount,
            xp: results.xp,
            currentScreen: 'gameOver'
        }));
        setIsGameOver(true);
        setGameEndTime(Date.now() / 1000);

        if (isConnected && walletAddress && !isUpdatingStats) {
            try {
                setIsUpdatingStats(true);
                const response = await fetch('/api/user/update-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress,
                        score: roundedScore, // Assuming score is distance
                        boxJumps: results.boxJumps,
                        coinCount: results.coinCount,
                        xp: results.xp
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update player stats');
                }

                const updatedData: UpdateStatsApiResponse = await response.json(); 
                console.log('[GameContainer] API response from /update-stats:', updatedData);
                
                const previousLevel = playerData?.playerStats?.level ?? 1;

                // Map API response (snake_case) to PlayerStats state (camelCase)
                // Access the raw stats using the RawPlayerStats type
                const rawStats = updatedData.playerStats; 
                const mappedStats: PlayerStats = {
                    highScore: rawStats.high_score,
                    boxJumps: rawStats.box_jumps, 
                    highScoreBoxJumps: rawStats.high_score_box_jumps, 
                    coins: rawStats.coins,
                    rounds: rawStats.rounds,
                    level: rawStats.level,
                    xp: rawStats.xp,
                    xpToNextLevel: rawStats.xp_to_next_level,
                    status: rawStats.status,
                    username: rawStats.username,
                    achievements_bitmap: rawStats.achievements_bitmap
                };

                // Update player data state using the MAPPED stats
                setPlayerData(prev => {
                    const newState = {
                        inventory: prev?.inventory || { items: [], loadouts: [] },
                        playerStats: mappedStats 
                    };
                    console.log('[GameContainer] Updating playerData state to:', newState);
                    return newState;
                });

                // Check for level up based on the MAPPED playerStats
                if (mappedStats.level > previousLevel) {
                    const levelUpSound = new Audio('/assets/audio/levelup.mp3');
                    levelUpSound.volume = 0.5;
                    levelUpSound.play().catch(error => console.log('Level up sound failed:', error));
                    addNotification({
                        type: 'level-up',
                        title: 'Level Up!',
                        message: `You are now level ${mappedStats.level}!` // Use mapped stat
                    });
                }

                // Check achievements using the UNLOCKED ACHIEVEMENTS LIST from the API response
                if (updatedData.unlockedAchievements && updatedData.unlockedAchievements.length > 0) {
                    const achievementSound = new Audio('/assets/audio/achievement.mp3');
                    achievementSound.volume = 0.6;
                    
                    updatedData.unlockedAchievements.forEach((achievement: Achievement) => {
                        achievementSound.currentTime = 0;
                        achievementSound.play().catch(error => console.log('Achievement sound failed:', error));
                        addNotification({
                            type: 'achievement',
                            title: 'Achievement Unlocked!',
                            message: achievement.name,
                        });
                    });
                }

                // Submit to leaderboard using the username from the MAPPED playerStats
                if (mappedStats && mappedStats.username) {
                    const leaderboardResponse = await fetch('/api/scores', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: mappedStats.username, // Use mapped username
                            score: roundedScore,
                            walletAddress
                        }),
                    });

                    if (leaderboardResponse.ok) {
                        const updatedScores = await fetch('/api/scores').then(res => res.json());
                        setLeaderboard(updatedScores);
                    } else {
                        const errorData = await leaderboardResponse.json();
                        console.error('Failed to submit score to leaderboard:', errorData.error);
                    }
                } else {
                    console.warn('Cannot submit to leaderboard: No username available in updated stats');
                }
            } catch (error) {
                console.error('Error updating game data:', error);
                // Add error notification
                addNotification({
                    type: 'error',
                    title: 'Update Error',
                    message: error instanceof Error ? error.message : 'Failed to update game data'
                });
            } finally {
                setIsUpdatingStats(false);
                console.log('[GameContainer] Finished updating stats.');
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

    // Start the game
    const handlePlayAgain = () => {
        console.log("handlePlayAgain called");
        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            score: 0,
            // Reset game-specific stats when starting again
            boxJumps: 0,
            coinCount: 0,
            xp: 0,
            hasEnteredName: false, // Assuming we want to reset this, adjust if needed
            currentScreen: 'game'
        }));
        setIsGameOver(false); // Reset game over flag
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

    // Check if user exists and fetch initial data
    useEffect(() => {
        if (isConnected && walletAddress) {
            checkUserExistsAndLoadData(); // Renamed function
        }
    }, [isConnected, walletAddress]);

    // Check user existence and load data
    const checkUserExistsAndLoadData = async () => {
        if (!walletAddress) return; // Don't fetch if no address
        try {
            const normalizedWalletAddress = walletAddress.toLowerCase();
            const response = await fetch(`/api/user/data?walletAddress=${normalizedWalletAddress}`);
            
            if (response.ok) {
                const data: PlayerDataState = await response.json(); // Expect full state object
                setPlayerData(data);
                setIsNewUser(false);
            } else if (response.status === 404) {
                setIsNewUser(true);
                setPlayerData(null);
            } else {
                const errorData = await response.json();
                console.error('Error fetching user data:', errorData.error);
                setIsNewUser(true); 
                setPlayerData(null);
            }
        } catch (error) {
            console.error('Network error fetching user data:', error);
            setIsNewUser(true); 
            setPlayerData(null);
        }
    };

    // Handle submission of username for new users
    const handleUsernameSubmit = async (username: string) => {
        if (!walletAddress) return;
        try {
            const normalizedWalletAddress = walletAddress.toLowerCase();
            const createResponse = await fetch('/api/user/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: normalizedWalletAddress, username }),
            });

            const createData = await createResponse.json();

            if (!createResponse.ok) {
                throw new Error(createData.error || 'Failed to create user');
            }

            // API should return the initial PlayerDataState structure upon creation
            // If not, construct it here based on defaults and the username
            const initialData: PlayerDataState = createData.playerStats 
                ? { playerStats: createData.playerStats, inventory: createData.inventory || { items: [], loadouts: [] } } 
                : { playerStats: getDefaultPlayerStats(username), inventory: { items: [], loadouts: [] } };

            setPlayerData(initialData);
            setIsNewUser(false); 
        } catch (error) {
            console.error('Error in handleUsernameSubmit:', error);
            // Add error notification
            addNotification({
                type: 'error',
                title: 'Username Error',
                message: error instanceof Error ? error.message : 'Failed to set username'
            });
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

    // Initialize audio and check localStorage on mount
    useEffect(() => {
        // Create audio elements
        const audio = new Audio('/assets/audio/menuMusic.mp3');
        const gameOverSound = new Audio('/assets/audio/gameover.wav');
        audio.loop = true;
        audioRef.current = audio;
        gameOverSoundRef.current = gameOverSound;

        // Check localStorage for mute preference
        const storedMute = localStorage.getItem('nadrunner_muted');
        const shouldBeMuted = storedMute ? storedMute === 'true' : false; // Default to unmuted
        setIsMuted(shouldBeMuted);

        // Cleanup
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (gameOverSoundRef.current) {
                gameOverSoundRef.current.pause();
                gameOverSoundRef.current = null;
            }
        };
    }, []);

    // Handle mute/unmute for all audio
    useEffect(() => {
        // Only handle pausing/resuming here, not initial playback
        if (audioRef.current) {
            if (!isMuted) {
                // Attempt to play only if needed (e.g., if it was paused due to mute)
                // Browsers might still block this if no prior interaction, 
                // but the main playback trigger will be user actions.
                audioRef.current.play().catch(error => {
                    // Log potential playback errors, but don't crash
                    console.log('Audio resume playback failed (might need interaction):', error);
                });
            } else {
                audioRef.current.pause();
            }
        }
        // Persist mute state
        localStorage.setItem('nadrunner_muted', isMuted.toString());
    }, [isMuted]);

    // Restart music when entering play area (This effect seems redundant now)
    // useEffect(() => {
    //     if (gameState.currentScreen === 'game' && audioRef.current && !isMuted) {
    //         audioRef.current.currentTime = 0; // Reset to start
    //         audioRef.current.play().catch(error => {
    //             console.log('Audio playback failed:', error);
    //         });
    //     }
    // }, [gameState.currentScreen, isMuted]);

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

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
                // Use the default stats function if playerData is null
                const currentStats = playerData?.playerStats || getDefaultPlayerStats();
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
                        playerStats={currentStats} // Pass the resolved stats
                    />
                );
            case 'shop':
                return (
                    <Shop 
                        walletAddress={walletAddress} 
                        onClose={() => navigateTo('menu')} 
                        updateCoins={handleUpdateCoins}
                    />
                );
            case 'inventory':
                return <InventoryScreen onBackToMenu={() => navigateTo('menu')} />;
            case 'multiplayer':
                return <MultiplayerScreen 
                    onBackToMenu={() => navigateTo('menu')} 
                    walletAddress={walletAddress}
                    username={playerData?.playerStats?.username || ''}
                />;
            case 'gameOver':
                return (
                    <GameOverScreen 
                        score={gameState.score}
                        boxJumps={gameState.boxJumps}
                        coinCount={gameState.coinCount}
                        xp={gameState.xp}
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
            {/* Render Notification Container */} 
            <NotificationContainer 
                notifications={notifications} 
                onDismissNotification={removeNotification} 
            />

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
            
            {isZoom100 && gameState.currentScreen === 'multiplayer' ? (
                <MultiplayerScreen 
                    onBackToMenu={() => navigateTo('menu')}
                    walletAddress={walletAddress}
                    username={playerData?.playerStats.username || ''}
                />
            ) : isZoom100 && (
                <div 
                    className={styles.container}
                    data-screen={gameState.currentScreen}
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
                                        <LayeredCharacter 
                                            width={100}
                                            height={100}
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

                    {/* Add audio control button */}
                    <button 
                        className={styles.audioControl}
                        onClick={toggleMute}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                                <line x1="23" y1="9" x2="17" y2="15" />
                                <line x1="17" y1="9" x2="23" y2="15" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                        )}
                    </button>
                </div>
            )}
        </>
    );
}