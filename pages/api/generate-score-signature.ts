import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

// Load environment variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY!;
const CHAIN_ID = process.env.MONAD_CHAIN_ID || '20143'; // Fallback to Monad Devnet

type RequestData = {
    playerAddress: string;
    score: number;
    gameStartTime: number;
    gameEndTime: number;
    sessionId?: string; // Optional: for additional verification
};

type ResponseData = {
    signature?: string;  // Make signature optional
    score: number;
    error?: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://nadrunner.vercel.app');  // Replace with your domain
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');  // Only needed methods
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'  // Only needed headers
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    console.log('API called with body:', req.body);
    console.log('Environment variables:', {
        hasPrivateKey: !!SIGNER_PRIVATE_KEY,
        chainId: CHAIN_ID
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', score: 0 } as ResponseData);
    }

    try {
        const { playerAddress, score, gameStartTime, gameEndTime, sessionId } = req.body as RequestData;
        console.log('Processing request for:', { playerAddress, score, gameStartTime, gameEndTime, sessionId });

        // Basic input validation
        if (!playerAddress || !score || !gameStartTime || !gameEndTime) {
            return res.status(400).json({
                error: 'Missing required fields',
                score: 0
            });
        }

        // Add score validation rules
        const MIN_GAME_DURATION = 1;      // Minimum seconds needed to achieve any score
        const MAX_SCORE_PER_SECOND = 25;  // Accounts for base rate (10) * 2x multiplier + buffer


        // Time-based validation
        const gameDuration = gameEndTime - gameStartTime;

        if (gameDuration < MIN_GAME_DURATION) {
            return res.status(400).json({
                error: 'Invalid gameplay detected. Game duration too short.',
                score: 0
            });
        }

        // Validate score based on actual play time
        const maxPossibleScore = gameDuration * MAX_SCORE_PER_SECOND;
        if (score > maxPossibleScore) {
            return res.status(400).json({
                error: 'Foul play detected. Please play the game normally.',
                score: 0
            });
        }

        // Validate Ethereum address
        if (!ethers.isAddress(playerAddress)) {
            return res.status(400).json({
                error: 'Invalid player address',
                score: 0
            });
        }

        // Optional: Verify session validity
        // if (sessionId) {
        //   const isValidSession = await verifyGameSession(sessionId);
        //   if (!isValidSession) {
        //     return res.status(401).json({ 
        //       error: 'Invalid game session', 
        //       score: 0 
        //     });
        //   }
        // }

        // Create wallet instance for signing
        const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

        // Convert score to the same format as the contract expects
        const scoreInWei = ethers.parseUnits(Math.floor(score).toString(), 18);

        // Create message hash - must match contract's hash creation exactly
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'uint256'],
            [playerAddress, scoreInWei, BigInt(CHAIN_ID)]  // Convert CHAIN_ID to BigInt
        );

        // Sign the message hash directly
        const signature = await signer.signMessage(ethers.getBytes(messageHash));

        console.log('Debug values:', {
            playerAddress,
            scoreInWei: scoreInWei.toString(),
            chainId: CHAIN_ID,
            messageHash,
            signature
        });

        // Return the signature
        return res.status(200).json({
            signature,
            score
        });

    } catch (error) {
        console.error('Signature generation error:', error);
        return res.status(500).json({
            error: 'Failed to generate signature',
            score: 0
        });
    }
} 