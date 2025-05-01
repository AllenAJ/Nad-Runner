import React from 'react';
import { BoxGroup } from '../BoxGroup/BoxGroup';
import { BoxConfig } from './BoxConstants';

interface BoxObstacleProps {
    config: BoxConfig;
    x: number;
    y: number;
    scale?: number;
}

export const BoxObstacle: React.FC<BoxObstacleProps> = ({
    config,
    x,
    y,
    scale = 1
}) => {
    // Only render BoxGroup for supported arrangements
    if (config.arrangement !== 'vertical' && config.arrangement !== 'horizontal') {
        // Potentially render something else for 'split_gap' or return null
        // For now, return null to fix the type error
        return null; 
    }

    return (
        <div style={{
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            transform: `translate(-50%, -50%)`,
            pointerEvents: 'none'
        }}>
            <BoxGroup
                arrangement={config.arrangement} // Now guaranteed to be 'vertical' or 'horizontal'
                count={config.count}
                spacing={0}
                scale={scale}
            />
        </div>
    );
}; 