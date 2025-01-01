import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import GameContainer from '../components/Game/GameContainer';
import styles from '../styles/Home.module.css';

const Home: NextPage = () => {
    return (
        <div className={styles.container}>
            <Head>
                <title>NadRunner</title>
                <meta name="description" content="An endless runner game with Molandak." />
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <div className={styles.dot1} />
                <div className={styles.dot2} />
                <div className={styles.dot3} />

                <Image
                    src="/assets/molandak.png"
                    alt="Molandak mascot"
                    width={80}
                    height={80}
                    className={styles.mascotLeft}
                />

                <Image
                    src="/assets/molandak.png"
                    alt="Molandak mascot"
                    width={80}
                    height={80}
                    className={styles.mascotRight}
                />

                <h1 className={styles.title}>NadRunner</h1>
                <GameContainer />
            </main>
        </div>
    );
};

export default Home;
