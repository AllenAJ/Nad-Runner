import { useEffect } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { useWeb3 } from '../contexts/Web3Context'
import styles from '../styles/Home.module.css'

export default function Home() {
    const { account, connectWallet, mintTokens } = useWeb3()

    useEffect(() => {
        // Initialize game
        const handleGameOver = (score: number) => {
            if (account) {
                mintTokens(score)
            } else {
                alert('Please connect your wallet to mint tokens!')
            }
        }

        // Add this to your game's global scope
        window.handleGameOver = handleGameOver
    }, [account, mintTokens])

    return (
        <div className={styles.container}>
            <Head>
                <title>MonadRun Game</title>
                <link rel="stylesheet" href="/styles.css" />
            </Head>

            <Script
                src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"
                strategy="beforeInteractive"
            />
            <Script
                src="/web3.js"
                strategy="afterInteractive"
                onLoad={() => console.log('Web3 script loaded')}
            />
            <Script
                src="/salmonad.js"
                strategy="afterInteractive"
                onLoad={() => console.log('Salmonad script loaded')}
            />
            <Script
                src="/game.js"
                strategy="afterInteractive"
                onReady={() => {
                    console.log('Game script ready');
                    if (typeof window !== 'undefined' && typeof window.initializeGame === 'function') {
                        window.initializeGame();
                    }
                }}
            />

            <main className={styles.main}>
                <div id="game-container" className={styles.gameContainer}>
                    <canvas id="game-canvas"></canvas>
                    <div id="start-screen">
                        <button id="start-button">Start Game</button>
                    </div>
                    <div id="game-over-screen" style={{ display: 'none' }}>
                        <h2>Game Over!</h2>
                        <p>Score: <span id="final-score">0</span></p>
                        {!account ? (
                            <button onClick={connectWallet}>Connect Wallet to Mint Tokens</button>
                        ) : (
                            <div>
                                <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
                                <input type="text" id="player-name" placeholder="Enter your name" />
                                <button id="submit-score">Submit Score</button>
                            </div>
                        )}
                        <button id="restart-button">Play Again</button>
                    </div>
                    <div id="tutorial" style={{ display: 'none' }}>
                        <h2>How to Play</h2>
                        <p>Press SPACE to jump</p>
                        <p>Double jump for higher obstacles</p>
                        <p>Collect powerups for bonus points</p>
                        <button onClick={() => {
                            const tutorial = document.getElementById('tutorial');
                            if (tutorial) tutorial.style.display = 'none';
                        }}>Got it!</button>
                    </div>
                    <div id="leaderboard-container" style={{ display: 'none' }}>
                        <h2>Leaderboard</h2>
                        <ul id="leaderboard-list"></ul>
                        <button id="close-leaderboard">Close</button>
                    </div>
                    <div id="salmonad-container">
                        <img id="salmonad" src="/assets/salmonad.png" alt="Salmonad" />
                    </div>
                    <svg id="laser-container"></svg>
                </div>
            </main>
        </div>
    )
}

