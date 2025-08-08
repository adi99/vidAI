import { supabase } from '@/lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export interface GenerationProgressUpdate {
  jobId: string;
  progress: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface CreditBalanceUpdate {
  userId: string;
  newBalance: number;
  transaction: {
    type: 'purchase' | 'deduction' | 'subscription' | 'refund';
    amount: number;
    description: string;
  };
}

export interface FeedUpdate {
  type: 'new_content' | 'like' | 'comment' | 'share';
  contentId: string;
  data: any;
}

export interface TrainingProgressUpdate {
  jobId: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep?: string;
  error?: string;
}

export type WebSocketEventType = 
  | 'generation_progress'
  | 'credit_balance_update'
  | 'feed_update'
  | 'training_progress'
  | 'notification';

export type WebSocketEventHandler<T = any> = (data: T) => void;

class WebSocketService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private isConnected = false;
  private userId: string | null = null;

  /**
   * Initialize WebSocket connection with user authentication
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    
    try {
      // Subscribe to user-specific channel for personal updates
      await this.subscribeToUserChannel(userId);
      
      // Subscribe to global feed channel for public updates
      await this.subscribeToFeedChannel();
      
      this.isConnected = true;
      console.log('WebSocket service initialized for user:', userId);
    } catch (error) {
      console.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Subscribe to user-specific updates (credits, generations, training)
   */
  private async subscribeToUserChannel(userId: string): Promise<void> {
    const userChannel = supabase
      .channel(`user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleUserUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generation_jobs',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleGenerationUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_jobs',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleTrainingUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleCreditUpdate(payload);
        }
      );

    await userChannel.subscribe();
    this.channels.set(`user:${userId}`, userChannel);
  }

  /**
   * Subscribe to global feed updates (likes, comments, new content)
   */
  private async subscribeToFeedChannel(): Promise<void> {
    const feedChannel = supabase
      .channel('public:feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'videos',
          filter: 'is_public=eq.true',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleFeedUpdate('new_content', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'images',
          filter: 'is_public=eq.true',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleFeedUpdate('new_content', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleFeedUpdate('like', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handleFeedUpdate('comment', payload);
        }
      );

    await feedChannel.subscribe();
    this.channels.set('public:feed', feedChannel);
  }

  /**
   * Handle user profile updates (mainly credit balance)
   */
  private handleUserUpdate(payload: RealtimePostgresChangesPayload<any>): void {
    if (payload.new && payload.old) {
      const oldCredits = (payload.old as any).credits;
      const newCredits = (payload.new as any).credits;
      
      if (oldCredits !== newCredits) {
        const creditUpdate: CreditBalanceUpdate = {
          userId: payload.new.id,
          newBalance: newCredits,
          transaction: {
            type: newCredits > oldCredits ? 'purchase' : 'deduction',
            amount: Math.abs(newCredits - oldCredits),
            description: newCredits > oldCredits ? 'Credits added' : 'Credits used',
          },
        };
        
        this.emit('credit_balance_update', creditUpdate);
      }
    }
  }

  /**
   * Handle generation job updates
   */
  private handleGenerationUpdate(payload: RealtimePostgresChangesPayload<any>): void {
    const jobData = payload.new || (payload as any).record;
    
    if (jobData) {
      const progressUpdate: GenerationProgressUpdate = {
        jobId: jobData.id,
        progress: jobData.progress || 0,
        status: jobData.status,
        result: jobData.result,
        error: jobData.error_message,
      };
      
      this.emit('generation_progress', progressUpdate);
    }
  }

  /**
   * Handle training job updates
   */
  private handleTrainingUpdate(payload: RealtimePostgresChangesPayload<any>): void {
    const jobData = payload.new || (payload as any).record;
    
    if (jobData) {
      const progressUpdate: TrainingProgressUpdate = {
        jobId: jobData.id,
        progress: jobData.progress || 0,
        status: jobData.status,
        currentStep: jobData.current_step,
        error: jobData.error_message,
      };
      
      this.emit('training_progress', progressUpdate);
    }
  }

  /**
   * Handle credit transaction updates
   */
  private handleCreditUpdate(payload: RealtimePostgresChangesPayload<any>): void {
    const transaction = payload.new;
    
    if (transaction) {
      const creditUpdate: CreditBalanceUpdate = {
        userId: transaction.user_id,
        newBalance: transaction.balance_after,
        transaction: {
          type: transaction.transaction_type,
          amount: transaction.amount,
          description: transaction.description,
        },
      };
      
      this.emit('credit_balance_update', creditUpdate);
    }
  }

  /**
   * Handle feed updates (likes, comments, new content)
   */
  private handleFeedUpdate(type: 'new_content' | 'like' | 'comment', payload: RealtimePostgresChangesPayload<any>): void {
    const data = payload.new || (payload as any).record;
    
    if (data) {
      const feedUpdate: FeedUpdate = {
        type,
        contentId: type === 'new_content' ? data.id : data.content_id,
        data,
      };
      
      this.emit('feed_update', feedUpdate);
    }
  }

  /**
   * Subscribe to specific event type
   */
  on<T = any>(eventType: WebSocketEventType, handler: WebSocketEventHandler<T>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from specific event type
   */
  off<T = any>(eventType: WebSocketEventType, handler: WebSocketEventHandler<T>): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to all registered handlers
   */
  private emit<T = any>(eventType: WebSocketEventType, data: T): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Send custom message through WebSocket (for future backend WebSocket implementation)
   */
  send(message: WebSocketMessage): void {
    // This would be implemented when we have a custom WebSocket server
    // For now, we rely on Supabase Realtime
    console.log('WebSocket send (not implemented):', message);
  }

  /**
   * Subscribe to generation progress for specific job
   */
  subscribeToGenerationProgress(jobId: string, callback: (progress: GenerationProgressUpdate) => void): () => void {
    const handler = (data: GenerationProgressUpdate) => {
      if (data.jobId === jobId) {
        callback(data);
      }
    };
    
    this.on('generation_progress', handler);
    
    // Return unsubscribe function
    return () => {
      this.off('generation_progress', handler);
    };
  }

  /**
   * Subscribe to training progress for specific job
   */
  subscribeToTrainingProgress(jobId: string, callback: (progress: TrainingProgressUpdate) => void): () => void {
    const handler = (data: TrainingProgressUpdate) => {
      if (data.jobId === jobId) {
        callback(data);
      }
    };
    
    this.on('training_progress', handler);
    
    // Return unsubscribe function
    return () => {
      this.off('training_progress', handler);
    };
  }

  /**
   * Subscribe to credit balance updates
   */
  subscribeToCreditUpdates(callback: (update: CreditBalanceUpdate) => void): () => void {
    this.on('credit_balance_update', callback);
    
    // Return unsubscribe function
    return () => {
      this.off('credit_balance_update', callback);
    };
  }

  /**
   * Subscribe to feed updates
   */
  subscribeToFeedUpdates(callback: (update: FeedUpdate) => void): () => void {
    this.on('feed_update', callback);
    
    // Return unsubscribe function
    return () => {
      this.off('feed_update', callback);
    };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect and cleanup all channels
   */
  async disconnect(): Promise<void> {
    try {
      // Unsubscribe from all channels
      for (const [channelName, channel] of this.channels) {
        await channel.unsubscribe();
        console.log(`Unsubscribed from channel: ${channelName}`);
      }
      
      // Clear all channels and handlers
      this.channels.clear();
      this.eventHandlers.clear();
      
      this.isConnected = false;
      this.userId = null;
      
      console.log('WebSocket service disconnected');
    } catch (error) {
      console.error('Error disconnecting WebSocket service:', error);
    }
  }

  /**
   * Reconnect with current user
   */
  async reconnect(): Promise<void> {
    if (this.userId) {
      await this.disconnect();
      await this.initialize(this.userId);
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();