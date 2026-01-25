import { z } from 'zod';

const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),

  // Concurrency
  maxConcurrency: z.number().default(5),
  rateLimitMax: z.number().default(10),
  rateLimitDuration: z.number().default(60000), // 1 minute

  // Docker
  dockerSocket: z.string().default('/var/run/docker.sock'),
  executorImage: z.string().default('securescope/executor-sandbox:latest'),

  // Limits
  defaultTimeoutMs: z.number().default(300000), // 5 minutes
  maxTimeoutMs: z.number().default(600000), // 10 minutes
  defaultMemoryLimit: z.string().default('512m'),
  defaultCpuLimit: z.string().default('0.5'),
  defaultPidsLimit: z.number().default(100),

  // Security
  enableNetworkRestrictions: z.boolean().default(true),
  dropAllCapabilities: z.boolean().default(true),
  readOnlyRootFilesystem: z.boolean().default(true),
  noNewPrivileges: z.boolean().default(true),

  // API callback
  apiUrl: z.string().default('http://localhost:3001'),
  apiSecret: z.string().optional(),
});

type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  return ConfigSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    redisUrl: process.env.REDIS_URL,
    maxConcurrency: process.env.MAX_CONCURRENCY ? parseInt(process.env.MAX_CONCURRENCY) : undefined,
    rateLimitMax: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : undefined,
    rateLimitDuration: process.env.RATE_LIMIT_DURATION ? parseInt(process.env.RATE_LIMIT_DURATION) : undefined,
    dockerSocket: process.env.DOCKER_SOCKET,
    executorImage: process.env.EXECUTOR_IMAGE,
    defaultTimeoutMs: process.env.DEFAULT_TIMEOUT_MS ? parseInt(process.env.DEFAULT_TIMEOUT_MS) : undefined,
    maxTimeoutMs: process.env.MAX_TIMEOUT_MS ? parseInt(process.env.MAX_TIMEOUT_MS) : undefined,
    defaultMemoryLimit: process.env.DEFAULT_MEMORY_LIMIT,
    defaultCpuLimit: process.env.DEFAULT_CPU_LIMIT,
    defaultPidsLimit: process.env.DEFAULT_PIDS_LIMIT ? parseInt(process.env.DEFAULT_PIDS_LIMIT) : undefined,
    enableNetworkRestrictions: process.env.ENABLE_NETWORK_RESTRICTIONS !== 'false',
    dropAllCapabilities: process.env.DROP_ALL_CAPABILITIES !== 'false',
    readOnlyRootFilesystem: process.env.READ_ONLY_ROOT_FILESYSTEM !== 'false',
    noNewPrivileges: process.env.NO_NEW_PRIVILEGES !== 'false',
    apiUrl: process.env.API_URL,
    apiSecret: process.env.API_SECRET,
  });
}

export const config = loadConfig();
