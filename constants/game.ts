export const GAME_CONSTANTS = {
    GAME_WIDTH: 1200,
    GAME_HEIGHT: 700,
    MOBILE_GAME_WIDTH: 400,
    MOBILE_GAME_HEIGHT: 500,
    DEFAULT_XP_TO_NEXT_LEVEL: 150,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 50
} as const;

export const DATABASE_TABLES = {
    USERS: 'users',
    PLAYER_PROFILES: 'player_profiles',
    SCORES: 'scores'
} as const;

export const API_ENDPOINTS = {
    CREATE_USER: '/api/user/create',
    CHECK_USER: '/api/user/check',
    SAVE_SCORE: '/api/scores/save',
    GET_TOP_SCORES: '/api/scores/top'
} as const; 