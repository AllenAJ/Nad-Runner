import React from 'react';
import AchievementNotification, { NotificationData } from './AchievementNotification';
import styles from './NotificationContainer.module.css';

interface NotificationContainerProps {
    notifications: NotificationData[];
    onDismissNotification: (id: number) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({ notifications, onDismissNotification }) => {
    return (
        <div className={styles.notificationContainer}>
            {notifications.map((notification) => (
                <AchievementNotification
                    key={notification.id}
                    notification={notification}
                    onDismiss={onDismissNotification}
                />
            ))}
        </div>
    );
};

export default NotificationContainer; 