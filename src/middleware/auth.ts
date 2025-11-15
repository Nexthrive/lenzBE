import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  id: number;
  role: 'admin' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const jwtSecret = process.env.JWT_SECRET || 'default_secret'; // Fallback for missing JWT_SECRET
if (!jwtSecret) {
  // Fail fast to avoid running server without secret
  throw new Error('Missing JWT_SECRET in environment variables');
}

export function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  try {
    const payload = jwt.verify(token, jwtSecret) as unknown as AuthUser & { iat: number; exp: number };
    const normalizedRole = (payload.role || 'user').toLowerCase() as 'admin' | 'user';
    req.user = { id: payload.id, role: normalizedRole };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(role: 'admin' | 'user') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if ((req.user.role || '').toLowerCase() !== role) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}


