import React, { useState, useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { MotiView, MotiText } from 'moti';
import { useTheme } from 'react-native-paper';
import { RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface PullToRefreshFeedProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
  showsVerticalScrollIndicator?: boolean;
  contentContainerStyle?: any;
  style?: any;
}

export default function PullToRefreshFeed({
  children,
  onRefresh,
  refreshing = false,
  showsVerticalScrollIndicator = false,
  contentContainerStyle,
  style,
}: PullToRefreshFeedProps) {
  const theme = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await onRefresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Refresh error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh]);

  const CustomRefreshControl = () => (
    <RefreshControl
      refreshing={refreshing || isRefreshing}
      onRefresh={handleRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surface}
      style={styles.refreshControl}
    />
  );

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      refreshControl={<CustomRefreshControl />}
      scrollEventThrottle={16}
    >
      {/* Custom refresh indicator */}
      {(refreshing || isRefreshing) && (
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -20 }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 300,
          }}
          style={[styles.refreshIndicator, { backgroundColor: theme.colors.surface }]}
        >
          <MotiView
            animate={{
              rotate: '360deg',
            }}
            transition={{
              type: 'timing',
              duration: 1000,
              repeat: -1,
            }}
          >
            <RefreshCw size={20} color={theme.colors.primary} />
          </MotiView>
          <MotiText
            style={[styles.refreshText, { color: theme.colors.onSurface }]}
          >
            Refreshing feed...
          </MotiText>
        </MotiView>
      )}

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshControl: {
    backgroundColor: 'transparent',
  },
  refreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    gap: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '500',
  },
});