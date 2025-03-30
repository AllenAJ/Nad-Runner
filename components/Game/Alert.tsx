import React from 'react';
import styles from './GameContainer.module.css';

interface AlertProps {
    message: string;
    onClose: () => void;
    type?: 'info' | 'warning' | 'error';
}

export const Alert: React.FC<AlertProps> = ({ 
    message, 
    onClose, 
    type = 'info' 
}) => {
    return (
        <div className={styles.canvasAlertOverlay} onClick={onClose}>
            <div className={styles.canvasAlertContainer} onClick={e => e.stopPropagation()}>
                <div className={`${styles.canvasAlertContent} ${styles[`alert${type}`]}`}>
                    <p>{message}</p>
                    <button className={styles.canvasAlertCloseButton} onClick={onClose}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}; 