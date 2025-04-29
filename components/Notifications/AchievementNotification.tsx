import React, { useEffect, useState } from 'react';
import styles from './AchievementNotification.module.css';
import { Achievement } from '../../constants/achievements'; // Assuming Achievement type is needed

export interface NotificationData {
    id: number; // Unique ID for key prop and removal
    type: 'achievement' | 'level-up' | 'error' | 'info'; // Type for styling/icon
    title: string;
    message?: string; // Optional description
    icon?: string; // Optional specific icon path
}

interface AchievementNotificationProps {
    notification: NotificationData;
    onDismiss: (id: number) => void; // Callback to remove notification
}

const AchievementNotification: React.FC<AchievementNotificationProps> = ({ notification, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Auto-dismiss after a delay
        const timer = setTimeout(() => {
            handleDismiss();
        }, 5000); // Display for 5 seconds

        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        setIsExiting(true);
        // Wait for animation to finish before calling onDismiss
        setTimeout(() => {
            onDismiss(notification.id);
        }, 300); // Match animation duration
    };

    // Determine icon based on type (simplified example)
    const renderIcon = () => {
        // You can expand this with actual icons based on achievement.icon or type
        switch (notification.type) {
            case 'achievement': return '🏆';
            case 'level-up': return '✨';
            case 'error': return '❌';
            default: return 'ℹ️';
        }
    };

    if (!isVisible) return null;

    const animationClass = isExiting ? styles.slideOut : styles.slideIn;

    return (
        <div className={`${styles.notificationToast} ${animationClass} ${styles[notification.type] || ''}`}>
            <div className={styles.icon}>
                {renderIcon()}
            </div>
            <div className={styles.content}>
                <div className={styles.title}>{notification.title}</div>
                {notification.message && <div className={styles.message}>{notification.message}</div>}
            </div>
            <button onClick={handleDismiss} className={styles.closeButton}>&times;</button>
        </div>
    );
};

export default AchievementNotification; 