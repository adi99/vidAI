import AsyncStorage from '@react-native-async-storage/async-storage';
import errorHandlingService, { ERROR_CODES, APIError } from './errorHandlingService';
import networkService from './networkService';
import * as Haptics from 'expo-haptics';

export interface GenerationJob {
  id: string;
  type: 'image' | 'video' | 'training';
  userId: string;
  prompt: string;
  settings: any;
  creditsUsed: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  maxRetries: number;
  failureReason?: string;
  result?: any;
}

export interface RecoveryOptions {
  refundCredits?: boolean;
  autoRetry?: boolean;
  notifyUser?: boolean;
  maxRetries?: number;
}

class GenerationRecoveryService {
  private readonly JOBS_STORAGE_KEY = 'generation_jobs';
  private readonly FAILED_JOBS_KEY = 'failed_generation_jobs';
  private readonly MAX_FAILED_JOBS = 50;
  private jobs = new Map<string, GenerationJob>();
  private failedJobs: GenerationJob[] = [];
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    await this.loadJobs();
    await this.loadFailedJobs();
    this.startPeriodicCleanup();
  }

  /**
   * Register a new generation job
   */
  async registerJob(
    id: string,
    type: GenerationJob['type'],
    userId: string,
    prompt: string,
    settings: any,
    creditsUsed: number,
    options: RecoveryOptions = {}
  ): Promise<void> {
    const job: GenerationJob = {
      id,
      type,
      userId,
      prompt,
      settings,
      creditsUsed,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
    };

    this.jobs.set(id, job);
    await this.saveJobs();
    
    console.log(`Registered ${type} generation job: ${id}`);
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    id: string,
    status: GenerationJob['status'],
    result?: any,
    failureReason?: string
  ): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      console.warn(`Job not found: ${id}`);
      return;
    }

    job.status = status;
    job.updatedAt = Date.now();
    
    if (result) {
      job.result = result;
    }
    
    if (failureReason) {
      job.failureReason = failureReason;
    }

    // Handle different status updates
    switch (status) {
      case 'completed':
        await this.handleJobCompletion(job);
        break;
      case 'failed':
        await this.handleJobFailure(job);
        break;
      case 'cancelled':
        await this.handleJobCancellation(job);
        break;
    }

    await this.saveJobs();
  }

  /**
   * Handle job completion
   */
  private async handleJobCompletion(job: GenerationJob): Promise<void> {
    console.log(`Generation job completed: ${job.id}`);
    
    // Remove from active jobs after a delay (keep for a while for reference)
    setTimeout(() => {
      this.jobs.delete(job.id);
      this.saveJobs();
    }, 5 * 60 * 1000); // 5 minutes

    // Success haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  /**
   * Handle job failure with recovery options
   */
  private async handleJobFailure(job: GenerationJob): Promise<void> {
    console.log(`Generation job failed: ${job.id}, reason: ${job.failureReason}`);

    // Add to failed jobs list
    this.failedJobs.unshift(job);
    if (this.failedJobs.length > this.MAX_FAILED_JOBS) {
      this.failedJobs = this.failedJobs.slice(0, this.MAX_FAILED_JOBS);
    }
    await this.saveFailedJobs();

    // Determine if we should retry
    const shouldRetry = this.shouldRetryJob(job);
    
    if (shouldRetry) {
      await this.scheduleRetry(job);
    } else {
      // Final failure - handle recovery
      await this.handleFinalFailure(job);
    }

    // Error haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  /**
   * Handle job cancellation
   */
  private async handleJobCancellation(job: GenerationJob): Promise<void> {
    console.log(`Generation job cancelled: ${job.id}`);
    
    // Refund credits for cancelled jobs
    await this.refundCredits(job);
    
    // Remove from active jobs
    this.jobs.delete(job.id);
    await this.saveJobs();
  }

  /**
   * Determine if job should be retried
   */
  private shouldRetryJob(job: GenerationJob): boolean {
    // Don't retry if max retries reached
    if (job.retryCount >= job.maxRetries) {
      return false;
    }

    // Don't retry certain types of failures
    const nonRetryableReasons = [
      'insufficient_credits',
      'invalid_prompt',
      'content_policy_violation',
      'user_cancelled',
    ];

    if (job.failureReason && nonRetryableReasons.includes(job.failureReason)) {
      return false;
    }

    return true;
  }

  /**
   * Schedule automatic retry
   */
  private async scheduleRetry(job: GenerationJob): Promise<void> {
    // Calculate retry delay with exponential backoff
    const baseDelay = 30000; // 30 seconds
    const maxDelay = 300000; // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, job.retryCount), maxDelay);

    console.log(`Scheduling retry for job ${job.id} in ${delay}ms (attempt ${job.retryCount + 1})`);

    // Clear any existing timeout
    const existingTimeout = this.retryTimeouts.get(job.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule retry
    const timeout = setTimeout(async () => {
      await this.retryJob(job.id);
      this.retryTimeouts.delete(job.id);
    }, delay);

    this.retryTimeouts.set(job.id, timeout as any);
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.warn(`Cannot retry job - not found: ${jobId}`);
      return false;
    }

    if (job.status !== 'failed') {
      console.warn(`Cannot retry job - not in failed state: ${jobId}`);
      return false;
    }

    job.retryCount++;
    job.status = 'pending';
    job.updatedAt = Date.now();
    job.failureReason = undefined;

    await this.saveJobs();

    console.log(`Retrying generation job: ${jobId} (attempt ${job.retryCount})`);

    try {
      // Attempt to restart the generation
      await this.restartGeneration(job);
      return true;
    } catch (error) {
      console.error(`Failed to retry job ${jobId}:`, error);
      await this.updateJobStatus(jobId, 'failed', undefined, 'retry_failed');
      return false;
    }
  }

  /**
   * Restart generation for a job
   */
  private async restartGeneration(job: GenerationJob): Promise<void> {
    // This would integrate with your actual generation services
    // For now, we'll simulate the restart
    
    const endpoint = this.getGenerationEndpoint(job.type);
    const payload = {
      prompt: job.prompt,
      settings: job.settings,
      retry: true,
      originalJobId: job.id,
    };

    try {
      const response = await networkService.post(endpoint, payload, {
        timeout: 60000, // 1 minute timeout
        retries: 0, // Don't retry at network level, we handle it here
      });

      // Update job status to processing
      await this.updateJobStatus(job.id, 'processing');
      
      console.log(`Successfully restarted generation for job: ${job.id}`);
    } catch (error) {
      throw errorHandlingService.parseError(error);
    }
  }

  /**
   * Handle final failure after all retries exhausted
   */
  private async handleFinalFailure(job: GenerationJob): Promise<void> {
    console.log(`Final failure for job: ${job.id}`);

    // Refund credits
    await this.refundCredits(job);

    // Send failure notification
    await this.sendFailureNotification(job);

    // Remove from active jobs
    this.jobs.delete(job.id);
    await this.saveJobs();
  }

  /**
   * Refund credits for failed generation
   */
  private async refundCredits(job: GenerationJob): Promise<void> {
    if (job.creditsUsed <= 0) {
      return;
    }

    try {
      // This would integrate with your credit service
      console.log(`Refunding ${job.creditsUsed} credits for failed job: ${job.id}`);
      
      // In a real implementation:
      // await creditService.refundCredits(job.userId, job.creditsUsed, `Refund for failed ${job.type} generation`);
      
    } catch (error) {
      console.error(`Failed to refund credits for job ${job.id}:`, error);
    }
  }

  /**
   * Send failure notification to user
   */
  private async sendFailureNotification(job: GenerationJob): Promise<void> {
    try {
      // This would integrate with your notification service
      console.log(`Sending failure notification for job: ${job.id}`);
      
      // In a real implementation:
      // await notificationService.sendNotification(job.userId, {
      //   title: `${job.type} Generation Failed`,
      //   body: `Your ${job.type} generation could not be completed. Credits have been refunded.`,
      //   data: { jobId: job.id, type: 'generation_failed' }
      // });
      
    } catch (error) {
      console.error(`Failed to send failure notification for job ${job.id}:`, error);
    }
  }

  /**
   * Get generation endpoint for job type
   */
  private getGenerationEndpoint(type: GenerationJob['type']): string {
    switch (type) {
      case 'image':
        return '/api/generate/image';
      case 'video':
        return '/api/generate/video';
      case 'training':
        return '/api/train/start';
      default:
        throw new Error(`Unknown generation type: ${type}`);
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Clear retry timeout if exists
    const timeout = this.retryTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(jobId);
    }

    // Update status
    await this.updateJobStatus(jobId, 'cancelled');
    
    return true;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): GenerationJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all active jobs for a user
   */
  getUserJobs(userId: string): GenerationJob[] {
    return Array.from(this.jobs.values()).filter(job => job.userId === userId);
  }

  /**
   * Get failed jobs for a user
   */
  getUserFailedJobs(userId: string): GenerationJob[] {
    return this.failedJobs.filter(job => job.userId === userId);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    activeJobs: number;
    failedJobs: number;
    pendingRetries: number;
    totalCreditsRefunded: number;
  } {
    const activeJobs = this.jobs.size;
    const failedJobs = this.failedJobs.length;
    const pendingRetries = this.retryTimeouts.size;
    const totalCreditsRefunded = this.failedJobs.reduce(
      (total, job) => total + (job.creditsUsed || 0),
      0
    );

    return {
      activeJobs,
      failedJobs,
      pendingRetries,
      totalCreditsRefunded,
    };
  }

  /**
   * Clear old failed jobs
   */
  async clearOldFailedJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const initialCount = this.failedJobs.length;
    
    this.failedJobs = this.failedJobs.filter(job => job.updatedAt > cutoffTime);
    
    await this.saveFailedJobs();
    
    const removedCount = initialCount - this.failedJobs.length;
    console.log(`Cleared ${removedCount} old failed jobs`);
    
    return removedCount;
  }

  /**
   * Save jobs to storage
   */
  private async saveJobs(): Promise<void> {
    try {
      const jobsArray = Array.from(this.jobs.values());
      await AsyncStorage.setItem(this.JOBS_STORAGE_KEY, JSON.stringify(jobsArray));
    } catch (error) {
      console.error('Failed to save jobs:', error);
    }
  }

  /**
   * Load jobs from storage
   */
  private async loadJobs(): Promise<void> {
    try {
      const jobsData = await AsyncStorage.getItem(this.JOBS_STORAGE_KEY);
      if (jobsData) {
        const jobsArray: GenerationJob[] = JSON.parse(jobsData);
        this.jobs.clear();
        jobsArray.forEach(job => this.jobs.set(job.id, job));
        console.log(`Loaded ${jobsArray.length} generation jobs`);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  }

  /**
   * Save failed jobs to storage
   */
  private async saveFailedJobs(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.FAILED_JOBS_KEY, JSON.stringify(this.failedJobs));
    } catch (error) {
      console.error('Failed to save failed jobs:', error);
    }
  }

  /**
   * Load failed jobs from storage
   */
  private async loadFailedJobs(): Promise<void> {
    try {
      const failedJobsData = await AsyncStorage.getItem(this.FAILED_JOBS_KEY);
      if (failedJobsData) {
        this.failedJobs = JSON.parse(failedJobsData);
        console.log(`Loaded ${this.failedJobs.length} failed jobs`);
      }
    } catch (error) {
      console.error('Failed to load failed jobs:', error);
    }
  }

  /**
   * Start periodic cleanup of old jobs
   */
  private startPeriodicCleanup(): void {
    // Clean up every hour
    setInterval(() => {
      this.cleanupOldJobs();
      this.clearOldFailedJobs();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up old completed jobs
   */
  private async cleanupOldJobs(): Promise<void> {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    let removedCount = 0;

    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' && job.updatedAt < cutoffTime) {
        this.jobs.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await this.saveJobs();
      console.log(`Cleaned up ${removedCount} old completed jobs`);
    }
  }
}

export const generationRecoveryService = new GenerationRecoveryService();
export default generationRecoveryService;