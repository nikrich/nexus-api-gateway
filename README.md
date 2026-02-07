# Nexus API Gateway

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-black?logo=express&logoColor=white)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

Central API gateway for the **Nexus** platform. Handles routing, JWT authentication, rate limiting, and circuit breaking for all downstream services.

## Features

- **JWT Authentication** — Verifies tokens and forwards user context (`X-User-Id`, `X-User-Email`, `X-User-Role`) to downstream services
- **Route Proxying** — Routes all `/api/*` requests to the appropriate microservice
- **Rate Limiting** — Token bucket algorithm (100 req/min default, 10 req/min for auth endpoints)
- **Circuit Breaker** — Protects against cascading failures (opens after 5 failures in 30s)
- **Request Logging** — Logs all requests with timing and `X-Request-Id` tracking
- **CORS** — Configurable cross-origin support

## Quick Start

```bash
npm install
npm run dev    # Start with hot reload on port 3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with tsx watch |
| `npm run build` | Build with tsup |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run lint` | Type-check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Gateway port |
| `NEXUS_JWT_SECRET` | `nexus-dev-secret-change-in-production` | JWT signing secret |
| `USER_SERVICE_URL` | `http://localhost:3001` | User service URL |
| `CONTENT_SERVICE_URL` | `http://localhost:3002` | Content service URL |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:3003` | Notification service URL |
| `RATE_LIMIT_DEFAULT` | `100` | Requests per minute per IP |
| `RATE_LIMIT_AUTH` | `10` | Auth endpoint requests per minute |

## Route Map

All routes are prefixed with `/api` and proxied to downstream services:

| Route | Service | Port |
|-------|---------|------|
| `/api/auth/*` | User Service | 3001 |
| `/api/users/*` | User Service | 3001 |
| `/api/projects/*` | Content Service | 3002 |
| `/api/tasks/*` | Content Service | 3002 |
| `/api/comments/*` | Content Service | 3002 |
| `/api/notifications/*` | Notification Service | 3003 |
| `/api/preferences/*` | Notification Service | 3003 |
| `/api/webhooks/*` | Notification Service | 3003 |

## Project Structure

```
src/
├── index.ts              # Entry point
├── server.ts             # Express app factory
├── config.ts             # Service URLs, rate limits
├── routes/
│   ├── proxy.routes.ts   # Route mapping to services
│   └── health.routes.ts
├── middleware/
│   ├── auth.middleware.ts     # JWT verification
│   ├── rate-limiter.ts        # Token bucket rate limiter
│   ├── request-logger.ts     # Request logging with timing
│   ├── cors.middleware.ts
│   └── error.middleware.ts
└── proxy/
    └── service-proxy.ts  # HTTP proxy with circuit breaker
```

## Part of Nexus Platform

| Service | Port | Repository |
|---------|------|------------|
| **API Gateway** | **3000** | [nexus-api-gateway](https://github.com/nikrich/nexus-api-gateway) |
| Shared Contracts | — | [nexus-shared-contracts](https://github.com/nikrich/nexus-shared-contracts) |
| User Service | 3001 | [nexus-user-service](https://github.com/nikrich/nexus-user-service) |
| Content Service | 3002 | [nexus-content-service](https://github.com/nikrich/nexus-content-service) |
| Notification Service | 3003 | [nexus-notification-service](https://github.com/nikrich/nexus-notification-service) |
