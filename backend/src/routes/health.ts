import { Router } from 'express';
import { queues, getQueueStats } from '../queues';
import { logger } from '../config/logger';

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

export default router;