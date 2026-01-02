import axios from 'axios';
import fs from 'fs';

const USER_TOKEN = 'EAAbEiTio0msBQdoJoJKkNupr6w8hP1CgJMZCUcfmgyscN3ySuxXNlhEyawotR6LMZAvyO6gpJvCZCQHI8kyzM2UxTtjhJN28ZCXZBNGfh6Va4QEr1hofhr6sICVViLrI2XrriSi7CgV6juAA5apKlXy4kT7qPjitTuZAH5pSx3hFGGemMnjL0jdY5FWvb6B0bc8QfrNkXOEJWcrDe5TKTCmkTZCtDF52ctDSzW19mjtBLLdR42DmiXfkjC5euTDxL2NL1iyUzaUEHZCZCTTfBSkZBcVxcSe3nE9S0o9OZB5pcOtWnGUbMeCfiuZAzs38nEegKlOLjMnwt763Rd4ElwZDZD';

async function getPages() {
    try {
        console.log('Fetching pages...');
        const response = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
            params: {
                access_token: USER_TOKEN
            }
        });

        const pages = response.data.data;

        if (pages.length === 0) {
            console.log('No pages found. Make sure you gave the "pages_read_engagement" and "pages_show_list" permissions.');
            return;
        }

        console.log(`\nFound ${pages.length} pages:\n`);
        pages.forEach((page, index) => {
            console.log(`${index + 1}. Name: ${page.name}`);
            console.log(`   ID: ${page.id}`);
            console.log(`   Page Token: ${page.access_token.substring(0, 20)}...`);
            console.log('   ---');
        });

        // Automatically pick the first one and SAVE to .env
        if (pages.length > 0) {
            const p = pages[0];
            const envContent = `FACEBOOK_PAGE_ID=${p.id}\nFACEBOOK_ACCESS_TOKEN=${p.access_token}`;

            // Read existing .env if possible to preserve other keys
            let currentEnv = '';
            try {
                if (fs.existsSync('.env')) {
                    currentEnv = fs.readFileSync('.env', 'utf8');
                } else if (fs.existsSync('.env.example')) {
                    currentEnv = fs.readFileSync('.env.example', 'utf8');
                }
            } catch (e) { }

            // Simple replacement or append
            // We want to replace these specific keys or append them if missing
            let newEnv = currentEnv;

            // Function to update or add key
            const updateKey = (key, value) => {
                const regex = new RegExp(`^${key}=.*`, 'm');
                if (regex.test(newEnv)) {
                    newEnv = newEnv.replace(regex, `${key}=${value}`);
                } else {
                    newEnv += `\n${key}=${value}`;
                }
            };

            updateKey('FACEBOOK_PAGE_ID', p.id);
            updateKey('FACEBOOK_ACCESS_TOKEN', p.access_token);

            fs.writeFileSync('.env', newEnv.trim());
            console.log(`\n✅ Successfully updated .env with Page: ${p.name} (${p.id})`);
        }

    } catch (error) {
        console.error('Error fetching pages:', error.response?.data || error.message);
    }
}

getPages();
