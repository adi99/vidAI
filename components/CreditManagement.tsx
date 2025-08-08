import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Zap, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Gift, 
  RotateCcw,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { CreditService } from '@/services/creditService';
import CreditPurchaseModal from './CreditPurchaseModal';

interface CreditTransaction {
  id: string;
  transaction_type: 'purchase' | 'deduction' | 'subscription' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface CreditManagementProps {
  showPurchaseButton?: boolean;
  showHistory?: boolean;
  compact?: boolean;
}

export default function CreditManagement({
  showPurchaseButton = true,
  showHistory = true,
  compact = false,
}: CreditManagementProps) {
  const { user, credits } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    if (showHistory && user) {
      loadTransactionHistory();
    }
  }, [showHistory, user]);

  const loadTransactionHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const history = await CreditService.getCreditHistory(user.id, 20, 0);
      setTransactions(history);
    } catch (error) {
      console.error('Error loading transaction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactionHistory();
    setRefreshing(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ShoppingCart size={16} color="#10B981" />;
      case 'deduction':
        return <Minus size={16} color="#EF4444" />;
      case 'subscription':
        return <Calendar size={16} color="#8B5CF6" />;
      case 'refund':
        return <RotateCcw size={16} color="#F59E0B" />;
      case 'bonus':
        return <Gift size={16} color="#EC4899" />;
      default:
        return <Zap size={16} color="#6B7280" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'subscription':
      case 'refund':
      case 'bonus':
        return '#10B981';
      case 'deduction':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const formatTransactionAmount = (type: string, amount: number) => {
    const isPositive = ['purchase', 'subscription', 'refund', 'bonus'].includes(type);
    return `${isPositive ? '+' : '-'}${Math.abs(amount).toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const TransactionItem = ({ transaction }: { transaction: CreditTransaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        {getTransactionIcon(transaction.transaction_type)}
      </View>
      
      <View style={styles.transactionContent}>
        <Text style={styles.transactionDescription}>
          {transaction.description}
        </Text>
        <Text style={styles.transactionDate}>
          {formatDate(transaction.created_at)}
        </Text>
      </View>
      
      <View style={styles.transactionAmount}>
        <Text style={[
          styles.transactionAmountText,
          { color: getTransactionColor(transaction.transaction_type) }
        ]}>
          {formatTransactionAmount(transaction.transaction_type, transaction.amount)}
        </Text>
        <Text style={styles.transactionBalance}>
          Balance: {transaction.balance_after.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactBalance}>
          <Zap size={16} color="#FCD34D" />
          <Text style={styles.compactCredits}>{credits.toLocaleString()}</Text>
          <Text style={styles.compactLabel}>credits</Text>
        </View>
        
        {showPurchaseButton && (
          <TouchableOpacity
            style={styles.compactPurchaseButton}
            onPress={() => setShowPurchaseModal(true)}
          >
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        
        <CreditPurchaseModal
          visible={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.balanceSection}>
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.balanceCard}
        >
          <View style={styles.balanceContent}>
            <View style={styles.balanceIcon}>
              <Zap size={24} color="#FCD34D" />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceAmount}>{credits.toLocaleString()}</Text>
              <Text style={styles.balanceLabel}>Available Credits</Text>
            </View>
            {credits <= 50 && (
              <View style={styles.lowCreditsIndicator}>
                <TrendingDown size={16} color="#EF4444" />
              </View>
            )}
          </View>
          
          {showPurchaseButton && (
            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={() => setShowPurchaseModal(true)}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
                style={styles.purchaseButtonGradient}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.purchaseButtonText}>Add Credits</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>

      {showHistory && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Transaction History</Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <RotateCcw 
                size={16} 
                color="#8B5CF6" 
                style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.transactionsList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#8B5CF6"
              />
            }
          >
            {loading && transactions.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.loadingText}>Loading transactions...</Text>
              </View>
            ) : transactions.length > 0 ? (
              transactions.map((transaction) => (
                <TransactionItem key={transaction.id} transaction={transaction} />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Zap size={32} color="#6B7280" />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyText}>
                  Your credit transactions will appear here
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      <CreditPurchaseModal
        visible={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onPurchaseComplete={() => {
          loadTransactionHistory();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  compactBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactCredits: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  compactPurchaseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceSection: {
    marginBottom: 24,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
  },
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#E5E7EB',
    opacity: 0.9,
  },
  lowCreditsIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  purchaseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  purchaseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historySection: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionsList: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionContent: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  transactionBalance: {
    fontSize: 11,
    color: '#6B7280',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});