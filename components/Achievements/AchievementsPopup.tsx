import React from 'react';
import styles from './AchievementsPopup.module.css';
import { Achievement, ACHIEVEMENTS, isAchievementUnlocked } from '../../constants/achievements';

interface AchievementsPopupProps {
    bitmap: bigint;
    onClose: () => void;
    achievements: Achievement[]; // Receive the list of all achievements
}

const AchievementsPopup: React.FC<AchievementsPopupProps> = ({ bitmap, onClose, achievements }) => {

    const unlockedCount = achievements.filter(ach => isAchievementUnlocked(bitmap, ach.index)).length;
    const totalCount = achievements.length;

    return (
        <div className={styles.popupOverlay}>
            <div className={styles.popupContainer}>
                <button onClick={onClose} className={styles.closeButton}>&times;</button>
                <h2>Achievements ({unlockedCount}/{totalCount})</h2>
                <div className={styles.achievementsList}>
                    {achievements.map((achievement) => {
                        const unlocked = isAchievementUnlocked(bitmap, achievement.index);
                        return (
                            <div
                                key={achievement.id}
                                className={`${styles.achievementItem} ${unlocked ? styles.unlocked : styles.locked}`}
                                title={achievement.description} // Show description on hover
                            >
                                <div className={styles.icon}>
                                    {/* Placeholder Icon - replace with actual icons later if available */}
                                    {unlocked ? '🏆' : '🔒'}
                                </div>
                                <div className={styles.details}>
                                    <div className={styles.name}>{achievement.name}</div>
                                    <div className={styles.description}>{achievement.description}</div>
                                </div>
                                {unlocked && <div className={styles.unlockedBadge}>Unlocked</div>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AchievementsPopup; 