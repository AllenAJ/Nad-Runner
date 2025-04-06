export const BOX_TYPES = {
    SOLID: 'box',
    PASSABLE: 'box2',
    FLOATING: 'box3',
    SPLIT_GAP: 'split_gap',
    CHOG_BETWEEN: 'chog_between'
} as const;

export type BoxType = typeof BOX_TYPES[keyof typeof BOX_TYPES];

export interface BoxConfig {
    type: BoxType;
    width: number;
    height: number;
    arrangement: 'vertical' | 'horizontal' | 'split_gap';
    count: number;
    gapSize?: number;  // Optional gap size for split arrangements
    topCount?: number; // Number of boxes on top
    bottomCount?: number; // Number of boxes on bottom
    hasChog?: boolean;  // Optional chog presence
}

// Box dimensions updated to 50x50
export const BOX_DIMENSIONS = {
    [BOX_TYPES.SOLID]: { width: 50, height: 50 },
    [BOX_TYPES.PASSABLE]: { width: 50, height: 50 },
    [BOX_TYPES.FLOATING]: { width: 50, height: 50 },
    [BOX_TYPES.SPLIT_GAP]: { width: 50, height: 50 }
};

// Predefined box arrangements
export const BOX_ARRANGEMENTS: BoxConfig[] = [
    {
        type: BOX_TYPES.SOLID,
        width: 50,
        height: 50,
        arrangement: 'vertical',
        count: 3
    },
    {
        type: BOX_TYPES.PASSABLE,
        width: 50,
        height: 50,
        arrangement: 'horizontal',
        count: 3
    },
    {
        type: BOX_TYPES.FLOATING,
        width: 50,
        height: 50,
        arrangement: 'vertical',
        count: 2
    },
    {
        type: BOX_TYPES.SPLIT_GAP,
        width: 50,
        height: 50,
        arrangement: 'split_gap',
        count: 5, // Total boxes (3 top + 2 bottom)
        gapSize: 150, // Gap size in pixels
        topCount: 3, // Three boxes stacked vertically at top
        bottomCount: 2 // Two boxes stacked vertically at bottom
    },
    {
        type: BOX_TYPES.CHOG_BETWEEN,
        width: 50,
        height: 50,
        arrangement: 'horizontal',
        count: 2,
        hasChog: true  // New property to indicate chog presence
    }
]; 