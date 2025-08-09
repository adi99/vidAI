import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { performanceOptimizationService } from '@/services/performanceOptimizationService';
import { cacheService } from '@/services/cacheService';

export interface MemoryOptimizationOptions {
  enableAutoCleanup?: boolean;
  cleanupInterval?: number;
  memoryThreshold?: number;
  enableAppStateOptimization?: boolean;
}

export interface MemoryStats {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
  cacheSize: number;
  componentCount: number;
}

export function useMemoryOptimization(options: MemoryOptimizationOptions = {}) {
  const {
    enableAutoCleanup = true,
    cleanupInterval = 30000, // 30 seconds
    memoryThreshold = 0.8, // 80% of available memory
    enableAppStateOptimization = true,
  } = options;

  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const componentCountRef = useRef(0);
  const memoryWarningCallbacks = useRef<Array<() => void>>([]);

  /**
   * Get current memory statistics
   */
  const getMemoryStats = useCallback((): MemoryStats => {
    const stats: MemoryStats = {
      cacheSize: 0,
      componentCount: componentCountRef.current,
    };

    // Get memory info if available (web only)
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      const memory = (window.performance as any).memory;
      stats.usedJSHeapSize = memory.usedJSHeapSize;
      stats.totalJSHeapSize = memory.totalJSHeapSize;
      stats.jsHeapSizeLimit = memory.jsHeapSizeLimit;
    }

    return stats;
  }, []);

  /**
   * Check if memory usage is high
   */
  const isMemoryUsageHigh = useCallback((): boolean => {
    const stats = getMemoryStats();
    
    if (stats.usedJSHeapSize && stats.jsHeapSizeLimit) {
      return stats.usedJSHeapSize / stats.jsHeapSizeLimit > memoryThreshold;
    }

    // Fallback: check component count and cache size
    return componentCountRef.current > 100 || stats.cacheSize > 50 * 1024 * 1024; // 50MB
  }, [memoryThreshold]);

  /**
   * Perform memory cleanup
   */
  const performMemoryCleanup = useCallback(async () => {
    console.log('🧹 Performing memory cleanup...');
    
    try {
      // Clear expired cache entries
      await cacheService.clear();
      
      // Optimize performance service
      performanceOptimizationService.optimizeMemoryUsage();
      
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Notify memory warning callbacks
      memoryWarningCallbacks.current.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Memory warning callback error:', error);
        }
      });
      
      console.log('✅ Memory cleanup completed');
    } catch (error) {
      console.error('❌ Memory cleanup failed:', error);
    }
  }, []);

  /**
   * Add memory warning callback
   */
  const addMemoryWarningCallback = useCallback((callback: () => void) => {
    memoryWarningCallbacks.current.push(callback);
    
    return () => {
      const index = memoryWarningCallbacks.current.indexOf(callback);
      if (index > -1) {
        memoryWarningCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  /**
   * Force memory cleanup
   */
  const forceCleanup = useCallback(() => {
    performMemoryCleanup();
  }, [performMemoryCleanup]);

  /**
   * Optimize component for memory usage
   */
  const optimizeComponent = useCallback(() => {
    componentCountRef.current++;
    
    return () => {
      componentCountRef.current = Math.max(0, componentCountRef.current - 1);
    };
  }, []);

  /**
   * Handle app state changes for memory optimization
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      // App went to background - aggressive cleanup
      console.log('📱 App backgrounded - performing aggressive cleanup');
      performMemoryCleanup();
    } else if (nextAppState === 'active') {
      // App became active - check memory status
      if (isMemoryUsageHigh()) {
        console.log('📱 App activated with high memory usage - cleaning up');
        performMemoryCleanup();
      }
    }
  }, [performMemoryCleanup, isMemoryUsageHigh]);

  /**
   * Setup automatic cleanup interval
   */
  useEffect(() => {
    if (!enableAutoCleanup) return;

    cleanupIntervalRef.current = setInterval(() => {
      if (isMemoryUsageHigh()) {
        performMemoryCleanup();
      }
    }, cleanupInterval) as any;

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [enableAutoCleanup, cleanupInterval, isMemoryUsageHigh, performMemoryCleanup]);

  /**
   * Setup app state listener
   */
  useEffect(() => {
    if (!enableAppStateOptimization) return;

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [enableAppStateOptimization, handleAppStateChange]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      memoryWarningCallbacks.current = [];
    };
  }, []);

  /**
   * Memoized memory stats to prevent unnecessary recalculations
   */
  const memoizedStats = useMemo(() => getMemoryStats(), [getMemoryStats]);

  return {
    memoryStats: memoizedStats,
    isMemoryUsageHigh: isMemoryUsageHigh(),
    performCleanup: forceCleanup,
    addMemoryWarningCallback,
    optimizeComponent,
  };
}

/**
 * Hook for optimizing large lists and data structures
 */
export function useListMemoryOptimization<T>(
  data: T[],
  options: {
    windowSize?: number;
    enableVirtualization?: boolean;
    cleanupThreshold?: number;
  } = {}
) {
  const {
    windowSize = 50,
    enableVirtualization = true,
    cleanupThreshold = 1000,
  } = options;

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: windowSize });
  const dataRef = useRef<T[]>(data);
  const { addMemoryWarningCallback } = useMemoryOptimization();

  /**
   * Update visible range for virtualization
   */
  const updateVisibleRange = useCallback((start: number, end: number) => {
    if (enableVirtualization) {
      setVisibleRange({ start: Math.max(0, start), end: Math.min(data.length, end) });
    }
  }, [data.length, enableVirtualization]);

  /**
   * Get visible data slice
   */
  const visibleData = useMemo(() => {
    if (!enableVirtualization) return data;
    return data.slice(visibleRange.start, visibleRange.end);
  }, [data, visibleRange, enableVirtualization]);

  /**
   * Cleanup large data when memory is low
   */
  useEffect(() => {
    const cleanup = addMemoryWarningCallback(() => {
      if (data.length > cleanupThreshold) {
        console.log(`🧹 Cleaning up large list with ${data.length} items`);
        // Keep only visible items plus buffer
        const buffer = Math.floor(windowSize * 0.5);
        const start = Math.max(0, visibleRange.start - buffer);
        const end = Math.min(data.length, visibleRange.end + buffer);
        dataRef.current = data.slice(start, end);
      }
    });

    return cleanup;
  }, [data, visibleRange, windowSize, cleanupThreshold, addMemoryWarningCallback]);

  return {
    visibleData,
    updateVisibleRange,
    visibleRange,
    totalItems: data.length,
  };
}

/**
 * Hook for optimizing image memory usage
 */
export function useImageMemoryOptimization() {
  const imageCache = useRef<Map<string, { url: string; timestamp: number }>>(new Map());
  const { addMemoryWarningCallback } = useMemoryOptimization();

  /**
   * Optimize image URL for memory usage
   */
  const optimizeImageUrl = useCallback((url: string, options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}) => {
    const { width, height, quality = 80 } = options;
    
    // Use performance service to optimize image
    return performanceOptimizationService.optimizeImageLoading(url, {
      quality: quality > 90 ? 'high' : quality > 60 ? 'medium' : 'low',
      maxWidth: width,
      maxHeight: height,
      progressive: true,
    });
  }, []);

  /**
   * Cache image with memory management
   */
  const cacheImage = useCallback((key: string, url: string) => {
    imageCache.current.set(key, {
      url,
      timestamp: Date.now(),
    });

    // Limit cache size
    if (imageCache.current.size > 100) {
      const entries = Array.from(imageCache.current.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 25%
      const toRemove = Math.ceil(entries.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        imageCache.current.delete(entries[i][0]);
      }
    }
  }, []);

  /**
   * Get cached image
   */
  const getCachedImage = useCallback((key: string) => {
    return imageCache.current.get(key)?.url;
  }, []);

  /**
   * Clear image cache on memory warning
   */
  useEffect(() => {
    const cleanup = addMemoryWarningCallback(() => {
      console.log('🧹 Clearing image cache due to memory warning');
      imageCache.current.clear();
    });

    return cleanup;
  }, [addMemoryWarningCallback]);

  return {
    optimizeImageUrl,
    cacheImage,
    getCachedImage,
    cacheSize: imageCache.current.size,
  };
}

export default useMemoryOptimization;