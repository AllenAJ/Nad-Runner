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
    MultiplayerScreen,
    InstructionsScreen
} from './GameScreenComponents';
import NotificationContainer from '../Notifications/NotificationContainer';
import { NotificationData } from '../Notifications/AchievementNotification';
import { Achievement } from '../../constants/achievements'; // Import Achievement type
import FlappyBug from './FlappyBug'; // Import the new component

// Import Solana wallet adapter hooks
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName } from '@solana/wallet-adapter-base'; // Corrected import for WalletName
import { PhantomWalletName } from '@solana/wallet-adapter-phantom'; // Example for a specific wallet

// Import Solana UI component if you want to use it directly
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Constants
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 700;
const MOBILE_GAME_WIDTH = 400;
const MOBILE_GAME_HEIGHT = 500;

// Define types for game state and screens
type GameScreen = 'loading' | 'menu' | 'game' | 'gameOver' | 'shop' | 'inventory' | 'multiplayer' | 'instructions' | 'minigame';

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
    const [isMusicMuted, setIsMusicMuted] = useState(false);
    const [isSoundMuted, setIsSoundMuted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const gameOverSoundRef = useRef<HTMLAudioElement | null>(null);

    // Add state for the new notification system
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const notificationIdCounter = useRef(0);

    // Add state for current wallet type
    const [currentWalletType, setCurrentWalletType] = useState<'evm' | 'solana' | null>(null);

    // Solana wallet hook
    const solanaWallet = useWallet();

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

    // Effect to disable default Tab key behavior globally
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if the Tab key was pressed
            if (event.key === 'Tab') {
                // Prevent the default focus change behavior
                event.preventDefault();
            }
        };

        // Add the event listener to the window
        window.addEventListener('keydown', handleKeyDown);

        // Cleanup function to remove the listener when the component unmounts
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    // Handle wallet account changes
    const handleAccountsChanged = (accounts: string[]) => {
        if (currentWalletType !== 'evm') return; // Only for EVM

        if (accounts.length === 0) {
            // User disconnected their EVM wallet
            console.log('Wallet disconnected.');
            setIsConnected(false);
            setWalletAddress("");
            setProvider(null);
            setUserData(null); // Clear user data
            setPlayerData(null); // Clear player data
            setIsNewUser(false); // Reset new user status
            setCurrentWalletType(null); // Reset wallet type
            
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
            setCurrentWalletType('evm'); // Ensure type is set
            
            // Re-check user status and load data for the new/switched account
            if (!provider && window.ethereum) {
                setProvider(new ethers.BrowserProvider(window.ethereum));
            }
            checkUserExistsAndLoadData(newAddress, 'evm'); // Fetch data for new account
            
            // Reload necessary game assets if they weren't loaded
            if (!leaderboardLoaded || !assetsLoaded) {
                loadGameData(); 
            }
            // If currently in menu, stay there. If somehow in loading, maybe transition.
            // If playing, maybe prompt user or restart? For now, we let game continue if it was already running.
        }
    };

    // Handle chain changes (EVM specific)
    const handleChainChanged = () => {
        if (currentWalletType === 'evm') {
            window.location.reload();
        }
    };

    // Check wallet connection on initial load
    const checkWalletConnection = async () => {
        // Try EVM first (existing logic)
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                const accounts = await web3Provider.listAccounts();
                if (accounts.length > 0 && accounts[0]) {
                    const connectedAddress = accounts[0].address;
                    console.log('Already connected (EVM):', connectedAddress);
                    setProvider(web3Provider);
                    setIsConnected(true);
                    setWalletAddress(connectedAddress);
                    setCurrentWalletType('evm');
                    await checkUserExistsAndLoadData(connectedAddress, 'evm');
                    await loadGameData();
                    return; // Exit if EVM connected
                }
            } catch (error) {
                console.log('EVM wallet connection check error:', error);
            }
        }

        // Check Solana wallet status (if EVM not connected)
        if (solanaWallet.connected && solanaWallet.publicKey) {
            const solanaAddress = solanaWallet.publicKey.toBase58();
            console.log('Already connected (Solana):', solanaAddress);
            setIsConnected(true);
            setWalletAddress(solanaAddress);
            setCurrentWalletType('solana');
            setProvider(null); // Ensure EVM provider is null
            await checkUserExistsAndLoadData(solanaAddress, 'solana');
            await loadGameData();
            return; // Exit if Solana connected
        }
        
        // If neither is connected
        console.log('No connected accounts found initially (EVM or Solana).');
        setIsConnected(false);
        setWalletAddress("");
        setPlayerData(null);
        setCurrentWalletType(null);
        setProvider(null);
        await loadGameData(); // Load assets/leaderboard regardless
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
            
            // Only transition to menu if user is still in loading state AND wallet is connected
            if (gameState.currentScreen === 'loading' && isConnected) {
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
    const handleConnect = async (walletType: 'evm' | 'solana') => {
        setIsConnectingWallet(true);
        setMintStatus(null); 

        try {
            if (walletType === 'evm') {
                setCurrentWalletType('evm');
                if (isConnected && currentWalletType === 'evm') { 
                    console.log("Attempting to disconnect EVM (manual)");
                    setIsConnected(false);
                    setWalletAddress("");
                    setProvider(null);
                    setCurrentWalletType(null);
                    // Potentially clear user data too
                    setUserData(null);
                    setPlayerData(null);
                    // No need to set setIsConnectingWallet(false) here, finally block handles it
                    return;
                }
                if (!window.ethereum) {
                    setMintStatus({
                        status: 'error',
                        message: 'No EVM wallet detected. Please install MetaMask or use a Web3 browser.'
                    });
                    setIsConnectingWallet(false); // Early exit
                    return;
                }

                const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            
                if (accounts.length > 0 && accounts[0]) {
                    const web3Provider = new ethers.BrowserProvider(window.ethereum);
                    setProvider(web3Provider);
                    setWalletAddress(accounts[0]);
                    setIsConnected(true);
                    try {
                        await switchToMonadNetwork(window.ethereum);
                    } catch (error) {
                        console.warn('EVM network switching failed, but proceeding with wallet connection:', error);
                    }
                    await checkUserExistsAndLoadData(accounts[0], 'evm');
                    loadGameData();
                } else {
                    // No accounts found or user rejected
                    setMintStatus({ status: 'error', message: 'EVM wallet connection rejected or no accounts found.' });
                    setIsConnectingWallet(false); // Early exit
                    return;
                }

            } else if (walletType === 'solana') {
                setCurrentWalletType('solana');
                setProvider(null); 

                if (!solanaWallet.wallet) { 
                    const phantomAdapter = solanaWallet.wallets.find(w => w.adapter.name === PhantomWalletName)?.adapter;
                    if (phantomAdapter) {
                        try {
                            solanaWallet.select(PhantomWalletName as WalletName);
                            setMintStatus({ status: 'pending', message: 'Phantom selected. Approve connection in your wallet extension.' });
                            // Connection will be attempted by useEffect reacting to solanaWallet.wallet or solanaWallet.connected
                        } catch (e) {
                            console.error("Error selecting Phantom:", e);
                            setMintStatus({ status: 'error', message: 'Could not select Phantom. Is it installed?' });
                            setIsConnectingWallet(false); // Early exit
                            return;
                        }
                    } else {
                        setMintStatus({ status: 'error', message: 'Phantom wallet not found. Please install or ensure it is enabled. You can also try other Solana wallets if a selection modal is available.' });
                        // If you had a generic solana connect button/modal, you'd trigger it here.
                        // For example, if you manage WalletModalProvider's setVisible state manually:
                        // setSolanaModalVisible(true);
                        setIsConnectingWallet(false); // Early exit
                        return;
                    }
                } else if (!solanaWallet.connected) { 
                    try {
                        await solanaWallet.connect();
                        // Success will be handled by the useEffect for solanaWallet.connected
                    } catch (e:any) {
                        console.error("Solana connect error:", e);
                        setMintStatus({ status: 'error', message: e.message || `Failed to connect to ${solanaWallet.wallet.adapter.name}.` });
                        // setIsConnectingWallet(false) will be handled in finally
                    }
                } else {
                    // Already connected or wallet selected and connected - useEffect should have handled state updates.
                    // Potentially refresh data if needed, though useEffect is preferred for this.
                    console.log("Solana wallet already selected and connected.");
                    if(solanaWallet.publicKey) await checkUserExistsAndLoadData(solanaWallet.publicKey.toBase58(), 'solana');
                }
            }
        } catch (error: any) {
            console.error(`Wallet connection process error (${walletType}):`, error);
            const errorMessage = error.message || `Failed to connect ${walletType} wallet. Please try again.`;
            setMintStatus({
                status: 'error',
                message: errorMessage
            });
            // Don't reset currentWalletType here, user might retry
            // setIsConnectingWallet(false) in finally block
        } finally {
            // Small delay for wallet popups, especially for Solana
            // The main connection status will be updated by useEffects reacting to wallet state changes.
            // setIsConnectingWallet is more about the *intent* to connect rather than the final state.
            // If connection is successful, useEffects will set isConnected = true and isConnectingWallet = false.
            // If it fails, it should also be reset.
            // setTimeout(() => setIsConnectingWallet(false), 500); // Keep it simple for now.
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
            setIsMusicMuted(false);
        }
    };

    // Start game method
    const handleStartGame = () => {
        if (!isConnected) {
            // Default to EVM connection if trying to start game while disconnected
            handleConnect('evm'); 
            return;
        }
        
        // --- Start background music on game start (user interaction) ---
        if (audioRef.current && !isMusicMuted) {
            audioRef.current.currentTime = 0; // Start from beginning
            audioRef.current.play().catch(error => {
                console.log('Background music playback failed on start:', error);
                // Optionally notify user or disable audio if needed
            });
        }
        // --- End music start ---
        
        const startTime = Date.now() / 1000;
        setGameStartTime(startTime);

        // Check if user has seen instructions before
        const hasSeenInstructions = typeof window !== 'undefined' ? localStorage.getItem('hasSeenInstructions') === 'true' : false;
        
        setGameState(prev => ({
            ...prev,
            isPlaying: hasSeenInstructions, // Start playing immediately if they've seen instructions
            score: 0,
            hasEnteredName: false,
            playerName: '',
            currentScreen: hasSeenInstructions ? 'game' : 'instructions' // Skip to game if seen instructions
        }));
        setIsGameOver(false);
    };

    // Game over method - Updated to use new notification system
    const handleGameOver = async (results: { score: number; boxJumps: number; coinCount: number; xp: number; }) => {
        console.log('[GameContainer] handleGameOver triggered with results:', results);
        const roundedScore = Math.floor(results.score);

        // Play game over sound if not muted
        if (gameOverSoundRef.current && !isSoundMuted) {
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
                    if (!isSoundMuted) {
                        levelUpSound.play().catch(error => console.log('Level up sound failed:', error));
                    }
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
                        if (!isSoundMuted) {
                            achievementSound.play().catch(error => console.log('Achievement sound failed:', error));
                        }
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
        // Check if the target screen is 'minigame' and handle music
        if (screen === 'minigame' && audioRef.current && !isMusicMuted) {
            // You might want to pause the main menu music here
            audioRef.current.pause(); 
            // Potentially load/play mini-game specific music later
        } else if (gameState.currentScreen === 'minigame' && screen !== 'minigame' && audioRef.current && !isMusicMuted) {
            // Resume main menu music when leaving the mini-game
            audioRef.current.play().catch(e => console.log("Error resuming music:", e));
        }

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
            // Pass wallet type to determine API endpoint or logic if needed
            checkUserExistsAndLoadData(walletAddress, currentWalletType || 'evm'); 
        }
    }, [isConnected, walletAddress, currentWalletType]); // Add currentWalletType

    // Check user existence and load data
    const checkUserExistsAndLoadData = async (address: string, walletTypeUsed: 'evm' | 'solana' | null) => {
        if (!address || !walletTypeUsed) return; 
        try {
            const normalizedWalletAddress = address.toLowerCase();
            // Potentially use a different API endpoint or add walletType to query for backend
            const response = await fetch(`/api/user/data?walletAddress=${normalizedWalletAddress}&walletType=${walletTypeUsed}`);
            
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
        if (!walletAddress || !currentWalletType) {
            addNotification({ type: 'error', title: 'Connection Error', message: 'Wallet not connected or type unknown.'});
            return;
        }
        try {
            const normalizedWalletAddress = walletAddress.toLowerCase();
            const createResponse = await fetch('/api/user/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: normalizedWalletAddress, username, walletType: currentWalletType }),
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
            // Use outerWidth/innerWidth as a proxy, but it's not perfectly reliable
            const zoom = Math.round((window.outerWidth / window.innerWidth) * 100);
            // Check if zoom is within an acceptable range (e.g., 98% to 102%)
            const isAcceptableZoom = zoom >= 82 && zoom <= 118;
            setIsZoom100(isAcceptableZoom);
            // console.log(`Zoom Check: inner=${window.innerWidth}, outer=${window.outerWidth}, ratio=${window.outerWidth / window.innerWidth}, rounded=${zoom}, acceptable=${isAcceptableZoom}`);
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
        const storedMusicMute = localStorage.getItem('nadrunner_music_muted');
        const storedSoundMute = localStorage.getItem('nadrunner_sound_muted');
        const shouldMusicBeMuted = storedMusicMute ? storedMusicMute === 'true' : false;
        const shouldSoundBeMuted = storedSoundMute ? storedSoundMute === 'true' : false;
        setIsMusicMuted(shouldMusicBeMuted);
        setIsSoundMuted(shouldSoundBeMuted);

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

    // Handle music mute/unmute
    useEffect(() => {
        // Only handle pausing/resuming here, not initial playback
        if (audioRef.current) {
            if (!isMusicMuted) {
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
        localStorage.setItem('nadrunner_music_muted', isMusicMuted.toString());
    }, [isMusicMuted]);

    // Handle sound effects mute/unmute
    useEffect(() => {
        // Persist sound mute state
        localStorage.setItem('nadrunner_sound_muted', isSoundMuted.toString());
    }, [isSoundMuted]);

    const toggleMusicMute = () => {
        setIsMusicMuted(!isMusicMuted);
    };

    const toggleSoundMute = () => {
        setIsSoundMuted(!isSoundMuted);
    };

    // Check if user exists and fetch initial data
    useEffect(() => {
        // This effect syncs app state if Solana wallet connects/disconnects via its own UI
        if (solanaWallet.connected && solanaWallet.publicKey) {
            const solanaAddress = solanaWallet.publicKey.toBase58();
            // Check if state needs update to prevent redundant calls or loops
            if (walletAddress !== solanaAddress || !isConnected || currentWalletType !== 'solana') {
                console.log('Solana wallet connected (detected by useEffect):', solanaAddress);
                setIsConnected(true);
                setWalletAddress(solanaAddress);
                setCurrentWalletType('solana');
                setProvider(null); 
                checkUserExistsAndLoadData(solanaAddress, 'solana');
                if (gameState.currentScreen === 'loading' && !assetsLoaded) loadGameData();
                setMintStatus(null); 
            }
            if(isConnectingWallet) setIsConnectingWallet(false); // If we were in a connecting state, mark as done.

        } else if (currentWalletType === 'solana' && !solanaWallet.connected && !solanaWallet.connecting && isConnected) {
            // Only if it WAS connected as Solana and now it's not (and not in a connecting attempt)
            console.log('Solana wallet disconnected (detected by useEffect).');
            setIsConnected(false);
            setWalletAddress("");
            setCurrentWalletType(null);
            // Optionally clear user data or navigate, based on desired UX
            if (gameState.currentScreen !== 'menu' && gameState.currentScreen !== 'loading') {
                 setGameState(prev => ({ ...prev, currentScreen: 'menu', isPlaying: false }));
            }
            if(isConnectingWallet) setIsConnectingWallet(false);
        }
    }, [
        solanaWallet.connected, 
        solanaWallet.publicKey, 
        solanaWallet.connecting, // Important to prevent race conditions
        currentWalletType, 
        walletAddress, 
        isConnected, 
        isConnectingWallet, // Added to dependencies
        checkUserExistsAndLoadData, // Ensure this is memoized if it's complex
        loadGameData, 
        assetsLoaded, 
        gameState.currentScreen
    ]);

    // Effect to attempt connection if a Solana wallet is selected but not connected
    useEffect(() => {
        if (currentWalletType === 'solana' && solanaWallet.wallet && !solanaWallet.connected && !solanaWallet.connecting && isConnectingWallet) {
            // This effect tries to connect if a wallet was just selected and we are in 'isConnectingWallet' state.
            (async () => {
                try {
                    console.log(`Attempting to connect to selected Solana wallet: ${solanaWallet.wallet?.adapter.name} (useEffect)`);
                    await solanaWallet.connect();
                    // Success will be picked up by the useEffect above that watches solanaWallet.connected
                } catch (error: any) {
                    console.error("Delayed Solana connect error (useEffect):", error);
                    setMintStatus({ status: 'error', message: error.message || "Failed to connect to selected Solana wallet." });
                    setIsConnectingWallet(false); // Reset connecting flag on error
                    setCurrentWalletType(null); // Revert type if connection failed post-selection
                }
            })();
        }
    }, [solanaWallet.wallet, solanaWallet.connected, solanaWallet.connecting, currentWalletType, isConnectingWallet]);

    // Render different screens based on current state
    const renderScreen = () => {
        switch (gameState.currentScreen) {
            case 'loading':
                return (
                    <LoadingScreen 
                        loadingProgress={loadingProgress}
                        leaderboardLoaded={leaderboardLoaded}
                        isConnected={isConnected}
                        onConnect={(walletType) => handleConnect(walletType)}
                        assetsLoaded={assetsLoaded}
                        onAssetsLoaded={handleAssetsLoaded}
                        walletAddress={walletAddress}
                        onPlayerDataLoaded={(data) => setPlayerData(data)}
                    />
                );
            case 'menu':
                const currentStats = playerData?.playerStats || getDefaultPlayerStats();
                return (
                    <MainMenu 
                        leaderboard={leaderboard} 
                        onStartGame={handleStartGame}
                        onNavigateTo={navigateTo}
                        isConnected={isConnected}
                        onConnect={() => handleConnect(currentWalletType || 'evm')}
                        walletAddress={walletAddress}
                        isNewUser={isNewUser}
                        onUsernameSubmit={handleUsernameSubmit}
                        nextUpdate={{
                            hours: 66,
                            minutes: 43,
                            seconds: 56
                        }}
                        playerStats={currentStats} // Pass the resolved stats
                        isMusicMuted={isMusicMuted}
                        isSoundMuted={isSoundMuted}
                    />
                );
            case 'instructions':
                return (
                    <InstructionsScreen 
                        onStartGame={() => {
                            // Save that user has seen instructions
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('hasSeenInstructions', 'true');
                            }
                            
                            // This starts the actual game after viewing instructions
                            setGameState(prev => ({
                                ...prev,
                                isPlaying: true, // Now actually start the game
                                currentScreen: 'game'
                            }));
                        }}
                        onBackToMenu={() => navigateTo('menu')}
                        isMuted={isSoundMuted}
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
                return <InventoryScreen onBackToMenu={() => navigateTo('menu')} isMuted={isSoundMuted} />;
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
                        onConnect={() => handleConnect(currentWalletType || 'evm')}
                        onMintScore={handleMintScore}
                        onPlayAgain={handlePlayAgain}
                        onBackToMenu={() => navigateTo('menu')}
                    />
                );
            case 'multiplayer':
                // Multiplayer is handled outside renderScreen now
                return null; 
            case 'minigame': // Add case for minigame
                // Placeholder for now - will add FlappyBug component later
                return (
                    <FlappyBug 
                        onBackToMenu={() => navigateTo('menu')} 
                        isSoundMuted={isSoundMuted}
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
            
            {/* Always render the main container if zoom is 100% */} 
            {isZoom100 && (
                <div 
                    className={styles.container}
                    data-screen={gameState.currentScreen}
                    style={{
                        minHeight: '100vh',
                        position: 'relative'
                    }}
                >
                    {/* Render gameWrapper for game, gameOver, instructions AND multiplayer */}
                    {(gameState.currentScreen === 'game' || 
                      gameState.currentScreen === 'gameOver' || 
                      gameState.currentScreen === 'instructions' ||
                      gameState.currentScreen === 'multiplayer') && (
                        <div 
                            className={styles.gameWrapper}
                            // Prevent default right-click menu on the game area
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {/* Conditionally render Canvas or MultiplayerScreen inside wrapper */}
                            {gameState.currentScreen === 'multiplayer' ? (
                                <MultiplayerScreen 
                                    onBackToMenu={() => navigateTo('menu')} 
                                    walletAddress={walletAddress}
                                    username={playerData?.playerStats.username || ''}
                                    isMuted={isSoundMuted}
                                />
                            ) : (
                                <Canvas
                                    width={gameWidth}
                                    height={gameHeight}
                                    isPlaying={gameState.isPlaying}
                                    onGameOver={handleGameOver}
                                    isMuted={isSoundMuted}
                                />
                            )}
                        </div>
                    )}
                    
                    {/* Overlay container for menus, game over screen etc. (excluding multiplayer now) */}
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
                                    <button onClick={() => handleConnect(currentWalletType || 'evm')} className={styles.primaryButton}>
                                        Reconnect Wallet
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add audio control buttons */}
                    <div className={styles.audioControls}>
                        <button 
                            className={styles.audioControl}
                            onClick={toggleMusicMute}
                            aria-label={isMusicMuted ? 'Unmute Music' : 'Mute Music'}
                        >
                            {isMusicMuted ? (
                                <svg version="1.1" id="Layer_1_Muted" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 130 122.88" xmlSpace="preserve">
                                    <g>
                                        <path style={{ fillRule: "evenodd", clipRule: "evenodd" }} d="M87.9,78.04c2.74-0.48,5.33-0.4,7.6,0.13V24.82L39.05,41.03v61.95c0.03,0.34,0.05,0.69,0.05,1.03 c0,0,0,0.01,0,0.01c0,8.34-8.75,16.62-19.55,18.49C8.76,124.37,0,119.12,0,110.77c0-8.34,8.76-16.62,19.55-18.48 c4.06-0.7,7.84-0.39,10.97,0.71l0-76.26h0.47L104.04,0v85.92c0.13,0.63,0.2,1.27,0.2,1.91c0,0,0,0,0,0.01 c0,6.97-7.32,13.89-16.33,15.44c-9.02,1.56-16.33-2.83-16.33-9.8C71.57,86.51,78.88,79.59,87.9,78.04L87.9,78.04L87.9,78.04z"/>
                                    </g>
                                    <line x1="110" y1="53.94" x2="125" y2="68.94" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                                    <line x1="110" y1="68.94" x2="125" y2="53.94" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                                </svg>
                            ) : (
                                <svg version="1.1" id="Layer_1_Unmuted" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 130 122.88" xmlSpace="preserve">
                                    <g>
                                        <path style={{ fillRule: "evenodd", clipRule: "evenodd" }} d="M87.9,78.04c2.74-0.48,5.33-0.4,7.6,0.13V24.82L39.05,41.03v61.95c0.03,0.34,0.05,0.69,0.05,1.03 c0,0,0,0.01,0,0.01c0,8.34-8.75,16.62-19.55,18.49C8.76,124.37,0,119.12,0,110.77c0-8.34,8.76-16.62,19.55-18.48 c4.06-0.7,7.84-0.39,10.97,0.71l0-76.26h0.47L104.04,0v85.92c0.13,0.63,0.2,1.27,0.2,1.91c0,0,0,0,0,0.01 c0,6.97-7.32,13.89-16.33,15.44c-9.02,1.56-16.33-2.83-16.33-9.8C71.57,86.51,78.88,79.59,87.9,78.04L87.9,78.04L87.9,78.04z"/>
                                    </g>
                                </svg>
                            )}
                        </button>
                        <button 
                            className={styles.audioControl}
                            onClick={toggleSoundMute}
                            aria-label={isSoundMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
                        >
                            {isSoundMuted ? (
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
                </div>
            )}
        </>
    );
}