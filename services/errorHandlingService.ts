import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

// Standard error codes from the design document
export const ERROR_CODES = {
    INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
    GENERATION_FAILED: 'GENERATION_FAILED',
    INVALID_INPUT: 'INVALID_INPUT',
    RATE_LIMITED: 'RATE_LIMITED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    NOT_FOUND: 'NOT_FOUND',
    TIMEOUT: 'TIMEOUT',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface APIError {
    code: ErrorCode;
    message: string;
    details?: any;
    timestamp: string;
    retryable?: boolean;
}

export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
};

class ErrorHandlingService {
    private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

    /**
     * Parse and normalize errors from different sources
     */
    parseError(error: any): APIError {
        const timestamp = new Date().toISOString();

        // Handle network errors
        if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
            return {
                code: ERROR_CODES.NETWORK_ERROR,
                message: 'Network connection failed. Please check your internet connection.',
                timestamp,
                retryable: true,
            };
        }

        // Handle timeout errors
        if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
            return {
                code: ERROR_CODES.TIMEOUT,
                message: 'Request timed out. Please try again.',
                timestamp,
                retryable: true,
            };
        }

        // Handle HTTP errors
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            switch (status) {
                case 400:
                    return {
                        code: ERROR_CODES.INVALID_INPUT,
                        message: data?.message || 'Invalid request. Please check your input.',
                        details: data?.details,
                        timestamp,
                        retryable: false,
                    };

                case 401:
                    return {
                        code: ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Authentication failed. Please log in again.',
                        timestamp,
                        retryable: false,
                    };

                case 403:
                    return {
                        code: ERROR_CODES.PERMISSION_DENIED,
                        message: data?.message || 'Permission denied.',
                        timestamp,
                        retryable: false,
                    };

                case 404:
                    return {
                        code: ERROR_CODES.NOT_FOUND,
                        message: 'Resource not found.',
                        timestamp,
                        retryable: false,
                    };

                case 429:
                    return {
                        code: ERROR_CODES.RATE_LIMITED,
                        message: 'Too many requests. Please wait a moment and try again.',
                        timestamp,
                        retryable: true,
                    };

                case 500:
                case 502:
                case 503:
                case 504:
                    return {
                        code: ERROR_CODES.SERVICE_UNAVAILABLE,
                        message: 'Service temporarily unavailable. Please try again later.',
                        timestamp,
                        retryable: true,
                    };

                default:
                    return {
                        code: ERROR_CODES.UNKNOWN_ERROR,
                        message: data?.message || 'An unexpected error occurred.',
                        details: data?.details,
                        timestamp,
                        retryable: status >= 500,
                    };
            }
        }

        // Handle specific application errors
        if (error.code) {
            switch (error.code) {
                case ERROR_CODES.INSUFFICIENT_CREDITS:
                    return {
                        code: ERROR_CODES.INSUFFICIENT_CREDITS,
                        message: 'Insufficient credits. Please purchase more credits to continue.',
                        timestamp,
                        retryable: false,
                    };

                case ERROR_CODES.GENERATION_FAILED:
                    return {
                        code: ERROR_CODES.GENERATION_FAILED,
                        message: 'Generation failed. Please try again with different settings.',
                        timestamp,
                        retryable: true,
                    };

                default:
                    return {
                        code: error.code,
                        message: error.message || 'An error occurred.',
                        details: error.details,
                        timestamp,
                        retryable: error.retryable || false,
                    };
            }
        }

        // Handle generic errors
        return {
            code: ERROR_CODES.UNKNOWN_ERROR,
            message: error.message || 'An unexpected error occurred.',
            timestamp,
            retryable: false,
        };
    }

    /**
     * Calculate delay for exponential backoff
     */
    private calculateDelay(attempt: number): number {
        const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    /**
     * Execute a function with retry logic
     */
    async withRetry<T>(
        operation: () => Promise<T>,
        customConfig?: Partial<RetryConfig>
    ): Promise<T> {
        const config = { ...this.retryConfig, ...customConfig };
        let lastError: APIError;

        for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = this.parseError(error);

                // Don't retry if error is not retryable or we've exhausted retries
                if (!lastError.retryable || attempt > config.maxRetries) {
                    throw lastError;
                }

                // Wait before retrying
                const delay = this.calculateDelay(attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }

    /**
     * Show user-friendly error message with haptic feedback
     */
    async showError(error: APIError, options?: {
        showAlert?: boolean;
        hapticFeedback?: boolean;
        onRetry?: () => void;
    }) {
        const { showAlert = true, hapticFeedback = true, onRetry } = options || {};

        // Provide haptic feedback
        if (hapticFeedback) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        // Show alert if requested
        if (showAlert) {
            const buttons: any[] = [{ text: 'OK', style: 'default' }];

            // Add retry button for retryable errors
            if (error.retryable && onRetry) {
                buttons.unshift({
                    text: 'Retry',
                    style: 'default',
                    onPress: onRetry,
                });
            }

            Alert.alert(
                this.getErrorTitle(error.code),
                error.message,
                buttons
            );
        }
    }

    /**
     * Get user-friendly error title
     */
    private getErrorTitle(code: ErrorCode): string {
        switch (code) {
            case ERROR_CODES.NETWORK_ERROR:
                return 'Connection Error';
            case ERROR_CODES.AUTHENTICATION_ERROR:
                return 'Authentication Required';
            case ERROR_CODES.INSUFFICIENT_CREDITS:
                return 'Insufficient Credits';
            case ERROR_CODES.GENERATION_FAILED:
                return 'Generation Failed';
            case ERROR_CODES.RATE_LIMITED:
                return 'Rate Limited';
            case ERROR_CODES.SERVICE_UNAVAILABLE:
                return 'Service Unavailable';
            case ERROR_CODES.PERMISSION_DENIED:
                return 'Permission Denied';
            case ERROR_CODES.INVALID_INPUT:
                return 'Invalid Input';
            case ERROR_CODES.NOT_FOUND:
                return 'Not Found';
            case ERROR_CODES.TIMEOUT:
                return 'Request Timeout';
            default:
                return 'Error';
        }
    }

    /**
     * Get recovery suggestions for different error types
     */
    getRecoverySuggestions(code: ErrorCode): string[] {
        switch (code) {
            case ERROR_CODES.NETWORK_ERROR:
                return [
                    'Check your internet connection',
                    'Try switching between WiFi and mobile data',
                    'Restart the app',
                ];

            case ERROR_CODES.INSUFFICIENT_CREDITS:
                return [
                    'Purchase more credits',
                    'Check your subscription status',
                    'Use lower quality settings to reduce credit cost',
                ];

            case ERROR_CODES.GENERATION_FAILED:
                return [
                    'Try a different prompt',
                    'Adjust generation settings',
                    'Check if the input image is valid',
                    'Try again in a few minutes',
                ];

            case ERROR_CODES.RATE_LIMITED:
                return [
                    'Wait a few minutes before trying again',
                    'Reduce the frequency of requests',
                    'Consider upgrading your subscription',
                ];

            case ERROR_CODES.SERVICE_UNAVAILABLE:
                return [
                    'Try again in a few minutes',
                    'Check our status page for updates',
                    'Contact support if the issue persists',
                ];

            case ERROR_CODES.AUTHENTICATION_ERROR:
                return [
                    'Log out and log back in',
                    'Check your internet connection',
                    'Clear app cache and restart',
                ];

            default:
                return [
                    'Try again',
                    'Restart the app',
                    'Contact support if the issue persists',
                ];
        }
    }

    /**
     * Update retry configuration
     */
    updateRetryConfig(config: Partial<RetryConfig>) {
        this.retryConfig = { ...this.retryConfig, ...config };
    }
}

export const errorHandlingService = new ErrorHandlingService();
export default errorHandlingService;