import { InteractionManager, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export interface PerformanceMetrics {
  appStartTime: number;
  screenLoadTimes: Record<string, number>;
  memoryUsage: number;
  bundleSize: number;
  networkRequests: number;
  cacheHitRate: number;
  frameDrops: number;
  jsThreadUsage: number;
}

export interface OptimizationConfig {
  enableLazyLoading: boolean;
  enableImageOptimization: boolean;
  enableCodeSplitting: boolean;
  enableMemoryOptimization: boolean;
  maxConcurrentRequests: number;
  cacheSize: number;
}

class PerformanceOptimizationService {
  private metrics: PerformanceMetrics = {
    appStartTime: 0,
    screenLoadTimes: {},
    memoryUsage: 0,
    bundleSize: 0,
    networkRequests: 0,
    cacheHitRate: 0,
    frameDrops: 0,
    jsThreadUsage: 0,
  };

  private config: OptimizationConfig = {
    enableLazyLoading: true,
    enableImageOptimization: true,
    enableCodeSplitting: true,
    enableMemoryOptimization: true,
    maxConcurrentRequests: 6,
    cacheSize: 100 * 1024 * 1024, // 100MB
  };

  private screenLoadStartTimes = new Map<string, number>();
  private memoryWarningListeners: Array<() => void> = [];
  private performanceObserver: PerformanceObserver | null = null;

  constructor() {
    this.initializePerformanceMonitoring();
    this.setupMemoryWarningHandlers();
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring() {
    // Track app start time
    this.metrics.appStartTime = Date.now();

    // Setup performance observer for web
    if (Platform.OS === 'web' && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.metrics.appStartTime = entry.duration;
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['navigation', 'measure'] });
    }
  }

  /**
   * Setup memory warning handlers
   */
  private setupMemoryWarningHandlers() {
    if (Platform.OS === 'ios') {
      // iOS memory warning handling would go here
      // This is a placeholder as React Native doesn't expose direct memory warnings
    }
  }

  /**
   * Track screen load time
   */
  trackScreenLoad(screenName: string, phase: 'start' | 'end') {
    if (phase === 'start') {
      this.screenLoadStartTimes.set(screenName, Date.now());
    } else {
      const startTime = this.screenLoadStartTimes.get(screenName);
      if (startTime) {
        const loadTime = Date.now() - startTime;
        this.metrics.screenLoadTimes[screenName] = loadTime;
        this.screenLoadStartTimes.delete(screenName);

        // Log slow screen loads
        if (loadTime > 2000) {
          console.warn(`Slow screen load detected: ${screenName} took ${loadTime}ms`);
        }
      }
    }
  }

  /**
   * Optimize component rendering with InteractionManager
   */
  optimizeComponentRender<T>(
    renderFunction: () => T,
    fallback?: () => T
  ): Promise<T> {
    return new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        try {
          const result = renderFunction();
          resolve(result);
        } catch (error) {
          console.error('Component render optimization error:', error);
          if (fallback) {
            resolve(fallback());
          } else {
            throw error;
          }
        }
      });
    });
  }

  /**
   * Lazy load component with performance tracking
   */
  lazyLoadComponent<T>(
    importFunction: () => Promise<{ default: T }>,
    componentName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    return importFunction().then((module) => {
      const loadTime = Date.now() - startTime;
      console.log(`Lazy loaded ${componentName} in ${loadTime}ms`);
      
      // Track component load time
      this.metrics.screenLoadTimes[`lazy_${componentName}`] = loadTime;
      
      return module.default;
    });
  }

  /**
   * Optimize image loading with progressive enhancement
   */
  optimizeImageLoading(imageUri: string, options: {
    quality?: 'low' | 'medium' | 'high';
    maxWidth?: number;
    maxHeight?: number;
    progressive?: boolean;
  } = {}) {
    const {
      quality = 'medium',
      maxWidth,
      maxHeight,
      progressive = true,
    } = options;

    // Generate optimized image URL
    const url = new URL(imageUri);
    const params = new URLSearchParams();

    if (maxWidth) params.append('w', maxWidth.toString());
    if (maxHeight) params.append('h', maxHeight.toString());
    
    switch (quality) {
      case 'low':
        params.append('q', '60');
        break;
      case 'medium':
        params.append('q', '80');
        break;
      case 'high':
        params.append('q', '95');
        break;
    }

    if (progressive) {
      params.append('fm', 'webp');
      params.append('progressive', 'true');
    }

    url.search = params.toString();
    return url.toString();
  }

  /**
   * Batch network requests for better performance
   */
  async batchNetworkRequests<T>(
    requests: Array<() => Promise<T>>,
    batchSize: number = this.config.maxConcurrentRequests
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(request => request())
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Batch request ${i + index} failed:`, result.reason);
          results.push(null as any);
        }
      });
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < requests.length) {
        await this.delay(100);
      }
    }
    
    this.metrics.networkRequests += requests.length;
    return results;
  }

  /**
   * Optimize memory usage
   */
  optimizeMemoryUsage() {
    // Clear unused caches
    this.clearUnusedCaches();
    
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Notify memory warning listeners
    this.memoryWarningListeners.forEach(listener => listener());
  }

  /**
   * Clear unused caches
   */
  private clearUnusedCaches() {
    // This would clear various caches based on usage patterns
    // Implementation would depend on your caching strategy
    console.log('Clearing unused caches for memory optimization');
  }

  /**
   * Add memory warning listener
   */
  addMemoryWarningListener(listener: () => void) {
    this.memoryWarningListeners.push(listener);
  }

  /**
   * Remove memory warning listener
   */
  removeMemoryWarningListener(listener: () => void) {
    const index = this.memoryWarningListeners.indexOf(listener);
    if (index > -1) {
      this.memoryWarningListeners.splice(index, 1);
    }
  }

  /**
   * Optimize bundle size by analyzing imports
   */
  analyzeBundleSize() {
    // This would analyze the bundle and suggest optimizations
    const suggestions = [];
    
    // Check for large dependencies
    if (this.metrics.bundleSize > 10 * 1024 * 1024) { // 10MB
      suggestions.push('Consider code splitting for large dependencies');
    }
    
    // Check for unused imports
    suggestions.push('Run bundle analyzer to identify unused code');
    
    // Check for duplicate dependencies
    suggestions.push('Check for duplicate dependencies in package.json');
    
    return {
      currentSize: this.metrics.bundleSize,
      suggestions,
    };
  }

  /**
   * Optimize JavaScript thread performance
   */
  optimizeJSThread() {
    // Use requestIdleCallback for non-critical work
    if ('requestIdleCallback' in window) {
      return new Promise<void>((resolve) => {
        (window as any).requestIdleCallback(() => {
          // Perform non-critical optimizations
          this.performNonCriticalOptimizations();
          resolve();
        });
      });
    } else {
      // Fallback for environments without requestIdleCallback
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          this.performNonCriticalOptimizations();
          resolve();
        }, 0);
      });
    }
  }

  /**
   * Perform non-critical optimizations
   */
  private performNonCriticalOptimizations() {
    // Clean up old metrics
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Remove old screen load times
    Object.keys(this.metrics.screenLoadTimes).forEach(screen => {
      if (this.metrics.screenLoadTimes[screen] < oneHourAgo) {
        delete this.metrics.screenLoadTimes[screen];
      }
    });
  }

  /**
   * Get device performance characteristics
   */
  getDevicePerformanceProfile() {
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      deviceType: Device.deviceType,
      deviceName: Device.deviceName,
      totalMemory: Device.totalMemory,
    };

    // Classify device performance
    let performanceClass: 'low' | 'medium' | 'high' = 'medium';
    
    if (Platform.OS === 'ios') {
      // iOS device classification logic
      if (Device.totalMemory && Device.totalMemory < 2 * 1024 * 1024 * 1024) { // < 2GB
        performanceClass = 'low';
      } else if (Device.totalMemory && Device.totalMemory > 4 * 1024 * 1024 * 1024) { // > 4GB
        performanceClass = 'high';
      }
    } else if (Platform.OS === 'android') {
      // Android device classification logic
      if (Device.totalMemory && Device.totalMemory < 3 * 1024 * 1024 * 1024) { // < 3GB
        performanceClass = 'low';
      } else if (Device.totalMemory && Device.totalMemory > 6 * 1024 * 1024 * 1024) { // > 6GB
        performanceClass = 'high';
      }
    }

    return {
      ...deviceInfo,
      performanceClass,
    };
  }

  /**
   * Adapt performance settings based on device
   */
  adaptToDevice() {
    const profile = this.getDevicePerformanceProfile();
    
    switch (profile.performanceClass) {
      case 'low':
        this.config.maxConcurrentRequests = 3;
        this.config.cacheSize = 50 * 1024 * 1024; // 50MB
        this.config.enableImageOptimization = true;
        break;
      case 'high':
        this.config.maxConcurrentRequests = 10;
        this.config.cacheSize = 200 * 1024 * 1024; // 200MB
        this.config.enableImageOptimization = false; // High-end devices can handle full quality
        break;
      default:
        // Keep default settings for medium performance devices
        break;
    }

    console.log(`Adapted performance settings for ${profile.performanceClass} performance device`);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get optimization config
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * Update optimization config
   */
  updateConfig(newConfig: Partial<OptimizationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    const metrics = this.getMetrics();
    const deviceProfile = this.getDevicePerformanceProfile();
    const bundleAnalysis = this.analyzeBundleSize();

    return {
      timestamp: new Date().toISOString(),
      deviceProfile,
      metrics,
      bundleAnalysis,
      recommendations: this.generateRecommendations(metrics),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.appStartTime > 3000) {
      recommendations.push('App start time is slow - consider lazy loading non-critical components');
    }

    const avgScreenLoadTime = Object.values(metrics.screenLoadTimes).reduce((sum, time) => sum + time, 0) / Object.keys(metrics.screenLoadTimes).length;
    if (avgScreenLoadTime > 1500) {
      recommendations.push('Screen load times are slow - optimize component rendering');
    }

    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('Cache hit rate is low - review caching strategy');
    }

    if (metrics.frameDrops > 10) {
      recommendations.push('Frame drops detected - optimize animations and rendering');
    }

    return recommendations;
  }
}

export const performanceOptimizationService = new PerformanceOptimizationService();
export default performanceOptimizationService;