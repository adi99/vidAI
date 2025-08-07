import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Zap, Plus, Minus, RotateCcw, CreditCard, Crown } from 'lucide-react-native';
import { CreditService, CreditTransaction } from '@/services/creditService';
import { useAuth } from '@/contexts/AuthContext';

interface CreditHistoryProps {
  style?: any;
}

export default function CreditHistory({ style }: CreditHistoryProps) {
  const { user, formatCredits } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = async () => {
    if (!user?.id) return;
    
    try {
      const history = await CreditService.getCreditHistory(user.id, 50);
      setTransactions(history);
    } catch (error) {
      console.error('Error loading credit history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  useEffect(() => {
    loadTransactions();
  }, [user?.id]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <CreditCard size={16} color="#10B981" />;
      case 'subscription':
        return <Crown size={16} color="#F59E0B" />;
      case 'deduction':
        return <Minus size={16} color="#EF4444" />;
      case 'refund':
        return <RotateCcw size={16} color="#3B82F6" />;
      default:
        return <Zap size={16} color="#8B5CF6" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'subscription':
      case 'refund':
        return '#10B981';
      case 'deduction':
        return '#EF4444';
      default:
        return '#8B5CF6';
    }
  };

  const formatTransactionAmount = (amount: number, type: string) => {
    const prefix = amount > 0 ? '+' : '';
    return `${prefix}${formatCredits(Math.abs(amount))}`;
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

  const renderTransaction = ({ item }: { item: CreditTransaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        {getTransactionIcon(item.transaction_type)}
      </View>
      
      <View style={styles.transactionContent}>
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionDate}>{formatDate(item.created_at)}</Text>
        {item.metadata && item.metadata.type && (
          <Text style={styles.transactionMeta}>
            {item.metadata.type.replace('_', ' ')}
          </Text>
        )}
      </View>
      
      <View style={styles.transactionAmount}>
        <Text style={[
          styles.amountText,
          { color: getTransactionColor(item.transaction_type) }
        ]}>
          {formatTransactionAmount(item.amount, item.transaction_type)}
        </Text>
        <Text style={styles.balanceText}>
          Balance: {formatCredits(item.balance_after)}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <Text style={styles.loadingText}>Loading credit history...</Text>
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, style]}>
        <Zap size={48} color="#6B7280" />
        <Text style={styles.emptyTitle}>No Credit History</Text>
        <Text style={styles.emptySubtitle}>
          Your credit transactions will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Credit History</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <RotateCcw size={16} color="#8B5CF6" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
          />
        }
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#475569',
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
  transactionMeta: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  balanceText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});