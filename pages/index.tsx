import type { NextPage } from 'next';
import Head from 'next/head';
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

            <main>
                <GameContainer />
            </main>
        </div>
    );
};

export default Home;