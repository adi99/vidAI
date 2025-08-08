import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export interface ConnectivityState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetInfoStateType;
  isWifiEnabled: boolean;
  isCellularEnabled: boolean;
  strength?: number;
}

export interface OfflineQueueItem {
  id: string;
  type: 'generation' | 'like' | 'comment' | 'share' | 'upload';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
}

class ConnectivityService {
  private listeners: ((state: ConnectivityState) => void)[] = [];
  private currentState: ConnectivityState | null = null;
  private offlineQueue: OfflineQueueItem[] = [];
  private isProcessingQueue = false;
  private readonly OFFLINE_QUEUE_KEY = 'offline_queue';
  private readonly MAX_QUEUE_SIZE = 100;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Load offline queue from storage
    await this.loadOfflineQueue();

    // Subscribe to network state changes
    NetInfo.addEventListener(this.handleNetworkStateChange);

    // Get initial network state
    const initialState = await NetInfo.fetch();
    this.handleNetworkStateChange(initialState);
  }

  private handleNetworkStateChange = (state: NetInfoState) => {
    const connectivityState: ConnectivityState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
      isWifiEnabled: state.type === NetInfoStateType.wifi && (state.isConnected ?? false),
      isCellularEnabled: state.type === NetInfoStateType.cellular && (state.isConnected ?? false),
      strength: this.getSignalStrength(state),
    };

    const wasOffline = this.currentState && !this.currentState.isConnected;
    const isNowOnline = connectivityState.isConnected;

    this.currentState = connectivityState;

    // Notify listeners
    this.listeners.forEach(listener => listener(connectivityState));

    // Process offline queue when coming back online
    if (wasOffline && isNowOnline) {
      this.processOfflineQueue();
      this.notifyBackOnline();
    }

    // Notify when going offline
    if (!wasOffline && !isNowOnline) {
      this.notifyGoingOffline();
    }
  };

  private getSignalStrength(state: NetInfoState): number | undefined {
    if (state.type === NetInfoStateType.wifi && state.details) {
      // WiFi signal strength (0-100)
      return (state.details as any).strength;
    }
    if (state.type === NetInfoStateType.cellular && state.details) {
      // Cellular signal strength (0-4 bars, convert to 0-100)
      const bars = (state.details as any).cellularGeneration;
      return bars ? (bars / 4) * 100 : undefined;
    }
    return undefined;
  }

  private async notifyBackOnline() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    console.log('Back online! Processing queued operations...');
  }

  private async notifyGoingOffline() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    console.log('Gone offline. Operations will be queued.');
  }

  /**
   * Subscribe to connectivity changes
   */
  subscribe(listener: (state: ConnectivityState) => void): () => void {
    this.listeners.push(listener);
    
    // Immediately call with current state if available
    if (this.currentState) {
      listener(this.currentState);
    }

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current connectivity state
   */
  getCurrentState(): ConnectivityState | null {
    return this.currentState;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.currentState?.isConnected ?? false;
  }

  /**
   * Check if internet is reachable
   */
  isInternetReachable(): boolean {
    return this.currentState?.isInternetReachable ?? false;
  }

  /**
   * Add operation to offline queue
   */
  async queueOperation(
    type: OfflineQueueItem['type'],
    data: any,
    priority: OfflineQueueItem['priority'] = 'medium',
    maxRetries: number = 3
  ): Promise<string> {
    const queueItem: OfflineQueueItem = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      priority,
    };

    // Add to queue (maintain size limit)
    this.offlineQueue.push(queueItem);
    if (this.offlineQueue.length > this.MAX_QUEUE_SIZE) {
      // Remove oldest low-priority items first
      this.offlineQueue = this.offlineQueue
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          return b.timestamp - a.timestamp;
        })
        .slice(0, this.MAX_QUEUE_SIZE);
    }

    // Save to storage
    await this.saveOfflineQueue();

    console.log(`Queued ${type} operation:`, queueItem.id);
    return queueItem.id;
  }

  /**
   * Remove operation from queue
   */
  async removeFromQueue(id: string): Promise<void> {
    this.offlineQueue = this.offlineQueue.filter(item => item.id !== id);
    await this.saveOfflineQueue();
  }

  /**
   * Get queued operations
   */
  getQueuedOperations(): OfflineQueueItem[] {
    return [...this.offlineQueue];
  }

  /**
   * Clear offline queue
   */
  async clearQueue(): Promise<void> {
    this.offlineQueue = [];
    await this.saveOfflineQueue();
  }

  /**
   * Process offline queue when back online
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.isConnected()) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Sort by priority and timestamp
      const sortedQueue = [...this.offlineQueue].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (a.priority !== b.priority) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.timestamp - b.timestamp;
      });

      for (const item of sortedQueue) {
        if (!this.isConnected()) {
          break; // Stop if we go offline again
        }

        try {
          await this.processQueueItem(item);
          await this.removeFromQueue(item.id);
          console.log(`Successfully processed queued operation: ${item.id}`);
        } catch (error) {
          console.error(`Failed to process queued operation ${item.id}:`, error);
          
          // Increment retry count
          item.retryCount++;
          
          if (item.retryCount >= item.maxRetries) {
            // Remove failed item after max retries
            await this.removeFromQueue(item.id);
            console.log(`Removed failed operation after ${item.maxRetries} retries: ${item.id}`);
          } else {
            // Save updated retry count
            await this.saveOfflineQueue();
          }
        }

        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: OfflineQueueItem): Promise<void> {
    // This would be implemented by importing and using the appropriate services
    // For now, we'll just log the operation
    console.log(`Processing ${item.type} operation:`, item.data);

    // In a real implementation, you would:
    // - Import the appropriate service (socialService, generationService, etc.)
    // - Call the appropriate method based on item.type
    // - Handle the response appropriately

    switch (item.type) {
      case 'like':
        // await socialService.toggleLike(item.data.contentId, item.data.contentType, item.data.action);
        break;
      case 'comment':
        // await socialService.addComment(item.data.contentId, item.data.contentType, item.data.text);
        break;
      case 'share':
        // await socialService.shareContent(item.data.contentId, item.data.contentType, item.data.platform);
        break;
      case 'generation':
        // await generationService.generateContent(item.data);
        break;
      case 'upload':
        // await uploadService.uploadFile(item.data);
        break;
      default:
        console.warn(`Unknown queue item type: ${item.type}`);
    }
  }

  /**
   * Save offline queue to storage
   */
  private async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Load offline queue from storage
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (queueData) {
        this.offlineQueue = JSON.parse(queueData);
        console.log(`Loaded ${this.offlineQueue.length} items from offline queue`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * Get network quality assessment
   */
  getNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'offline' {
    if (!this.currentState?.isConnected) {
      return 'offline';
    }

    if (!this.currentState.isInternetReachable) {
      return 'poor';
    }

    const strength = this.currentState.strength;
    if (strength === undefined) {
      return this.currentState.type === NetInfoStateType.wifi ? 'good' : 'fair';
    }

    if (strength >= 80) return 'excellent';
    if (strength >= 60) return 'good';
    if (strength >= 40) return 'fair';
    return 'poor';
  }

  /**
   * Test internet connectivity by pinging a reliable endpoint
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get connectivity statistics
   */
  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    networkQuality: string;
    connectionType: string;
  } {
    return {
      queueSize: this.offlineQueue.length,
      isProcessing: this.isProcessingQueue,
      networkQuality: this.getNetworkQuality(),
      connectionType: this.currentState?.type || 'unknown',
    };
  }
}

export const connectivityService = new ConnectivityService();
export default connectivityService;