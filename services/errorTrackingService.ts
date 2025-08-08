import analyticsService from './analyticsService';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorReport {
  id: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    screen?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
    appVersion?: string;
    platform?: string;
    networkStatus?: 'online' | 'offline';
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'generation' | 'auth' | 'ui' | 'system' | 'unknown';
  metadata?: Record<string, any>;
  resolved?: boolean;
  reportedToUser?: boolean;
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  affectedUsers: Set<string>;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    errorCount?: number;
    timeWindow?: number; // minutes
    errorRate?: number; // percentage
    severity?: 'low' | 'medium' | 'high' | 'critical';
    category?: string;
    pattern?: string;
  };
  actions: {
    showUserAlert?: boolean;
    logToConsole?: boolean;
    sendToAnalytics?: boolean;
    storeLocally?: boolean;
  };
  enabled: boolean;
}

class ErrorTrackingService {
  private errors: ErrorReport[] = [];
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private alertRules: AlertRule[] = [];
  private readonly MAX_STORED_ERRORS = 1000;
  private readonly ERROR_RETENTION_DAYS = 7;
  
  // Default alert rules
  private readonly DEFAULT_ALERT_RULES: AlertRule[] = [
    {
      id: 'critical_errors',
      name: 'Critical Errors',
      condition: {
        severity: 'critical',
        errorCount: 1,
        timeWindow: 1,
      },
      actions: {
        showUserAlert: true,
        logToConsole: true,
        sendToAnalytics: true,
        storeLocally: true,
      },
      enabled: true,
    },
    {
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: {
        errorRate: 10, // 10% error rate
        timeWindow: 5,
      },
      actions: {
        logToConsole: true,
        sendToAnalytics: true,
        storeLocally: true,
      },
      enabled: true,
    },
    {
      id: 'generation_failures',
      name: 'Generation Failures',
      condition: {
        category: 'generation',
        errorCount: 3,
        timeWindow: 10,
      },
      actions: {
        showUserAlert: true,
        logToConsole: true,
        sendToAnalytics: true,
        storeLocally: true,
      },
      enabled: true,
    },
    {
      id: 'network_errors',
      name: 'Network Errors',
      condition: {
        category: 'network',
        errorCount: 5,
        timeWindow: 5,
      },
      actions: {
        logToConsole: true,
        sendToAnalytics: true,
        storeLocally: true,
      },
      enabled: true,
    },
    {
      id: 'auth_failures',
      name: 'Authentication Failures',
      condition: {
        category: 'auth',
        errorCount: 3,
        timeWindow: 15,
      },
      actions: {
        showUserAlert: true,
        logToConsole: true,
        sendToAnalytics: true,
        storeLocally: true,
      },
      enabled: true,
    },
  ];

  constructor() {
    this.alertRules = [...this.DEFAULT_ALERT_RULES];
    this.loadStoredErrors();
    this.startErrorCleanup();
  }

  /**
   * Report an error to the tracking system
   */
  async reportError(
    error: Error | string,
    context: Partial<ErrorReport['context']> = {},
    severity: ErrorReport['severity'] = 'medium',
    category: ErrorReport['category'] = 'unknown',
    metadata?: Record<string, any>
  ): Promise<string> {
    const errorObj = typeof error === 'string' 
      ? { name: 'Error', message: error }
      : { name: error.name, message: error.message, stack: error.stack };

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      error: errorObj,
      context: {
        appVersion: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
        platform: require('react-native').Platform.OS,
        sessionId: await this.getSessionId(),
        ...context,
      },
      severity,
      category,
      metadata,
      resolved: false,
      reportedToUser: false,
    };

    // Store the error
    this.errors.push(errorReport);
    this.trimErrors();

    // Update error patterns
    this.updateErrorPatterns(errorReport);

    // Check alert rules
    await this.checkAlertRules(errorReport);

    // Log to console in development
    if (__DEV__) {
      console.error('Error tracked:', {
        id: errorReport.id,
        message: errorReport.error.message,
        severity: errorReport.severity,
        category: errorReport.category,
        context: errorReport.context,
      });
    }

    return errorReport.id;
  }

  /**
   * Report a network error
   */
  async reportNetworkError(
    url: string,
    method: string,
    statusCode: number,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {}
  ): Promise<string> {
    return this.reportError(
      error,
      {
        ...context,
        action: `${method} ${url}`,
      },
      statusCode >= 500 ? 'high' : 'medium',
      'network',
      {
        url,
        method,
        statusCode,
        networkStatus: context.networkStatus || 'online',
      }
    );
  }

  /**
   * Report a generation error
   */
  async reportGenerationError(
    type: 'image' | 'video' | 'training',
    model: string,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {},
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.reportError(
      error,
      {
        ...context,
        action: `${type}_generation`,
      },
      'high',
      'generation',
      {
        generationType: type,
        model,
        ...metadata,
      }
    );
  }

  /**
   * Report an authentication error
   */
  async reportAuthError(
    action: string,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {}
  ): Promise<string> {
    return this.reportError(
      error,
      {
        ...context,
        action: `auth_${action}`,
      },
      'high',
      'auth',
      {
        authAction: action,
      }
    );
  }

  /**
   * Report a UI error
   */
  async reportUIError(
    component: string,
    error: Error | string,
    context: Partial<ErrorReport['context']> = {}
  ): Promise<string> {
    return this.reportError(
      error,
      {
        ...context,
        action: `ui_${component}`,
      },
      'low',
      'ui',
      {
        component,
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
    errorRate: number;
    topErrors: Array<{ message: string; count: number; category: string }>;
    affectedUsers: number;
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

    // Count affected users
    const affectedUsers = new Set(
      recentErrors
        .map(e => e.context.userId)
        .filter(Boolean)
    ).size;

    return {
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      errorRate,
      topErrors,
      affectedUsers,
    };
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values())
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): ErrorReport[] {
    return this.errors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: string, limit: number = 50): ErrorReport[] {
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
      this.saveErrors();
      return true;
    }
    return false;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateErrorId(),
    };
    
    this.alertRules.push(alertRule);
    return alertRule.id;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === id);
    if (ruleIndex !== -1) {
      this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
      return true;
    }
    return false;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(id: string): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === id);
    if (ruleIndex !== -1) {
      this.alertRules.splice(ruleIndex, 1);
      return true;
    }
    return false;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Clear all errors (for testing)
   */
  clearErrors(): void {
    this.errors = [];
    this.errorPatterns.clear();
    this.saveErrors();
  }

  /**
   * Export errors for analysis
   */
  exportErrors() {
    return {
      errors: [...this.errors],
      patterns: this.getErrorPatterns(),
      stats: this.getErrorStats(),
    };
  }

  /**
   * Update error patterns for pattern recognition
   */
  private updateErrorPatterns(errorReport: ErrorReport): void {
    const pattern = this.extractErrorPattern(errorReport);
    
    if (this.errorPatterns.has(pattern)) {
      const existing = this.errorPatterns.get(pattern)!;
      existing.count++;
      existing.lastSeen = errorReport.timestamp;
      if (errorReport.context.userId) {
        existing.affectedUsers.add(errorReport.context.userId);
      }
    } else {
      this.errorPatterns.set(pattern, {
        pattern,
        count: 1,
        firstSeen: errorReport.timestamp,
        lastSeen: errorReport.timestamp,
        affectedUsers: new Set(errorReport.context.userId ? [errorReport.context.userId] : []),
        category: errorReport.category,
        severity: errorReport.severity,
      });
    }
  }

  /**
   * Extract a pattern from an error for grouping
   */
  private extractErrorPattern(errorReport: ErrorReport): string {
    // Create a pattern based on error message, category, and context
    const messageParts = errorReport.error.message.split(' ').slice(0, 5); // First 5 words
    const pattern = [
      errorReport.category,
      errorReport.error.name,
      ...messageParts,
    ].join('|').toLowerCase();
    
    return pattern;
  }

  /**
   * Check alert rules and trigger actions
   */
  private async checkAlertRules(errorReport: ErrorReport): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const shouldTrigger = await this.evaluateAlertRule(rule, errorReport);
      
      if (shouldTrigger) {
        await this.triggerAlert(rule, errorReport);
      }
    }
  }

  /**
   * Evaluate if an alert rule should trigger
   */
  private async evaluateAlertRule(rule: AlertRule, errorReport: ErrorReport): Promise<boolean> {
    const { condition } = rule;
    
    // Check severity
    if (condition.severity && errorReport.severity !== condition.severity) {
      return false;
    }
    
    // Check category
    if (condition.category && errorReport.category !== condition.category) {
      return false;
    }
    
    // Check pattern
    if (condition.pattern) {
      const pattern = this.extractErrorPattern(errorReport);
      if (!pattern.includes(condition.pattern.toLowerCase())) {
        return false;
      }
    }
    
    // Check error count in time window
    if (condition.errorCount && condition.timeWindow) {
      const windowStart = Date.now() - (condition.timeWindow * 60 * 1000);
      const recentErrors = this.errors.filter(e => 
        e.timestamp > windowStart &&
        (!condition.severity || e.severity === condition.severity) &&
        (!condition.category || e.category === condition.category)
      );
      
      if (recentErrors.length < condition.errorCount) {
        return false;
      }
    }
    
    // Check error rate
    if (condition.errorRate && condition.timeWindow) {
      const windowStart = Date.now() - (condition.timeWindow * 60 * 1000);
      const recentErrors = this.errors.filter(e => e.timestamp > windowStart);
      const totalActions = recentErrors.length + 100; // Assume some successful actions
      const errorRate = (recentErrors.length / totalActions) * 100;
      
      if (errorRate < condition.errorRate) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Trigger alert actions
   */
  private async triggerAlert(rule: AlertRule, errorReport: ErrorReport): Promise<void> {
    const { actions } = rule;
    
    if (actions.logToConsole) {
      console.error(`Alert triggered: ${rule.name}`, {
        rule: rule.name,
        error: errorReport.error.message,
        severity: errorReport.severity,
        category: errorReport.category,
      });
    }
    
    if (actions.sendToAnalytics) {
      await analyticsService.trackError(
        errorReport.error.message,
        'error_alert_triggered',
        {
          alert_rule: rule.name,
          error_id: errorReport.id,
          error_severity: errorReport.severity,
          error_category: errorReport.category,
        }
      );
    }
    
    if (actions.storeLocally) {
      await this.saveErrors();
    }
    
    if (actions.showUserAlert && !errorReport.reportedToUser) {
      this.showUserAlert(rule, errorReport);
      errorReport.reportedToUser = true;
    }
  }

  /**
   * Show alert to user
   */
  private showUserAlert(rule: AlertRule, errorReport: ErrorReport): void {
    let title = 'Error Detected';
    let message = 'An error occurred. Please try again.';
    
    switch (errorReport.category) {
      case 'network':
        title = 'Connection Issue';
        message = 'Please check your internet connection and try again.';
        break;
      case 'generation':
        title = 'Generation Failed';
        message = 'Failed to generate content. Please try again or contact support if the issue persists.';
        break;
      case 'auth':
        title = 'Authentication Error';
        message = 'Please log in again to continue.';
        break;
      case 'system':
        if (errorReport.severity === 'critical') {
          title = 'Critical Error';
          message = 'A critical error occurred. The app may need to restart.';
        }
        break;
    }
    
    Alert.alert(
      title,
      message,
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Report Issue',
          style: 'default',
          onPress: () => this.reportIssueToSupport(errorReport),
        },
      ]
    );
  }

  /**
   * Report issue to support (placeholder)
   */
  private reportIssueToSupport(errorReport: ErrorReport): void {
    // This would typically open a support form or send an email
    console.log('Reporting issue to support:', errorReport.id);
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get session ID
   */
  private async getSessionId(): Promise<string> {
    try {
      let sessionId = await AsyncStorage.getItem('error_tracking_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        await AsyncStorage.setItem('error_tracking_session_id', sessionId);
      }
      return sessionId;
    } catch {
      return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
  }

  /**
   * Load stored errors from AsyncStorage
   */
  private async loadStoredErrors(): Promise<void> {
    try {
      const storedErrors = await AsyncStorage.getItem('error_tracking_errors');
      if (storedErrors) {
        const parsed = JSON.parse(storedErrors);
        this.errors = parsed.errors || [];
        
        // Reconstruct error patterns
        if (parsed.patterns) {
          this.errorPatterns = new Map(
            parsed.patterns.map((p: any) => [
              p.pattern,
              { ...p, affectedUsers: new Set(p.affectedUsers) }
            ])
          );
        }
      }
    } catch (error) {
      console.error('Failed to load stored errors:', error);
    }
  }

  /**
   * Save errors to AsyncStorage
   */
  private async saveErrors(): Promise<void> {
    try {
      const data = {
        errors: this.errors,
        patterns: Array.from(this.errorPatterns.entries()).map(([pattern, data]) => ({
          ...data,
          affectedUsers: Array.from(data.affectedUsers),
        })),
      };
      
      await AsyncStorage.setItem('error_tracking_errors', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save errors:', error);
    }
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
    const cutoffTime = Date.now() - (this.ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    this.errors = this.errors.filter(e => e.timestamp > cutoffTime);
    
    // Clean up old patterns
    for (const [pattern, data] of this.errorPatterns.entries()) {
      if (data.lastSeen < cutoffTime) {
        this.errorPatterns.delete(pattern);
      }
    }
    
    this.saveErrors();
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
}

export const errorTrackingService = new ErrorTrackingService();
export default errorTrackingService;