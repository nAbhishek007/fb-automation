import { ApifyClient } from 'apify-client';
import config from '../config.js';
import logger from '../utils/logger.js';

const client = new ApifyClient({
    token: config.apify.token,
});

/**
 * Fetch trending TikTok videos using Apify
 * @param {number} limit - Number of videos to fetch
 * @returns {Promise<Array>} Array of trending video objects
 */
export async function getTrendingVideos(limit = 10) {
    logger.info(`Fetching ${limit} trending TikTok videos...`);

    try {
        // Run the TikTok Scraper actor
        const run = await client.actor('clockworks/tiktok-scraper').call({
            hashtags: ['viral', 'trending', 'fyp'],
            resultsPerPage: limit * 2,
            maxItems: limit * 2,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
        });

        // Fetch results from the run's default dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
            logger.warn('No trending videos found');
            return [];
        }

        // Filter and transform videos
        const videos = items
            .filter(video => {
                // Filter by minimum engagement (lowered for more results)
                const views = video.playCount || video.stats?.playCount || 0;
                const likes = video.diggCount || video.stats?.diggCount || 0;
                return views >= 10000 && likes >= 500; // Lower thresholds
            })
            .slice(0, limit)
            .map(video => ({
                id: video.id,
                url: video.webVideoUrl || `https://www.tiktok.com/@${video.authorMeta?.name}/video/${video.id}`,
                description: video.text || video.desc || '',
                author: video.authorMeta?.name || video.author || 'unknown',
                authorNickname: video.authorMeta?.nickName || video.authorMeta?.nickname || '',
                views: video.playCount || video.stats?.playCount || 0,
                likes: video.diggCount || video.stats?.diggCount || 0,
                shares: video.shareCount || video.stats?.shareCount || 0,
                comments: video.commentCount || video.stats?.commentCount || 0,
                music: video.musicMeta?.musicName || video.music?.title || '',
                hashtags: (video.hashtags || []).map(h => h.name || h),
                createTime: video.createTime || video.createTimeISO,
                videoMeta: {
                    duration: video.videoMeta?.duration || video.video?.duration || 0,
                    width: video.videoMeta?.width || video.video?.width || 0,
                    height: video.videoMeta?.height || video.video?.height || 0,
                },
            }));

        logger.info(`Found ${videos.length} trending videos matching criteria`);
        return videos;
    } catch (error) {
        logger.error('Failed to fetch trending videos', { error: error.message });
        throw error;
    }
}

/**
 * Search TikTok videos by keyword
 * @param {string} keyword - Search keyword
 * @param {number} limit - Number of videos to fetch
 */
export async function searchVideos(keyword, limit = 10) {
    logger.info(`Searching TikTok for: ${keyword}`);

    try {
        const run = await client.actor(config.apify.tiktokActorId).call({
            searchQueries: [keyword],
            resultsType: 'search',
            maxItems: limit,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        return items.map(video => ({
            id: video.id,
            url: video.webVideoUrl || `https://www.tiktok.com/@${video.authorMeta?.name}/video/${video.id}`,
            description: video.text || video.desc || '',
            author: video.authorMeta?.name || 'unknown',
            views: video.playCount || 0,
            likes: video.diggCount || 0,
        }));
    } catch (error) {
        logger.error('Failed to search videos', { error: error.message });
        throw error;
    }
}

// Test function
if (process.argv.includes('--test')) {
    console.log('\n🧪 Testing TikTok Scraper...\n');

    getTrendingVideos(5)
        .then(videos => {
            console.log(`✅ Found ${videos.length} trending videos:\n`);
            videos.forEach((v, i) => {
                console.log(`${i + 1}. ${v.author}: ${v.description.slice(0, 50)}...`);
                console.log(`   Views: ${v.views.toLocaleString()} | Likes: ${v.likes.toLocaleString()}`);
                console.log(`   URL: ${v.url}\n`);
            });
        })
        .catch(err => {
            console.error('❌ Test failed:', err.message);
            process.exit(1);
        });
}

export default {
    getTrendingVideos,
    searchVideos,
};
