import 'dotenv/config';

export const config = {
  // Apify Configuration
  apify: {
    token: process.env.APIFY_API_TOKEN,
    tiktokActorId: 'clockworks/tiktok-scraper',
  },

  // Facebook Configuration (optional - for future use)
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
    apiVersion: 'v18.0',
    graphUrl: 'https://graph.facebook.com',
  },

  // Telegram Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
  },

  // Google Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-flash-latest',
  },

  // Scheduler
  scheduler: {
    interval: process.env.SCHEDULE_INTERVAL || '0 */2 * * *',
    videosPerRun: parseInt(process.env.VIDEOS_PER_RUN) || 3,
  },

  // TikTok Settings
  tiktok: {
    region: process.env.TIKTOK_REGION || 'US',
    minViews: 100000,
    minLikes: 5000,
  },

  // File paths
  paths: {
    downloads: './downloads',
    database: './data/videos.db',
  },
};

// Validate required configuration
export function validateConfig() {
  const required = [
    ['APIFY_API_TOKEN', config.apify.token],
    ['TELEGRAM_BOT_TOKEN', config.telegram.botToken],
    ['TELEGRAM_CHANNEL_ID', config.telegram.channelId],
    ['GEMINI_API_KEY', config.gemini.apiKey],
  ];

  const missing = required.filter(([name, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.map(m => m[0]).join(', ')}`);
  }

  return true;
}

export default config;
