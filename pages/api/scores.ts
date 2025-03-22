import { NextApiRequest, NextApiResponse } from 'next';
import { saveScore, getTopScores } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'POST') {
        try {
            const { name, score, walletAddress } = req.body;
            
            // Validate input
            if (!name || typeof score !== 'number') {
                return res.status(400).json({ error: 'Name and score are required' });
            }

            // Save score
            const result = await saveScore(name, score, walletAddress);
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error saving score:', error);
            return res.status(500).json({ error: 'Error saving score' });
        }
    } else if (req.method === 'GET') {
        try {
            // Fetch top scores
            const scores = await getTopScores();
            return res.status(200).json(scores);
        } catch (error) {
            console.error('Error getting scores:', error);
            return res.status(500).json({ error: 'Error getting scores' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}