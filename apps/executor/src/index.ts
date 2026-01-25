import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { ExecutorService } from './executor';
import { config } from './config';

const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
});

async function main() {
  logger.info('Starting SecureScope Executor Service...');

  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const executor = new ExecutorService(logger);

  const worker = new Worker(
    'tool-execution',
    async (job: Job) => {
      logger.info({ jobId: job.id, toolId: job.data.toolId }, 'Processing job');

      try {
        const result = await executor.executeJob(job.data);

        logger.info({ jobId: job.id, success: true }, 'Job completed');
        return result;
      } catch (error) {
        logger.error({ jobId: job.id, error }, 'Job failed');
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: config.maxConcurrency,
      limiter: {
        max: config.rateLimitMax,
        duration: config.rateLimitDuration,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ error: err }, 'Worker error');
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down executor...');
    await worker.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Executor service started and ready for jobs');
}

main().catch((err) => {
  console.error('Failed to start executor:', err);
  process.exit(1);
});
