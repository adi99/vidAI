import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import route handlers
import authRoutes from './routes/auth';
import generationRoutes from './routes/generation';
import trainingRoutes from './routes/training';
import socialRoutes from './routes/social';
import userRoutes from './routes/user';
import subscriptionRoutes from './routes/subscription';
import notificationRoutes from './routes/notifications';
import moderationRoutes from './routes/moderation';
import healthRoutes from './routes/health';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-app-domain.com'] // Replace with actual domain
    : ['http://localhost:3000', 'http://localhost:19006'], // Expo dev server
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    code: 'RATE_LIMITED',
    message: 'Too many requests from this IP, please try again later',
    timestamp: new Date().toISOString(),
  },
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/generate', generationRoutes);
app.use('/api/train', trainingRoutes);
app.use('/api/feed', socialRoutes);
app.use('/api/user', userRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/moderation', moderationRoutes);

// Queue health routes
app.use('/health', healthRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;