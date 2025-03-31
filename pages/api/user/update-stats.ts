import { NextApiRequest, NextApiResponse } from 'next';
import { updatePlayerGameStats } from '../../../lib/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress, score, boxJumps } = req.body;

    if (!walletAddress || typeof score !== 'number' || typeof boxJumps !== 'number') {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    try {
        const updatedStats = await updatePlayerGameStats(walletAddress, score, boxJumps);
        res.status(200).json({
            playerStats: {
                highScore: updatedStats.high_score,
                boxJumps: updatedStats.box_jumps,
                highScoreBoxJumps: updatedStats.high_score_box_jumps,
                coins: updatedStats.coins,
                rounds: updatedStats.rounds,
                level: updatedStats.level,
                xp: updatedStats.xp,
                xpToNextLevel: updatedStats.xp_to_next_level,
                status: updatedStats.status,
                username: updatedStats.username
            }
        });
    } catch (error) {
        console.error('Error updating player stats:', error);
        res.status(500).json({ 
            error: 'Failed to update player stats',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 