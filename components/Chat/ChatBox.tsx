import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './ChatBox.module.css';

interface ChatMessage {
    id: number | string;  // Allow both number and string IDs
    sender_address: string;
    sender_name: string;
    message: string;
    created_at: string;
}

interface ChatBoxProps {
    walletAddress: string;
    username: string;
    onBackToMenu: () => void;
}

// Add chat sound at the top with other imports
const chatSound = typeof window !== 'undefined' ? new Audio('/assets/audio/sendchatsound.mp3') : null;

export const ChatBox: React.FC<ChatBoxProps> = ({ walletAddress, username, onBackToMenu }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const socketRef = useRef<Socket>();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initialize socket connection with reconnection logic
    useEffect(() => {
        const initializeSocket = () => {
            console.log('Initializing socket connection to:', process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001');
            
            socketRef.current = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001', {
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });

            socketRef.current.on('connect', () => {
                console.log('Connected to chat server');
                socketRef.current?.emit('join', { walletAddress, username });
            });

            socketRef.current.on('connect_error', (error) => {
                console.error('Connection error:', error);
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    socketRef.current?.connect();
                }, 5000);
            });

            setupSocketListeners();
        };

        initializeSocket();
        return () => {
            socketRef.current?.disconnect();
        };
    }, [walletAddress, username]);

    const setupSocketListeners = () => {
        if (!socketRef.current) return;

        socketRef.current.on('message', (message: ChatMessage) => {
            console.log('Received message:', message);
            // Only add the message if it's not from us (we've already added our messages optimistically)
            if (message.sender_address.toLowerCase() !== walletAddress.toLowerCase()) {
                setMessages(prev => [...prev, message]);
                scrollToBottom();
            }
        });

        socketRef.current.on('onlineUsers', (users: string[]) => {
            console.log('Online users updated:', users);
            setOnlineUsers(users);
        });

        socketRef.current.on('error', (error: string) => {
            console.error('Socket error:', error);
        });
    };

    // Add this helper function after the component declaration
    const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // Play chat sound
        if (chatSound) {
            chatSound.currentTime = 0; // Reset sound to start
            chatSound.play().catch(error => {
                console.log('Chat sound playback failed:', error);
            });
        }

        // Create optimistic message
        const tempMessage: ChatMessage = {
            id: generateTempId(),
            sender_address: walletAddress.toLowerCase(),
            sender_name: username,
            message: newMessage,
            created_at: new Date().toISOString()
        };

        // Add message to local state immediately
        setMessages(prev => [...prev, tempMessage]);

        // Clear input
        setNewMessage('');

        // Emit to server
        console.log('Sending message:', {
            walletAddress: walletAddress.toLowerCase(),
            username,
            message: newMessage,
            timestamp: new Date().toISOString(),
        });

        socketRef.current?.emit('message', {
            walletAddress: walletAddress.toLowerCase(),
            username,
            message: newMessage,
            timestamp: new Date().toISOString(),
        });
    };

    // Add cleanup on back to menu
    const handleBackToMenu = () => {
        socketRef.current?.disconnect();
        onBackToMenu();
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.onlineUsers}>
                <h3>Online Players ({onlineUsers.length})</h3>
                <div className={styles.usersList}>
                    {onlineUsers.map(user => (
                        <div key={user} className={styles.userItem}>
                            {user}
                        </div>
                    ))}
                </div>
            </div>
            
            <div className={styles.chatBox}>
                <div 
                    className={styles.messages}
                >
                    {messages.map(msg => (
                        <div 
                            key={msg.id} 
                            className={`${styles.message} ${
                                msg.sender_address.toLowerCase() === walletAddress.toLowerCase() ? styles.ownMessage : ''
                            }`}
                        >
                            <span className={styles.sender}>{msg.sender_name}</span>
                            <p>{msg.message}</p>
                            <span className={styles.timestamp}>
                                {new Date(msg.created_at).toLocaleTimeString()}
                            </span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className={styles.messageForm}>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className={styles.messageInput}
                        maxLength={500}
                    />
                    <button 
                        type="submit" 
                        className={styles.sendButton}
                        disabled={!newMessage.trim()}
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}; 