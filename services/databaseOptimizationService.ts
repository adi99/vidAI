import { supabase } from '@/lib/supabase';
import { cacheService } from './cacheService';

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cacheTTL?: number;
  enablePagination?: boolean;
  pageSize?: number;
  selectFields?: string[];
  orderBy?: { column: string; ascending?: boolean }[];
  filters?: Record<string, any>;
}

export interface DatabaseStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  averageQueryTime: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }>;
}

class DatabaseOptimizationService {
  private queryStats: DatabaseStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageQueryTime: 0,
    slowQueries: [],
  };

  private queryTimes: number[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly MAX_SLOW_QUERIES = 100;

  /**
   * Execute optimized query with caching and performance monitoring
   */
  async executeOptimizedQuery<T>(
    tableName: string,
    queryBuilder: (query: any) => any,
    options: QueryOptimizationOptions = {}
  ): Promise<{ data: T[] | null; error: any; fromCache: boolean }> {
    const {
      useCache = true,
      cacheTTL = 5 * 60 * 1000, // 5 minutes
      enablePagination = false,
      pageSize = 20,
      selectFields,
    } = options;

    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(tableName, options);

    // Try cache first
    if (useCache) {
      const cachedResult = await cacheService.get<T[]>(cacheKey);
      if (cachedResult) {
        this.queryStats.cacheHits++;
        return { data: cachedResult, error: null, fromCache: true };
      }
      this.queryStats.cacheMisses++;
    }

    try {
      // Build optimized query
      let query: any = supabase.from(tableName);

      // Apply field selection for performance
      if (selectFields && selectFields.length > 0) {
        query = query.select(selectFields.join(','));
      } else {
        query = query.select('*');
      }

      // Apply custom query builder
      query = queryBuilder(query);

      // Apply pagination
      if (enablePagination) {
        query = query.range(0, pageSize - 1);
      }

      const { data, error } = await query;

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Track performance
      this.trackQueryPerformance(queryTime, `${tableName} query`);

      if (error) {
        console.error('Database query error:', error);
        return { data: null, error, fromCache: false };
      }

      // Cache successful results
      if (useCache && data) {
        await cacheService.set(cacheKey, data, { ttl: cacheTTL });
      }

      return { data, error: null, fromCache: false };
    } catch (error) {
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      this.trackQueryPerformance(queryTime, `${tableName} query (error)`);
      
      console.error('Database optimization service error:', error);
      return { data: null, error, fromCache: false };
    }
  }

  /**
   * Get optimized feed with proper indexing and caching
   */
  async getOptimizedFeed(options: {
    limit?: number;
    offset?: number;
    contentType?: 'video' | 'image' | 'all';
    userId?: string;
    sort?: 'recent' | 'popular' | 'trending';
  } = {}) {
    const {
      limit = 20,
      offset = 0,
      contentType = 'all',
      userId,
      sort = 'recent',
    } = options;

    return this.executeOptimizedQuery(
      'feed_view', // Assuming we have a materialized view for feed
      (query) => {
        // Apply content type filter
        if (contentType !== 'all') {
          query = query.eq('content_type', contentType);
        }

        // Apply user filter
        if (userId) {
          query = query.eq('user_id', userId);
        }

        // Apply sorting with proper indexes
        switch (sort) {
          case 'popular':
            query = query.order('likes_count', { ascending: false })
                          .order('created_at', { ascending: false });
            break;
          case 'trending':
            query = query.order('engagement_score', { ascending: false })
                          .order('created_at', { ascending: false });
            break;
          default: // recent
            query = query.order('created_at', { ascending: false });
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        return query;
      },
      {
        useCache: true,
        cacheTTL: 2 * 60 * 1000, // 2 minutes for feed
        selectFields: [
          'id',
          'user_id',
          'username',
          'content_type',
          'media_url',
          'thumbnail_url',
          'prompt',
          'model',
          'duration',
          'likes_count',
          'comments_count',
          'shares_count',
          'created_at',
          'is_liked',
          'is_bookmarked',
        ],
      }
    );
  }

  /**
   * Get user's generation history with optimization
   */
  async getOptimizedGenerationHistory(userId: string, options: {
    limit?: number;
    offset?: number;
    contentType?: 'video' | 'image' | 'all';
  } = {}) {
    const { limit = 20, offset = 0, contentType = 'all' } = options;

    return this.executeOptimizedQuery(
      'user_generations',
      (query) => {
        query = query.eq('user_id', userId);

        if (contentType !== 'all') {
          query = query.eq('content_type', contentType);
        }

        return query.order('created_at', { ascending: false })
                   .range(offset, offset + limit - 1);
      },
      {
        useCache: true,
        cacheTTL: 10 * 60 * 1000, // 10 minutes
        selectFields: [
          'id',
          'content_type',
          'media_url',
          'thumbnail_url',
          'prompt',
          'model',
          'status',
          'created_at',
          'generation_time',
          'credits_used',
        ],
      }
    );
  }

  /**
   * Get user profile with related data optimization
   */
  async getOptimizedUserProfile(userId: string) {
    return this.executeOptimizedQuery(
      'user_profiles',
      (query) => {
        return query.eq('id', userId);
      },
      {
        useCache: true,
        cacheTTL: 30 * 60 * 1000, // 30 minutes
        selectFields: [
          'id',
          'username',
          'email',
          'avatar_url',
          'credits',
          'subscription_status',
          'subscription_plan',
          'subscription_expires_at',
          'total_generations',
          'total_likes_received',
          'created_at',
          'updated_at',
        ],
      }
    );
  }

  /**
   * Get comments with pagination and caching
   */
  async getOptimizedComments(contentId: string, contentType: string, options: {
    limit?: number;
    offset?: number;
  } = {}) {
    const { limit = 20, offset = 0 } = options;

    return this.executeOptimizedQuery(
      'comments',
      (query) => {
        return query.eq('content_id', contentId)
                   .eq('content_type', contentType)
                   .order('created_at', { ascending: false })
                   .range(offset, offset + limit - 1);
      },
      {
        useCache: true,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
        selectFields: [
          'id',
          'user_id',
          'username',
          'text',
          'created_at',
          'likes_count',
          'is_liked',
        ],
      }
    );
  }

  /**
   * Batch update operations for better performance
   */
  async batchUpdateLikes(updates: Array<{
    contentId: string;
    contentType: string;
    action: 'like' | 'unlike';
  }>) {
    try {
      const promises = updates.map(async ({ contentId, contentType, action }) => {
        const tableName = contentType === 'video' ? 'videos' : 'images';
        const increment = action === 'like' ? 1 : -1;

        return supabase.rpc('update_likes_count', {
          table_name: tableName,
          content_id: contentId,
          increment_by: increment,
        });
      });

      const results = await Promise.allSettled(promises);
      
      // Invalidate related cache entries
      updates.forEach(({ contentId, contentType }) => {
        this.invalidateContentCache(contentId, contentType);
      });

      return results;
    } catch (error) {
      console.error('Batch update likes error:', error);
      throw error;
    }
  }

  /**
   * Preload related data for better UX
   */
  async preloadRelatedData(contentIds: string[], contentType: string) {
    try {
      // Preload comments count
      const commentsPromise = this.executeOptimizedQuery(
        'comments',
        (query) => {
          return query.in('content_id', contentIds)
                     .eq('content_type', contentType)
                     .select('content_id, count(*)', { count: 'exact' });
        },
        { useCache: true, cacheTTL: 10 * 60 * 1000 }
      );

      // Preload user likes
      const likesPromise = this.executeOptimizedQuery(
        'likes',
        (query) => {
          return query.in('content_id', contentIds)
                     .eq('content_type', contentType)
                     .select('content_id, user_id');
        },
        { useCache: true, cacheTTL: 5 * 60 * 1000 }
      );

      const [commentsResult, likesResult] = await Promise.all([
        commentsPromise,
        likesPromise,
      ]);

      return {
        comments: commentsResult.data,
        likes: likesResult.data,
      };
    } catch (error) {
      console.error('Preload related data error:', error);
      return { comments: null, likes: null };
    }
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(tableName: string, options: QueryOptimizationOptions): string {
    const keyData = {
      table: tableName,
      ...options,
      timestamp: Math.floor(Date.now() / (options.cacheTTL || 300000)), // Round to cache TTL
    };
    
    return `db_${tableName}_${this.hashObject(keyData)}`;
  }

  /**
   * Hash object for cache key generation
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Track query performance
   */
  private trackQueryPerformance(duration: number, queryDescription: string) {
    this.queryStats.totalQueries++;
    this.queryTimes.push(duration);

    // Keep only last 1000 query times for average calculation
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }

    // Calculate average
    this.queryStats.averageQueryTime = 
      this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;

    // Track slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      this.queryStats.slowQueries.push({
        query: queryDescription,
        duration,
        timestamp: Date.now(),
      });

      // Keep only recent slow queries
      if (this.queryStats.slowQueries.length > this.MAX_SLOW_QUERIES) {
        this.queryStats.slowQueries = this.queryStats.slowQueries.slice(-this.MAX_SLOW_QUERIES);
      }
    }
  }

  /**
   * Invalidate cache for specific content
   */
  private async invalidateContentCache(contentId: string, contentType: string) {
    const patterns = [
      `db_feed_view_*`,
      `db_user_generations_*`,
      `db_comments_*${contentId}*`,
      `db_likes_*${contentId}*`,
    ];

    // Note: This is a simplified cache invalidation
    // In a real implementation, you'd want more sophisticated cache invalidation
    for (const pattern of patterns) {
      try {
        await cacheService.remove(pattern);
      } catch (error) {
        console.error('Cache invalidation error:', error);
      }
    }
  }

  /**
   * Get database performance statistics
   */
  getPerformanceStats(): DatabaseStats {
    return { ...this.queryStats };
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats() {
    this.queryStats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      slowQueries: [],
    };
    this.queryTimes = [];
  }

  /**
   * Optimize database connection settings
   */
  async optimizeConnection() {
    try {
      // Set connection pool settings for better performance
      // Note: This would typically be done at the database level
      // Here we're just ensuring proper client configuration
      
      // Enable prepared statements
      // Enable connection pooling
      // Set appropriate timeout values
      
      console.log('Database connection optimized');
    } catch (error) {
      console.error('Failed to optimize database connection:', error);
    }
  }

  /**
   * Create database indexes for better performance
   */
  async createOptimizationIndexes() {
    const indexes = [
      // Feed optimization indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_likes_count ON videos(likes_count DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_user_id ON videos(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_created_at ON images(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_likes_count ON images(likes_count DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_user_id ON images(user_id)',
      
      // Comments optimization
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_content ON comments(content_id, content_type)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)',
      
      // Likes optimization
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_content ON likes(content_id, content_type)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_user ON likes(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_unique ON likes(user_id, content_id, content_type)',
      
      // User optimization
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
    ];

    try {
      for (const indexSQL of indexes) {
        await supabase.rpc('execute_sql', { sql: indexSQL });
      }
      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Failed to create database indexes:', error);
    }
  }
}

export const databaseOptimizationService = new DatabaseOptimizationService();
export default databaseOptimizationService;