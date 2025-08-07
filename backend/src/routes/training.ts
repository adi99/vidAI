import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { queues, QueueNames } from '../queues';
import { supabaseAdmin } from '../config/database';
// TrainingJobSchema is defined inline below

// Additional schemas specific to training endpoints
const ImageUploadBody = z.object({
    images: z.array(z.object({
        url: z.string().url(),
        filename: z.string().min(1),
        size: z.number().positive(),
        format: z.enum(['jpg', 'jpeg', 'png', 'webp']),
    })).min(10).max(30),
    model_name: z.string().min(1).max(100),
});

const TrainingStartBody = z.object({
    model_name: z.string().min(1).max(100),
    steps: z.union([z.literal(600), z.literal(1200), z.literal(2000)]),
    training_images: z.array(z.string().url()).min(10).max(30),
    metadata: z.record(z.any()).optional(),
});

const JobIdParams = z.object({
    jobId: z.string().min(1),
});

// Credit costs for training based on steps
const TRAINING_COSTS = {
    600: 10,   // Basic training
    1200: 20,  // Standard training  
    2000: 35,  // High quality training
};

// Helper functions for credit management (reused from generation.ts)
async function assertHasCredits(userId: string, cost: number) {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();

    if (error) throw new Error(`Failed to fetch credits: ${error.message}`);

    const credits = Number((data as any)?.credits ?? 0);
    if (credits < cost) {
        const err: any = new Error('Insufficient credits');
        err.statusCode = 402;
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }
}

async function deductCredits(userId: string, cost: number, meta: Record<string, any>) {
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

// POST /api/train/upload - Handle image upload for training
router.post(
    '/upload',
    authenticateUser,
    validateBody(ImageUploadBody),
    async (req: AuthenticatedRequest, res: Response) => {
        const body = req.body as z.infer<typeof ImageUploadBody>;
        const userId = req.user!.id;

        try {
            // Validate image requirements
            const imageCount = body.images.length;
            if (imageCount < 10 || imageCount > 30) {
                return res.status(400).json({
                    code: 'INVALID_IMAGE_COUNT',
                    message: `Training requires 10-30 images, received ${imageCount}`,
                    timestamp: new Date().toISOString(),
                });
            }

            // Check for duplicate model name
            const { data: existingModel } = await supabaseAdmin
                .from('training_jobs')
                .select('id')
                .eq('user_id', userId)
                .eq('model_name', body.model_name)
                .eq('status', 'completed')
                .single();

            if (existingModel) {
                return res.status(409).json({
                    code: 'MODEL_NAME_EXISTS',
                    message: 'A trained model with this name already exists',
                    timestamp: new Date().toISOString(),
                });
            }

            // In a real implementation, you might store upload session in Redis or database
            // For now, we'll return the session data for the client to use in /start
            return res.status(200).json({
                status: 'uploaded',
                sessionId: `upload_${userId}_${Date.now()}`,
                modelName: body.model_name,
                imageCount: imageCount,
                images: body.images,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            const status = error?.statusCode || 500;
            return res.status(status).json({
                code: error?.code || 'UPLOAD_ERROR',
                message: error?.message || 'Failed to process image upload',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// POST /api/train/start - Start LoRA training job
router.post(
    '/start',
    authenticateUser,
    validateBody(TrainingStartBody),
    async (req: AuthenticatedRequest, res: Response) => {
        const body = req.body as z.infer<typeof TrainingStartBody>;
        const userId = req.user!.id;

        try {
            const cost = TRAINING_COSTS[body.steps];

            // Check credits before starting training
            await assertHasCredits(userId, cost);

            // Check for duplicate model name
            const { data: existingModel } = await supabaseAdmin
                .from('training_jobs')
                .select('id')
                .eq('user_id', userId)
                .eq('model_name', body.model_name)
                .eq('status', 'completed')
                .single();

            if (existingModel) {
                return res.status(409).json({
                    code: 'MODEL_NAME_EXISTS',
                    message: 'A trained model with this name already exists',
                    timestamp: new Date().toISOString(),
                });
            }

            // Create training job record in database
            const { data: trainingJob, error: dbError } = await supabaseAdmin
                .from('training_jobs')
                .insert({
                    user_id: userId,
                    model_name: body.model_name,
                    training_images: body.training_images,
                    steps: body.steps,
                    status: 'pending',
                    progress: 0,
                    credits_used: cost,
                })
                .select()
                .single();

            if (dbError) {
                throw new Error(`Failed to create training job: ${dbError.message}`);
            }

            // Enqueue training job
            const job = await queues[QueueNames.TRAINING].add(
                'train-lora-model',
                {
                    userId,
                    trainingJobId: trainingJob.id,
                    modelName: body.model_name,
                    trainingImages: body.training_images,
                    steps: body.steps,
                    metadata: {
                        ...(body.metadata || {}),
                        cost,
                    },
                },
                {
                    removeOnComplete: 50,
                    removeOnFail: 500,
                    priority: 1, // Lower priority than generation
                    jobId: trainingJob.id, // Use database ID as job ID for easy lookup
                }
            );

            // Deduct credits upon successful enqueue
            await deductCredits(userId, cost, {
                type: 'model_training',
                jobId: job.id,
                modelName: body.model_name,
                steps: body.steps,
            });

            return res.status(202).json({
                status: 'queued',
                jobId: job.id,
                trainingJobId: trainingJob.id,
                queue: QueueNames.TRAINING,
                modelName: body.model_name,
                steps: body.steps,
                cost,
                estimatedDuration: `${Math.ceil(body.steps / 10)} minutes`,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            const status = error?.statusCode || 500;
            return res.status(status).json({
                code: error?.code || 'TRAINING_START_ERROR',
                message: error?.message || 'Failed to start training job',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// GET /api/train/:jobId - Get training job status and progress
router.get(
    '/:jobId',
    authenticateUser,
    validateParams(JobIdParams),
    async (req: AuthenticatedRequest, res: Response) => {
        const { jobId } = req.params as z.infer<typeof JobIdParams>;
        const userId = req.user!.id;

        try {
            // First check database for training job
            const { data: trainingJob, error: dbError } = await supabaseAdmin
                .from('training_jobs')
                .select('*')
                .eq('id', jobId)
                .eq('user_id', userId) // Ensure user owns this job
                .single();

            if (dbError || !trainingJob) {
                return res.status(404).json({
                    status: 'not_found',
                    message: 'Training job not found',
                    jobId,
                    timestamp: new Date().toISOString(),
                });
            }

            // Get queue job status if still processing
            let queueStatus = null;
            if (['pending', 'processing'].includes(trainingJob.status)) {
                const job = await queues[QueueNames.TRAINING].getJob(jobId);
                if (job) {
                    const state = await job.getState();
                    const progress = job.progress;
                    queueStatus = { state, progress };
                }
            }

            return res.json({
                status: 'ok',
                jobId,
                trainingJob: {
                    id: trainingJob.id,
                    modelName: trainingJob.model_name,
                    status: trainingJob.status,
                    progress: trainingJob.progress,
                    steps: trainingJob.steps,
                    creditsUsed: trainingJob.credits_used,
                    trainedModelUrl: trainingJob.trained_model_url,
                    errorMessage: trainingJob.error_message,
                    createdAt: trainingJob.created_at,
                    completedAt: trainingJob.completed_at,
                },
                queueStatus,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            return res.status(500).json({
                status: 'error',
                code: 'TRAINING_STATUS_ERROR',
                message: error?.message || 'Failed to fetch training job status',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// GET /api/train/models - List user's trained models
router.get(
    '/models',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.id;

        try {
            const { data: models, error } = await supabaseAdmin
                .from('training_jobs')
                .select(`
          id,
          model_name,
          status,
          steps,
          credits_used,
          trained_model_url,
          created_at,
          completed_at
        `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(`Failed to fetch trained models: ${error.message}`);
            }

            const completedModels = models?.filter(m => m.status === 'completed') || [];
            const inProgressModels = models?.filter(m => ['pending', 'processing'].includes(m.status)) || [];
            const failedModels = models?.filter(m => m.status === 'failed') || [];

            return res.json({
                status: 'ok',
                models: {
                    completed: completedModels,
                    inProgress: inProgressModels,
                    failed: failedModels,
                },
                totalCount: models?.length || 0,
                completedCount: completedModels.length,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            return res.status(500).json({
                status: 'error',
                code: 'MODELS_FETCH_ERROR',
                message: error?.message || 'Failed to fetch trained models',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

export default router;