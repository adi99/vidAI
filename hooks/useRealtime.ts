import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  websocketService, 
  GenerationProgressUpdate, 
  CreditBalanceUpdate, 
  FeedUpdate, 
  TrainingProgressUpdate,
  WebSocketEventType,
  WebSocketEventHandler
} from '@/services/websocketService';

export interface UseRealtimeOptions {
  autoConnect?: boolean;
  reconnectOnError?: boolean;
  reconnectDelay?: number;
}

export interface UseRealtimeReturn {
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  subscribe: <T = any>(eventType: WebSocketEventType, handler: WebSocketEventHandler<T>) => () => void;
}

/**
 * Main realtime hook for WebSocket connection management
 */
export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<any>(null);
  const isConnectingRef = useRef(false);
  
  const {
    autoConnect = true,
    reconnectOnError = true,
    reconnectDelay = 3000,
  } = options;

  const connect = useCallback(async () => {
    if (!user?.id || isConnectingRef.current) return;
    
    try {
      isConnectingRef.current = true;
      await websocketService.initialize(user.id);
      setIsConnected(true);
      console.log('Realtime connection established');
    } catch (error) {
      console.error('Failed to connect to realtime service:', error);
      setIsConnected(false);
      
      if (reconnectOnError) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay);
      }
    } finally {
      isConnectingRef.current = false;
    }
  }, [user?.id, reconnectOnError, reconnectDelay]);

  const disconnect = useCallback(async () => {
    try {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      await websocketService.disconnect();
      setIsConnected(false);
      console.log('Realtime connection disconnected');
    } catch (error) {
      console.error('Error disconnecting from realtime service:', error);
    }
  }, []);

  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  const subscribe = useCallback(<T = any>(
    eventType: WebSocketEventType, 
    handler: WebSocketEventHandler<T>
  ): (() => void) => {
    websocketService.on(eventType, handler);
    
    return () => {
      websocketService.off(eventType, handler);
    };
  }, []);

  // Auto-connect when user is available
  useEffect(() => {
    if (user?.id && autoConnect && !isConnected && !isConnectingRef.current) {
      connect();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user?.id, autoConnect, isConnected, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
    reconnect,
    subscribe,
  };
}

/**
 * Hook for subscribing to generation progress updates
 */
export function useGenerationProgress(jobId?: string) {
  const [progress, setProgress] = useState<GenerationProgressUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { subscribe } = useRealtime();

  useEffect(() => {
    if (!jobId) return;

    setIsLoading(true);
    
    const unsubscribe = subscribe('generation_progress', (update: GenerationProgressUpdate) => {
      if (update.jobId === jobId) {
        setProgress(update);
        
        if (update.status === 'completed' || update.status === 'failed') {
          setIsLoading(false);
        }
      }
    });

    return unsubscribe;
  }, [jobId, subscribe]);

  return { progress, isLoading };
}

/**
 * Hook for subscribing to training progress updates
 */
export function useTrainingProgress(jobId?: string) {
  const [progress, setProgress] = useState<TrainingProgressUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { subscribe } = useRealtime();

  useEffect(() => {
    if (!jobId) return;

    setIsLoading(true);
    
    const unsubscribe = subscribe('training_progress', (update: TrainingProgressUpdate) => {
      if (update.jobId === jobId) {
        setProgress(update);
        
        if (update.status === 'completed' || update.status === 'failed') {
          setIsLoading(false);
        }
      }
    });

    return unsubscribe;
  }, [jobId, subscribe]);

  return { progress, isLoading };
}

/**
 * Hook for subscribing to credit balance updates
 */
export function useCreditUpdates() {
  const [latestUpdate, setLatestUpdate] = useState<CreditBalanceUpdate | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe('credit_balance_update', (update: CreditBalanceUpdate) => {
      setLatestUpdate(update);
      setBalance(update.newBalance);
    });

    return unsubscribe;
  }, [subscribe]);

  return { latestUpdate, balance };
}

/**
 * Hook for subscribing to feed updates
 */
export function useFeedUpdates() {
  const [updates, setUpdates] = useState<FeedUpdate[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<FeedUpdate | null>(null);
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe('feed_update', (update: FeedUpdate) => {
      setLatestUpdate(update);
      setUpdates(prev => [update, ...prev.slice(0, 49)]); // Keep last 50 updates
    });

    return unsubscribe;
  }, [subscribe]);

  const clearUpdates = useCallback(() => {
    setUpdates([]);
    setLatestUpdate(null);
  }, []);

  return { updates, latestUpdate, clearUpdates };
}

/**
 * Hook for real-time notifications
 */
export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe('notification', (notification: any) => {
      setNotifications(prev => [notification, ...prev.slice(0, 19)]); // Keep last 20 notifications
    });

    return unsubscribe;
  }, [subscribe]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
  }, []);

  return { 
    notifications, 
    clearNotifications, 
    markAsRead,
    unreadCount: notifications.filter(n => !n.read).length
  };
}

/**
 * Hook for real-time connection status with automatic reconnection
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const { isConnected, reconnect } = useRealtime();

  useEffect(() => {
    if (isConnected) {
      setStatus('connected');
      setLastConnected(new Date());
    } else {
      setStatus('disconnected');
    }
  }, [isConnected]);

  const handleReconnect = useCallback(async () => {
    setStatus('connecting');
    try {
      await reconnect();
    } catch (error) {
      setStatus('error');
      console.error('Reconnection failed:', error);
    }
  }, [reconnect]);

  return {
    status,
    lastConnected,
    reconnect: handleReconnect,
    isConnected,
  };
}