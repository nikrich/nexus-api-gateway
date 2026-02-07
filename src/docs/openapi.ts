import type { JsonObject } from 'swagger-ui-express';

export const openapiSpec: JsonObject = {
  openapi: '3.0.3',
  info: {
    title: 'Nexus Platform API',
    version: '1.0.0',
    description:
      'Unified API for the Nexus project management platform.\n\n' +
      'All endpoints are accessed through the API Gateway on port 3000, which proxies to backend microservices.\n\n' +
      '**Auth flow:** Register → Login (get JWT) → Pass JWT as `Bearer` token on all authenticated endpoints.',
    contact: { name: 'Nexus Team' },
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, and token refresh' },
    { name: 'Users', description: 'User profiles and batch lookup' },
    { name: 'Projects', description: 'Project CRUD and membership' },
    { name: 'Tasks', description: 'Task CRUD with filtering, sorting, pagination' },
    { name: 'Comments', description: 'Comments on tasks' },
    { name: 'Notifications', description: 'In-app notifications' },
    { name: 'Preferences', description: 'Per-user notification channel preferences' },
    { name: 'Webhooks', description: 'Webhook configuration and delivery history' },
    { name: 'Health', description: 'Service health checks' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT obtained from POST /api/auth/login or /api/auth/register',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Resource not found' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['member', 'admin'] },
          avatarUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          ownerId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          projectId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          assigneeId: { type: 'string', nullable: true },
          createdBy: { type: 'string' },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          taskId: { type: 'string' },
          authorId: { type: 'string' },
          body: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          type: { type: 'string', enum: ['task_assigned', 'task_status_changed', 'comment_added', 'project_invited', 'task_due_soon'] },
          channel: { type: 'string', enum: ['in_app', 'email', 'webhook'] },
          title: { type: 'string' },
          body: { type: 'string' },
          metadata: { type: 'object' },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      NotificationPreferences: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          taskAssigned: { type: 'array', items: { type: 'string' } },
          taskStatusChanged: { type: 'array', items: { type: 'string' } },
          commentAdded: { type: 'array', items: { type: 'string' } },
          projectInvited: { type: 'array', items: { type: 'string' } },
          taskDueSoon: { type: 'array', items: { type: 'string' } },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          secret: { type: 'string' },
          events: { type: 'array', items: { type: 'string' } },
          active: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WebhookDelivery: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          webhookId: { type: 'string' },
          eventType: { type: 'string' },
          payload: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'delivered', 'failed'] },
          responseCode: { type: 'integer', nullable: true },
          attempts: { type: 'integer' },
          lastAttemptAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          items: { type: 'array', items: {} },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          hasMore: { type: 'boolean' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ── Health ──────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Gateway health check',
        security: [],
        responses: {
          200: { description: 'Healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, service: { type: 'string' }, uptime: { type: 'number' } } } } } },
        },
      },
    },

    // ── Auth ────────────────────────────────────────────
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'name', 'password'], properties: { email: { type: 'string', format: 'email', example: 'user@example.com' }, name: { type: 'string', example: 'Jane Doe' }, password: { type: 'string', minLength: 6, example: 'securepass123' } } } } },
        },
        responses: {
          201: { description: 'User registered', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } } } } } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Email already taken' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and get JWT',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { token: { type: 'string' } } } } } } } },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh JWT token',
        security: [],
        responses: {
          200: { description: 'New token', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { token: { type: 'string' } } } } } } } },
        },
      },
    },

    // ── Users ───────────────────────────────────────────
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (paginated)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated user list' } },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/User' } } } } } },
          404: { description: 'User not found' },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user profile (self or admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, avatarUrl: { type: 'string' } } } } } },
        responses: { 200: { description: 'Updated user' } },
      },
    },
    '/api/users/batch': {
      get: {
        tags: ['Users'],
        summary: 'Batch fetch users by IDs',
        parameters: [{ name: 'ids', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated user IDs' }],
        responses: { 200: { description: 'Array of users' } },
      },
    },

    // ── Projects ────────────────────────────────────────
    '/api/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List user\'s projects (paginated)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated project list' } },
      },
      post: {
        tags: ['Projects'],
        summary: 'Create a project',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string', example: 'My Project' }, description: { type: 'string', example: 'A project description' } } } } },
        },
        responses: {
          201: { description: 'Project created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Project' } } } } } },
        },
      },
    },
    '/api/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get project details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Project details' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Projects'],
        summary: 'Update project (owner only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } } } } },
        responses: { 200: { description: 'Updated project' }, 403: { description: 'Not owner' } },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete project (owner only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 403: { description: 'Not owner' } },
      },
    },
    '/api/projects/{id}/members': {
      post: {
        tags: ['Projects'],
        summary: 'Add member to project (owner only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' } } } } } },
        responses: { 201: { description: 'Member added' }, 403: { description: 'Not owner' } },
      },
    },
    '/api/projects/{id}/members/{userId}': {
      delete: {
        tags: ['Projects'],
        summary: 'Remove member from project (owner only)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 204: { description: 'Member removed' } },
      },
    },

    // ── Tasks ───────────────────────────────────────────
    '/api/projects/{projectId}/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'List tasks in a project (filterable)',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Comma-separated: todo,in_progress,review,done' },
          { name: 'priority', in: 'query', schema: { type: 'string' }, description: 'Comma-separated: low,medium,high,critical' },
          { name: 'assigneeId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search title and description' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'dueDate', 'priority'] } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated task list' } },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Create a task in a project',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string', example: 'Implement login page' }, description: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }, assigneeId: { type: 'string' }, dueDate: { type: 'string', format: 'date-time' }, tags: { type: 'array', items: { type: 'string' } } } } } },
        },
        responses: {
          201: { description: 'Task created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/Task' } } } } } },
        },
      },
    },
    '/api/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get task details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Task details' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update a task',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, assigneeId: { type: 'string', nullable: true }, dueDate: { type: 'string', format: 'date-time', nullable: true }, tags: { type: 'array', items: { type: 'string' } } } } } } },
        responses: { 200: { description: 'Updated task' } },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task (creator or project owner)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 403: { description: 'Not authorized' } },
      },
    },

    // ── Comments ────────────────────────────────────────
    '/api/tasks/{taskId}/comments': {
      get: {
        tags: ['Comments'],
        summary: 'List comments on a task',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Array of comments', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Comment' } } } } } } } },
      },
      post: {
        tags: ['Comments'],
        summary: 'Add a comment to a task',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['body'], properties: { body: { type: 'string', example: 'Looks good, let\'s ship it!' } } } } } },
        responses: { 201: { description: 'Comment created' } },
      },
    },
    '/api/comments/{id}': {
      delete: {
        tags: ['Comments'],
        summary: 'Delete a comment (author or admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' } },
      },
    },

    // ── Notifications ───────────────────────────────────
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List user\'s notifications (paginated)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated notifications' } },
      },
    },
    '/api/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark a notification as read',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Marked as read' }, 404: { description: 'Not found' } },
      },
    },
    '/api/notifications/read-all': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        responses: { 200: { description: 'All marked as read' } },
      },
    },
    '/api/notifications/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'Get unread notification count',
        responses: { 200: { description: 'Unread count', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { count: { type: 'integer' } } } } } } } } },
      },
    },

    // ── Preferences ─────────────────────────────────────
    '/api/preferences': {
      get: {
        tags: ['Preferences'],
        summary: 'Get notification preferences',
        responses: { 200: { description: 'Current preferences', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/NotificationPreferences' } } } } } } },
      },
      put: {
        tags: ['Preferences'],
        summary: 'Update notification preferences',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { taskAssigned: { type: 'array', items: { type: 'string', enum: ['in_app', 'email', 'webhook'] } }, taskStatusChanged: { type: 'array', items: { type: 'string' } }, commentAdded: { type: 'array', items: { type: 'string' } }, projectInvited: { type: 'array', items: { type: 'string' } }, taskDueSoon: { type: 'array', items: { type: 'string' } } } } } },
        },
        responses: { 200: { description: 'Updated preferences' } },
      },
    },

    // ── Webhooks ────────────────────────────────────────
    '/api/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List user\'s webhooks',
        responses: { 200: { description: 'Array of webhooks', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } } } } } } } },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create a webhook',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['url'], properties: { url: { type: 'string', format: 'uri', example: 'https://example.com/webhook' }, events: { type: 'array', items: { type: 'string' }, example: ['task_assigned', 'task_status_changed'] } } } } },
        },
        responses: { 201: { description: 'Webhook created (includes generated secret)' } },
      },
    },
    '/api/webhooks/{id}': {
      patch: {
        tags: ['Webhooks'],
        summary: 'Update a webhook',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } }, active: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Updated webhook' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete a webhook',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },
    '/api/webhooks/{id}/deliveries': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhook delivery history',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Array of deliveries', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/WebhookDelivery' } } } } } } } },
      },
    },
  },
};
