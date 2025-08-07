import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// GET /api/auth/profile - Get user profile with credits
router.get('/profile', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user profile', { userId, error });
      res.status(500).json({
        code: 'PROFILE_FETCH_ERROR',
        message: 'Failed to fetch user profile',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      profile,
      timestamp: new Date().toISOString(),
    });
    return;
  } catch (error) {
    logger.error('Profile endpoint error', { error });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
    return;
  }
});

// POST /api/auth/refresh - Refresh JWT tokens
router.post('/refresh', async (_req, res) => {
  // This will be implemented when we add refresh token logic
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: 'Token refresh not yet implemented',
    timestamp: new Date().toISOString(),
  });
});

// POST /api/auth/logout - Logout user
router.post('/logout', authenticateUser, async (_req, res) => {
  // This will be implemented when we add logout logic
  res.status(501).json({
    code: 'NOT_IMPLEMENTED',
    message: 'Logout not yet implemented',
    timestamp: new Date().toISOString(),
  });
});

export default router;