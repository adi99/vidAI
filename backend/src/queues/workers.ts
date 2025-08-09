import { Job, Processor } from 'bullmq';
import { createWorker, QueueNames, createQueueEvents } from '../config/redis';
import { moveToDlq } from './index';
import { logger } from '../config/logger';
import { supabaseAdmin } from '../config/database';
import { oneSignalPushService } from '../services/oneSignalPushService';
import { automatedModerationService } from '../services/automatedModerationService';

// GPU orchestrator and providers
import { createDefaultGPUOrchestrator } from '../services/gpu/orchestrator';
import { ModalProvider } from '../services/gpu/modalService';
import { RunpodProvider } from '../services/gpu/runpodService';
import { OpenRouterCaptionProvider } from '../services/gpu/openrouterService';
import { ImageParams, VideoParams } from '../services/gpu/gpuProvider';

// Define job payload/result types (can be expanded later)
type ImageJobData = {
  userId: string;
  imageId: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  initImageUrl?: string;
  strength?: number;
  metadata?: Record<string, any>;
  // optional flag to request caption of init image before generation
  captionInitImage?: boolean;
};
type VideoJobData = {
  userId: string;
  videoId: string;
  prompt: string;
  negativePrompt?: string;
  initImageUrl?: string;
  framesUrls?: string[];
  numFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  seed?: number;
  metadata?: Record<string, any>;
};
type TrainingJobData = {
  userId: string;
  trainingJobId: string;
  modelName: string;
  trainingImages: string[];
  steps: number;
  metadata?: Record<string, any>;
};

type GenericResult =
  | { status: 'queued'; input: unknown }
  | {
      status: 'completed' | 'started' | 'failed';
      provider: string;
      imageUrl?: string | undefined;
      videoUrl?: string | undefined;
      providerJobId?: string | undefined;
      latencyMs?: number | undefined;
      meta?: Record<string, any> | undefined;
    };

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

// Build orchestrator instance once per worker file
const modal = new ModalProvider();
const runpod = new RunpodProvider();
const openrouter = new OpenRouterCaptionProvider();

const orchestrator = createDefaultGPUOrchestrator({
  providers: [modal, runpod],
  captioner: openrouter,
});

// Image processor
const processImage: Processor<ImageJobData, GenericResult> = async (job: Job<ImageJobData>) => {
  logger.info('Processing image job', { id: job.id });

  try {
    // Update database status to processing
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'image',
      p_job_id: job.id,
      p_status: 'processing',
      p_progress: 0,
    });

    // Optionally caption the init image to enrich prompt (if requested)
    if (job.data.captionInitImage && job.data.initImageUrl) {
      try {
        const caption = await orchestrator.captionImage({
          imageUrl: job.data.initImageUrl,
          prompt: 'Describe the image succinctly for use as conditioning text.',
          metadata: { jobId: job.id },
        });
        // bullmq Job.update exists in v5+, but types may not expose it here; ignore if not available
        // @ts-ignore
        if (typeof job.update === 'function') {
          // @ts-ignore
          await job.update({
            ...job.data,
            metadata: { ...(job.data.metadata || {}), initCaption: caption.caption, captionModel: caption.model },
            prompt: `${job.data.prompt}\nImage context: ${caption.caption}`,
          } as ImageJobData);
        }
      } catch (e: any) {
        logger.warn('Captioning init image failed, continuing without caption', { id: job.id, error: e?.message });
      }
    }

    // Update progress
    await job.updateProgress(25);
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'image',
      p_job_id: job.id,
      p_progress: 25,
    });

    const params: ImageParams = {
      prompt: job.data.prompt,
      negativePrompt: job.data.negativePrompt ?? undefined,
      width: job.data.width ?? undefined,
      height: job.data.height ?? undefined,
      steps: job.data.steps ?? undefined,
      guidance: job.data.guidance ?? undefined,
      seed: job.data.seed ?? undefined,
      initImageUrl: job.data.initImageUrl ?? undefined,
      strength: job.data.strength ?? undefined,
      metadata: { ...(job.data.metadata || {}), jobId: job.id },
    };

    // Update progress
    await job.updateProgress(50);
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'image',
      p_job_id: job.id,
      p_progress: 50,
    });

    const result = await orchestrator.generateImage(params);
    logger.info('Image generation result', { id: job.id, provider: result.provider, status: result.status, latencyMs: result.latencyMs });

    // Update database with completion
    if (result.status === 'completed' && result.imageUrl) {
      await supabaseAdmin.rpc('update_generation_status', {
        p_content_type: 'image',
        p_job_id: job.id,
        p_status: 'completed',
        p_progress: 100,
        p_media_url: result.imageUrl,
        p_thumbnail_url: result.imageUrl, // Use same URL for thumbnail for now
      });

      // Perform automated content moderation
      try {
        const moderationAction = await automatedModerationService.moderateGeneratedContent(
          job.data.imageId,
          'image',
          result.imageUrl,
          job.data.userId
        );
        
        logger.info('Image moderation completed', { 
          jobId: job.id, 
          imageId: job.data.imageId,
          action: moderationAction.action,
          confidence: moderationAction.confidence
        });
      } catch (moderationError: any) {
        logger.error('Image moderation failed', { 
          jobId: job.id, 
          imageId: job.data.imageId,
          error: moderationError.message 
        });
      }

      // Send push notification for completion
      try {
        const { OneSignalPushService } = await import('../services/oneSignalPushService');
        const jobId = job.id || 'unknown';
        const template = OneSignalPushService.templates.generationComplete('image', jobId);
        await oneSignalPushService.sendNotificationToUser(
          job.data.userId,
          template,
          'generation_complete'
        );
      } catch (notificationError: any) {
        logger.error('Failed to send image completion notification', { 
          jobId: job.id, 
          userId: job.data.userId, 
          error: notificationError.message 
        });
      }
    } else {
      await supabaseAdmin.rpc('update_generation_status', {
        p_content_type: 'image',
        p_job_id: job.id,
        p_status: 'failed',
        p_error_message: 'Image generation failed',
      });
    }

    return {
      status: (result.status === 'completed' || result.status === 'started') ? result.status : 'failed',
      provider: result.provider,
      imageUrl: result.imageUrl ?? undefined,
      providerJobId: result.providerJobId ?? undefined,
      latencyMs: result.latencyMs ?? undefined,
      meta: result.meta ?? undefined,
    };
  } catch (error: any) {
    // Update database with failure
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'image',
      p_job_id: job.id,
      p_status: 'failed',
      p_error_message: error.message,
    });
    throw error;
  }
};

// Video processor
const processVideo: Processor<VideoJobData, GenericResult> = async (job: Job<VideoJobData>) => {
  logger.info('Processing video job', { id: job.id });

  try {
    // Update database status to processing
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'video',
      p_job_id: job.id,
      p_status: 'processing',
      p_progress: 0,
    });

    // Update progress
    await job.updateProgress(25);
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'video',
      p_job_id: job.id,
      p_progress: 25,
    });

    const params: VideoParams = {
      prompt: job.data.prompt,
      negativePrompt: job.data.negativePrompt ?? undefined,
      initImageUrl: job.data.initImageUrl ?? undefined,
      framesUrls: job.data.framesUrls ?? undefined,
      numFrames: job.data.numFrames ?? undefined,
      fps: job.data.fps ?? undefined,
      width: job.data.width ?? undefined,
      height: job.data.height ?? undefined,
      seed: job.data.seed ?? undefined,
      metadata: { ...(job.data.metadata || {}), jobId: job.id },
    };

    // Update progress
    await job.updateProgress(50);
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'video',
      p_job_id: job.id,
      p_progress: 50,
    });

    const result = await orchestrator.generateVideo(params);
    logger.info('Video generation result', { id: job.id, provider: result.provider, status: result.status, latencyMs: result.latencyMs });

    // Update database with completion
    if (result.status === 'completed' && result.videoUrl) {
      await supabaseAdmin.rpc('update_generation_status', {
        p_content_type: 'video',
        p_job_id: job.id,
        p_status: 'completed',
        p_progress: 100,
        p_media_url: result.videoUrl,
        p_thumbnail_url: result.videoUrl, // Use same URL for thumbnail for now
      });

      // Perform automated content moderation
      try {
        const moderationAction = await automatedModerationService.moderateGeneratedContent(
          job.data.videoId,
          'video',
          result.videoUrl,
          job.data.userId
        );
        
        logger.info('Video moderation completed', { 
          jobId: job.id, 
          videoId: job.data.videoId,
          action: moderationAction.action,
          confidence: moderationAction.confidence
        });
      } catch (moderationError: any) {
        logger.error('Video moderation failed', { 
          jobId: job.id, 
          videoId: job.data.videoId,
          error: moderationError.message 
        });
      }

      // Send push notification for completion
      try {
        const { OneSignalPushService } = await import('../services/oneSignalPushService');
        const jobId = job.id || 'unknown';
        const template = OneSignalPushService.templates.generationComplete('video', jobId);
        await oneSignalPushService.sendNotificationToUser(
          job.data.userId,
          template,
          'generation_complete'
        );
      } catch (notificationError: any) {
        logger.error('Failed to send video completion notification', { 
          jobId: job.id, 
          userId: job.data.userId, 
          error: notificationError.message 
        });
      }
    } else {
      await supabaseAdmin.rpc('update_generation_status', {
        p_content_type: 'video',
        p_job_id: job.id,
        p_status: 'failed',
        p_error_message: 'Video generation failed',
      });
    }

    return {
      status: (result.status === 'completed' || result.status === 'started') ? result.status : 'failed',
      provider: result.provider,
      videoUrl: result.videoUrl ?? undefined,
      providerJobId: result.providerJobId ?? undefined,
      latencyMs: result.latencyMs ?? undefined,
      meta: result.meta ?? undefined,
    };
  } catch (error: any) {
    // Update database with failure
    await supabaseAdmin.rpc('update_generation_status', {
      p_content_type: 'video',
      p_job_id: job.id,
      p_status: 'failed',
      p_error_message: error.message,
    });
    throw error;
  }
};

// Training processor
const processTraining: Processor<TrainingJobData, GenericResult> = async (job: Job<TrainingJobData>) => {
  logger.info('Processing training job', { id: job.id, modelName: job.data.modelName, steps: job.data.steps });

  const { userId, trainingJobId, modelName, trainingImages, steps } = job.data;

  try {
    // Update job status to processing
    await supabaseAdmin
      .from('training_jobs')
      .update({ 
        status: 'processing',
        progress: 0,
        job_id: job.id 
      })
      .eq('id', trainingJobId);

    // Update progress periodically during training
    const updateProgress = async (progress: number) => {
      await supabaseAdmin
        .from('training_jobs')
        .update({ progress })
        .eq('id', trainingJobId);
      
      // Update BullMQ job progress for monitoring
      await job.updateProgress(progress);
    };

    // Simulate training progress (in real implementation, this would be actual training)
    // For now, we'll simulate the training process with progress updates
    await updateProgress(10);
    logger.info('Training started', { jobId: job.id, modelName });

    // Simulate training steps
    const progressSteps = [20, 35, 50, 65, 80, 95];
    for (let i = 0; i < progressSteps.length; i++) {
      // In real implementation, this would be actual training progress
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate work
      await updateProgress(progressSteps[i]);
      logger.info('Training progress', { jobId: job.id, progress: progressSteps[i] });
    }

    // Simulate final training completion
    await new Promise(resolve => setTimeout(resolve, 3000));

    // In a real implementation, you would:
    // 1. Upload training images to GPU service
    // 2. Start LoRA training with specified steps
    // 3. Monitor training progress
    // 4. Download trained model when complete
    // 5. Upload model to storage and get URL

    // For now, simulate a successful training result
    const trainedModelUrl = `https://storage.example.com/models/${userId}/${modelName}_${steps}steps.safetensors`;
    const trainedModelId = `${modelName}_${Date.now()}`;

    // Update database with completion
    await supabaseAdmin
      .from('training_jobs')
      .update({
        status: 'completed',
        progress: 100,
        trained_model_url: trainedModelUrl,
        trained_model_id: trainedModelId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', trainingJobId);

    // User's total models trained count will be updated automatically by database trigger

    // Send push notification for training completion
    try {
      const { OneSignalPushService } = await import('../services/oneSignalPushService');
      const jobId = job.id || 'unknown';
      const template = OneSignalPushService.templates.trainingComplete(modelName, jobId);
      await oneSignalPushService.sendNotificationToUser(
        userId,
        template,
        'training_complete'
      );
    } catch (notificationError: any) {
      logger.error('Failed to send training completion notification', { 
        jobId: job.id, 
        userId, 
        modelName,
        error: notificationError.message 
      });
    }

    logger.info('Training completed successfully', { 
      jobId: job.id, 
      modelName, 
      trainedModelUrl,
      steps 
    });

    return {
      status: 'completed',
      provider: 'modal', // or whichever provider was used
      meta: {
        modelName,
        trainedModelUrl,
        trainedModelId,
        steps,
        trainingImages: trainingImages.length,
      },
    };

  } catch (error: any) {
    logger.error('Training job failed', { 
      jobId: job.id, 
      modelName, 
      error: error.message 
    });

    // Update database with failure
    await supabaseAdmin
      .from('training_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', trainingJobId);

    // Refund credits for failed training
    const cost = job.data.metadata?.cost || 0;
    if (cost > 0) {
      try {
        await supabaseAdmin.rpc('refund_credits', {
          p_user_id: userId,
          p_amount: cost,
          p_reason: `Training failed: ${error.message}`,
          p_reference_id: trainingJobId
        });
        logger.info('Credits refunded for failed training', { jobId: job.id, amount: cost });
      } catch (refundError: any) {
        logger.error('Failed to refund credits', { jobId: job.id, error: refundError.message });
      }
    }

    throw error;
  }
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