import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './src/config.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        // There isn't a direct listModels on the client instance in some SDK versions, 
        // but let's try to just run a simple prompt on 'gemini-pro' and 'gemini-1.5-flash' to see which one works.

        const modelsToTry = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-002', 'gemini-1.5-pro-002', 'gemini-1.5-flash-8b'];

        console.log('Testing models with API Key:', config.gemini.apiKey ? 'Present' : 'Missing');

        for (const m of modelsToTry) {
            process.stdout.write(`Testing ${m}... `);
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("Hello");
                const response = await result.response;
                console.log('✅ Success!');
            } catch (e) {
                console.log('❌ Failed:', e.message);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

listModels();
