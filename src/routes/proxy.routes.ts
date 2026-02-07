import { Express } from 'express';
import { createServiceProxy } from '../proxy/service-proxy.js';

export function setupProxyRoutes(app: Express) {
  // Auth routes -> User Service (no auth required, handled by auth middleware skip)
  // Express strips /api/auth, proxy receives /login etc. Rewrite to /auth/login
  app.use('/api/auth', createServiceProxy('userService', { '^/': '/auth/' }));

  // User routes -> User Service
  app.use('/api/users', createServiceProxy('userService', { '^/': '/users/' }));

  // Project routes -> Content Service
  app.use('/api/projects', createServiceProxy('contentService', { '^/': '/projects/' }));

  // Task routes -> Content Service
  app.use('/api/tasks', createServiceProxy('contentService', { '^/': '/tasks/' }));

  // Comment routes -> Content Service
  app.use('/api/comments', createServiceProxy('contentService', { '^/': '/comments/' }));

  // Notification routes -> Notification Service
  app.use('/api/notifications', createServiceProxy('notificationService', { '^/': '/notifications/' }));

  // Preferences routes -> Notification Service
  app.use('/api/preferences', createServiceProxy('notificationService', { '^/': '/preferences/' }));

  // Webhook routes -> Notification Service
  app.use('/api/webhooks', createServiceProxy('notificationService', { '^/': '/webhooks/' }));
}
