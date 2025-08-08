import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { supabaseAdmin } from '../config/database';
import { ReceiptValidationService } from '../services/receiptValidationService';
import { logger } from '../config/logger';

// Schemas
const SubscriptionManageBody = z.object({
  action: z.enum(['subscribe', 'upgrade', 'downgrade', 'cancel', 'reactivate']),
  plan_id: z.string().min(1),
  receipt_data: z.string().min(1).optional(),
  platform: z.enum(['ios', 'android']).optional(),
  transaction_id: z.string().min(1).optional(),
});

const SubscriptionValidateBody = z.object({
  transaction_id: z.string().min(1),
  plan_id: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  receipt_data: z.string().min(1),
});

const router = Router();

// GET /api/subscription/plans - Get available subscription plans
router.get(
  '/plans',
  async (_req, res: Response) => {
    try {
      const plans = [
        {
          id: 'premium_monthly',
          name: 'Premium Monthly',
          price_monthly: 9.99,
          price_yearly: null,
          currency: 'USD',
          credits_per_month: 1000,
          period: 'monthly',
          features: [
            '1,000 credits per month',
            'Priority generation queue',
            'Advanced AI models',
            'HD video generation',
            'Custom model training',
            'No watermarks',
          ],
          limits: {
            videos_per_month: 100,
            images_per_month: 1000,
            max_video_duration: 30,
            training_models: 5,
          },
          popular: false,
        },
        {
          id: 'premium_yearly',
          name: 'Premium Yearly',
          price_monthly: null,
          price_yearly: 99.99,
          currency: 'USD',
          credits_per_month: 1250, // 15000 / 12
          period: 'yearly',
          features: [
            '15,000 credits per year',
            'Priority generation queue',
            'Advanced AI models',
            'HD video generation',
            'Custom model training',
            'No watermarks',
            'Early access to new features',
          ],
          limits: {
            videos_per_month: 150,
            images_per_month: 1500,
            max_video_duration: 30,
            training_models: 5,
          },
          popular: true,
          savings: 'Save 17% vs monthly',
        },
        {
          id: 'pro_monthly',
          name: 'Pro Monthly',
          price_monthly: 19.99,
          price_yearly: null,
          currency: 'USD',
          credits_per_month: 2500,
          period: 'monthly',
          features: [
            '2,500 credits per month',
            'Highest priority queue',
            'All AI models',
            '4K video generation',
            'Unlimited model training',
            'No watermarks',
            'Commercial license',
            'Priority support',
          ],
          limits: {
            videos_per_month: -1, // unlimited
            images_per_month: -1, // unlimited
            max_video_duration: 60,
            training_models: -1, // unlimited
          },
          popular: false,
        },
        {
          id: 'pro_yearly',
          name: 'Pro Yearly',
          price_monthly: null,
          price_yearly: 199.99,
          currency: 'USD',
          credits_per_month: 2917, // 35000 / 12
          period: 'yearly',
          features: [
            '35,000 credits per year',
            'Highest priority queue',
            'All AI models',
            '4K video generation',
            'Unlimited model training',
            'No watermarks',
            'Commercial license',
            'Priority support',
            'API access',
          ],
          limits: {
            videos_per_month: -1, // unlimited
            images_per_month: -1, // unlimited
            max_video_duration: 60,
            training_models: -1, // unlimited
          },
          popular: false,
          savings: 'Save 17% vs monthly',
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

// POST /api/subscription/validate - Validate subscription purchase
router.post(
  '/validate',
  authenticateUser,
  validateBody(SubscriptionValidateBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof SubscriptionValidateBody>;
    const userId = req.user!.id;

    try {
      logger.info('Validating subscription purchase', {
        userId,
        planId: body.plan_id,
        platform: body.platform,
        transactionId: body.transaction_id,
      });

      // Define subscription plans
      const plans = {
        'premium_monthly': { credits: 1000, price_usd: 9.99, period: 'monthly' },
        'premium_yearly': { credits: 15000, price_usd: 99.99, period: 'yearly' },
        'pro_monthly': { credits: 2500, price_usd: 19.99, period: 'monthly' },
        'pro_yearly': { credits: 35000, price_usd: 199.99, period: 'yearly' },
      };

      const planInfo = plans[body.plan_id as keyof typeof plans];
      if (!planInfo) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_PLAN',
          message: 'Invalid subscription plan ID',
          timestamp: new Date().toISOString(),
        });
      }

      // Check if transaction has already been processed
      const isProcessed = await ReceiptValidationService.isTransactionProcessed(body.transaction_id);
      if (isProcessed) {
        return res.status(409).json({
          status: 'error',
          code: 'DUPLICATE_TRANSACTION',
          message: 'This transaction has already been processed',
          timestamp: new Date().toISOString(),
        });
      }

      // Validate receipt with platform-specific validation
      let validationResult;
      if (body.platform === 'ios') {
        validationResult = await ReceiptValidationService.validateIOSReceipt({
          receiptData: body.receipt_data,
          productId: body.plan_id,
        });
      } else if (body.platform === 'android') {
        const receiptData = JSON.parse(body.receipt_data || '{}');
        validationResult = await ReceiptValidationService.validateAndroidReceipt({
          packageName: receiptData.packageName || process.env.ANDROID_PACKAGE_NAME || 'com.yourapp.package',
          productToken: receiptData.purchaseToken || body.transaction_id,
          productId: body.plan_id,
          isSub: true, // This is a subscription
        });
      } else {
        return res.status(400).json({
          status: 'error',
          code: 'UNSUPPORTED_PLATFORM',
          message: 'Platform not supported',
          timestamp: new Date().toISOString(),
        });
      }

      if (!validationResult.isValid) {
        logger.warn('Subscription receipt validation failed', {
          userId,
          transactionId: body.transaction_id,
          error: validationResult.error,
        });

        return res.status(400).json({
          status: 'error',
          code: 'INVALID_RECEIPT',
          message: ReceiptValidationService.getValidationErrorMessage(validationResult.error || 'Unknown error'),
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('Subscription receipt validation successful', {
        userId,
        transactionId: body.transaction_id,
        platform: body.platform,
      });

      // Calculate subscription period
      const periodStart = new Date();
      const periodEnd = new Date();
      if (planInfo.period === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Store subscription record
      const { data: subscription, error: subscriptionError } = await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan_id: body.plan_id,
          status: 'active',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          credits_remaining: planInfo.credits,
          transaction_id: body.transaction_id,
          platform: body.platform,
          receipt_data: body.receipt_data,
          validation_result: validationResult,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (subscriptionError) throw subscriptionError;

      // Store receipt record
      await supabaseAdmin
        .from('iap_receipts')
        .insert({
          user_id: userId,
          transaction_id: body.transaction_id,
          package_id: body.plan_id,
          platform: body.platform,
          receipt_data: body.receipt_data,
          credits_purchased: planInfo.credits,
          price_usd: planInfo.price_usd,
          status: 'verified',
          validation_result: validationResult,
          processed_at: new Date().toISOString(),
        });

      // Add initial subscription credits
      await supabaseAdmin.rpc('add_credits', {
        p_user_id: userId,
        p_amount: planInfo.credits,
        p_meta: {
          type: 'subscription',
          plan_id: body.plan_id,
          transaction_id: body.transaction_id,
          platform: body.platform,
          period: planInfo.period,
        },
      });

      // Update user subscription status
      await supabaseAdmin
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_expires_at: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      logger.info('Subscription validation completed successfully', {
        userId,
        transactionId: body.transaction_id,
        planId: body.plan_id,
        creditsAdded: planInfo.credits,
      });

      res.json({
        status: 'success',
        subscription: {
          id: subscription.id,
          planId: body.plan_id,
          planName: planInfo.period === 'yearly' ? 
            body.plan_id.replace('_yearly', ' Yearly') : 
            body.plan_id.replace('_monthly', ' Monthly'),
          status: 'active',
          currentPeriodStart: periodStart.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          creditsAdded: planInfo.credits,
          validationResult: {
            platform: validationResult.platform,
            transactionId: validationResult.transactionId,
            purchaseDate: validationResult.purchaseDate,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Subscription validation failed', {
        userId,
        transactionId: body.transaction_id,
        error: error.message,
      });

      res.status(500).json({
        status: 'error',
        code: 'SUBSCRIPTION_VALIDATION_ERROR',
        message: error?.message || 'Failed to validate subscription',
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
        .select('credits, subscription_status, subscription_expires_at')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const isSubscribed = !!subscription && subscription.status === 'active';
      const currentPlan = subscription?.plan_id;

      // Check if subscription is expired
      const now = new Date();
      const expirationDate = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
      const isExpired = expirationDate && expirationDate < now;

      // Determine plan name
      let planName = null;
      if (currentPlan) {
        const planNames: { [key: string]: string } = {
          'premium_monthly': 'Premium Monthly',
          'premium_yearly': 'Premium Yearly',
          'pro_monthly': 'Pro Monthly',
          'pro_yearly': 'Pro Yearly',
        };
        planName = planNames[currentPlan] || currentPlan;
      }

      res.json({
        isActive: isSubscribed && !isExpired,
        planId: currentPlan,
        planName,
        expirationDate: subscription?.current_period_end,
        autoRenewing: subscription ? !subscription.cancel_at_period_end : false,
        inGracePeriod: false, // Would need additional logic to determine grace period
        creditsRemaining: subscription?.credits_remaining || 0,
        nextBillingDate: subscription?.current_period_end,
        status: subscription?.status || 'inactive',
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
        totalCredits: user.credits,
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
      const validPlans = ['premium_monthly', 'premium_yearly', 'pro_monthly', 'pro_yearly'];
      if (action !== 'cancel' && action !== 'reactivate' && !validPlans.includes(plan_id)) {
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

          // Add initial credits based on plan
          const planCredits: { [key: string]: number } = {
            'premium_monthly': 1000,
            'premium_yearly': 15000,
            'pro_monthly': 2500,
            'pro_yearly': 35000,
          };
          
          const initialCredits = planCredits[plan_id] || 0;
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

      const planId = subscription?.plan_id || 'free';
      const limits = {
        free: { videos: 5, images: 20, training: 0 },
        premium_monthly: { videos: 100, images: 1000, training: 5 },
        premium_yearly: { videos: 150, images: 1500, training: 5 },
        pro_monthly: { videos: -1, images: -1, training: -1 },
        pro_yearly: { videos: -1, images: -1, training: -1 },
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

// GET /api/subscription/billing-history - Get user's billing history
router.get(
  '/billing-history',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      // Get subscription-related transactions
      const { data: transactions, error } = await supabaseAdmin
        .from('credit_transactions')
        .select(`
          id,
          amount,
          description,
          metadata,
          created_at
        `)
        .eq('user_id', userId)
        .eq('transaction_type', 'subscription')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get IAP receipts for subscription purchases
      const { data: receipts, error: receiptsError } = await supabaseAdmin
        .from('iap_receipts')
        .select(`
          id,
          transaction_id,
          package_id,
          price_usd,
          platform,
          status,
          processed_at,
          created_at
        `)
        .eq('user_id', userId)
        .eq('is_subscription', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (receiptsError) throw receiptsError;

      // Combine and format billing history
      const billingHistory = [
        ...(transactions || []).map(t => ({
          id: t.id,
          type: 'credit_allocation',
          date: t.created_at,
          amount: Math.abs(t.amount) * 0.01, // Rough conversion to dollars
          currency: 'USD',
          description: t.description,
          status: 'completed',
          metadata: t.metadata,
        })),
        ...(receipts || []).map(r => ({
          id: r.id,
          type: 'subscription_purchase',
          date: r.processed_at || r.created_at,
          amount: r.price_usd,
          currency: 'USD',
          description: `Subscription: ${r.package_id}`,
          status: r.status === 'verified' ? 'completed' : r.status,
          transactionId: r.transaction_id,
          platform: r.platform,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({
        status: 'ok',
        billingHistory: billingHistory.slice(0, 50), // Limit to 50 most recent
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'BILLING_HISTORY_ERROR',
        message: error?.message || 'Failed to fetch billing history',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/subscription/upgrade-options - Get available upgrade options
router.get(
  '/upgrade-options',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      // Get current subscription
      const { data: subscription, error } = await supabaseAdmin
        .from('user_subscriptions')
        .select('plan_id, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const currentPlan = subscription?.plan_id;
      const upgradeOptions = [];

      // Define upgrade paths
      if (currentPlan === 'premium_monthly') {
        upgradeOptions.push(
          {
            planId: 'premium_yearly',
            planName: 'Premium Yearly',
            price: 99.99,
            savings: 'Save 17% vs monthly',
            features: ['15,000 credits per year', 'Same features as monthly', 'Early access to new features'],
          },
          {
            planId: 'pro_monthly',
            planName: 'Pro Monthly',
            price: 19.99,
            features: ['2,500 credits per month', 'Highest priority queue', 'All AI models', '4K video generation', 'Commercial license', 'Priority support'],
          },
          {
            planId: 'pro_yearly',
            planName: 'Pro Yearly',
            price: 199.99,
            savings: 'Save 17% vs monthly',
            features: ['35,000 credits per year', 'All Pro features', 'API access'],
          }
        );
      } else if (currentPlan === 'premium_yearly') {
        upgradeOptions.push(
          {
            planId: 'pro_monthly',
            planName: 'Pro Monthly',
            price: 19.99,
            features: ['2,500 credits per month', 'Highest priority queue', 'All AI models', '4K video generation', 'Commercial license', 'Priority support'],
          },
          {
            planId: 'pro_yearly',
            planName: 'Pro Yearly',
            price: 199.99,
            savings: 'Save 17% vs monthly',
            features: ['35,000 credits per year', 'All Pro features', 'API access'],
          }
        );
      } else if (currentPlan === 'pro_monthly') {
        upgradeOptions.push({
          planId: 'pro_yearly',
          planName: 'Pro Yearly',
          price: 199.99,
          savings: 'Save 17% vs monthly',
          features: ['35,000 credits per year', 'Same features as monthly', 'API access'],
        });
      }

      res.json({
        status: 'ok',
        currentPlan,
        upgradeOptions,
        canUpgrade: upgradeOptions.length > 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'UPGRADE_OPTIONS_ERROR',
        message: error?.message || 'Failed to fetch upgrade options',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/subscription/expire - Handle subscription expiration (internal use)
router.post(
  '/expire',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      // Update expired subscriptions
      const { data: expiredSubs, error } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('status', 'active')
        .lt('current_period_end', new Date().toISOString())
        .select();

      if (error) throw error;

      // Update user subscription status
      if (expiredSubs && expiredSubs.length > 0) {
        await supabaseAdmin
          .from('users')
          .update({
            subscription_status: 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }

      res.json({
        status: 'ok',
        expiredSubscriptions: expiredSubs?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'EXPIRE_ERROR',
        message: error?.message || 'Failed to handle subscription expiration',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/subscription/limits - Get subscription limits for current plan
router.get(
  '/limits',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      // Get current subscription
      const { data: subscription, error } = await supabaseAdmin
        .from('user_subscriptions')
        .select('plan_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const planId = subscription?.plan_id || 'free';
      
      const planLimits: { [key: string]: any } = {
        free: {
          videos: { limit: 5, unlimited: false },
          images: { limit: 20, unlimited: false },
          training: { limit: 0, unlimited: false },
          maxVideoDuration: 10,
          features: ['Basic AI models', 'Standard quality', 'Community support'],
        },
        premium_monthly: {
          videos: { limit: 100, unlimited: false },
          images: { limit: 1000, unlimited: false },
          training: { limit: 5, unlimited: false },
          maxVideoDuration: 30,
          features: ['Advanced AI models', 'HD video generation', 'Priority queue', 'Custom model training', 'No watermarks'],
        },
        premium_yearly: {
          videos: { limit: 150, unlimited: false },
          images: { limit: 1500, unlimited: false },
          training: { limit: 5, unlimited: false },
          maxVideoDuration: 30,
          features: ['Advanced AI models', 'HD video generation', 'Priority queue', 'Custom model training', 'No watermarks', 'Early access'],
        },
        pro_monthly: {
          videos: { limit: -1, unlimited: true },
          images: { limit: -1, unlimited: true },
          training: { limit: -1, unlimited: true },
          maxVideoDuration: 60,
          features: ['All AI models', '4K video generation', 'Highest priority', 'Unlimited training', 'Commercial license', 'Priority support'],
        },
        pro_yearly: {
          videos: { limit: -1, unlimited: true },
          images: { limit: -1, unlimited: true },
          training: { limit: -1, unlimited: true },
          maxVideoDuration: 60,
          features: ['All AI models', '4K video generation', 'Highest priority', 'Unlimited training', 'Commercial license', 'Priority support', 'API access'],
        },
      };

      const limits = planLimits[planId] || planLimits.free;

      res.json({
        status: 'ok',
        planId,
        limits,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'LIMITS_ERROR',
        message: error?.message || 'Failed to fetch subscription limits',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;