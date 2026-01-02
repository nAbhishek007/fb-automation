import axios from 'axios';
import fs from 'fs';

const APP_ID = '1904943500415595';
const APP_SECRET = 'aaa34b5dcc78babb29de1de58e71dd98';
const SHORT_LIVED_TOKEN = 'EAAbEiTio0msBQd0YtwfzwqNx2mTp8NT4X6CyUwcf6xzzNq7IWIaDVou2PBFSsaiUwZAfnkZCGszEQZB2QTHrFb2r10sLtpcv3JiJI8WS0oHeLqvYrsElZCZBxYlahPUAZCj2xNf3zdbBuOKHcaN0Yk9cJJ7Y0n0kdxdMA6jo70OZCORAjCsZAvKH67E6emeNFRIiDrKEEd3pLEbNtoVNiVcqOAHN7LZAsO6hFpow2';

async function exchangeToken() {
    console.log('\n🔑 Exchanging for long-lived token...\n');

    try {
        // Step 1: Exchange for long-lived USER token
        const exchangeResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: APP_ID,
                client_secret: APP_SECRET,
                fb_exchange_token: SHORT_LIVED_TOKEN,
            }
        });

        const longLivedUserToken = exchangeResponse.data.access_token;
        console.log('✅ Got long-lived user token!');

        // Step 2: Get Page Access Token
        console.log('⏳ Fetching page token...');
        const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
            params: {
                access_token: longLivedUserToken,
            }
        });

        const pages = pagesResponse.data.data;

        if (pages.length === 0) {
            console.log('❌ No pages found.');
            return;
        }

        console.log(`\n📄 Found ${pages.length} page(s):\n`);
        pages.forEach((page, i) => {
            console.log(`  ${i + 1}. ${page.name} (ID: ${page.id})`);
        });

        // Use the first page
        const selectedPage = pages[0];
        console.log(`\n✅ Using page: ${selectedPage.name}`);

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
        console.log(`\n   Page ID: ${selectedPage.id}`);
        console.log(`   Token: ${selectedPage.access_token.substring(0, 40)}...`);
        console.log('\n🎉 This token is now valid for ~60 days!\n');

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data?.error?.message || error.message);
    }
}

exchangeToken();
