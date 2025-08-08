import React, { useState, useEffect } from 'react';
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
  Calendar, 
  CreditCard, 
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { subscriptionStatusService } from '@/services/subscriptionStatusService';
import { subscriptionManagementService, BillingHistory } from '@/services/subscriptionManagementService';

interface SubscriptionManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SubscriptionManagementModal({ visible, onClose }: SubscriptionManagementModalProps) {
  const {
    subscriptionStatus,
    refreshSubscriptionStatus,
    openSubscriptionManagement,
    isSubscriptionActive,
    getActiveSubscription,
  } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [upgradeOptions, setUpgradeOptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'upgrade'>('overview');

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBillingHistory(),
        loadUpgradeOptions(),
        refreshSubscriptionStatus(),
      ]);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBillingHistory = async () => {
    try {
      const history = await subscriptionManagementService.getBillingHistory();
      setBillingHistory(history);
    } catch (error) {
      console.error('Error loading billing history:', error);
    }
  };

  const loadUpgradeOptions = async () => {
    try {
      const options = await subscriptionManagementService.getUpgradeOptions();
      setUpgradeOptions(options?.availableUpgrades || []);
    } catch (error) {
      console.error('Error loading upgrade options:', error);
    }
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await subscriptionManagementService.cancelSubscription();
            setLoading(false);
            
            if (result.success) {
              Alert.alert('Subscription Cancelled', result.message);
              await refreshSubscriptionStatus();
            } else {
              Alert.alert('Error', result.error || 'Failed to cancel subscription');
            }
          },
        },
      ]
    );
  };

  const handleReactivateSubscription = async () => {
    Alert.alert(
      'Reactivate Subscription',
      'Would you like to reactivate your subscription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setLoading(true);
            const result = await subscriptionManagementService.reactivateSubscription();
            setLoading(false);
            
            if (result.success) {
              Alert.alert('Subscription Reactivated', result.message);
              await refreshSubscriptionStatus();
            } else {
              Alert.alert('Error', result.error || 'Failed to reactivate subscription');
            }
          },
        },
      ]
    );
  };

  const handleOpenStoreManagement = async () => {
    const result = await subscriptionManagementService.openSubscriptionManagement();
    if (!result.success) {
      Alert.alert('Error', result.error || 'Could not open subscription management');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'cancelled':
        return '#F59E0B';
      case 'expired':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={20} color="#10B981" />;
      case 'cancelled':
        return <AlertTriangle size={20} color="#F59E0B" />;
      case 'expired':
        return <XCircle size={20} color="#EF4444" />;
      default:
        return <XCircle size={20} color="#6B7280" />;
    }
  };

  const renderOverviewTab = () => {
    const activeSubscription = getActiveSubscription();
    
    return (
      <View style={styles.tabContent}>
        {/* Subscription Status Card */}
        <View style={styles.statusCard}>
          <LinearGradient
            colors={subscriptionStatus.isActive ? ['#10B981', '#059669'] : ['#6B7280', '#4B5563']}
            style={styles.statusGradient}
          >
            <View style={styles.statusHeader}>
              {getStatusIcon(subscriptionStatus.status || 'inactive')}
              <Text style={styles.statusTitle}>
                {subscriptionStatus.isActive ? 'Active Subscription' : 'No Active Subscription'}
              </Text>
            </View>
            
            {activeSubscription && (
              <>
                <Text style={styles.statusSubtitle}>{activeSubscription.name}</Text>
                
                <View style={styles.statusDetails}>
                  {subscriptionStatus.expirationDate && (
                    <View style={styles.statusRow}>
                      <Calendar size={16} color="#FFFFFF" />
                      <Text style={styles.statusText}>
                        {subscriptionStatus.autoRenewing ? 'Renews' : 'Expires'} on{' '}
                        {formatDate(subscriptionStatus.expirationDate)}
                      </Text>
                    </View>
                  )}
                  
                  {subscriptionStatus.creditsRemaining !== undefined && (
                    <View style={styles.statusRow}>
                      <Crown size={16} color="#FFFFFF" />
                      <Text style={styles.statusText}>
                        {subscriptionStatus.creditsRemaining.toLocaleString()} credits remaining
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {subscriptionStatus.isActive ? (
            <>
              {subscriptionStatus.cancelAtPeriodEnd ? (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleReactivateSubscription}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.actionButtonGradient}
                  >
                    <RefreshCw size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Reactivate Subscription</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleCancelSubscription}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.actionButtonGradient}
                  >
                    <XCircle size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Cancel Subscription</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleOpenStoreManagement}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.actionButtonGradient}
                >
                  <ExternalLink size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Manage in {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.inactiveMessage}>
              <Text style={styles.inactiveText}>
                You don't have an active subscription. Subscribe to unlock premium features!
              </Text>
            </View>
          )}
        </View>

        {/* Grace Period Warning */}
        {subscriptionStatus.inGracePeriod && (
          <View style={styles.warningCard}>
            <AlertTriangle size={20} color="#F59E0B" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Payment Issue</Text>
              <Text style={styles.warningText}>
                Your subscription is in grace period. Please update your payment method to continue service.
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderBillingTab = () => {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Billing History</Text>
        
        {billingHistory.length > 0 ? (
          <View style={styles.billingList}>
            {billingHistory.map((item) => (
              <View key={item.id} style={styles.billingItem}>
                <View style={styles.billingHeader}>
                  <Text style={styles.billingDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.billingAmount}>{formatCurrency(item.amount)}</Text>
                </View>
                <Text style={styles.billingDescription}>{item.planName}</Text>
                <View style={styles.billingFooter}>
                  <View style={[styles.billingStatus, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.billingStatusText}>{item.status.toUpperCase()}</Text>
                  </View>
                  {item.transactionId && (
                    <Text style={styles.billingTransaction}>ID: {item.transactionId.slice(-8)}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <CreditCard size={48} color="#6B7280" />
            <Text style={styles.emptyText}>No billing history available</Text>
          </View>
        )}
      </View>
    );
  };

  const renderUpgradeTab = () => {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Upgrade Options</Text>
        
        {upgradeOptions.length > 0 ? (
          <View style={styles.upgradeList}>
            {upgradeOptions.map((option) => (
              <View key={option.planId} style={styles.upgradeCard}>
                <View style={styles.upgradeHeader}>
                  <TrendingUp size={20} color="#8B5CF6" />
                  <Text style={styles.upgradeName}>{option.planName}</Text>
                  <Text style={styles.upgradePrice}>{formatCurrency(option.price)}</Text>
                </View>
                
                {option.savings && (
                  <Text style={styles.upgradeSavings}>{option.savings}</Text>
                )}
                
                <View style={styles.upgradeFeatures}>
                  {option.features.slice(0, 3).map((feature: string, index: number) => (
                    <Text key={index} style={styles.upgradeFeature}>• {feature}</Text>
                  ))}
                  {option.features.length > 3 && (
                    <Text style={styles.upgradeMoreFeatures}>
                      +{option.features.length - 3} more features
                    </Text>
                  )}
                </View>
                
                <TouchableOpacity style={styles.upgradeButton} disabled>
                  <Text style={styles.upgradeButtonText}>
                    Upgrade via {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <TrendingUp size={48} color="#6B7280" />
            <Text style={styles.emptyText}>No upgrade options available</Text>
          </View>
        )}
      </View>
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
              <Settings size={24} color="#FFFFFF" />
              <Text style={styles.headerTitle}>Subscription Management</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'billing' && styles.activeTab]}
            onPress={() => setActiveTab('billing')}
          >
            <Text style={[styles.tabText, activeTab === 'billing' && styles.activeTabText]}>
              Billing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upgrade' && styles.activeTab]}
            onPress={() => setActiveTab('upgrade')}
          >
            <Text style={[styles.tabText, activeTab === 'upgrade' && styles.activeTabText]}>
              Upgrade
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'billing' && renderBillingTab()}
              {activeTab === 'upgrade' && renderUpgradeTab()}
            </>
          )}
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
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabContent: {
    paddingBottom: 40,
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
  statusCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
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
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inactiveMessage: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  inactiveText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#FEF3C7',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  billingList: {
    gap: 12,
  },
  billingItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  billingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billingDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  billingAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  billingDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  billingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billingStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  billingStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  billingTransaction: {
    fontSize: 10,
    color: '#6B7280',
  },
  upgradeList: {
    gap: 16,
  },
  upgradeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  upgradeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  upgradePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  upgradeSavings: {
    fontSize: 12,
    color: '#10B981',
    marginBottom: 12,
  },
  upgradeFeatures: {
    marginBottom: 16,
  },
  upgradeFeature: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  upgradeMoreFeatures: {
    fontSize: 12,
    color: '#8B5CF6',
    fontStyle: 'italic',
  },
  upgradeButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});