import { supabase } from '@/lib/supabase';

export interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type: 'purchase' | 'deduction' | 'subscription' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CreditCost {
  imageGeneration: {
    basic: number;
    standard: number;
    high: number;
  };
  videoGeneration: {
    '3s': number;
    '5s': number;
    '10s': number;
    '15s': number;
  };
  training: {
    600: number;
    1200: number;
    2000: number;
  };
  editing: {
    basic: number;
    advanced: number;
  };
}

export class CreditService {
  // Credit costs configuration
  static readonly CREDIT_COSTS: CreditCost = {
    imageGeneration: {
      basic: 1,
      standard: 2,
      high: 4,
    },
    videoGeneration: {
      '3s': 5,
      '5s': 8,
      '10s': 15,
      '15s': 25,
    },
    training: {
      600: 10,
      1200: 20,
      2000: 35,
    },
    editing: {
      basic: 2,
      advanced: 5,
    },
  };

  /**
   * Get current credit balance for a user
   */
  static async getCreditBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching credit balance:', error);
        return 0;
      }

      return data?.credits || 0;
    } catch (error) {
      console.error('Error in getCreditBalance:', error);
      return 0;
    }
  }

  /**
   * Check if user has sufficient credits for an operation
   */
  static async hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const balance = await CreditService.getCreditBalance(userId);
    return balance >= requiredCredits;
  }

  /**
   * Calculate credit cost for image generation
   */
  static calculateImageGenerationCost(
    quality: 'basic' | 'standard' | 'high',
    quantity: number = 1
  ): number {
    const baseCost = CreditService.CREDIT_COSTS.imageGeneration[quality];
    return baseCost * quantity;
  }

  /**
   * Calculate credit cost for video generation
   */
  static calculateVideoGenerationCost(
    duration: '3s' | '5s' | '10s' | '15s',
    quality: 'basic' | 'standard' | 'high' = 'standard'
  ): number {
    const baseCost = CreditService.CREDIT_COSTS.videoGeneration[duration];
    const qualityMultiplier = quality === 'basic' ? 1 : quality === 'standard' ? 1.5 : 2;
    return Math.ceil(baseCost * qualityMultiplier);
  }

  /**
   * Calculate credit cost for model training
   */
  static calculateTrainingCost(steps: 600 | 1200 | 2000): number {
    return CreditService.CREDIT_COSTS.training[steps];
  }

  /**
   * Calculate credit cost for image editing
   */
  static calculateEditingCost(editType: 'basic' | 'advanced'): number {
    return CreditService.CREDIT_COSTS.editing[editType];
  }

  /**
   * Validate credit requirements before generation
   */
  static async validateCreditsForGeneration(
    userId: string,
    generationType: 'image' | 'video' | 'training' | 'editing',
    options: {
      quality?: 'basic' | 'standard' | 'high';
      duration?: '3s' | '5s' | '10s' | '15s';
      steps?: 600 | 1200 | 2000;
      editType?: 'basic' | 'advanced';
      quantity?: number;
    }
  ): Promise<{ valid: boolean; required: number; available: number; message?: string }> {
    let requiredCredits = 0;

    // Calculate required credits based on generation type
    switch (generationType) {
      case 'image':
        requiredCredits = CreditService.calculateImageGenerationCost(
          options.quality || 'standard',
          options.quantity || 1
        );
        break;
      case 'video':
        requiredCredits = CreditService.calculateVideoGenerationCost(
          options.duration || '5s',
          options.quality || 'standard'
        );
        break;
      case 'training':
        requiredCredits = CreditService.calculateTrainingCost(options.steps || 1200);
        break;
      case 'editing':
        requiredCredits = CreditService.calculateEditingCost(options.editType || 'basic');
        break;
    }

    const availableCredits = await CreditService.getCreditBalance(userId);
    const valid = availableCredits >= requiredCredits;

    return {
      valid,
      required: requiredCredits,
      available: availableCredits,
      message: valid 
        ? undefined 
        : `Insufficient credits. Required: ${requiredCredits}, Available: ${availableCredits}`,
    };
  }

  /**
   * Get credit transaction history for a user
   */
  static async getCreditHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CreditTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching credit history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCreditHistory:', error);
      return [];
    }
  }

  /**
   * Subscribe to real-time credit balance changes
   */
  static subscribeToBalanceChanges(
    userId: string,
    callback: (newBalance: number) => void
  ) {
    const subscription = supabase
      .channel(`credits:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && 'credits' in payload.new) {
            callback(payload.new.credits as number);
          }
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Subscribe to real-time credit transaction changes
   */
  static subscribeToTransactionChanges(
    userId: string,
    callback: (transaction: CreditTransaction) => void
  ) {
    const subscription = supabase
      .channel(`credit_transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as CreditTransaction);
          }
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Format credit amount for display
   */
  static formatCredits(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  }

  /**
   * Get credit cost breakdown for display
   */
  static getCostBreakdown(
    generationType: 'image' | 'video' | 'training' | 'editing',
    options: {
      quality?: 'basic' | 'standard' | 'high';
      duration?: '3s' | '5s' | '10s' | '15s';
      steps?: 600 | 1200 | 2000;
      editType?: 'basic' | 'advanced';
      quantity?: number;
    }
  ): { baseCost: number; multipliers: string[]; totalCost: number } {
    let baseCost = 0;
    const multipliers: string[] = [];

    switch (generationType) {
      case 'image':
        baseCost = CreditService.CREDIT_COSTS.imageGeneration[options.quality || 'standard'];
        if (options.quantity && options.quantity > 1) {
          multipliers.push(`×${options.quantity} images`);
        }
        break;
      case 'video':
        baseCost = CreditService.CREDIT_COSTS.videoGeneration[options.duration || '5s'];
        if (options.quality && options.quality !== 'standard') {
          const qualityMultiplier = options.quality === 'basic' ? 1 : 2;
          multipliers.push(`×${qualityMultiplier} (${options.quality} quality)`);
        }
        break;
      case 'training':
        baseCost = CreditService.CREDIT_COSTS.training[options.steps || 1200];
        break;
      case 'editing':
        baseCost = CreditService.CREDIT_COSTS.editing[options.editType || 'basic'];
        break;
    }

    const totalCost = CreditService.calculateCostWithOptions(generationType, options);

    return {
      baseCost,
      multipliers,
      totalCost,
    };
  }

  /**
   * Private helper to calculate cost with all options
   */
  private static calculateCostWithOptions(
    generationType: 'image' | 'video' | 'training' | 'editing',
    options: {
      quality?: 'basic' | 'standard' | 'high';
      duration?: '3s' | '5s' | '10s' | '15s';
      steps?: 600 | 1200 | 2000;
      editType?: 'basic' | 'advanced';
      quantity?: number;
    }
  ): number {
    switch (generationType) {
      case 'image':
        return CreditService.calculateImageGenerationCost(
          options.quality || 'standard',
          options.quantity || 1
        );
      case 'video':
        return CreditService.calculateVideoGenerationCost(
          options.duration || '5s',
          options.quality || 'standard'
        );
      case 'training':
        return CreditService.calculateTrainingCost(options.steps || 1200);
      case 'editing':
        return CreditService.calculateEditingCost(options.editType || 'basic');
      default:
        return 0;
    }
  }

  /**
   * Get estimated wait time based on credit cost (higher cost = higher priority)
   */
  static getEstimatedWaitTime(creditCost: number): string {
    if (creditCost >= 50) return '1-2 minutes';
    if (creditCost >= 20) return '2-5 minutes';
    if (creditCost >= 10) return '3-8 minutes';
    if (creditCost >= 5) return '5-10 minutes';
    return '5-15 minutes';
  }

  /**
   * Check if user qualifies for credit bonus (e.g., first generation, daily bonus)
   */
  static async checkCreditBonus(userId: string): Promise<{
    eligible: boolean;
    bonusType?: 'first_generation' | 'daily_bonus' | 'streak_bonus';
    bonusAmount?: number;
    message?: string;
  }> {
    try {
      // Check for first generation bonus
      const { data: generations, error } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_type', 'deduction')
        .limit(1);

      if (error) {
        console.error('Error checking credit bonus:', error);
        return { eligible: false };
      }

      if (!generations || generations.length === 0) {
        return {
          eligible: true,
          bonusType: 'first_generation',
          bonusAmount: 10,
          message: 'Welcome bonus! Get 10 free credits for your first generation.',
        };
      }

      // TODO: Implement daily bonus and streak bonus logic
      return { eligible: false };
    } catch (error) {
      console.error('Error in checkCreditBonus:', error);
      return { eligible: false };
    }
  }
}