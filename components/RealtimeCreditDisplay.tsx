import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Coins, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCreditUpdates, useConnectionStatus } from '@/hooks/useRealtime';

interface RealtimeCreditDisplayProps {
  size?: 'small' | 'medium' | 'large';
  showAnimation?: boolean;
  showLastUpdate?: boolean;
  onPress?: () => void;
  style?: any;
}

export function RealtimeCreditDisplay({
  size = 'medium',
  showAnimation = true,
  showLastUpdate = false,
  onPress,
  style,
}: RealtimeCreditDisplayProps) {
  const { profile } = useAuth();
  const { latestUpdate, balance } = useCreditUpdates();
  const { status, reconnect } = useConnectionStatus();
  
  const [displayBalance, setDisplayBalance] = useState<number>(profile?.credits || 0);
  const [animatedValue] = useState(new Animated.Value(1));
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Update display balance when user credits change or real-time update arrives
  useEffect(() => {
    const newBalance = balance !== null ? balance : (profile?.credits || 0);
    
    if (newBalance !== displayBalance) {
      if (showAnimation) {
        // Animate the credit change
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
      
      setDisplayBalance(newBalance);
      setLastUpdateTime(new Date());
    }
  }, [balance, profile?.credits, displayBalance, showAnimation, animatedValue]);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          text: styles.smallText,
          icon: 16,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          text: styles.largeText,
          icon: 24,
        };
      default:
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
          icon: 20,
        };
    }
  };

  const getUpdateIndicator = () => {
    if (!latestUpdate) return null;
    
    const isIncrease = latestUpdate.transaction.type === 'purchase' || latestUpdate.transaction.type === 'subscription';
    const Icon = isIncrease ? TrendingUp : TrendingDown;
    const color = isIncrease ? '#4CAF50' : '#FF9800';
    
    return (
      <View style={styles.updateIndicator}>
        <Icon size={12} color={color} />
        <Text style={[styles.updateText, { color }]}>
          {isIncrease ? '+' : '-'}{latestUpdate.transaction.amount}
        </Text>
      </View>
    );
  };

  const getConnectionIndicator = () => {
    if (status === 'connected') return null;
    
    return (
      <TouchableOpacity 
        style={styles.connectionIndicator}
        onPress={reconnect}
        disabled={status === 'connecting'}
      >
        <RefreshCw 
          size={10} 
          color={status === 'error' ? '#f44336' : '#ff9800'} 
        />
      </TouchableOpacity>
    );
  };

  const formatLastUpdate = () => {
    if (!lastUpdateTime || !showLastUpdate) return null;
    
    const now = new Date();
    const diff = now.getTime() - lastUpdateTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    let timeText = '';
    if (minutes > 0) {
      timeText = `${minutes}m ago`;
    } else if (seconds > 0) {
      timeText = `${seconds}s ago`;
    } else {
      timeText = 'just now';
    }
    
    return (
      <Text style={styles.lastUpdateText}>
        Updated {timeText}
      </Text>
    );
  };

  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[sizeStyles.container, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Animated.View 
        style={[
          styles.content,
          { transform: [{ scale: animatedValue }] }
        ]}
      >
        <View style={styles.mainContent}>
          <Coins size={sizeStyles.icon} color="#FFD700" />
          <Text style={[sizeStyles.text, styles.creditsText]}>
            {displayBalance.toLocaleString()}
          </Text>
          {getConnectionIndicator()}
        </View>
        
        {getUpdateIndicator()}
        {formatLastUpdate()}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  smallContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediumContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  largeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  content: {
    alignItems: 'center',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creditsText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  smallText: {
    fontSize: 12,
  },
  mediumText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 16,
  },
  updateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  updateText: {
    fontSize: 10,
    fontWeight: '500',
  },
  connectionIndicator: {
    marginLeft: 4,
    padding: 2,
  },
  lastUpdateText: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
});