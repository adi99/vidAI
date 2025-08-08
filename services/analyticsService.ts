/**
 * Analytics Service for PostHog React Native SDK v4+
 * 
 * This service provides a comprehensive wrapper around PostHog analytics
 * with support for event tracking, user identification, feature flags,
 * offline queuing, and error handling.
 * 
 * Updated to use PostHog React Native SDK v4+ API and best practices.
 */

import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AnalyticsEvent {
    event: string;
    properties?: Record<string, any>;
    timestamp?: number;
}

export interface UserProperties {
    userId?: string;
    email?: string;
    username?: string;
    subscriptionStatus?: string;
    credits?: number;
    signupDate?: string;
    lastActiveDate?: string;
    totalGenerations?: number;
    preferredModel?: string;
    [key: string]: any;
}

export interface GenerationAnalytics {
    type: 'image' | 'video' | 'training';
    model: string;
    prompt: string;
    settings: Record<string, any>;
    creditsUsed: number;
    duration?: number;
    success: boolean;
    failureReason?: string;
}

class AnalyticsService {
    private posthog: PostHog | null = null;
    private isInitialized = false;
    private userId: string | null = null;
    private sessionId: string;
    private sessionStartTime: number;
    private eventQueue: AnalyticsEvent[] = [];
    private isOnline = true;

    constructor() {
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = Date.now();
        this.initialize();
    }

    /**
     * Initialize PostHog analytics following official v4+ documentation
     */
    private async initialize() {
        try {
            const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
            const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

            if (!apiKey) {
                console.warn('PostHog API key not found. Analytics will be disabled.');
                return;
            }

            // Initialize PostHog instance following v4+ pattern
            this.posthog = new PostHog(apiKey, {
                host,
                // App lifecycle events (v4+ syntax)
                captureAppLifecycleEvents: true,
                // Session replay configuration
                enableSessionReplay: false,
                // Batching configuration
                flushAt: 20, // Send events in batches of 20
                flushInterval: 10000, // Send events every 10 seconds
                maxBatchSize: 100,
                maxQueueSize: 1000,
                // Request configuration
                requestTimeout: 10000,
                featureFlagsRequestTimeoutMs: 10000,
                fetchRetryCount: 3,
                fetchRetryDelay: 3000,
                // Session configuration
                sessionExpirationTimeSeconds: 1800, // 30 minutes
                enablePersistSessionIdAcrossRestart: true, // v4+ feature for session persistence
                // Opt-in by default
                defaultOptIn: true,
                // Disable GeoIP for privacy if needed
                disableGeoip: false,
                // Feature flags configuration
                preloadFeatureFlags: true,
                sendFeatureFlagEvent: true,
                // Custom app properties function
                customAppProperties: (defaultProperties: any) => ({
                    ...defaultProperties,
                    platform: Platform.OS,
                    platformVersion: Platform.Version,
                    sessionId: this.sessionId,
                    appVersion: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
                    buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER || '1',
                }),
                // Persistence configuration
                persistence: 'file', // Use file-based storage
                // Disable for local development if needed
                disabled: __DEV__ && process.env.EXPO_PUBLIC_POSTHOG_DISABLED === 'true',
            });

            this.isInitialized = true;
            console.log('PostHog analytics initialized');

            // Load any queued events from storage
            await this.loadEventQueue();

            // Set initial super properties
            await this.setInitialProperties();

            // Process any queued events
            await this.processEventQueue();

        } catch (error) {
            console.error('Failed to initialize PostHog:', error);
        }
    }

    /**
     * Set initial super properties (sent with every event)
     */
    private async setInitialProperties() {
        if (!this.isInitialized || !this.posthog) return;

        try {
            const superProperties = {
                sessionId: this.sessionId,
                sessionStartTime: this.sessionStartTime,
                platform: Platform.OS,
                platformVersion: Platform.Version,
                appVersion: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
                buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER || '1',
            };

            this.posthog.register(superProperties);
        } catch (error) {
            console.error('Failed to set initial properties:', error);
        }
    }

    /**
     * Identify user with properties following PostHog v4+ best practices
     */
    async identifyUser(userId: string, properties: UserProperties = {}) {
        this.userId = userId;

        if (this.isInitialized && this.posthog) {
            try {
                // Use $set and $set_once as recommended in v4+ documentation
                this.posthog.identify(userId, {
                    $set: {
                        ...properties,
                        lastIdentified: new Date().toISOString(),
                        lastActiveDate: new Date().toISOString(),
                    },
                    $set_once: {
                        signupDate: properties.signupDate || new Date().toISOString(),
                        firstIdentified: new Date().toISOString(),
                    },
                });

                console.log('User identified:', userId);
            } catch (error) {
                console.error('Failed to identify user:', error);
            }
        }
    }

    /**
     * Track custom event using PostHog capture method (v4+ compatible)
     */
    async track(event: string, properties: Record<string, any> = {}) {
        const eventData: AnalyticsEvent = {
            event,
            properties: {
                ...properties,
                // Don't add sessionId here as it's already in super properties
                timestamp: Date.now(),
                userId: this.userId,
            },
            timestamp: Date.now(),
        };

        if (this.isInitialized && this.posthog && this.isOnline) {
            try {
                this.posthog.capture(event, eventData.properties);
                console.log('Event tracked:', event, eventData.properties);
            } catch (error) {
                console.error('Failed to track event:', error);
                // Queue event for later if tracking fails
                this.queueEvent(eventData);
            }
        } else {
            // Queue event if not initialized or offline
            this.queueEvent(eventData);
        }
    }

    /**
     * Track screen view using PostHog screen method (v4+ compatible)
     */
    async trackScreen(screenName: string, properties: Record<string, any> = {}) {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.screen(screenName, properties);
                console.log('Screen tracked:', screenName, properties);
            } catch (error) {
                console.error('Failed to track screen:', error);
                // Fallback to regular event tracking with $screen event
                await this.track('$screen', {
                    $screen_name: screenName,
                    ...properties,
                });
            }
        } else {
            // Queue as regular event if not initialized
            await this.track('$screen', {
                $screen_name: screenName,
                ...properties,
            });
        }
    }

    /**
     * Track user engagement events
     */
    async trackEngagement(action: string, properties: Record<string, any> = {}) {
        await this.track('user_engagement', {
            action,
            ...properties,
        });
    }

    /**
     * Track generation events
     */
    async trackGeneration(analytics: GenerationAnalytics) {
        await this.track('generation_request', {
            generation_type: analytics.type,
            model: analytics.model,
            prompt_length: analytics.prompt.length,
            credits_used: analytics.creditsUsed,
            settings: analytics.settings,
            success: analytics.success,
            failure_reason: analytics.failureReason,
            duration: analytics.duration,
        });

        // Track specific generation type events
        await this.track(`${analytics.type}_generation`, {
            model: analytics.model,
            success: analytics.success,
            credits_used: analytics.creditsUsed,
            settings: analytics.settings,
        });
    }

    /**
     * Track social interactions
     */
    async trackSocialInteraction(
        action: 'like' | 'comment' | 'share' | 'follow',
        contentType: 'video' | 'image',
        properties: Record<string, any> = {}
    ) {
        await this.track('social_interaction', {
            action,
            content_type: contentType,
            ...properties,
        });
    }

    /**
     * Track credit transactions
     */
    async trackCreditTransaction(
        type: 'purchase' | 'spend' | 'refund' | 'earn',
        amount: number,
        properties: Record<string, any> = {}
    ) {
        await this.track('credit_transaction', {
            transaction_type: type,
            amount,
            ...properties,
        });
    }

    /**
     * Track subscription events
     */
    async trackSubscription(
        action: 'subscribe' | 'upgrade' | 'downgrade' | 'cancel' | 'renew',
        planId: string,
        properties: Record<string, any> = {}
    ) {
        await this.track('subscription_event', {
            action,
            plan_id: planId,
            ...properties,
        });
    }

    /**
     * Track errors and crashes
     */
    async trackError(
        error: Error | string,
        context: string,
        properties: Record<string, any> = {}
    ) {
        const errorMessage = typeof error === 'string' ? error : error.message;
        const errorStack = typeof error === 'object' ? error.stack : undefined;

        await this.track('error_occurred', {
            error_message: errorMessage,
            error_stack: errorStack,
            context,
            ...properties,
        });
    }

    /**
     * Track performance metrics
     */
    async trackPerformance(
        metric: string,
        value: number,
        unit: string = 'ms',
        properties: Record<string, any> = {}
    ) {
        await this.track('performance_metric', {
            metric_name: metric,
            metric_value: value,
            metric_unit: unit,
            ...properties,
        });
    }

    /**
     * Track feature usage
     */
    async trackFeatureUsage(
        feature: string,
        action: 'viewed' | 'used' | 'completed' | 'abandoned',
        properties: Record<string, any> = {}
    ) {
        await this.track('feature_usage', {
            feature_name: feature,
            action,
            ...properties,
        });
    }

    /**
     * Track user journey milestones
     */
    async trackMilestone(
        milestone: string,
        properties: Record<string, any> = {}
    ) {
        await this.track('user_milestone', {
            milestone_name: milestone,
            session_duration: Date.now() - this.sessionStartTime,
            ...properties,
        });
    }

    /**
     * Update user properties using $set
     */
    async updateUserProperties(properties: Partial<UserProperties>) {
        if (this.isInitialized && this.posthog && this.userId) {
            try {
                this.posthog.identify(this.userId, {
                    $set: {
                        ...properties,
                        lastUpdated: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error('Failed to update user properties:', error);
            }
        }
    }

    /**
     * Set super properties (sent with every event)
     */
    async setSuperProperties(properties: Record<string, any>) {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.register(properties);
            } catch (error) {
                console.error('Failed to set super properties:', error);
            }
        }
    }

    /**
     * Remove super properties
     */
    async removeSuperProperties(propertyName: string) {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.unregister(propertyName);
            } catch (error) {
                console.error('Failed to remove super property:', error);
            }
        }
    }

    /**
     * Start timing an event
     */
    startTiming(eventName: string): () => Promise<void> {
        const startTime = Date.now();

        return async () => {
            const duration = Date.now() - startTime;
            await this.trackPerformance(eventName, duration, 'ms');
        };
    }

    /**
     * Track session events
     */
    async trackSessionStart() {
        await this.track('session_start', {
            session_id: this.sessionId,
            timestamp: this.sessionStartTime,
        });
    }

    async trackSessionEnd() {
        const sessionDuration = Date.now() - this.sessionStartTime;
        await this.track('session_end', {
            session_id: this.sessionId,
            session_duration: sessionDuration,
        });
    }

    /**
     * Set online/offline status
     */
    setOnlineStatus(isOnline: boolean) {
        this.isOnline = isOnline;

        if (isOnline && this.eventQueue.length > 0) {
            this.processEventQueue();
        }
    }

    /**
     * Queue event for later processing
     */
    private queueEvent(event: AnalyticsEvent) {
        this.eventQueue.push(event);

        // Limit queue size
        if (this.eventQueue.length > 100) {
            this.eventQueue = this.eventQueue.slice(-50); // Keep last 50 events
        }

        // Save to storage
        this.saveEventQueue();
    }

    /**
     * Process queued events
     */
    private async processEventQueue() {
        if (!this.isInitialized || !this.posthog || !this.isOnline || this.eventQueue.length === 0) {
            return;
        }

        const eventsToProcess = [...this.eventQueue];
        this.eventQueue = [];

        for (const event of eventsToProcess) {
            try {
                this.posthog.capture(event.event, event.properties);
            } catch (error) {
                console.error('Failed to process queued event:', error);
                // Re-queue failed events
                this.eventQueue.push(event);
            }
        }

        await this.saveEventQueue();
    }

    /**
     * Save event queue to storage
     */
    private async saveEventQueue() {
        try {
            await AsyncStorage.setItem('analytics_queue', JSON.stringify(this.eventQueue));
        } catch (error) {
            console.error('Failed to save event queue:', error);
        }
    }

    /**
     * Load event queue from storage
     */
    private async loadEventQueue() {
        try {
            const queueData = await AsyncStorage.getItem('analytics_queue');
            if (queueData) {
                this.eventQueue = JSON.parse(queueData);
            }
        } catch (error) {
            console.error('Failed to load event queue:', error);
        }
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Reset analytics (for logout) - clears all stored data
     */
    async reset() {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.reset();
                this.userId = null;
                this.eventQueue = [];
                await AsyncStorage.removeItem('analytics_queue');
                console.log('Analytics reset');
            } catch (error) {
                console.error('Failed to reset analytics:', error);
            }
        }
    }

    /**
     * Flush all pending events
     */
    async flush() {
        if (this.isInitialized && this.posthog) {
            try {
                await this.posthog.flush();
                await this.processEventQueue();
            } catch (error) {
                console.error('Failed to flush analytics:', error);
            }
        }
    }

    /**
     * Opt out of tracking (v4+ method)
     */
    async optOut() {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.optOut();
                console.log('User opted out of tracking');
            } catch (error) {
                console.error('Failed to opt out:', error);
            }
        }
    }

    /**
     * Opt in to tracking (v4+ method)
     */
    async optIn() {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.optIn();
                console.log('User opted in to tracking');
            } catch (error) {
                console.error('Failed to opt in:', error);
            }
        }
    }

    /**
     * Check if user has opted out (v4+ property)
     */
    hasOptedOut(): boolean {
        if (this.isInitialized && this.posthog) {
            return this.posthog.optedOut;
        }
        return false;
    }

    /**
     * Get current distinct ID (v4+ method name)
     */
    getDistinctId(): string | null {
        if (this.isInitialized && this.posthog) {
            return this.posthog.getDistinctId();
        }
        return null;
    }

    /**
     * Set alias for current user
     */
    async alias(distinctId: string) {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.alias(distinctId);
                console.log('Alias set:', distinctId);
            } catch (error) {
                console.error('Failed to set alias:', error);
            }
        }
    }

    /**
     * Feature flag methods (v4+ compatible)
     */
    isFeatureEnabled(flagKey: string): boolean | undefined {
        if (this.isInitialized && this.posthog) {
            return this.posthog.isFeatureEnabled(flagKey);
        }
        return undefined;
    }

    getFeatureFlag(flagKey: string): string | boolean | undefined {
        if (this.isInitialized && this.posthog) {
            return this.posthog.getFeatureFlag(flagKey);
        }
        return undefined;
    }

    getFeatureFlagPayload(flagKey: string): any {
        if (this.isInitialized && this.posthog) {
            return this.posthog.getFeatureFlagPayload(flagKey);
        }
        return undefined;
    }

    async reloadFeatureFlags(): Promise<void> {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.reloadFeatureFlags();
            } catch (error) {
                console.error('Failed to reload feature flags:', error);
            }
        }
    }

    async reloadFeatureFlagsAsync(): Promise<Record<string, any> | undefined> {
        if (this.isInitialized && this.posthog) {
            try {
                return await this.posthog.reloadFeatureFlagsAsync();
            } catch (error) {
                console.error('Failed to reload feature flags async:', error);
                return undefined;
            }
        }
        return undefined;
    }

    /**
     * Group analytics methods
     */
    async group(groupType: string, groupKey: string, properties?: Record<string, any>) {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.group(groupType, groupKey, properties);
                console.log('Group set:', groupType, groupKey, properties);
            } catch (error) {
                console.error('Failed to set group:', error);
            }
        }
    }

    /**
     * Set properties for feature flag evaluation (v4+ methods)
     */
    setPersonPropertiesForFlags(properties: Record<string, any>, reloadFlags: boolean = true) {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.setPersonPropertiesForFlags(properties);
                if (reloadFlags) {
                    this.posthog.reloadFeatureFlags();
                }
            } catch (error) {
                console.error('Failed to set person properties for flags:', error);
            }
        }
    }

    setGroupPropertiesForFlags(properties: Record<string, Record<string, any>>) {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.setGroupPropertiesForFlags(properties);
            } catch (error) {
                console.error('Failed to set group properties for flags:', error);
            }
        }
    }

    resetPersonPropertiesForFlags() {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.resetPersonPropertiesForFlags();
            } catch (error) {
                console.error('Failed to reset person properties for flags:', error);
            }
        }
    }

    resetGroupPropertiesForFlags() {
        if (this.isInitialized && this.posthog) {
            try {
                this.posthog.resetGroupPropertiesForFlags();
            } catch (error) {
                console.error('Failed to reset group properties for flags:', error);
            }
        }
    }

    /**
     * Bootstrap PostHog with precomputed feature flags (v4+ feature)
     * This allows feature flags to be available immediately on initialization
     */
    static createWithBootstrap(
        apiKey: string,
        options: any = {},
        bootstrap: {
            distinctId?: string;
            isIdentifiedId?: boolean;
            featureFlags?: Record<string, any>;
            featureFlagPayloads?: Record<string, any>;
        } = {}
    ): PostHog {
        const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

        return new PostHog(apiKey, {
            host,
            ...options,
            bootstrap,
        });
    }

    /**
     * Get analytics status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            userId: this.userId,
            distinctId: this.getDistinctId(),
            sessionId: this.sessionId,
            queuedEvents: this.eventQueue.length,
            isOnline: this.isOnline,
            hasOptedOut: this.hasOptedOut(),
        };
    }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;