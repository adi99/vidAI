import { logger } from '../config/logger';
import { supabase } from '../config/database';

export interface ServerErrorReport {
  id: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string | undefined;
  };
  context: {
    endpoint?: string | undefined;
    method?: string | undefined;
    userId?: string | undefined;
    requestId?: string | undefined;
    userAgent?: string | undefined;
    ip?: string | undefined;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'api' | 'database' | 'queue' | 'gpu' | 'auth' | 'system' | 'unknown';
  metadata?: Record<string, any> | undefined;
  resolved?: boolean;
  alertSent?: boolean;
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'log' | 'database';
  config: {
    email?: string;
    webhookUrl?: string;
    logLevel?: string;
  };
  enabled: boolean;
}

export interface ServerAlertRule {
  id: string;
  name: string;
  condition: {
    errorCount?: number;
    timeWindow?: number; // minutes
    errorRate?: number; // percentage
    severity?: 'low' | 'medium' | 'high' | 'critical';
    category?: string;
    endpoint?: string;
  };
  channels: AlertChannel[];
  enabled: boolean;
  cooldown?: number; // minutes between alerts
  lastTriggered?: number;
}

class ServerErrorTrackingService {
  private errors: ServerErrorReport[] = [];
  private alertRules: ServerAlertRule[] = [];
  private readonly MAX_STORED_ERRORS = 10000;
  private readonly ERROR_RETENTION_HOURS = 72; // 3 days
  
  // Default alert rules for production monitoring
  private readonly DEFAULT_ALERT_RULES: ServerAlertRule[] = [
    {
      id: 'critical_errors',
      name: 'Critical System Errors',
      condition: {
        severity: 'critical',
        errorCount: 1,
        timeWindow: 1,
      },
      channels: [
        {
          type: 'log',
          config: { logLevel: 'error' },
          enabled: true,
        },
        {
          type: 'database',
          config: {},
          enabled: true,
        },
      ],
      enabled: true,
      cooldown: 5,
    },
    {
      id: 'high_error_rate',
      name: 'High API Error Rate',
      condition: {
        category: 'api',
        errorRate: 15, // 15% error rate
        timeWindow: 10,
      },
      channels: [
        {
          type: 'log',
          config: { logLevel: 'warn' },
          enabled: true,
        },
      ],
      enabled: true,
      cooldown: 15,
    },
    {
      id: 'database_errors',
      name: 'Database Connection Issues',
      condition: {
        category: 'database',
        errorCount: 5,
        timeWindow: 5,
      },
      channels: [
        {
          type: 'log',
          config: { logLevel: 'error' },
          enabled: true,
        },
      ],
      enabled: true,
      cooldown: 10,
    },
    {
      id: 'gpu_service_failures',
      name: 'GPU Service Failures',
      condition: {
        category: 'gpu',
        errorCount: 3,
        timeWindow: 15,
      },
      channels: [
        {
          type: 'log',
          config: { logLevel: 'error' },
          enabled: true,
        },
      ],
      enabled: true,
      cooldown: 20,
    },
    {
      id: 'queue_processing_errors',
      name: 'Queue Processing Errors',
      condition: {
        category: 'queue',
        errorCount: 10,
        timeWindow: 30,
      },
      channels: [
        {
          type: 'log',
          config: { logLevel: 'warn' },
          enabled: true,
        },
      ],
      enabled: true,
      cooldown: 30,
    },
  ];

  constructor() {
    this.alertRules = [...this.DEFAULT_ALERT_RULES];
    this.startErrorCleanup();
    this.loadAlertRulesFromEnv();
  }

  /**
   * Report a server error
   */
  private sanitizeContext(context: any): ServerErrorReport['context'] {
    return {
      endpoint: context.endpoint || undefined,
      method: context.method || undefined,
      userId: context.userId || undefined,
      requestId: context.requestId || undefined,
      userAgent: context.userAgent || undefined,
      ip: context.ip || undefined,
    };
  }

  async reportError(
    error: Error | string,
    context: Partial<ServerErrorReport['context']> = {},
    severity: ServerErrorReport['severity'] = 'medium',
    category: ServerErrorReport['category'] = 'unknown',
    metadata?: Record<string, any>
  ): Promise<string> {
    const errorObj = typeof error === 'string' 
      ? { name: 'Error', message: error, stack: undefined }
      : { name: error.name, message: error.message, stack: error.stack || undefined };

    const errorReport: ServerErrorReport = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      error: errorObj,
      context: this.sanitizeContext({
        requestId: this.generateRequestId(),
        ...context,
      }),
      severity,
      category,
      metadata: metadata || undefined,
      resolved: false,
      alertSent: false,
    };

    // Store the error
    this.errors.push(errorReport);
    this.trimErrors();

    // Log the error
    logger.error('Server error tracked', {
      errorId: errorReport.id,
      message: errorReport.error.message,
      severity: errorReport.severity,
      category: errorReport.category,
      context: errorReport.context,
      metadata: errorReport.metadata,
    });

    // Check alert rules
    await this.checkAlertRules(errorReport);

    // Store in database for persistence (if configured)
    await this.storeErrorInDatabase(errorReport);

    return errorReport.id;
  }

  /**
   * Report API error
   */
  async reportAPIError(
    endpoint: string,
    method: string,
    statusCode: number,
    error: Error | string,
    context: Partial<ServerErrorReport['context']> = {}
  ): Promise<string> {
    const severity = statusCode >= 500 ? 'high' : 'medium';
    
    return this.reportError(
      error,
      {
        ...context,
        endpoint,
        method,
      },
      severity,
      'api',
      {
        statusCode,
        endpoint,
        method,
      }
    );
  }

  /**
   * Report database error
   */
  async reportDatabaseError(
    operation: string,
    error: Error | string,
    context: Partial<ServerErrorReport['context']> = {}
  ): Promise<string> {
    return this.reportError(
      error,
      context,
      'high',
      'database',
      {
        operation,
      }
    );
  }

  /**
   * Report queue error
   */
  async reportQueueError(
    queueName: string,
    jobId: string,
    error: Error | string,
    context: Partial<ServerErrorReport['context']> = {}
  ): Promise<string> {
    return this.reportError(
      error,
      context,
      'medium',
      'queue',
      {
        queueName,
        jobId,
      }
    );
  }

  /**
   * Report GPU service error
   */
  async reportGPUError(
    service: string,
    operation: string,
    error: Error | string,
    context: Partial<ServerErrorReport['context']> = {}
  ): Promise<string> {
    return this.reportError(
      error,
      context,
      'high',
      'gpu',
      {
        service,
        operation,
      }
    );
  }

  /**
   * Report authentication error
   */
  async reportAuthError(
    action: string,
    error: Error | string,
    context: Partial<ServerErrorReport['context']> = {}
  ): Promise<string> {
    return this.reportError(
      error,
      context,
      'medium',
      'auth',
      {
        authAction: action,
      }
    );
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindow: number = 24 * 60 * 60 * 1000): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    errorsByEndpoint: Record<string, number>;
    errorRate: number;
    topErrors: Array<{ message: string; count: number; category: string }>;
    criticalErrors: number;
    unresolvedErrors: number;
  } {
    const cutoffTime = Date.now() - timeWindow;
    const recentErrors = this.errors.filter(e => e.timestamp > cutoffTime);

    const errorsByCategory = recentErrors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsBySeverity = recentErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsByEndpoint = recentErrors.reduce((acc, error) => {
      if (error.context.endpoint) {
        const key = `${error.context.method || 'UNKNOWN'} ${error.context.endpoint}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate error rate (errors per hour)
    const hoursInWindow = timeWindow / (60 * 60 * 1000);
    const errorRate = recentErrors.length / hoursInWindow;

    // Get top error messages
    const errorCounts = recentErrors.reduce((acc, error) => {
      const key = error.error.message;
      if (!acc[key]) {
        acc[key] = { count: 0, category: error.category };
      }
      acc[key].count++;
      return acc;
    }, {} as Record<string, { count: number; category: string }>);

    const topErrors = Object.entries(errorCounts)
      .map(([message, data]) => ({ message, count: data.count, category: data.category }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const criticalErrors = recentErrors.filter(e => e.severity === 'critical').length;
    const unresolvedErrors = recentErrors.filter(e => !e.resolved).length;

    return {
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      errorsByEndpoint,
      errorRate,
      topErrors,
      criticalErrors,
      unresolvedErrors,
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 100): ServerErrorReport[] {
    return this.errors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: string, limit: number = 100): ServerErrorReport[] {
    return this.errors
      .filter(e => e.category === category)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Mark error as resolved
   */
  markErrorResolved(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      logger.info('Error marked as resolved', { errorId });
      return true;
    }
    return false;
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: Omit<ServerAlertRule, 'id'>): string {
    const alertRule: ServerAlertRule = {
      ...rule,
      id: this.generateErrorId(),
    };
    
    this.alertRules.push(alertRule);
    logger.info('Alert rule added', { ruleId: alertRule.id, ruleName: alertRule.name });
    return alertRule.id;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(id: string, updates: Partial<ServerAlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === id);
    if (ruleIndex !== -1) {
      this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
      logger.info('Alert rule updated', { ruleId: id });
      return true;
    }
    return false;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): ServerAlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: {
      errorRate: number;
      criticalErrors: number;
      unresolvedErrors: number;
      activeAlerts: number;
    };
  } {
    const stats = this.getErrorStats(60 * 60 * 1000); // Last hour
    const activeAlerts = this.alertRules.filter(r => 
      r.enabled && r.lastTriggered && (Date.now() - r.lastTriggered) < (60 * 60 * 1000)
    ).length;

    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for critical issues
    if (stats.criticalErrors > 0) {
      issues.push(`${stats.criticalErrors} critical errors in the last hour`);
      status = 'unhealthy';
    }

    if (stats.errorRate > 50) {
      issues.push(`High error rate: ${stats.errorRate.toFixed(1)} errors/hour`);
      status = status === 'healthy' ? 'degraded' : status;
    }

    if (stats.unresolvedErrors > 100) {
      issues.push(`${stats.unresolvedErrors} unresolved errors`);
      status = status === 'healthy' ? 'degraded' : status;
    }

    if (activeAlerts > 5) {
      issues.push(`${activeAlerts} active alerts`);
      status = status === 'healthy' ? 'degraded' : status;
    }

    return {
      status,
      issues,
      metrics: {
        errorRate: stats.errorRate,
        criticalErrors: stats.criticalErrors,
        unresolvedErrors: stats.unresolvedErrors,
        activeAlerts,
      },
    };
  }

  /**
   * Check alert rules and trigger alerts
   */
  private async checkAlertRules(errorReport: ServerErrorReport): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.cooldown && rule.lastTriggered) {
        const cooldownEnd = rule.lastTriggered + (rule.cooldown * 60 * 1000);
        if (Date.now() < cooldownEnd) continue;
      }

      const shouldTrigger = await this.evaluateAlertRule(rule, errorReport);
      
      if (shouldTrigger) {
        await this.triggerAlert(rule, errorReport);
        rule.lastTriggered = Date.now();
      }
    }
  }

  /**
   * Evaluate if an alert rule should trigger
   */
  private async evaluateAlertRule(rule: ServerAlertRule, errorReport: ServerErrorReport): Promise<boolean> {
    const { condition } = rule;
    
    // Check severity
    if (condition.severity && errorReport.severity !== condition.severity) {
      return false;
    }
    
    // Check category
    if (condition.category && errorReport.category !== condition.category) {
      return false;
    }
    
    // Check endpoint
    if (condition.endpoint && errorReport.context.endpoint !== condition.endpoint) {
      return false;
    }
    
    // Check error count in time window
    if (condition.errorCount && condition.timeWindow) {
      const windowStart = Date.now() - (condition.timeWindow * 60 * 1000);
      const recentErrors = this.errors.filter(e => 
        e.timestamp > windowStart &&
        (!condition.severity || e.severity === condition.severity) &&
        (!condition.category || e.category === condition.category) &&
        (!condition.endpoint || e.context.endpoint === condition.endpoint)
      );
      
      if (recentErrors.length < condition.errorCount) {
        return false;
      }
    }
    
    // Check error rate
    if (condition.errorRate && condition.timeWindow) {
      const windowStart = Date.now() - (condition.timeWindow * 60 * 1000);
      const recentErrors = this.errors.filter(e => e.timestamp > windowStart);
      // Estimate total requests (this would be better tracked separately)
      const estimatedRequests = recentErrors.length * 10; // Rough estimate
      const errorRate = (recentErrors.length / estimatedRequests) * 100;
      
      if (errorRate < condition.errorRate) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Trigger alert through configured channels
   */
  private async triggerAlert(rule: ServerAlertRule, errorReport: ServerErrorReport): Promise<void> {
    logger.warn('Alert triggered', {
      ruleName: rule.name,
      errorId: errorReport.id,
      errorMessage: errorReport.error.message,
      severity: errorReport.severity,
      category: errorReport.category,
    });

    for (const channel of rule.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendAlert(channel, rule, errorReport);
      } catch (error) {
        logger.error('Failed to send alert', {
          channelType: channel.type,
          ruleName: rule.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    errorReport.alertSent = true;
  }

  /**
   * Send alert through specific channel
   */
  private async sendAlert(
    channel: AlertChannel,
    rule: ServerAlertRule,
    errorReport: ServerErrorReport
  ): Promise<void> {
    switch (channel.type) {
      case 'log':
        const logLevel = channel.config.logLevel || 'error';
        logger.log(logLevel as any, `ALERT: ${rule.name}`, {
          errorId: errorReport.id,
          message: errorReport.error.message,
          severity: errorReport.severity,
          category: errorReport.category,
          context: errorReport.context,
        });
        break;

      case 'webhook':
        if (channel.config.webhookUrl) {
          await this.sendWebhookAlert(channel.config.webhookUrl, rule, errorReport);
        }
        break;

      case 'email':
        if (channel.config.email) {
          await this.sendEmailAlert(channel.config.email, rule, errorReport);
        }
        break;

      case 'database':
        await this.storeAlertInDatabase(rule, errorReport);
        break;
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(
    webhookUrl: string,
    rule: ServerAlertRule,
    errorReport: ServerErrorReport
  ): Promise<void> {
    const payload = {
      alert: rule.name,
      error: {
        id: errorReport.id,
        message: errorReport.error.message,
        severity: errorReport.severity,
        category: errorReport.category,
        timestamp: errorReport.timestamp,
      },
      context: errorReport.context,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status}`);
    }
  }

  /**
   * Send email alert (placeholder - would integrate with email service)
   */
  private async sendEmailAlert(
    email: string,
    rule: ServerAlertRule,
    errorReport: ServerErrorReport
  ): Promise<void> {
    // This would integrate with an email service like SendGrid, AWS SES, etc.
    logger.info('Email alert would be sent', {
      to: email,
      alert: rule.name,
      errorId: errorReport.id,
    });
  }

  /**
   * Store error in database
   */
  private async storeErrorInDatabase(errorReport: ServerErrorReport): Promise<void> {
    try {
      const { error } = await supabase
        .from('error_logs')
        .insert({
          id: errorReport.id,
          timestamp: new Date(errorReport.timestamp).toISOString(),
          error_name: errorReport.error.name,
          error_message: errorReport.error.message,
          error_stack: errorReport.error.stack,
          context: errorReport.context,
          severity: errorReport.severity,
          category: errorReport.category,
          metadata: errorReport.metadata,
          resolved: errorReport.resolved,
        });

      if (error) {
        logger.error('Failed to store error in database', { error });
      }
    } catch (error) {
      logger.error('Database error while storing error log', { error });
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlertInDatabase(
    rule: ServerAlertRule,
    errorReport: ServerErrorReport
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('alert_logs')
        .insert({
          id: this.generateErrorId(),
          timestamp: new Date().toISOString(),
          rule_name: rule.name,
          rule_id: rule.id,
          error_id: errorReport.id,
          triggered_by: errorReport.error.message,
          severity: errorReport.severity,
          category: errorReport.category,
        });

      if (error) {
        logger.error('Failed to store alert in database', { error });
      }
    } catch (error) {
      logger.error('Database error while storing alert log', { error });
    }
  }

  /**
   * Load alert rules from environment variables
   */
  private loadAlertRulesFromEnv(): void {
    // Load webhook URLs from environment
    const webhookUrl = process.env.ERROR_WEBHOOK_URL;
    const alertEmail = process.env.ERROR_ALERT_EMAIL;

    if (webhookUrl || alertEmail) {
      // Add webhook/email channels to critical error rule
      const criticalRule = this.alertRules.find(r => r.id === 'critical_errors');
      if (criticalRule) {
        if (webhookUrl) {
          criticalRule.channels.push({
            type: 'webhook',
            config: { webhookUrl },
            enabled: true,
          });
        }
        if (alertEmail) {
          criticalRule.channels.push({
            type: 'email',
            config: { email: alertEmail },
            enabled: true,
          });
        }
      }
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Start periodic error cleanup
   */
  private startErrorCleanup(): void {
    // Clean up old errors every hour
    setInterval(() => {
      this.cleanupOldErrors();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up old errors
   */
  private cleanupOldErrors(): void {
    const cutoffTime = Date.now() - (this.ERROR_RETENTION_HOURS * 60 * 60 * 1000);
    const beforeCount = this.errors.length;
    
    this.errors = this.errors.filter(e => e.timestamp > cutoffTime);
    
    const removedCount = beforeCount - this.errors.length;
    if (removedCount > 0) {
      logger.info('Cleaned up old errors', { removedCount, remainingCount: this.errors.length });
    }
  }

  /**
   * Trim errors array to prevent memory issues
   */
  private trimErrors(): void {
    if (this.errors.length > this.MAX_STORED_ERRORS) {
      this.errors = this.errors
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.MAX_STORED_ERRORS / 2);
    }
  }

  /**
   * Clear all errors (for testing)
   */
  clearErrors(): void {
    this.errors = [];
    logger.info('All errors cleared');
  }

  /**
   * Export errors for analysis
   */
  exportErrors() {
    return {
      errors: [...this.errors],
      stats: this.getErrorStats(),
      health: this.getSystemHealth(),
    };
  }
}

export const serverErrorTrackingService = new ServerErrorTrackingService();
export default serverErrorTrackingService;