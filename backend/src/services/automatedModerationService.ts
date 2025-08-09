import { supabaseAdmin } from '../config/database';

export interface ContentAnalysisResult {
  isAppropriate: boolean;
  confidence: number;
  categories: {
    adult: number;
    violence: number;
    hate: number;
    harassment: number;
    selfHarm: number;
  };
  flags: string[];
  requiresReview: boolean;
}

export interface ModerationAction {
  action: 'approve' | 'flag' | 'block' | 'review';
  reason: string;
  confidence: number;
  autoApproved: boolean;
}

/**
 * Automated content moderation service for generated images and videos
 */
class AutomatedModerationService {
  private readonly CONFIDENCE_THRESHOLDS = {
    HIGH: 0.8,
    MEDIUM: 0.6,
    LOW: 0.4
  };

  private readonly CATEGORY_THRESHOLDS = {
    adult: 0.7,
    violence: 0.6,
    hate: 0.8,
    harassment: 0.7,
    selfHarm: 0.9
  };

  /**
   * Analyze generated image content for inappropriate material
   */
  async analyzeImageContent(imageUrl: string, userId: string): Promise<ContentAnalysisResult> {
    try {
      // In a real implementation, this would call external services like:
      // - Google Cloud Vision API
      // - AWS Rekognition
      // - Azure Computer Vision
      // - OpenAI Moderation API
      
      // For now, we'll simulate the analysis based on the image URL and user context
      const mockAnalysis = await this.simulateContentAnalysis(imageUrl, 'image');
      
      // Log the analysis for monitoring
      await this.logModerationEvent({
        contentType: 'image',
        contentUrl: imageUrl,
        userId,
        analysisResult: mockAnalysis,
        timestamp: new Date()
      });

      return mockAnalysis;
    } catch (error) {
      console.error('Image content analysis failed:', error);
      
      // Return conservative result on error
      return {
        isAppropriate: false,
        confidence: 0.5,
        categories: {
          adult: 0.5,
          violence: 0.5,
          hate: 0.5,
          harassment: 0.5,
          selfHarm: 0.5
        },
        flags: ['analysis_failed'],
        requiresReview: true
      };
    }
  }

  /**
   * Analyze generated video content for inappropriate material
   */
  async analyzeVideoContent(videoUrl: string, userId: string): Promise<ContentAnalysisResult> {
    try {
      // Video analysis would typically involve:
      // - Frame extraction and analysis
      // - Audio analysis for inappropriate content
      // - Motion analysis for violent content
      // - Text overlay detection and analysis
      
      const mockAnalysis = await this.simulateContentAnalysis(videoUrl, 'video');
      
      await this.logModerationEvent({
        contentType: 'video',
        contentUrl: videoUrl,
        userId,
        analysisResult: mockAnalysis,
        timestamp: new Date()
      });

      return mockAnalysis;
    } catch (error) {
      console.error('Video content analysis failed:', error);
      
      return {
        isAppropriate: false,
        confidence: 0.5,
        categories: {
          adult: 0.5,
          violence: 0.5,
          hate: 0.5,
          harassment: 0.5,
          selfHarm: 0.5
        },
        flags: ['analysis_failed'],
        requiresReview: true
      };
    }
  }

  /**
   * Determine moderation action based on analysis results
   */
  determineModerationAction(analysis: ContentAnalysisResult, userTrustScore: number = 0.5): ModerationAction {
    const { isAppropriate, confidence, categories, flags } = analysis;

    // Check for high-confidence inappropriate content
    if (!isAppropriate && confidence >= this.CONFIDENCE_THRESHOLDS.HIGH) {
      return {
        action: 'block',
        reason: `High confidence inappropriate content detected: ${flags.join(', ')}`,
        confidence,
        autoApproved: false
      };
    }

    // Check individual category thresholds
    for (const [category, score] of Object.entries(categories)) {
      const threshold = this.CATEGORY_THRESHOLDS[category as keyof typeof this.CATEGORY_THRESHOLDS];
      if (score >= threshold) {
        return {
          action: 'block',
          reason: `${category} content threshold exceeded (${score.toFixed(2)})`,
          confidence: score,
          autoApproved: false
        };
      }
    }

    // Medium confidence inappropriate content - flag for review
    if (!isAppropriate && confidence >= this.CONFIDENCE_THRESHOLDS.MEDIUM) {
      return {
        action: 'review',
        reason: `Medium confidence inappropriate content: ${flags.join(', ')}`,
        confidence,
        autoApproved: false
      };
    }

    // Low confidence or analysis failed - consider user trust score
    if (!isAppropriate && confidence >= this.CONFIDENCE_THRESHOLDS.LOW) {
      if (userTrustScore < 0.3) {
        return {
          action: 'review',
          reason: 'Low user trust score with flagged content',
          confidence,
          autoApproved: false
        };
      } else {
        return {
          action: 'flag',
          reason: 'Low confidence inappropriate content flagged',
          confidence,
          autoApproved: true
        };
      }
    }

    // Content appears appropriate
    return {
      action: 'approve',
      reason: 'Content passed automated moderation',
      confidence,
      autoApproved: true
    };
  }

  /**
   * Process moderation for generated content
   */
  async moderateGeneratedContent(
    contentId: string,
    contentType: 'image' | 'video',
    contentUrl: string,
    userId: string
  ): Promise<ModerationAction> {
    try {
      // Get user trust score
      const userTrustScore = await this.getUserTrustScore(userId);

      // Analyze content
      const analysis = contentType === 'image' 
        ? await this.analyzeImageContent(contentUrl, userId)
        : await this.analyzeVideoContent(contentUrl, userId);

      // Determine action
      const action = this.determineModerationAction(analysis, userTrustScore);

      // Update content status in database
      await this.updateContentModerationStatus(contentId, contentType, action, analysis);

      // Handle specific actions
      await this.handleModerationAction(contentId, contentType, action, userId);

      return action;
    } catch (error) {
      console.error('Content moderation failed:', error);
      
      // Default to review on error
      const errorAction: ModerationAction = {
        action: 'review',
        reason: 'Moderation system error',
        confidence: 0,
        autoApproved: false
      };

      await this.updateContentModerationStatus(contentId, contentType, errorAction, null);
      return errorAction;
    }
  }

  /**
   * Simulate content analysis (replace with real API calls)
   */
  private async simulateContentAnalysis(contentUrl: string, _contentType: string): Promise<ContentAnalysisResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock analysis based on URL patterns (for testing)
    // const _isTestContent = contentUrl.includes('test') || contentUrl.includes('mock');
    const hasInappropriateKeywords = ['nude', 'violence', 'hate'].some(keyword => 
      contentUrl.toLowerCase().includes(keyword)
    );

    if (hasInappropriateKeywords) {
      return {
        isAppropriate: false,
        confidence: 0.9,
        categories: {
          adult: contentUrl.includes('nude') ? 0.8 : 0.1,
          violence: contentUrl.includes('violence') ? 0.7 : 0.1,
          hate: contentUrl.includes('hate') ? 0.9 : 0.1,
          harassment: 0.2,
          selfHarm: 0.1
        },
        flags: ['inappropriate_content_detected'],
        requiresReview: true
      };
    }

    // Default to appropriate content
    return {
      isAppropriate: true,
      confidence: 0.8,
      categories: {
        adult: 0.1,
        violence: 0.1,
        hate: 0.05,
        harassment: 0.05,
        selfHarm: 0.02
      },
      flags: [],
      requiresReview: false
    };
  }

  /**
   * Get user trust score based on history
   */
  private async getUserTrustScore(userId: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('created_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return 0.5; // Default trust score
      }

      // Calculate trust score based on account age and other factors
      const accountAge = Date.now() - new Date(data.created_at).getTime();
      const daysOld = accountAge / (1000 * 60 * 60 * 24);
      
      // New accounts have lower trust scores
      if (daysOld < 1) return 0.2;
      if (daysOld < 7) return 0.4;
      if (daysOld < 30) return 0.6;
      
      return 0.8; // Established account
    } catch (error) {
      console.error('Failed to get user trust score:', error);
      return 0.5;
    }
  }

  /**
   * Update content moderation status in database
   */
  private async updateContentModerationStatus(
    contentId: string,
    contentType: 'image' | 'video',
    action: ModerationAction,
    analysis: ContentAnalysisResult | null
  ): Promise<void> {
    try {
      const tableName = contentType === 'image' ? 'images' : 'videos';
      
      await supabaseAdmin
        .from(tableName)
        .update({
          moderation_status: action.action,
          moderation_reason: action.reason,
          moderation_confidence: action.confidence,
          moderation_analysis: analysis,
          moderated_at: new Date().toISOString(),
          is_public: action.action === 'approve' || action.action === 'flag'
        })
        .eq('id', contentId);
    } catch (error) {
      console.error('Failed to update moderation status:', error);
    }
  }

  /**
   * Handle specific moderation actions
   */
  private async handleModerationAction(
    contentId: string,
    contentType: 'image' | 'video',
    action: ModerationAction,
    userId: string
  ): Promise<void> {
    switch (action.action) {
      case 'block':
        await this.blockContent(contentId, contentType, userId, action.reason);
        break;
      case 'review':
        await this.queueForReview(contentId, contentType, userId, action.reason);
        break;
      case 'flag':
        await this.flagContent(contentId, contentType, userId, action.reason);
        break;
      case 'approve':
        await this.approveContent(contentId, contentType, userId);
        break;
    }
  }

  /**
   * Block inappropriate content
   */
  private async blockContent(contentId: string, contentType: string, userId: string, reason: string): Promise<void> {
    try {
      // Log the blocking action
      console.log(`Blocked ${contentType} ${contentId} for user ${userId}: ${reason}`);
      
      // In a real implementation, you might:
      // - Send notification to user
      // - Remove from public feeds
      // - Update user violation count
      // - Trigger additional security measures
      
      // Create moderation log entry
      await supabaseAdmin
        .from('moderation_logs')
        .insert({
          content_id: contentId,
          content_type: contentType,
          user_id: userId,
          action: 'block',
          reason,
          automated: true,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to block content:', error);
    }
  }

  /**
   * Queue content for manual review
   */
  private async queueForReview(contentId: string, contentType: string, userId: string, reason: string): Promise<void> {
    try {
      console.log(`Queued ${contentType} ${contentId} for review: ${reason}`);
      
      // Create review queue entry
      await supabaseAdmin
        .from('review_queue')
        .insert({
          content_id: contentId,
          content_type: contentType,
          user_id: userId,
          reason,
          priority: 'medium',
          status: 'pending',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to queue for review:', error);
    }
  }

  /**
   * Flag content for monitoring
   */
  private async flagContent(contentId: string, contentType: string, userId: string, reason: string): Promise<void> {
    try {
      console.log(`Flagged ${contentType} ${contentId}: ${reason}`);
      
      // Create flag entry
      await supabaseAdmin
        .from('content_flags')
        .insert({
          content_id: contentId,
          content_type: contentType,
          user_id: userId,
          flag_type: 'automated',
          reason,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to flag content:', error);
    }
  }

  /**
   * Approve content
   */
  private async approveContent(contentId: string, contentType: string, userId: string): Promise<void> {
    try {
      console.log(`Approved ${contentType} ${contentId} for user ${userId}`);
      
      // Log approval
      await supabaseAdmin
        .from('moderation_logs')
        .insert({
          content_id: contentId,
          content_type: contentType,
          user_id: userId,
          action: 'approve',
          reason: 'Passed automated moderation',
          automated: true,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log content approval:', error);
    }
  }

  /**
   * Log moderation events for monitoring
   */
  private async logModerationEvent(event: {
    contentType: string;
    contentUrl: string;
    userId: string;
    analysisResult: ContentAnalysisResult;
    timestamp: Date;
  }): Promise<void> {
    try {
      console.log('Moderation Event:', {
        contentType: event.contentType,
        userId: event.userId,
        isAppropriate: event.analysisResult.isAppropriate,
        confidence: event.analysisResult.confidence,
        flags: event.analysisResult.flags,
        timestamp: event.timestamp.toISOString()
      });

      // In a real implementation, you might send this to:
      // - Analytics service
      // - Monitoring dashboard
      // - Alert system for high-risk content
    } catch (error) {
      console.error('Failed to log moderation event:', error);
    }
  }

  /**
   * Get moderation statistics for monitoring
   */
  async getModerationStats(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    try {
      const timeframeDuration = {
        hour: 1,
        day: 24,
        week: 168
      };

      const hoursAgo = timeframeDuration[timeframe];
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      const { data: stats, error } = await supabaseAdmin
        .from('moderation_logs')
        .select('action, automated, created_at')
        .gte('created_at', since);

      if (error) throw error;

      const totalActions = stats?.length || 0;
      const automatedActions = stats?.filter(s => s.automated).length || 0;
      const actionCounts = stats?.reduce((acc: any, stat: any) => {
        acc[stat.action] = (acc[stat.action] || 0) + 1;
        return acc;
      }, {}) || {};

      return {
        timeframe,
        totalActions,
        automatedActions,
        manualActions: totalActions - automatedActions,
        actionBreakdown: actionCounts,
        automationRate: totalActions > 0 ? (automatedActions / totalActions) : 0
      };
    } catch (error) {
      console.error('Failed to get moderation stats:', error);
      return null;
    }
  }
}

export const automatedModerationService = new AutomatedModerationService();