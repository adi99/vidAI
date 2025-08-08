import { useState, useEffect, useCallback } from 'react';
import connectivityService, { ConnectivityState, OfflineQueueItem } from '@/services/connectivityService';
import * as Haptics from 'expo-haptics';

export interface UseConnectivityOptions {
  showOfflineAlert?: boolean;
  hapticFeedback?: boolean;
  autoQueue?: boolean;
}

export function useConnectivity(options: UseConnectivityOptions = {}) {
  const {
    showOfflineAlert = true,
    hapticFeedback = true,
    autoQueue = true,
  } = options;

  const [connectivityState, setConnectivityState] = useState<ConnectivityState | null>(
    connectivityService.getCurrentState()
  );
  const [queuedOperations, setQueuedOperations] = useState<OfflineQueueItem[]>([]);

  useEffect(() => {
    // Subscribe to connectivity changes
    const unsubscribe = connectivityService.subscribe((state) => {
      setConnectivityState(state);
      
      // Update queued operations
      setQueuedOperations(connectivityService.getQueuedOperations());
    });

    // Initial queue state
    setQueuedOperations(connectivityService.getQueuedOperations());

    return unsubscribe;
  }, []);

  /**
   * Execute an operation with offline support
   */
  const executeWithOfflineSupport = useCallback(async <T>(
    operation: () => Promise<T>,
    fallbackData?: {
      type: OfflineQueueItem['type'];
      data: any;
      priority?: OfflineQueueItem['priority'];
    }
  ): Promise<T | null> => {
    // If online, execute normally
    if (connectivityService.isConnected()) {
      try {
        return await operation();
      } catch (error) {
        // If operation fails and we have fallback data, queue it
        if (autoQueue && fallbackData) {
          await connectivityService.queueOperation(
            fallbackData.type,
            fallbackData.data,
            fallbackData.priority
          );
          
          if (hapticFeedback) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
        throw error;
      }
    }

    // If offline and we have fallback data, queue the operation
    if (autoQueue && fallbackData) {
      await connectivityService.queueOperation(
        fallbackData.type,
        fallbackData.data,
        fallbackData.priority
      );

      if (hapticFeedback) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      return null;
    }

    // If offline and no fallback, throw error
    throw new Error('No internet connection and no offline fallback available');
  }, [autoQueue, hapticFeedback]);

  /**
   * Queue an operation for later execution
   */
  const queueOperation = useCallback(async (
    type: OfflineQueueItem['type'],
    data: any,
    priority: OfflineQueueItem['priority'] = 'medium'
  ): Promise<string> => {
    const id = await connectivityService.queueOperation(type, data, priority);
    setQueuedOperations(connectivityService.getQueuedOperations());
    return id;
  }, []);

  /**
   * Remove operation from queue
   */
  const removeFromQueue = useCallback(async (id: string) => {
    await connectivityService.removeFromQueue(id);
    setQueuedOperations(connectivityService.getQueuedOperations());
  }, []);

  /**
   * Clear all queued operations
   */
  const clearQueue = useCallback(async () => {
    await connectivityService.clearQueue();
    setQueuedOperations([]);
  }, []);

  /**
   * Test connectivity
   */
  const testConnectivity = useCallback(async (): Promise<boolean> => {
    return connectivityService.testConnectivity();
  }, []);

  /**
   * Get network quality assessment
   */
  const getNetworkQuality = useCallback(() => {
    return connectivityService.getNetworkQuality();
  }, [connectivityState]);

  // Derived state
  const isConnected = connectivityState?.isConnected ?? false;
  const isInternetReachable = connectivityState?.isInternetReachable ?? false;
  const connectionType = connectivityState?.type || 'unknown';
  const isWifi = connectivityState?.isWifiEnabled ?? false;
  const isCellular = connectivityState?.isCellularEnabled ?? false;
  const signalStrength = connectivityState?.strength;
  const networkQuality = getNetworkQuality();
  const hasQueuedOperations = queuedOperations.length > 0;

  return {
    // Connection state
    isConnected,
    isInternetReachable,
    connectionType,
    isWifi,
    isCellular,
    signalStrength,
    networkQuality,
    connectivityState,

    // Offline queue
    queuedOperations,
    hasQueuedOperations,
    queueSize: queuedOperations.length,

    // Actions
    executeWithOfflineSupport,
    queueOperation,
    removeFromQueue,
    clearQueue,
    testConnectivity,

    // Utilities
    getNetworkQuality,
    isOnline: isConnected && isInternetReachable,
    isOffline: !isConnected,
    hasGoodConnection: networkQuality === 'excellent' || networkQuality === 'good',
    hasPoorConnection: networkQuality === 'poor' || networkQuality === 'fair',
  };
}

export default useConnectivity;