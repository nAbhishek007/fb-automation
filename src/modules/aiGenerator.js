import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';
import logger from '../utils/logger.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const model = genAI.getGenerativeModel({ model: config.gemini.model });

/**
 * Generate new title and description for a TikTok video
 * @param {Object} videoData - Original video metadata
 * @returns {Promise<Object>} Generated title and description
 */
export async function generateContent(videoData) {
    logger.info(`Generating AI content for video: ${videoData.id}`);

    const prompt = `You are a social media content expert. Your task is to create engaging, original content for a Facebook video post based on the following TikTok video information.

ORIGINAL VIDEO DATA:
- Description: "${videoData.description || 'No description'}"
- Author: ${videoData.author || 'Unknown'}
- Hashtags: ${videoData.hashtags?.join(', ') || 'None'}
- Views: ${videoData.views?.toLocaleString() || 'N/A'}
- Category hints from content: ${extractCategoryHints(videoData)}

REQUIREMENTS:
1. Create a NEW, ORIGINAL title (max 100 characters) - DO NOT copy the original
2. Create a NEW, ORIGINAL description (max 500 characters) - make it engaging and call-to-action oriented
3. Add 5-7 relevant Facebook hashtags
4. The content should be in English and appeal to a broad audience
5. Make the title catchy and curiosity-inducing
6. Include a call-to-action like "Follow for more!" or "Share if you agree!"

RESPOND IN THIS EXACT JSON FORMAT:
{
  "title": "Your engaging title here",
  "description": "Your engaging description with call-to-action here",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}

Only respond with the JSON, no other text.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }

        const generated = JSON.parse(jsonMatch[0]);

        // Validate response
        if (!generated.title || !generated.description) {
            throw new Error('Missing required fields in AI response');
        }

        // Format hashtags
        const hashtags = (generated.hashtags || [])
            .map(h => h.startsWith('#') ? h : `#${h}`)
            .join(' ');

        const fullDescription = `${generated.description}\n\n${hashtags}\n\n📱 Follow for more amazing content!`;

        logger.info(`Content generated successfully for video: ${videoData.id}`);

        return {
            title: generated.title.slice(0, 100),
            description: fullDescription.slice(0, 2000),
            hashtags: generated.hashtags || [],
        };
    } catch (error) {
        logger.error('AI content generation failed', { error: error.message });

        // Fallback content
        return generateFallbackContent(videoData);
    }
}

/**
 * Extract category hints from video data
 */
function extractCategoryHints(videoData) {
    const hints = [];

    if (videoData.music) {
        hints.push(`Music: ${videoData.music}`);
    }

    if (videoData.hashtags?.length > 0) {
        const categories = videoData.hashtags.slice(0, 3).join(', ');
        hints.push(`Tags: ${categories}`);
    }

    return hints.join('; ') || 'General entertainment';
}

/**
 * Generate fallback content if AI fails
 */
function generateFallbackContent(videoData) {
    const templates = [
        { title: "You Won't Believe What Happens Next! 🔥", desc: "This is absolutely incredible! Watch till the end! 👀" },
        { title: "This Made My Entire Day! 😂", desc: "Tag someone who needs to see this! 💯" },
        { title: "Wait For It... 😱", desc: "The ending is EVERYTHING! Share with your friends! 🙌" },
        { title: "POV: When Things Get Real 🎬", desc: "Can you relate? Drop a comment below! 👇" },
        { title: "This Is Going Viral For A Reason! 🚀", desc: "Double tap if you agree! Share for more! ❤️" },
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    const hashtags = ['#viral', '#trending', '#foryou', '#fyp', '#explore', '#follow'];

    return {
        title: template.title,
        description: `${template.desc}\n\n${hashtags.join(' ')}\n\n📱 Follow for more amazing content!`,
        hashtags: hashtags.map(h => h.replace('#', '')),
    };
}

/**
 * Batch generate content for multiple videos
 */
export async function batchGenerateContent(videos) {
    const results = [];

    for (const video of videos) {
        try {
            const content = await generateContent(video);
            results.push({ video, content, success: true });

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            results.push({ video, content: null, success: false, error: error.message });
        }
    }

    return results;
}

// Test function
if (process.argv.includes('--test')) {
    console.log('\n🧪 Testing AI Content Generator...\n');

    const testVideo = {
        id: 'test123',
        description: 'POV: You finally understand the assignment #funny #relatable #viral',
        author: 'testuser',
        hashtags: ['funny', 'relatable', 'viral'],
        views: 1500000,
        music: 'Original Sound - Trending Audio',
    };

    generateContent(testVideo)
        .then(content => {
            console.log('✅ Content generated successfully!\n');
            console.log('Title:', content.title);
            console.log('\nDescription:', content.description);
            console.log('\nHashtags:', content.hashtags.join(', '));
        })
        .catch(err => {
            console.error('❌ Test failed:', err.message);
            process.exit(1);
        });
}

export default {
    generateContent,
    batchGenerateContent,
};
