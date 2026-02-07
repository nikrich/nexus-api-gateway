import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/server.js';
import { config } from '../src/config.js';
import { clearBuckets } from '../src/middleware/rate-limiter.js';
import { resetCircuits } from '../src/proxy/service-proxy.js';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// ─── Configuration ──────────────────────────────────────────────────────────────

const JWT_SECRET = config.jwtSecret;

// ─── Mock Data Types ────────────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface MockProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface MockTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId?: string;
  createdBy: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface MockComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface MockNotification {
  id: string;
  userId: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  metadata: Record<string, string>;
  read: boolean;
  createdAt: string;
}

// ─── Mock User Service ──────────────────────────────────────────────────────────

function createMockUserService() {
  const app = express();
  app.use(express.json());

  const users: MockUser[] = [];
  const passwords: Record<string, string> = {};
  let counter = 0;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'user-service' });
  });

  app.post('/auth/register', (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing fields' } });
      return;
    }
    if (users.find((u) => u.email === email)) {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Email already registered' } });
      return;
    }
    counter++;
    const user: MockUser = {
      id: `user-${counter}`,
      email,
      name,
      role: 'member',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(user);
    passwords[user.id] = password;
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, data: { token, user } });
  });

  app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);
    if (!user || passwords[user.id] !== password) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      return;
    }
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, data: { token, user } });
  });

  app.get('/users', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;
    const items = users.slice(offset, offset + pageSize);
    res.json({ success: true, data: { items, total: users.length, page, pageSize, hasMore: offset + items.length < users.length } });
  });

  app.get('/users/:id', (req, res) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json({ success: true, data: user });
  });

  return app;
}

// ─── Mock Content Service ───────────────────────────────────────────────────────

function createMockContentService() {
  const app = express();
  app.use(express.json());

  const projects: MockProject[] = [];
  const tasks: MockTask[] = [];
  const comments: MockComment[] = [];
  let projectCounter = 0;
  let taskCounter = 0;
  let commentCounter = 0;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'content-service' });
  });

  app.post('/projects', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing auth headers' } });
      return;
    }
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } });
      return;
    }
    projectCounter++;
    const project: MockProject = {
      id: `project-${projectCounter}`,
      name,
      description: description || '',
      ownerId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.push(project);
    res.status(201).json({ success: true, data: project });
  });

  app.get('/projects', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const userProjects = projects.filter((p) => p.ownerId === userId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;
    const items = userProjects.slice(offset, offset + pageSize);
    res.json({ success: true, data: { items, total: userProjects.length, page, pageSize, hasMore: offset + items.length < userProjects.length } });
  });

  app.get('/projects/:id', (req, res) => {
    const project = projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    res.json({ success: true, data: project });
  });

  app.post('/projects/:projectId/tasks', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { projectId } = req.params;
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    const { title, description, priority, assigneeId, tags } = req.body;
    if (!title) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Title is required' } });
      return;
    }
    taskCounter++;
    const task: MockTask = {
      id: `task-${taskCounter}`,
      projectId,
      title,
      description: description || '',
      status: 'todo',
      priority: priority || 'medium',
      assigneeId,
      createdBy: userId,
      tags: tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(task);
    res.status(201).json({ success: true, data: task });
  });

  app.get('/projects/:projectId/tasks', (req, res) => {
    const { projectId } = req.params;
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;
    const items = projectTasks.slice(offset, offset + pageSize);
    res.json({ success: true, data: { items, total: projectTasks.length, page, pageSize, hasMore: offset + items.length < projectTasks.length } });
  });

  app.get('/tasks/:id', (req, res) => {
    const task = tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }
    res.json({ success: true, data: task });
  });

  app.patch('/tasks/:id', (req, res) => {
    const task = tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }
    const { title, description, status, priority, assigneeId, tags } = req.body;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (assigneeId !== undefined) task.assigneeId = assigneeId ?? undefined;
    if (tags !== undefined) task.tags = tags;
    task.updatedAt = new Date().toISOString();
    res.json({ success: true, data: task });
  });

  app.post('/tasks/:taskId/comments', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { taskId } = req.params;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }
    const { body } = req.body;
    if (!body) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Body is required' } });
      return;
    }
    commentCounter++;
    const comment: MockComment = {
      id: `comment-${commentCounter}`,
      taskId,
      authorId: userId,
      body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    comments.push(comment);
    res.status(201).json({ success: true, data: comment });
  });

  app.get('/tasks/:taskId/comments', (req, res) => {
    const { taskId } = req.params;
    const taskComments = comments.filter((c) => c.taskId === taskId);
    res.json({ success: true, data: { items: taskComments, total: taskComments.length, page: 1, pageSize: 20, hasMore: false } });
  });

  return app;
}

// ─── Mock Notification Service ──────────────────────────────────────────────────

function createMockNotificationService() {
  const app = express();
  app.use(express.json());

  const notifications: MockNotification[] = [];
  let counter = 0;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'notification-service' });
  });

  app.post('/notifications/send', (req, res) => {
    const { userId, type, title, body, metadata, channels } = req.body;
    const channelList = channels || ['in_app'];
    const created: MockNotification[] = [];
    for (const channel of channelList) {
      counter++;
      const notif: MockNotification = {
        id: `notif-${counter}`,
        userId,
        type,
        channel,
        title,
        body,
        metadata: metadata || {},
        read: false,
        createdAt: new Date().toISOString(),
      };
      notifications.push(notif);
      created.push(notif);
    }
    res.status(201).json({ success: true, data: created });
  });

  app.get('/notifications', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const userNotifs = notifications.filter((n) => n.userId === userId);
    const offset = (page - 1) * pageSize;
    const items = userNotifs.slice(offset, offset + pageSize);
    res.json({ success: true, data: { items, total: userNotifs.length, page, pageSize, hasMore: offset + items.length < userNotifs.length } });
  });

  app.patch('/notifications/:id/read', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const notif = notifications.find((n) => n.id === req.params.id && n.userId === userId);
    if (!notif) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      return;
    }
    notif.read = true;
    res.json({ success: true, data: notif });
  });

  app.post('/notifications/read-all', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    let count = 0;
    for (const n of notifications) {
      if (n.userId === userId && !n.read) {
        n.read = true;
        count++;
      }
    }
    res.json({ success: true, data: { updated: count } });
  });

  app.get('/notifications/unread-count', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const count = notifications.filter((n) => n.userId === userId && !n.read).length;
    res.json({ success: true, data: { count } });
  });

  app.get('/preferences', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    res.json({
      success: true,
      data: {
        userId,
        taskAssigned: ['in_app'],
        taskStatusChanged: ['in_app'],
        commentAdded: ['in_app'],
        projectInvited: ['in_app', 'email'],
        taskDueSoon: ['in_app', 'email'],
      },
    });
  });

  app.put('/preferences', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    res.json({
      success: true,
      data: {
        userId,
        taskAssigned: req.body.taskAssigned || ['in_app'],
        taskStatusChanged: req.body.taskStatusChanged || ['in_app'],
        commentAdded: req.body.commentAdded || ['in_app'],
        projectInvited: req.body.projectInvited || ['in_app', 'email'],
        taskDueSoon: req.body.taskDueSoon || ['in_app', 'email'],
      },
    });
  });

  return app;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function startServer(app: express.Express): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function makeToken(userId: string, email: string, role = 'member'): string {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '1h' });
}

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe('E2E Integration Tests', () => {
  let gatewayServer: Server;
  let gatewayUrl: string;
  let userServer: Server;
  let userPort: number;
  let contentServer: Server;
  let notifServer: Server;

  beforeAll(async () => {
    // Start mock downstream services on random ports
    const userSvc = await startServer(createMockUserService());
    userServer = userSvc.server;
    userPort = userSvc.port;

    const contentSvc = await startServer(createMockContentService());
    contentServer = contentSvc.server;

    const notifSvc = await startServer(createMockNotificationService());
    notifServer = notifSvc.server;

    // Directly mutate config to point to mock services
    config.services.userService = `http://localhost:${userSvc.port}`;
    config.services.contentService = `http://localhost:${contentSvc.port}`;
    config.services.notificationService = `http://localhost:${notifSvc.port}`;

    // Start gateway
    const gw = await startServer(createApp());
    gatewayServer = gw.server;
    gatewayUrl = `http://localhost:${gw.port}`;
  });

  afterAll(async () => {
    await Promise.all([
      stopServer(gatewayServer),
      stopServer(userServer),
      stopServer(contentServer),
      stopServer(notifServer),
    ].map((p) => p.catch(() => {})));
  });

  beforeEach(() => {
    clearBuckets();
  });

  // ─── Health Check ───────────────────────────────────────────────────────────

  describe('Health Check', () => {
    it('should return gateway health status', async () => {
      const res = await request(gatewayUrl).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('api-gateway');
    });
  });

  // ─── Authentication ─────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should reject protected routes without token', async () => {
      const res = await request(gatewayUrl).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(gatewayUrl)
        .get('/api/users')
        .set('Authorization', 'Bearer invalid-token-here');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'member' },
        JWT_SECRET,
        { expiresIn: '0s' },
      );
      await new Promise((r) => setTimeout(r, 50));

      const res = await request(gatewayUrl)
        .get('/api/users')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('should allow auth routes without token', async () => {
      const res = await request(gatewayUrl)
        .post('/api/auth/register')
        .send({ email: 'auth-test@test.com', password: 'password123', name: 'Auth Test' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Complete User Journey ──────────────────────────────────────────────────

  describe('Complete User Journey', () => {
    let authToken: string;
    let userId: string;
    let projectId: string;
    let taskId: string;

    it('should register a new user', async () => {
      const res = await request(gatewayUrl)
        .post('/api/auth/register')
        .send({ email: 'alice@nexus.dev', password: 'securepass123', name: 'Alice Developer' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('alice@nexus.dev');
      expect(res.body.data.user.name).toBe('Alice Developer');

      authToken = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('should reject duplicate registration', async () => {
      const res = await request(gatewayUrl)
        .post('/api/auth/register')
        .send({ email: 'alice@nexus.dev', password: 'another', name: 'Alice Again' });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should login with valid credentials', async () => {
      const res = await request(gatewayUrl)
        .post('/api/auth/login')
        .send({ email: 'alice@nexus.dev', password: 'securepass123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('alice@nexus.dev');

      authToken = res.body.data.token;
    });

    it('should reject login with wrong password', async () => {
      const res = await request(gatewayUrl)
        .post('/api/auth/login')
        .send({ email: 'alice@nexus.dev', password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should get user profile', async () => {
      const res = await request(gatewayUrl)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.email).toBe('alice@nexus.dev');
    });

    it('should list users', async () => {
      const res = await request(gatewayUrl)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.total).toBeGreaterThan(0);
    });

    it('should create a project', async () => {
      const res = await request(gatewayUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Nexus Platform', description: 'Next-gen project management' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Nexus Platform');
      expect(res.body.data.ownerId).toBe(userId);

      projectId = res.body.data.id;
    });

    it('should list user projects', async () => {
      const res = await request(gatewayUrl)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should get project by ID', async () => {
      const res = await request(gatewayUrl)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(projectId);
    });

    it('should create a task in the project', async () => {
      const res = await request(gatewayUrl)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Implement authentication', description: 'JWT-based auth', priority: 'high', tags: ['backend'] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Implement authentication');
      expect(res.body.data.priority).toBe('high');
      expect(res.body.data.status).toBe('todo');
      expect(res.body.data.projectId).toBe(projectId);

      taskId = res.body.data.id;
    });

    it('should create a second task', async () => {
      const res = await request(gatewayUrl)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Set up database', description: 'SQLite migrations', priority: 'medium' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should list project tasks', async () => {
      const res = await request(gatewayUrl)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
    });

    it('should get task by ID', async () => {
      const res = await request(gatewayUrl)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(taskId);
    });

    it('should assign a task', async () => {
      // Register a second user
      const regRes = await request(gatewayUrl)
        .post('/api/auth/register')
        .send({ email: 'bob@nexus.dev', password: 'bobpass123', name: 'Bob Tester' });
      const bobId = regRes.body.data.user.id;

      const res = await request(gatewayUrl)
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ assigneeId: bobId, status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assigneeId).toBe(bobId);
      expect(res.body.data.status).toBe('in_progress');
    });

    it('should add a comment to a task', async () => {
      const res = await request(gatewayUrl)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Great progress on this task!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.body).toBe('Great progress on this task!');
      expect(res.body.data.taskId).toBe(taskId);
    });

    it('should add another comment', async () => {
      const res = await request(gatewayUrl)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'PR needs review before merge.' });

      expect(res.status).toBe(201);
    });

    it('should list comments for a task', async () => {
      const res = await request(gatewayUrl)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
    });

    it('should get notifications', async () => {
      const res = await request(gatewayUrl)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
    });

    it('should get unread notification count', async () => {
      const res = await request(gatewayUrl)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.count).toBe('number');
    });

    it('should get notification preferences', async () => {
      const res = await request(gatewayUrl)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskAssigned).toBeDefined();
    });

    it('should update notification preferences', async () => {
      const res = await request(gatewayUrl)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ taskAssigned: ['in_app', 'email'], commentAdded: ['in_app'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskAssigned).toEqual(['in_app', 'email']);
    });
  });

  // ─── Request ID Propagation ─────────────────────────────────────────────────

  describe('Request ID Propagation', () => {
    it('should generate X-Request-Id header', async () => {
      const res = await request(gatewayUrl).get('/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
    });

    it('should preserve client-provided X-Request-Id', async () => {
      const customId = 'custom-request-id-xyz';
      const res = await request(gatewayUrl)
        .get('/health')
        .set('X-Request-Id', customId);
      expect(res.headers['x-request-id']).toBe(customId);
    });
  });

  // ─── Rate Limiting ──────────────────────────────────────────────────────────

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const token = makeToken('rate-user', 'rate@test.com');
      const res = await request(gatewayUrl)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should enforce auth endpoint rate limit (10 req/min)', async () => {
      const responses: number[] = [];

      for (let i = 0; i < 12; i++) {
        const res = await request(gatewayUrl)
          .post('/api/auth/login')
          .send({ email: 'nobody@test.com', password: 'wrong' });
        responses.push(res.status);
      }

      // Should see 429 after exceeding 10 requests
      expect(responses).toContain(429);
      // First requests should not be rate limited
      expect(responses.slice(0, 9)).not.toContain(429);
    });

    it('should return Retry-After header when rate limited', async () => {
      // Exhaust auth rate limit
      for (let i = 0; i < 11; i++) {
        await request(gatewayUrl)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'test' });
      }

      const res = await request(gatewayUrl)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'test' });

      if (res.status === 429) {
        expect(res.headers['retry-after']).toBeDefined();
        expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
      }
    });

    it('should not rate limit health endpoint', async () => {
      const responses: number[] = [];
      for (let i = 0; i < 15; i++) {
        const res = await request(gatewayUrl).get('/health');
        responses.push(res.status);
      }
      expect(responses).not.toContain(429);
    });
  });

  // ─── CORS ──────────────────────────────────────────────────────────────────

  describe('CORS', () => {
    it('should respond to preflight OPTIONS with 204', async () => {
      const res = await request(gatewayUrl)
        .options('/api/users')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
    });

    it('should include Access-Control-Allow-Origin header', async () => {
      const res = await request(gatewayUrl).get('/health');
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include Access-Control-Allow-Methods header', async () => {
      const res = await request(gatewayUrl)
        .options('/api/users')
        .set('Origin', 'http://example.com');

      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  // ─── Proxy Route Mapping ───────────────────────────────────────────────────

  describe('Proxy Route Mapping', () => {
    let token: string;

    beforeAll(() => {
      token = makeToken('proxy-test', 'proxy@test.com');
    });

    it('should proxy /api/auth/* to user service', async () => {
      const res = await request(gatewayUrl)
        .post('/api/auth/login')
        .send({ email: 'none@test.com', password: 'wrong' });

      // Should reach mock user service (401), not fail with 502
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should proxy /api/projects to content service', async () => {
      const res = await request(gatewayUrl)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should proxy /api/notifications to notification service', async () => {
      const res = await request(gatewayUrl)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should proxy /api/preferences to notification service', async () => {
      const res = await request(gatewayUrl)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should forward X-User-Id header to downstream services', async () => {
      const res = await request(gatewayUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Auth Forward Test', description: 'Testing header forwarding' });

      expect(res.status).toBe(201);
      expect(res.body.data.ownerId).toBe('proxy-test');
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should return proper error format for unauthorized requests', async () => {
      const res = await request(gatewayUrl).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });
  });

  // ─── Circuit Breaker (must be last - stops a mock service) ──────────────────

  describe('Circuit Breaker', () => {
    beforeAll(async () => {
      resetCircuits();
      clearBuckets();
      // Stop the user service to simulate failure
      await stopServer(userServer);
    });

    it('should return 502 when downstream service is down', async () => {
      const res = await request(gatewayUrl)
        .post('/api/auth/register')
        .send({ email: 'circuit@test.com', password: 'password123', name: 'Circuit Test' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_GATEWAY');
    });

    it('should open circuit after repeated failures and return 503', async () => {
      resetCircuits();
      clearBuckets();

      // Trigger enough failures to open the circuit (>5)
      for (let i = 0; i < 7; i++) {
        clearBuckets(); // Prevent rate limiting from interfering
        await request(gatewayUrl)
          .post('/api/auth/register')
          .send({ email: `circuit${i}@test.com`, password: 'password123', name: 'Test' });
      }

      clearBuckets();
      // Circuit should now be open - next request returns 503
      const res = await request(gatewayUrl)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'test' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should still proxy to healthy services when user service is down', async () => {
      resetCircuits();
      clearBuckets();

      const token = makeToken('healthy-test', 'healthy@test.com');

      // Content service should still work
      const res = await request(gatewayUrl)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should still proxy to notification service when user service is down', async () => {
      clearBuckets();
      const token = makeToken('healthy-test2', 'healthy2@test.com');

      const res = await request(gatewayUrl)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
