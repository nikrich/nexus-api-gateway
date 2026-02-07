import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { corsMiddleware } from './middleware/cors.middleware.js';
import { requestLogger } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { healthRouter } from './routes/health.routes.js';
import { setupProxyRoutes } from './routes/proxy.routes.js';
import { openapiSpec } from './docs/openapi.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use(rateLimiter);
  app.use(authMiddleware);

  // API docs (public, no auth)
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'Nexus API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  // Health route (parsed JSON for gateway's own endpoints)
  app.use(healthRouter);

  // Proxy routes - must not have body parsed to allow raw forwarding
  setupProxyRoutes(app);

  // Error handling
  app.use(errorMiddleware);

  return app;
}
