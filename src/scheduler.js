import cron from 'node-cron';
import config from './config.js';
import logger from './utils/logger.js';
import { runPipeline } from './index.js';

let scheduledTask = null;
let isRunning = false;

/**
 * Start the scheduler
 */
export function startScheduler() {
    const cronExpression = config.scheduler.interval;

    if (!cron.validate(cronExpression)) {
        logger.error(`Invalid cron expression: ${cronExpression}`);
        throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    logger.info(`Starting scheduler with expression: ${cronExpression}`);

    scheduledTask = cron.schedule(cronExpression, async () => {
        if (isRunning) {
            logger.warn('Previous pipeline still running, skipping this run');
            return;
        }

        try {
            isRunning = true;
            logger.info('Scheduled pipeline starting...');

            await runPipeline(config.scheduler.videosPerRun);

            logger.info('Scheduled pipeline completed');
        } catch (error) {
            logger.error('Scheduled pipeline failed', { error: error.message });
        } finally {
            isRunning = false;
        }
    }, {
        scheduled: true,
        timezone: 'UTC',
    });

    // Run immediately on start (optional)
    if (process.env.RUN_ON_START === 'true') {
        logger.info('Running pipeline immediately on start...');
        runPipeline(config.scheduler.videosPerRun).catch(err => {
            logger.error('Initial run failed', { error: err.message });
        });
    }

    return scheduledTask;
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
        logger.info('Scheduler stopped');
    }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
    return {
        running: isRunning,
        scheduled: scheduledTask !== null,
        cronExpression: config.scheduler.interval,
        videosPerRun: config.scheduler.videosPerRun,
    };
}

/**
 * Parse cron expression to human readable
 */
export function describeCronSchedule(cronExp) {
    const parts = cronExp.split(' ');
    if (parts.length !== 5) return cronExp;

    const [minute, hour, day, month, weekday] = parts;

    if (hour.startsWith('*/')) {
        return `Every ${hour.slice(2)} hours`;
    }
    if (minute.startsWith('*/')) {
        return `Every ${minute.slice(2)} minutes`;
    }

    return cronExp;
}

export default {
    startScheduler,
    stopScheduler,
    getSchedulerStatus,
    describeCronSchedule,
};
