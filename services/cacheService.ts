import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedItem } from './socialService';

export interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string;
  compress?: boolean;
}

class CacheService {
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_VERSION = '1.0.0';
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  private memoryCache = new Map<string, CacheItem>();

  /**
   * Set cache item
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const {
      ttl = this.DEFAULT_TTL,
      version = this.CACHE_VERSION,
      compress = false,
    } = options;

    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      version,
    };

    try {
      // Store in memory cache
      this.memoryCache.set(key, cacheItem);

      // Store in persistent storage
      const serialized = JSON.stringify(cacheItem);
      await AsyncStorage.setItem(`cache_${key}`, serialized);

      // Clean up old cache items periodically
      if (Math.random() < 0.1) { // 10% chance
        this.cleanupExpiredItems();
      }
    } catch (error) {
      console.error('Failed to set cache item:', error);
    }
  }

  /**
   * Get cache item
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem && this.isValidCacheItem(memoryItem)) {
        return memoryItem.data as T;
      }

      // Check persistent storage
      const serialized = await AsyncStorage.getItem(`cache_${key}`);
      if (!serialized) {
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(serialized);
      
      if (!this.isValidCacheItem(cacheItem)) {
        // Remove expired item
        await this.remove(key);
        return null;
      }

      // Update memory cache
      this.memoryCache.set(key, cacheItem);
      
      return cacheItem.data;
    } catch (error) {
      console.error('Failed to get cache item:', error);
      return null;
    }
  }

  /**
   * Remove cache item
   */
  async remove(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.error('Failed to remove cache item:', error);
    }
  }

  /**
   * Check if cache item exists and is valid
   */
  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      
      // Get all cache keys
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_'));
      
      // Remove all cache items
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memoryItems: number;
    persistentItems: number;
    totalSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_'));
      
      let totalSize = 0;
      for (const key of cacheKeys) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      }

      return {
        memoryItems: this.memoryCache.size,
        persistentItems: cacheKeys.length,
        totalSize,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        memoryItems: 0,
        persistentItems: 0,
        totalSize: 0,
      };
    }
  }

  /**
   * Cache feed data
   */
  async cacheFeedData(
    feedKey: string,
    feedItems: FeedItem[],
    ttl: number = 30 * 60 * 1000 // 30 minutes
  ): Promise<void> {
    await this.set(`feed_${feedKey}`, feedItems, { ttl });
  }

  /**
   * Get cached feed data
   */
  async getCachedFeedData(feedKey: string): Promise<FeedItem[] | null> {
    return this.get<FeedItem[]>(`feed_${feedKey}`);
  }

  /**
   * Cache user profile data
   */
  async cacheUserProfile(
    userId: string,
    profileData: any,
    ttl: number = 60 * 60 * 1000 // 1 hour
  ): Promise<void> {
    await this.set(`profile_${userId}`, profileData, { ttl });
  }

  /**
   * Get cached user profile
   */
  async getCachedUserProfile(userId: string): Promise<any | null> {
    return this.get(`profile_${userId}`);
  }

  /**
   * Cache generation history
   */
  async cacheGenerationHistory(
    userId: string,
    history: any[],
    ttl: number = 60 * 60 * 1000 // 1 hour
  ): Promise<void> {
    await this.set(`generation_history_${userId}`, history, { ttl });
  }

  /**
   * Get cached generation history
   */
  async getCachedGenerationHistory(userId: string): Promise<any[] | null> {
    return this.get(`generation_history_${userId}`);
  }

  /**
   * Cache media file metadata
   */
  async cacheMediaMetadata(
    mediaId: string,
    metadata: any,
    ttl: number = 7 * 24 * 60 * 60 * 1000 // 7 days
  ): Promise<void> {
    await this.set(`media_${mediaId}`, metadata, { ttl });
  }

  /**
   * Get cached media metadata
   */
  async getCachedMediaMetadata(mediaId: string): Promise<any | null> {
    return this.get(`media_${mediaId}`);
  }

  /**
   * Cache with automatic refresh
   */
  async getOrFetch<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const freshData = await fetchFunction();
    
    // Cache the fresh data
    await this.set(key, freshData, options);
    
    return freshData;
  }

  /**
   * Prefetch data for offline use
   */
  async prefetchData(
    prefetchList: Array<{
      key: string;
      fetchFunction: () => Promise<any>;
      options?: CacheOptions;
    }>
  ): Promise<void> {
    const promises = prefetchList.map(async ({ key, fetchFunction, options }) => {
      try {
        // Only fetch if not already cached
        const exists = await this.has(key);
        if (!exists) {
          const data = await fetchFunction();
          await this.set(key, data, options);
        }
      } catch (error) {
        console.error(`Failed to prefetch ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Check if cache item is valid
   */
  private isValidCacheItem(item: CacheItem): boolean {
    const now = Date.now();
    
    // Check expiration
    if (item.expiresAt < now) {
      return false;
    }

    // Check version compatibility
    if (item.version !== this.CACHE_VERSION) {
      return false;
    }

    return true;
  }

  /**
   * Clean up expired cache items
   */
  private async cleanupExpiredItems(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_'));
      
      const expiredKeys: string[] = [];
      
      for (const key of cacheKeys) {
        const serialized = await AsyncStorage.getItem(key);
        if (serialized) {
          try {
            const cacheItem: CacheItem = JSON.parse(serialized);
            if (!this.isValidCacheItem(cacheItem)) {
              expiredKeys.push(key);
              // Also remove from memory cache
              const memoryKey = key.replace('cache_', '');
              this.memoryCache.delete(memoryKey);
            }
          } catch {
            // Invalid JSON, mark for deletion
            expiredKeys.push(key);
          }
        }
      }

      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
        console.log(`Cleaned up ${expiredKeys.length} expired cache items`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired cache items:', error);
    }
  }

  /**
   * Manage cache size
   */
  private async manageCacheSize(): Promise<void> {
    try {
      const stats = await this.getStats();
      
      if (stats.totalSize > this.MAX_CACHE_SIZE) {
        // Remove oldest items until under size limit
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key => key.startsWith('cache_'));
        
        // Get all cache items with timestamps
        const itemsWithTimestamps: Array<{ key: string; timestamp: number }> = [];
        
        for (const key of cacheKeys) {
          const serialized = await AsyncStorage.getItem(key);
          if (serialized) {
            try {
              const cacheItem: CacheItem = JSON.parse(serialized);
              itemsWithTimestamps.push({
                key,
                timestamp: cacheItem.timestamp,
              });
            } catch {
              // Invalid item, mark for deletion
              itemsWithTimestamps.push({
                key,
                timestamp: 0,
              });
            }
          }
        }

        // Sort by timestamp (oldest first)
        itemsWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);
        
        // Remove oldest 25% of items
        const itemsToRemove = itemsWithTimestamps.slice(0, Math.ceil(itemsWithTimestamps.length * 0.25));
        const keysToRemove = itemsToRemove.map(item => item.key);
        
        await AsyncStorage.multiRemove(keysToRemove);
        
        // Also remove from memory cache
        keysToRemove.forEach(key => {
          const memoryKey = key.replace('cache_', '');
          this.memoryCache.delete(memoryKey);
        });
        
        console.log(`Removed ${keysToRemove.length} cache items to manage size`);
      }
    } catch (error) {
      console.error('Failed to manage cache size:', error);
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;