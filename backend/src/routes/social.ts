import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { supabaseAdmin } from '../config/database';
// Import schemas are defined inline below

// Additional schemas for social endpoints
const ContentIdParams = z.object({
  id: z.string().uuid(),
});

const FeedQueryParams = z.object({
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  content_type: z.enum(['video', 'image', 'all']).default('all'),
  user_id: z.string().uuid().optional(),
  sort: z.enum(['recent', 'popular', 'trending']).default('recent'),
});

const ShareContentBody = z.object({
  content_id: z.string().uuid(),
  content_type: z.enum(['video', 'image']),
  platform: z.enum(['twitter', 'facebook', 'instagram', 'tiktok', 'copy_link']),
  message: z.string().max(280).optional(),
});

// PrivacyUpdateBody is defined inline where used

const router = Router();

// GET /api/feed - Get paginated social feed
router.get(
  '/',
  validateQuery(FeedQueryParams),
  async (req: Request, res: Response) => {
    const query = req.query as unknown as z.infer<typeof FeedQueryParams>;

    try {
      let feedQuery = supabaseAdmin
        .rpc('get_public_feed', {
          limit_count: query.limit,
          offset_count: query.offset,
        });

      // If user_id is specified, get that user's content only
      if (query.user_id) {
        // Build custom query for specific user
        let userContentQuery;

        if (query.content_type === 'video') {
          userContentQuery = supabaseAdmin
            .from('videos')
            .select(`
              id,
              user_id,
              prompt,
              video_url,
              thumbnail_url,
              likes_count,
              comments_count,
              shares_count,
              created_at,
              profiles!inner(username)
            `)
            .eq('user_id', query.user_id)
            .eq('is_public', true)
            .eq('status', 'completed')
            .not('video_url', 'is', null);
        } else if (query.content_type === 'image') {
          userContentQuery = supabaseAdmin
            .from('images')
            .select(`
              id,
              user_id,
              prompt,
              image_url,
              thumbnail_url,
              likes_count,
              comments_count,
              shares_count,
              created_at,
              profiles!inner(username)
            `)
            .eq('user_id', query.user_id)
            .eq('is_public', true)
            .eq('status', 'completed')
            .not('image_url', 'is', null);
        } else {
          // For 'all', we'll use the RPC function but filter by user
          const { data: allContent, error } = await supabaseAdmin
            .rpc('get_public_feed', {
              limit_count: 1000, // Get more to filter
              offset_count: 0,
            });

          if (error) throw error;

          const userContent = allContent
            ?.filter((item: any) => item.user_id === query.user_id)
            .slice(query.offset, query.offset + query.limit) || [];

          return res.json({
            status: 'ok',
            feed: userContent.map((item: any) => ({
              ...item,
              content_type: item.content_type,
              media_url: item.media_url,
            })),
            pagination: {
              limit: query.limit,
              offset: query.offset,
              total: userContent.length,
              hasMore: userContent.length === query.limit,
            },
            timestamp: new Date().toISOString(),
          });
        }

        if (userContentQuery) {
          // Apply sorting
          if (query.sort === 'popular') {
            userContentQuery = userContentQuery.order('likes_count', { ascending: false });
          } else if (query.sort === 'trending') {
            // Simple trending: recent content with high engagement
            userContentQuery = userContentQuery
              .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
              .order('likes_count', { ascending: false });
          } else {
            userContentQuery = userContentQuery.order('created_at', { ascending: false });
          }

          userContentQuery = userContentQuery
            .range(query.offset, query.offset + query.limit - 1);

          const { data: userContent, error } = await userContentQuery;
          if (error) throw error;

          return res.json({
            status: 'ok',
            feed: userContent?.map(item => ({
              id: item.id,
              user_id: item.user_id,
              username: (item as any).profiles?.username,
              content_type: query.content_type,
              prompt: item.prompt,
              media_url: (item as any).video_url || (item as any).image_url,
              thumbnail_url: item.thumbnail_url,
              likes_count: item.likes_count,
              comments_count: item.comments_count,
              shares_count: item.shares_count || 0,
              created_at: item.created_at,
            })) || [],
            pagination: {
              limit: query.limit,
              offset: query.offset,
              total: userContent?.length || 0,
              hasMore: (userContent?.length || 0) === query.limit,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Default public feed
      const { data: feedData, error } = await feedQuery;
      if (error) throw error;

      // Filter by content type if specified
      let filteredFeed = feedData || [];
      if (query.content_type !== 'all') {
        filteredFeed = filteredFeed.filter((item: any) => item.content_type === query.content_type);
      }

      // Apply sorting (the RPC already sorts by recent)
      if (query.sort === 'popular') {
        filteredFeed.sort((a: any, b: any) => b.likes_count - a.likes_count);
      } else if (query.sort === 'trending') {
        // Simple trending algorithm: recent content with high engagement
        const now = Date.now();
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

        filteredFeed = filteredFeed
          .filter((item: any) => new Date(item.created_at).getTime() > weekAgo)
          .sort((a: any, b: any) => {
            const scoreA = a.likes_count + (a.comments_count * 2);
            const scoreB = b.likes_count + (b.comments_count * 2);
            return scoreB - scoreA;
          });
      }

      // Apply pagination to filtered results
      const paginatedFeed = filteredFeed.slice(query.offset, query.offset + query.limit);

      return res.json({
        status: 'ok',
        feed: paginatedFeed,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: filteredFeed.length,
          hasMore: query.offset + query.limit < filteredFeed.length,
        },
        filters: {
          content_type: query.content_type,
          sort: query.sort,
          user_id: query.user_id,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        code: 'FEED_FETCH_ERROR',
        message: error?.message || 'Failed to fetch social feed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/feed/content/:id/like - Like or unlike content
router.post(
  '/content/:id/like',
  authenticateUser,
  validateParams(ContentIdParams),
  validateBody(z.object({
    content_type: z.enum(['video', 'image']),
    action: z.enum(['like', 'unlike']).default('like'),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: contentId } = req.params as z.infer<typeof ContentIdParams>;
    const { content_type, action } = req.body;
    const userId = req.user!.id;

    try {
      if (action === 'like') {
        // Add like (will be ignored if already exists due to unique constraint)
        const { error: likeError } = await supabaseAdmin
          .from('likes')
          .insert({
            user_id: userId,
            content_id: contentId,
            content_type: content_type,
          });

        // Ignore duplicate key errors
        if (likeError && !likeError.message.includes('duplicate key')) {
          throw likeError;
        }
      } else {
        // Remove like
        const { error: unlikeError } = await supabaseAdmin
          .from('likes')
          .delete()
          .eq('user_id', userId)
          .eq('content_id', contentId)
          .eq('content_type', content_type);

        if (unlikeError) throw unlikeError;
      }

      // Get updated like count
      const { data: likeCount, error: countError } = await supabaseAdmin
        .from('likes')
        .select('id', { count: 'exact' })
        .eq('content_id', contentId)
        .eq('content_type', content_type);

      if (countError) throw countError;

      // Check if user currently likes this content
      const { data: userLike, error: userLikeError } = await supabaseAdmin
        .from('likes')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('content_type', content_type)
        .single();

      res.json({
        status: 'ok',
        contentId,
        contentType: content_type,
        action,
        likesCount: likeCount?.length || 0,
        userLiked: !!userLike && !userLikeError,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'LIKE_ERROR',
        message: error?.message || 'Failed to update like status',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/feed/content/:id/comment - Add comment to content
router.post(
  '/content/:id/comment',
  authenticateUser,
  validateParams(ContentIdParams),
  validateBody(z.object({
    content_type: z.enum(['video', 'image']),
    comment_text: z.string().min(1).max(500),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: contentId } = req.params as z.infer<typeof ContentIdParams>;
    const { content_type, comment_text } = req.body;
    const userId = req.user!.id;

    try {
      // Add comment
      const { data: comment, error: commentError } = await supabaseAdmin
        .from('comments')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: content_type,
          comment_text: comment_text,
        })
        .select(`
          id,
          comment_text,
          created_at,
          profiles!inner(username)
        `)
        .single();

      if (commentError) throw commentError;

      res.status(201).json({
        status: 'created',
        comment: {
          id: comment.id,
          userId,
          username: (comment as any).profiles?.username,
          commentText: comment.comment_text,
          createdAt: comment.created_at,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'COMMENT_ERROR',
        message: error?.message || 'Failed to add comment',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/feed/content/:id/comments - Get comments for content
router.get(
  '/content/:id/comments',
  validateParams(ContentIdParams),
  validateQuery(z.object({
    content_type: z.enum(['video', 'image']),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    sort: z.enum(['recent', 'oldest']).default('recent'),
  })),
  async (req: Request, res: Response) => {
    const { id: contentId } = req.params as z.infer<typeof ContentIdParams>;
    const { content_type, limit, offset, sort } = req.query as any;

    try {
      let commentsQuery = supabaseAdmin
        .from('comments')
        .select(`
          id,
          user_id,
          comment_text,
          created_at,
          profiles!inner(username)
        `)
        .eq('content_id', contentId)
        .eq('content_type', content_type);

      // Apply sorting
      if (sort === 'oldest') {
        commentsQuery = commentsQuery.order('created_at', { ascending: true });
      } else {
        commentsQuery = commentsQuery.order('created_at', { ascending: false });
      }

      // Apply pagination
      commentsQuery = commentsQuery.range(offset, offset + limit - 1);

      const { data: comments, error } = await commentsQuery;
      if (error) throw error;

      // Get total count
      const { count: totalCount, error: countError } = await supabaseAdmin
        .from('comments')
        .select('id', { count: 'exact' })
        .eq('content_id', contentId)
        .eq('content_type', content_type);

      if (countError) throw countError;

      res.json({
        status: 'ok',
        comments: comments?.map(comment => ({
          id: comment.id,
          userId: comment.user_id,
          username: (comment as any).profiles?.username,
          commentText: comment.comment_text,
          createdAt: comment.created_at,
        })) || [],
        pagination: {
          limit,
          offset,
          total: totalCount || 0,
          hasMore: offset + limit < (totalCount || 0),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        code: 'COMMENTS_FETCH_ERROR',
        message: error?.message || 'Failed to fetch comments',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/feed/content/:id/share - Share content
router.post(
  '/content/:id/share',
  authenticateUser,
  validateParams(ContentIdParams),
  validateBody(ShareContentBody),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: contentId } = req.params as z.infer<typeof ContentIdParams>;
    const { content_type, platform, message } = req.body as z.infer<typeof ShareContentBody>;

    try {
      // Get content details for sharing
      let contentQuery;
      if (content_type === 'video') {
        contentQuery = supabaseAdmin
          .from('videos')
          .select(`
            id,
            prompt,
            video_url,
            thumbnail_url,
            profiles!inner(username)
          `)
          .eq('id', contentId)
          .eq('is_public', true)
          .single();
      } else {
        contentQuery = supabaseAdmin
          .from('images')
          .select(`
            id,
            prompt,
            image_url,
            thumbnail_url,
            profiles!inner(username)
          `)
          .eq('id', contentId)
          .eq('is_public', true)
          .single();
      }

      const { data: content, error: contentError } = await contentQuery;
      if (contentError || !content) {
        return res.status(404).json({
          status: 'not_found',
          code: 'CONTENT_NOT_FOUND',
          message: 'Content not found or not public',
          timestamp: new Date().toISOString(),
        });
      }

      // Generate share URL (in production, this would be your app's deep link)
      const shareUrl = `https://your-app.com/content/${content_type}/${contentId}`;

      // Create share text
      const shareText = message || `Check out this AI-generated ${content_type} by ${(content as any).profiles?.username}: "${content.prompt}"`;

      // Platform-specific share URLs
      let platformUrl = '';
      switch (platform) {
        case 'twitter':
          platformUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
          break;
        case 'facebook':
          platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
          break;
        case 'copy_link':
          platformUrl = shareUrl;
          break;
        default:
          platformUrl = shareUrl;
      }

      // Increment share count
      const tableName = content_type === 'video' ? 'videos' : 'images';
      await supabaseAdmin
        .from(tableName)
        .update({ shares_count: (supabaseAdmin as any).sql`shares_count + 1` })
        .eq('id', contentId);

      // Log share activity (optional - could be used for analytics)
      // await supabaseAdmin.from('share_activities').insert({
      //   user_id: userId,
      //   content_id: contentId,
      //   content_type,
      //   platform,
      //   share_url: shareUrl,
      // });

      return res.json({
        status: 'ok',
        shareUrl: platformUrl,
        shareText,
        platform,
        content: {
          id: content.id,
          type: content_type,
          prompt: content.prompt,
          mediaUrl: (content as any).video_url || (content as any).image_url,
          thumbnailUrl: content.thumbnail_url,
          creator: (content as any).profiles?.username,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        code: 'SHARE_ERROR',
        message: error?.message || 'Failed to share content',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// PUT /api/feed/content/:id/privacy - Update content privacy
router.put(
  '/content/:id/privacy',
  authenticateUser,
  validateParams(ContentIdParams),
  validateBody(z.object({
    content_type: z.enum(['video', 'image']),
    is_public: z.boolean(),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: contentId } = req.params as z.infer<typeof ContentIdParams>;
    const { content_type, is_public } = req.body;
    const userId = req.user!.id;

    try {
      const tableName = content_type === 'video' ? 'videos' : 'images';

      // Update privacy setting (only if user owns the content)
      const { data: updatedContent, error } = await supabaseAdmin
        .from(tableName)
        .update({ is_public })
        .eq('id', contentId)
        .eq('user_id', userId) // Ensure user owns this content
        .select('id, is_public')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            status: 'not_found',
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found or you do not have permission to modify it',
            timestamp: new Date().toISOString(),
          });
        }
        throw error;
      }

      return res.json({
        status: 'ok',
        contentId,
        contentType: content_type,
        isPublic: updatedContent.is_public,
        message: `Content is now ${is_public ? 'public' : 'private'}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        code: 'PRIVACY_UPDATE_ERROR',
        message: error?.message || 'Failed to update content privacy',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// DELETE /api/feed/content/:id - Delete user's content
router.delete(
  '/content/:id',
  authenticateUser,
  validateParams(ContentIdParams),
  validateBody(z.object({
    content_type: z.enum(['video', 'image']),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: contentId } = req.params as z.infer<typeof ContentIdParams>;
    const { content_type } = req.body;
    const userId = req.user!.id;

    try {
      const tableName = content_type === 'video' ? 'videos' : 'images';

      // Delete content (only if user owns it)
      const { error } = await supabaseAdmin
        .from(tableName)
        .delete()
        .eq('id', contentId)
        .eq('user_id', userId) // Ensure user owns this content
        .select('id')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            status: 'not_found',
            code: 'CONTENT_NOT_FOUND',
            message: 'Content not found or you do not have permission to delete it',
            timestamp: new Date().toISOString(),
          });
        }
        throw error;
      }

      // Also delete related likes and comments
      await Promise.all([
        supabaseAdmin
          .from('likes')
          .delete()
          .eq('content_id', contentId)
          .eq('content_type', content_type),
        supabaseAdmin
          .from('comments')
          .delete()
          .eq('content_id', contentId)
          .eq('content_type', content_type),
      ]);

      return res.json({
        status: 'deleted',
        contentId,
        contentType: content_type,
        message: 'Content and related data deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        code: 'CONTENT_DELETE_ERROR',
        message: error?.message || 'Failed to delete content',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;