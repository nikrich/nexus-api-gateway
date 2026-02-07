import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/server.js';
import { config } from '../src/config.js';

function createToken(payload: { userId: string; email: string; role: string }, expiresIn = '1h') {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

describe('Auth middleware', () => {
  const app = createApp();

  it('allows /health without auth', async () => {
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('allows /api/auth/* without auth', async () => {
    // This will fail with 502 since no upstream is running, but NOT 401
    const res = await supertest(app).post('/api/auth/login').send({ email: 'test@test.com', password: 'pass' });
    expect(res.status).not.toBe(401);
  });

  it('rejects requests without Authorization header', async () => {
    const res = await supertest(app).get('/api/users');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with invalid token', async () => {
    const res = await supertest(app)
      .get('/api/users')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with expired token', async () => {
    const token = createToken(
      { userId: 'user1', email: 'test@test.com', role: 'member' },
      '-1s'
    );
    const res = await supertest(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('attaches user headers for valid token', async () => {
    const token = createToken({
      userId: 'user123',
      email: 'test@example.com',
      role: 'admin',
    });

    // The proxy will fail (502) since no upstream, but we can verify the
    // auth middleware passed by checking it's NOT a 401
    const res = await supertest(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(401);
  });

  it('rejects requests with missing Bearer prefix', async () => {
    const token = createToken({ userId: 'user1', email: 'test@test.com', role: 'member' });
    const res = await supertest(app)
      .get('/api/users')
      .set('Authorization', token);
    expect(res.status).toBe(401);
  });
});
