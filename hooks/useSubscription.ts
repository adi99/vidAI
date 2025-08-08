import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import {
    subscriptionService,
    SubscriptionPlan,
    SubscriptionStatus,
    SubscriptionPurchaseResult
} from '@/services/subscriptionService';

// Conditionally import expo-iap only on native platforms
let useExpoIAP: any = null;
let getAvailablePurchases: any = null;
let finishTransaction: any = null;

if (Platform.OS !== 'web') {
    try {
        const expoIAP = require('expo-iap');
        useExpoIAP = expoIAP.useIAP;
        getAvailablePurchases = expoIAP.getAvailablePurchases;
        finishTransaction = expoIAP.finishTransaction;
    } catch (error) {
        console.warn('expo-iap not available:', error);
    }
}

export interface UseSubscriptionReturn {
    // State
    plans: SubscriptionPlan[];
    subscriptionStatus: SubscriptionStatus;
    loading: boolean;
    purchasing: string | null;
    canMakePayments: boolean;
    initialized: boolean;

    // Actions
    purchaseSubscription: (planId: string) => Promise<SubscriptionPurchaseResult>;
    restoreSubscriptions: () => Promise<{ success: boolean; restoredCount: number; error?: string }>;
    refreshPlans: () => Promise<void>;
    refreshSubscriptionStatus: () => Promise<void>;
    openSubscriptionManagement: () => Promise<void>;

    // Helpers
    getPlanById: (planId: string) => SubscriptionPlan | undefined;
    formatPeriod: (period: 'monthly' | 'yearly') => string;
    isSubscriptionActive: () => boolean;
    getActiveSubscription: () => SubscriptionPlan | null;
}

export function useSubscription(): UseSubscriptionReturn {
    const { refreshUserData } = useAuth();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ isActive: false });
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);

    // Web fallback - subscriptions not supported on web
    const webFallback = {
        connected: false,
        subscriptions: [],
        currentPurchase: null,
        currentPurchaseError: null,
        getSubscriptions: async () => { },
        requestPurchase: async () => { },
        getAvailablePurchases: async () => [],
        finishTransaction: async () => { },
    };

    // Use the expo-iap hook only on native platforms
    const iapHook = Platform.OS !== 'web' && useExpoIAP ? useExpoIAP({
        onPurchaseSuccess: async (purchase: any) => {
            console.log('Subscription purchase successful:', purchase);
            await handleSubscriptionPurchase(purchase);
        },
        onPurchaseError: (error: any) => {
            console.error('Subscription purchase failed:', error);
            setPurchasing(null);
        },
    }) : webFallback;

    const {
        connected,
        subscriptions,
        currentPurchase,
        currentPurchaseError,
        getSubscriptions,
        requestPurchase,
    } = iapHook;

    // Initialize and load plans when connected
    useEffect(() => {
        if (Platform.OS === 'web') {
            // On web, just load static plans
            loadPlans();
        } else if (connected) {
            loadPlans();
            loadSubscriptionStatus();
        }
    }, [connected]);

    // Handle subscription purchase updates
    useEffect(() => {
        if (currentPurchase) {
            handleSubscriptionPurchase(currentPurchase);
        }
    }, [currentPurchase]);

    // Handle purchase errors
    useEffect(() => {
        if (currentPurchaseError) {
            console.error('Subscription purchase error:', currentPurchaseError);
            setPurchasing(null);
        }
    }, [currentPurchaseError]);

    const loadPlans = async () => {
        try {
            setLoading(true);

            if (Platform.OS !== 'web' && getSubscriptions) {
                // Load subscription products from the store
                const planIds = (await subscriptionService.getSubscriptionPlans()).map(plan => plan.id);
                await getSubscriptions({ skus: planIds });
            }

            // Get plans with updated pricing
            const updatedPlans = await subscriptionService.getSubscriptionPlans();
            setPlans(updatedPlans);
        } catch (error) {
            console.error('Error loading subscription plans:', error);
            // Fallback to static plans
            setPlans(await subscriptionService.getSubscriptionPlans());
        } finally {
            setLoading(false);
        }
    };

    const loadSubscriptionStatus = async () => {
        try {
            const status = await subscriptionService.getSubscriptionStatus();
            setSubscriptionStatus(status);
        } catch (error) {
            console.error('Error loading subscription status:', error);
            setSubscriptionStatus({ isActive: false });
        }
    };

    const handleSubscriptionPurchase = async (purchase: any) => {
        try {
            console.log('Processing subscription purchase:', purchase);

            // Validate subscription with backend
            const validationResult = await subscriptionService.validateSubscription(purchase);

            if (validationResult.success) {
                // Finish the transaction
                if (finishTransaction) {
                    await finishTransaction({
                        purchase,
                        isConsumable: false, // Subscriptions are not consumable
                    });
                }

                // Refresh subscription status and user data
                await Promise.all([
                    loadSubscriptionStatus(),
                    refreshUserData(),
                ]);

                Alert.alert(
                    'Subscription Activated!',
                    `Welcome to ${validationResult.subscription?.planName || 'Premium'}! Your subscription is now active.`
                );
            } else {
                Alert.alert('Subscription Failed', validationResult.error || 'Validation failed');
            }
        } catch (error) {
            console.error('Error processing subscription:', error);
            Alert.alert('Error', 'Failed to process subscription');
        } finally {
            setPurchasing(null);
        }
    };

    const purchaseSubscription = useCallback(async (planId: string): Promise<SubscriptionPurchaseResult> => {
        // Web platform doesn't support subscriptions
        if (Platform.OS === 'web') {
            Alert.alert(
                'Not Available on Web',
                'Subscriptions are only available on mobile devices. Please use the mobile app to subscribe.'
            );
            return {
                success: false,
                error: 'Subscriptions not supported on web',
            };
        }

        if (!connected) {
            return {
                success: false,
                error: 'Store is not connected',
            };
        }

        try {
            setPurchasing(planId);

            // Request subscription purchase with platform-specific parameters
            await requestPurchase({
                request: {
                    ios: {
                        sku: planId,
                        andDangerouslyFinishTransactionAutomaticallyIOS: false,
                    },
                    android: {
                        skus: [planId],
                    },
                },
                type: 'subs',
            });

            // The actual result will be handled by the onPurchaseSuccess callback
            return {
                success: true,
                planId,
                transactionId: 'pending', // Will be updated in callback
            };
        } catch (error) {
            console.error('Subscription purchase request failed:', error);
            setPurchasing(null);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Subscription purchase failed',
            };
        }
    }, [connected, requestPurchase]);

    const restoreSubscriptions = useCallback(async () => {
        // Web platform doesn't support subscriptions
        if (Platform.OS === 'web') {
            Alert.alert(
                'Not Available on Web',
                'Subscription restoration is only available on mobile devices.'
            );
            return {
                success: false,
                restoredCount: 0,
                error: 'Subscription restoration not supported on web',
            };
        }

        if (!connected || !getAvailablePurchases) {
            return {
                success: false,
                restoredCount: 0,
                error: 'Store is not connected',
            };
        }

        try {
            setLoading(true);
            const planIds = plans.map(plan => plan.id);
            const purchases = await getAvailablePurchases(planIds);

            if (purchases && purchases.length > 0) {
                let restoredCount = 0;

                for (const purchase of purchases) {
                    // Check if this is a subscription purchase
                    if (planIds.includes(purchase.productId)) {
                        const validationResult = await subscriptionService.validateSubscription(purchase);
                        if (validationResult.success) {
                            restoredCount++;
                        }
                    }
                }

                if (restoredCount > 0) {
                    await Promise.all([
                        loadSubscriptionStatus(),
                        refreshUserData(),
                    ]);
                }

                return {
                    success: true,
                    restoredCount,
                };
            } else {
                return {
                    success: false,
                    restoredCount: 0,
                    error: 'No subscriptions found to restore',
                };
            }
        } catch (error) {
            console.error('Restore subscriptions error:', error);
            return {
                success: false,
                restoredCount: 0,
                error: error instanceof Error ? error.message : 'Restore failed',
            };
        } finally {
            setLoading(false);
        }
    }, [connected, plans, refreshUserData]);

    const refreshPlans = useCallback(async () => {
        await loadPlans();
    }, []);

    const refreshSubscriptionStatus = useCallback(async () => {
        await loadSubscriptionStatus();
    }, []);

    const openSubscriptionManagement = useCallback(async () => {
        await subscriptionService.openSubscriptionManagement();
    }, []);

    const getPlanById = useCallback((planId: string): SubscriptionPlan | undefined => {
        return subscriptionService.getPlanById(planId);
    }, []);

    const formatPeriod = useCallback((period: 'monthly' | 'yearly'): string => {
        return subscriptionService.formatPeriod(period);
    }, []);

    const isSubscriptionActive = useCallback((): boolean => {
        return subscriptionStatus.isActive;
    }, [subscriptionStatus.isActive]);

    const getActiveSubscription = useCallback((): SubscriptionPlan | null => {
        if (!subscriptionStatus.isActive || !subscriptionStatus.planId) {
            return null;
        }
        return getPlanById(subscriptionStatus.planId) || null;
    }, [subscriptionStatus, getPlanById]);

    return {
        // State
        plans,
        subscriptionStatus,
        loading,
        purchasing,
        canMakePayments: connected,
        initialized: connected,

        // Actions
        purchaseSubscription,
        restoreSubscriptions,
        refreshPlans,
        refreshSubscriptionStatus,
        openSubscriptionManagement,

        // Helpers
        getPlanById,
        formatPeriod,
        isSubscriptionActive,
        getActiveSubscription,
    };
}

export default useSubscription;