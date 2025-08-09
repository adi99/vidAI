import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { reportRateLimit, logRateLimit } from '../middleware/rateLimitMiddleware';
import { automatedModerationService } from '../services/automatedModerationService';
import { userReportingService } from '../services/userReportingService';
import { supabaseAdmin } from '../config/database';

const router = Router();

// Schemas
const ContentModerationParams = z.object({
  contentId: z.string().uuid(),
  contentType: z.enum(['image', 'video'])
});

const ManualModerationBody = z.object({
  action: z.enum(['approve', 'block', 'flag']),
  reason: z.string().min(1).max(500),
  notes: z.string().max(1000).optional()
});

const ReportContentBody = z.object({
  reason: z.enum(['inappropriate', 'spam', 'harassment', 'violence', 'hate_speech', 'copyright', 'other']),
  description: z.string().min(10).max(500),
  category: z.enum(['adult', 'violence', 'hate', 'harassment', 'spam']).optional()
});

const ModerationStatsQuery = z.object({
  timeframe: z.enum(['hour', 'day', 'week']).default('day'),
  contentType: z.enum(['image', 'video', 'all']).default('all')
});

const ReviewQueueQuery = z.object({
  status: z.enum(['pending', 'in_review', 'completed', 'escalated', 'all']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'all']).default('all'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

/**
 * POST /api/moderation/analyze/:contentType/:contentId
 * Manually trigger content analysis
 */
router.post(
  '/analyze/:contentType/:contentId',
  authenticateUser,
  validateParams(ContentModerationParams),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { contentId, contentType } = req.params as z.infer<typeof ContentModerationParams>;
    const userId = req.user!.id;

    try {
      // Check if user owns the content or is a moderator
      const { data: content, error } = await supabaseAdmin
        .from(contentType === 'image' ? 'images' : 'videos')
        .select('user_id, image_url, video_url')
        .eq('id', contentId)
        .single();

      if (error || !content) {
        res.status(404).json({
          error: 'CONTENT_NOT_FOUND',
          message: 'Content not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check ownership (users can only analyze their own content)
      if (content.user_id !== userId) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You can only analyze your own content',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const contentUrl = content.image_url || content.video_url;
      if (!contentUrl) {
        res.status(400).json({
          error: 'NO_CONTENT_URL',
          message: 'Content URL not available for analysis',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Perform moderation analysis
      const moderationAction = await automatedModerationService.moderateGeneratedContent(
        contentId,
        contentType,
        contentUrl,
        userId
      );

      res.json({
        status: 'analyzed',
        contentId,
        contentType,
        moderationAction,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'ANALYSIS_FAILED',
        message: error.message || 'Failed to analyze content',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/moderation/report/:contentType/:contentId
 * Report inappropriate content
 */
router.post(
  '/report/:contentType/:contentId',
  authenticateUser,
  reportRateLimit,
  validateParams(ContentModerationParams),
  validateBody(ReportContentBody),
  logRateLimit,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { contentId, contentType } = req.params as z.infer<typeof ContentModerationParams>;
    const { reason, description, category } = req.body as z.infer<typeof ReportContentBody>;
    const userId = req.user!.id;

    try {
      // Get content owner
      const { data: content, error } = await supabaseAdmin
        .from(contentType === 'image' ? 'images' : 'videos')
        .select('id, user_id')
        .eq('id', contentId)
        .single();

      if (error || !content) {
        res.status(404).json({
          error: 'CONTENT_NOT_FOUND',
          message: 'Content not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Prevent self-reporting
      if (content.user_id === userId) {
        res.status(400).json({
          error: 'SELF_REPORT',
          message: 'You cannot report your own content',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use the comprehensive reporting service
      const { reportId, analysis } = await userReportingService.submitReport({
        contentId,
        contentType,
        reporterId: userId,
        contentOwnerId: content.user_id,
        reason,
        description,
        category: category || '',
        severity: 'medium', // Will be determined by the service
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });

      res.status(201).json({
        status: 'reported',
        reportId,
        contentId,
        contentType,
        reason,
        analysis: {
          confidence: analysis.confidence,
          recommendedAction: analysis.recommendedAction,
          similarReports: analysis.similarReports
        },
        message: 'Content has been reported and analyzed for review',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message.includes('already reported')) {
        res.status(409).json({
          error: 'ALREADY_REPORTED',
          message: error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.status(500).json({
        error: 'REPORT_FAILED',
        message: error.message || 'Failed to report content',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/moderation/stats
 * Get moderation statistics (admin/moderator only)
 */
router.get(
  '/stats',
  authenticateUser,
  validateQuery(ModerationStatsQuery),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { timeframe, contentType } = req.query as z.infer<typeof ModerationStatsQuery>;
    const userId = req.user!.id;

    try {
      // Check if user is admin/moderator
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!user || !['admin', 'moderator'].includes(user.role)) {
        res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin or moderator role required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const stats = await automatedModerationService.getModerationStats(timeframe);

      res.json({
        status: 'ok',
        timeframe,
        contentType,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'STATS_FAILED',
        message: error.message || 'Failed to get moderation statistics',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/moderation/queue
 * Get review queue (admin/moderator only)
 */
router.get(
  '/queue',
  authenticateUser,
  validateQuery(ReviewQueueQuery),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { status, priority, limit, offset } = req.query as any;
    const userId = req.user!.id;

    try {
      // Check if user is admin/moderator
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!user || !['admin', 'moderator'].includes(user.role)) {
        res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin or moderator role required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      let query = supabaseAdmin
        .from('review_queue')
        .select(`
          id,
          content_id,
          content_type,
          user_id,
          reason,
          priority,
          status,
          assigned_to,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (priority !== 'all') {
        query = query.eq('priority', priority);
      }

      const { data: queueItems, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch review queue: ${error.message}`);
      }

      res.json({
        status: 'ok',
        queue: queueItems || [],
        pagination: {
          limit,
          offset,
          total: queueItems?.length || 0,
          hasMore: (queueItems?.length || 0) === limit
        },
        filters: {
          status,
          priority
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'QUEUE_FETCH_FAILED',
        message: error.message || 'Failed to fetch review queue',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/moderation/review/:reviewId
 * Process manual moderation review (admin/moderator only)
 */
router.post(
  '/review/:reviewId',
  authenticateUser,
  validateParams(z.object({ reviewId: z.string().uuid() })),
  validateBody(ManualModerationBody),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { reviewId } = req.params;
    const { action, reason, notes } = req.body as z.infer<typeof ManualModerationBody>;
    const userId = req.user!.id;

    try {
      // Check if user is admin/moderator
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!user || !['admin', 'moderator'].includes(user.role)) {
        res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin or moderator role required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get review item
      const { data: reviewItem, error } = await supabaseAdmin
        .from('review_queue')
        .select('*')
        .eq('id', reviewId)
        .single();

      if (error || !reviewItem) {
        res.status(404).json({
          error: 'REVIEW_NOT_FOUND',
          message: 'Review item not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Update review status
      await supabaseAdmin
        .from('review_queue')
        .update({
          status: 'completed',
          assigned_to: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      // Update content based on action
      const tableName = reviewItem.content_type === 'image' ? 'images' : 'videos';
      await supabaseAdmin
        .from(tableName)
        .update({
          moderation_status: action,
          moderation_reason: reason,
          moderated_at: new Date().toISOString(),
          is_public: action === 'approve'
        })
        .eq('id', reviewItem.content_id);

      // Log the manual moderation action
      await supabaseAdmin
        .from('moderation_logs')
        .insert({
          content_id: reviewItem.content_id,
          content_type: reviewItem.content_type,
          user_id: reviewItem.user_id,
          action,
          reason: `Manual review: ${reason}${notes ? ` (${notes})` : ''}`,
          automated: false,
          moderator_id: userId
        });

      res.json({
        status: 'reviewed',
        reviewId,
        action,
        reason,
        contentId: reviewItem.content_id,
        contentType: reviewItem.content_type,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'REVIEW_FAILED',
        message: error.message || 'Failed to process review',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/moderation/user/:userId/violations
 * Get user violation history (admin/moderator only)
 */
router.get(
  '/user/:userId/violations',
  authenticateUser,
  validateParams(z.object({ userId: z.string().uuid() })),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId: targetUserId } = req.params;
    const userId = req.user!.id;

    try {
      // Check if user is admin/moderator or viewing own violations
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      const isOwnViolations = userId === targetUserId;
      const isModerator = user && ['admin', 'moderator'].includes(user.role);

      if (!isOwnViolations && !isModerator) {
        res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'You can only view your own violations or need moderator role',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { data: violations, error } = await supabaseAdmin
        .from('user_violations')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch violations: ${error.message}`);
      }

      res.json({
        status: 'ok',
        userId: targetUserId,
        violations: violations || [],
        totalCount: violations?.length || 0,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'VIOLATIONS_FETCH_FAILED',
        message: error.message || 'Failed to fetch user violations',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/moderation/reports/user
 * Get user's reports (submitted and received)
 */
router.get(
  '/reports/user',
  authenticateUser,
  validateQuery(z.object({
    type: z.enum(['submitted', 'received', 'all']).default('all'),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0)
  })),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { type, limit, offset } = req.query as any;
    const userId = req.user!.id;

    try {
      const reports = await userReportingService.getUserReports(userId, type, limit, offset);

      res.json({
        status: 'ok',
        reports,
        pagination: {
          limit,
          offset,
          total: reports.length,
          hasMore: reports.length === limit
        },
        filters: { type },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'REPORTS_FETCH_FAILED',
        message: error.message || 'Failed to fetch user reports',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/moderation/reports/stats
 * Get reporting statistics (admin/moderator only)
 */
router.get(
  '/reports/stats',
  authenticateUser,
  validateQuery(z.object({
    timeframe: z.enum(['day', 'week', 'month']).default('week')
  })),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { timeframe } = req.query as any;
    const userId = req.user!.id;

    try {
      // Check if user is admin/moderator
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!user || !['admin', 'moderator'].includes(user.role)) {
        res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin or moderator role required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const stats = await userReportingService.getReportingStats(timeframe);

      res.json({
        status: 'ok',
        timeframe,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'STATS_FETCH_FAILED',
        message: error.message || 'Failed to fetch reporting statistics',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/moderation/reports/:reportId/resolve
 * Resolve a report (admin/moderator only)
 */
router.post(
  '/reports/:reportId/resolve',
  authenticateUser,
  validateParams(z.object({ reportId: z.string().uuid() })),
  validateBody(z.object({
    action: z.enum(['dismiss', 'uphold', 'escalate']),
    notes: z.string().max(1000).optional()
  })),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { reportId } = req.params;
    const { action, notes } = req.body;
    const userId = req.user!.id;

    try {
      // Check if user is admin/moderator
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!user || !['admin', 'moderator'].includes(user.role)) {
        res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin or moderator role required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      await userReportingService.resolveReport(reportId, userId, action, notes);

      res.json({
        status: 'resolved',
        reportId,
        action,
        resolvedBy: userId,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'RESOLVE_FAILED',
        message: error.message || 'Failed to resolve report',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;