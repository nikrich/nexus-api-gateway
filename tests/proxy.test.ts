import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/server.js';
import { config } from '../src/config.js';
import type { Server } from 'http';

function createToken(payload: { userId: string; email: string; role: string }) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

describe('Proxy routes', () => {
  let mockUserService: Server;
  let mockContentService: Server;
  let mockNotificationService: Server;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    // Override config BEFORE creating the app
    config.services.userService = 'http://127.0.0.1:14001';
    config.services.contentService = 'http://127.0.0.1:14002';
    config.services.notificationService = 'http://127.0.0.1:14003';

    // Start mock user service
    const userApp = express();
    userApp.use(express.json());
    userApp.get('/users', (req, res) => {
      res.json({
        success: true,
        data: {
          items: [],
          userId: req.headers['x-user-id'],
          userEmail: req.headers['x-user-email'],
          userRole: req.headers['x-user-role'],
        },
      });
    });
    userApp.post('/auth/login', (req, res) => {
      res.json({ success: true, data: { token: 'mock-token' } });
    });

    // Start mock content service
    const contentApp = express();
    contentApp.use(express.json());
    contentApp.get('/projects', (req, res) => {
      res.json({
        success: true,
        data: { items: [], requestId: req.headers['x-request-id'] },
      });
    });
    contentApp.get('/tasks/:id', (req, res) => {
      res.json({ success: true, data: { id: req.params.id } });
    });

    // Start mock notification service
    const notifApp = express();
    notifApp.use(express.json());
    notifApp.get('/notifications', (_req, res) => {
      res.json({ success: true, data: { items: [] } });
    });

    // Start all servers
    await new Promise<void>((resolve) => {
      mockUserService = userApp.listen(14001, '127.0.0.1', () => resolve());
    });
    await new Promise<void>((resolve) => {
      mockContentService = contentApp.listen(14002, '127.0.0.1', () => resolve());
    });
    await new Promise<void>((resolve) => {
      mockNotificationService = notifApp.listen(14003, '127.0.0.1', () => resolve());
    });

    // Create app after mock services are up and config is set
    app = createApp();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mockUserService?.close(() => resolve()));
    await new Promise<void>((resolve) => mockContentService?.close(() => resolve()));
    await new Promise<void>((resolve) => mockNotificationService?.close(() => resolve()));
  });

  it('proxies auth routes without authentication', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'pass' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('mock-token');
  });

  it('proxies user routes with auth headers forwarded', async () => {
    const token = createToken({ userId: 'user123', email: 'test@example.com', role: 'admin' });

    const res = await supertest(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe('user123');
    expect(res.body.data.userEmail).toBe('test@example.com');
    expect(res.body.data.userRole).toBe('admin');
  });

  it('proxies project routes to content service', async () => {
    const token = createToken({ userId: 'user1', email: 'u@e.com', role: 'member' });

    const res = await supertest(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('proxies task routes to content service', async () => {
    const token = createToken({ userId: 'user1', email: 'u@e.com', role: 'member' });

    const res = await supertest(app)
      .get('/api/tasks/task-abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('task-abc');
  });

  it('proxies notification routes to notification service', async () => {
    const token = createToken({ userId: 'user1', email: 'u@e.com', role: 'member' });

    const res = await supertest(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('forwards X-Request-Id to downstream services', async () => {
    const token = createToken({ userId: 'user1', email: 'u@e.com', role: 'member' });

    const res = await supertest(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Request-Id', 'custom-req-id');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('custom-req-id');
  });
});
