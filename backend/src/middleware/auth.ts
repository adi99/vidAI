import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../config/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string | undefined;
    role?: string | undefined;
  };
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      } as any);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Authentication failed', { error: error?.message });
      next({
        statusCode: 401,
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      } as any);
      return;
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email ?? undefined,
      role: (user as any).role ?? (user.app_metadata as any)?.role ?? undefined,
    };

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    next({
      statusCode: 500,
      code: 'AUTH_ERROR',
      message: 'Authentication service error',
    } as any);
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next(); // Continue without authentication
      return;
    }

    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);

    if (user) {
      req.user = {
        id: user.id,
        email: user.email ?? undefined,
        role: (user as any).role ?? (user.app_metadata as any)?.role ?? undefined,
      };
    }

    next();
  } catch (error) {
    logger.warn('Optional auth middleware error, continuing anonymously', { error });
    next(); // Continue without authentication on error
  }
};