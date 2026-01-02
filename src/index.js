import 'dotenv/config';
import config, { validateConfig } from './config.js';
import logger from './utils/logger.js';
import { ensureDir, cleanupFile, hashVideoUrl } from './utils/helpers.js';
import db from './database/db.js';
import tiktokScraper from './modules/tiktokScraper.js';
import videoDownloader from './modules/videoDownloader.js';
import aiGenerator from './modules/aiGenerator.js';
import telegramUploader from './modules/telegramUploader.js';
import facebookUploader from './modules/facebookUploader.js';
import { startScheduler, stopScheduler, describeCronSchedule } from './scheduler.js';

// Ensure directories exist
ensureDir('./downloads');
ensureDir('./data');
ensureDir('./logs');

/**
 * Main pipeline - finds trending videos, downloads, generates content, uploads to Facebook
 * @param {number} count - Number of videos to process
 */
export async function runPipeline(count = 3) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`Starting pipeline - Processing ${count} videos`);
    logger.info(`${'='.repeat(60)}\n`);

    const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
    };

    try {
        // Step 1: Fetch trending videos
        logger.info('Step 1: Fetching trending TikTok videos...');
        const trendingVideos = await tiktokScraper.getTrendingVideos(count * 2);

        if (trendingVideos.length === 0) {
            logger.warn('No trending videos found');
            return results;
        }

        // Filter out already uploaded videos
        const newVideos = [];
        for (const video of trendingVideos) {
            const hash = hashVideoUrl(video.url);
            const isUploaded = await db.isVideoUploaded(video.id);
            const hashExists = await db.isHashExists(hash);
            if (isUploaded || hashExists) {
                logger.debug(`Skipping already processed video: ${video.id}`);
                continue;
            }
            newVideos.push(video);
            if (newVideos.length >= count) break;
        }

        logger.info(`Found ${newVideos.length} new videos to process`);

        // Process each video
        for (const video of newVideos) {
            results.processed++;

            try {
                logger.info(`\n--- Processing video ${results.processed}/${newVideos.length} ---`);
                logger.info(`Video ID: ${video.id}`);
                logger.info(`Author: @${video.author}`);
                logger.info(`Views: ${video.views.toLocaleString()}`);

                // Record video in database
                await db.recordVideo({
                    tiktokId: video.id,
                    tiktokUrl: video.url,
                    videoHash: hashVideoUrl(video.url),
                    originalTitle: video.description?.slice(0, 100),
                    originalDescription: video.description,
                });

                // Step 2: Download video
                logger.info('Downloading video...');
                const videoPath = await videoDownloader.downloadVideo(video.url, video.id);
                logger.info(`Downloaded: ${videoPath}`);

                // Step 3: Generate AI content
                logger.info('Generating AI content...');
                const content = await aiGenerator.generateContent(video);
                logger.info(`Generated title: ${content.title}`);

                // Update database with generated content
                await db.updateGeneratedContent(video.id, content.title, content.description);

                /*
                // Step 4: Upload to Telegram
                logger.info('Uploading to Telegram...');
                const uploadResult = await telegramUploader.uploadVideo(videoPath, {
                    title: content.title,
                    description: content.description,
                });

                logger.info(`Telegram Message ID: ${uploadResult.messageId}`);
                */

                // Step 5: Upload to Facebook as Reel
                logger.info('Uploading to Facebook as Reel...');
                let uploadId = 'skipped_telegram'; // Fallback ID if FB fails but we want to continue/test

                try {
                    const fbResult = await facebookUploader.uploadReel(videoPath, {
                        description: content.description, // Reels use description only, no title
                    });
                    logger.info(`✅ Successfully uploaded Reel! Video ID: ${fbResult.videoId}`);
                    uploadId = fbResult.videoId;
                    // Only count as success if FB upload works
                    results.successful++;
                } catch (fbError) {
                    logger.error('Facebook Reel upload failed', { error: fbError.message });
                    throw fbError; // Stop processing this video if main upload fails
                }

                // Mark as uploaded (using Facebook ID)
                await db.markAsUploaded(video.id, uploadId);

                logger.info(`✅ Successfully processed video!`);



                // Cleanup downloaded file
                cleanupFile(videoPath);

                // Delay between uploads to avoid rate limiting
                if (results.processed < newVideos.length) {
                    logger.info('Waiting 30 seconds before next video...');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }

            } catch (error) {
                logger.error(`Failed to process video ${video.id}`, { error: error.message });
                await db.markAsFailed(video.id);
                results.failed++;
                results.errors.push({ videoId: video.id, error: error.message });
            }
        }

    } catch (error) {
        logger.error('Pipeline failed', { error: error.message });
        results.errors.push({ phase: 'pipeline', error: error.message });
    }

    // Log summary
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('Pipeline Summary:');
    logger.info(`  Processed: ${results.processed}`);
    logger.info(`  Successful: ${results.successful}`);
    logger.info(`  Failed: ${results.failed}`);
    logger.info(`${'='.repeat(60)}\n`);

    return results;
}

/**
 * Display stats
 */
async function showStats() {
    const stats = await db.getStats();
    console.log('\n📊 Upload Statistics:');
    console.log(`   Total processed: ${stats.total}`);
    console.log(`   Uploaded: ${stats.uploaded}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Pending: ${stats.pending}`);

    const recent = await db.getRecentUploads(5);
    if (recent.length > 0) {
        console.log('\n📹 Recent Uploads:');
        recent.forEach((v, i) => {
            console.log(`   ${i + 1}. ${v.generated_title || 'Untitled'}`);
            console.log(`      Uploaded: ${v.uploaded_at}`);
        });
    }
}

/**
 * Main entry point
 */
async function main() {
    console.log('\n🎬 TikTok to Facebook Autopilot System');
    console.log('=====================================\n');

    const args = process.argv.slice(2);

    // Parse commands
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node src/index.js [options]\n');
        console.log('Options:');
        console.log('  --run-once [count]  Run pipeline once with specified videos (default: 3)');
        console.log('  --start             Start scheduler for continuous operation');
        console.log('  --stats             Show upload statistics');
        console.log('  --validate          Validate configuration');
        console.log('  --help              Show this help message');
        return;
    }

    if (args.includes('--validate')) {
        try {
            validateConfig();
            console.log('✅ Configuration is valid!');

            // Also validate Telegram token
            const tokenStatus = await telegramUploader.validateToken();
            if (tokenStatus.valid) {
                console.log(`✅ Telegram bot valid: @${tokenStatus.botName}`);

                // Check channel access
                const channelStatus = await telegramUploader.getChannelInfo();
                if (channelStatus.valid) {
                    console.log(`✅ Channel access: ${channelStatus.data.title || channelStatus.data.id}`);
                } else {
                    console.log(`❌ Cannot access channel: ${channelStatus.error}`);
                    console.log('   Make sure the bot is added to the channel as admin');
                }
            } else {
                console.log(`❌ Telegram bot token invalid: ${tokenStatus.error}`);
            }
        } catch (error) {
            console.log(`❌ Configuration error: ${error.message}`);
        }
        return;
    }

    if (args.includes('--stats')) {
        await showStats();
        return;
    }

    if (args.includes('--run-once')) {
        const countIndex = args.indexOf('--run-once') + 1;
        const count = parseInt(args[countIndex]) || config.scheduler.videosPerRun;

        try {
            validateConfig();
            console.log(`Running pipeline once with ${count} videos...\n`);
            await runPipeline(count);
        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
            process.exit(1);
        }
        return;
    }

    if (args.includes('--start')) {
        try {
            validateConfig();
            console.log('Starting continuous operation...');
            console.log(`Schedule: ${describeCronSchedule(config.scheduler.interval)}`);
            console.log(`Videos per run: ${config.scheduler.videosPerRun}`);
            console.log('\nPress Ctrl+C to stop.\n');

            startScheduler();

            // Keep process running
            process.on('SIGINT', () => {
                console.log('\nShutting down...');
                stopScheduler();
                process.exit(0);
            });
        } catch (error) {
            console.error(`❌ Failed to start: ${error.message}`);
            process.exit(1);
        }
        return;
    }

    // Default: show help
    console.log('No command specified. Use --help for usage information.\n');
    console.log('Quick start:');
    console.log('  1. Copy .env.example to .env and fill in your credentials');
    console.log('  2. Run: npm install');
    console.log('  3. Run: node src/index.js --validate');
    console.log('  4. Run: node src/index.js --run-once');
}

// Run if executed directly
main().catch(error => {
    logger.error('Fatal error', { error: error.message });
    process.exit(1);
});

export default { runPipeline };
