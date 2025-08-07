import { Queue } from 'bullmq';
import { createQueue, createDeadLetterQueue, QueueNames, Priority } from '../config/redis';
import { logger } from '../config/logger';

export const queues: Record<string, Queue> = {
  [QueueNames.IMAGE]: createQueue(QueueNames.IMAGE, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 500,
      removeOnFail: 2000,
      priority: Priority.MEDIUM,
    },
  }),
  [QueueNames.VIDEO]: createQueue(QueueNames.VIDEO, {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 2000,
      priority: Priority.MEDIUM,
    },
  }),
  [QueueNames.TRAINING]: createQueue(QueueNames.TRAINING, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 10000 },
      removeOnComplete: 100,
      removeOnFail: 2000,
      priority: Priority.LOW,
    },
  }),
};

// Dead Letter Queues
export const dlqs: Record<string, Queue> = {
  [`${QueueNames.IMAGE}${QueueNames.DLQ_SUFFIX}`]: createDeadLetterQueue(`${QueueNames.IMAGE}${QueueNames.DLQ_SUFFIX}`),
  [`${QueueNames.VIDEO}${QueueNames.DLQ_SUFFIX}`]: createDeadLetterQueue(`${QueueNames.VIDEO}${QueueNames.DLQ_SUFFIX}`),
  [`${QueueNames.TRAINING}${QueueNames.DLQ_SUFFIX}`]: createDeadLetterQueue(`${QueueNames.TRAINING}${QueueNames.DLQ_SUFFIX}`),
};

export type EnqueueOptions = {
  priority?: number;
  jobId?: string;
  delay?: number;
  attempts?: number;
};

export async function moveToDlq(name: string, failedJob: any) {
  const dlq = dlqs[`${name}${QueueNames.DLQ_SUFFIX}`];
  if (!dlq) {
    logger.warn('DLQ not found for queue', { name });
    return;
  }
  await dlq.add('failed', failedJob.asJSON ? failedJob.asJSON() : failedJob, {
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export async function getQueueStats(name: string) {
  const q = queues[name];
  if (!q) return null;
  const [count, waiting, active, delayed, failed, completed] = await Promise.all([
    q.count(),
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getDelayedCount(),
    q.getFailedCount(),
    q.getCompletedCount(),
  ]);
  return { name, count, waiting, active, delayed, failed, completed };
}

export { QueueNames, Priority };