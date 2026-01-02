import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import config from '../config.js';
import logger from '../utils/logger.js';
import { retry, sleep } from '../utils/helpers.js';

const { facebook } = config;
const API_BASE = `${facebook.graphUrl}/${facebook.apiVersion}`;

/**
 * Upload video to Facebook Page using Resumable Upload API
 * @param {string} videoPath - Path to video file
 * @param {Object} metadata - Title, description, etc.
 * @returns {Promise<Object>} Upload result with post ID
 */
export async function uploadVideo(videoPath, metadata) {
    const { title, description } = metadata;

    logger.info(`Starting Facebook upload: ${path.basename(videoPath)}`);

    try {
        // Get file size for resumable upload
        const stats = fs.statSync(videoPath);
        const fileSize = stats.size;

        // Step 1: Initialize upload session
        const uploadSessionId = await initializeUpload(fileSize);
        logger.info(`Upload session created: ${uploadSessionId}`);

        // Step 2: Upload video file
        const videoId = await uploadVideoFile(uploadSessionId, videoPath, fileSize);
        logger.info(`Video uploaded, ID: ${videoId}`);

        // Step 3: Wait for video processing
        await waitForProcessing(videoId);
        logger.info(`Video processed successfully`);

        // Step 4: Publish video with metadata
        const postId = await publishVideo(videoId, title, description);
        logger.info(`Video published! Post ID: ${postId}`);

        return {
            success: true,
            videoId,
            postId,
            url: `https://www.facebook.com/${facebook.pageId}/videos/${videoId}`,
        };
    } catch (error) {
        logger.error('Facebook upload failed', { error: error.message });
        throw error;
    }
}

/**
 * Initialize resumable upload session
 */
async function initializeUpload(fileSize) {
    const response = await axios.post(
        `${API_BASE}/${facebook.pageId}/videos`,
        null,
        {
            params: {
                upload_phase: 'start',
                file_size: fileSize,
                access_token: facebook.accessToken,
            },
        }
    );

    return response.data.upload_session_id;
}

/**
 * Upload video file in chunks
 */
async function uploadVideoFile(uploadSessionId, videoPath, fileSize) {
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
    let startOffset = 0;
    let endOffset = 0;

    const fileStream = fs.createReadStream(videoPath, { highWaterMark: CHUNK_SIZE });

    for await (const chunk of fileStream) {
        endOffset = startOffset + chunk.length;

        const form = new FormData();
        form.append('upload_phase', 'transfer');
        form.append('upload_session_id', uploadSessionId);
        form.append('start_offset', startOffset.toString());
        form.append('video_file_chunk', chunk, {
            filename: 'video.mp4',
            contentType: 'video/mp4',
        });
        form.append('access_token', facebook.accessToken);

        const response = await retry(async () => {
            return await axios.post(
                `${API_BASE}/${facebook.pageId}/videos`,
                form,
                {
                    headers: form.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                }
            );
        }, 3, 2000);

        startOffset = parseInt(response.data.start_offset) || endOffset;

        logger.debug(`Uploaded chunk: ${startOffset}/${fileSize} bytes`);
    }

    // Finish upload
    const finishResponse = await axios.post(
        `${API_BASE}/${facebook.pageId}/videos`,
        null,
        {
            params: {
                upload_phase: 'finish',
                upload_session_id: uploadSessionId,
                access_token: facebook.accessToken,
            },
        }
    );

    return finishResponse.data.video_id;
}

/**
 * Wait for video processing to complete
 */
async function waitForProcessing(videoId, maxWaitMs = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        const response = await axios.get(
            `${API_BASE}/${videoId}`,
            {
                params: {
                    fields: 'status',
                    access_token: facebook.accessToken,
                },
            }
        );

        const status = response.data.status?.video_status;

        if (status === 'ready') {
            return true;
        }

        if (status === 'error') {
            throw new Error('Video processing failed');
        }

        logger.debug(`Video processing status: ${status}`);
        await sleep(5000); // Check every 5 seconds
    }

    throw new Error('Video processing timeout');
}

/**
 * Publish video with title and description
 */
async function publishVideo(videoId, title, description) {
    const response = await axios.post(
        `${API_BASE}/${videoId}`,
        null,
        {
            params: {
                title: title,
                description: description,
                published: true,
                access_token: facebook.accessToken,
            },
        }
    );

    return response.data.id || videoId;
}

/**
 * Simple upload for smaller videos (<1GB)
 */
export async function simpleUpload(videoPath, metadata) {
    const { title, description } = metadata;

    logger.info(`Starting simple Facebook upload: ${path.basename(videoPath)}`);

    const form = new FormData();
    form.append('source', fs.createReadStream(videoPath));
    form.append('title', title);
    form.append('description', description);
    form.append('access_token', facebook.accessToken);

    try {
        const response = await axios.post(
            `${API_BASE}/${facebook.pageId}/videos`,
            form,
            {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 300000, // 5 minute timeout
            }
        );

        return {
            success: true,
            videoId: response.data.id,
            url: `https://www.facebook.com/${facebook.pageId}/videos/${response.data.id}`,
        };
    } catch (error) {
        // Log detailed Facebook API error
        if (error.response?.data) {
            logger.error('Facebook API Error Details', {
                status: error.response.status,
                error: error.response.data.error || error.response.data
            });

            const fbError = error.response.data.error;
            if (fbError) {
                throw new Error(`Facebook API: ${fbError.message} (Code: ${fbError.code}, Type: ${fbError.type})`);
            }
        }
        throw error;
    }
}

/**
 * Check if access token is valid
 */
export async function validateToken() {
    try {
        const response = await axios.get(
            `${API_BASE}/me`,
            {
                params: {
                    access_token: facebook.accessToken,
                },
            }
        );
        return { valid: true, data: response.data };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Upload video as a Facebook Reel
 * Reels are short-form vertical videos (9:16 aspect ratio, 3-90 seconds)
 * @param {string} videoPath - Path to video file
 * @param {Object} metadata - Description for the reel
 * @returns {Promise<Object>} Upload result with reel ID
 */
export async function uploadReel(videoPath, metadata) {
    const { description } = metadata;

    logger.info(`Starting Facebook Reel upload: ${path.basename(videoPath)}`);

    try {
        // Step 1: Initialize Reel upload session
        logger.debug('Initializing Reel upload session...');
        const initResponse = await axios.post(
            `${API_BASE}/${facebook.pageId}/video_reels`,
            null,
            {
                params: {
                    upload_phase: 'start',
                    access_token: facebook.accessToken,
                },
            }
        );

        const videoId = initResponse.data.video_id;
        const uploadUrl = initResponse.data.upload_url;

        logger.debug(`Reel session created. Video ID: ${videoId}`);

        // Step 2: Upload the video file to the upload URL
        logger.debug('Uploading video file...');
        const fileBuffer = fs.readFileSync(videoPath);
        const fileSize = fileBuffer.length;

        await axios.post(uploadUrl, fileBuffer, {
            headers: {
                'Authorization': `OAuth ${facebook.accessToken}`,
                'offset': '0',
                'file_size': fileSize.toString(),
                'Content-Type': 'application/octet-stream',
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        logger.debug('Video file uploaded successfully');

        // Step 3: Publish the Reel
        logger.debug('Publishing Reel...');
        const publishResponse = await axios.post(
            `${API_BASE}/${facebook.pageId}/video_reels`,
            null,
            {
                params: {
                    upload_phase: 'finish',
                    video_id: videoId,
                    video_state: 'PUBLISHED',
                    description: description,
                    access_token: facebook.accessToken,
                },
            }
        );

        const reelSuccess = publishResponse.data.success;

        if (!reelSuccess) {
            throw new Error('Reel publish returned success=false');
        }

        logger.info(`Reel published successfully! Video ID: ${videoId}`);

        return {
            success: true,
            videoId: videoId,
            url: `https://www.facebook.com/reel/${videoId}`,
        };

    } catch (error) {
        // Log detailed Facebook API error
        if (error.response?.data) {
            logger.error('Facebook Reel API Error Details', {
                status: error.response.status,
                error: error.response.data.error || error.response.data
            });

            const fbError = error.response.data.error;
            if (fbError) {
                throw new Error(`Facebook Reel API: ${fbError.message} (Code: ${fbError.code}, Type: ${fbError.type})`);
            }
        }
        logger.error('Facebook Reel upload failed', { error: error.message });
        throw error;
    }
}

// Test function
if (process.argv.includes('--test')) {
    const videoPath = process.argv[process.argv.indexOf('--video') + 1];

    console.log('\n🧪 Testing Facebook Uploader...\n');

    // First validate token
    validateToken()
        .then(result => {
            if (!result.valid) {
                console.log('❌ Invalid access token:', result.error);
                process.exit(1);
            }
            console.log('✅ Token valid for:', result.data.name || result.data.id);

            if (videoPath) {
                return simpleUpload(videoPath, {
                    title: 'Test Upload - Auto Generated',
                    description: 'This is a test upload from the automation system. 🎬\n\n#test #automation',
                });
            } else {
                console.log('\nNo video provided. Use --video <path> to test upload.');
                return null;
            }
        })
        .then(result => {
            if (result) {
                console.log('\n✅ Upload successful!');
                console.log('Video ID:', result.videoId);
                console.log('URL:', result.url);
            }
        })
        .catch(err => {
            console.error('❌ Test failed:', err.message);
            process.exit(1);
        });
}

export default {
    uploadVideo,
    simpleUpload,
    uploadReel,
    validateToken,
};
