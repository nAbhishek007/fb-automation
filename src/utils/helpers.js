import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Ensure a directory exists, create if not
 */
export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
}

/**
 * Generate a unique filename for downloaded videos
 */
export function generateVideoFilename(videoId) {
    const timestamp = Date.now();
    return `video_${videoId}_${timestamp}.mp4`;
}

/**
 * Calculate hash of video URL to detect duplicates
 */
export function hashVideoUrl(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Clean up downloaded files
 */
export function cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
    } catch (error) {
        console.error(`Failed to cleanup file: ${filePath}`, error);
    }
    return false;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * Format number for display (e.g., 1500000 -> 1.5M)
 */
export function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Truncate text to specified length
 */
export function truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

export default {
    ensureDir,
    generateVideoFilename,
    hashVideoUrl,
    cleanupFile,
    sleep,
    retry,
    formatNumber,
    truncate,
};
