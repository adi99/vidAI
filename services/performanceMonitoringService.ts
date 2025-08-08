import analyticsService from './analyticsService';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface APIPerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  success: boolean;
  timestamp: number;
}

export interface GenerationPerformanceMetric {
  type: 'image' | 'video' | 'training';
  model: string;
  queueTime: number;
  processingTime: number;
  totalTime: number;
  success: boolean;
  timestamp: number;
}

class PerformanceMonitoringService {
  private metrics: PerformanceMetric[] = [];
  private apiMetrics: APIPerformanceMetric[] = [];
  private generationMetrics: GenerationPerformanceMetric[] = [];
  private timers = new Map<string, number>();
  private readonly MAX_METRICS = 1000;

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * End timing and record metric
   */
  endTimer(name: string, context?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer not found: ${name}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    this.recordMetric(name, duration, 'ms', context);
    return duration;
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    context?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      context,
    };

    this.metrics.push(metric);
    this.trimMetrics();

    // Send to analytics
    analyticsService.trackPerformance(name, value, unit, context);
  }

  /**
   * Record API performance
   */
  recordAPIPerformance(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    success: boolean
  ): void {
    const metric: APIPerformanceMetric = {
      endpoint,
      method,
      duration,
      status,
      success,
      timestamp: Date.now(),
    };

    this.apiMetrics.push(metric);
    this.trimAPIMetrics();

    // Send to analytics
    analyticsService.track('api_performance', {
      endpoint,
      method,
      duration,
      status,
      success,
      response_time_category: this.categorizeResponseTime(duration),
    });
  }

  /**
   * Record generation performance
   */
  recordGenerationPerformance(metric: GenerationPerformanceMetric): void {
    this.generationMetrics.push(metric);
    this.trimGenerationMetrics();

    // Send to analytics
    analyticsService.track('generation_performance', {
      generation_type: metric.type,
      model: metric.model,
      queue_time: metric.queueTime,
      processing_time: metric.processingTime,
      total_time: metric.totalTime,
      success: metric.success,
      efficiency_score: this.calculateEfficiencyScore(metric),
    });
  }

  /**
   * Monitor React Native performance
   */
  monitorRNPerformance(): void {
    // Monitor JavaScript thread performance
    this.monitorJSThread();
    
    // Monitor memory usage
    this.monitorMemoryUsage();
    
    // Monitor bundle load time
    this.monitorBundleLoadTime();
  }

  /**
   * Monitor JavaScript thread performance
   */
  private monitorJSThread(): void {
    let lastTime = Date.now();
    let frameCount = 0;

    const measureFPS = () => {
      frameCount++;
      const currentTime = Date.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
        
        this.recordMetric('js_thread_fps', fps, 'fps', {
          performance_category: this.categorizeFPS(fps),
        });
      }
      
      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage(): void {
    // Check memory usage every 30 seconds
    setInterval(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        
        this.recordMetric('memory_used', memory.usedJSHeapSize, 'bytes', {
          total_heap: memory.totalJSHeapSize,
          heap_limit: memory.jsHeapSizeLimit,
          usage_percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        });
      }
    }, 30000);
  }

  /**
   * Monitor bundle load time
   */
  private monitorBundleLoadTime(): void {
    // This would be called during app initialization
    const loadTime = Date.now() - (global as any).__APP_START_TIME__;
    if (loadTime > 0) {
      this.recordMetric('bundle_load_time', loadTime, 'ms', {
        load_category: this.categorizeLoadTime(loadTime),
      });
    }
  }

  /**
   * Monitor component render performance
   */
  monitorComponentRender(componentName: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const renderTime = Date.now() - startTime;
      this.recordMetric(`component_render_${componentName}`, renderTime, 'ms', {
        component: componentName,
        render_category: this.categorizeRenderTime(renderTime),
      });
    };
  }

  /**
   * Monitor navigation performance
   */
  monitorNavigation(fromScreen: string, toScreen: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const navigationTime = Date.now() - startTime;
      this.recordMetric('navigation_time', navigationTime, 'ms', {
        from_screen: fromScreen,
        to_screen: toScreen,
        navigation_category: this.categorizeNavigationTime(navigationTime),
      });
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageAPIResponseTime: number;
    apiSuccessRate: number;
    averageGenerationTime: number;
    generationSuccessRate: number;
    recentMetrics: PerformanceMetric[];
  } {
    const recentAPIMetrics = this.apiMetrics.slice(-100);
    const recentGenerationMetrics = this.generationMetrics.slice(-50);
    
    const averageAPIResponseTime = recentAPIMetrics.length > 0
      ? recentAPIMetrics.reduce((sum, m) => sum + m.duration, 0) / recentAPIMetrics.length
      : 0;
    
    const apiSuccessRate = recentAPIMetrics.length > 0
      ? (recentAPIMetrics.filter(m => m.success).length / recentAPIMetrics.length) * 100
      : 100;
    
    const averageGenerationTime = recentGenerationMetrics.length > 0
      ? recentGenerationMetrics.reduce((sum, m) => sum + m.totalTime, 0) / recentGenerationMetrics.length
      : 0;
    
    const generationSuccessRate = recentGenerationMetrics.length > 0
      ? (recentGenerationMetrics.filter(m => m.success).length / recentGenerationMetrics.length) * 100
      : 100;

    return {
      averageAPIResponseTime,
      apiSuccessRate,
      averageGenerationTime,
      generationSuccessRate,
      recentMetrics: this.metrics.slice(-20),
    };
  }

  /**
   * Get slow operations
   */
  getSlowOperations(threshold: number = 1000): PerformanceMetric[] {
    return this.metrics.filter(m => m.value > threshold && m.unit === 'ms');
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): APIPerformanceMetric[] {
    return this.apiMetrics.filter(m => !m.success);
  }

  /**
   * Categorize response time
   */
  private categorizeResponseTime(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 300) return 'good';
    if (duration < 1000) return 'fair';
    if (duration < 3000) return 'poor';
    return 'very_poor';
  }

  /**
   * Categorize FPS
   */
  private categorizeFPS(fps: number): string {
    if (fps >= 55) return 'excellent';
    if (fps >= 45) return 'good';
    if (fps >= 30) return 'fair';
    if (fps >= 20) return 'poor';
    return 'very_poor';
  }

  /**
   * Categorize load time
   */
  private categorizeLoadTime(loadTime: number): string {
    if (loadTime < 1000) return 'fast';
    if (loadTime < 2000) return 'moderate';
    if (loadTime < 4000) return 'slow';
    return 'very_slow';
  }

  /**
   * Categorize render time
   */
  private categorizeRenderTime(renderTime: number): string {
    if (renderTime < 16) return 'excellent'; // 60fps
    if (renderTime < 33) return 'good'; // 30fps
    if (renderTime < 50) return 'fair'; // 20fps
    return 'poor';
  }

  /**
   * Categorize navigation time
   */
  private categorizeNavigationTime(navTime: number): string {
    if (navTime < 100) return 'instant';
    if (navTime < 300) return 'fast';
    if (navTime < 500) return 'moderate';
    return 'slow';
  }

  /**
   * Calculate efficiency score for generation
   */
  private calculateEfficiencyScore(metric: GenerationPerformanceMetric): number {
    if (!metric.success) return 0;
    
    // Base score on processing time vs queue time ratio
    const ratio = metric.processingTime / (metric.queueTime + metric.processingTime);
    return Math.round(ratio * 100);
  }

  /**
   * Trim metrics arrays to prevent memory leaks
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
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.apiMetrics = [];
    this.generationMetrics = [];
    this.timers.clear();
  }

  /**
   * Export metrics for debugging
   */
  exportMetrics(): {
    performance: PerformanceMetric[];
    api: APIPerformanceMetric[];
    generation: GenerationPerformanceMetric[];
  } {
    return {
      performance: [...this.metrics],
      api: [...this.apiMetrics],
      generation: [...this.generationMetrics],
    };
  }
}

export const performanceMonitoringService = new PerformanceMonitoringService();
export default performanceMonitoringService;