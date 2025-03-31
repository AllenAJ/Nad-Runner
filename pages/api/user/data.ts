import { NextApiRequest, NextApiResponse } from 'next';
import { getPlayerData } from '../../../lib/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress } = req.query;

    if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        const playerData = await getPlayerData(walletAddress);
        if (!playerData) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.status(200).json({
            playerStats: {
                highScore: playerData.high_score,
                boxJumps: playerData.box_jumps,
                highScoreBoxJumps: playerData.high_score_box_jumps,
                coins: playerData.coins,
                rounds: playerData.rounds,
                level: playerData.level,
                xp: playerData.xp,
                xpToNextLevel: playerData.xp_to_next_level,
                status: playerData.status,
                username: playerData.username
            }
        });
    } catch (error) {
        console.error('Error fetching player data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch player data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 