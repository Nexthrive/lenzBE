import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { Application } from 'express';

export function configureSecurity(app: Application) {
  app.disable('x-powered-by');
  app.use(helmet());

  const isProduction = process.env.NODE_ENV === 'production';
  const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

  const corsOptions = {
    origin: origins.length > 0 ? origins : (isProduction ? false : true),
    credentials: true,
    methods: Array.from(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
  };

  app.use(cors(corsOptions));
  // Handle preflight for all routes (Express v5 + path-to-regexp v6)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.options('/:path(*)', cors(corsOptions) as any);

  // Basic global limiter
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);
}

export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export function errorHandler(err: unknown, _req: any, res: any, _next: any) {
  // Do not leak internal details
  return res.status(500).json({ error: 'Internal server error' });
}


