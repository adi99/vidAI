import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';
import { 
  WifiOff, 
  Wifi, 
  Signal, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react-native';
import { useConnectivity } from '@/hooks/useConnectivity';
import AnimatedCard from './AnimatedCard';
import * as Haptics from 'expo-haptics';

interface OfflineIndicatorProps {
  style?: any;
  compact?: boolean;
  showQueueInfo?: boolean;
  onRetry?: () => void;
}

export default function OfflineIndicator({
  style,
  compact = false,
  showQueueInfo = true,
  onRetry,
}: OfflineIndicatorProps) {
  const {
    isConnected,
    isInternetReachable,
    connectionType,
    networkQuality,
    queueSize,
    hasQueuedOperations,
    testConnectivity,
  } = useConnectivity();

  const getStatusIcon = () => {
    if (!isConnected) {
      return <WifiOff size={compact ? 16 : 20} color="#EF4444" />;
    }
    
    if (!isInternetReachable) {
      return <AlertTriangle size={compact ? 16 : 20} color="#F59E0B" />;
    }

    switch (networkQuality) {
      case 'excellent':
        return <Wifi size={compact ? 16 : 20} color="#10B981" />;
      case 'good':
        return <Signal size={compact ? 16 : 20} color="#10B981" />;
      case 'fair':
        return <Signal size={compact ? 16 : 20} color="#F59E0B" />;
      case 'poor':
        return <Signal size={compact ? 16 : 20} color="#EF4444" />;
      default:
        return <Wifi size={compact ? 16 : 20} color="#6B7280" />;
    }
  };

  const getStatusText = () => {
    if (!isConnected) {
      return 'Offline';
    }
    
    if (!isInternetReachable) {
      return 'No Internet';
    }

    switch (networkQuality) {
      case 'excellent':
        return 'Excellent Connection';
      case 'good':
        return 'Good Connection';
      case 'fair':
        return 'Fair Connection';
      case 'poor':
        return 'Poor Connection';
      default:
        return 'Connected';
    }
  };

  const getStatusColor = (): [string, string] => {
    if (!isConnected || !isInternetReachable) {
      return ['#EF4444', '#DC2626'];
    }

    switch (networkQuality) {
      case 'excellent':
      case 'good':
        return ['#10B981', '#059669'];
      case 'fair':
        return ['#F59E0B', '#D97706'];
      case 'poor':
        return ['#EF4444', '#DC2626'];
      default:
        return ['#6B7280', '#4B5563'];
    }
  };

  const handleRetry = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (onRetry) {
      onRetry();
    } else {
      // Test connectivity
      await testConnectivity();
    }
  };

  // Don't show indicator if online and no queued operations
  if (isConnected && isInternetReachable && !hasQueuedOperations && networkQuality !== 'poor') {
    return null;
  }

  if (compact) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: -10 }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 300,
        }}
        style={[styles.compactContainer, style]}
      >
        <LinearGradient
          colors={getStatusColor()}
          style={styles.compactGradient}
        >
          <View style={styles.compactContent}>
            {getStatusIcon()}
            <Text style={styles.compactText}>{getStatusText()}</Text>
            {hasQueuedOperations && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{queueSize}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </MotiView>
    );
  }

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9, translateY: -20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={{ opacity: 0, scale: 0.9, translateY: -20 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={[styles.container, style]}
    >
      <AnimatedCard
        style={styles.card}
        padding={0}
        margin={0}
      >
        <LinearGradient
          colors={getStatusColor()}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              {getStatusIcon()}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.statusText}>{getStatusText()}</Text>
              <Text style={styles.connectionType}>
                {connectionType.toUpperCase()} • {networkQuality.toUpperCase()}
              </Text>
            </View>
            {(!isConnected || !isInternetReachable) && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
              >
                <RefreshCw size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {showQueueInfo && hasQueuedOperations && (
            <MotiView
              from={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
              }}
              style={styles.queueInfo}
            >
              <View style={styles.queueHeader}>
                <Clock size={14} color="#FFFFFF" />
                <Text style={styles.queueText}>
                  {queueSize} operation{queueSize !== 1 ? 's' : ''} queued
                </Text>
              </View>
              <Text style={styles.queueSubtext}>
                Will sync when connection is restored
              </Text>
            </MotiView>
          )}

          {isConnected && isInternetReachable && networkQuality === 'poor' && (
            <View style={styles.warningInfo}>
              <AlertTriangle size={14} color="#FFFFFF" />
              <Text style={styles.warningText}>
                Slow connection may affect performance
              </Text>
            </View>
          )}
        </LinearGradient>
      </AnimatedCard>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  connectionType: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  retryButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  queueInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  queueText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  queueSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  warningInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  warningText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 6,
    opacity: 0.9,
  },
  // Compact styles
  compactContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  compactGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 6,
    flex: 1,
  },
  queueBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// Network quality indicator component
export const NetworkQualityIndicator = ({ style }: { style?: any }) => {
  const { networkQuality, signalStrength } = useConnectivity();

  const getQualityColor = () => {
    switch (networkQuality) {
      case 'excellent': return '#10B981';
      case 'good': return '#10B981';
      case 'fair': return '#F59E0B';
      case 'poor': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getBars = () => {
    const strength = signalStrength || 0;
    const bars = Math.ceil((strength / 100) * 4);
    return Math.max(1, Math.min(4, bars));
  };

  return (
    <View style={[qualityStyles.qualityIndicator, style]}>
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={[
            qualityStyles.qualityBar,
            {
              height: bar * 3 + 6,
              backgroundColor: bar <= getBars() ? getQualityColor() : '#374151',
            },
          ]}
        />
      ))}
    </View>
  );
};

const qualityStyles = StyleSheet.create({
  qualityIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  qualityBar: {
    width: 3,
    borderRadius: 1,
  },
});