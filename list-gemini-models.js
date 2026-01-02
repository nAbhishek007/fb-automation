import axios from 'axios';
import config from './src/config.js';

async function checkModels() {
    const key = config.gemini.apiKey;
    if (!key) {
        console.log('No API Key found');
        return;
    }

    try {
        console.log('Fetching models list...');
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);

        const models = response.data.models;
        console.log(`Found ${models.length} models:`);

        models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .forEach(m => {
                console.log(`- ${m.name.replace('models/', '')}`);
            });

    } catch (error) {
        console.error('Error fetching models:', error.response?.data || error.message);
    }
}

checkModels();
