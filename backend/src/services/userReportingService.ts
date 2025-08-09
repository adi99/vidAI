import { supabaseAdmin } from '../config/database';
// import { automatedModerationService } from './automatedModerationService';

export interface ReportData {
  contentId: string;
  contentType: 'image' | 'video';
  reporterId: string;
  contentOwnerId: string;
  reason: string;
  description: string;
  category?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface ReportAnalysis {
  reportId: string;
  isValid: boolean;
  confidence: number;
  similarReports: number;
  reporterTrustScore: number;
  contentRiskScore: number;
  recommendedAction: 'dismiss' | 'investigate' | 'immediate_action';
  reasoning: string[];
}

export interface ReportStats {
  totalReports: number;
  reportsByReason: Record<string, number>;
  reportsBySeverity: Record<string, number>;
  reportsByStatus: Record<string, number>;
  averageResolutionTime: number;
  reporterStats: {
    uniqueReporters: number;
    repeatReporters: number;
    topReporters: Array<{ userId: string; reportCount: number }>;
  };
}

/**
 * Comprehensive user reporting system
 */
class UserReportingService {
  private readonly SEVERITY_KEYWORDS = {
    critical: ['suicide', 'self-harm', 'terrorism', 'child', 'minor', 'illegal'],
    high: ['violence', 'hate', 'harassment', 'threat', 'doxxing', 'revenge'],
    medium: ['spam', 'inappropriate', 'misleading', 'copyright'],
    low: ['other', 'quality', 'duplicate']
  };

  private readonly REASON_PRIORITIES = {
    'self_harm': 'critical',
    'violence': 'high',
    'hate_speech': 'high',
    'harassment': 'high',
    'inappropriate': 'medium',
    'spam': 'medium',
    'copyright': 'medium',
    'other': 'low'
  };

  /**
   * Submit a content report
   */
  async submitReport(reportData: ReportData): Promise<{ reportId: string; analysis: ReportAnalysis }> {
    try {
      // Validate content exists
      const content = await this.validateContent(reportData.contentId, reportData.contentType);
      if (!content) {
        throw new Error('Content not found');
      }

      // Check for duplicate reports
      const existingReport = await this.checkDuplicateReport(
        reportData.contentId,
        reportData.contentType,
        reportData.reporterId
      );

      if (existingReport) {
        throw new Error('You have already reported this content');
      }

      // Determine severity
      const severity = this.determineSeverity(reportData.reason, reportData.description);

      // Create report record
      const { data: report, error } = await supabaseAdmin
        .from('content_flags')
        .insert({
          content_id: reportData.contentId,
          content_type: reportData.contentType,
          user_id: reportData.contentOwnerId,
          flagger_id: reportData.reporterId,
          flag_type: 'user_report',
          reason: `${reportData.reason}: ${reportData.description}`,
          status: 'active',
          metadata: {
            ...reportData.metadata,
            severity,
            category: reportData.category,
            originalReason: reportData.reason
          }
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create report: ${error.message}`);
      }

      // Analyze the report
      const analysis = await this.analyzeReport(report.id, reportData);

      // Add to review queue based on analysis
      await this.queueForReview(report.id, reportData, analysis);

      // Update reporter statistics
      await this.updateReporterStats(reportData.reporterId, severity);

      // Check if immediate action is needed
      if (analysis.recommendedAction === 'immediate_action') {
        await this.triggerImmediateAction(reportData, analysis);
      }

      return {
        reportId: report.id,
        analysis
      };
    } catch (error: any) {
      console.error('Failed to submit report:', error);
      throw error;
    }
  }

  /**
   * Analyze a report for validity and priority
   */
  async analyzeReport(reportId: string, reportData: ReportData): Promise<ReportAnalysis> {
    try {
      // Get reporter trust score
      const reporterTrustScore = await this.getReporterTrustScore(reportData.reporterId);

      // Count similar reports for this content
      const similarReports = await this.countSimilarReports(
        reportData.contentId,
        reportData.contentType,
        reportData.reason
      );

      // Calculate content risk score
      const contentRiskScore = await this.calculateContentRiskScore(
        reportData.contentId,
        reportData.contentType
      );

      // Determine if report is valid
      const isValid = this.validateReport(reportData, reporterTrustScore, similarReports);

      // Calculate confidence
      const confidence = this.calculateReportConfidence(
        reporterTrustScore,
        similarReports,
        contentRiskScore,
        reportData.severity
      );

      // Determine recommended action
      const recommendedAction = this.determineRecommendedAction(
        reportData.severity,
        confidence,
        similarReports,
        contentRiskScore
      );

      // Generate reasoning
      const reasoning = this.generateReportReasoning(
        reporterTrustScore,
        similarReports,
        contentRiskScore,
        reportData.severity,
        confidence
      );

      return {
        reportId,
        isValid,
        confidence,
        similarReports,
        reporterTrustScore,
        contentRiskScore,
        recommendedAction,
        reasoning
      };
    } catch (error) {
      console.error('Report analysis failed:', error);
      
      // Return conservative analysis on error
      return {
        reportId,
        isValid: true,
        confidence: 0.5,
        similarReports: 0,
        reporterTrustScore: 0.5,
        contentRiskScore: 0.5,
        recommendedAction: 'investigate',
        reasoning: ['Analysis failed, manual review required']
      };
    }
  }

  /**
   * Get reports for a specific user (their reports or reports against their content)
   */
  async getUserReports(
    userId: string,
    type: 'submitted' | 'received' | 'all' = 'all',
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    try {
      let query = supabaseAdmin
        .from('content_flags')
        .select(`
          id,
          content_id,
          content_type,
          user_id,
          flagger_id,
          flag_type,
          reason,
          status,
          metadata,
          created_at,
          resolved_at
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type === 'submitted') {
        query = query.eq('flagger_id', userId);
      } else if (type === 'received') {
        query = query.eq('user_id', userId);
      } else {
        query = query.or(`flagger_id.eq.${userId},user_id.eq.${userId}`);
      }

      const { data: reports, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch reports: ${error.message}`);
      }

      return reports || [];
    } catch (error) {
      console.error('Failed to get user reports:', error);
      return [];
    }
  }

  /**
   * Get reporting statistics
   */
  async getReportingStats(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<ReportStats> {
    try {
      const timeframeDuration = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };

      const since = new Date(Date.now() - timeframeDuration[timeframe]).toISOString();

      const { data: reports, error } = await supabaseAdmin
        .from('content_flags')
        .select('*')
        .gte('created_at', since);

      if (error) {
        throw new Error(`Failed to fetch report stats: ${error.message}`);
      }

      const totalReports = reports?.length || 0;
      
      // Aggregate statistics
      const reportsByReason: Record<string, number> = {};
      const reportsBySeverity: Record<string, number> = {};
      const reportsByStatus: Record<string, number> = {};
      const reporterCounts: Record<string, number> = {};
      let totalResolutionTime = 0;
      let resolvedCount = 0;

      for (const report of reports || []) {
        // Count by reason
        const reason = report.metadata?.originalReason || 'unknown';
        reportsByReason[reason] = (reportsByReason[reason] || 0) + 1;

        // Count by severity
        const severity = report.metadata?.severity || 'unknown';
        reportsBySeverity[severity] = (reportsBySeverity[severity] || 0) + 1;

        // Count by status
        reportsByStatus[report.status] = (reportsByStatus[report.status] || 0) + 1;

        // Count reporters
        if (report.flagger_id) {
          reporterCounts[report.flagger_id] = (reporterCounts[report.flagger_id] || 0) + 1;
        }

        // Calculate resolution time
        if (report.resolved_at) {
          const resolutionTime = new Date(report.resolved_at).getTime() - new Date(report.created_at).getTime();
          totalResolutionTime += resolutionTime;
          resolvedCount++;
        }
      }

      const uniqueReporters = Object.keys(reporterCounts).length;
      const repeatReporters = Object.values(reporterCounts).filter(count => count > 1).length;
      const topReporters = Object.entries(reporterCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, reportCount]) => ({ userId, reportCount }));

      return {
        totalReports,
        reportsByReason,
        reportsBySeverity,
        reportsByStatus,
        averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
        reporterStats: {
          uniqueReporters,
          repeatReporters,
          topReporters
        }
      };
    } catch (error) {
      console.error('Failed to get reporting stats:', error);
      throw error;
    }
  }

  /**
   * Resolve a report
   */
  async resolveReport(
    reportId: string,
    moderatorId: string,
    action: 'dismiss' | 'uphold' | 'escalate',
    notes?: string
  ): Promise<void> {
    try {
      const status = action === 'dismiss' ? 'dismissed' : 'resolved';
      
      await supabaseAdmin
        .from('content_flags')
        .update({
          status,
          resolved_by: moderatorId,
          resolved_at: new Date().toISOString(),
          metadata: JSON.stringify({ resolution: { action, notes, moderatorId } })
        })
        .eq('id', reportId);

      console.log(`Report ${reportId} resolved with action: ${action}`);
    } catch (error) {
      console.error('Failed to resolve report:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async validateContent(contentId: string, contentType: string): Promise<any> {
    const tableName = contentType === 'image' ? 'images' : 'videos';
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('id, user_id')
      .eq('id', contentId)
      .single();

    return error ? null : data;
  }

  private async checkDuplicateReport(
    contentId: string,
    contentType: string,
    reporterId: string
  ): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('content_flags')
      .select('id')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('flagger_id', reporterId)
      .eq('status', 'active')
      .single();

    return !!data;
  }

  private determineSeverity(reason: string, description: string): 'low' | 'medium' | 'high' | 'critical' {
    const text = `${reason} ${description}`.toLowerCase();
    
    for (const [severity, keywords] of Object.entries(this.SEVERITY_KEYWORDS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return severity as any;
      }
    }

    return this.REASON_PRIORITIES[reason as keyof typeof this.REASON_PRIORITIES] as any || 'medium';
  }

  private async getReporterTrustScore(reporterId: string): Promise<number> {
    try {
      // Get reporter's history
      const { data: reports } = await supabaseAdmin
        .from('content_flags')
        .select('status, created_at')
        .eq('flagger_id', reporterId);

      if (!reports || reports.length === 0) {
        return 0.5; // Neutral score for new reporters
      }

      const totalReports = reports.length;
      const validReports = reports.filter(r => r.status === 'resolved').length;
      const dismissedReports = reports.filter(r => r.status === 'dismissed').length;

      // Calculate trust score based on report accuracy
      const accuracy = totalReports > 0 ? validReports / totalReports : 0.5;
      const dismissalRate = totalReports > 0 ? dismissedReports / totalReports : 0;

      // Adjust for volume (too many reports might indicate spam)
      const volumePenalty = totalReports > 50 ? 0.1 : 0;

      return Math.max(0, Math.min(1, accuracy - dismissalRate - volumePenalty));
    } catch (error) {
      console.error('Failed to get reporter trust score:', error);
      return 0.5;
    }
  }

  private async countSimilarReports(
    contentId: string,
    contentType: string,
    reason: string
  ): Promise<number> {
    const { data } = await supabaseAdmin
      .from('content_flags')
      .select('id')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .ilike('reason', `%${reason}%`)
      .eq('status', 'active');

    return data?.length || 0;
  }

  private async calculateContentRiskScore(contentId: string, contentType: string): Promise<number> {
    try {
      // Get content's moderation history
      const tableName = contentType === 'image' ? 'images' : 'videos';
      const { data: content } = await supabaseAdmin
        .from(tableName)
        .select('moderation_status, moderation_confidence, created_at')
        .eq('id', contentId)
        .single();

      if (!content) return 0.5;

      let riskScore = 0.1; // Base risk

      // Increase risk based on moderation status
      if (content.moderation_status === 'flag') riskScore += 0.3;
      if (content.moderation_status === 'review') riskScore += 0.5;
      if (content.moderation_status === 'block') riskScore += 0.8;

      // Increase risk based on moderation confidence
      if (content.moderation_confidence) {
        riskScore += (1 - content.moderation_confidence) * 0.2;
      }

      // Count existing reports
      const { data: existingReports } = await supabaseAdmin
        .from('content_flags')
        .select('id')
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      const reportCount = existingReports?.length || 0;
      riskScore += Math.min(0.4, reportCount * 0.1);

      return Math.min(1, riskScore);
    } catch (error) {
      console.error('Failed to calculate content risk score:', error);
      return 0.5;
    }
  }

  private validateReport(
    reportData: ReportData,
    reporterTrustScore: number,
    similarReports: number
  ): boolean {
    // Basic validation rules
    if (reporterTrustScore < 0.2) return false; // Very low trust reporter
    if (reportData.description.length < 10) return false; // Too short description
    if (similarReports > 10) return false; // Likely spam if too many similar reports

    return true;
  }

  private calculateReportConfidence(
    reporterTrustScore: number,
    similarReports: number,
    contentRiskScore: number,
    severity: string
  ): number {
    let confidence = 0.5; // Base confidence

    // Adjust for reporter trust
    confidence += (reporterTrustScore - 0.5) * 0.3;

    // Adjust for similar reports
    confidence += Math.min(0.3, similarReports * 0.05);

    // Adjust for content risk
    confidence += contentRiskScore * 0.2;

    // Adjust for severity
    const severityMultiplier = {
      low: 0.8,
      medium: 1.0,
      high: 1.2,
      critical: 1.5
    };
    confidence *= severityMultiplier[severity as keyof typeof severityMultiplier] || 1.0;

    return Math.max(0, Math.min(1, confidence));
  }

  private determineRecommendedAction(
    severity: string,
    confidence: number,
    similarReports: number,
    contentRiskScore: number
  ): 'dismiss' | 'investigate' | 'immediate_action' {
    // Immediate action for critical severity with high confidence
    if (severity === 'critical' && confidence > 0.7) {
      return 'immediate_action';
    }

    // Immediate action for high-risk content with multiple reports
    if (contentRiskScore > 0.7 && similarReports > 3) {
      return 'immediate_action';
    }

    // Dismiss low-confidence reports
    if (confidence < 0.3) {
      return 'dismiss';
    }

    // Default to investigation
    return 'investigate';
  }

  private generateReportReasoning(
    reporterTrustScore: number,
    similarReports: number,
    contentRiskScore: number,
    severity: string,
    confidence: number
  ): string[] {
    const reasoning: string[] = [];

    if (reporterTrustScore > 0.7) {
      reasoning.push('Reporter has high trust score based on previous accurate reports');
    } else if (reporterTrustScore < 0.3) {
      reasoning.push('Reporter has low trust score, previous reports often dismissed');
    }

    if (similarReports > 3) {
      reasoning.push(`${similarReports} similar reports received for this content`);
    }

    if (contentRiskScore > 0.6) {
      reasoning.push('Content has high risk score based on moderation history');
    }

    if (severity === 'critical') {
      reasoning.push('Report marked as critical severity requiring immediate attention');
    }

    if (confidence > 0.8) {
      reasoning.push('High confidence in report validity');
    } else if (confidence < 0.4) {
      reasoning.push('Low confidence in report validity');
    }

    return reasoning;
  }

  private async queueForReview(
    reportId: string,
    reportData: ReportData,
    analysis: ReportAnalysis
  ): Promise<void> {
    const priority = this.determinePriority(reportData.severity, analysis.confidence, analysis.similarReports);

    await supabaseAdmin
      .from('review_queue')
      .insert({
        content_id: reportData.contentId,
        content_type: reportData.contentType,
        user_id: reportData.contentOwnerId,
        reason: `User report: ${reportData.reason}`,
        priority,
        status: 'pending',
        metadata: {
          reportId,
          analysis,
          reportData: {
            reason: reportData.reason,
            description: reportData.description,
            reporterId: reportData.reporterId
          }
        }
      });
  }

  private determinePriority(
    severity: string,
    confidence: number,
    similarReports: number
  ): 'low' | 'medium' | 'high' | 'urgent' {
    if (severity === 'critical' || (confidence > 0.8 && similarReports > 5)) {
      return 'urgent';
    }
    if (severity === 'high' || (confidence > 0.6 && similarReports > 2)) {
      return 'high';
    }
    if (severity === 'medium' || confidence > 0.5) {
      return 'medium';
    }
    return 'low';
  }

  private async updateReporterStats(reporterId: string, severity: string): Promise<void> {
    try {
      // This could be expanded to track detailed reporter statistics
      console.log(`Updated stats for reporter ${reporterId}, severity: ${severity}`);
    } catch (error) {
      console.error('Failed to update reporter stats:', error);
    }
  }

  private async triggerImmediateAction(reportData: ReportData, _analysis: ReportAnalysis): Promise<void> {
    try {
      // Immediately hide content pending review
      const tableName = reportData.contentType === 'image' ? 'images' : 'videos';
      await supabaseAdmin
        .from(tableName)
        .update({
          is_public: false,
          moderation_status: 'review',
          moderation_reason: 'Urgent user report requiring immediate action'
        })
        .eq('id', reportData.contentId);

      console.log(`Immediate action taken for content ${reportData.contentId}: hidden from public view`);
    } catch (error) {
      console.error('Failed to trigger immediate action:', error);
    }
  }
}

export const userReportingService = new UserReportingService();