import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

interface AuthToken {
  userId: string;
  email: string;
  role: string;
}

const PUBLIC_PATHS = ['/health', '/api/auth/'];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((prefix) => path === prefix || path.startsWith(prefix));
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isPublicPath(req.path)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthToken;

    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role;

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}
