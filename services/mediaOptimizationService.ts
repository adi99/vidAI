import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { cacheService } from './cacheService';
import { supabase } from '@/lib/supabase';

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface MediaCacheOptions {
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
  compress?: boolean;
  preload?: boolean;
}

export interface PreloadOptions {
  priority?: 'low' | 'normal' | 'high';
  maxConcurrent?: number;
  prefetchThumbnails?: boolean;
}

class MediaOptimizationService {
  private readonly CACHE_DIR = `${FileSystem.cacheDirectory}media/`;
  private readonly MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200MB
  private readonly THUMBNAIL_SIZE = { width: 320, height: 180 };
  private readonly CDN_BASE_URL = 'https://cdn.yourapp.com'; // Replace with actual CDN
  
  private preloadQueue: Map<string, Promise<string>> = new Map();
  private downloadQueue: Array<{ url: string; priority: number; resolve: (path: string) => void; reject: (error: Error) => void }> = [];
  private activeDownloads = 0;
  private readonly MAX_CONCURRENT_DOWNLOADS = 3;

  constructor() {
    this.initializeCacheDirectory();
  }

  /**
   * Initialize cache directory
   */
  private async initializeCacheDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to initialize cache directory:', error);
    }
  }

  /**
   * Get optimized media URL with CDN and quality parameters
   */
  getOptimizedUrl(originalUrl: string, options: MediaCacheOptions = {}): string {
    const {
      quality = 'medium',
      maxWidth,
      maxHeight,
      compress = true,
    } = options;

    // If it's already a CDN URL, return as is
    if (originalUrl.includes(this.CDN_BASE_URL)) {
      return originalUrl;
    }

    // For Supabase storage URLs, add transformation parameters
    if (originalUrl.includes('supabase')) {
      const url = new URL(originalUrl);
      const params = new URLSearchParams();
      
      if (maxWidth) params.append('width', maxWidth.toString());
      if (maxHeight) params.append('height', maxHeight.toString());
      if (quality !== 'high') params.append('quality', quality === 'low' ? '60' : '80');
      if (compress) params.append('format', 'webp');
      
      if (params.toString()) {
        url.search = params.toString();
      }
      
      return url.toString();
    }

    return originalUrl;
  }

  /**
   * Get cached media path or download if not cached
   */
  async getCachedMedia(url: string, options: MediaCacheOptions = {}): Promise<string> {
    const cacheKey = this.getCacheKey(url, options);
    const cachedPath = await this.getCachedFilePath(cacheKey);
    
    if (cachedPath) {
      return cachedPath;
    }

    // Download and cache the media
    return this.downloadAndCache(url, cacheKey, options);
  }

  /**
   * Preload media for smooth playback
   */
  async preloadMedia(
    mediaItems: MediaItem[],
    options: PreloadOptions = {}
  ): Promise<void> {
    const {
      priority = 'normal',
      maxConcurrent = 2,
      prefetchThumbnails = true,
    } = options;

    const preloadPromises: Promise<void>[] = [];
    let concurrent = 0;

    for (const item of mediaItems) {
      if (concurrent >= maxConcurrent) {
        // Wait for one to complete before starting the next
        await Promise.race(preloadPromises);
        concurrent--;
      }

      const preloadPromise = this.preloadSingleMedia(item, {
        priority,
        prefetchThumbnails,
      });
      
      preloadPromises.push(preloadPromise);
      concurrent++;
    }

    // Wait for all preloads to complete
    await Promise.allSettled(preloadPromises);
  }

  /**
   * Preload single media item
   */
  private async preloadSingleMedia(
    item: MediaItem,
    options: { priority: string; prefetchThumbnails: boolean }
  ): Promise<void> {
    try {
      // Preload thumbnail first for faster initial display
      if (options.prefetchThumbnails && item.thumbnail) {
        await this.getCachedMedia(item.thumbnail, {
          quality: 'low',
          maxWidth: this.THUMBNAIL_SIZE.width,
          maxHeight: this.THUMBNAIL_SIZE.height,
        });
      }

      // Preload main media
      const mediaOptions: MediaCacheOptions = {
        quality: item.type === 'video' ? 'medium' : 'high',
        preload: true,
      };

      await this.getCachedMedia(item.url, mediaOptions);
    } catch (error) {
      console.error(`Failed to preload media ${item.id}:`, error);
    }
  }

  /**
   * Lazy load media with progressive quality
   */
  async lazyLoadMedia(
    url: string,
    onProgress?: (progress: number) => void
  ): Promise<{ lowQuality: string; highQuality: string }> {
    const lowQualityUrl = this.getOptimizedUrl(url, { quality: 'low' });
    const highQualityUrl = this.getOptimizedUrl(url, { quality: 'high' });

    // Load low quality first
    const lowQualityPromise = this.getCachedMedia(lowQualityUrl, { quality: 'low' });
    
    // Start high quality download in background
    const highQualityPromise = this.getCachedMedia(highQualityUrl, { quality: 'high' });

    const lowQuality = await lowQualityPromise;
    onProgress?.(50);

    const highQuality = await highQualityPromise;
    onProgress?.(100);

    return { lowQuality, highQuality };
  }

  /**
   * Get video thumbnail
   */
  async getVideoThumbnail(videoUrl: string): Promise<string> {
    const thumbnailKey = `thumb_${this.getCacheKey(videoUrl, {})}`;
    const cachedThumbnail = await this.getCachedFilePath(thumbnailKey);
    
    if (cachedThumbnail) {
      return cachedThumbnail;
    }

    // Generate thumbnail from video
    return this.generateVideoThumbnail(videoUrl, thumbnailKey);
  }

  /**
   * Generate video thumbnail
   */
  private async generateVideoThumbnail(videoUrl: string, cacheKey: string): Promise<string> {
    try {
      // For now, return a placeholder or use a service to generate thumbnails
      // In a real implementation, you might use FFmpeg or a cloud service
      const thumbnailPath = `${this.CACHE_DIR}${cacheKey}.jpg`;
      
      // Placeholder implementation - in reality, you'd extract a frame from the video
      // For now, we'll cache the video URL as a reference
      await cacheService.set(`thumbnail_${cacheKey}`, videoUrl, { ttl: 7 * 24 * 60 * 60 * 1000 });
      
      return videoUrl; // Return original URL as fallback
    } catch (error) {
      console.error('Failed to generate video thumbnail:', error);
      return videoUrl;
    }
  }

  /**
   * Download and cache media file
   */
  private async downloadAndCache(
    url: string,
    cacheKey: string,
    options: MediaCacheOptions
  ): Promise<string> {
    const optimizedUrl = this.getOptimizedUrl(url, options);
    const filePath = `${this.CACHE_DIR}${cacheKey}`;

    // Check if already in preload queue
    if (this.preloadQueue.has(cacheKey)) {
      return this.preloadQueue.get(cacheKey)!;
    }

    const downloadPromise = this.queueDownload(optimizedUrl, filePath);
    this.preloadQueue.set(cacheKey, downloadPromise);

    try {
      const result = await downloadPromise;
      
      // Cache metadata
      await cacheService.cacheMediaMetadata(cacheKey, {
        originalUrl: url,
        cachedPath: result,
        downloadedAt: Date.now(),
        options,
      });

      return result;
    } finally {
      this.preloadQueue.delete(cacheKey);
    }
  }

  /**
   * Queue download with priority and concurrency control
   */
  private async queueDownload(url: string, filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.downloadQueue.push({
        url,
        priority: 1, // Higher number = higher priority
        resolve: (path: string) => resolve(path),
        reject: (error: Error) => reject(error),
      });

      this.processDownloadQueue();
    });
  }

  /**
   * Process download queue with concurrency control
   */
  private async processDownloadQueue(): Promise<void> {
    if (this.activeDownloads >= this.MAX_CONCURRENT_DOWNLOADS || this.downloadQueue.length === 0) {
      return;
    }

    // Sort by priority (highest first)
    this.downloadQueue.sort((a, b) => b.priority - a.priority);
    
    const download = this.downloadQueue.shift();
    if (!download) return;

    this.activeDownloads++;

    try {
      const downloadResult = await FileSystem.downloadAsync(
        download.url,
        `${this.CACHE_DIR}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );

      if (downloadResult.status === 200) {
        download.resolve(downloadResult.uri);
      } else {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (error) {
      download.reject(error as Error);
    } finally {
      this.activeDownloads--;
      // Process next item in queue
      this.processDownloadQueue();
    }
  }

  /**
   * Get cached file path if exists
   */
  private async getCachedFilePath(cacheKey: string): Promise<string | null> {
    try {
      const metadata = await cacheService.getCachedMediaMetadata(cacheKey);
      if (metadata?.cachedPath) {
        const fileInfo = await FileSystem.getInfoAsync(metadata.cachedPath);
        if (fileInfo.exists) {
          return metadata.cachedPath;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate cache key for media item
   */
  private getCacheKey(url: string, options: MediaCacheOptions): string {
    const optionsString = JSON.stringify(options);
    const hash = this.simpleHash(url + optionsString);
    return `media_${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear media cache
   */
  async clearCache(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.CACHE_DIR, { idempotent: true });
        await this.initializeCacheDirectory();
      }
      
      // Clear metadata cache
      await cacheService.clear();
    } catch (error) {
      console.error('Failed to clear media cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    fileCount: number;
    oldestFile: number;
    newestFile: number;
  }> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (!dirInfo.exists) {
        return { totalSize: 0, fileCount: 0, oldestFile: 0, newestFile: 0 };
      }

      const files = await FileSystem.readDirectoryAsync(this.CACHE_DIR);
      let totalSize = 0;
      let oldestFile = Date.now();
      let newestFile = 0;

      for (const file of files) {
        const filePath = `${this.CACHE_DIR}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists && 'size' in fileInfo && fileInfo.size) {
          totalSize += fileInfo.size;
          
          if ('modificationTime' in fileInfo && fileInfo.modificationTime) {
            const modTime = fileInfo.modificationTime * 1000; // Convert to milliseconds
            oldestFile = Math.min(oldestFile, modTime);
            newestFile = Math.max(newestFile, modTime);
          }
        }
      }

      return {
        totalSize,
        fileCount: files.length,
        oldestFile: oldestFile === Date.now() ? 0 : oldestFile,
        newestFile,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { totalSize: 0, fileCount: 0, oldestFile: 0, newestFile: 0 };
    }
  }

  /**
   * Cleanup old cache files
   */
  async cleanupCache(): Promise<void> {
    try {
      const stats = await this.getCacheStats();
      
      if (stats.totalSize > this.MAX_CACHE_SIZE) {
        const files = await FileSystem.readDirectoryAsync(this.CACHE_DIR);
        
        // Get file info with modification times
        const fileInfos = await Promise.all(
          files.map(async (file) => {
            const filePath = `${this.CACHE_DIR}${file}`;
            const info = await FileSystem.getInfoAsync(filePath);
            return {
              name: file,
              path: filePath,
              modificationTime: ('modificationTime' in info) ? info.modificationTime || 0 : 0,
              size: ('size' in info) ? info.size || 0 : 0,
            };
          })
        );

        // Sort by modification time (oldest first)
        fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);

        // Delete oldest files until under size limit
        let currentSize = stats.totalSize;
        for (const fileInfo of fileInfos) {
          if (currentSize <= this.MAX_CACHE_SIZE * 0.8) { // Keep 20% buffer
            break;
          }

          await FileSystem.deleteAsync(fileInfo.path, { idempotent: true });
          currentSize -= fileInfo.size;
        }
      }
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  /**
   * Prefetch media for feed items
   */
  async prefetchFeedMedia(feedItems: MediaItem[]): Promise<void> {
    // Prefetch thumbnails first (high priority)
    const thumbnailItems = feedItems
      .filter(item => item.thumbnail)
      .map(item => ({
        ...item,
        url: item.thumbnail!,
        type: 'image' as const,
      }));

    await this.preloadMedia(thumbnailItems, {
      priority: 'high',
      maxConcurrent: 3,
      prefetchThumbnails: false,
    });

    // Prefetch first few videos/images (medium priority)
    const mainItems = feedItems.slice(0, 3);
    await this.preloadMedia(mainItems, {
      priority: 'normal',
      maxConcurrent: 2,
      prefetchThumbnails: false,
    });
  }
}

export const mediaOptimizationService = new MediaOptimizationService();
export default mediaOptimizationService;