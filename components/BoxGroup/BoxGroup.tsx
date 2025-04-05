import React from 'react';
import styles from './BoxGroup.module.css';

interface BoxGroupProps {
    arrangement: 'vertical' | 'horizontal';  // The arrangement of boxes
    count: number;                          // Number of boxes to display
    spacing?: number;                       // Optional spacing between boxes
    scale?: number;                         // Optional scale factor for boxes
}

export const BoxGroup: React.FC<BoxGroupProps> = ({
    arrangement,
    count,
    spacing = 0,
    scale = 1
}) => {
    return (
        <div 
            className={`${styles.boxGroup} ${styles[arrangement]}`}
            style={{
                gap: `${spacing}px`,
                '--scale': scale
            } as React.CSSProperties}
        >
            {Array(count).fill(0).map((_, index) => (
                <div key={index} className={styles.boxWrapper}>
                    <img 
                        src="/assets/images/box.svg"
                        alt="Box"
                        className={styles.box}
                    />
                </div>
            ))}
        </div>
    );
}; 