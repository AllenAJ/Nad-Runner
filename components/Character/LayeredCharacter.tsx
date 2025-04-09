import React from 'react';
import Image from 'next/image';
import styles from './LayeredCharacter.module.css';

interface LayeredCharacterProps {
    width?: number;
    height?: number;
    className?: string;
}

export const LayeredCharacter: React.FC<LayeredCharacterProps> = ({ 
    width = 150, 
    height = 150,
    className
}) => {
    return (
        <div className={`${styles.characterContainer} ${className || ''}`} style={{ width, height }}>
            {/* Base layer - Body */}
            <div className={styles.layer}>
                <Image
                    src="/Char_layers/Body.png"
                    alt="Character Body"
                    width={width}
                    height={height}
                    priority
                />
            </div>
            
            {/* Fur layer */}
            <div className={styles.layer}>
                <Image
                    src="/Char_layers/Fur.png"
                    alt="Character Fur"
                    width={width}
                    height={height}
                />
            </div>
            
            {/* Eyes layer */}
            <div className={styles.layer}>
                <Image
                    src="/Char_layers/Eyes.png"
                    alt="Character Eyes"
                    width={width}
                    height={height}
                />
            </div>
            
            {/* Nose layer */}
            <div className={styles.layer}>
                <Image
                    src="/Char_layers/Nose.png"
                    alt="Character Nose"
                    width={width}
                    height={height}
                />
            </div>
            
            {/* Mouth layer */}
            <div className={styles.layer}>
                <Image
                    src="/Char_layers/Mouth.png"
                    alt="Character Mouth"
                    width={width}
                    height={height}
                />
            </div>
        </div>
    );
}; 