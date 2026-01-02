# Deploying to Google Cloud Platform (GCP)

Since this application requires a persistent database (`videos.db`), the best way to host it on GCP is using **Google Compute Engine (GCE)**. This provides you with a Virtual Machine (VPS) where you have full control.

## ✅ Free Tier Eligible Option
Google Cloud offers a "Free Tier" that includes an **e2-micro** instance in specific regions (us-west1, us-central1, us-east1) for free (as of 2024/2025).

---

## Step 1: Create a VM Instance

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Navigate to **Compute Engine** > **VM instances**.
3.  Click **Create Instance**.
4.  **Name**: `facebook-auto-bot`
5.  **Region**: Choose `us-central1`, `us-west1`, or `us-east1` (for Free Tier).
6.  **Machine validation**:
    *   **Series**: `E2`
    *   **Machine type**: `e2-micro` (2 vCPU, 1 GB memory).
7.  **Boot Disk**:
    *   Click "Change".
    *   Select **Ubuntu**.
    *   Version: **Ubuntu 22.04 LTS**.
    *   Size: 30 GB (Standard persistent disk). (Up to 30GB is free tier).
8.  **Firewall**: Uncheck "Allow HTTP/HTTPS traffic" (unless you plan to add a dashboard later). The bot only makes *outbound* requests.
9.  Click **Create**.

## Step 2: Connect to the VM

1.  Wait for the instance to start (green checkmark).
2.  Click the **SSH** button next to your instance in the list.
3.  A browser window will open with a terminal connected to your server.

## Step 3: Install Dependencies

Run these commands in the SSH window to set up the environment:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Git and standard tools
sudo apt install -y git curl zip unzip

# 3. Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Verify installation
node -v
npm -v

# 5. Install libraries for browser automation (if needed later) & Database deps
sudo apt install -y libsqlite3-dev
```

## Step 4: Deploy the Code

### Option A: Clone from GitHub (Recommended)
If you pushed your code to GitHub:
```bash
git clone https://github.com/YOUR_GITHUB_USER/Facebook-auto.git
cd Facebook-auto
npm install
```

### Option B: Upload Manually
If you want to upload files directly from your computer:
1.  Click the **Gear Icon** (Settings) in the SSH window top-right corner.
2.  Select **Upload file**.
3.  Zip your project folder locally (exclude `node_modules`, `downloads`, and `.git`).
4.  Upload the `project.zip`.
5.  Unzip it on the server:
    ```bash
    unzip project.zip -d facebook-auto
    cd facebook-auto
    npm install
    ```

## Step 5: Configure Environment Variables

1.  Create the `.env` file:
    ```bash
    nano .env
    ```
2.  Open your local `.env` file on your computer, copy everything.
3.  Paste it into the terminal window (Right-click -> Paste or Ctrl+V).
4.  Save and exit: Press `Ctrl+X`, type `Y`, then `Enter`.

## Step 6: Start the Automation (Process Manager)

We use `pm2` to keep the bot running 24/7, even if you close the window or the server reboots.

```bash
# 1. Install PM2 globally
sudo npm install -g pm2

# 2. Start the application
# --start flag activates the internal scheduler
pm2 start src/index.js --name "fb-auto" -- --start

# 3. Save the process list so it restarts on reboot
pm2 save

# 4. Generate startup script
pm2 startup
# (Copy and run the command that pm2 outputs!)
```

## 📊 Management Commands

*   **View Logs**: `pm2 logs fb-auto`
*   **Check Status**: `pm2 status`
*   **Restart**: `pm2 restart fb-auto`
*   **Stop**: `pm2 stop fb-auto`
*   **Update Code**:
    ```bash
    git pull
    npm install
    pm2 restart fb-auto
    ```

## ⚠️ Important Notes

*   **Storage**: The `downloads` folder is temporary, but `data/videos.db` is critical. It stores the history of what has been uploaded.
*   **Costs**: Be aware of Google Cloud networking costs if you exceed the free tier bandwidth limits (usually 1GB egress to non-Google destinations, but checking usage is good practice).
