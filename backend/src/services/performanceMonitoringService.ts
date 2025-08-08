import { logger } from '../config/logger';
import { queues, getQueueStats } from '../queues';

export interface PerformanceMetrics {
  timestamp: number;
  apiResponseTimes: Record<string, number[]>;
  generationSuccessRates: Record<string, { success: number; total: number }>;
  queueMetrics: Record<string, any>;
  systemMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
  errorRates: Record<string, { errors: number; total: number }>;
}

export interface GenerationMetrics {
  type: 'image' | 'video' | 'training';
  model: string;
  userId: string;
  startTime: number;
  endTime?: number;
  queueTime: number;
  processingTime?: number | undefined;
  success: boolean;
  errorType?: string | undefined;
  creditsUsed: number;
  settings: Record<string, any>;
}

export interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  success: boolean;
  userId?: string | undefined;
  timestamp: number;
  errorType?: string | undefined;
}

class BackendPerformanceMonitoringService {
  private metrics: PerformanceMetrics[] = [];
  private generationMetrics: GenerationMetrics[] = [];
  private apiMetrics: APIMetrics[] = [];
  private readonly MAX_METRICS = 10000;
  private readonly METRICS_RETENTION_HOURS = 24;
  
  // Performance thresholds
  private readonly THRESHOLDS = {
    API_RESPONSE_TIME_WARNING: 1000, // 1 second
    API_RESPONSE_TIME_CRITICAL: 3000, // 3 seconds
    GENERATION_SUCCESS_RATE_WARNING: 90, // 90%
    GENERATION_SUCCESS_RATE_CRITICAL: 80, // 80%
    QUEUE_SIZE_WARNING: 100,
    QUEUE_SIZE_CRITICAL: 500,
    ERROR_RATE_WARNING: 5, // 5%
    ERROR_RATE_CRITICAL: 10, // 10%
  };

  constructor() {
    // Start periodic metrics collection
    this.startMetricsCollection();
    
    // Clean up old metrics periodically
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Record API performance metrics
   */
  recordAPIMetrics(metrics: APIMetrics): void {
    this.apiMetrics.push(metrics);
    this.trimAPIMetrics();

    // Log slow API responses
    if (metrics.responseTime > this.THRESHOLDS.API_RESPONSE_TIME_WARNING) {
      logger.warn('Slow API response detected', {
        endpoint: metrics.endpoint,
        method: metrics.method,
        responseTime: metrics.responseTime,
        statusCode: metrics.statusCode,
        userId: metrics.userId,
      });
    }

    // Log API errors
    if (!metrics.success) {
      logger.error('API request failed', {
        endpoint: metrics.endpoint,
        method: metrics.method,
        statusCode: metrics.statusCode,
        responseTime: metrics.responseTime,
        errorType: metrics.errorType,
        userId: metrics.userId,
      });
    }
  }

  /**
   * Record generation performance metrics
   */
  recordGenerationMetrics(metrics: GenerationMetrics): void {
    this.generationMetrics.push(metrics);
    this.trimGenerationMetrics();

    const totalTime = metrics.endTime ? metrics.endTime - metrics.startTime : 0;

    // Log generation completion
    logger.info('Generation completed', {
      type: metrics.type,
      model: metrics.model,
      userId: metrics.userId,
      success: metrics.success,
      totalTime,
      queueTime: metrics.queueTime,
      processingTime: metrics.processingTime,
      creditsUsed: metrics.creditsUsed,
      errorType: metrics.errorType,
    });

    // Log generation failures
    if (!metrics.success) {
      logger.error('Generation failed', {
        type: metrics.type,
        model: metrics.model,
        userId: metrics.userId,
        errorType: metrics.errorType,
        totalTime,
        settings: metrics.settings,
      });
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  async getPerformanceStats(): Promise<{
    api: {
      averageResponseTime: number;
      successRate: number;
      slowEndpoints: Array<{ endpoint: string; averageTime: number }>;
      errorRate: number;
    };
    generation: {
      successRates: Record<string, number>;
      averageProcessingTimes: Record<string, number>;
      queueTimes: Record<string, number>;
      failureReasons: Record<string, number>;
    };
    queues: Record<string, any>;
    system: {
      memoryUsage: number;
      activeConnections: number;
      uptime: number;
    };
    alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      metric: string;
      value: number;
      threshold: number;
    }>;
  }> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Filter recent metrics
    const recentAPIMetrics = this.apiMetrics.filter(m => m.timestamp > oneHourAgo);
    const recentGenerationMetrics = this.generationMetrics.filter(m => m.startTime > oneHourAgo);

    // Calculate API statistics
    const apiStats = this.calculateAPIStats(recentAPIMetrics);
    
    // Calculate generation statistics
    const generationStats = this.calculateGenerationStats(recentGenerationMetrics);
    
    // Get queue statistics
    const queueStats = await this.getQueueStats();
    
    // Get system statistics
    const systemStats = this.getSystemStats();
    
    // Generate alerts
    const alerts = this.generateAlerts(apiStats, generationStats, queueStats, systemStats);

    return {
      api: apiStats,
      generation: generationStats,
      queues: queueStats,
      system: systemStats,
      alerts,
    };
  }

  /**
   * Calculate API performance statistics
   */
  private calculateAPIStats(metrics: APIMetrics[]) {
    if (metrics.length === 0) {
      return {
        averageResponseTime: 0,
        successRate: 100,
        slowEndpoints: [],
        errorRate: 0,
      };
    }

    const totalResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
    const successfulRequests = metrics.filter(m => m.success).length;
    const errorRate = ((metrics.length - successfulRequests) / metrics.length) * 100;

    // Group by endpoint for slow endpoint analysis
    const endpointGroups = metrics.reduce((groups, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric.responseTime);
      return groups;
    }, {} as Record<string, number[]>);

    const slowEndpoints = Object.entries(endpointGroups)
      .map(([endpoint, times]) => ({
        endpoint,
        averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      }))
      .filter(e => e.averageTime > this.THRESHOLDS.API_RESPONSE_TIME_WARNING)
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    return {
      averageResponseTime: totalResponseTime / metrics.length,
      successRate: (successfulRequests / metrics.length) * 100,
      slowEndpoints,
      errorRate,
    };
  }

  /**
   * Calculate generation performance statistics
   */
  private calculateGenerationStats(metrics: GenerationMetrics[]) {
    if (metrics.length === 0) {
      return {
        successRates: {},
        averageProcessingTimes: {},
        queueTimes: {},
        failureReasons: {},
      };
    }

    // Group by generation type
    const typeGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.type]) {
        groups[metric.type] = [];
      }
      groups[metric.type].push(metric);
      return groups;
    }, {} as Record<string, GenerationMetrics[]>);

    const successRates = Object.entries(typeGroups).reduce((rates, [type, typeMetrics]) => {
      const successful = typeMetrics.filter(m => m.success).length;
      rates[type] = (successful / typeMetrics.length) * 100;
      return rates;
    }, {} as Record<string, number>);

    const averageProcessingTimes = Object.entries(typeGroups).reduce((times, [type, typeMetrics]) => {
      const successfulMetrics = typeMetrics.filter(m => m.success && m.processingTime);
      if (successfulMetrics.length > 0) {
        const totalTime = successfulMetrics.reduce((sum, m) => sum + (m.processingTime || 0), 0);
        times[type] = totalTime / successfulMetrics.length;
      } else {
        times[type] = 0;
      }
      return times;
    }, {} as Record<string, number>);

    const queueTimes = Object.entries(typeGroups).reduce((times, [type, typeMetrics]) => {
      const totalQueueTime = typeMetrics.reduce((sum, m) => sum + m.queueTime, 0);
      times[type] = totalQueueTime / typeMetrics.length;
      return times;
    }, {} as Record<string, number>);

    const failureReasons = metrics
      .filter(m => !m.success && m.errorType)
      .reduce((reasons, metric) => {
        const reason = metric.errorType!;
        reasons[reason] = (reasons[reason] || 0) + 1;
        return reasons;
      }, {} as Record<string, number>);

    return {
      successRates,
      averageProcessingTimes,
      queueTimes,
      failureReasons,
    };
  }

  /**
   * Get queue statistics
   */
  private async getQueueStats(): Promise<Record<string, any>> {
    try {
      const queueNames = Object.keys(queues);
      const stats = await Promise.all(queueNames.map(name => getQueueStats(name)));
      
      return queueNames.reduce((result, name, index) => {
        result[name] = stats[index];
        return result;
      }, {} as Record<string, any>);
    } catch (error) {
      logger.error('Failed to get queue stats', { error });
      return {};
    }
  }

  /**
   * Get system statistics
   */
  private getSystemStats() {
    const memoryUsage = process.memoryUsage();
    
    return {
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      activeConnections: 0, // Would need to track this separately
      uptime: process.uptime(),
    };
  }

  /**
   * Generate performance alerts
   */
  private generateAlerts(
    apiStats: any,
    generationStats: any,
    queueStats: Record<string, any>,
    _systemStats: any
  ) {
    const alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      metric: string;
      value: number;
      threshold: number;
    }> = [];

    // API response time alerts
    if (apiStats.averageResponseTime > this.THRESHOLDS.API_RESPONSE_TIME_CRITICAL) {
      alerts.push({
        type: 'critical',
        message: 'Critical API response time detected',
        metric: 'api_response_time',
        value: apiStats.averageResponseTime,
        threshold: this.THRESHOLDS.API_RESPONSE_TIME_CRITICAL,
      });
    } else if (apiStats.averageResponseTime > this.THRESHOLDS.API_RESPONSE_TIME_WARNING) {
      alerts.push({
        type: 'warning',
        message: 'High API response time detected',
        metric: 'api_response_time',
        value: apiStats.averageResponseTime,
        threshold: this.THRESHOLDS.API_RESPONSE_TIME_WARNING,
      });
    }

    // Error rate alerts
    if (apiStats.errorRate > this.THRESHOLDS.ERROR_RATE_CRITICAL) {
      alerts.push({
        type: 'critical',
        message: 'Critical API error rate detected',
        metric: 'api_error_rate',
        value: apiStats.errorRate,
        threshold: this.THRESHOLDS.ERROR_RATE_CRITICAL,
      });
    } else if (apiStats.errorRate > this.THRESHOLDS.ERROR_RATE_WARNING) {
      alerts.push({
        type: 'warning',
        message: 'High API error rate detected',
        metric: 'api_error_rate',
        value: apiStats.errorRate,
        threshold: this.THRESHOLDS.ERROR_RATE_WARNING,
      });
    }

    // Generation success rate alerts
    Object.entries(generationStats.successRates).forEach(([type, rate]) => {
      const rateValue = typeof rate === 'number' ? rate : 0;
      if (rateValue < this.THRESHOLDS.GENERATION_SUCCESS_RATE_CRITICAL) {
        alerts.push({
          type: 'critical',
          message: `Critical ${type} generation success rate`,
          metric: `${type}_success_rate`,
          value: rateValue,
          threshold: this.THRESHOLDS.GENERATION_SUCCESS_RATE_CRITICAL,
        });
      } else if (rateValue < this.THRESHOLDS.GENERATION_SUCCESS_RATE_WARNING) {
        alerts.push({
          type: 'warning',
          message: `Low ${type} generation success rate`,
          metric: `${type}_success_rate`,
          value: rateValue,
          threshold: this.THRESHOLDS.GENERATION_SUCCESS_RATE_WARNING,
        });
      }
    });

    // Queue size alerts
    Object.entries(queueStats).forEach(([queueName, stats]) => {
      if (stats && stats.waiting > this.THRESHOLDS.QUEUE_SIZE_CRITICAL) {
        alerts.push({
          type: 'critical',
          message: `Critical queue size for ${queueName}`,
          metric: `${queueName}_queue_size`,
          value: stats.waiting,
          threshold: this.THRESHOLDS.QUEUE_SIZE_CRITICAL,
        });
      } else if (stats && stats.waiting > this.THRESHOLDS.QUEUE_SIZE_WARNING) {
        alerts.push({
          type: 'warning',
          message: `High queue size for ${queueName}`,
          metric: `${queueName}_queue_size`,
          value: stats.waiting,
          threshold: this.THRESHOLDS.QUEUE_SIZE_WARNING,
        });
      }
    });

    return alerts;
  }

  /**
   * Get generation success rates by time period
   */
  async getGenerationSuccessRates(hours: number = 24): Promise<Record<string, {
    hourly: Array<{ hour: number; successRate: number; total: number }>;
    overall: number;
  }>> {
    const now = Date.now();
    const startTime = now - (hours * 60 * 60 * 1000);
    
    const metrics = this.generationMetrics.filter(m => m.startTime > startTime);
    
    // Group by type and hour
    const typeGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.type]) {
        groups[metric.type] = [];
      }
      groups[metric.type].push(metric);
      return groups;
    }, {} as Record<string, GenerationMetrics[]>);

    const result: Record<string, {
      hourly: Array<{ hour: number; successRate: number; total: number }>;
      overall: number;
    }> = {};

    Object.entries(typeGroups).forEach(([type, typeMetrics]) => {
      // Group by hour
      const hourlyGroups = typeMetrics.reduce((groups, metric) => {
        const hour = Math.floor(metric.startTime / (60 * 60 * 1000));
        if (!groups[hour]) {
          groups[hour] = [];
        }
        groups[hour].push(metric);
        return groups;
      }, {} as Record<number, GenerationMetrics[]>);

      const hourly = Object.entries(hourlyGroups).map(([hour, hourMetrics]) => {
        const successful = hourMetrics.filter(m => m.success).length;
        return {
          hour: parseInt(hour),
          successRate: (successful / hourMetrics.length) * 100,
          total: hourMetrics.length,
        };
      }).sort((a, b) => a.hour - b.hour);

      const successful = typeMetrics.filter(m => m.success).length;
      const overall = typeMetrics.length > 0 ? (successful / typeMetrics.length) * 100 : 100;

      result[type] = { hourly, overall };
    });

    return result;
  }

  /**
   * Get API performance trends
   */
  getAPIPerformanceTrends(hours: number = 24): {
    responseTime: Array<{ hour: number; averageTime: number; requests: number }>;
    errorRate: Array<{ hour: number; errorRate: number; requests: number }>;
  } {
    const now = Date.now();
    const startTime = now - (hours * 60 * 60 * 1000);
    
    const metrics = this.apiMetrics.filter(m => m.timestamp > startTime);
    
    // Group by hour
    const hourlyGroups = metrics.reduce((groups, metric) => {
      const hour = Math.floor(metric.timestamp / (60 * 60 * 1000));
      if (!groups[hour]) {
        groups[hour] = [];
      }
      groups[hour].push(metric);
      return groups;
    }, {} as Record<number, APIMetrics[]>);

    const responseTime = Object.entries(hourlyGroups).map(([hour, hourMetrics]) => {
      const totalTime = hourMetrics.reduce((sum, m) => sum + m.responseTime, 0);
      return {
        hour: parseInt(hour),
        averageTime: totalTime / hourMetrics.length,
        requests: hourMetrics.length,
      };
    }).sort((a, b) => a.hour - b.hour);

    const errorRate = Object.entries(hourlyGroups).map(([hour, hourMetrics]) => {
      const errors = hourMetrics.filter(m => !m.success).length;
      return {
        hour: parseInt(hour),
        errorRate: (errors / hourMetrics.length) * 100,
        requests: hourMetrics.length,
      };
    }).sort((a, b) => a.hour - b.hour);

    return { responseTime, errorRate };
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    // Collect system metrics every 5 minutes
    setInterval(async () => {
      try {
        const timestamp = Date.now();
        const queueStats = await this.getQueueStats();
        const systemStats = this.getSystemStats();
        
        // Store aggregated metrics
        const metric: PerformanceMetrics = {
          timestamp,
          apiResponseTimes: this.getRecentAPIResponseTimes(),
          generationSuccessRates: this.getRecentGenerationSuccessRates(),
          queueMetrics: queueStats,
          systemMetrics: {
            memoryUsage: systemStats.memoryUsage,
            cpuUsage: 0, // Would need additional monitoring
            activeConnections: systemStats.activeConnections,
          },
          errorRates: this.getRecentErrorRates(),
        };

        this.metrics.push(metric);
        this.trimMetrics();

        logger.info('Metrics collected', {
          timestamp,
          memoryUsage: systemStats.memoryUsage,
          queueCount: Object.keys(queueStats).length,
        });
      } catch (error) {
        logger.error('Failed to collect metrics', { error });
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get recent API response times grouped by endpoint
   */
  private getRecentAPIResponseTimes(): Record<string, number[]> {
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    const recentMetrics = this.apiMetrics.filter(m => m.timestamp > fifteenMinutesAgo);
    
    return recentMetrics.reduce((groups, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric.responseTime);
      return groups;
    }, {} as Record<string, number[]>);
  }

  /**
   * Get recent generation success rates
   */
  private getRecentGenerationSuccessRates(): Record<string, { success: number; total: number }> {
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    const recentMetrics = this.generationMetrics.filter(m => m.startTime > fifteenMinutesAgo);
    
    return recentMetrics.reduce((rates, metric) => {
      if (!rates[metric.type]) {
        rates[metric.type] = { success: 0, total: 0 };
      }
      rates[metric.type].total++;
      if (metric.success) {
        rates[metric.type].success++;
      }
      return rates;
    }, {} as Record<string, { success: number; total: number }>);
  }

  /**
   * Get recent error rates by endpoint
   */
  private getRecentErrorRates(): Record<string, { errors: number; total: number }> {
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    const recentMetrics = this.apiMetrics.filter(m => m.timestamp > fifteenMinutesAgo);
    
    return recentMetrics.reduce((rates, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!rates[key]) {
        rates[key] = { errors: 0, total: 0 };
      }
      rates[key].total++;
      if (!metric.success) {
        rates[key].errors++;
      }
      return rates;
    }, {} as Record<string, { errors: number; total: number }>);
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.METRICS_RETENTION_HOURS * 60 * 60 * 1000);
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
    this.apiMetrics = this.apiMetrics.filter(m => m.timestamp > cutoffTime);
    this.generationMetrics = this.generationMetrics.filter(m => m.startTime > cutoffTime);
    
    logger.info('Old metrics cleaned up', {
      metricsCount: this.metrics.length,
      apiMetricsCount: this.apiMetrics.length,
      generationMetricsCount: this.generationMetrics.length,
    });
  }

  /**
   * Trim metrics arrays to prevent memory issues
   */
  private trimMetrics(): void {
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS / 2);
    }
  }

  private trimAPIMetrics(): void {
    if (this.apiMetrics.length > this.MAX_METRICS) {
      this.apiMetrics = this.apiMetrics.slice(-this.MAX_METRICS / 2);
    }
  }

  private trimGenerationMetrics(): void {
    if (this.generationMetrics.length > this.MAX_METRICS) {
      this.generationMetrics = this.generationMetrics.slice(-this.MAX_METRICS / 2);
    }
  }

  /**
   * Export all metrics for analysis
   */
  exportMetrics(): {
    performance: PerformanceMetrics[];
    api: APIMetrics[];
    generation: GenerationMetrics[];
  } {
    return {
      performance: [...this.metrics],
      api: [...this.apiMetrics],
      generation: [...this.generationMetrics],
    };
  }

  /**
   * Clear all metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
    this.apiMetrics = [];
    this.generationMetrics = [];
  }
}

export const backendPerformanceMonitoringService = new BackendPerformanceMonitoringService();
export default backendPerformanceMonitoringService;