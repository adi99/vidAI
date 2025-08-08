import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  X, 
  Crown, 
  Star, 
  Zap, 
  Check, 
  Settings,
  Calendar,
  CreditCard,
  Sparkles,
} from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionPlan } from '@/services/subscriptionService';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ visible, onClose }: SubscriptionModalProps) {
  const { credits } = useAuth();
  const {
    plans,
    subscriptionStatus,
    loading,
    purchasing,
    canMakePayments,
    purchaseSubscription,
    restoreSubscriptions,
    openSubscriptionManagement,
    formatPeriod,
    isSubscriptionActive,
    getActiveSubscription,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handlePurchase = async (planId: string) => {
    if (!canMakePayments) {
      Alert.alert(
        'Subscriptions Unavailable',
        'Subscriptions are not available on this device or platform.'
      );
      return;
    }

    setSelectedPlan(planId);
    const result = await purchaseSubscription(planId);
    
    if (!result.success && result.error) {
      Alert.alert('Subscription Failed', result.error);
    }
    
    setSelectedPlan(null);
  };

  const handleRestore = async () => {
    const result = await restoreSubscriptions();
    if (result.success) {
      Alert.alert('Restore Complete', `Restored ${result.restoredCount} subscriptions`);
    } else {
      Alert.alert('Restore Failed', result.error || 'No subscriptions found to restore');
    }
  };

  const handleManageSubscription = async () => {
    await openSubscriptionManagement();
  };

  const getPlanIcon = (planId: string) => {
    if (planId.includes('pro')) {
      return <Crown size={24} color="#F59E0B" />;
    } else if (planId.includes('premium')) {
      return <Star size={24} color="#8B5CF6" />;
    }
    return <Zap size={24} color="#10B981" />;
  };

  const getPlanGradient = (plan: SubscriptionPlan) => {
    if (plan.popular) {
      return ['#F59E0B', '#D97706']; // Gold for popular
    }
    if (plan.id.includes('pro')) {
      return ['#EF4444', '#DC2626']; // Red for pro
    }
    if (plan.id.includes('premium')) {
      return ['#8B5CF6', '#7C3AED']; // Purple for premium
    }
    return ['#10B981', '#059669']; // Green default
  };

  const renderSubscriptionStatus = () => {
    const activeSubscription = getActiveSubscription();
    
    if (isSubscriptionActive() && activeSubscription) {
      return (
        <View style={styles.statusCard}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.statusGradient}
          >
            <View style={styles.statusHeader}>
              <Crown size={24} color="#FFFFFF" />
              <Text style={styles.statusTitle}>Premium Active</Text>
            </View>
            
            <Text style={styles.statusSubtitle}>
              {activeSubscription.name}
            </Text>
            
            <View style={styles.statusDetails}>
              {subscriptionStatus.expirationDate && (
                <View style={styles.statusRow}>
                  <Calendar size={16} color="#FFFFFF" />
                  <Text style={styles.statusText}>
                    {subscriptionStatus.autoRenewing ? 'Renews' : 'Expires'} on{' '}
                    {subscriptionStatus.expirationDate.toLocaleDateString()}
                  </Text>
                </View>
              )}
              
              {subscriptionStatus.creditsRemaining !== undefined && (
                <View style={styles.statusRow}>
                  <Sparkles size={16} color="#FFFFFF" />
                  <Text style={styles.statusText}>
                    {subscriptionStatus.creditsRemaining} credits remaining this period
                  </Text>
                </View>
              )}
            </View>
            
            {subscriptionStatus.inGracePeriod && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  Your subscription is in grace period. Please update your payment method.
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.manageButton}
              onPress={handleManageSubscription}
            >
              <Settings size={16} color="#10B981" />
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={styles.statusCard}>
        <View style={styles.inactiveStatus}>
          <Text style={styles.inactiveTitle}>No Active Subscription</Text>
          <Text style={styles.inactiveSubtitle}>
            Subscribe to unlock premium features and get monthly credits
          </Text>
        </View>
      </View>
    );
  };

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isSelected = selectedPlan === plan.id;
    const isPurchasing = purchasing === plan.id;
    const isCurrentPlan = subscriptionStatus.planId === plan.id;
    
    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          plan.popular && styles.popularPlan,
          isSelected && styles.selectedPlan,
        ]}
        onPress={() => handlePurchase(plan.id)}
        disabled={!canMakePayments || isPurchasing || isCurrentPlan}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
        )}
        
        <LinearGradient
          colors={getPlanGradient(plan) as [string, string, ...string[]]}
          style={styles.planGradient}
        >
          <View style={styles.planHeader}>
            {getPlanIcon(plan.id)}
            <Text style={styles.planName}>{plan.name}</Text>
            {plan.savings && (
              <Text style={styles.planSavings}>{plan.savings}</Text>
            )}
          </View>
          
          <View style={styles.planPricing}>
            <Text style={styles.planPrice}>{plan.price}</Text>
            <Text style={styles.planPeriod}>per {formatPeriod(plan.period)}</Text>
          </View>
          
          <View style={styles.planCredits}>
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={styles.planCreditsText}>
              {plan.credits.toLocaleString()} credits per {formatPeriod(plan.period)}
            </Text>
          </View>
          
          <View style={styles.planFooter}>
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isCurrentPlan ? (
              <Text style={styles.currentPlanText}>Current Plan</Text>
            ) : (
              <Text style={styles.subscribeText}>
                {canMakePayments ? 'Subscribe' : 'Unavailable'}
              </Text>
            )}
          </View>
        </LinearGradient>
        
        <View style={styles.planFeatures}>
          <Text style={styles.featuresTitle}>Features included:</Text>
          {plan.features.slice(0, 4).map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Check size={14} color="#10B981" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
          {plan.features.length > 4 && (
            <Text style={styles.moreFeatures}>
              +{plan.features.length - 4} more features
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Crown size={24} color="#FFFFFF" />
              <Text style={styles.headerTitle}>Premium Plans</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.currentBalance}>
            <Text style={styles.balanceLabel}>Current Credits</Text>
            <Text style={styles.balanceAmount}>{credits.toLocaleString()}</Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Subscription Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription Status</Text>
            {renderSubscriptionStatus()}
          </View>

          {/* Subscription Plans */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.loadingText}>Loading plans...</Text>
              </View>
            ) : plans.length > 0 ? (
              <View style={styles.plansContainer}>
                {plans.map(renderPlanCard)}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No plans available</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={loading || !canMakePayments}
            >
              <CreditCard size={16} color="#94A3B8" />
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            </TouchableOpacity>
          </View>

          {/* Platform Notice */}
          {Platform.OS === 'web' && (
            <View style={styles.webNotice}>
              <Text style={styles.webNoticeText}>
                Subscriptions are only available on mobile devices. 
                Please use the mobile app to subscribe to premium plans.
              </Text>
            </View>
          )}

          {/* Terms */}
          <View style={styles.terms}>
            <Text style={styles.termsText}>
              • Subscriptions auto-renew unless cancelled{'\n'}
              • Credits are added monthly/yearly based on your plan{'\n'}
              • Unused credits roll over to the next billing period{'\n'}
              • Cancel anytime through your device's subscription settings{'\n'}
              • Refunds are subject to app store policies
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  currentBalance: {
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statusCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 16,
  },
  statusDetails: {
    gap: 8,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  warningBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#FEF2F2',
    textAlign: 'center',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  inactiveStatus: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
  },
  inactiveTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inactiveSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  popularPlan: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  selectedPlan: {
    transform: [{ scale: 0.98 }],
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planGradient: {
    padding: 20,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  planSavings: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  planPricing: {
    marginBottom: 12,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planPeriod: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  planCredits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  planCreditsText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  planFooter: {
    alignItems: 'center',
  },
  subscribeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  currentPlanText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.8,
  },
  planFeatures: {
    padding: 16,
    backgroundColor: '#1E293B',
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  moreFeatures: {
    fontSize: 12,
    color: '#8B5CF6',
    fontStyle: 'italic',
    marginTop: 4,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  webNotice: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  webNoticeText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  terms: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  termsText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
});