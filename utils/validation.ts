import { GAME_CONSTANTS } from '../constants/game';

export function validateUsername(username: string): string | null {
    const trimmed = username.trim();
    
    if (!trimmed) {
        return 'Username is required';
    }
    
    if (trimmed.length < GAME_CONSTANTS.MIN_USERNAME_LENGTH) {
        return `Username must be at least ${GAME_CONSTANTS.MIN_USERNAME_LENGTH} characters`;
    }
    
    if (trimmed.length > GAME_CONSTANTS.MAX_USERNAME_LENGTH) {
        return `Username must be less than ${GAME_CONSTANTS.MAX_USERNAME_LENGTH} characters`;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return 'Username can only contain letters, numbers, and underscores';
    }
    
    return null;
} 