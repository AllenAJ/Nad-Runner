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

export const ChatBox: React.FC<ChatBoxProps> = ({ walletAddress, username, onBackToMenu }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const socketRef = useRef<Socket>();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load initial messages
    useEffect(() => {
        fetchMessages(1);
    }, []);

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

    // Implement infinite scroll
    const fetchMessages = async (pageNum: number) => {
        if (isLoading || !hasMore) return;

        try {
            setIsLoading(true);
            console.log('Fetching messages for page:', pageNum);
            const response = await fetch(`/api/chat/messages?page=${pageNum}&limit=50`);
            const data = await response.json();
            
            if (!data.hasMore) {
                setHasMore(false);
            }

            console.log('Received messages:', data.messages);
            setMessages(prev => 
                pageNum === 1 ? data.messages : [...prev, ...data.messages]
            );
            setPage(pageNum);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle scroll for loading more messages
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop } = e.currentTarget;
        if (scrollTop === 0 && !isLoading && hasMore) {
            fetchMessages(page + 1);
        }
    };

    // Add this helper function after the component declaration
    const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Replace the sendMessage function
    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

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
            message: newMessage
        });

        socketRef.current?.emit('message', {
            walletAddress: walletAddress.toLowerCase(),
            username,
            message: newMessage,
            timestamp: new Date().toISOString(),
        });
    };

    // Add new function to fetch archived messages
    const fetchArchivedMessages = async (startDate: Date, endDate: Date) => {
        try {
            setIsLoading(true);
            const response = await fetch(
                `/api/chat/archived-messages?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
            );
            const data = await response.json();
            return data.messages;
        } catch (error) {
            console.error('Error fetching archived messages:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
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
                    onScroll={handleScroll}
                >
                    {isLoading && <div className={styles.loading}>Loading...</div>}
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
                        maxLength={500} // Add message length limit
                    />
                    <button 
                        type="submit" 
                        className={styles.sendButton}
                        disabled={!newMessage.trim()} // Disable if empty
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}; 