import { useState, useEffect, useCallback } from 'react';
import generationRecoveryService, { GenerationJob, RecoveryOptions } from '@/services/generationRecoveryService';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

export interface UseGenerationRecoveryOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useGenerationRecovery(options: UseGenerationRecoveryOptions = {}) {
  const { autoRefresh = true, refreshInterval = 5000 } = options;
  const { user } = useAuth();
  
  const [activeJobs, setActiveJobs] = useState<GenerationJob[]>([]);
  const [failedJobs, setFailedJobs] = useState<GenerationJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    activeJobs: 0,
    failedJobs: 0,
    pendingRetries: 0,
    totalCreditsRefunded: 0,
  });

  /**
   * Refresh job data
   */
  const refreshJobs = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      
      const userActiveJobs = generationRecoveryService.getUserJobs(user.id);
      const userFailedJobs = generationRecoveryService.getUserFailedJobs(user.id);
      const recoveryStats = generationRecoveryService.getRecoveryStats();
      
      setActiveJobs(userActiveJobs);
      setFailedJobs(userFailedJobs);
      setStats(recoveryStats);
    } catch (error) {
      console.error('Failed to refresh jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Register a new generation job
   */
  const registerJob = useCallback(async (
    id: string,
    type: GenerationJob['type'],
    prompt: string,
    settings: any,
    creditsUsed: number,
    options?: RecoveryOptions
  ): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    await generationRecoveryService.registerJob(
      id,
      type,
      user.id,
      prompt,
      settings,
      creditsUsed,
      options
    );

    await refreshJobs();
  }, [user?.id, refreshJobs]);

  /**
   * Update job status
   */
  const updateJobStatus = useCallback(async (
    id: string,
    status: GenerationJob['status'],
    result?: any,
    failureReason?: string
  ): Promise<void> => {
    await generationRecoveryService.updateJobStatus(id, status, result, failureReason);
    await refreshJobs();
  }, [refreshJobs]);

  /**
   * Retry a failed job
   */
  const retryJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await generationRecoveryService.retryJob(jobId);
      
      if (success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      await refreshJobs();
      return success;
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    }
  }, [refreshJobs]);

  /**
   * Cancel a job
   */
  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const success = await generationRecoveryService.cancelJob(jobId);
      
      if (success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      await refreshJobs();
      return success;
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    }
  }, [refreshJobs]);

  /**
   * Get job by ID
   */
  const getJob = useCallback((jobId: string): GenerationJob | null => {
    return generationRecoveryService.getJobStatus(jobId);
  }, []);

  /**
   * Clear old failed jobs
   */
  const clearOldFailedJobs = useCallback(async (olderThanDays: number = 7): Promise<number> => {
    const removedCount = await generationRecoveryService.clearOldFailedJobs(olderThanDays);
    await refreshJobs();
    return removedCount;
  }, [refreshJobs]);

  /**
   * Get jobs by status
   */
  const getJobsByStatus = useCallback((status: GenerationJob['status']): GenerationJob[] => {
    return activeJobs.filter(job => job.status === status);
  }, [activeJobs]);

  /**
   * Get jobs by type
   */
  const getJobsByType = useCallback((type: GenerationJob['type']): GenerationJob[] => {
    return activeJobs.filter(job => job.type === type);
  }, [activeJobs]);

  /**
   * Check if user has any active jobs
   */
  const hasActiveJobs = useCallback((): boolean => {
    return activeJobs.some(job => job.status === 'pending' || job.status === 'processing');
  }, [activeJobs]);

  /**
   * Check if user has any failed jobs
   */
  const hasFailedJobs = useCallback((): boolean => {
    return failedJobs.length > 0;
  }, [failedJobs]);

  /**
   * Get total credits that can be recovered
   */
  const getRecoverableCredits = useCallback((): number => {
    return failedJobs.reduce((total, job) => total + (job.creditsUsed || 0), 0);
  }, [failedJobs]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !user?.id) return;

    // Initial load
    refreshJobs();

    // Set up interval
    const interval = setInterval(refreshJobs, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, user?.id, refreshJobs]);

  // Derived state
  const pendingJobs = getJobsByStatus('pending');
  const processingJobs = getJobsByStatus('processing');
  const completedJobs = getJobsByStatus('completed');
  
  const imageJobs = getJobsByType('image');
  const videoJobs = getJobsByType('video');
  const trainingJobs = getJobsByType('training');

  return {
    // Job data
    activeJobs,
    failedJobs,
    pendingJobs,
    processingJobs,
    completedJobs,
    imageJobs,
    videoJobs,
    trainingJobs,

    // Statistics
    stats,
    isLoading,

    // Actions
    registerJob,
    updateJobStatus,
    retryJob,
    cancelJob,
    getJob,
    clearOldFailedJobs,
    refreshJobs,

    // Utilities
    getJobsByStatus,
    getJobsByType,
    hasActiveJobs,
    hasFailedJobs,
    getRecoverableCredits,

    // Computed values
    totalActiveJobs: activeJobs.length,
    totalFailedJobs: failedJobs.length,
    totalPendingJobs: pendingJobs.length,
    totalProcessingJobs: processingJobs.length,
    totalCompletedJobs: completedJobs.length,
  };
}

export default useGenerationRecovery;