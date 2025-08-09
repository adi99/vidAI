import { cacheService } from './cacheService';

export interface RedisCacheOptions {
  ttl?: number;
  compress?: boolean;
  tags?: string[];
  version?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalSize: number;
}

class RedisCacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    totalSize: 0,
  };

  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB

  /**
   * Cache API response with automatic compression and tagging
   */
  async cacheApiResponse<T>(
    endpoint: string,
    params: Record<string, any>,
    data: T,
    options: RedisCacheOptions = {}
  ): Promise<void> {
    const {
      ttl = this.DEFAULT_TTL,
      compress = true,
      tags = [],
      version = '1.0',
    } = options;

    const cacheKey = this.generateApiCacheKey(endpoint, params);
    
    try {
      const cacheData = {
        data,
        metadata: {
          endpoint,
          params,
          tags,
          version,
          cachedAt: Date.now(),
        },
      };

      await cacheService.set(cacheKey, cacheData, {
        ttl,
        compress: compress && this.shouldCompress(data),
        version,
      });

      // Update stats
      this.stats.sets++;
      this.updateHitRate();

      // Store tags for cache invalidation
      if (tags.length > 0) {
        await this.storeCacheTags(cacheKey, tags);
      }
    } catch (error) {
      console.error('Failed to cache API response:', error);
    }
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse<T>(
    endpoint: string,
    params: Record<string, any>
  ): Promise<T | null> {
    const cacheKey = this.generateApiCacheKey(endpoint, params);

    try {
      const cachedData = await cacheService.get<{
        data: T;
        metadata: any;
      }>(cacheKey);

      if (cachedData) {
        this.stats.hits++;
        this.updateHitRate();
        return cachedData.data;
      } else {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
    } catch (error) {
      console.error('Failed to get cached API response:', error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Cache with automatic refresh
   */
  async cacheWithRefresh<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: RedisCacheOptions & { refreshThreshold?: number } = {}
  ): Promise<T> {
    const {
      ttl = this.DEFAULT_TTL,
      refreshThreshold = 0.8, // Refresh when 80% of TTL has passed
    } = options;

    // Try to get from cache first
    const cached = await cacheService.get<{
      data: T;
      cachedAt: number;
    }>(key);

    if (cached) {
      const age = Date.now() - cached.cachedAt;
      const shouldRefresh = age > (ttl * refreshThreshold);

      if (!shouldRefresh) {
        this.stats.hits++;
        this.updateHitRate();
        return cached.data;
      }

      // Background refresh
      this.backgroundRefresh(key, fetchFunction, options);
      return cached.data;
    }

    // Cache miss - fetch fresh data
    this.stats.misses++;
    this.updateHitRate();

    const freshData = await fetchFunction();
    
    await this.cacheApiResponse(key, {}, freshData, options);
    
    return freshData;
  }

  /**
   * Background refresh for cache
   */
  private async backgroundRefresh<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: RedisCacheOptions
  ): Promise<void> {
    try {
      const freshData = await fetchFunction();
      await this.cacheApiResponse(key, {}, freshData, options);
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const taggedKeys = await this.getKeysByTag(tag);
        
        for (const key of taggedKeys) {
          await cacheService.remove(key);
          this.stats.deletes++;
        }

        // Remove tag mapping
        await cacheService.remove(`tag:${tag}`);
      }
    } catch (error) {
      console.error('Failed to invalidate cache by tags:', error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      // This is a simplified implementation
      // In a real Redis implementation, you'd use SCAN with pattern matching
      const allKeys = await this.getAllCacheKeys();
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      
      const matchingKeys = allKeys.filter(key => regex.test(key));
      
      for (const key of matchingKeys) {
        await cacheService.remove(key);
        this.stats.deletes++;
      }
    } catch (error) {
      console.error('Failed to invalidate cache by pattern:', error);
    }
  }

  /**
   * Cache feed data with smart invalidation
   */
  async cacheFeedData(
    feedParams: Record<string, any>,
    feedData: any[],
    options: RedisCacheOptions = {}
  ): Promise<void> {
    const tags = [
      'feed',
      `feed:${feedParams.content_type || 'all'}`,
      `feed:${feedParams.sort || 'recent'}`,
    ];

    if (feedParams.user_id) {
      tags.push(`user:${feedParams.user_id}`);
    }

    await this.cacheApiResponse('feed', feedParams, feedData, {
      ...options,
      tags,
      ttl: options.ttl || 2 * 60 * 1000, // 2 minutes for feed
    });
  }

  /**
   * Cache user data with appropriate tags
   */
  async cacheUserData(
    userId: string,
    userData: any,
    dataType: 'profile' | 'generations' | 'credits',
    options: RedisCacheOptions = {}
  ): Promise<void> {
    const tags = [
      `user:${userId}`,
      `user:${userId}:${dataType}`,
    ];

    await this.cacheApiResponse(`user:${dataType}`, { userId }, userData, {
      ...options,
      tags,
      ttl: options.ttl || 10 * 60 * 1000, // 10 minutes for user data
    });
  }

  /**
   * Cache generation results
   */
  async cacheGenerationResult(
    jobId: string,
    result: any,
    options: RedisCacheOptions = {}
  ): Promise<void> {
    const tags = [
      'generation',
      `generation:${result.content_type}`,
      `user:${result.user_id}`,
    ];

    await this.cacheApiResponse('generation:result', { jobId }, result, {
      ...options,
      tags,
      ttl: options.ttl || 60 * 60 * 1000, // 1 hour for generation results
    });
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(warmupData: Array<{
    key: string;
    fetchFunction: () => Promise<any>;
    options?: RedisCacheOptions;
  }>): Promise<void> {
    const promises = warmupData.map(async ({ key, fetchFunction, options }) => {
      try {
        const data = await fetchFunction();
        await this.cacheApiResponse(key, {}, data, options);
      } catch (error) {
        console.error(`Failed to warm up cache for ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Generate cache key for API endpoint
   */
  private generateApiCacheKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = params[key];
        return sorted;
      }, {} as Record<string, any>);

    const paramsString = JSON.stringify(sortedParams);
    const hash = this.hashString(endpoint + paramsString);
    
    return `api:${endpoint}:${hash}`;
  }

  /**
   * Store cache tags for invalidation
   */
  private async storeCacheTags(cacheKey: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const existingKeys = await cacheService.get<string[]>(tagKey) || [];
      
      if (!existingKeys.includes(cacheKey)) {
        existingKeys.push(cacheKey);
        await cacheService.set(tagKey, existingKeys, {
          ttl: 24 * 60 * 60 * 1000, // 24 hours for tag mappings
        });
      }
    }
  }

  /**
   * Get cache keys by tag
   */
  private async getKeysByTag(tag: string): Promise<string[]> {
    const tagKey = `tag:${tag}`;
    return await cacheService.get<string[]>(tagKey) || [];
  }

  /**
   * Get all cache keys (simplified implementation)
   */
  private async getAllCacheKeys(): Promise<string[]> {
    // This is a simplified implementation
    // In a real Redis implementation, you'd use SCAN
    try {
      const stats = await cacheService.getStats();
      // This is a placeholder - you'd need to implement key enumeration
      return [];
    } catch (error) {
      console.error('Failed to get all cache keys:', error);
      return [];
    }
  }

  /**
   * Check if data should be compressed
   */
  private shouldCompress(data: any): boolean {
    const serialized = JSON.stringify(data);
    return serialized.length > this.COMPRESSION_THRESHOLD;
  }

  /**
   * Hash string for cache key generation
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalSize: 0,
    };
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      await cacheService.clear();
      this.stats.deletes += this.stats.sets;
      this.resetStats();
    } catch (error) {
      console.error('Failed to clear all cache:', error);
    }
  }
}

export const redisCacheService = new RedisCacheService();
export default redisCacheService;