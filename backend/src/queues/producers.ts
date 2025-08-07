import { queues, EnqueueOptions } from './index';
import { QueueNames, Priority } from '../config/redis';
import type { JobsOptions } from 'bullmq';

type BaseJob = Record<string, any>;

// Using exactOptionalPropertyTypes, avoid passing undefined fields by narrowing types.
type BuildableJobOptions = {
  priority: number;
  jobId?: string | null;
  delay?: number | null;
  attempts?: number | null;
};

function buildJobOptions(base: BuildableJobOptions): JobsOptions {
  const opts: JobsOptions = {
    priority: base.priority,
  };
  if (base.jobId != null) opts.jobId = base.jobId;
  if (base.delay != null) opts.delay = base.delay;
  if (base.attempts != null) opts.attempts = base.attempts;
  return opts;
}

export async function enqueueImage(data: BaseJob, opts: EnqueueOptions = {}) {
  const options = buildJobOptions({
    priority: opts.priority ?? Priority.MEDIUM,
    jobId: opts.jobId ?? null,
    delay: opts.delay ?? null,
    attempts: opts.attempts ?? null,
  });
  return queues[QueueNames.IMAGE].add('image.generate', data, options);
}

export async function enqueueVideo(data: BaseJob, opts: EnqueueOptions = {}) {
  const options = buildJobOptions({
    priority: opts.priority ?? Priority.MEDIUM,
    jobId: opts.jobId ?? null,
    delay: opts.delay ?? null,
    attempts: opts.attempts ?? 5,
  });
  return queues[QueueNames.VIDEO].add('video.generate', data, options);
}

export async function enqueueTraining(data: BaseJob, opts: EnqueueOptions = {}) {
  const options = buildJobOptions({
    priority: opts.priority ?? Priority.LOW,
    jobId: opts.jobId ?? null,
    delay: opts.delay ?? null,
    attempts: opts.attempts ?? null,
  });
  return queues[QueueNames.TRAINING].add('training.start', data, options);
}

export { QueueNames, Priority };