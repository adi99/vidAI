import { useCallback, useEffect, useRef } from 'react';
import performanceMonitoringService, { GenerationPerformanceMetric } from '@/services/performanceMonitoringService';

export interface UsePerformanceMonitoringOptions {
  enableComponentMonitoring?: boolean;
  enableNavigationMonitoring?: boolean;
  componentName?: string;
}

export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions = {}) {
  const {
    enableComponentMonitoring = true,
    enableNavigationMonitoring = true,
    componentName,
  } = options;

  const renderStartTime = useRef<number>(Date.now());
  const navigationStartTime = useRef<number | null>(null);

  // Monitor component render performance
  useEffect(() => {
    if (enableComponentMonitoring && componentName) {
      const renderTime = Date.now() - renderStartTime.current;
      performanceMonitoringService.recordMetric(
        `component_render_${componentName}`,
        renderTime,
        'ms',
        { component: componentName }
      );
    }
  }, [enableComponentMonitoring, componentName]);

  /**
   * Start timing an operation
   */
  const startTimer = useCallback((name: string) => {
    performanceMonitoringService.startTimer(name);
  }, []);

  /**
   * End timing and record metric
   */
  const endTimer = useCallback((name: string, context?: Record<string, any>) => {
    return performanceMonitoringService.endTimer(name, context);
  }, []);

  /**
   * Record a custom metric
   */
  const recordMetric = useCallback((
    name: string,
    value: number,
    unit: string = 'ms',
    context?: Record<string, any>
  ) => {
    performanceMonitoringService.recordMetric(name, value, unit, context);
  }, []);

  /**
   * Record API performance
   */
  const recordAPIPerformance = useCallback((
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    success: boolean
  ) => {
    performanceMonitoringService.recordAPIPerformance(endpoint, method, duration, status, success);
  }, []);

  /**
   * Record generation performance
   */
  const recordGenerationPerformance = useCallback((metric: GenerationPerformanceMetric) => {
    performanceMonitoringService.recordGenerationPerformance(metric);
  }, []);

  /**
   * Monitor component render performance
   */
  const monitorComponentRender = useCallback((componentName: string) => {
    return performanceMonitoringService.monitorComponentRender(componentName);
  }, []);

  /**
   * Monitor navigation performance
   */
  const monitorNavigation = useCallback((fromScreen: string, toScreen: string) => {
    if (enableNavigationMonitoring) {
      return performanceMonitoringService.monitorNavigation(fromScreen, toScreen);
    }
    return () => {};
  }, [enableNavigationMonitoring]);

  /**
   * Start navigation timing
   */
  const startNavigation = useCallback(() => {
    if (enableNavigationMonitoring) {
      navigationStartTime.current = Date.now();
    }
  }, [enableNavigationMonitoring]);

  /**
   * End navigation timing
   */
  const endNavigation = useCallback((fromScreen: string, toScreen: string) => {
    if (enableNavigationMonitoring && navigationStartTime.current) {
      const duration = Date.now() - navigationStartTime.current;
      recordMetric('navigation_time', duration, 'ms', {
        from_screen: fromScreen,
        to_screen: toScreen,
      });
      navigationStartTime.current = null;
    }
  }, [enableNavigationMonitoring, recordMetric]);

  /**
   * Measure async operation performance
   */
  const measureAsync = useCallback(async <T>(
    name: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> => {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      recordMetric(name, duration, 'ms', {
        ...context,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      recordMetric(name, duration, 'ms', {
        ...context,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }, [recordMetric]);

  /**
   * Measure sync operation performance
   */
  const measureSync = useCallback(<T>(
    name: string,
    operation: () => T,
    context?: Record<string, any>
  ): T => {
    const startTime = Date.now();
    
    try {
      const result = operation();
      const duration = Date.now() - startTime;
      
      recordMetric(name, duration, 'ms', {
        ...context,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      recordMetric(name, duration, 'ms', {
        ...context,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }, [recordMetric]);

  /**
   * Get performance statistics
   */
  const getPerformanceStats = useCallback(() => {
    return performanceMonitoringService.getPerformanceStats();
  }, []);

  /**
   * Get slow operations
   */
  const getSlowOperations = useCallback((threshold: number = 1000) => {
    return performanceMonitoringService.getSlowOperations(threshold);
  }, []);

  /**
   * Get failed operations
   */
  const getFailedOperations = useCallback(() => {
    return performanceMonitoringService.getFailedOperations();
  }, []);

  /**
   * Create a performance-aware fetch wrapper
   */
  const createPerformanceFetch = useCallback(() => {
    return async (url: string, options?: RequestInit) => {
      const startTime = Date.now();
      const method = options?.method || 'GET';
      
      try {
        const response = await fetch(url, options);
        const duration = Date.now() - startTime;
        
        recordAPIPerformance(url, method, duration, response.status, response.ok);
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        recordAPIPerformance(url, method, duration, 0, false);
        throw error;
      }
    };
  }, [recordAPIPerformance]);

  /**
   * Monitor generation job performance
   */
  const monitorGeneration = useCallback((
    type: 'image' | 'video' | 'training',
    model: string
  ) => {
    const queueStartTime = Date.now();
    let processingStartTime: number | null = null;
    
    return {
      startProcessing: () => {
        processingStartTime = Date.now();
      },
      
      complete: (success: boolean = true) => {
        const endTime = Date.now();
        const queueTime = (processingStartTime || endTime) - queueStartTime;
        const processingTime = processingStartTime ? endTime - processingStartTime : 0;
        const totalTime = endTime - queueStartTime;
        
        recordGenerationPerformance({
          type,
          model,
          queueTime,
          processingTime,
          totalTime,
          success,
          timestamp: endTime,
        });
      },
    };
  }, [recordGenerationPerformance]);

  /**
   * Monitor screen load performance
   */
  const monitorScreenLoad = useCallback((screenName: string) => {
    const loadStartTime = Date.now();
    
    return () => {
      const loadTime = Date.now() - loadStartTime;
      recordMetric(`screen_load_${screenName}`, loadTime, 'ms', {
        screen_name: screenName,
      });
    };
  }, [recordMetric]);

  /**
   * Monitor image load performance
   */
  const monitorImageLoad = useCallback((imageUrl: string, size?: { width: number; height: number }) => {
    const loadStartTime = Date.now();
    
    return {
      onLoad: () => {
        const loadTime = Date.now() - loadStartTime;
        recordMetric('image_load_time', loadTime, 'ms', {
          image_url: imageUrl,
          image_size: size,
          success: true,
        });
      },
      
      onError: () => {
        const loadTime = Date.now() - loadStartTime;
        recordMetric('image_load_time', loadTime, 'ms', {
          image_url: imageUrl,
          image_size: size,
          success: false,
        });
      },
    };
  }, [recordMetric]);

  return {
    // Core timing functions
    startTimer,
    endTimer,
    recordMetric,
    recordAPIPerformance,
    recordGenerationPerformance,

    // Component and navigation monitoring
    monitorComponentRender,
    monitorNavigation,
    startNavigation,
    endNavigation,

    // Operation measurement
    measureAsync,
    measureSync,

    // Specialized monitoring
    monitorGeneration,
    monitorScreenLoad,
    monitorImageLoad,

    // Performance data
    getPerformanceStats,
    getSlowOperations,
    getFailedOperations,

    // Utilities
    createPerformanceFetch,
  };
}

export default usePerformanceMonitoring;