import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { queues, QueueNames } from '../queues';
import { supabaseAdmin } from '../config/database';

// Schemas
const ImageGenBody = z.object({
  prompt: z.string().min(1).max(1000),
  negative_prompt: z.string().max(500).optional(),
  model: z.string().min(1).default('auto'),
  quality: z.enum(['basic', 'standard', 'high']).default('standard'),
  width: z.number().min(256).max(2048).optional(),
  height: z.number().min(256).max(2048).optional(),
  init_image_url: z.string().url().optional(),
  strength: z.number().min(0).max(1).optional(),
  caption_init_image: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const VideoGenBody = z.object({
  prompt: z.string().min(1).max(1000),
  negative_prompt: z.string().max(500).optional(),
  generation_type: z.enum(['text_to_video', 'image_to_video', 'keyframe']).default('text_to_video'),
  input_data: z.any().optional(), // could be init image or frames
  duration_seconds: z.number().min(1).max(30).optional(),
  fps: z.number().min(12).max(60).optional(),
  width: z.number().min(256).max(2048).optional(),
  height: z.number().min(256).max(2048).optional(),
  metadata: z.record(z.any()).optional(),
});

const ImageEditBody = z.object({
  image_url: z.string().url(),
  prompt: z.string().min(1).max(1000),
  negative_prompt: z.string().max(500).optional(),
  edit_type: z.enum(['inpaint', 'outpaint', 'restyle', 'background_replace']),
  mask_url: z.string().url().optional(),
  strength: z.number().min(0).max(1).default(0.8),
  guidance_scale: z.number().min(1).max(20).default(7.5),
  steps: z.number().min(10).max(100).default(30),
  metadata: z.record(z.any()).optional(),
});

const TextToVideoBody = z.object({
  prompt: z.string().min(1).max(1000),
  negative_prompt: z.string().max(500).optional(),
  model: z.string().default('runwayml-gen3'),
  duration_seconds: z.number().min(3).max(15).default(5),
  aspect_ratio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
  quality: z.enum(['basic', 'standard', 'high']).default('standard'),
  motion_strength: z.number().min(1).max(10).default(5),
  metadata: z.record(z.any()).optional(),
});

const ImageToVideoBody = z.object({
  init_image_url: z.string().url(),
  prompt: z.string().min(1).max(1000).optional(),
  negative_prompt: z.string().max(500).optional(),
  model: z.string().default('runwayml-gen3'),
  duration_seconds: z.number().min(3).max(15).default(5),
  motion_strength: z.number().min(1).max(10).default(5),
  aspect_ratio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
  quality: z.enum(['basic', 'standard', 'high']).default('standard'),
  metadata: z.record(z.any()).optional(),
});

const FrameInterpolationBody = z.object({
  first_frame_url: z.string().url(),
  last_frame_url: z.string().url(),
  duration_seconds: z.number().min(3).max(15).default(5),
  fps: z.number().min(12).max(30).default(24),
  interpolation_method: z.enum(['linear', 'smooth', 'dynamic']).default('smooth'),
  quality: z.enum(['basic', 'standard', 'high']).default('standard'),
  metadata: z.record(z.any()).optional(),
});

const JobIdParams = z.object({
  jobId: z.string().min(1),
});

const CancelBody = z.object({
  reason: z.string().max(200).optional(),
});

// Credit check using database function
async function assertHasCredits(userId: string, cost: number) {
  const { data, error } = await supabaseAdmin.rpc('check_user_credits', {
    p_user_id: userId,
    p_required_credits: cost,
  });

  if (error) throw new Error(`Failed to check credits: ${error.message}`);

  if (!data) {
    const err: any = new Error('Insufficient credits');
    err.statusCode = 402;
    err.code = 'INSUFFICIENT_CREDITS';
    throw err;
  }
}

async function deductCredits(userId: string, cost: number, meta: Record<string, any>) {
  // TODO: atomic decrement and create transaction log
  const { error } = await supabaseAdmin.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: cost,
    p_meta: meta,
  });
  if (error) {
    // Fallback: try direct update if function not present yet
    const { error: updErr } = await supabaseAdmin
      .from('users')
      .update({ credits: (supabaseAdmin as any).sql`GREATEST(credits - ${cost}, 0)` })
      .eq('id', userId);
    if (updErr) {
      const err: any = new Error('Failed to deduct credits');
      err.statusCode = 500;
      err.code = 'CREDIT_DEDUCT_FAILED';
      throw err;
    }
  }
}

const router = Router();

// POST /api/generate/image
router.post(
  '/image',
  authenticateUser,
  validateBody(ImageGenBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as z.infer<typeof ImageGenBody>;
    const userId = req.user!.id;

    try {
      // Simple pricing: quality tiers cost multipliers
      const baseCost = 1;
      const multiplier = body.quality === 'high' ? 3 : body.quality === 'standard' ? 2 : 1;
      const cost = baseCost * multiplier;

      await assertHasCredits(userId, cost);

      // Create database record first
      const { data: imageId, error: dbError } = await supabaseAdmin.rpc('create_image_generation', {
        p_user_id: userId,
        p_prompt: body.prompt,
        p_negative_prompt: body.negative_prompt,
        p_model: body.model,
        p_quality: body.quality,
        p_width: body.width,
        p_height: body.height,
        p_credits_used: cost,
        p_job_id: null, // Will be updated after job creation
        p_is_public: true,
      });

      if (dbError) throw new Error(`Failed to create image record: ${dbError.message}`);

      // Enqueue image job
      const job = await queues[QueueNames.IMAGE].add(
        'generate-image',
        {
          userId,
          imageId,
          prompt: body.prompt,
          negativePrompt: body.negative_prompt,
          width: body.width,
          height: body.height,
          steps: body.quality === 'high' ? 50 : body.quality === 'standard' ? 30 : 15,
          guidance: 7.5,
          initImageUrl: body.init_image_url,
          strength: body.strength,
          captionInitImage: body.caption_init_image,
          metadata: {
            ...(body.metadata || {}),
            model: body.model,
            quality: body.quality,
          },
        },
        {
          removeOnComplete: 200,
          removeOnFail: 1000,
          priority: 2,
          jobId: imageId, // Use database ID as job ID
        }
      );

      // Update database record with job ID
      await supabaseAdmin.rpc('update_generation_status', {
        p_content_type: 'image',
        p_job_id: job.id,
        p_status: 'pending',
      });

      // Deduct credits upon accepted enqueue
      await deductCredits(userId, cost, { type: 'image_generation', jobId: job.id, imageId });

      res.status(202).json({
        status: 'queued',
        jobId: job.id,
        queue: QueueNames.IMAGE,
        cost,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      res.status(status).json({
        code: error?.code || 'IMAGE_QUEUE_ERROR',
        message: error?.message || 'Failed to queue image generation',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/generate/video
router.post(
  '/video',
  authenticateUser,
  validateBody(VideoGenBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as z.infer<typeof VideoGenBody>;
    const userId = req.user!.id;

    try {
      // Simple pricing based on duration and quality proxy (fps)
      const seconds = body.duration_seconds ?? 5;
      const fps = body.fps ?? 16;
      const frameCost = Math.ceil((seconds * fps) / 16);
      const cost = Math.max(2, frameCost);

      await assertHasCredits(userId, cost);

      let initImageUrl: string | undefined = undefined;
      let framesUrls: string[] | undefined = undefined;

      if (body.generation_type === 'image_to_video') {
        initImageUrl = body.input_data?.init_image_url;
      } else if (body.generation_type === 'keyframe') {
        framesUrls = body.input_data?.frames_urls;
      }

      // Create database record first
      const { data: videoId, error: dbError } = await supabaseAdmin.rpc('create_video_generation', {
        p_user_id: userId,
        p_prompt: body.prompt,
        p_negative_prompt: body.negative_prompt,
        p_generation_type: body.generation_type,
        p_input_data: body.input_data,
        p_duration_seconds: seconds,
        p_width: body.width,
        p_height: body.height,
        p_fps: fps,
        p_credits_used: cost,
        p_job_id: null, // Will be updated after job creation
        p_is_public: true,
      });

      if (dbError) throw new Error(`Failed to create video record: ${dbError.message}`);

      const job = await queues[QueueNames.VIDEO].add(
        'generate-video',
        {
          userId,
          videoId,
          prompt: body.prompt,
          negativePrompt: body.negative_prompt,
          initImageUrl,
          framesUrls,
          numFrames: Math.floor(seconds * fps),
          fps,
          width: body.width,
          height: body.height,
          metadata: {
            ...(body.metadata || {}),
            generationType: body.generation_type,
          },
        },
        {
          removeOnComplete: 200,
          removeOnFail: 1000,
          priority: 2,
          jobId: videoId, // Use database ID as job ID
        }
      );

      // Update database record with job ID
      await supabaseAdmin.rpc('update_generation_status', {
        p_content_type: 'video',
        p_job_id: job.id,
        p_status: 'pending',
      });

      await deductCredits(userId, cost, { type: 'video_generation', jobId: job.id, videoId });

      res.status(202).json({
        status: 'queued',
        jobId: job.id,
        queue: QueueNames.VIDEO,
        cost,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      res.status(status).json({
        code: error?.code || 'VIDEO_QUEUE_ERROR',
        message: error?.message || 'Failed to queue video generation',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/generate/:jobId - check job status across queues
router.get(
  '/:jobId',
  validateParams(JobIdParams),
  async (req: Request, res: Response) => {
    const { jobId } = req.params as z.infer<typeof JobIdParams>;

    try {
      // Look up job across known queues
      for (const name of [QueueNames.IMAGE, QueueNames.VIDEO, QueueNames.TRAINING]) {
        const q = queues[name];
        const job = await q.getJob(jobId);
        if (job) {
          const state = await job.getState();
          const progress = job.progress;
          const returnvalue = await job.getReturnValue().catch(() => null);
          res.json({
            status: 'ok',
            jobId,
            queue: name,
            state,
            progress,
            result: returnvalue,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      res.status(404).json({
        status: 'not_found',
        message: 'Job not found in any queue',
        jobId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'JOB_STATUS_ERROR',
        message: error?.message || 'Failed to fetch job status',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/generate/:jobId/cancel - best-effort cancellation
router.post(
  '/:jobId/cancel',
  authenticateUser,
  validateParams(JobIdParams),
  validateBody(CancelBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params as z.infer<typeof JobIdParams>;
    const body = req.body as z.infer<typeof CancelBody>;
    const userId = req.user!.id;

    try {
      for (const name of [QueueNames.IMAGE, QueueNames.VIDEO, QueueNames.TRAINING]) {
        const q = queues[name];
        const job = await q.getJob(jobId);
        if (job) {
          // Basic ownership check if job data tracks userId
          const ownerId = (job.data as any)?.userId;
          if (ownerId && ownerId !== userId) {
            res.status(403).json({
              status: 'forbidden',
              code: 'NOT_OWNER',
              message: 'You do not have permission to cancel this job',
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // If job is waiting/delayed - remove
          const state = await job.getState();
          if (state === 'waiting' || state === 'delayed') {
            await job.remove();
            res.json({
              status: 'cancelled',
              jobId,
              queue: name,
              state,
              reason: body.reason || 'user_cancelled',
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // If job is active, best-effort: move to failed
          if (state === 'active') {
            await job.moveToFailed(new Error(body.reason || 'user_cancelled'), name);
            res.json({
              status: 'cancelled',
              jobId,
              queue: name,
              state: 'failed',
              reason: body.reason || 'user_cancelled',
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // If already completed/failed
          res.status(409).json({
            status: 'conflict',
            code: 'NOT_CANCELLABLE',
            message: `Job already ${state}`,
            jobId,
            queue: name,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      res.status(404).json({
        status: 'not_found',
        message: 'Job not found',
        jobId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'JOB_CANCEL_ERROR',
        message: error?.message || 'Failed to cancel job',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/generate/image/edit - Edit image with AI
router.post(
  '/image/edit',
  authenticateUser,
  validateBody(ImageEditBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as z.infer<typeof ImageEditBody>;
    const userId = req.user!.id;

    try {
      // Calculate cost based on edit type and complexity
      const baseCost = 2;
      const editMultiplier = body.edit_type === 'background_replace' ? 2 : 
                           body.edit_type === 'restyle' ? 1.5 : 1;
      const cost = Math.ceil(baseCost * editMultiplier);

      await assertHasCredits(userId, cost);

      // Create database record for image edit
      const { data: imageId, error: dbError } = await supabaseAdmin.rpc('create_image_generation', {
        p_user_id: userId,
        p_prompt: body.prompt,
        p_negative_prompt: body.negative_prompt,
        p_model: 'image-edit',
        p_quality: 'standard',
        p_width: null,
        p_height: null,
        p_credits_used: cost,
        p_job_id: null,
        p_is_public: true,
      });

      if (dbError) throw new Error(`Failed to create image edit record: ${dbError.message}`);

      // Enqueue image edit job
      const job = await queues[QueueNames.IMAGE].add(
        'edit-image',
        {
          userId,
          imageId,
          imageUrl: body.image_url,
          prompt: body.prompt,
          negativePrompt: body.negative_prompt,
          editType: body.edit_type,
          maskUrl: body.mask_url,
          strength: body.strength,
          guidanceScale: body.guidance_scale,
          steps: body.steps,
          metadata: {
            ...(body.metadata || {}),
            editType: body.edit_type,
          },
        },
        {
          removeOnComplete: 200,
          removeOnFail: 1000,
          priority: 2,
          jobId: imageId,
        }
      );

      await deductCredits(userId, cost, { type: 'image_edit', jobId: job.id, imageId, editType: body.edit_type });

      res.status(202).json({
        status: 'queued',
        jobId: job.id,
        queue: QueueNames.IMAGE,
        editType: body.edit_type,
        cost,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      res.status(status).json({
        code: error?.code || 'IMAGE_EDIT_ERROR',
        message: error?.message || 'Failed to queue image edit',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/generate/video/text-to-video - Generate video from text
router.post(
  '/video/text-to-video',
  authenticateUser,
  validateBody(TextToVideoBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as z.infer<typeof TextToVideoBody>;
    const userId = req.user!.id;

    try {
      // Calculate cost based on duration and quality
      const baseCost = 5;
      const durationMultiplier = body.duration_seconds / 5;
      const qualityMultiplier = body.quality === 'high' ? 2 : body.quality === 'standard' ? 1.5 : 1;
      const cost = Math.ceil(baseCost * durationMultiplier * qualityMultiplier);

      await assertHasCredits(userId, cost);

      const { data: videoId, error: dbError } = await supabaseAdmin.rpc('create_video_generation', {
        p_user_id: userId,
        p_prompt: body.prompt,
        p_negative_prompt: body.negative_prompt,
        p_generation_type: 'text_to_video',
        p_input_data: { model: body.model, aspect_ratio: body.aspect_ratio, motion_strength: body.motion_strength },
        p_duration_seconds: body.duration_seconds,
        p_width: body.aspect_ratio === '16:9' ? 1920 : body.aspect_ratio === '9:16' ? 1080 : 1024,
        p_height: body.aspect_ratio === '16:9' ? 1080 : body.aspect_ratio === '9:16' ? 1920 : 1024,
        p_fps: 24,
        p_credits_used: cost,
        p_job_id: null,
        p_is_public: true,
      });

      if (dbError) throw new Error(`Failed to create video record: ${dbError.message}`);

      const job = await queues[QueueNames.VIDEO].add(
        'generate-text-to-video',
        {
          userId,
          videoId,
          prompt: body.prompt,
          negativePrompt: body.negative_prompt,
          model: body.model,
          durationSeconds: body.duration_seconds,
          aspectRatio: body.aspect_ratio,
          quality: body.quality,
          motionStrength: body.motion_strength,
          metadata: body.metadata || {},
        },
        {
          removeOnComplete: 200,
          removeOnFail: 1000,
          priority: 2,
          jobId: videoId,
        }
      );

      await deductCredits(userId, cost, { type: 'text_to_video', jobId: job.id, videoId, model: body.model });

      res.status(202).json({
        status: 'queued',
        jobId: job.id,
        queue: QueueNames.VIDEO,
        generationType: 'text_to_video',
        cost,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      res.status(status).json({
        code: error?.code || 'TEXT_TO_VIDEO_ERROR',
        message: error?.message || 'Failed to queue text-to-video generation',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/generate/video/image-to-video - Animate image to video
router.post(
  '/video/image-to-video',
  authenticateUser,
  validateBody(ImageToVideoBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as z.infer<typeof ImageToVideoBody>;
    const userId = req.user!.id;

    try {
      const baseCost = 8;
      const durationMultiplier = body.duration_seconds / 5;
      const qualityMultiplier = body.quality === 'high' ? 2 : body.quality === 'standard' ? 1.5 : 1;
      const cost = Math.ceil(baseCost * durationMultiplier * qualityMultiplier);

      await assertHasCredits(userId, cost);

      const { data: videoId, error: dbError } = await supabaseAdmin.rpc('create_video_generation', {
        p_user_id: userId,
        p_prompt: body.prompt || 'Animate this image',
        p_negative_prompt: body.negative_prompt,
        p_generation_type: 'image_to_video',
        p_input_data: { 
          init_image_url: body.init_image_url, 
          model: body.model, 
          aspect_ratio: body.aspect_ratio, 
          motion_strength: body.motion_strength 
        },
        p_duration_seconds: body.duration_seconds,
        p_width: body.aspect_ratio === '16:9' ? 1920 : body.aspect_ratio === '9:16' ? 1080 : 1024,
        p_height: body.aspect_ratio === '16:9' ? 1080 : body.aspect_ratio === '9:16' ? 1920 : 1024,
        p_fps: 24,
        p_credits_used: cost,
        p_job_id: null,
        p_is_public: true,
      });

      if (dbError) throw new Error(`Failed to create video record: ${dbError.message}`);

      const job = await queues[QueueNames.VIDEO].add(
        'generate-image-to-video',
        {
          userId,
          videoId,
          initImageUrl: body.init_image_url,
          prompt: body.prompt,
          negativePrompt: body.negative_prompt,
          model: body.model,
          durationSeconds: body.duration_seconds,
          motionStrength: body.motion_strength,
          aspectRatio: body.aspect_ratio,
          quality: body.quality,
          metadata: body.metadata || {},
        },
        {
          removeOnComplete: 200,
          removeOnFail: 1000,
          priority: 2,
          jobId: videoId,
        }
      );

      await deductCredits(userId, cost, { type: 'image_to_video', jobId: job.id, videoId, model: body.model });

      res.status(202).json({
        status: 'queued',
        jobId: job.id,
        queue: QueueNames.VIDEO,
        generationType: 'image_to_video',
        cost,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      res.status(status).json({
        code: error?.code || 'IMAGE_TO_VIDEO_ERROR',
        message: error?.message || 'Failed to queue image-to-video generation',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/generate/video/frame-interpolation - Generate video from first and last frames
router.post(
  '/video/frame-interpolation',
  authenticateUser,
  validateBody(FrameInterpolationBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as z.infer<typeof FrameInterpolationBody>;
    const userId = req.user!.id;

    try {
      const baseCost = 10;
      const durationMultiplier = body.duration_seconds / 5;
      const qualityMultiplier = body.quality === 'high' ? 2 : body.quality === 'standard' ? 1.5 : 1;
      const cost = Math.ceil(baseCost * durationMultiplier * qualityMultiplier);

      await assertHasCredits(userId, cost);

      const { data: videoId, error: dbError } = await supabaseAdmin.rpc('create_video_generation', {
        p_user_id: userId,
        p_prompt: 'Frame interpolation video',
        p_negative_prompt: null,
        p_generation_type: 'keyframe',
        p_input_data: { 
          first_frame_url: body.first_frame_url, 
          last_frame_url: body.last_frame_url,
          interpolation_method: body.interpolation_method
        },
        p_duration_seconds: body.duration_seconds,
        p_width: 1024,
        p_height: 1024,
        p_fps: body.fps,
        p_credits_used: cost,
        p_job_id: null,
        p_is_public: true,
      });

      if (dbError) throw new Error(`Failed to create video record: ${dbError.message}`);

      const job = await queues[QueueNames.VIDEO].add(
        'generate-frame-interpolation',
        {
          userId,
          videoId,
          firstFrameUrl: body.first_frame_url,
          lastFrameUrl: body.last_frame_url,
          durationSeconds: body.duration_seconds,
          fps: body.fps,
          interpolationMethod: body.interpolation_method,
          quality: body.quality,
          metadata: body.metadata || {},
        },
        {
          removeOnComplete: 200,
          removeOnFail: 1000,
          priority: 2,
          jobId: videoId,
        }
      );

      await deductCredits(userId, cost, { type: 'frame_interpolation', jobId: job.id, videoId });

      res.status(202).json({
        status: 'queued',
        jobId: job.id,
        queue: QueueNames.VIDEO,
        generationType: 'frame_interpolation',
        cost,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      res.status(status).json({
        code: error?.code || 'FRAME_INTERPOLATION_ERROR',
        message: error?.message || 'Failed to queue frame interpolation',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/generate/history - Get user's generation history
router.get(
  '/history',
  authenticateUser,
  validateQuery(z.object({
    content_type: z.enum(['video', 'image', 'all']).default('all'),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'all']).default('all'),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    const { content_type, status, limit, offset } = req.query as any;
    const userId = req.user!.id;

    try {
      const { data: generations, error } = await supabaseAdmin.rpc('get_user_generations', {
        p_user_id: userId,
        p_content_type: content_type,
        p_status: status,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      res.json({
        status: 'ok',
        generations: generations || [],
        pagination: {
          limit,
          offset,
          total: generations?.length || 0,
          hasMore: (generations?.length || 0) === limit,
        },
        filters: {
          content_type,
          status,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'HISTORY_FETCH_ERROR',
        message: error?.message || 'Failed to fetch generation history',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/generate/models - Get available AI models
router.get(
  '/models',
  async (_req: Request, res: Response) => {
    try {
      const models = {
        image: [
          {
            id: 'sdxl',
            name: 'Stable Diffusion XL',
            description: 'High quality, versatile image generation',
            speed: 'fast',
            credits_per_image: 2,
            max_resolution: '1024x1024',
            features: ['text_to_image', 'image_to_image', 'inpainting'],
          },
          {
            id: 'flux',
            name: 'FLUX',
            description: 'Ultra realistic image generation',
            speed: 'medium',
            credits_per_image: 4,
            max_resolution: '1024x1024',
            features: ['text_to_image', 'image_to_image'],
          },
          {
            id: 'midjourney',
            name: 'Midjourney',
            description: 'Artistic and creative image generation',
            speed: 'slow',
            credits_per_image: 6,
            max_resolution: '1024x1024',
            features: ['text_to_image'],
          },
          {
            id: 'dalle3',
            name: 'DALL-E 3',
            description: 'Best text understanding and prompt adherence',
            speed: 'fast',
            credits_per_image: 5,
            max_resolution: '1024x1024',
            features: ['text_to_image'],
          },
        ],
        video: [
          {
            id: 'runwayml-gen3',
            name: 'RunwayML Gen-3',
            description: 'Latest generation video model with superior quality',
            speed: 'fast',
            credits_per_second: 2,
            max_duration: 15,
            max_resolution: '1920x1080',
            features: ['text_to_video', 'image_to_video'],
          },
          {
            id: 'pika-labs',
            name: 'Pika Labs',
            description: 'Great for creative and artistic videos',
            speed: 'medium',
            credits_per_second: 1.5,
            max_duration: 10,
            max_resolution: '1280x720',
            features: ['text_to_video', 'image_to_video'],
          },
          {
            id: 'stable-video-diffusion',
            name: 'Stable Video Diffusion',
            description: 'Open source model with good results',
            speed: 'slow',
            credits_per_second: 1,
            max_duration: 8,
            max_resolution: '1024x576',
            features: ['image_to_video'],
          },
          {
            id: 'zeroscope',
            name: 'Zeroscope',
            description: 'Optimized for text-to-video generation',
            speed: 'fast',
            credits_per_second: 1.2,
            max_duration: 12,
            max_resolution: '1024x576',
            features: ['text_to_video'],
          },
        ],
        training: [
          {
            id: 'sdxl-lora',
            name: 'SDXL LoRA Training',
            description: 'Train custom LoRA models on SDXL base',
            training_time_minutes: 30,
            credits_per_step: 0.02,
            min_images: 10,
            max_images: 30,
            supported_steps: [600, 1200, 2000],
          },
        ],
      };

      res.json({
        status: 'ok',
        models,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'MODELS_FETCH_ERROR',
        message: error?.message || 'Failed to fetch available models',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;