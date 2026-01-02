import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ensureDir, generateVideoFilename } from '../utils/helpers.js';
import config from '../config.js';
import logger from '../utils/logger.js';

const DOWNLOADS_DIR = config.paths.downloads;

// Ensure downloads directory exists
ensureDir(DOWNLOADS_DIR);

/**
 * Download TikTok video without watermark using multiple services
 * @param {string} videoUrl - TikTok video URL
 * @param {string} videoId - Video ID for filename
 * @returns {Promise<string>} Path to downloaded file
 */
export async function downloadVideo(videoUrl, videoId) {
    logger.info(`Downloading video: ${videoId}`);

    // Try multiple download services (Prioritize TikWM for HD support)
    const services = [
        () => downloadViaTikWM(videoUrl),
        () => downloadViaSnapTik(videoUrl),
        () => downloadViaSSST(videoUrl),
    ];

    let downloadUrl = null;
    let lastError = null;

    for (const service of services) {
        try {
            downloadUrl = await service();
            // TikWM returns "undefined" sometimes for hdplay even if play exists, 
            // the service function handles the fallback logic now.
            if (downloadUrl) break;
        } catch (error) {
            lastError = error;
            logger.warn(`Download service failed, trying next...`, { error: error.message });
        }
    }

    if (!downloadUrl) {
        throw new Error(`All download services failed: ${lastError?.message || 'Unknown error'}`);
    }

    // Download the actual video file
    const filename = generateVideoFilename(videoId);
    const filepath = path.join(DOWNLOADS_DIR, filename);

    await downloadFile(downloadUrl, filepath);

    logger.info(`Video downloaded: ${filepath}`);
    return filepath;
}

/**
 * Download via SnapTik API
 */
async function downloadViaSnapTik(videoUrl) {
    try {
        const response = await axios.post('https://snaptik.app/abc2.php',
            new URLSearchParams({ url: videoUrl }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                timeout: 30000,
            }
        );

        // Parse response for download URL
        const data = response.data;
        const match = data.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);

        if (match && match[1]) {
            return match[1].replace(/\\u0026/g, '&');
        }

        return null;
    } catch (error) {
        throw error;
    }
}

/**
 * Download via TikWM API
 */
async function downloadViaTikWM(videoUrl) {
    try {
        const response = await axios.post('https://www.tikwm.com/api/',
            new URLSearchParams({ url: videoUrl, hd: 1 }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                timeout: 30000,
            }
        );

        // Prioritize HD play if available
        if (response.data?.data?.hdplay && !response.data.data.hdplay.includes('error')) {
            logger.debug('Using HD download source (TikWM)');
            return response.data.data.hdplay;
        }

        if (response.data?.data?.play) {
            return response.data.data.play;
        }

        return null;
    } catch (error) {
        throw error;
    }
}

/**
 * Download via SSST API
 */
async function downloadViaSSST(videoUrl) {
    try {
        const response = await axios.get(`https://api.douyin.wtf/api?url=${encodeURIComponent(videoUrl)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 30000,
        });

        if (response.data?.nwm_video_url) {
            return response.data.nwm_video_url;
        }

        return null;
    } catch (error) {
        throw error;
    }
}

/**
 * Download file from URL to local path
 */
async function downloadFile(url, filepath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 120000, // 2 minute timeout for large files
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            // Verify file was written
            const stats = fs.statSync(filepath);
            if (stats.size < 1000) {
                reject(new Error('Downloaded file is too small, likely invalid'));
                return;
            }
            resolve(filepath);
        });
        writer.on('error', reject);
    });
}

/**
 * Get video file info
 */
export function getVideoInfo(filepath) {
    const stats = fs.statSync(filepath);
    return {
        path: filepath,
        size: stats.size,
        sizeFormatted: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
    };
}

// Test function
if (process.argv.includes('--test')) {
    const testUrl = process.argv[process.argv.indexOf('--url') + 1];

    if (!testUrl) {
        console.log('Usage: node videoDownloader.js --test --url <tiktok_url>');
        process.exit(1);
    }

    console.log('\n🧪 Testing Video Downloader...\n');

    downloadVideo(testUrl, 'test_video')
        .then(filepath => {
            const info = getVideoInfo(filepath);
            console.log(`✅ Video downloaded successfully!`);
            console.log(`   Path: ${info.path}`);
            console.log(`   Size: ${info.sizeFormatted}`);
        })
        .catch(err => {
            console.error('❌ Test failed:', err.message);
            process.exit(1);
        });
}

export default {
    downloadVideo,
    getVideoInfo,
};
