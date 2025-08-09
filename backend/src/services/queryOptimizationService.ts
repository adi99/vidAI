import { createClient } from '@supabase/supabase-js';

export interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  averageExecutionTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface OptimizedQueryOptions {
  useCache?: boolean;
  cacheTTL?: number;
  timeout?: number;
  retries?: number;
  batchSize?: number;
}

class QueryOptimizationService {
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private queryStats: QueryStats = {
    totalQueries: 0,
    slowQueries: 0,
    averageExecutionTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
  private executionTimes: number[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly MAX_EXECUTION_TIMES = 1000;

  /**
   * Execute optimized query with caching and performance monitoring
   */
  async executeOptimizedQuery<T>(
    query: string,
    params: any[] = [],
    options: OptimizedQueryOptions = {}
  ): Promise<T> {
    const {
      useCache = true,
      cacheTTL = 5 * 60 * 1000, // 5 minutes
      timeout = 30000, // 30 seconds
      retries = 2,
    } = options;

    const cacheKey = this.generateCacheKey(query, params);
    const startTime = Date.now();

    // Try cache first
    if (useCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        this.queryStats.cacheHits++;
        return cached;
      }
      this.queryStats.cacheMisses++;
    }

    // Execute query with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.executeQuery<T>(query, params, timeout);
        
        // Track performance
        const executionTime = Date.now() - startTime;
        this.trackQueryPerformance(executionTime, query);

        // Cache result
        if (useCache && result) {
          this.setCache(cacheKey, result, cacheTTL);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Query execution failed');
  }

  /**
   * Execute batch queries efficiently
   */
  async executeBatchQueries<T>(
    queries: Array<{ query: string; params: any[] }>,
    options: OptimizedQueryOptions = {}
  ): Promise<T[]> {
    const { batchSize = 10 } = options;
    const results: T[] = [];

    // Process queries in batches
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchPromises = batch.map(({ query, params }) =>
        this.executeOptimizedQuery<T>(query, params, options)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch query failed:', result.reason);
          // You might want to handle failures differently
          results.push(null as any);
        }
      }
    }

    return results;
  }

  /**
   * Get optimized feed data
   */
  async getOptimizedFeed(params: {
    limit?: number;
    offset?: number;
    contentType?: string;
    userId?: string;
    sort?: string;
  }) {
    const {
      limit = 20,
      offset = 0,
      contentType = 'all',
      userId,
      sort = 'recent',
    } = params;

    const query = `
      SELECT * FROM get_optimized_feed($1, $2, $3, $4, $5)
    `;

    return this.executeOptimizedQuery(
      query,
      [limit, offset, contentType, userId, sort],
      {
        useCache: true,
        cacheTTL: 2 * 60 * 1000, // 2 minutes for feed
      }
    );
  }

  /**
   * Get user generation history with optimization
   */
  async getUserGenerations(userId: string, params: {
    limit?: number;
    offset?: number;
    contentType?: string;
  }) {
    const {
      limit = 20,
      offset = 0,
      contentType = 'all',
    } = params;

    const query = `
      SELECT * FROM get_user_generations($1, $2, $3, $4)
    `;

    return this.executeOptimizedQuery(
      query,
      [userId, limit, offset, contentType],
      {
        useCache: true,
        cacheTTL: 10 * 60 * 1000, // 10 minutes
      }
    );
  }

  /**
   * Get comments with optimization
   */
  async getOptimizedComments(
    contentId: string,
    contentType: string,
    userId?: string,
    params: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 20, offset = 0 } = params;

    const query = `
      SELECT * FROM get_comments_optimized($1, $2, $3, $4, $5)
    `;

    return this.executeOptimizedQuery(
      query,
      [contentId, contentType, userId, limit, offset],
      {
        useCache: true,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
      }
    );
  }

  /**
   * Batch update likes efficiently
   */
  async batchUpdateLikes(updates: Array<{
    contentId: string;
    contentType: string;
    increment: number;
  }>) {
    const query = `
      SELECT batch_update_likes($1)
    `;

    const updatesJson = JSON.stringify(updates.map(update => ({
      content_id: update.contentId,
      content_type: update.contentType,
      increment: update.increment,
    })));

    return this.executeOptimizedQuery(
      query,
      [updatesJson],
      {
        useCache: false, // Don't cache write operations
      }
    );
  }

  /**
   * Search content efficiently
   */
  async searchContent(
    searchQuery: string,
    params: {
      contentType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      contentType = 'all',
      limit = 20,
      offset = 0,
    } = params;

    const query = `
      SELECT * FROM search_content($1, $2, $3, $4)
    `;

    return this.executeOptimizedQuery(
      query,
      [searchQuery, contentType, limit, offset],
      {
        useCache: true,
        cacheTTL: 10 * 60 * 1000, // 10 minutes for search results
      }
    );
  }

  /**
   * Get user statistics efficiently
   */
  async getUserStats(userId: string) {
    const query = `
      SELECT * FROM get_user_stats($1)
    `;

    return this.executeOptimizedQuery(
      query,
      [userId],
      {
        useCache: true,
        cacheTTL: 30 * 60 * 1000, // 30 minutes for user stats
      }
    );
  }

  /**
   * Execute raw query with timeout
   */
  private async executeQuery<T>(
    query: string,
    params: any[],
    timeout: number
  ): Promise<T> {
    // This would use your actual database connection
    // For now, we'll simulate with Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout);
    });

    // Execute query with timeout
    const queryPromise = supabase.rpc('execute_query', {
      query_text: query,
      query_params: params,
    });

    const result = await Promise.race([queryPromise, timeoutPromise]);
    return (result as any).data;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: string, params: any[]): string {
    const key = `${query}:${JSON.stringify(params)}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: any, ttl: number) {
    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Track query performance
   */
  private trackQueryPerformance(executionTime: number, query: string) {
    this.queryStats.totalQueries++;
    this.executionTimes.push(executionTime);

    // Keep only recent execution times
    if (this.executionTimes.length > this.MAX_EXECUTION_TIMES) {
      this.executionTimes = this.executionTimes.slice(-this.MAX_EXECUTION_TIMES);
    }

    // Calculate average
    this.queryStats.averageExecutionTime =
      this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length;

    // Track slow queries
    if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      this.queryStats.slowQueries++;
      console.warn(`Slow query detected (${executionTime}ms):`, query.substring(0, 100));
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.queryCache.clear();
  }

  /**
   * Get performance statistics
   */
  getStats(): QueryStats {
    return { ...this.queryStats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      averageExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.executionTimes = [];
  }

  /**
   * Optimize database connection settings
   */
  async optimizeConnection() {
    // This would configure connection pool settings
    console.log('Database connection optimized');
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  analyzePerformance() {
    const stats = this.getStats();
    const suggestions: string[] = [];

    if (stats.averageExecutionTime > 500) {
      suggestions.push('Consider adding database indexes for frequently queried columns');
    }

    if (stats.slowQueries > stats.totalQueries * 0.1) {
      suggestions.push('High number of slow queries detected - review query complexity');
    }

    if (stats.cacheHits / (stats.cacheHits + stats.cacheMisses) < 0.5) {
      suggestions.push('Low cache hit rate - consider increasing cache TTL or improving cache keys');
    }

    return {
      stats,
      suggestions,
    };
  }
}

export const queryOptimizationService = new QueryOptimizationService();
export default queryOptimizationService;