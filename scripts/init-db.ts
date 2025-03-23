import {createScoresTable } from '../lib/db';

async function initializeDatabase() {
    try {
        // First test the connection
        //await testConnection();
        
        // Then create tables
        await createScoresTable();
        
        console.log('Database initialized successfully');
        process.exit(0);
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}

initializeDatabase();