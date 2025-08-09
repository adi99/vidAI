import { Redis } from 'ioredis';
import { connection } from '../config/redis';

export interface RateLimitConfig {
    requests: number;
    windowMs: number;
    blockDurationMs?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalRequests: number;
    retryAfter?: number;
}

export interface UserRateLimitInfo {
    userId: string;
    action: string;
    currentCount: number;
    limit: number;
    windowStart: number;
    windowEnd: number;
    blocked: boolean;
    blockExpires: number | undefined;
}

/**
 * Advanced rate limiting service with Redis backend
 */
class RateLimitingService {
    private redis: Redis;

    // Rate limit configurations for different actions
    private readonly RATE_LIMITS: Record<string, RateLimitConfig> = {
        // Generation limits
        'image_generation': {
            requests: 50,
            windowMs: 60 * 60 * 1000, // 1 hour
            blockDurationMs: 15 * 60 * 1000, // 15 minutes block
        },
        'video_generation': {
            requests: 20,
            windowMs: 60 * 60 * 1000, // 1 hour
            blockDurationMs: 30 * 60 * 1000, // 30 minutes block
        },
        'training': {
            requests: 5,
            windowMs: 24 * 60 * 60 * 1000, // 24 hours
            blockDurationMs: 60 * 60 * 1000, // 1 hour block
        },

        // API limits
        'api_calls': {
            requests: 1000,
            windowMs: 60 * 60 * 1000, // 1 hour
            blockDurationMs: 5 * 60 * 1000, // 5 minutes block
        },
        'login_attempts': {
            requests: 5,
            windowMs: 15 * 60 * 1000, // 15 minutes
            blockDurationMs: 60 * 60 * 1000, // 1 hour block
        },

        // Social features
        'content_reports': {
            requests: 10,
            windowMs: 60 * 60 * 1000, // 1 hour
            blockDurationMs: 30 * 60 * 1000, // 30 minutes block
        },
        'comments': {
            requests: 100,
            windowMs: 60 * 60 * 1000, // 1 hour
            blockDurationMs: 10 * 60 * 1000, // 10 minutes block
        },
        'likes': {
            requests: 500,
            windowMs: 60 * 60 * 1000, // 1 hour
            blockDurationMs: 5 * 60 * 1000, // 5 minutes block
        },

        // Upload limits
        'image_uploads': {
            requests: 100,
            windowMs: 60 * 60 * 1000, // 1 hour
            blockDurationMs: 15 * 60 * 1000, // 15 minutes block
        },
        'training_uploads': {
            requests: 10,
            windowMs: 24 * 60 * 60 * 1000, // 24 hours
            blockDurationMs: 2 * 60 * 60 * 1000, // 2 hours block
        }
    };

    constructor() {
        this.redis = connection as Redis;
    }

    /**
     * Check if user action is within rate limits
     */
    async checkRateLimit(userId: string, action: string, ip?: string): Promise<RateLimitResult> {
        const config = this.RATE_LIMITS[action];
        if (!config) {
            throw new Error(`Unknown rate limit action: ${action}`);
        }

        const now = Date.now();
        const windowStart = now - config.windowMs;
        const key = `rate_limit:${action}:${userId}`;
        const blockKey = `rate_limit_block:${action}:${userId}`;

        try {
            // Check if user is currently blocked
            const blockExpires = await this.redis.get(blockKey);
            if (blockExpires && parseInt(blockExpires) > now) {
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: parseInt(blockExpires),
                    totalRequests: config.requests,
                    retryAfter: parseInt(blockExpires) - now
                };
            }

            // Use Redis pipeline for atomic operations
            const pipeline = this.redis.pipeline();

            // Remove old entries outside the window
            pipeline.zremrangebyscore(key, 0, windowStart);

            // Count current requests in window
            pipeline.zcard(key);

            // Add current request
            pipeline.zadd(key, now, `${now}-${Math.random()}`);

            // Set expiration for cleanup
            pipeline.expire(key, Math.ceil(config.windowMs / 1000));

            const results = await pipeline.exec();

            if (!results) {
                throw new Error('Redis pipeline failed');
            }

            const currentCount = (results[1][1] as number) || 0;
            const remaining = Math.max(0, config.requests - currentCount - 1);
            const resetTime = now + config.windowMs;

            // Check if limit exceeded
            if (currentCount >= config.requests) {
                // Block user if configured
                if (config.blockDurationMs) {
                    const blockExpires = now + config.blockDurationMs;
                    await this.redis.setex(blockKey, Math.ceil(config.blockDurationMs / 1000), blockExpires.toString());

                    // Log the rate limit violation
                    await this.logRateLimitViolation(userId, action, currentCount, config.requests, ip);

                    return {
                        allowed: false,
                        remaining: 0,
                        resetTime: blockExpires,
                        totalRequests: currentCount,
                        retryAfter: config.blockDurationMs
                    };
                }

                return {
                    allowed: false,
                    remaining: 0,
                    resetTime,
                    totalRequests: currentCount
                };
            }

            return {
                allowed: true,
                remaining,
                resetTime,
                totalRequests: currentCount + 1
            };

        } catch (error) {
            console.error('Rate limit check failed:', error);
            // Fail open - allow request if rate limiting fails
            return {
                allowed: true,
                remaining: config.requests - 1,
                resetTime: now + config.windowMs,
                totalRequests: 1
            };
        }
    }

    /**
     * Get current rate limit status for user
     */
    async getRateLimitStatus(userId: string, action: string): Promise<UserRateLimitInfo | null> {
        const config = this.RATE_LIMITS[action];
        if (!config) {
            return null;
        }

        const now = Date.now();
        const windowStart = now - config.windowMs;
        const key = `rate_limit:${action}:${userId}`;
        const blockKey = `rate_limit_block:${action}:${userId}`;

        try {
            // Check if blocked
            const blockExpires = await this.redis.get(blockKey);
            const blocked = blockExpires && parseInt(blockExpires) > now;

            // Get current count
            await this.redis.zremrangebyscore(key, 0, windowStart);
            const currentCount = await this.redis.zcard(key);

            return {
                userId,
                action,
                currentCount,
                limit: config.requests,
                windowStart,
                windowEnd: now + config.windowMs,
                blocked: !!blocked,
                blockExpires: blocked ? parseInt(blockExpires!) : undefined
            };
        } catch (error) {
            console.error('Failed to get rate limit status:', error);
            return null;
        }
    }

    /**
     * Reset rate limit for user (admin function)
     */
    async resetRateLimit(userId: string, action: string): Promise<boolean> {
        const key = `rate_limit:${action}:${userId}`;
        const blockKey = `rate_limit_block:${action}:${userId}`;

        try {
            const pipeline = this.redis.pipeline();
            pipeline.del(key);
            pipeline.del(blockKey);
            await pipeline.exec();

            console.log(`Rate limit reset for user ${userId}, action ${action}`);
            return true;
        } catch (error) {
            console.error('Failed to reset rate limit:', error);
            return false;
        }
    }

    /**
     * Get rate limit configuration
     */
    getRateLimitConfig(action: string): RateLimitConfig | null {
        return this.RATE_LIMITS[action] || null;
    }

    /**
     * Update rate limit configuration (runtime configuration)
     */
    updateRateLimitConfig(action: string, config: RateLimitConfig): void {
        this.RATE_LIMITS[action] = config;
        console.log(`Updated rate limit config for ${action}:`, config);
    }

    /**
     * Get all rate limit configurations
     */
    getAllRateLimitConfigs(): Record<string, RateLimitConfig> {
        return { ...this.RATE_LIMITS };
    }

    /**
     * Check multiple rate limits at once
     */
    async checkMultipleRateLimits(
        userId: string,
        actions: string[],
        ip?: string
    ): Promise<Record<string, RateLimitResult>> {
        const results: Record<string, RateLimitResult> = {};

        // Check all rate limits in parallel
        const promises = actions.map(async (action) => {
            const result = await this.checkRateLimit(userId, action, ip);
            return { action, result };
        });

        const resolvedResults = await Promise.all(promises);

        for (const { action, result } of resolvedResults) {
            results[action] = result;
        }

        return results;
    }

    /**
     * Log rate limit violations for monitoring
     */
    private async logRateLimitViolation(
        userId: string,
        action: string,
        currentCount: number,
        limit: number,
        ip?: string
    ): Promise<void> {
        try {
            const violation = {
                userId,
                action,
                currentCount,
                limit,
                ip,
                timestamp: new Date().toISOString(),
                severity: this.getViolationSeverity(action, currentCount, limit)
            };

            // Log to console (in production, send to monitoring service)
            console.warn('Rate limit violation:', violation);

            // Store violation in Redis for monitoring
            const violationKey = `rate_limit_violations:${userId}`;
            await this.redis.lpush(violationKey, JSON.stringify(violation));
            await this.redis.ltrim(violationKey, 0, 99); // Keep last 100 violations
            await this.redis.expire(violationKey, 7 * 24 * 60 * 60); // 7 days

        } catch (error) {
            console.error('Failed to log rate limit violation:', error);
        }
    }

    /**
     * Get violation severity based on action and excess
     */
    private getViolationSeverity(action: string, currentCount: number, limit: number): 'low' | 'medium' | 'high' {
        const excess = currentCount - limit;
        const excessRatio = excess / limit;

        // High-value actions get higher severity
        const highValueActions = ['image_generation', 'video_generation', 'training'];
        const isHighValue = highValueActions.includes(action);

        if (excessRatio > 2 || (isHighValue && excessRatio > 1)) {
            return 'high';
        } else if (excessRatio > 1 || (isHighValue && excessRatio > 0.5)) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Get user's recent rate limit violations
     */
    async getUserViolations(userId: string): Promise<any[]> {
        try {
            const violationKey = `rate_limit_violations:${userId}`;
            const violations = await this.redis.lrange(violationKey, 0, -1);

            return violations.map(v => {
                try {
                    return JSON.parse(v);
                } catch {
                    return null;
                }
            }).filter(Boolean);
        } catch (error) {
            console.error('Failed to get user violations:', error);
            return [];
        }
    }

    /**
     * Get rate limiting statistics
     */
    async getRateLimitingStats(timeframe: 'hour' | 'day' = 'hour'): Promise<any> {
        try {
            // const now = Date.now();
            // const timeframeDuration = timeframe === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            // const _since = now - timeframeDuration;

            const stats: any = {
                timeframe,
                totalViolations: 0,
                violationsByAction: {},
                violationsBySeverity: { low: 0, medium: 0, high: 0 },
                topViolators: []
            };

            // This is a simplified implementation
            // In production, you'd want to aggregate this data more efficiently

            return stats;
        } catch (error) {
            console.error('Failed to get rate limiting stats:', error);
            return null;
        }
    }

    /**
     * Clean up expired rate limit data
     */
    async cleanup(): Promise<void> {
        try {
            const now = Date.now();
            const keys = await this.redis.keys('rate_limit:*');

            for (const key of keys) {
                // Remove old entries from sorted sets
                if (!key.includes('_block:')) {
                    const oldestAllowed = now - (24 * 60 * 60 * 1000); // 24 hours
                    await this.redis.zremrangebyscore(key, 0, oldestAllowed);

                    // Remove empty keys
                    const count = await this.redis.zcard(key);
                    if (count === 0) {
                        await this.redis.del(key);
                    }
                }
            }

            console.log(`Cleaned up ${keys.length} rate limit keys`);
        } catch (error) {
            console.error('Rate limit cleanup failed:', error);
        }
    }
}

export const rateLimitingService = new RateLimitingService();