
import fs from 'fs';

function updateEnv() {
    let envContent = '';
    try {
        if (fs.existsSync('.env')) {
            envContent = fs.readFileSync('.env', 'utf8');
        } else if (fs.existsSync('.env.example')) {
            envContent = fs.readFileSync('.env.example', 'utf8');
        }
    } catch (e) { }

    let newEnv = envContent;

    const updateKey = (key, value) => {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(newEnv)) {
            newEnv = newEnv.replace(regex, `${key}=${value}`);
        } else {
            // Append if not found, ensure newline prefix if needed
            newEnv = newEnv.trim() + `\n${key}=${value}`;
        }
    };

    // Schedule: 3 times a day (09:00, 14:00, 20:00 IST) -> (03:30, 08:30, 14:30 UTC)
    updateKey('SCHEDULE_INTERVAL', '30 3,8,14 * * *');

    // Process 1 video per run
    updateKey('VIDEOS_PER_RUN', '1');

    fs.writeFileSync('.env', newEnv.trim());
    console.log('✅ Updated schedule: 3 videos per day (09:00, 14:00, 20:00 IST)');
    console.log('✅ Updated videos per run: 1');
}

updateEnv();
