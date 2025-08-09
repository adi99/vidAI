import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { createHash } from 'crypto';

export interface CompressionOptions {
  threshold?: number;
  level?: number;
  chunkSize?: number;
  windowBits?: number;
  memLevel?: number;
  strategy?: number;
  filter?: (req: Request, res: Response) => boolean;
}

class CompressionMiddleware {
  private compressionMiddleware: any;
  private cache = new Map<string, { data: Buffer; etag: string; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100; // Maximum cached responses

  constructor(options: CompressionOptions = {}) {
    this.compressionMiddleware = compression({
      threshold: options.threshold || 1024, // Only compress responses > 1KB
      level: options.level || 6, // Compression level (1-9)
      chunkSize: options.chunkSize || 16384,
      windowBits: options.windowBits || 15,
      memLevel: options.memLevel || 8,
      strategy: options.strategy || 0,
      filter: options.filter || this.shouldCompress.bind(this),
    });
  }

  /**
   * Main compression middleware
   */
  compress() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Apply compression
      this.compressionMiddleware(req, res, (err: any) => {
        if (err) return next(err);

        // Add response caching for static-like content
        this.addResponseCaching(req, res);
        
        next();
      });
    };
  }

  /**
   * Determine if response should be compressed
   */
  private shouldCompress(req: Request, res: Response): boolean {
    // Don't compress if client doesn't support it
    if (!req.headers['accept-encoding']?.includes('gzip')) {
      return false;
    }

    // Don't compress images, videos, or already compressed content
    const contentType = res.getHeader('content-type') as string;
    if (contentType) {
      const nonCompressibleTypes = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/x-rar',
        'application/pdf',
      ];

      if (nonCompressibleTypes.some(type => contentType.includes(type))) {
        return false;
      }
    }

    // Don't compress small responses
    const contentLength = res.getHeader('content-length');
    if (contentLength && parseInt(contentLength as string) < 1024) {
      return false;
    }

    // Don't compress streaming responses
    if (res.getHeader('transfer-encoding') === 'chunked') {
      return false;
    }

    return true;
  }

  /**
   * Add response caching for API responses
   */
  private addResponseCaching(req: Request, res: Response) {
    // Only cache GET requests
    if (req.method !== 'GET') return;

    // Don't cache user-specific or real-time data
    const nonCacheablePaths = [
      '/user/profile',
      '/user/credits',
      '/generate/',
      '/train/',
      '/notifications',
    ];

    if (nonCacheablePaths.some(path => req.path.includes(path))) {
      return;
    }

    const cacheKey = this.generateCacheKey(req);
    const cached = this.cache.get(cacheKey);

    // Check if we have a valid cached response
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      // Check ETag
      const clientETag = req.headers['if-none-match'];
      if (clientETag === cached.etag) {
        res.status(304).end();
        return;
      }

      // Serve cached response
      res.set('ETag', cached.etag);
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
      res.set('X-Cache', 'HIT');
      res.send(cached.data);
      return;
    }

    // Intercept response to cache it
    const originalSend = res.send.bind(res);
    res.send = (data: any) => {
      // Generate ETag
      const etag = this.generateETag(data);
      res.set('ETag', etag);
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
      res.set('X-Cache', 'MISS');

      // Cache the response
      this.cacheResponse(cacheKey, data, etag);

      return originalSend(data);
    };
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(req: Request): string {
    const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    return createHash('md5').update(key).digest('hex');
  }

  /**
   * Generate ETag for response data
   */
  private generateETag(data: any): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return `"${createHash('md5').update(content).digest('hex')}"`;
  }

  /**
   * Cache response data
   */
  private cacheResponse(key: string, data: any, etag: string) {
    // Convert data to buffer for consistent storage
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

    // Manage cache size
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldestEntries();
    }

    this.cache.set(key, {
      data: buffer,
      etag,
      timestamp: Date.now(),
    });
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldestEntries() {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL,
      entries: this.cache.size,
    };
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Create singleton instance
export const compressionMiddleware = new CompressionMiddleware({
  threshold: 1024,
  level: 6,
  filter: (req: Request, res: Response) => {
    // Custom filter logic
    return true;
  },
});

export default compressionMiddleware;