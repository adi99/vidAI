import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import errorTrackingService, { ErrorReport } from '@/services/errorTrackingService';
import { useAuth } from '@/contexts/AuthContext';
// import NetInfo from '@react-native-community/netinfo'; // Optional dependency

export interface UseErrorTrackingOptions {
  enableAutoTracking?: boolean;
  enableNetworkTracking?: boolean;
  enableNavigationTracking?: boolean;
  screen?: string;
}

export function useErrorTracking(options: UseErrorTrackingOptions = {}) {
  const {
    enableAutoTracking = true,
    enableNetworkTracking = true,
    enableNavigationTracking = true,
    screen,
  } = options;

  const { user } = useAuth();
  const router = useRouter();
  const previousErrorHandler = useRef<any>(null);
  const networkState = useRef<'online' | 'offline'>('online');

  // Set up global error tracking
  useEffect(() => {
    if (!enableAutoTracking) return;

    // Store the previous error handler
    const globalWithErrorUtils = global as any;
    previousErrorHandler.current = globalWithErrorUtils.ErrorUtils?.getGlobalHandler();

    // Set up our error handler
    globalWithErrorUtils.ErrorUtils?.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
      await reportError(
        error,
        { screen },
        isFatal ? 'critical' : 'high',
        'system',
        { isFatal, autoTracked: true }
      );

      // Call the previous handler if it exists
      if (previousErrorHandler.current) {
        previousErrorHandler.current(error, isFatal);
      }
    });

    // Clean up on unmount
    return () => {
      if (previousErrorHandler.current) {
        globalWithErrorUtils.ErrorUtils?.setGlobalHandler(previousErrorHandler.current);
      }
    };
  }, [enableAutoTracking, screen]);

  // Set up network state tracking
  useEffect(() => {
    if (!enableNetworkTracking) return;

    // Check if NetInfo is available
    try {
      // Dynamic import to handle optional dependency
      import('@react-native-community/netinfo').then((NetInfo) => {
        const unsubscribe = NetInfo.default.addEventListener(state => {
          const newNetworkState = state.isConnected ? 'online' : 'offline';
          
          // Track network state changes
          if (networkState.current !== newNetworkState) {
            if (newNetworkState === 'offline') {
              reportError(
                'Network connection lost',
                { screen },
                'medium',
                'network',
                { networkType: state.type, isConnected: state.isConnected }
              );
            }
            networkState.current = newNetworkState;
          }
        });

        return () => unsubscribe();
      }).catch(() => {
        // NetInfo not available, skip network tracking
        console.warn('NetInfo not available, skipping network tracking');
      });
    } catch (error) {
      // NetInfo not available, skip network tracking
      console.warn('NetInfo not available, skipping network tracking');
    }
  }, [enableNetworkTracking, screen]);

  /**
   * Report an error manually
   */
  const reportError = useCallback(async (
    error: Error | string,
    context: Partial<ErrorReport['context']> = {},
    severity: ErrorReport['severity'] = 'medium',
    category: ErrorReport['category'] = 'unknown',
    metadata?: Record<string, any>
  ): Promise<string> => {
    const fullContext = {
      screen,
      userId: user?.id,
      networkStatus: networkState.current,
      ...context,
    };

    return errorTrackingService.reportError(
      error,
      fullContext,
      severity,
      category,
      metadata
    );
  }, [user?.id, screen]);

  /**
   * Report a network error
   */
  const reportNetworkError = useCallback(async (
    url: string,
    method: string,
    statusCode: number,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {}
  ): Promise<string> => {
    return errorTrackingService.reportNetworkError(
      url,
      method,
      statusCode,
      error,
      {
        screen,
        userId: user?.id,
        networkStatus: networkState.current,
        ...context,
      }
    );
  }, [user?.id, screen]);

  /**
   * Report a generation error
   */
  const reportGenerationError = useCallback(async (
    type: 'image' | 'video' | 'training',
    model: string,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {},
    metadata?: Record<string, any>
  ): Promise<string> => {
    return errorTrackingService.reportGenerationError(
      type,
      model,
      error,
      {
        screen,
        userId: user?.id,
        networkStatus: networkState.current,
        ...context,
      },
      metadata
    );
  }, [user?.id, screen]);

  /**
   * Report an authentication error
   */
  const reportAuthError = useCallback(async (
    action: string,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {}
  ): Promise<string> => {
    return errorTrackingService.reportAuthError(
      action,
      error,
      {
        screen,
        userId: user?.id,
        networkStatus: networkState.current,
        ...context,
      }
    );
  }, [user?.id, screen]);

  /**
   * Report a UI error
   */
  const reportUIError = useCallback(async (
    component: string,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {}
  ): Promise<string> => {
    return errorTrackingService.reportUIError(
      component,
      error,
      {
        screen,
        userId: user?.id,
        networkStatus: networkState.current,
        ...context,
      }
    );
  }, [user?.id, screen]);

  /**
   * Wrap an async function with error tracking
   */
  const trackAsync = useCallback(<T>(
    operation: () => Promise<T>,
    errorContext: {
      action: string;
      category?: ErrorReport['category'];
      severity?: ErrorReport['severity'];
      metadata?: Record<string, any>;
    }
  ) => {
    return async (): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        await reportError(
          error instanceof Error ? error : new Error(String(error)),
          { action: errorContext.action },
          errorContext.severity || 'medium',
          errorContext.category || 'unknown',
          errorContext.metadata
        );
        throw error;
      }
    };
  }, [reportError]);

  /**
   * Wrap a sync function with error tracking
   */
  const trackSync = useCallback(<T>(
    operation: () => T,
    errorContext: {
      action: string;
      category?: ErrorReport['category'];
      severity?: ErrorReport['severity'];
      metadata?: Record<string, any>;
    }
  ) => {
    return (): T => {
      try {
        return operation();
      } catch (error) {
        reportError(
          error instanceof Error ? error : new Error(String(error)),
          { action: errorContext.action },
          errorContext.severity || 'medium',
          errorContext.category || 'unknown',
          errorContext.metadata
        );
        throw error;
      }
    };
  }, [reportError]);

  /**
   * Create an error-tracked fetch wrapper
   */
  const createTrackedFetch = useCallback(() => {
    return async (url: string, options?: RequestInit): Promise<Response> => {
      const method = options?.method || 'GET';
      
      try {
        const response = await fetch(url, options);
        
        // Track failed HTTP responses
        if (!response.ok) {
          await reportNetworkError(
            url,
            method,
            response.status,
            `HTTP ${response.status}: ${response.statusText}`,
            { action: 'fetch_request' }
          );
        }
        
        return response;
      } catch (error) {
        await reportNetworkError(
          url,
          method,
          0,
          error instanceof Error ? error : new Error(String(error)),
          { action: 'fetch_request' }
        );
        throw error;
      }
    };
  }, [reportNetworkError]);

  /**
   * Track navigation errors
   */
  const trackNavigation = useCallback((fromScreen: string, toScreen: string) => {
    if (!enableNavigationTracking) return () => {};

    const startTime = Date.now();
    
    return (error?: Error) => {
      const duration = Date.now() - startTime;
      
      if (error) {
        reportError(
          error,
          {
            action: 'navigation',
            screen: fromScreen,
          },
          'medium',
          'ui',
          {
            fromScreen,
            toScreen,
            navigationDuration: duration,
          }
        );
      }
    };
  }, [enableNavigationTracking, reportError]);

  /**
   * Track component mount/unmount errors
   */
  const trackComponentLifecycle = useCallback((componentName: string) => {
    return {
      onMount: (error?: Error) => {
        if (error) {
          reportUIError(
            componentName,
            error,
            { action: 'component_mount' }
          );
        }
      },
      
      onUnmount: (error?: Error) => {
        if (error) {
          reportUIError(
            componentName,
            error,
            { action: 'component_unmount' }
          );
        }
      },
      
      onError: (error: Error, errorInfo?: any) => {
        reportUIError(
          componentName,
          error,
          { action: 'component_error' }
        );
      },
    };
  }, [reportUIError]);

  /**
   * Get error statistics
   */
  const getErrorStats = useCallback((timeWindow?: number) => {
    return errorTrackingService.getErrorStats(timeWindow);
  }, []);

  /**
   * Get recent errors
   */
  const getRecentErrors = useCallback((limit?: number) => {
    return errorTrackingService.getRecentErrors(limit);
  }, []);

  /**
   * Mark error as resolved
   */
  const markErrorResolved = useCallback((errorId: string) => {
    return errorTrackingService.markErrorResolved(errorId);
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    errorTrackingService.clearErrors();
  }, []);

  /**
   * Get error patterns
   */
  const getErrorPatterns = useCallback(() => {
    return errorTrackingService.getErrorPatterns();
  }, []);

  /**
   * Export errors for debugging
   */
  const exportErrors = useCallback(() => {
    return errorTrackingService.exportErrors();
  }, []);

  return {
    // Core error reporting
    reportError,
    reportNetworkError,
    reportGenerationError,
    reportAuthError,
    reportUIError,

    // Function wrappers
    trackAsync,
    trackSync,
    createTrackedFetch,

    // Specialized tracking
    trackNavigation,
    trackComponentLifecycle,

    // Error data access
    getErrorStats,
    getRecentErrors,
    getErrorPatterns,
    markErrorResolved,
    clearErrors,
    exportErrors,

    // Current state
    networkStatus: networkState.current,
  };
}

export default useErrorTracking;