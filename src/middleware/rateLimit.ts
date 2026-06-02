import rateLimit, { Options } from 'express-rate-limit';

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createLimiter(name: string, max: number, windowMs: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: 'Rate limit exceeded. Please try again later.',
      policy: name,
      limit: max,
      windowMs,
    },
  } as Partial<Options>);
}

export const globalRateLimiter = createLimiter(
  'global',
  intFromEnv('RATE_LIMIT_GLOBAL_MAX', 300),
  intFromEnv('RATE_LIMIT_GLOBAL_WINDOW_MS', 15 * 60 * 1000)
);

export const apiRateLimiter = createLimiter(
  'api',
  intFromEnv('RATE_LIMIT_API_MAX', 300),
  intFromEnv('RATE_LIMIT_API_WINDOW_MS', 15 * 60 * 1000)
);

export const authRateLimiter = createLimiter(
  'auth',
  intFromEnv('RATE_LIMIT_AUTH_MAX', 20),
  intFromEnv('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000)
);

export const webhookRateLimiter = createLimiter(
  'webhook',
  intFromEnv('RATE_LIMIT_WEBHOOK_MAX', 60),
  intFromEnv('RATE_LIMIT_WEBHOOK_WINDOW_MS', 60 * 60 * 1000)
);
