import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import analyticsService, { GenerationAnalytics, UserProperties } from '@/services/analyticsService';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectivity } from './useConnectivity';

export interface UseAnalyticsOptions {
  trackScreenViews?: boolean;
  trackAppState?: boolean;
  trackConnectivity?: boolean;
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const {
    trackScreenViews = true,
    trackAppState = true,
    trackConnectivity = true,
  } = options;

  const { user, profile, credits, subscriptionStatus } = useAuth();
  const { isOnline } = useConnectivity();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const screenStartTime = useRef<number>(Date.now());

  // Update online status
  useEffect(() => {
    if (trackConnectivity) {
      analyticsService.setOnlineStatus(isOnline);
    }
  }, [isOnline, trackConnectivity]);

  // Track user identification
  useEffect(() => {
    if (user?.id) {
      const userProperties: UserProperties = {
        userId: user.id,
        email: user.email || undefined,
        username: profile?.username || undefined,
        subscriptionStatus: subscriptionStatus || 'free',
        credits: credits || 0,
        signupDate: user.created_at || undefined,
        lastActiveDate: new Date().toISOString(),
      };

      analyticsService.identifyUser(user.id, userProperties);
    }
  }, [user, profile, credits, subscriptionStatus]);

  // Track app state changes
  useEffect(() => {
    if (!trackAppState) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current === 'background' && nextAppState === 'active') {
        analyticsService.trackSessionStart();
      } else if (appStateRef.current === 'active' && nextAppState === 'background') {
        analyticsService.trackSessionEnd();
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Track initial session start
    analyticsService.trackSessionStart();

    return () => {
      subscription?.remove();
      analyticsService.trackSessionEnd();
    };
  }, [trackAppState]);

  /**
   * Track screen view
   */
  const trackScreen = useCallback((screenName: string, properties?: Record<string, any>) => {
    if (trackScreenViews) {
      screenStartTime.current = Date.now();
      analyticsService.trackScreen(screenName, properties);
    }
  }, [trackScreenViews]);

  /**
   * Track screen exit (for measuring time spent)
   */
  const trackScreenExit = useCallback((screenName: string, properties?: Record<string, any>) => {
    if (trackScreenViews) {
      const timeSpent = Date.now() - screenStartTime.current;
      analyticsService.track('screen_exit', {
        screen_name: screenName,
        time_spent: timeSpent,
        ...properties,
      });
    }
  }, [trackScreenViews]);

  /**
   * Track custom event
   */
  const track = useCallback((event: string, properties?: Record<string, any>) => {
    analyticsService.track(event, properties);
  }, []);

  /**
   * Track user engagement
   */
  const trackEngagement = useCallback((action: string, properties?: Record<string, any>) => {
    analyticsService.trackEngagement(action, properties);
  }, []);

  /**
   * Track generation events
   */
  const trackGeneration = useCallback((analytics: GenerationAnalytics) => {
    analyticsService.trackGeneration(analytics);
  }, []);

  /**
   * Track social interactions
   */
  const trackSocial = useCallback((
    action: 'like' | 'comment' | 'share' | 'follow',
    contentType: 'video' | 'image',
    properties?: Record<string, any>
  ) => {
    analyticsService.trackSocialInteraction(action, contentType, properties);
  }, []);

  /**
   * Track credit transactions
   */
  const trackCredits = useCallback((
    type: 'purchase' | 'spend' | 'refund' | 'earn',
    amount: number,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackCreditTransaction(type, amount, properties);
  }, []);

  /**
   * Track subscription events
   */
  const trackSubscription = useCallback((
    action: 'subscribe' | 'upgrade' | 'downgrade' | 'cancel' | 'renew',
    planId: string,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackSubscription(action, planId, properties);
  }, []);

  /**
   * Track errors
   */
  const trackError = useCallback((
    error: Error | string,
    context: string,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackError(error, context, properties);
  }, []);

  /**
   * Track performance metrics
   */
  const trackPerformance = useCallback((
    metric: string,
    value: number,
    unit?: string,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackPerformance(metric, value, unit, properties);
  }, []);

  /**
   * Track feature usage
   */
  const trackFeature = useCallback((
    feature: string,
    action: 'viewed' | 'used' | 'completed' | 'abandoned',
    properties?: Record<string, any>
  ) => {
    analyticsService.trackFeatureUsage(feature, action, properties);
  }, []);

  /**
   * Track user milestones
   */
  const trackMilestone = useCallback((
    milestone: string,
    properties?: Record<string, any>
  ) => {
    analyticsService.trackMilestone(milestone, properties);
  }, []);

  /**
   * Start timing an operation
   */
  const startTiming = useCallback((eventName: string) => {
    return analyticsService.startTiming(eventName);
  }, []);

  /**
   * Update user properties
   */
  const updateUserProperties = useCallback((properties: Partial<UserProperties>) => {
    analyticsService.updateUserProperties(properties);
  }, []);

  /**
   * Track button/interaction events with common properties
   */
  const trackInteraction = useCallback((
    element: string,
    action: string = 'tap',
    properties?: Record<string, any>
  ) => {
    track('user_interaction', {
      element,
      action,
      ...properties,
    });
  }, [track]);

  /**
   * Track form events
   */
  const trackForm = useCallback((
    formName: string,
    action: 'start' | 'complete' | 'abandon' | 'error',
    properties?: Record<string, any>
  ) => {
    track('form_interaction', {
      form_name: formName,
      action,
      ...properties,
    });
  }, [track]);

  /**
   * Track search events
   */
  const trackSearch = useCallback((
    query: string,
    results: number,
    properties?: Record<string, any>
  ) => {
    track('search_performed', {
      search_query: query,
      results_count: results,
      query_length: query.length,
      ...properties,
    });
  }, [track]);

  /**
   * Track onboarding events
   */
  const trackOnboarding = useCallback((
    step: string,
    action: 'start' | 'complete' | 'skip' | 'abandon',
    properties?: Record<string, any>
  ) => {
    track('onboarding_step', {
      step_name: step,
      action,
      ...properties,
    });
  }, [track]);

  /**
   * Track tutorial events
   */
  const trackTutorial = useCallback((
    tutorial: string,
    action: 'start' | 'complete' | 'skip' | 'abandon',
    step?: string,
    properties?: Record<string, any>
  ) => {
    track('tutorial_interaction', {
      tutorial_name: tutorial,
      action,
      step_name: step,
      ...properties,
    });
  }, [track]);

  /**
   * Track sharing events
   */
  const trackShare = useCallback((
    contentType: string,
    platform: string,
    properties?: Record<string, any>
  ) => {
    track('content_shared', {
      content_type: contentType,
      share_platform: platform,
      ...properties,
    });
  }, [track]);

  /**
   * Track conversion events
   */
  const trackConversion = useCallback((
    conversionType: string,
    value?: number,
    properties?: Record<string, any>
  ) => {
    track('conversion', {
      conversion_type: conversionType,
      conversion_value: value,
      ...properties,
    });
  }, [track]);

  return {
    // Core tracking methods
    track,
    trackScreen,
    trackScreenExit,
    trackEngagement,
    trackInteraction,

    // Specific event types
    trackGeneration,
    trackSocial,
    trackCredits,
    trackSubscription,
    trackError,
    trackPerformance,
    trackFeature,
    trackMilestone,

    // Form and UI tracking
    trackForm,
    trackSearch,
    trackOnboarding,
    trackTutorial,
    trackShare,
    trackConversion,

    // Utilities
    startTiming,
    updateUserProperties,

    // Analytics status
    getStatus: analyticsService.getStatus.bind(analyticsService),
    flush: analyticsService.flush.bind(analyticsService),
  };
}

export default useAnalytics;