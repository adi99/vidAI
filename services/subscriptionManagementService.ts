import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { subscriptionStatusService } from './subscriptionStatusService';

// Conditionally import expo-iap only on native platforms
let deepLinkToSubscriptions: any = null;

if (Platform.OS !== 'web') {
    try {
        const expoIAP = require('expo-iap');
        deepLinkToSubscriptions = expoIAP.deepLinkToSubscriptions;
    } catch (error) {
        console.warn('expo-iap not available:', error);
    }
}

export interface SubscriptionManagementResult {
    success: boolean;
    action: string;
    message?: string;
    error?: string;
    subscription?: any;
}

export interface BillingHistory {
    id: string;
    date: Date;
    amount: number;
    currency: string;
    planName: string;
    status: 'paid' | 'pending' | 'failed' | 'refunded';
    transactionId: string;
    receiptUrl?: string;
}

export interface SubscriptionUpgradeOptions {
    currentPlan: string;
    availableUpgrades: {
        planId: string;
        planName: string;
        price: number;
        savings?: string;
        features: string[];
    }[];
    prorationAmount?: number;
    effectiveDate: Date;
}

export class SubscriptionManagementService {
    private static instance: SubscriptionManagementService;

    static getInstance(): SubscriptionManagementService {
        if (!SubscriptionManagementService.instance) {
            SubscriptionManagementService.instance = new SubscriptionManagementService();
        }
        return SubscriptionManagementService.instance;
    }

    /**
     * Cancel subscription at period end
     */
    async cancelSubscription(): Promise<SubscriptionManagementResult> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return {
                    success: false,
                    action: 'cancel',
                    error: 'User not authenticated',
                };
            }

            // Get current subscription status
            const status = await subscriptionStatusService.getSubscriptionStatus();
            if (!status.isActive || !status.planId) {
                return {
                    success: false,
                    action: 'cancel',
                    error: 'No active subscription found',
                };
            }

            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/manage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    action: 'cancel',
                    plan_id: status.planId,
                }),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                // Clear cache to force refresh
                subscriptionStatusService.clearCache();

                return {
                    success: true,
                    action: 'cancel',
                    message: 'Subscription will be cancelled at the end of the current billing period',
                    subscription: result.subscription,
                };
            } else {
                return {
                    success: false,
                    action: 'cancel',
                    error: result.message || 'Failed to cancel subscription',
                };
            }
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            return {
                success: false,
                action: 'cancel',
                error: error instanceof Error ? error.message : 'Failed to cancel subscription',
            };
        }
    }

    /**
     * Reactivate cancelled subscription
     */
    async reactivateSubscription(): Promise<SubscriptionManagementResult> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return {
                    success: false,
                    action: 'reactivate',
                    error: 'User not authenticated',
                };
            }

            const status = await subscriptionStatusService.getSubscriptionStatus();
            if (!status.planId) {
                return {
                    success: false,
                    action: 'reactivate',
                    error: 'No subscription found',
                };
            }

            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/manage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    action: 'reactivate',
                    plan_id: status.planId,
                }),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                subscriptionStatusService.clearCache();

                return {
                    success: true,
                    action: 'reactivate',
                    message: 'Subscription has been reactivated',
                    subscription: result.subscription,
                };
            } else {
                return {
                    success: false,
                    action: 'reactivate',
                    error: result.message || 'Failed to reactivate subscription',
                };
            }
        } catch (error) {
            console.error('Error reactivating subscription:', error);
            return {
                success: false,
                action: 'reactivate',
                error: error instanceof Error ? error.message : 'Failed to reactivate subscription',
            };
        }
    }

    /**
     * Get upgrade options for current subscription
     */
    async getUpgradeOptions(): Promise<SubscriptionUpgradeOptions | null> {
        try {
            const status = await subscriptionStatusService.getSubscriptionStatus();
            if (!status.isActive || !status.planId) {
                return null;
            }

            const currentPlan = status.planId;
            const availableUpgrades: SubscriptionUpgradeOptions['availableUpgrades'] = [];

            // Define upgrade paths
            if (currentPlan === 'premium_monthly') {
                availableUpgrades.push(
                    {
                        planId: 'premium_yearly',
                        planName: 'Premium Yearly',
                        price: 99.99,
                        savings: 'Save 17% vs monthly',
                        features: [
                            '15,000 credits per year',
                            'Same features as monthly',
                            'Early access to new features',
                        ],
                    },
                    {
                        planId: 'pro_monthly',
                        planName: 'Pro Monthly',
                        price: 19.99,
                        features: [
                            '2,500 credits per month',
                            'Highest priority queue',
                            'All AI models',
                            '4K video generation',
                            'Commercial license',
                            'Priority support',
                        ],
                    },
                    {
                        planId: 'pro_yearly',
                        planName: 'Pro Yearly',
                        price: 199.99,
                        savings: 'Save 17% vs monthly',
                        features: [
                            '35,000 credits per year',
                            'All Pro features',
                            'API access',
                        ],
                    }
                );
            } else if (currentPlan === 'premium_yearly') {
                availableUpgrades.push(
                    {
                        planId: 'pro_monthly',
                        planName: 'Pro Monthly',
                        price: 19.99,
                        features: [
                            '2,500 credits per month',
                            'Highest priority queue',
                            'All AI models',
                            '4K video generation',
                            'Commercial license',
                            'Priority support',
                        ],
                    },
                    {
                        planId: 'pro_yearly',
                        planName: 'Pro Yearly',
                        price: 199.99,
                        savings: 'Save 17% vs monthly',
                        features: [
                            '35,000 credits per year',
                            'All Pro features',
                            'API access',
                        ],
                    }
                );
            } else if (currentPlan === 'pro_monthly') {
                availableUpgrades.push({
                    planId: 'pro_yearly',
                    planName: 'Pro Yearly',
                    price: 199.99,
                    savings: 'Save 17% vs monthly',
                    features: [
                        '35,000 credits per year',
                        'Same features as monthly',
                        'API access',
                    ],
                });
            }

            return {
                currentPlan,
                availableUpgrades,
                effectiveDate: new Date(),
            };
        } catch (error) {
            console.error('Error getting upgrade options:', error);
            return null;
        }
    }

    /**
     * Get billing history
     */
    async getBillingHistory(): Promise<BillingHistory[]> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return [];
            }

            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/user/credits/history?transaction_type=subscription`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch billing history');
            }

            const result = await response.json();
            const transactions = result.transactions || [];

            return transactions.map((transaction: any) => ({
                id: transaction.id,
                date: new Date(transaction.created_at),
                amount: Math.abs(transaction.amount) * 0.01, // Convert credits to dollars (rough estimate)
                currency: 'USD',
                planName: transaction.metadata?.plan_id || 'Unknown Plan',
                status: 'paid' as const,
                transactionId: transaction.metadata?.transaction_id || transaction.id,
            }));
        } catch (error) {
            console.error('Error fetching billing history:', error);
            return [];
        }
    }

    /**
     * Open platform-specific subscription management
     */
    async openSubscriptionManagement(): Promise<SubscriptionManagementResult> {
        if (Platform.OS === 'web') {
            return {
                success: false,
                action: 'manage',
                error: 'Subscription management not available on web',
            };
        }

        try {
            if (deepLinkToSubscriptions) {
                deepLinkToSubscriptions();
                return {
                    success: true,
                    action: 'manage',
                    message: 'Opened subscription management',
                };
            } else {
                return {
                    success: false,
                    action: 'manage',
                    error: 'Subscription management not available',
                };
            }
        } catch (error) {
            console.error('Error opening subscription management:', error);
            return {
                success: false,
                action: 'manage',
                error: error instanceof Error ? error.message : 'Failed to open subscription management',
            };
        }
    }

    /**
     * Check if user can upgrade subscription
     */
    async canUpgradeSubscription(): Promise<boolean> {
        const upgradeOptions = await this.getUpgradeOptions();
        return upgradeOptions !== null && upgradeOptions.availableUpgrades.length > 0;
    }

    /**
     * Check if user can downgrade subscription
     */
    async canDowngradeSubscription(): Promise<boolean> {
        const status = await subscriptionStatusService.getSubscriptionStatus();
        if (!status.isActive || !status.planId) {
            return false;
        }

        // Users can downgrade from Pro to Premium or from Yearly to Monthly
        return status.planId.includes('pro') || status.planId.includes('yearly');
    }

    /**
     * Get subscription renewal date
     */
    async getNextRenewalDate(): Promise<Date | null> {
        const status = await subscriptionStatusService.getSubscriptionStatus();
        return status.nextBillingDate || null;
    }

    /**
     * Check if subscription will auto-renew
     */
    async willAutoRenew(): Promise<boolean> {
        const status = await subscriptionStatusService.getSubscriptionStatus();
        return status.autoRenewing || false;
    }

    /**
     * Get subscription cancellation date (if cancelled)
     */
    async getCancellationDate(): Promise<Date | null> {
        const status = await subscriptionStatusService.getSubscriptionStatus();
        if (status.cancelAtPeriodEnd && status.expirationDate) {
            return status.expirationDate;
        }
        return null;
    }

    /**
     * Calculate prorated amount for plan change
     */
    async calculateProration(newPlanId: string): Promise<number> {
        try {
            const status = await subscriptionStatusService.getSubscriptionStatus();
            if (!status.isActive || !status.planId || !status.expirationDate) {
                return 0;
            }

            // Simple proration calculation (in a real app, this would be more complex)
            const currentPlanPrices: { [key: string]: number } = {
                'premium_monthly': 9.99,
                'premium_yearly': 99.99,
                'pro_monthly': 19.99,
                'pro_yearly': 199.99,
            };

            const newPlanPrices: { [key: string]: number } = {
                'premium_monthly': 9.99,
                'premium_yearly': 99.99,
                'pro_monthly': 19.99,
                'pro_yearly': 199.99,
            };

            const currentPrice = currentPlanPrices[status.planId] || 0;
            const newPrice = newPlanPrices[newPlanId] || 0;

            // Calculate remaining days in current period
            const now = new Date();
            const remainingDays = Math.max(0, Math.ceil((status.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            const totalDays = status.planId.includes('yearly') ? 365 : 30;

            // Calculate prorated amounts
            const remainingCurrentValue = (currentPrice * remainingDays) / totalDays;
            const newPlanValue = newPrice;

            return Math.max(0, newPlanValue - remainingCurrentValue);
        } catch (error) {
            console.error('Error calculating proration:', error);
            return 0;
        }
    }

    /**
     * Get subscription limits for current plan
     */
    async getSubscriptionLimits(): Promise<{
        videos: { limit: number; unlimited: boolean };
        images: { limit: number; unlimited: boolean };
        training: { limit: number; unlimited: boolean };
        maxVideoDuration: number;
    } | null> {
        const status = await subscriptionStatusService.getSubscriptionStatus();
        if (!status.isActive || !status.planId) {
            return null;
        }

        const limits: { [key: string]: any } = {
            'premium_monthly': {
                videos: { limit: 100, unlimited: false },
                images: { limit: 1000, unlimited: false },
                training: { limit: 5, unlimited: false },
                maxVideoDuration: 30,
            },
            'premium_yearly': {
                videos: { limit: 150, unlimited: false },
                images: { limit: 1500, unlimited: false },
                training: { limit: 5, unlimited: false },
                maxVideoDuration: 30,
            },
            'pro_monthly': {
                videos: { limit: -1, unlimited: true },
                images: { limit: -1, unlimited: true },
                training: { limit: -1, unlimited: true },
                maxVideoDuration: 60,
            },
            'pro_yearly': {
                videos: { limit: -1, unlimited: true },
                images: { limit: -1, unlimited: true },
                training: { limit: -1, unlimited: true },
                maxVideoDuration: 60,
            },
        };

        return limits[status.planId] || null;
    }
}

// Export singleton instance
export const subscriptionManagementService = SubscriptionManagementService.getInstance();