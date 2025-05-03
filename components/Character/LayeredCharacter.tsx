import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './LayeredCharacter.module.css';
import { MiniPet } from './MiniPet';

interface LayeredCharacterProps {
    width?: number;
    height?: number;
    className?: string;
    showShadow?: boolean;
    equippedMinipet?: string | null;
    equippedHead?: string | null;
    equippedMouth?: string | null;
    equippedEyes?: string | null;
    equippedNose?: string | null;
}

export const LayeredCharacter: React.FC<LayeredCharacterProps> = ({ 
    width = 150, 
    height = 150,
    className,
    showShadow = false,
    equippedMinipet = null,
    equippedHead = null,
    equippedMouth = null,
    equippedEyes = null,
    equippedNose = null
}) => {
    // Define variants for layer transitions - adding scale and adjusting duration
    const layerVariants = {
        initial: { opacity: 0, scale: 0.95 }, // Start slightly smaller
        animate: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: "easeOut" } }, // Scale up to normal size
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1, ease: "easeIn" } } // Scale down slightly on exit
    };

    return (
        <div className={`${styles.characterContainer} ${className || ''}`} style={{ width, height }}>
            {/* Shadow layer */}
            {showShadow && (
                <div className={styles.shadowLayer}>
                    <Image
                        src="/Char_layers/shadow.png"
                        alt="Character Shadow"
                        width={500} 
                        height={500}
                        priority
                    />
                </div>
            )}
            
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
            
            {/* Eyes layer with animation */}
            <div className={styles.layer}>
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={equippedEyes || 'default-eyes'}
                        variants={layerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        {equippedEyes ? (
                            <Image
                                src={`/items/Eyes/${equippedEyes}.png`}
                                alt={`Eyes - ${equippedEyes}`}
                                width={width}
                                height={height}
                                priority
                            />
                        ) : (
                            <Image
                                src="/Char_layers/Eyes.png"
                                alt="Character Eyes"
                                width={width}
                                height={height}
                                priority
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            
            {/* Nose layer with animation */}
            <div className={styles.layer}>
                 <AnimatePresence mode='wait'>
                    <motion.div
                        key={equippedNose || 'default-nose'}
                        variants={layerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        {equippedNose ? (
                            <Image
                                src={`/items/Nose/${equippedNose}.png`}
                                alt={`Nose - ${equippedNose}`}
                                width={width}
                                height={height}
                            />
                        ) : (
                            <Image
                                src="/Char_layers/Nose.png"
                                alt="Character Nose"
                                width={width}
                                height={height}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            
            {/* Mouth layer with animation */}
            <div className={styles.layer}>
                 <AnimatePresence mode='wait'>
                    <motion.div
                        key={equippedMouth || 'default-mouth'}
                        variants={layerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        {equippedMouth ? (
                            <Image
                                src={`/items/Mouth/${equippedMouth}.png`}
                                alt={`Mouth - ${equippedMouth}`}
                                width={width}
                                height={height}
                            />
                        ) : (
                            <Image
                                src="/Char_layers/Mouth.png"
                                alt="Character Mouth"
                                width={width}
                                height={height}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Head item layer with animation */}
            <AnimatePresence>
                {equippedHead && (
                    <motion.div 
                        key={equippedHead}
                        className={styles.headLayer} 
                        variants={layerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        <Image
                            src={`/items/Head/${equippedHead}.png`}
                            alt={`Head Item - ${equippedHead}`}
                            width={width}
                            height={height}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mini Pet layer with animation */}
            <AnimatePresence>
                {equippedMinipet && (
                    <motion.div 
                        key={equippedMinipet}
                        className={styles.miniPetLayer} 
                        variants={layerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        <MiniPet 
                            type={equippedMinipet}
                            width={width * 0.6}
                            height={height * 0.6}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}; 