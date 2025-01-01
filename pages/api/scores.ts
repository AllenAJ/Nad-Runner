import { NextApiRequest, NextApiResponse } from 'next';
import { saveScore, getTopScores, createScoresTable } from '../../lib/db';

// Create table on module initialization
createScoresTable().catch(console.error);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const { name, score, walletAddress } = req.body;
            if (!name || typeof score !== 'number') {
                return res.status(400).json({ error: 'Name and score are required' });
            }
            const result = await saveScore(name, score, walletAddress);
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error saving score:', error);
            return res.status(500).json({ error: 'Error saving score' });
        }
    } else if (req.method === 'GET') {
        try {
            const scores = await getTopScores();
            return res.status(200).json(scores);
        } catch (error) {
            console.error('Error getting scores:', error);
            return res.status(500).json({ error: 'Error getting scores' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
} 