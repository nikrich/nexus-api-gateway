import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = config.cors.allowedOrigins;
  const origin = req.headers.origin || '*';

  if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
