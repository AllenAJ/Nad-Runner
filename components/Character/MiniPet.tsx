import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './MiniPet.module.css';

interface MiniPetProps {
    type: string;
    width?: number;
    height?: number;
    className?: string;
}

export const MINIPET_FRAMES = {
    'Baldeagle': 8,
    'Bug': 8,
    'Devil': 8,
    'Dodo': 8,
    'Donkey': 8,
    'Elephant': 8,
    'Falcon': 8,
    'Octopus': 8,
    'Owl': 8,
    'Phoenix': 8,
    'Pig': 8,
    'Polar Bear': 9,
    'Puffin': 8,
    'Reaper': 13,
    'Red Parrot': 8,
    'Robot': 50,
    'Snake': 8,
    'Turkey': 8,
    'Turtle': 8,
    'Walrus': 8,
    'Witch': 40,
    'Zombie Bird': 8
};

export const MiniPet: React.FC<MiniPetProps> = ({
    type,
    width = 100,
    height = 100,
    className
}) => {
    const [currentFrame, setCurrentFrame] = useState(1);
    const totalFrames = MINIPET_FRAMES[type as keyof typeof MINIPET_FRAMES] || 8;

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentFrame(prev => (prev % totalFrames) + 1);
        }, 100); // Change frame every 100ms for smooth animation

        return () => clearInterval(interval);
    }, [totalFrames]);

    return (
        <div 
            className={`${styles.miniPetContainer} ${className || ''}`} 
            style={{ width, height }}
        >
            <div className={styles.petLayer}>
                <Image
                    src={`/Mini pets/${type}/${currentFrame}.svg`}
                    alt={`${type} Mini Pet`}
                    width={width}
                    height={height}
                    priority
                />
            </div>
        </div>
    );
}; 