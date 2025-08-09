import { supabase } from '@/lib/supabase';
import networkService from './networkService';
import errorHandlingService, { ERROR_CODES } from './errorHandlingService';
import { databaseOptimizationService } from './databaseOptimizationService';
import { redisCacheService } from './redisCacheService';

// Types for social feed
export interface FeedItem {
  id: string;
  user_id: string;
  username: string;
  content_type: 'video' | 'image';
  prompt: string;
  media_url: string;
  thumbnail_url?: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  model?: string;
  duration?: string;
  is_liked?: boolean;
  is_bookmarked?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  commentText: string;
  createdAt: string;
}

export interface FeedResponse {
  status: string;
  feed: FeedItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    content_type: string;
    sort: string;
    user_id?: string;
  };
  timestamp: string;
}

export interface LikeResponse {
  status: string;
  contentId: string;
  contentType: string;
  action: string;
  likesCount: number;
  userLiked: boolean;
  timestamp: string;
}

export interface CommentResponse {
  status: string;
  comment: Comment;
  timestamp: string;
}

export interface CommentsResponse {
  status: string;
  comments: Comment[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  timestamp: string;
}

export interface ShareResponse {
  status: string;
  shareUrl: string;
  shareText: string;
  platform: string;
  content: {
    id: string;
    type: string;
    prompt: string;
    mediaUrl: string;
    thumbnailUrl?: string;
    creator: string;
  };
  timestamp: string;
}

class SocialService {
  private baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const { headers, ...restOptions } = options;
      return await networkService.request<T>(url, {
        ...restOptions,
        headers: headers as Record<string, string>,
        timeout: 15000, // 15 second timeout for social requests
        retries: 2, // Fewer retries for social features
      });
    } catch (error) {
      // Transform network errors to more specific social errors
      const parsedError = errorHandlingService.parseError(error);
      
      if (parsedError.code === ERROR_CODES.NETWORK_ERROR) {
        throw errorHandlingService.parseError({
          code: ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'Social features are temporarily unavailable. Please try again later.',
          retryable: true,
        });
      }
      
      throw parsedError;
    }
  }

  // Get social feed with filtering and pagination
  async getFeed(params: {
    limit?: number;
    offset?: number;
    content_type?: 'video' | 'image' | 'all';
    user_id?: string;
    sort?: 'recent' | 'popular' | 'trending';
  } = {}): Promise<FeedResponse> {
    // Try to get from cache first
    const cachedFeed = await redisCacheService.getCachedApiResponse<FeedResponse>('feed', params);
    if (cachedFeed) {
      return cachedFeed;
    }

    return errorHandlingService.withRetry(
      async () => {
        try {
          const queryParams = new URLSearchParams();
          
          if (params.limit) queryParams.append('limit', params.limit.toString());
          if (params.offset) queryParams.append('offset', params.offset.toString());
          if (params.content_type) queryParams.append('content_type', params.content_type);
          if (params.user_id) queryParams.append('user_id', params.user_id);
          if (params.sort) queryParams.append('sort', params.sort);

          const endpoint = `/feed${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
          const response = await this.makeRequest<FeedResponse>(endpoint);
          
          // Cache the response
          await redisCacheService.cacheFeedData(params, response.feed, {
            ttl: 2 * 60 * 1000, // 2 minutes
          });
          
          return response;
        } catch (error) {
          // Fallback to optimized database access if API is not available
          console.warn('API not available, falling back to optimized database access:', error);
          return this.getFeedFallback(params);
        }
      },
      {
        maxRetries: 2,
        baseDelay: 1000,
      }
    );
  }

  // Fallback method using optimized database access
  private async getFeedFallback(params: {
    limit?: number;
    offset?: number;
    content_type?: 'video' | 'image' | 'all';
    user_id?: string;
    sort?: 'recent' | 'popular' | 'trending';
  } = {}): Promise<FeedResponse> {
    try {
      // Use optimized database service
      const { data, error, fromCache } = await databaseOptimizationService.getOptimizedFeed({
        limit: params.limit || 20,
        offset: params.offset || 0,
        contentType: params.content_type,
        userId: params.user_id,
        sort: params.sort,
      });

      if (error) {
        throw networkService.handleSupabaseError(error);
      }

      const feedItems: FeedItem[] = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        username: item.username || 'unknown',
        content_type: item.content_type,
        prompt: item.prompt || '',
        media_url: item.media_url || '',
        thumbnail_url: item.thumbnail_url,
        likes_count: item.likes_count || 0,
        comments_count: item.comments_count || 0,
        shares_count: item.shares_count || 0,
        created_at: item.created_at,
        model: item.model,
        duration: item.duration,
        is_liked: item.is_liked,
        is_bookmarked: item.is_bookmarked,
      }));

      const response: FeedResponse = {
        status: 'ok',
        feed: feedItems,
        pagination: {
          limit: params.limit || 20,
          offset: params.offset || 0,
          total: feedItems.length,
          hasMore: feedItems.length === (params.limit || 20),
        },
        filters: {
          content_type: params.content_type || 'all',
          sort: params.sort || 'recent',
          user_id: params.user_id,
        },
        timestamp: new Date().toISOString(),
      };

      // Cache the optimized response if not from cache
      if (!fromCache) {
        await redisCacheService.cacheFeedData(params, feedItems, {
          ttl: 2 * 60 * 1000, // 2 minutes
        });
      }

      return {
        status: 'ok',
        feed: feedItems,
        pagination: {
          limit: params.limit || 20,
          offset: params.offset || 0,
          total: feedItems.length,
          hasMore: feedItems.length === (params.limit || 20),
        },
        filters: {
          content_type: params.content_type || 'all',
          sort: params.sort || 'recent',
          user_id: params.user_id,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Database fallback failed:', error);
      throw errorHandlingService.parseError({
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'Unable to load feed content. Please try again later.',
        retryable: true,
      });
    }
  }

  // Like or unlike content
  async toggleLike(
    contentId: string,
    contentType: 'video' | 'image',
    action: 'like' | 'unlike' = 'like'
  ): Promise<LikeResponse> {
    return errorHandlingService.withRetry(
      async () => {
        try {
          return await this.makeRequest<LikeResponse>(`/feed/content/${contentId}/like`, {
            method: 'POST',
            body: JSON.stringify({
              content_type: contentType,
              action,
            }),
          });
        } catch (error) {
          // Fallback to direct database access
          console.warn('API not available for like, falling back to database:', error);
          return this.toggleLikeFallback(contentId, contentType, action);
        }
      },
      {
        maxRetries: 1, // Only retry once for like actions
        baseDelay: 500,
      }
    );
  }

  private async toggleLikeFallback(
    contentId: string,
    contentType: 'video' | 'image',
    action: 'like' | 'unlike'
  ): Promise<LikeResponse> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) {
      throw errorHandlingService.parseError({
        code: ERROR_CODES.AUTHENTICATION_ERROR,
        message: 'Please log in to like content.',
        retryable: false,
      });
    }

    const userId = session.data.session.user.id;

    try {
      if (action === 'like') {
        // Add like
        const { error: insertError } = await supabase.from('likes').insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
        });
        
        if (insertError) {
          throw networkService.handleSupabaseError(insertError);
        }
      } else {
        // Remove like
        const { error: deleteError } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', userId)
          .eq('content_id', contentId)
          .eq('content_type', contentType);
          
        if (deleteError) {
          throw networkService.handleSupabaseError(deleteError);
        }
      }

      // Get updated like count
      const { count, error: countError } = await supabase
        .from('likes')
        .select('*', { count: 'exact' })
        .eq('content_id', contentId)
        .eq('content_type', contentType);
        
      if (countError) {
        throw networkService.handleSupabaseError(countError);
      }

      // Check if user currently likes this content
      const { data: userLike, error: checkError } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .single();
        
      // Don't throw error if no like found, that's expected
      if (checkError && checkError.code !== 'PGRST116') {
        throw networkService.handleSupabaseError(checkError);
      }

      return {
        status: 'ok',
        contentId,
        contentType,
        action,
        likesCount: count || 0,
        userLiked: !!userLike,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Database like fallback failed:', error);
      throw errorHandlingService.parseError({
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'Unable to update like status. Please try again.',
        retryable: true,
      });
    }
  }

  // Add comment to content
  async addComment(
    contentId: string,
    contentType: 'video' | 'image',
    commentText: string
  ): Promise<CommentResponse> {
    try {
      return await this.makeRequest<CommentResponse>(`/feed/content/${contentId}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          content_type: contentType,
          comment_text: commentText,
        }),
      });
    } catch (error) {
      console.warn('API not available for comment, falling back to database:', error);
      return this.addCommentFallback(contentId, contentType, commentText);
    }
  }

  private async addCommentFallback(
    contentId: string,
    contentType: 'video' | 'image',
    commentText: string
  ): Promise<CommentResponse> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) {
      throw new Error('Authentication required');
    }

    const userId = session.data.session.user.id;

    try {
      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          comment_text: commentText,
        })
        .select(`
          id,
          comment_text,
          created_at,
          profiles!inner(username)
        `)
        .single();

      if (error) throw error;

      return {
        status: 'created',
        comment: {
          id: comment.id,
          userId,
          username: (comment as any).profiles?.username || 'unknown',
          commentText: comment.comment_text,
          createdAt: comment.created_at,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Database comment fallback failed:', error);
      throw new Error('Failed to add comment');
    }
  }

  // Get comments for content
  async getComments(
    contentId: string,
    contentType: 'video' | 'image',
    params: {
      limit?: number;
      offset?: number;
      sort?: 'recent' | 'oldest';
    } = {}
  ): Promise<CommentsResponse> {
    try {
      const queryParams = new URLSearchParams({
        content_type: contentType,
      });
      
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.sort) queryParams.append('sort', params.sort);

      return await this.makeRequest<CommentsResponse>(
        `/feed/content/${contentId}/comments?${queryParams.toString()}`
      );
    } catch (error) {
      console.warn('API not available for comments, falling back to database:', error);
      return this.getCommentsFallback(contentId, contentType, params);
    }
  }

  private async getCommentsFallback(
    contentId: string,
    contentType: 'video' | 'image',
    params: {
      limit?: number;
      offset?: number;
      sort?: 'recent' | 'oldest';
    } = {}
  ): Promise<CommentsResponse> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const sort = params.sort || 'recent';

    try {
      let query = supabase
        .from('comments')
        .select(`
          id,
          user_id,
          comment_text,
          created_at,
          profiles!inner(username)
        `)
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      // Apply sorting
      if (sort === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: comments, error } = await query;
      if (error) throw error;

      // Get total count
      const { count: totalCount } = await supabase
        .from('comments')
        .select('id', { count: 'exact' })
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      return {
        status: 'ok',
        comments: (comments || []).map(comment => ({
          id: comment.id,
          userId: comment.user_id,
          username: (comment as any).profiles?.username || 'unknown',
          commentText: comment.comment_text,
          createdAt: comment.created_at,
        })),
        pagination: {
          limit,
          offset,
          total: totalCount || 0,
          hasMore: offset + limit < (totalCount || 0),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Database comments fallback failed:', error);
      throw new Error('Failed to load comments');
    }
  }

  // Share content
  async shareContent(
    contentId: string,
    contentType: 'video' | 'image',
    platform: 'twitter' | 'facebook' | 'instagram' | 'tiktok' | 'copy_link',
    message?: string
  ): Promise<ShareResponse> {
    try {
      return await this.makeRequest<ShareResponse>(`/feed/content/${contentId}/share`, {
        method: 'POST',
        body: JSON.stringify({
          content_id: contentId,
          content_type: contentType,
          platform,
          message,
        }),
      });
    } catch (error) {
      console.warn('API not available for share, using fallback:', error);
      return this.shareContentFallback(contentId, contentType, platform, message);
    }
  }

  private async shareContentFallback(
    contentId: string,
    contentType: 'video' | 'image',
    platform: string,
    message?: string
  ): Promise<ShareResponse> {
    // Simple fallback - just return a basic share URL
    const shareUrl = `https://your-app.com/content/${contentType}/${contentId}`;
    const shareText = message || `Check out this AI-generated ${contentType}!`;

    return {
      status: 'ok',
      shareUrl,
      shareText,
      platform,
      content: {
        id: contentId,
        type: contentType,
        prompt: '',
        mediaUrl: '',
        creator: 'unknown',
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Update content privacy
  async updateContentPrivacy(
    contentId: string,
    contentType: 'video' | 'image',
    isPublic: boolean
  ): Promise<{ status: string; message: string }> {
    return this.makeRequest(`/feed/content/${contentId}/privacy`, {
      method: 'PUT',
      body: JSON.stringify({
        content_type: contentType,
        is_public: isPublic,
      }),
    });
  }

  // Delete content
  async deleteContent(
    contentId: string,
    contentType: 'video' | 'image'
  ): Promise<{ status: string; message: string }> {
    return this.makeRequest(`/feed/content/${contentId}`, {
      method: 'DELETE',
      body: JSON.stringify({
        content_type: contentType,
      }),
    });
  }

  // Helper method to check if user has liked content
  async checkUserLike(
    contentId: string,
    contentType: 'video' | 'image'
  ): Promise<boolean> {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session?.user) return false;

      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', session.data.session.user.id)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .single();

      return !!data;
    } catch (error) {
      console.error('Error checking user like:', error);
      return false;
    }
  }

  // Helper method to get user's bookmarked content (if implemented)
  async getUserBookmarks(
    contentType?: 'video' | 'image'
  ): Promise<FeedItem[]> {
    // This would require a bookmarks table in the database
    // For now, return empty array as bookmarks aren't implemented in the backend
    return [];
  }
}

export const socialService = new SocialService();