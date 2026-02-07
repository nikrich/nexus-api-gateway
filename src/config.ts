export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwtSecret: process.env.NEXUS_JWT_SECRET || 'nexus-dev-secret-change-in-production',
  serviceToken: process.env.NEXUS_SERVICE_TOKEN || 'nexus-internal-service-token',

  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    contentService: process.env.CONTENT_SERVICE_URL || 'http://localhost:3002',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
  },

  rateLimit: {
    defaultMaxRequests: parseInt(process.env.RATE_LIMIT_DEFAULT || '100', 10),
    defaultWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    authMaxRequests: parseInt(process.env.RATE_LIMIT_AUTH || '10', 10),
    authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '60000', 10),
  },

  cors: {
    allowedOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  },
};
