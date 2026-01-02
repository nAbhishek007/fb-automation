# Deployment Guide

Since this application uses a local SQLite database (`videos.db`) to track uploaded videos and avoid duplicates, it requires a **persistent filesystem**.

## Recommended Hosting: VPS (Virtual Private Server)

The best and most cost-effective way to host this is on a VPS like:
- **DigitalOcean** (Basic Droplet ~ $4/mo)
- **AWS Lightsail** (~ $3.50/mo)
- **Google Cloud Compute Engine** (e2-micro is often free tier eligible)
- **Hetzner** or **Vultr**

### 1. Set up the Server
1. Create an **Ubuntu 22.04 LTS** server.
2. Connect via SSH: `ssh root@your-server-ip`

### 2. Install Node.js
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Verify installation
node -v
npm -v
```

### 3. Deploy the Code
You can clone your repository (if it's on GitHub) or copy the files manually (using SCP or FileZilla).

```bash
# Example: Cloning from GitHub
git clone https://github.com/yourusername/facebook-auto.git
cd facebook-auto

# Install dependencies
npm install

# Install PM2 (Process Manager)
npm install -g pm2
```

### 4. Configure Environment
Create your `.env` file on the server:
```bash
nano .env
```
Paste the contents of your local `.env` file (the one with all your API keys).
Press `Ctrl+X`, then `Y`, then `Enter` to save.

### 5. Start the Application
Use PM2 to run the application in the background and keep it alive 24/7.

```bash
# Start the scheduler
pm2 start src/index.js --name "fb-auto" -- --start

# Save the process list (so it restarts on reboot)
pm2 save
pm2 startup
# (Run the command output by 'pm2 startup')
```

### 6. Monitoring
- View logs: `pm2 logs fb-auto`
- Check status: `pm2 status`
- Stop app: `pm2 stop fb-auto`
- Restart app: `pm2 restart fb-auto`

## Alternative: Railway / Render (Advanced)
If you prefer PaaS (Platform as a Service), you **MUST** configure a persistent volume for the `/data` directory. If you don't, your database will be wiped every time the app restarts, causing duplicate uploads.

1. **Railway**: Add a Volume and mount it to `/app/data`.
2. **Render**: Add a Disk and mount it to `/opt/render/project/src/data`.
