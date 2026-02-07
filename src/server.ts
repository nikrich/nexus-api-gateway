import express from 'express';
import { corsMiddleware } from './middleware/cors.middleware.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { healthRouter } from './routes/health.routes.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use(express.json());

  // Routes
  app.use(healthRouter);

  // Error handling
  app.use(errorMiddleware);

  return app;
}
