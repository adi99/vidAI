import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { supabaseAdmin } from '../config/database';
import { ReceiptValidationService } from '../services/receiptValidationService';
import { logger } from '../config/logger';

// Schemas
const UserContentQuery = z.object({
    content_type: z.enum(['video', 'image', 'all']).default('all'),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'all']).default('all'),
    is_public: z.enum(['true', 'false', 'all']).default('all'),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    sort: z.enum(['recent', 'oldest', 'popular']).default('recent'),
});

const UserSettingsBody = z.object({
    notifications_enabled: z.boolean().optional(),
    email_notifications: z.boolean().optional(),
    push_notifications: z.boolean().optional(),
    privacy_profile: z.enum(['public', 'private']).optional(),
    privacy_content: z.enum(['public', 'private', 'followers_only']).optional(),
    language: z.string().min(2).max(5).optional(),
    timezone: z.string().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
});

const CreditsPurchaseBody = z.object({
    package_id: z.string().min(1),
    receipt_data: z.string().min(1),
    platform: z.enum(['ios', 'android']),
    transaction_id: z.string().min(1),
});

const CreditsHistoryQuery = z.object({
    transaction_type: z.enum(['purchase', 'deduction', 'refund', 'bonus', 'all']).default('all'),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
});

const router = Router();

// GET /api/user/content - Get user's generated content
router.get(
    '/content',
    authenticateUser,
    validateQuery(UserContentQuery),
    async (req: AuthenticatedRequest, res: Response) => {
        const query = req.query as unknown as z.infer<typeof UserContentQuery>;
        const userId = req.user!.id;

        try {
            let allContent: any[] = [];

            // Fetch videos if requested
            if (query.content_type === 'video' || query.content_type === 'all') {
                let videoQuery = supabaseAdmin
                    .from('videos')
                    .select(`
            id,
            prompt,
            video_url,
            thumbnail_url,
            status,
            is_public,
            likes_count,
            comments_count,
            shares_count,
            credits_used,
            created_at,
            completed_at
          `)
                    .eq('user_id', userId);

                if (query.status !== 'all') {
                    videoQuery = videoQuery.eq('status', query.status);
                }

                if (query.is_public !== 'all') {
                    videoQuery = videoQuery.eq('is_public', query.is_public === 'true');
                }

                const { data: videos, error: videoError } = await videoQuery;
                if (videoError) throw videoError;

                const videosWithType = videos?.map(v => ({ ...v, content_type: 'video' })) || [];
                allContent = [...allContent, ...videosWithType];
            }

            // Fetch images if requested
            if (query.content_type === 'image' || query.content_type === 'all') {
                let imageQuery = supabaseAdmin
                    .from('images')
                    .select(`
            id,
            prompt,
            image_url,
            thumbnail_url,
            status,
            is_public,
            likes_count,
            comments_count,
            shares_count,
            credits_used,
            created_at,
            completed_at
          `)
                    .eq('user_id', userId);

                if (query.status !== 'all') {
                    imageQuery = imageQuery.eq('status', query.status);
                }

                if (query.is_public !== 'all') {
                    imageQuery = imageQuery.eq('is_public', query.is_public === 'true');
                }

                const { data: images, error: imageError } = await imageQuery;
                if (imageError) throw imageError;

                const imagesWithType = images?.map(i => ({ ...i, content_type: 'image' })) || [];
                allContent = [...allContent, ...imagesWithType];
            }

            // Sort content
            if (query.sort === 'recent') {
                allContent.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            } else if (query.sort === 'oldest') {
                allContent.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            } else if (query.sort === 'popular') {
                allContent.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
            }

            // Apply pagination
            const paginatedContent = allContent.slice(query.offset, query.offset + query.limit);

            res.json({
                status: 'ok',
                content: paginatedContent,
                pagination: {
                    limit: query.limit,
                    offset: query.offset,
                    total: allContent.length,
                    hasMore: query.offset + query.limit < allContent.length,
                },
                filters: {
                    content_type: query.content_type,
                    status: query.status,
                    is_public: query.is_public,
                    sort: query.sort,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: 'error',
                code: 'USER_CONTENT_ERROR',
                message: error?.message || 'Failed to fetch user content',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// GET /api/user/settings - Get user settings
router.get(
    '/settings',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.id;

        try {
            const { data: settings, error } = await supabaseAdmin
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            // Return default settings if none exist
            const defaultSettings = {
                notifications_enabled: true,
                email_notifications: true,
                push_notifications: true,
                privacy_profile: 'public',
                privacy_content: 'public',
                language: 'en',
                timezone: 'UTC',
                theme: 'auto',
            };

            res.json({
                status: 'ok',
                settings: settings || defaultSettings,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: 'error',
                code: 'SETTINGS_FETCH_ERROR',
                message: error?.message || 'Failed to fetch user settings',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// POST /api/user/settings - Update user settings
router.post(
    '/settings',
    authenticateUser,
    validateBody(UserSettingsBody),
    async (req: AuthenticatedRequest, res: Response) => {
        const body = req.body as z.infer<typeof UserSettingsBody>;
        const userId = req.user!.id;

        try {
            // Upsert user settings
            const { data: settings, error } = await supabaseAdmin
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    ...body,
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'ok',
                settings,
                message: 'Settings updated successfully',
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: 'error',
                code: 'SETTINGS_UPDATE_ERROR',
                message: error?.message || 'Failed to update user settings',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// GET /api/user/credits/history - Get credit transaction history
router.get(
    '/credits/history',
    authenticateUser,
    validateQuery(CreditsHistoryQuery),
    async (req: AuthenticatedRequest, res: Response) => {
        const query = req.query as unknown as z.infer<typeof CreditsHistoryQuery>;
        const userId = req.user!.id;

        try {
            let historyQuery = supabaseAdmin
                .from('credit_transactions')
                .select(`
          id,
          transaction_type,
          amount,
          balance_after,
          description,
          metadata,
          created_at
        `)
                .eq('user_id', userId);

            if (query.transaction_type !== 'all') {
                historyQuery = historyQuery.eq('transaction_type', query.transaction_type);
            }

            if (query.start_date) {
                historyQuery = historyQuery.gte('created_at', query.start_date);
            }

            if (query.end_date) {
                historyQuery = historyQuery.lte('created_at', query.end_date);
            }

            historyQuery = historyQuery
                .order('created_at', { ascending: false })
                .range(query.offset, query.offset + query.limit - 1);

            const { data: transactions, error } = await historyQuery;
            if (error) throw error;

            // Get total count for pagination
            let countQuery = supabaseAdmin
                .from('credit_transactions')
                .select('id', { count: 'exact' })
                .eq('user_id', userId);

            if (query.transaction_type !== 'all') {
                countQuery = countQuery.eq('transaction_type', query.transaction_type);
            }

            if (query.start_date) {
                countQuery = countQuery.gte('created_at', query.start_date);
            }

            if (query.end_date) {
                countQuery = countQuery.lte('created_at', query.end_date);
            }

            const { count: totalCount, error: countError } = await countQuery;
            if (countError) throw countError;

            res.json({
                status: 'ok',
                transactions: transactions || [],
                pagination: {
                    limit: query.limit,
                    offset: query.offset,
                    total: totalCount || 0,
                    hasMore: query.offset + query.limit < (totalCount || 0),
                },
                filters: {
                    transaction_type: query.transaction_type,
                    start_date: query.start_date,
                    end_date: query.end_date,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: 'error',
                code: 'CREDITS_HISTORY_ERROR',
                message: error?.message || 'Failed to fetch credit history',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// POST /api/user/credits/purchase - Process credit purchase with receipt validation
router.post(
    '/credits/purchase',
    authenticateUser,
    validateBody(CreditsPurchaseBody),
    async (req: AuthenticatedRequest, res: Response): Promise<any> => {
        const body = req.body as z.infer<typeof CreditsPurchaseBody>;
        const userId = req.user!.id;

        try {
            logger.info('Processing credit purchase', {
                userId,
                packageId: body.package_id,
                platform: body.platform,
                transactionId: body.transaction_id,
            });

            // Define credit packages
            const packages = {
                'credits_100': { credits: 100, price_usd: 4.99 },
                'credits_500': { credits: 500, price_usd: 19.99 },
                'credits_1000': { credits: 1000, price_usd: 34.99 },
                'credits_2500': { credits: 2500, price_usd: 79.99 },
            };

            const packageInfo = packages[body.package_id as keyof typeof packages];
            if (!packageInfo) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_PACKAGE',
                    message: 'Invalid credit package ID',
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
                    productId: body.package_id,
                });
            } else if (body.platform === 'android') {
                // For Android, we need to extract additional parameters from the receipt data
                // In a real implementation, these would come from the client
                const receiptData = JSON.parse(body.receipt_data || '{}');
                validationResult = await ReceiptValidationService.validateAndroidReceipt({
                    packageName: receiptData.packageName || process.env.ANDROID_PACKAGE_NAME || 'com.yourapp.package',
                    productToken: receiptData.purchaseToken || body.transaction_id,
                    productId: body.package_id,
                    isSub: false,
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
                logger.warn('Receipt validation failed', {
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

            logger.info('Receipt validation successful', {
                userId,
                transactionId: body.transaction_id,
                platform: body.platform,
            });

            // Store receipt record
            const { error: receiptError } = await supabaseAdmin
                .from('iap_receipts')
                .insert({
                    user_id: userId,
                    transaction_id: body.transaction_id,
                    package_id: body.package_id,
                    platform: body.platform,
                    receipt_data: body.receipt_data,
                    credits_purchased: packageInfo.credits,
                    price_usd: packageInfo.price_usd,
                    status: 'verified',
                    validation_result: validationResult,
                    processed_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (receiptError) {
                if (receiptError.code === '23505') { // Duplicate transaction
                    return res.status(409).json({
                        status: 'error',
                        code: 'DUPLICATE_TRANSACTION',
                        message: 'This transaction has already been processed',
                        timestamp: new Date().toISOString(),
                    });
                }
                throw receiptError;
            }

            // Add credits to user account
            const { error: creditError } = await supabaseAdmin.rpc('add_credits', {
                p_user_id: userId,
                p_amount: packageInfo.credits,
                p_meta: {
                    type: 'purchase',
                    package_id: body.package_id,
                    transaction_id: body.transaction_id,
                    platform: body.platform,
                    validation_result: validationResult,
                },
            });

            if (creditError) {
                // Fallback: direct update
                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({
                        credits: (supabaseAdmin as any).sql`credits + ${packageInfo.credits}`
                    })
                    .eq('id', userId);

                if (updateError) throw updateError;

                // Create credit transaction record manually
                await supabaseAdmin
                    .from('credit_transactions')
                    .insert({
                        user_id: userId,
                        transaction_type: 'purchase',
                        amount: packageInfo.credits,
                        description: `Credit purchase: ${body.package_id}`,
                        metadata: {
                            package_id: body.package_id,
                            transaction_id: body.transaction_id,
                            platform: body.platform,
                        },
                    });
            }

            // Get updated credit balance
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('credits')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            logger.info('Credit purchase completed successfully', {
                userId,
                transactionId: body.transaction_id,
                creditsAdded: packageInfo.credits,
                newBalance: user.credits,
            });

            res.json({
                status: 'success',
                purchase: {
                    transactionId: body.transaction_id,
                    packageId: body.package_id,
                    creditsPurchased: packageInfo.credits,
                    priceUsd: packageInfo.price_usd,
                    newBalance: user.credits,
                    validationResult: {
                        platform: validationResult.platform,
                        transactionId: validationResult.transactionId,
                        purchaseDate: validationResult.purchaseDate,
                    },
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            logger.error('Credit purchase failed', {
                userId,
                transactionId: body.transaction_id,
                error: error.message,
            });

            res.status(500).json({
                status: 'error',
                code: 'PURCHASE_ERROR',
                message: error?.message || 'Failed to process credit purchase',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// GET /api/user/achievements - Get user achievements
router.get(
    '/achievements',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.id;

        try {
            // Get user statistics for achievement calculation
            const [userStats, contentStats] = await Promise.all([
                supabaseAdmin
                    .from('users')
                    .select('created_at, credits')
                    .eq('id', userId)
                    .single(),
                supabaseAdmin.rpc('get_user_content_stats', {
                    p_user_id: userId,
                }),
            ]);

            if (!userStats.data) {
                throw new Error('User not found');
            }

            // Calculate achievements based on user data
            const achievements = [];
            const joinDate = new Date(userStats.data.created_at);
            const now = new Date();
            const daysSinceJoin = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

            // Early Adopter - joined in first 30 days of app launch (assuming app launched Jan 1, 2024)
            const appLaunchDate = new Date('2024-01-01');
            const joinedWithinMonth = joinDate.getTime() - appLaunchDate.getTime() < 30 * 24 * 60 * 60 * 1000;
            if (joinedWithinMonth) {
                achievements.push({
                    id: 'early_adopter',
                    title: 'Early Adopter',
                    description: 'Joined in the first month',
                    icon: 'star',
                    unlockedAt: userStats.data.created_at,
                    rarity: 'rare',
                });
            }

            // Creator Pro - 1000+ total generations
            const totalGenerations = (contentStats.data?.total_videos || 0) + (contentStats.data?.total_images || 0);
            if (totalGenerations >= 1000) {
                achievements.push({
                    id: 'creator_pro',
                    title: 'Creator Pro',
                    description: '1000+ generations',
                    icon: 'crown',
                    unlockedAt: new Date().toISOString(), // Would track actual unlock date in production
                    rarity: 'epic',
                });
            }

            // Viral Hit - video with 100K+ views (mock for now)
            const hasViralContent = contentStats.data?.max_likes > 1000; // Using likes as proxy for views
            if (hasViralContent) {
                achievements.push({
                    id: 'viral_hit',
                    title: 'Viral Hit',
                    description: 'Content with 100K+ views',
                    icon: 'trending-up',
                    unlockedAt: new Date().toISOString(),
                    rarity: 'legendary',
                });
            }

            // Active Creator - created content in last 7 days
            if (contentStats.data?.recent_content_count > 0) {
                achievements.push({
                    id: 'active_creator',
                    title: 'Active Creator',
                    description: 'Created content this week',
                    icon: 'zap',
                    unlockedAt: new Date().toISOString(),
                    rarity: 'common',
                });
            }

            // Credit Collector - earned/purchased 10000+ credits
            if (userStats.data.credits >= 10000) {
                achievements.push({
                    id: 'credit_collector',
                    title: 'Credit Collector',
                    description: '10,000+ credits earned',
                    icon: 'coins',
                    unlockedAt: new Date().toISOString(),
                    rarity: 'rare',
                });
            }

            res.json({
                status: 'ok',
                achievements,
                totalAchievements: achievements.length,
                stats: {
                    totalGenerations,
                    daysSinceJoin,
                    maxLikes: contentStats.data?.max_likes || 0,
                    recentContentCount: contentStats.data?.recent_content_count || 0,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: 'error',
                code: 'ACHIEVEMENTS_ERROR',
                message: error?.message || 'Failed to fetch achievements',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

// GET /api/user/stats - Get comprehensive user statistics
router.get(
    '/stats',
    authenticateUser,
    async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.id;

        try {
            // Get comprehensive user statistics
            const [videoStats, imageStats, socialStats, creditStats] = await Promise.all([
                supabaseAdmin
                    .from('videos')
                    .select('id, likes_count, comments_count, shares_count', { count: 'exact' })
                    .eq('user_id', userId)
                    .eq('status', 'completed'),
                supabaseAdmin
                    .from('images')
                    .select('id, likes_count, comments_count, shares_count', { count: 'exact' })
                    .eq('user_id', userId)
                    .eq('status', 'completed'),
                supabaseAdmin
                    .from('likes')
                    .select('id', { count: 'exact' })
                    .eq('user_id', userId),
                supabaseAdmin
                    .from('credit_transactions')
                    .select('amount')
                    .eq('user_id', userId)
                    .eq('transaction_type', 'purchase'),
            ]);

            // Calculate totals
            const totalVideos = videoStats.count || 0;
            const totalImages = imageStats.count || 0;
            const totalLikes = (videoStats.data || []).reduce((sum, v) => sum + (v.likes_count || 0), 0) +
                (imageStats.data || []).reduce((sum, i) => sum + (i.likes_count || 0), 0);
            const totalComments = (videoStats.data || []).reduce((sum, v) => sum + (v.comments_count || 0), 0) +
                (imageStats.data || []).reduce((sum, i) => sum + (i.comments_count || 0), 0);
            const totalShares = (videoStats.data || []).reduce((sum, v) => sum + (v.shares_count || 0), 0) +
                (imageStats.data || []).reduce((sum, i) => sum + (i.shares_count || 0), 0);
            const totalLiked = socialStats.count || 0;
            const totalCreditsSpent = (creditStats.data || []).reduce((sum, t) => sum + Math.abs(t.amount), 0);

            // Mock follower/following data (would come from a followers table in production)
            const followers = Math.floor(Math.random() * 50000) + 1000; // Mock data
            const following = Math.floor(Math.random() * 1000) + 100; // Mock data

            res.json({
                status: 'ok',
                stats: {
                    content: {
                        videosCreated: totalVideos,
                        imagesGenerated: totalImages,
                        totalGenerations: totalVideos + totalImages,
                    },
                    engagement: {
                        totalLikes,
                        totalComments,
                        totalShares,
                        totalLiked,
                        engagementRate: totalVideos + totalImages > 0 ?
                            ((totalLikes + totalComments + totalShares) / (totalVideos + totalImages)).toFixed(2) : '0.00',
                    },
                    social: {
                        followers,
                        following,
                        followerGrowth: '+12.5%', // Mock data
                    },
                    credits: {
                        totalSpent: totalCreditsSpent,
                        averagePerGeneration: totalVideos + totalImages > 0 ?
                            (totalCreditsSpent / (totalVideos + totalImages)).toFixed(1) : '0.0',
                    },
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: 'error',
                code: 'STATS_ERROR',
                message: error?.message || 'Failed to fetch user statistics',
                timestamp: new Date().toISOString(),
            });
        }
    }
);

export default router;