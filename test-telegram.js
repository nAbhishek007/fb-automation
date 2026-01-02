import axios from 'axios';

const BOT_TOKEN = '8219265729:AAFl3ovLRLX7GuhWyjdQQVJv8JRRGA57d_A';

// Try different ID formats
const IDS_TO_TRY = [
    '788499022',
    '-788499022',
    '-100788499022',
    '-1001788499022',
];

console.log('Testing different channel ID formats...\n');

for (const id of IDS_TO_TRY) {
    try {
        const res = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
            params: { chat_id: id },
            timeout: 10000
        });
        if (res.data.ok) {
            console.log(`✅ ID ${id} works! Channel: ${res.data.result.title || res.data.result.first_name || 'Unknown'}`);
        }
    } catch (e) {
        console.log(`❌ ID ${id}: ${e.response?.data?.description || e.message}`);
    }
}

console.log('\nDone! Use the working ID in your .env file');
