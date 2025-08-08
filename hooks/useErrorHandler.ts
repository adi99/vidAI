import { useCallback, useState } from 'react';
import errorHandlingService, { APIError, ERROR_CODES } from '@/services/errorHandlingService';
import * as Haptics from 'expo-haptics';

export interface UseErrorHandlerOptions {
  showAlert?: boolean;
  hapticFeedback?: boolean;
  logErrors?: boolean;
}

export interface ErrorState {
  error: APIError | null;
  isRetrying: boolean;
  retryCount: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    showAlert = true,
    hapticFeedback = true,
    logErrors = true,
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
  });

  /**
   * Handle an error with appropriate user feedback
   */
  const handleError = useCallback(async (
    error: any,
    retryCallback?: () => Promise<void> | void
  ) => {
    const parsedError = errorHandlingService.parseError(error);

    // Log error if enabled
    if (logErrors) {
      console.error('Error handled:', parsedError);
    }

    // Update error state
    setErrorState(prev => ({
      error: parsedError,
      isRetrying: false,
      retryCount: prev.retryCount,
    }));

    // Show error to user
    await errorHandlingService.showError(parsedError, {
      showAlert,
      hapticFeedback,
      onRetry: retryCallback ? () => retry(retryCallback) : undefined,
    });

    return parsedError;
  }, [showAlert, hapticFeedback, logErrors]);

  /**
   * Retry a failed operation
   */
  const retry = useCallback(async (
    retryCallback: () => Promise<void> | void
  ) => {
    if (!errorState.error?.retryable) {
      return;
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }));

    try {
      await retryCallback();
      
      // Clear error on successful retry
      setErrorState({
        error: null,
        isRetrying: false,
        retryCount: 0,
      });

      // Success haptic feedback
      if (hapticFeedback) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (retryError) {
      // Handle retry failure
      await handleError(retryError, retryCallback);
    }
  }, [errorState.error, hapticFeedback, handleError]);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
    });
  }, []);

  /**
   * Execute an async operation with error handling
   */
  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    retryCallback?: () => Promise<void> | void
  ): Promise<T | null> => {
    try {
      clearError();
      const result = await operation();
      return result;
    } catch (error) {
      await handleError(error, retryCallback);
      return null;
    }
  }, [handleError, clearError]);

  /**
   * Get user-friendly error message
   */
  const getErrorMessage = useCallback((error?: APIError) => {
    const currentError = error || errorState.error;
    if (!currentError) return null;

    return currentError.message;
  }, [errorState.error]);

  /**
   * Get recovery suggestions for the current error
   */
  const getRecoverySuggestions = useCallback((error?: APIError) => {
    const currentError = error || errorState.error;
    if (!currentError) return [];

    return errorHandlingService.getRecoverySuggestions(currentError.code);
  }, [errorState.error]);

  /**
   * Check if the current error is retryable
   */
  const isRetryable = useCallback((error?: APIError) => {
    const currentError = error || errorState.error;
    return currentError?.retryable || false;
  }, [errorState.error]);

  /**
   * Check if we should show a specific error type
   */
  const shouldShowError = useCallback((errorCode: string) => {
    return errorState.error?.code === errorCode;
  }, [errorState.error]);

  return {
    // State
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    hasError: !!errorState.error,

    // Actions
    handleError,
    retry,
    clearError,
    executeWithErrorHandling,

    // Utilities
    getErrorMessage,
    getRecoverySuggestions,
    isRetryable,
    shouldShowError,

    // Error type checks
    isNetworkError: shouldShowError(ERROR_CODES.NETWORK_ERROR),
    isAuthError: shouldShowError(ERROR_CODES.AUTHENTICATION_ERROR),
    isInsufficientCredits: shouldShowError(ERROR_CODES.INSUFFICIENT_CREDITS),
    isGenerationFailed: shouldShowError(ERROR_CODES.GENERATION_FAILED),
    isRateLimited: shouldShowError(ERROR_CODES.RATE_LIMITED),
    isServiceUnavailable: shouldShowError(ERROR_CODES.SERVICE_UNAVAILABLE),
  };
}

export default useErrorHandler;