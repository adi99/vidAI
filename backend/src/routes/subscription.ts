import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { supabaseAdmin } from '../config/database';

// Schemas
const SubscriptionManageBody = z.object({
  action: z.enum(['subscribe', 'upgrade', 'downgrade', 'cancel', 'reactivate']),
  plan_id: z.string().min(1),
  receipt_data: z.string().min(1).optional(),
  platform: z.enum(['ios', 'android']).optional(),
  transaction_id: z.string().min(1).optional(),
});

const router = Router();

// GET /api/subscription/plans - Get available subscription plans
router.get(
  '/plans',
  async (_req, res: Response) => {
    try {
      const plans = [
        {
          id: 'basic',
          name: 'Basic',
          price_monthly: 0,
          price_yearly: 0,
          currency: 'USD',
          credits_per_month: 50,
          features: [
            '50 credits per month',
            'Basic AI models',
            'Standard quality',
            'Community support',
          ],
          limits: {
            videos_per_month: 10,
            images_per_month: 50,
            max_video_duration: 5,
            training_models: 0,
          },
          popular: false,
        },
        {
          id: 'pro',
          name: 'Pro',
          price_monthly: 9.99,
          price_yearly: 99.99,
          currency: 'USD',
          credits_per_month: 500,
          features: [
            '500 credits per month',
            'All AI models',
            'High quality generation',
            'Priority support',
            'Commercial license',
          ],
          limits: {
            videos_per_month: 100,
            images_per_month: 500,
            max_video_duration: 15,
            training_models: 3,
          },
          popular: true,
        },
        {
          id: 'premium',
          name: 'Premium',
          price_monthly: 19.99,
          price_yearly: 199.99,
          currency: 'USD',
          credits_per_month: 1200,
          features: [
            '1200 credits per month',
            'All AI models',
            'Premium quality',
            'Priority support',
            'Commercial license',
            'API access',
            'White-label options',
          ],
          limits: {
            videos_per_month: -1, // unlimited
            images_per_month: -1, // unlimited
            max_video_duration: 30,
            training_models: 10,
          },
          popular: false,
        },
      ];

      res.json({
        status: 'ok',
        plans,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'PLANS_FETCH_ERROR',
        message: error?.message || 'Failed to fetch subscription plans',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/subscription/status - Get user's subscription status
router.get(
  '/status',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      const { data: subscription, error } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
          id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          credits_remaining,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Get user's current credit balance
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const isSubscribed = !!subscription;
      const currentPlan = subscription?.plan_id || 'basic';

      res.json({
        status: 'ok',
        subscription: {
          isActive: isSubscribed,
          planId: currentPlan,
          status: subscription?.status || 'inactive',
          currentPeriodStart: subscription?.current_period_start,
          currentPeriodEnd: subscription?.current_period_end,
          cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
          creditsRemaining: subscription?.credits_remaining || 0,
          totalCredits: user.credits,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'SUBSCRIPTION_STATUS_ERROR',
        message: error?.message || 'Failed to fetch subscription status',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/subscription/manage - Manage subscription (subscribe, upgrade, cancel, etc.)
router.post(
  '/manage',
  authenticateUser,
  validateBody(SubscriptionManageBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof SubscriptionManageBody>;
    const userId = req.user!.id;

    try {
      const { action, plan_id } = body;

      // Validate plan exists
      const validPlans = ['basic', 'pro', 'premium'];
      if (!validPlans.includes(plan_id)) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_PLAN',
          message: 'Invalid subscription plan ID',
          timestamp: new Date().toISOString(),
        });
      }

      // Get current subscription
      const { data: currentSub, error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      let result: any = {};

      switch (action) {
        case 'subscribe':
          if (currentSub) {
            return res.status(409).json({
              status: 'error',
              code: 'ALREADY_SUBSCRIBED',
              message: 'User already has an active subscription',
              timestamp: new Date().toISOString(),
            });
          }

          // Create new subscription
          const periodStart = new Date();
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          const { data: newSub, error: createError } = await supabaseAdmin
            .from('user_subscriptions')
            .insert({
              user_id: userId,
              plan_id,
              status: 'active',
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              cancel_at_period_end: false,
              credits_remaining: plan_id === 'pro' ? 500 : plan_id === 'premium' ? 1200 : 50,
            })
            .select()
            .single();

          if (createError) throw createError;

          // Add initial credits
          const initialCredits = plan_id === 'pro' ? 500 : plan_id === 'premium' ? 1200 : 50;
          await supabaseAdmin.rpc('add_credits', {
            p_user_id: userId,
            p_amount: initialCredits,
            p_meta: {
              type: 'subscription',
              plan_id,
              action: 'subscribe',
            },
          });

          result = {
            action: 'subscribed',
            subscription: newSub,
            creditsAdded: initialCredits,
          };
          break;

        case 'upgrade':
        case 'downgrade':
          if (!currentSub) {
            return res.status(404).json({
              status: 'error',
              code: 'NO_SUBSCRIPTION',
              message: 'No active subscription found',
              timestamp: new Date().toISOString(),
            });
          }

          // Update subscription plan
          const { data: updatedSub, error: updateError } = await supabaseAdmin
            .from('user_subscriptions')
            .update({
              plan_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSub.id)
            .select()
            .single();

          if (updateError) throw updateError;

          result = {
            action,
            subscription: updatedSub,
            previousPlan: currentSub.plan_id,
            newPlan: plan_id,
          };
          break;

        case 'cancel':
          if (!currentSub) {
            return res.status(404).json({
              status: 'error',
              code: 'NO_SUBSCRIPTION',
              message: 'No active subscription found',
              timestamp: new Date().toISOString(),
            });
          }

          // Mark for cancellation at period end
          const { data: cancelledSub, error: cancelError } = await supabaseAdmin
            .from('user_subscriptions')
            .update({
              cancel_at_period_end: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSub.id)
            .select()
            .single();

          if (cancelError) throw cancelError;

          result = {
            action: 'cancelled',
            subscription: cancelledSub,
            effectiveDate: currentSub.current_period_end,
          };
          break;

        case 'reactivate':
          if (!currentSub) {
            return res.status(404).json({
              status: 'error',
              code: 'NO_SUBSCRIPTION',
              message: 'No active subscription found',
              timestamp: new Date().toISOString(),
            });
          }

          // Reactivate subscription
          const { data: reactivatedSub, error: reactivateError } = await supabaseAdmin
            .from('user_subscriptions')
            .update({
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSub.id)
            .select()
            .single();

          if (reactivateError) throw reactivateError;

          result = {
            action: 'reactivated',
            subscription: reactivatedSub,
          };
          break;

        default:
          return res.status(400).json({
            status: 'error',
            code: 'INVALID_ACTION',
            message: 'Invalid subscription action',
            timestamp: new Date().toISOString(),
          });
      }

      res.json({
        status: 'success',
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'SUBSCRIPTION_MANAGE_ERROR',
        message: error?.message || 'Failed to manage subscription',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/subscription/usage - Get current period usage
router.get(
  '/usage',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      // Get current subscription
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      const currentPeriodStart = subscription?.current_period_start || 
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Get usage for current period
      const [videoUsage, imageUsage, trainingUsage] = await Promise.all([
        supabaseAdmin
          .from('videos')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .gte('created_at', currentPeriodStart),
        supabaseAdmin
          .from('images')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .gte('created_at', currentPeriodStart),
        supabaseAdmin
          .from('training_jobs')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .gte('created_at', currentPeriodStart),
      ]);

      const planId = subscription?.plan_id || 'basic';
      const limits = {
        basic: { videos: 10, images: 50, training: 0 },
        pro: { videos: 100, images: 500, training: 3 },
        premium: { videos: -1, images: -1, training: 10 },
      };

      const currentLimits = limits[planId as keyof typeof limits];

      res.json({
        status: 'ok',
        usage: {
          currentPeriod: {
            start: currentPeriodStart,
            end: subscription?.current_period_end,
          },
          videos: {
            used: videoUsage.count || 0,
            limit: currentLimits.videos,
            unlimited: currentLimits.videos === -1,
          },
          images: {
            used: imageUsage.count || 0,
            limit: currentLimits.images,
            unlimited: currentLimits.images === -1,
          },
          training: {
            used: trainingUsage.count || 0,
            limit: currentLimits.training,
            unlimited: currentLimits.training === -1,
          },
          creditsRemaining: subscription?.credits_remaining || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'USAGE_FETCH_ERROR',
        message: error?.message || 'Failed to fetch subscription usage',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;