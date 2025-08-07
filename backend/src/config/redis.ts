import { Queue, QueueEvents, Worker, JobsOptions, QueueOptions, WorkerOptions, ConnectionOptions, Processor } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './logger';

const requiredEnv = ['UPSTASH_REDIS_URL', 'UPSTASH_REDIS_TOKEN'];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  logger.error('Missing required Redis environment variables', { missing });
  throw new Error(`Missing Redis env: ${missing.join(',')}`);
}

const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL!;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN!;

export const connection: ConnectionOptions = new IORedis(UPSTASH_REDIS_URL, {
  tls: { rejectUnauthorized: false },
  password: UPSTASH_REDIS_TOKEN,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
  keepAlive: 10000,
});

/**
 * Common queue options
 */
export const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
    priority: 5,
  } as JobsOptions
};

/**
 * Priority map
 */
export const Priority = {
  HIGH: 1,
  MEDIUM: 5,
  LOW: 10,
} as const;

/**
 * Queue names
 */
export const QueueNames = {
  IMAGE: 'gen:image',
  VIDEO: 'gen:video',
  TRAINING: 'train:model',
  DLQ_SUFFIX: ':dlq',
} as const;

export type QueueName = typeof QueueNames[keyof typeof QueueNames];

/**
 * Factory helpers
 */
export const createQueue = (name: QueueName, options: Partial<QueueOptions> = {}) =>
  new Queue(name, { ...defaultQueueOptions, ...options });

export const createDeadLetterQueue = (name: string) => new Queue(name, { connection });

export const createQueueEvents = (name: string) => new QueueEvents(name, { connection });

export const createWorker = <T = any, R = any>(
  name: QueueName,
  processor: Processor<T, R>,
  options: Partial<WorkerOptions> = {}
) =>
  new Worker<T, R>(name, processor, {
    connection,
    concurrency: 3,
    lockDuration: 30000,
    ...options,
  });

// Graceful shutdown utility
export async function shutdownQueues(resources: Array<{ close: () => Promise<unknown> }>) {
  try {
    await Promise.allSettled(resources.map((r) => r.close()));
    if ('quit' in (connection as any) && typeof (connection as any).quit === 'function') {
      await (connection as any).quit();
    }
  } catch (err) {
    logger.error('Error during queue shutdown', { err });
  }
}