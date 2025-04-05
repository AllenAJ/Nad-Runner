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
    return (
        <div style={{
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            transform: `translate(-50%, -50%)`,
            pointerEvents: 'none'
        }}>
            <BoxGroup
                arrangement={config.arrangement}
                count={config.count}
                spacing={0}
                scale={scale}
            />
        </div>
    );
}; 