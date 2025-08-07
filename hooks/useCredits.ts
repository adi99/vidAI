import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CreditService } from '@/services/creditService';

interface UseCreditValidationOptions {
  generationType: 'image' | 'video' | 'training' | 'editing';
  options: {
    quality?: 'basic' | 'standard' | 'high';
    duration?: '3s' | '5s' | '10s' | '15s';
    steps?: 600 | 1200 | 2000;
    editType?: 'basic' | 'advanced';
    quantity?: number;
  };
  autoValidate?: boolean;
}

export function useCreditValidation({
  generationType,
  options,
  autoValidate = true,
}: UseCreditValidationOptions) {
  const { user, credits, validateCredits, getCreditCost } = useAuth();
  const [validation, setValidation] = useState<{
    valid: boolean;
    required: number;
    available: number;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const cost = getCreditCost(generationType, options);

  const performValidation = async () => {
    if (!user?.id) {
      setValidation({
        valid: false,
        required: cost,
        available: 0,
        message: 'User not authenticated',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await validateCredits(generationType, options);
      setValidation(result);
    } catch (error) {
      console.error('Credit validation error:', error);
      setValidation({
        valid: false,
        required: cost,
        available: credits,
        message: 'Validation failed',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoValidate) {
      performValidation();
    }
  }, [generationType, JSON.stringify(options), credits, user?.id, autoValidate]);

  return {
    validation,
    loading,
    cost,
    performValidation,
    hasEnoughCredits: validation?.valid ?? false,
    shortfall: validation ? Math.max(0, validation.required - validation.available) : 0,
  };
}

export function useCreditCosts() {
  return {
    calculateImageCost: (quality: 'basic' | 'standard' | 'high', quantity = 1) =>
      CreditService.calculateImageGenerationCost(quality, quantity),
    
    calculateVideoCost: (duration: '3s' | '5s' | '10s' | '15s', quality: 'basic' | 'standard' | 'high' = 'standard') =>
      CreditService.calculateVideoGenerationCost(duration, quality),
    
    calculateTrainingCost: (steps: 600 | 1200 | 2000) =>
      CreditService.calculateTrainingCost(steps),
    
    calculateEditingCost: (editType: 'basic' | 'advanced') =>
      CreditService.calculateEditingCost(editType),
    
    getCostBreakdown: (generationType: 'image' | 'video' | 'training' | 'editing', options: any) =>
      CreditService.getCostBreakdown(generationType, options),
    
    getEstimatedWaitTime: (creditCost: number) =>
      CreditService.getEstimatedWaitTime(creditCost),
  };
}

export function useCreditHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async (limit = 50, offset = 0) => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    
    try {
      const history = await CreditService.getCreditHistory(user.id, limit, offset);
      setTransactions(history);
    } catch (err) {
      console.error('Error loading credit history:', err);
      setError('Failed to load credit history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user?.id]);

  return {
    transactions,
    loading,
    error,
    reload: () => loadHistory(),
    loadMore: (offset: number) => loadHistory(50, offset),
  };
}

export function useCreditSubscription() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to real-time credit balance changes
    const subscription = CreditService.subscribeToBalanceChanges(
      user.id,
      (newBalance) => {
        setBalance(newBalance);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  return { balance };
}