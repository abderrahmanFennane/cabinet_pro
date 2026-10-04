import { Request, Response, NextFunction } from 'express';

/**
 * In-memory, per-IP rate limiter (single-instance deployments): a fixed window counter per IP.
 * Memory stays bounded even under a flood from many addresses: expired windows are swept every minute and the
 * table never holds more than `maxKeys` addresses (when full, unknown addresses are refused, known ones keep working).
 * This only protects the application; a large attack must be stopped before it reaches the server (nginx, Cloudflare).
 */
export function rateLimit({ windowMs, max, message, maxKeys = 50_000, skip }: {
  windowMs: number; max: number; message: string; maxKeys?: number; skip?: (req: Request) => boolean
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, 60_000);
  sweep.unref(); // never keeps the process (or the tests) alive

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) { next(); return; }
    const key = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (!entry && hits.size >= maxKeys) {
        res.status(429).set('Retry-After', '60').json({ error: 'Serveur très sollicité. Réessayez dans une minute.' });
        return;
      }
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.status(429).set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000))).json({ error: message });
      return;
    }
    next();
  };
}
