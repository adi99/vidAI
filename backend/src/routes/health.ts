import { Router } from 'express';
import { queues, getQueueStats } from '../queues';
import { logger } from '../config/logger';
import { backendPerformanceMonitoringService } from '../services/performanceMonitoringService';
import { healthCheckPerformance } from '../middleware/performanceTracking';
import { serverErrorTrackingService } from '../services/errorTrackingService';

const router = Router();

// GET /health/queues - summary for all queues
router.get('/queues', async (_req, res) => {
  try {
    const names = Object.keys(queues);
    const stats = await Promise.all(names.map((n) => getQueueStats(n)));
    res.json({
      status: 'ok',
      queues: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health queues error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch queues health',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/queues/:name - detail for a queue
router.get('/queues/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const stats = await getQueueStats(name);
    if (!stats) {
      res.status(404).json({
        status: 'not_found',
        message: `Queue ${name} not found`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      status: 'ok',
      queue: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health queue detail error', { name, err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch queue detail',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/performance - comprehensive performance metrics
router.get('/performance', async (_req, res) => {
  try {
    const stats = await backendPerformanceMonitoringService.getPerformanceStats();
    res.json({
      status: 'ok',
      performance: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health performance error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch performance metrics',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/generation-success - generation success rates
router.get('/generation-success', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const successRates = await backendPerformanceMonitoringService.getGenerationSuccessRates(hours);
    
    res.json({
      status: 'ok',
      success_rates: successRates,
      period_hours: hours,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health generation success error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch generation success rates',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/api-performance - API performance trends
router.get('/api-performance', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const trends = backendPerformanceMonitoringService.getAPIPerformanceTrends(hours);
    
    res.json({
      status: 'ok',
      trends,
      period_hours: hours,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health API performance error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch API performance trends',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/system - comprehensive system health check
router.get('/system', async (_req, res) => {
  try {
    const healthCheck = await healthCheckPerformance();
    const performanceStats = await backendPerformanceMonitoringService.getPerformanceStats();
    
    res.json({
      status: healthCheck.status,
      checks: healthCheck.checks,
      performance_summary: {
        api_response_time: performanceStats.api.averageResponseTime,
        api_success_rate: performanceStats.api.successRate,
        generation_success_rates: performanceStats.generation.successRates,
        active_alerts: performanceStats.alerts.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health system check error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform system health check',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/alerts - current performance alerts
router.get('/alerts', async (_req, res) => {
  try {
    const stats = await backendPerformanceMonitoringService.getPerformanceStats();
    
    res.json({
      status: 'ok',
      alerts: stats.alerts,
      alert_count: stats.alerts.length,
      critical_alerts: stats.alerts.filter(a => a.type === 'critical').length,
      warning_alerts: stats.alerts.filter(a => a.type === 'warning').length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health alerts error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch performance alerts',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/errors - error tracking statistics
router.get('/errors', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const timeWindow = hours * 60 * 60 * 1000;
    
    const errorStats = serverErrorTrackingService.getErrorStats(timeWindow);
    const recentErrors = serverErrorTrackingService.getRecentErrors(50);
    const systemHealth = serverErrorTrackingService.getSystemHealth();
    
    res.json({
      status: 'ok',
      error_stats: errorStats,
      recent_errors: recentErrors,
      system_health: systemHealth,
      period_hours: hours,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health errors error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch error statistics',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/errors/:category - errors by category
router.get('/errors/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const errors = serverErrorTrackingService.getErrorsByCategory(category, limit);
    
    res.json({
      status: 'ok',
      category,
      errors,
      count: errors.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health errors by category error', { category: req.params.category, err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch errors by category',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /health/errors/:id/resolve - mark error as resolved
router.post('/errors/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = serverErrorTrackingService.markErrorResolved(id);
    
    if (resolved) {
      res.json({
        status: 'ok',
        message: 'Error marked as resolved',
        error_id: id,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(404).json({
        status: 'not_found',
        message: 'Error not found',
        error_id: id,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    logger.error('Health resolve error error', { errorId: req.params.id, err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to resolve error',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /health/errors/export - export all error data
router.get('/errors/export', async (_req, res) => {
  try {
    const exportData = serverErrorTrackingService.exportErrors();
    
    res.json({
      status: 'ok',
      export_data: exportData,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health export errors error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to export error data',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /health/errors - clear all errors (admin only)
router.delete('/errors', async (_req, res) => {
  try {
    serverErrorTrackingService.clearErrors();
    
    res.json({
      status: 'ok',
      message: 'All errors cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Health clear errors error', { err });
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear errors',
      error: err?.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;