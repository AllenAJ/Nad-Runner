export function preloadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

export async function preloadGameAssets(onProgress?: (progress: number) => void) {
    const gameAssets = [
        '/assets/molandak.png',
        '/assets/chog.png', 
        '/assets/mouch.png', 
        '/assets/moyaki.png',
        '/assets/mainchar.svg',
        '/assets/box.png',
        '/assets/box2.png',
        '/assets/box3.png',
        '/assets/explosion.png',
        '/assets/loading.webp',
        '/assets/welcome.gif',
        '/assets/juggle.gif'
    ];

    let loadedCount = 0;
    const totalAssets = gameAssets.length;

    try {
        const loadedAssets = await Promise.all(
            gameAssets.map(src => 
                preloadImage(src).then(img => {
                    loadedCount++;
                    if (onProgress) {
                        onProgress((loadedCount / totalAssets) * 100);
                    }
                    return img;
                })
            )
        );
        return loadedAssets;
    } catch (error) {
        console.error('Error preloading game assets:', error);
        return [];
    }
}

export async function loadLeaderboard() {
    try {
        const response = await fetch('/api/scores');
        if (!response.ok) {
            throw new Error('Failed to load leaderboard');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        return [];
    }
}