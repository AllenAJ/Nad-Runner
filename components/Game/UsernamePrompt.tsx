import React, { useState } from 'react';
import styles from './GameContainer.module.css';

interface UsernamePromptProps {
    onSubmit: (username: string) => Promise<void>;
}

export const UsernamePrompt: React.FC<UsernamePromptProps> = ({ onSubmit }) => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Trim the username
        const trimmedUsername = username.trim();
        
        // Validate username
        if (!trimmedUsername) {
            setError('Username is required');
            return;
        }
        
        if (trimmedUsername.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        
        if (trimmedUsername.length > 50) {
            setError('Username must be less than 50 characters');
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await onSubmit(trimmedUsername);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to set username');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.usernamePromptOverlay}>
            <div className={styles.usernamePromptContainer}>
                <h2>Welcome to NadRunner!</h2>
                <p>Please choose a username to continue</p>
                
                <form onSubmit={handleSubmit} className={styles.usernameForm}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setError(''); // Clear error when user types
                        }}
                        placeholder="Enter username"
                        maxLength={50}
                        className={styles.usernameInput}
                        disabled={isLoading}
                        autoFocus
                    />
                    {error && <p className={styles.usernameError}>{error}</p>}
                    <button 
                        type="submit" 
                        className={styles.usernameSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Setting up...' : 'Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}; 