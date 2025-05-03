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
        '/assets/welcome.gif',
        '/assets/juggle.gif',
        
        '/bg/menubg.png',
        '/Char_layers/shadow.png',
        '/Char_layers/Body.png',
        '/Char_layers/Fur.png',
        '/Char_layers/Eyes.png',
        '/Char_layers/Nose.png',
        '/Char_layers/Mouth.png',
        '/assets/salmonad.png',
        '/ShopUI/petButton.svg', 
        '/ShopUI/petButton_down.svg',
        '/ShopUI/accessoriesButton.svg',
        '/ShopUI/accessoriesButton_hover.svg',
        '/ShopUI/normalItemButton.svg',
        '/ShopUI/normalItemButton_hover.svg',
        '/ShopUI/premiumItemButton.svg',
        '/Display_Icon/coin.svg',
        '/Display_Icon/diamond.svg'
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

// Function to preload assets specific to a screen (e.g., Shop, Inventory)
// Fetches item data and preloads the first N images
export async function preloadScreenAssets(screen: 'shop' | 'inventory', walletAddress: string | null, count: number = 15) {
    if (!walletAddress) return; // Need wallet address for inventory/shop APIs

    let endpoint = '';
    if (screen === 'shop') {
        endpoint = `/api/shop/items?section=normal&limit=${count}`; // Assuming API supports limit
    } else if (screen === 'inventory') {
        endpoint = `/api/inventory/items?walletAddress=${walletAddress.toLowerCase()}&limit=${count}`; // Assuming API supports limit
    } else {
        return; // Unknown screen
    }

    console.log(`Preloading assets for screen: ${screen}`);

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${walletAddress.trim()}`,
                'X-Request-Timestamp': Date.now().toString()
            }
        });

        if (!response.ok) {
            console.warn(`Failed to fetch items for ${screen} preloading (${response.status})`);
            return;
        }

        const data = await response.json();
        let itemsToPreload: any[] = [];

        if (screen === 'shop' && Array.isArray(data)) {
            itemsToPreload = data; // Assuming shop API returns array directly
        } else if (screen === 'inventory' && Array.isArray(data.items)) {
            itemsToPreload = data.items; // Assuming inventory API returns { items: [...] }
        }

        if (itemsToPreload.length === 0) {
            console.log(`No items found for ${screen} preloading.`);
            return;
        }

        // Extract image URLs and filter out null/empty ones
        const imageUrls = itemsToPreload
            .map(item => item.image_url || item.imageUrl) // Handle potential naming difference
            .filter(url => typeof url === 'string' && url.length > 0)
            .slice(0, count); // Ensure we only preload the requested count

        if (imageUrls.length === 0) {
            console.log(`No image URLs found for ${screen} preloading.`);
            return;
        }

        console.log(`Preloading ${imageUrls.length} images for ${screen}...`);

        // Preload images without waiting for all to finish (fire and forget)
        imageUrls.forEach(url => {
            // Use preview URL if logic exists, otherwise base URL
            const urlToLoad = url.includes('.png') ? url.replace('.png', '_preview.png') : url;
            preloadImage(urlToLoad).catch(err => {
                // Log errors but don't block
                // console.warn(`Failed to preload image ${urlToLoad}:`, err);
            });
        });

    } catch (error) {
        console.error(`Error fetching or preloading ${screen} assets:`, error);
    }
}