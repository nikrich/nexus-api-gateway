import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/server.js';

describe('Health endpoint', () => {
  const app = createApp();

  it('GET /health returns 200 with status ok', async () => {
    const res = await supertest(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api-gateway');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
  });
});

describe('CORS middleware', () => {
  const app = createApp();

  it('returns CORS headers on requests', async () => {
    const res = await supertest(app).get('/health');

    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('handles OPTIONS preflight requests', async () => {
    const res = await supertest(app).options('/health');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});

describe('Request logger middleware', () => {
  const app = createApp();

  it('assigns X-Request-Id header to responses', async () => {
    const res = await supertest(app).get('/health');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
  });

  it('forwards existing X-Request-Id', async () => {
    const customId = 'test-request-id-123';
    const res = await supertest(app)
      .get('/health')
      .set('X-Request-Id', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });
});

describe('Error handling', () => {
  const app = createApp();

  it('returns 401 for unknown routes without auth', async () => {
    const res = await supertest(app).get('/unknown-route');

    expect(res.status).toBe(401);
  });
});
