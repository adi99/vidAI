import { Job, Processor } from 'bullmq';
import { createWorker, QueueNames, createQueueEvents } from '../config/redis';
import { moveToDlq } from './index';
import { logger } from '../config/logger';

// Define job payload/result types (can be expanded later)
type ImageJobData = Record<string, any>;
type VideoJobData = Record<string, any>;
type TrainingJobData = Record<string, any>;

type GenericResult = { status: 'queued'; input: unknown };

// Queue events for monitoring
const imageEvents = createQueueEvents(QueueNames.IMAGE);
const videoEvents = createQueueEvents(QueueNames.VIDEO);
const trainingEvents = createQueueEvents(QueueNames.TRAINING);

[imageEvents, videoEvents, trainingEvents].forEach((ev) => {
  ev.on('failed', ({ jobId, failedReason }) => {
    logger.warn('Queue job failed', { queue: ev.name, jobId, failedReason });
  });
  ev.on('completed', ({ jobId }) => {
    logger.info('Queue job completed', { queue: ev.name, jobId });
  });
});

// Placeholder processors - to be implemented in Task 4/5/6
const processImage: Processor<ImageJobData, GenericResult> = async (job: Job<ImageJobData>) => {
  logger.info('Processing image job', { id: job.id, data: job.data });
  // TODO: Call GPU service (Modal/Runpod) for image generation
  return { status: 'queued', input: job.data };
};

const processVideo: Processor<VideoJobData, GenericResult> = async (job: Job<VideoJobData>) => {
  logger.info('Processing video job', { id: job.id, data: job.data });
  // TODO: Call GPU service (Modal/Runpod) for video generation
  return { status: 'queued', input: job.data };
};

const processTraining: Processor<TrainingJobData, GenericResult> = async (job: Job<TrainingJobData>) => {
  logger.info('Processing training job', { id: job.id, data: job.data });
  // TODO: Call GPU service for LoRA training
  return { status: 'queued', input: job.data };
};

// Workers with basic error handling and DLQ forwarding
export const imageWorker = createWorker<ImageJobData, GenericResult>(QueueNames.IMAGE, async (job) => {
  try {
    return await processImage(job);
  } catch (err) {
    logger.error('Image worker error', { id: job.id, err });
    await moveToDlq(QueueNames.IMAGE, job);
    throw err;
  }
});

export const videoWorker = createWorker<VideoJobData, GenericResult>(QueueNames.VIDEO, async (job) => {
  try {
    return await processVideo(job);
  } catch (err) {
    logger.error('Video worker error', { id: job.id, err });
    await moveToDlq(QueueNames.VIDEO, job);
    throw err;
  }
});

export const trainingWorker = createWorker<TrainingJobData, GenericResult>(QueueNames.TRAINING, async (job) => {
  try {
    return await processTraining(job);
  } catch (err) {
    logger.error('Training worker error', { id: job.id, err });
    await moveToDlq(QueueNames.TRAINING, job);
    throw err;
  }
});

export const workers = [imageWorker, videoWorker, trainingWorker];

// For graceful shutdown from index.ts
export async function closeWorkers() {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([imageEvents.close(), videoEvents.close(), trainingEvents.close()]);
  logger.info('All workers and queue events closed');
}