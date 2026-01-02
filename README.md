# TikTok to Facebook Autopilot System

Automated social media production system that discovers trending TikTok videos and republishes them on Facebook with AI-generated titles and descriptions.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
```

Required credentials:
- **APIFY_API_TOKEN**: Get from [Apify Console](https://console.apify.com/account/integrations)
- **FACEBOOK_PAGE_ID**: Your Facebook Page ID
- **FACEBOOK_ACCESS_TOKEN**: Page Access Token with `pages_manage_posts` permission
- **GEMINI_API_KEY**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3. Validate Configuration
```bash
node src/index.js --validate
```

### 4. Run Once (Test)
```bash
# Process 3 videos (default)
node src/index.js --run-once

# Process specific number of videos
node src/index.js --run-once 5
```

### 5. Start Continuous Operation
```bash
node src/index.js --start
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `--run-once [n]` | Run pipeline once, process n videos (default: 3) |
| `--start` | Start scheduler for continuous operation |
| `--stats` | Show upload statistics |
| `--validate` | Validate configuration |
| `--help` | Show help message |

## 🔧 Configuration

Edit `.env` to customize:

```env
# Scheduler (cron format)
SCHEDULE_INTERVAL=0 */2 * * *  # Every 2 hours

# Videos per run
VIDEOS_PER_RUN=3

# TikTok region (US, GB, IN, etc.)
TIKTOK_REGION=US
```

## 📁 Project Structure

```
Facebook-auto/
├── src/
│   ├── index.js           # Main entry point
│   ├── config.js          # Configuration
│   ├── scheduler.js       # Cron scheduler
│   ├── modules/
│   │   ├── tiktokScraper.js    # TikTok trending discovery
│   │   ├── videoDownloader.js  # Video download
│   │   ├── aiGenerator.js      # AI content generation
│   │   └── facebookUploader.js # Facebook upload
│   ├── database/
│   │   └── db.js          # SQLite database
│   └── utils/
│       ├── logger.js      # Logging
│       └── helpers.js     # Utilities
├── downloads/             # Temp video storage
├── data/                  # SQLite database
├── logs/                  # Log files
└── .env                   # Configuration
```

## 🔒 Getting Facebook Access Token

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app (Business type)
3. Add Facebook Login product
4. Go to Graph API Explorer
5. Select your app
6. Get User Token with permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
7. Exchange for Page Access Token
8. Generate long-lived token (optional but recommended)

## ⚠️ Important Notes

- **Rate Limits**: The system includes delays between uploads to avoid Facebook rate limits
- **Duplicate Detection**: Videos are tracked to prevent re-uploads
- **Error Handling**: Failed uploads are logged and can be retried
- **Legal**: Ensure you have rights to republish content

## 📊 Monitoring

Check logs in `./logs/`:
- `app.log` - All application logs
- `error.log` - Error logs only

View statistics:
```bash
node src/index.js --stats
```

## 🛠️ Testing Individual Modules

```bash
# Test TikTok scraping
npm run test:tiktok

# Test video download
npm run test:download

# Test AI generation
npm run test:ai

# Test Facebook upload
npm run test:facebook
```

## License

MIT
