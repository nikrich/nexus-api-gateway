import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/server.js';
import { config } from '../src/config.js';
import { clearBuckets } from '../src/middleware/rate-limiter.js';

describe('Rate limiter', () => {
  beforeEach(() => {
    clearBuckets();
  });

  it('includes rate limit headers on responses', async () => {
    const app = createApp();
    const res = await supertest(app).get('/api/users');

    // Returns 401 (no auth), but rate limit headers should be present
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('skips rate limiting for /health', async () => {
    const app = createApp();

    // Make many requests to health - should never be limited
    for (let i = 0; i < 110; i++) {
      const res = await supertest(app).get('/health');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 when default rate limit exceeded', async () => {
    // Set a low limit for testing
    const originalMax = config.rateLimit.defaultMaxRequests;
    config.rateLimit.defaultMaxRequests = 5;

    try {
      const app = createApp();

      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        const res = await supertest(app).get('/api/users');
        expect(res.status).not.toBe(429);
      }

      // Next request should be rate limited
      const res = await supertest(app).get('/api/users');
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(res.headers['retry-after']).toBeDefined();
    } finally {
      config.rateLimit.defaultMaxRequests = originalMax;
    }
  });

  it('has separate limit for auth endpoints', async () => {
    const originalAuth = config.rateLimit.authMaxRequests;
    const originalDefault = config.rateLimit.defaultMaxRequests;
    config.rateLimit.authMaxRequests = 3;
    config.rateLimit.defaultMaxRequests = 100;

    try {
      const app = createApp();

      // Consume all auth tokens
      for (let i = 0; i < 3; i++) {
        const res = await supertest(app).post('/api/auth/login');
        expect(res.status).not.toBe(429);
      }

      // Auth endpoint should be rate limited
      const res = await supertest(app).post('/api/auth/login');
      expect(res.status).toBe(429);

      // But regular endpoints should still work
      const res2 = await supertest(app).get('/api/users');
      expect(res2.status).not.toBe(429);
    } finally {
      config.rateLimit.authMaxRequests = originalAuth;
      config.rateLimit.defaultMaxRequests = originalDefault;
    }
  });

  it('shows correct remaining count', async () => {
    const originalMax = config.rateLimit.defaultMaxRequests;
    config.rateLimit.defaultMaxRequests = 10;

    try {
      const app = createApp();

      const res = await supertest(app).get('/api/users');
      expect(res.headers['x-ratelimit-limit']).toBe('10');
      expect(parseInt(res.headers['x-ratelimit-remaining'] as string)).toBe(9);
    } finally {
      config.rateLimit.defaultMaxRequests = originalMax;
    }
  });
});
