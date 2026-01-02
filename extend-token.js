/**
 * Facebook Token Exchange Script
 * 
 * This script converts a short-lived Facebook access token to a long-lived token (~60 days).
 * 
 * INSTRUCTIONS:
 * 1. Go to your Facebook App Dashboard: https://developers.facebook.com/apps/
 * 2. Click on your app ("Social Auto Poster")
 * 3. Go to Settings > Basic
 * 4. Copy your "App ID" and "App Secret"
 * 5. Generate a fresh short-lived token from Graph API Explorer
 * 6. Run this script with: node extend-token.js
 */

import axios from 'axios';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
    console.log('\n🔑 Facebook Token Extension Tool\n');
    console.log('This tool will convert your short-lived token to a long-lived token (~60 days).\n');
    console.log('You need 3 things from your Facebook App Dashboard:');
    console.log('  1. App ID (from Settings > Basic)');
    console.log('  2. App Secret (from Settings > Basic, click "Show")');
    console.log('  3. A fresh short-lived User Token (from Graph API Explorer)\n');

    const appId = await ask('Enter your App ID: ');
    const appSecret = await ask('Enter your App Secret: ');
    const shortLivedToken = await ask('Enter your short-lived User Token: ');

    console.log('\n⏳ Exchanging for long-lived token...');

    try {
        // Step 1: Exchange for long-lived USER token
        const exchangeResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortLivedToken,
            }
        });

        const longLivedUserToken = exchangeResponse.data.access_token;
        console.log('✅ Got long-lived user token!');

        // Step 2: Get Page Access Token (which is also long-lived when derived from a long-lived user token)
        console.log('⏳ Fetching page token...');
        const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
            params: {
                access_token: longLivedUserToken,
            }
        });

        const pages = pagesResponse.data.data;

        if (pages.length === 0) {
            console.log('❌ No pages found. Make sure you granted page permissions.');
            rl.close();
            return;
        }

        console.log(`\n📄 Found ${pages.length} page(s):\n`);
        pages.forEach((page, i) => {
            console.log(`  ${i + 1}. ${page.name} (ID: ${page.id})`);
        });

        let selectedPage = pages[0];
        if (pages.length > 1) {
            const choice = await ask('\nEnter the number of the page to use: ');
            selectedPage = pages[parseInt(choice) - 1] || pages[0];
        }

        console.log(`\n✅ Selected page: ${selectedPage.name}`);

        // Step 3: Update .env file
        let envContent = '';
        try {
            envContent = fs.readFileSync('.env', 'utf8');
        } catch (e) {
            envContent = '';
        }

        const updateKey = (key, value) => {
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent = envContent.trim() + `\n${key}=${value}`;
            }
        };

        updateKey('FACEBOOK_PAGE_ID', selectedPage.id);
        updateKey('FACEBOOK_ACCESS_TOKEN', selectedPage.access_token);

        fs.writeFileSync('.env', envContent.trim());

        console.log('\n✅ .env file updated successfully!');
        console.log('\n📋 Your new credentials:');
        console.log(`   Page ID: ${selectedPage.id}`);
        console.log(`   Token: ${selectedPage.access_token.substring(0, 30)}...`);
        console.log('\n🎉 This token is now valid for ~60 days!');
        console.log('   Set a reminder to refresh it before it expires.\n');

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data?.error?.message || error.message);

        if (error.response?.data?.error?.code === 190) {
            console.log('\n💡 Tip: Your short-lived token may have already expired.');
            console.log('   Generate a fresh one from Graph API Explorer and try again.');
        }
    }

    rl.close();
}

main();
