import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { z } from 'zod';
import { executeJob } from './executor.js';
import { validateTarget, sanitizeTarget } from './validators.js';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Environment configuration
const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  hexstrikeUrl: process.env.HEXSTRIKE_URL || 'http://localhost:8888',
  concurrency: parseInt(process.env.EXECUTOR_CONCURRENCY || '5', 10),
  queueName: 'tool-execution',
};

// Job schema
const JobDataSchema = z.object({
  runId: z.string(),
  toolName: z.string(),
  binary: z.string(),
  commandTemplate: z.array(z.string()),
  params: z.record(z.unknown()),
  target: z.string(),
  timeout: z.number().default(300),
  memoryLimit: z.number().default(512),
  cpuLimit: z.number().default(1.0),
  scopeCidrs: z.array(z.string()),
  scopeHosts: z.array(z.string()),
});

export type JobData = z.infer<typeof JobDataSchema>;

// Result schema
export interface JobResult {
  runId: string;
  status: 'completed' | 'failed' | 'timeout';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
  error?: string;
}

async function main() {
  logger.info('Starting HexStrike Executor Service');
  logger.info(`Connecting to Redis: ${config.redisUrl}`);
  logger.info(`HexStrike URL: ${config.hexstrikeUrl}`);
  logger.info(`Concurrency: ${config.concurrency}`);

  const connection = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Create result queue for completed jobs
  const resultQueue = new Queue('tool-results', { connection });

  // Create worker
  const worker = new Worker<JobData, JobResult>(
    config.queueName,
    async (job) => {
      logger.info({ jobId: job.id, runId: job.data.runId }, 'Processing job');

      try {
        // Validate job data
        const data = JobDataSchema.parse(job.data);

        // Sanitize target to prevent command injection
        const sanitization = sanitizeTarget(data.target);
        if (!sanitization.valid) {
          throw new Error(`Target sanitization failed: ${sanitization.reason}`);
        }

        // Validate target against scope
        const targetValidation = validateTarget(
          data.target,
          data.scopeCidrs,
          data.scopeHosts,
        );

        if (!targetValidation.valid) {
          throw new Error(`Target validation failed: ${targetValidation.reason}`);
        }

        // Execute the tool
        const result = await executeJob(data, config.hexstrikeUrl, logger);

        logger.info(
          {
            jobId: job.id,
            runId: data.runId,
            status: result.status,
            duration: result.duration,
          },
          'Job completed',
        );

        // Send result to result queue
        await resultQueue.add('result', result, {
          removeOnComplete: 100,
          removeOnFail: 1000,
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ jobId: job.id, error: errorMessage }, 'Job failed');

        const result: JobResult = {
          runId: job.data.runId,
          status: 'failed',
          stdout: '',
          stderr: errorMessage,
          exitCode: null,
          duration: 0,
          error: errorMessage,
        };

        await resultQueue.add('result', result, {
          removeOnComplete: 100,
          removeOnFail: 1000,
        });

        throw error;
      }
    },
    {
      connection,
      concurrency: config.concurrency,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 1000 },
    },
  );

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, runId: result.runId }, 'Job completed successfully');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
  });

  worker.on('error', (error) => {
    logger.error({ error: error.message }, 'Worker error');
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down executor...');
    await worker.close();
    await resultQueue.close();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Executor service started and ready to process jobs');
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start executor');
  process.exit(1);
});
