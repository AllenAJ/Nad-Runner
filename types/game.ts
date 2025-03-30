export interface GameState {
    isPlaying: boolean;
    score: number;
    playerName: string;
    hasEnteredName: boolean;
    currentScreen: 'loading' | 'menu' | 'game' | 'gameOver' | 'shop' | 'inventory' | 'multiplayer';
}

export interface LeaderboardEntry {
    name: string;
    score: number;
    date: string;
}

export interface UserData {
    username: string;
    level: number;
    coins: number;
    xp: number;
    xp_to_next_level: number;
    prestige: number;
    status: string;
}

export interface AlertState {
    show: boolean;
    message: string;
    type?: 'info' | 'warning' | 'error';
}

export interface XPUpdate {
    hours: number;
    minutes: number;
    seconds: number;
} 