import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useConnectionStatus } from '@/hooks/useRealtime';

interface ConnectionStatusProps {
  position?: 'top' | 'bottom';
  showWhenConnected?: boolean;
  autoHide?: boolean;
  hideDelay?: number;
}

export function ConnectionStatus({
  position = 'top',
  showWhenConnected = false,
  autoHide = true,
  hideDelay = 3000,
}: ConnectionStatusProps) {
  const { status, lastConnected, reconnect, isConnected } = useConnectionStatus();
  const [visible, setVisible] = useState(false);
  const [animatedValue] = useState(new Animated.Value(0));

  // Show/hide based on connection status
  useEffect(() => {
    const shouldShow = !isConnected || (isConnected && showWhenConnected);
    
    if (shouldShow) {
      setVisible(true);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (isConnected && autoHide) {
      const timer = setTimeout(() => {
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
        });
      }, hideDelay);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, showWhenConnected, autoHide, hideDelay, animatedValue]);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: '#4CAF50',
          backgroundColor: '#E8F5E8',
          text: 'Connected',
          description: lastConnected ? `Connected at ${lastConnected.toLocaleTimeString()}` : 'Real-time updates active',
        };
      case 'connecting':
        return {
          icon: RefreshCw,
          color: '#FF9800',
          backgroundColor: '#FFF3E0',
          text: 'Connecting...',
          description: 'Establishing real-time connection',
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          color: '#757575',
          backgroundColor: '#F5F5F5',
          text: 'Disconnected',
          description: 'Real-time updates unavailable',
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: '#F44336',
          backgroundColor: '#FFEBEE',
          text: 'Connection Error',
          description: 'Failed to connect to real-time service',
        };
      default:
        return {
          icon: WifiOff,
          color: '#757575',
          backgroundColor: '#F5F5F5',
          text: 'Unknown',
          description: 'Connection status unknown',
        };
    }
  };

  const handleReconnect = async () => {
    if (status === 'connecting') return;
    await reconnect();
  };

  if (!visible) return null;

  const config = getStatusConfig();
  const Icon = config.icon;
  const canReconnect = status === 'disconnected' || status === 'error';

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' ? styles.bottomPosition : styles.topPosition,
        { backgroundColor: config.backgroundColor },
        { opacity: animatedValue },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={canReconnect ? handleReconnect : undefined}
        disabled={!canReconnect}
        activeOpacity={canReconnect ? 0.7 : 1}
      >
        <View style={styles.iconContainer}>
          <Icon 
            size={16} 
            color={config.color}
            style={status === 'connecting' ? styles.spinningIcon : undefined}
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.statusText, { color: config.color }]}>
            {config.text}
          </Text>
          <Text style={styles.descriptionText} numberOfLines={1}>
            {config.description}
          </Text>
        </View>
        
        {canReconnect && (
          <View style={styles.actionContainer}>
            <Text style={[styles.actionText, { color: config.color }]}>
              Tap to retry
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  topPosition: {
    top: 60, // Below status bar
  },
  bottomPosition: {
    bottom: 100, // Above tab bar
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  spinningIcon: {
    // Add rotation animation if needed
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  descriptionText: {
    fontSize: 12,
    color: '#666',
  },
  actionContainer: {
    marginLeft: 12,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});