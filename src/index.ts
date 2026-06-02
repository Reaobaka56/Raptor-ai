import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhook';
import apiRoutes from './routes/api';
import authRoutes from './routes/auth';
import { apiRateLimiter, authRateLimiter, globalRateLimiter, webhookRateLimiter } from './middleware/rateLimit';
import { requestLogger } from './utils/logger';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  exposedHeaders: [
    'RateLimit',
    'Retry-After',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
}));

// Rate limiting
app.use(globalRateLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));
app.use(requestLogger);

// Routes
app.use('/webhook', webhookRateLimiter, webhookRoutes);
app.use('/api/auth', authRateLimiter);
app.use('/api', authRoutes);
app.use('/api', apiRateLimiter, apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI Code Review Agent',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      webhook: '/webhook/github',
      api: '/api',
      health: '/api/health',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`AI Code Review Agent running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/github`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
});

export default app;
