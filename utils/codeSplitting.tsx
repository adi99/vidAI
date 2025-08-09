import React, { Suspense, lazy, ComponentType } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { performanceOptimizationService } from '@/services/performanceOptimizationService';

export interface LazyComponentOptions {
    fallback?: React.ComponentType;
    errorBoundary?: React.ComponentType<{ error: Error; retry: () => void }>;
    preload?: boolean;
    timeout?: number;
}

export interface CodeSplitConfig {
    chunkName?: string;
    priority?: 'low' | 'normal' | 'high';
    preloadCondition?: () => boolean;
}

/**
 * Create a lazy-loaded component with performance tracking
 */
export function createLazyComponent<T extends ComponentType<any>>(
    importFunction: () => Promise<{ default: T }>,
    componentName: string,
    options: LazyComponentOptions = {}
): ComponentType<React.ComponentProps<T>> {
    const {
        fallback: CustomFallback,
        errorBoundary: CustomErrorBoundary,
        preload = false,
        timeout = 10000,
    } = options;

    // Create lazy component with timeout
    const LazyComponent = lazy(() => {
        const startTime = Date.now();

        const importPromise = performanceOptimizationService.lazyLoadComponent(
            importFunction,
            componentName
        );

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Component ${componentName} failed to load within ${timeout}ms`));
            }, timeout);
        });

        return Promise.race([importPromise, timeoutPromise]).then((component) => {
            const loadTime = Date.now() - startTime;
            console.log(`✅ Lazy loaded ${componentName} in ${loadTime}ms`);
            return { default: component };
        });
    });

    // Preload if requested
    if (preload) {
        // Preload after a short delay to not block initial render
        setTimeout(() => {
            importFunction().catch(error => {
                console.warn(`Failed to preload ${componentName}:`, error);
            });
        }, 100);
    }

    // Default fallback component
    const DefaultFallback = () => (
        <View style={styles.fallbackContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
    );

    // Default error boundary
    const DefaultErrorBoundary: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
        <View style={styles.errorContainer}>
            <ActivityIndicator size="small" color="#EF4444" />
        </View>
    );

    // Return wrapped component
    return React.forwardRef<any, React.ComponentProps<T>>((props, ref) => (
        <ErrorBoundaryWrapper
            ErrorComponent={CustomErrorBoundary || DefaultErrorBoundary}
            componentName={componentName}
        >
            <Suspense fallback={CustomFallback ? <CustomFallback /> : <DefaultFallback />}>
                <LazyComponent {...(props as any)} ref={ref} />
            </Suspense>
        </ErrorBoundaryWrapper>
    ));
}

/**
 * Error boundary wrapper for lazy components
 */
class ErrorBoundaryWrapper extends React.Component<{
    children: React.ReactNode;
    ErrorComponent: React.ComponentType<{ error: Error; retry: () => void }>;
    componentName: string;
}, { hasError: boolean; error: Error | null }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(`Error in lazy component ${this.props.componentName}:`, error, errorInfo);
    }

    retry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            return <this.props.ErrorComponent error={this.state.error} retry={this.retry} />;
        }

        return this.props.children;
    }
}

/**
 * Preload multiple components based on conditions
 */
export class ComponentPreloader {
    private preloadedComponents = new Set<string>();
    private preloadPromises = new Map<string, Promise<any>>();

    /**
     * Preload a component
     */
    preload<T>(
        importFunction: () => Promise<{ default: T }>,
        componentName: string,
        condition: () => boolean = () => true
    ): Promise<T> {
        if (this.preloadedComponents.has(componentName)) {
            return this.preloadPromises.get(componentName)!;
        }

        if (!condition()) {
            return Promise.reject(new Error(`Preload condition not met for ${componentName}`));
        }

        const promise = performanceOptimizationService.lazyLoadComponent(
            importFunction,
            componentName
        ).then((component) => {
            this.preloadedComponents.add(componentName);
            return component;
        }).catch((error) => {
            console.error(`Failed to preload ${componentName}:`, error);
            throw error;
        });

        this.preloadPromises.set(componentName, promise);
        return promise;
    }

    /**
     * Preload components based on route
     */
    preloadForRoute(routeName: string) {
        const routePreloadMap: Record<string, Array<() => Promise<any>>> = {
            'feed': [
                () => import('@/components/CommentsModal'),
                () => import('@/components/ui/GestureVideoPlayer'),
            ],
            'video': [
                () => import('@/components/ui/GenerationProgress'),
                () => import('@/components/ui/SmoothProgressBar'),
            ],
            'image': [
                () => import('@/components/ui/GenerationProgress'),
                () => import('@/components/ui/AnimatedCard'),
            ],
            'training': [
                () => import('@/components/ui/LoadingSkeleton'),
                () => import('@/components/ui/SmoothProgressBar'),
            ],
            'profile': [
                () => import('@/components/ui/AnimatedCard'),
                () => import('@/components/ui/LoadingSkeleton'),
            ],
        };

        const preloadFunctions = routePreloadMap[routeName];
        if (preloadFunctions) {
            preloadFunctions.forEach((importFn, index) => {
                this.preload(importFn, `${routeName}_component_${index}`);
            });
        }
    }

    /**
     * Clear preloaded components
     */
    clear() {
        this.preloadedComponents.clear();
        this.preloadPromises.clear();
    }

    /**
     * Get preload statistics
     */
    getStats() {
        return {
            preloadedCount: this.preloadedComponents.size,
            pendingCount: this.preloadPromises.size - this.preloadedComponents.size,
            preloadedComponents: Array.from(this.preloadedComponents),
        };
    }
}

/**
 * Bundle splitting utilities
 */
export class BundleSplitter {
    /**
     * Split component by feature
     */
    static splitByFeature<T extends ComponentType<any>>(
        importFunction: () => Promise<{ default: T }>,
        featureName: string,
        config: CodeSplitConfig = {}
    ) {
        const { chunkName, priority = 'normal', preloadCondition } = config;

        return createLazyComponent(
            importFunction,
            chunkName || featureName,
            {
                preload: preloadCondition ? preloadCondition() : priority === 'high',
                timeout: priority === 'high' ? 5000 : 10000,
            }
        );
    }

    /**
     * Split component by route
     */
    static splitByRoute<T extends ComponentType<any>>(
        importFunction: () => Promise<{ default: T }>,
        routeName: string
    ) {
        return this.splitByFeature(importFunction, `route_${routeName}`, {
            chunkName: routeName,
            priority: 'normal',
        });
    }

    /**
     * Split heavy component
     */
    static splitHeavyComponent<T extends ComponentType<any>>(
        importFunction: () => Promise<{ default: T }>,
        componentName: string
    ) {
        return this.splitByFeature(importFunction, componentName, {
            priority: 'low',
            preloadCondition: () => {
                // Only preload on high-performance devices
                const profile = performanceOptimizationService.getDevicePerformanceProfile();
                return profile.performanceClass === 'high';
            },
        });
    }
}

// Global component preloader instance
export const componentPreloader = new ComponentPreloader();

// Styles
const styles = StyleSheet.create({
    fallbackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1F2937',
    },
});

// Export commonly used lazy components
export const LazyCommentsModal = createLazyComponent(
    () => import('@/components/CommentsModal'),
    'CommentsModal',
    { preload: true }
);

export const LazyGestureVideoPlayer = createLazyComponent(
    () => import('@/components/ui/GestureVideoPlayer'),
    'GestureVideoPlayer',
    { preload: true }
);

export const LazyGenerationProgress = createLazyComponent(
    () => import('@/components/ui/GenerationProgress'),
    'GenerationProgress'
);

export const LazySmoothProgressBar = createLazyComponent(
    () => import('@/components/ui/SmoothProgressBar'),
    'SmoothProgressBar'
);

export const LazyLoadingSkeleton = createLazyComponent(
    () => import('@/components/ui/LoadingSkeleton'),
    'LoadingSkeleton'
);

export const LazyAnimatedCard = createLazyComponent(
    () => import('@/components/ui/AnimatedCard'),
    'AnimatedCard'
);