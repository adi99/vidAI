import dotenv from 'dotenv';
import app from './app';
import { logger } from './config/logger';
import { shutdownQueues } from './config/redis';
import { workers, closeWorkers } from './queues/workers';
import { queues } from './queues';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', { missingEnvVars });
  process.exit(1);
}

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🧵 Workers started: ${workers.length}`);
});

// Unified graceful shutdown for HTTP + queues
async function gracefulExit(signal: NodeJS.Signals) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    try {
      // close workers and queue events
      await closeWorkers();
      // close queues and redis connections
      await shutdownQueues([
        ...Object.values(queues),
      ] as any);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { err });
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => gracefulExit('SIGTERM'));
process.on('SIGINT', () => gracefulExit('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});