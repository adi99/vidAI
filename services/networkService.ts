import { supabase } from '@/lib/supabase';
import errorHandlingService, { APIError, ERROR_CODES } from './errorHandlingService';

export interface RequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

class NetworkService {
  private defaultTimeout = 30000; // 30 seconds
  private defaultRetries = 3;

  /**
   * Make an authenticated API request with error handling and retry logic
   */
  async request<T>(
    url: string,
    options: RequestConfig & Omit<RequestInit, 'headers'> = {}
  ): Promise<T> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay,
      headers = {},
      ...fetchOptions
    } = options;

    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add authorization header if we have a session
    if (session?.access_token) {
      requestHeaders['Authorization'] = `Bearer ${session.access_token}`;
    }

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers: requestHeaders,
    };

    return errorHandlingService.withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...requestOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw {
              response: {
                status: response.status,
                data: errorData,
              },
            };
          }

          const data = await response.json();
          return data;
        } catch (error: any) {
          clearTimeout(timeoutId);

          if (error.name === 'AbortError') {
            throw {
              name: 'TimeoutError',
              code: 'TIMEOUT',
              message: 'Request timed out',
            };
          }

          throw error;
        }
      },
      {
        maxRetries: retries,
        baseDelay: retryDelay || 1000,
      }
    );
  }

  /**
   * GET request with error handling
   */
  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  /**
   * POST request with error handling
   */
  async post<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request with error handling
   */
  async put<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request with error handling
   */
  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  /**
   * Upload file with progress tracking and error handling
   */
  async uploadFile(
    url: string,
    file: File | Blob,
    onProgress?: (progress: number) => void,
    config?: RequestConfig
  ): Promise<any> {
    const { timeout = 60000, retries = 2 } = config || {}; // Longer timeout for uploads

    return errorHandlingService.withRetry(
      async () => {
        const formData = new FormData();
        formData.append('file', file);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw {
              response: {
                status: response.status,
                data: errorData,
              },
            };
          }

          return await response.json();
        } catch (error: any) {
          clearTimeout(timeoutId);

          if (error.name === 'AbortError') {
            throw {
              name: 'TimeoutError',
              code: 'TIMEOUT',
              message: 'Upload timed out',
            };
          }

          throw error;
        }
      },
      {
        maxRetries: retries,
        baseDelay: 2000, // Longer delay for upload retries
      }
    );
  }

  /**
   * Check network connectivity
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle Supabase errors specifically
   */
  handleSupabaseError(error: any): APIError {
    if (error.code === 'PGRST301') {
      return errorHandlingService.parseError({
        code: ERROR_CODES.PERMISSION_DENIED,
        message: 'You do not have permission to access this resource.',
      });
    }

    if (error.code === 'PGRST116') {
      return errorHandlingService.parseError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'The requested resource was not found.',
      });
    }

    if (error.message?.includes('JWT')) {
      return errorHandlingService.parseError({
        code: ERROR_CODES.AUTHENTICATION_ERROR,
        message: 'Authentication token is invalid or expired.',
      });
    }

    return errorHandlingService.parseError(error);
  }
}

export const networkService = new NetworkService();
export default networkService;