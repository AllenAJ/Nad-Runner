import { NextApiRequest, NextApiResponse } from 'next';
import { updatePlayerGameStats } from '../../../lib/db';
import { Achievement } from '../../../constants/achievements';

interface UpdateStatsApiResponse {
    playerStats: any;
    unlockedAchievements: Achievement[];
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<UpdateStatsApiResponse | { error: string; details?: string }>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress, score, boxJumps, coinCount, xp } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string' ||
        typeof score !== 'number' || score < 0 ||
        typeof boxJumps !== 'number' || boxJumps < 0 ||
        typeof coinCount !== 'number' || coinCount < 0 ||
        typeof xp !== 'number' || xp < 0
    ) {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    try {
        const result = await updatePlayerGameStats(
            walletAddress, 
            score, 
            boxJumps, 
            coinCount, 
            xp
        );

        res.status(200).json(result);
    } catch (error) {
        console.error('API Error updating player stats:', error);
        res.status(500).json({ 
            error: 'Failed to update player stats',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 