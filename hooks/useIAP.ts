import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Conditionally import expo-iap only on native platforms
let useExpoIAP: any = null;
let Purchase: any = null;
let presentCodeRedemptionSheet: any = null;
let openRedeemOfferCodeAndroid: any = null;
let purchaseUpdatedListener: any = null;

if (Platform.OS !== 'web') {
  try {
    const expoIAP = require('expo-iap');
    useExpoIAP = expoIAP.useIAP;
    Purchase = expoIAP.Purchase;
    presentCodeRedemptionSheet = expoIAP.presentCodeRedemptionSheet;
    openRedeemOfferCodeAndroid = expoIAP.openRedeemOfferCodeAndroid;
    purchaseUpdatedListener = expoIAP.purchaseUpdatedListener;
  } catch (error) {
    console.warn('expo-iap not available:', error);
  }
}

export interface CreditPackage {
  id: string;
  credits: number;
  price: string;
  priceUsd: number;
  title: string;
  description: string;
  popular?: boolean;
  bonus?: number;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  credits?: number;
  error?: string;
}

export interface UseIAPReturn {
  // State
  packages: CreditPackage[];
  loading: boolean;
  purchasing: string | null;
  canMakePayments: boolean;
  initialized: boolean;

  // Actions
  purchaseCredits: (packageId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<{ success: boolean; restoredCount: number; error?: string }>;
  refreshPackages: () => Promise<void>;
  redeemOfferCode: () => Promise<{ success: boolean; error?: string }>;

  // Helpers
  getPackageById: (packageId: string) => CreditPackage | undefined;
  formatCredits: (amount: number) => string;
}

// Credit package definitions
const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'credits_100',
    credits: 100,
    price: '$4.99',
    priceUsd: 4.99,
    title: '100 Credits',
    description: 'Perfect for trying out features',
  },
  {
    id: 'credits_500',
    credits: 500,
    price: '$19.99',
    priceUsd: 19.99,
    title: '500 Credits',
    description: 'Great for regular creators',
    bonus: 50,
  },
  {
    id: 'credits_1000',
    credits: 1000,
    price: '$34.99',
    priceUsd: 34.99,
    title: '1,000 Credits',
    description: 'Best value for power users',
    popular: true,
    bonus: 200,
  },
  {
    id: 'credits_2500',
    credits: 2500,
    price: '$79.99',
    priceUsd: 79.99,
    title: '2,500 Credits',
    description: 'Ultimate package for professionals',
    bonus: 750,
  },
];

export function useIAP(): UseIAPReturn {
  const { refreshUserData } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>(CREDIT_PACKAGES);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Web fallback - IAP not supported on web
  const webFallback = {
    connected: false,
    products: [],
    currentPurchase: null,
    currentPurchaseError: null,
    requestProducts: async () => { },
    requestPurchase: async () => { },
    getAvailablePurchases: async () => { },
    availablePurchases: [],
    finishTransaction: async () => { },
  };

  // Use the expo-iap hook only on native platforms
  const iapHook = Platform.OS !== 'web' && useExpoIAP ? useExpoIAP({
    onPurchaseSuccess: async (purchase: any) => {
      console.log('Purchase successful:', purchase);
      await handlePurchaseSuccess(purchase);
    },
    onPurchaseError: (error: any) => {
      console.error('Purchase failed:', error);
      setPurchasing(null);
    },
  }) : webFallback;

  const {
    connected,
    products,
    currentPurchase,
    currentPurchaseError,
    requestProducts,
    requestPurchase,
    getAvailablePurchases,
    availablePurchases,
    finishTransaction,
  } = iapHook;

  // Initialize and load products when connected
  useEffect(() => {
    if (Platform.OS === 'web') {
      // On web, just set loading to false since IAP is not supported
      setLoading(false);
    } else if (connected) {
      loadProducts();
    }
  }, [connected]);

  // Set up purchase update listener for offer code redemptions
  useEffect(() => {
    if (Platform.OS === 'web' || !purchaseUpdatedListener) {
      return;
    }

    const subscription = purchaseUpdatedListener((purchase: any) => {
      console.log('Purchase updated after redemption:', purchase);
      // Handle the new purchase from offer code redemption
      handlePurchaseSuccess(purchase);
    });

    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, []);

  // Handle purchase updates
  useEffect(() => {
    if (currentPurchase) {
      handlePurchaseSuccess(currentPurchase);
    }
  }, [currentPurchase]);

  // Handle purchase errors
  useEffect(() => {
    if (currentPurchaseError) {
      console.error('Purchase error:', currentPurchaseError);
      setPurchasing(null);
    }
  }, [currentPurchaseError]);

  const loadProducts = async () => {
    // Skip product loading on web
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const productIds = CREDIT_PACKAGES.map(pkg => pkg.id);
      await requestProducts({
        skus: productIds,
        type: 'inapp'
      });

      // Update packages with real pricing
      const updatedPackages = CREDIT_PACKAGES.map(pkg => {
        const product = products.find((p: any) => p.id === pkg.id);
        return {
          ...pkg,
          price: product?.displayPrice || pkg.price,
          priceUsd: product?.price || pkg.priceUsd,
        };
      });

      setPackages(updatedPackages);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSuccess = async (purchase: any) => {
    try {
      // Verify purchase with backend
      const verificationResult = await verifyPurchaseWithBackend(purchase);

      if (verificationResult.success) {
        // Finish the transaction
        await finishTransaction({
          purchase,
          isConsumable: true // Credits are consumable
        });

        // Refresh user data to update credit balance
        await refreshUserData();

        Alert.alert(
          'Purchase Successful!',
          `You've received ${verificationResult.credits} credits!`
        );
      } else {
        Alert.alert('Purchase Failed', verificationResult.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Error processing purchase:', error);
      Alert.alert('Error', 'Failed to process purchase');
    } finally {
      setPurchasing(null);
    }
  };

  const verifyPurchaseWithBackend = async (purchase: any): Promise<{
    success: boolean;
    credits?: number;
    error?: string;
  }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          success: false,
          error: 'User not authenticated',
        };
      }

      // Prepare platform-specific receipt data
      let receiptData: string;
      let packageId: string;

      if (Platform.OS === 'ios') {
        receiptData = purchase.transactionReceipt;
        packageId = purchase.productId || purchase.id;
      } else if (Platform.OS === 'android') {
        // For Android, we need to include additional validation parameters
        const androidPurchase = purchase as any;
        receiptData = JSON.stringify({
          purchaseToken: androidPurchase.purchaseTokenAndroid,
          packageName: androidPurchase.packageNameAndroid || 'com.yourapp.package',
          originalJson: androidPurchase.originalJson,
          signature: androidPurchase.signature,
        });
        packageId = androidPurchase.ids?.[0] || androidPurchase.productId;
      } else {
        return {
          success: false,
          error: 'Platform not supported',
        };
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/user/credits/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transaction_id: purchase.transactionId,
          package_id: packageId,
          platform: Platform.OS,
          receipt_data: receiptData,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        return {
          success: true,
          credits: result.purchase.creditsPurchased,
        };
      } else {
        return {
          success: false,
          error: result.message || 'Verification failed',
        };
      }
    } catch (error) {
      console.error('Backend verification failed:', error);
      return {
        success: false,
        error: 'Network error during verification',
      };
    }
  };

  const purchaseCredits = useCallback(async (packageId: string): Promise<PurchaseResult> => {
    // Web platform doesn't support IAP
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available on Web',
        'In-app purchases are only available on mobile devices. Please use the mobile app to purchase credits.'
      );
      return {
        success: false,
        error: 'In-app purchases not supported on web',
      };
    }

    if (!connected) {
      return {
        success: false,
        error: 'Store is not connected',
      };
    }

    try {
      setPurchasing(packageId);

      // Request purchase with platform-specific parameters
      await requestPurchase({
        request: {
          ios: {
            sku: packageId,
            andDangerouslyFinishTransactionAutomaticallyIOS: false,
          },
          android: {
            skus: [packageId],
          },
        },
        type: 'inapp',
      });

      // The actual result will be handled by the onPurchaseSuccess callback
      return {
        success: true,
        transactionId: 'pending', // Will be updated in callback
      };
    } catch (error) {
      console.error('Purchase request failed:', error);
      setPurchasing(null);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed',
      };
    }
  }, [connected, requestPurchase]);

  const restorePurchases = useCallback(async () => {
    // Web platform doesn't support IAP
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available on Web',
        'Purchase restoration is only available on mobile devices.'
      );
      return {
        success: false,
        restoredCount: 0,
        error: 'Purchase restoration not supported on web',
      };
    }

    if (!connected) {
      return {
        success: false,
        restoredCount: 0,
        error: 'Store is not connected',
      };
    }

    try {
      setLoading(true);
      const productIds = CREDIT_PACKAGES.map(pkg => pkg.id);
      await getAvailablePurchases(productIds);

      if (availablePurchases && availablePurchases.length > 0) {
        let restoredCount = 0;

        for (const purchase of availablePurchases) {
          const verificationResult = await verifyPurchaseWithBackend(purchase);
          if (verificationResult.success) {
            restoredCount++;
          }
        }

        if (restoredCount > 0) {
          await refreshUserData();
        }

        return {
          success: true,
          restoredCount,
        };
      } else {
        return {
          success: false,
          restoredCount: 0,
          error: 'No purchases found to restore',
        };
      }
    } catch (error) {
      console.error('Restore error:', error);
      return {
        success: false,
        restoredCount: 0,
        error: error instanceof Error ? error.message : 'Restore failed',
      };
    } finally {
      setLoading(false);
    }
  }, [connected, getAvailablePurchases, availablePurchases, refreshUserData]);

  const refreshPackages = useCallback(async () => {
    if (connected) {
      await loadProducts();
    }
  }, [connected, products]);

  const getPackageById = useCallback((packageId: string): CreditPackage | undefined => {
    return packages.find(pkg => pkg.id === packageId);
  }, [packages]);

  const formatCredits = useCallback((amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  }, []);

  const redeemOfferCode = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    // Web platform doesn't support offer code redemption
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Available on Web',
        'Offer code redemption is only available on mobile devices. Please use the mobile app to redeem codes.'
      );
      return {
        success: false,
        error: 'Offer code redemption not supported on web',
      };
    }

    try {
      if (Platform.OS === 'ios') {
        // Present native iOS redemption sheet
        if (presentCodeRedemptionSheet) {
          const result = await presentCodeRedemptionSheet();
          if (result) {
            Alert.alert(
              'Redemption Sheet Opened',
              'Please enter your offer code in the Apple redemption sheet. Any purchases will be processed automatically.'
            );
            return { success: true };
          } else {
            return {
              success: false,
              error: 'Failed to open redemption sheet',
            };
          }
        } else {
          return {
            success: false,
            error: 'Redemption not available',
          };
        }
      } else if (Platform.OS === 'android') {
        // Open Play Store for Android
        if (openRedeemOfferCodeAndroid) {
          await openRedeemOfferCodeAndroid();
          Alert.alert(
            'Redirected to Play Store',
            'You have been redirected to the Google Play Store to redeem your offer code.'
          );
          return { success: true };
        } else {
          return {
            success: false,
            error: 'Redemption not available',
          };
        }
      } else {
        return {
          success: false,
          error: 'Platform not supported',
        };
      }
    } catch (error: any) {
      console.error('Offer code redemption error:', error);
      return {
        success: false,
        error: error.message || 'Failed to redeem offer code',
      };
    }
  }, []);

  return {
    // State
    packages,
    loading,
    purchasing,
    canMakePayments: connected,
    initialized: connected,

    // Actions
    purchaseCredits,
    restorePurchases,
    refreshPackages,
    redeemOfferCode,

    // Helpers
    getPackageById,
    formatCredits,
  };
}

export default useIAP;