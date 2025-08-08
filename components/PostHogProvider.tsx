import React, { ReactNode } from 'react';
import { PostHogProvider as PostHogReactProvider } from 'posthog-react-native';
import analyticsService from '@/services/analyticsService';

interface PostHogProviderProps {
  children: ReactNode;
  apiKey?: string;
  options?: {
    host?: string;
    debug?: boolean;
    disabled?: boolean;
    autocapture?: {
      captureLifecycleEvents?: boolean;
      captureScreens?: boolean;
      captureTouches?: boolean;
      navigation?: {
        routeToName?: (name: string, params?: any) => string;
        routeToProperties?: (name: string, params?: any) => Record<string, any> | undefined;
      };
    };
  };
}

export default function PostHogProvider({
  children,
  apiKey,
  options = {}
}: PostHogProviderProps) {
  const {
    host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    debug = __DEV__,
    disabled = false,
    autocapture = {
      captureLifecycleEvents: true,
      captureScreens: true,
      captureTouches: true,
    },
  } = options;

  const finalApiKey = apiKey || process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

  if (!finalApiKey) {
    console.warn('PostHog API key not provided. Analytics will be disabled.');
    return <>{children}</>;
  }

  if (disabled) {
    console.log('PostHog is disabled');
    return <>{children}</>;
  }

  return (
    <PostHogReactProvider
      apiKey={finalApiKey}
      options={{
        host,
        // debug, // Removed as it's not supported in this version
        // App lifecycle events
        captureAppLifecycleEvents: autocapture.captureLifecycleEvents,
        // Disable session replay for privacy
        enableSessionReplay: false,
        // Batching configuration
        flushAt: 20,
        flushInterval: 10000,
        maxBatchSize: 100,
        maxQueueSize: 1000,
        // Request configuration
        requestTimeout: 10000,
        featureFlagsRequestTimeoutMs: 10000,
        fetchRetryCount: 3,
        fetchRetryDelay: 3000,
        // Session configuration
        sessionExpirationTimeSeconds: 1800, // 30 minutes
        // Opt-in by default
        defaultOptIn: true,
        // Disable GeoIP for privacy if needed
        disableGeoip: false,
        // Preload feature flags
        preloadFeatureFlags: true,
        // Send feature flag events
        sendFeatureFlagEvent: true,
      }}
      autocapture={{
        // captureLifecycleEvents: autocapture.captureLifecycleEvents, // Not supported in this version
        captureScreens: autocapture.captureScreens,
        captureTouches: autocapture.captureTouches,
        navigation: autocapture.navigation as any, // Type assertion for compatibility
      }}
    >
      {children}
    </PostHogReactProvider>
  );
}

// Export a hook for accessing PostHog instance
export { usePostHog } from 'posthog-react-native';