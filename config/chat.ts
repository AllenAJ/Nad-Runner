export const CHAT_CONFIG = {
    // Message retention settings
    RETENTION_PERIOD_DAYS: 30,
    ARCHIVE_DELETE_AFTER_DAYS: 365,
    
    // Rate limiting
    MESSAGE_RATE_LIMIT_WINDOW: 1000,
    MAX_MESSAGES_PER_WINDOW: 5,
    
    // Pagination
    MESSAGES_PER_PAGE: 50,
    
    // Message constraints
    MAX_MESSAGE_LENGTH: 500,
    
    // Archive settings
    ARCHIVE_BATCH_SIZE: 1000,
    CLEANUP_CRON_SCHEDULE: '0 0 * * *', // Daily at midnight
    
    // Cleanup settings
    EMPTY_ROOM_CLEANUP_DELAY: 5 * 60 * 1000, // 5 minutes in milliseconds
    MESSAGES_TO_KEEP: 10, // Number of recent messages to keep in main table
}; 