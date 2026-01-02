import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import config from '../config.js';
import logger from '../utils/logger.js';

const { telegram } = config;

/**
 * Upload video to Telegram channel
 * @param {string} videoPath - Path to video file
 * @param {Object} metadata - Title, description, etc.
 * @returns {Promise<Object>} Upload result
 */
export async function uploadVideo(videoPath, metadata) {
    const { title, description } = metadata;

    logger.info(`Starting Telegram upload: ${path.basename(videoPath)}`);

    try {
        const caption = `🎬 ${title}\n\n${description}`;

        // Check file size (Telegram limit is 50MB for bots, 2GB for premium)
        const stats = fs.statSync(videoPath);
        const sizeMB = stats.size / (1024 * 1024);

        if (sizeMB > 50) {
            logger.warn(`Video is ${sizeMB.toFixed(1)}MB - may exceed Telegram bot limit`);
        }

        const form = new FormData();
        form.append('chat_id', telegram.channelId);
        form.append('video', fs.createReadStream(videoPath));
        form.append('caption', caption.slice(0, 1024)); // Telegram caption limit
        form.append('parse_mode', 'HTML');
        form.append('supports_streaming', 'true');

        const response = await axios.post(
            `https://api.telegram.org/bot${telegram.botToken}/sendVideo`,
            form,
            {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 300000, // 5 minute timeout for large files
            }
        );

        if (!response.data.ok) {
            throw new Error(response.data.description || 'Telegram API error');
        }

        const message = response.data.result;
        logger.info(`Video uploaded to Telegram! Message ID: ${message.message_id}`);

        return {
            success: true,
            messageId: message.message_id,
            chatId: message.chat.id,
        };
    } catch (error) {
        logger.error('Telegram upload failed', { error: error.message });
        throw error;
    }
}

/**
 * Send a text message to Telegram channel
 */
export async function sendMessage(text) {
    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${telegram.botToken}/sendMessage`,
            {
                chat_id: telegram.channelId,
                text: text,
                parse_mode: 'HTML',
            }
        );

        return response.data;
    } catch (error) {
        logger.error('Failed to send Telegram message', { error: error.message });
        throw error;
    }
}

/**
 * Validate bot token
 */
export async function validateToken() {
    try {
        const response = await axios.get(
            `https://api.telegram.org/bot${telegram.botToken}/getMe`
        );

        if (response.data.ok) {
            return {
                valid: true,
                data: response.data.result,
                botName: response.data.result.username,
            };
        }
        return { valid: false, error: 'Invalid response' };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Get channel info
 */
export async function getChannelInfo() {
    try {
        const response = await axios.get(
            `https://api.telegram.org/bot${telegram.botToken}/getChat`,
            { params: { chat_id: telegram.channelId } }
        );

        if (response.data.ok) {
            return {
                valid: true,
                data: response.data.result,
            };
        }
        return { valid: false, error: 'Invalid response' };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

// Test function
if (process.argv.includes('--test')) {
    const videoPath = process.argv[process.argv.indexOf('--video') + 1];

    console.log('\n🧪 Testing Telegram Uploader...\n');

    validateToken()
        .then(result => {
            if (!result.valid) {
                console.log('❌ Invalid bot token:', result.error);
                process.exit(1);
            }
            console.log(`✅ Bot valid: @${result.botName}`);

            return getChannelInfo();
        })
        .then(result => {
            if (!result.valid) {
                console.log('❌ Cannot access channel:', result.error);
                console.log('   Make sure the bot is added to the channel as admin');
                process.exit(1);
            }
            console.log(`✅ Channel valid: ${result.data.title || result.data.id}`);

            if (videoPath) {
                return uploadVideo(videoPath, {
                    title: 'Test Upload',
                    description: 'This is a test upload from the automation system. 🤖',
                });
            }
            console.log('\nNo video provided. Use --video <path> to test upload.');
            return null;
        })
        .then(result => {
            if (result) {
                console.log('\n✅ Upload successful!');
                console.log('Message ID:', result.messageId);
            }
        })
        .catch(err => {
            console.error('❌ Test failed:', err.message);
            process.exit(1);
        });
}

export default {
    uploadVideo,
    sendMessage,
    validateToken,
    getChannelInfo,
};
