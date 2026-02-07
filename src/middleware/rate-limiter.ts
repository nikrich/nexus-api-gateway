import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function isAuthPath(path: string): boolean {
  return path.startsWith('/api/auth/') || path === '/api/auth';
}

function getBucketConfig(path: string) {
  if (isAuthPath(path)) {
    return {
      maxTokens: config.rateLimit.authMaxRequests,
      windowMs: config.rateLimit.authWindowMs,
    };
  }
  return {
    maxTokens: config.rateLimit.defaultMaxRequests,
    windowMs: config.rateLimit.defaultWindowMs,
  };
}

function getBucketKey(ip: string, path: string): string {
  return isAuthPath(path) ? `auth:${ip}` : `default:${ip}`;
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') {
    next();
    return;
  }

  const ip = getClientIp(req);
  const { maxTokens, windowMs } = getBucketConfig(req.path);
  const key = getBucketKey(ip, req.path);
  const now = Date.now();

  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = (elapsed / windowMs) * maxTokens;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  const remaining = Math.floor(bucket.tokens);
  const resetMs = Math.ceil(((maxTokens - bucket.tokens) / maxTokens) * windowMs);
  const resetTime = Math.ceil((now + resetMs) / 1000);

  res.setHeader('X-RateLimit-Limit', maxTokens.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining - 1).toString());
  res.setHeader('X-RateLimit-Reset', resetTime.toString());

  if (bucket.tokens < 1) {
    const retryAfterSec = Math.ceil(((1 - bucket.tokens) / maxTokens) * windowMs / 1000);
    res.setHeader('Retry-After', retryAfterSec.toString());
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      },
    });
    return;
  }

  bucket.tokens -= 1;
  next();
}

// For testing: clear all buckets
export function clearBuckets(): void {
  buckets.clear();
}
