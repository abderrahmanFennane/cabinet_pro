import { Request, Response, NextFunction } from 'express';

/** Minimal in-memory, per-IP rate limiter (single-instance deployments). */
export function rateLimit({ windowMs, max, message }: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const recent = (hits.get(key) || []).filter(time => now - time < windowMs);
    if (recent.length >= max) {
      res.status(429).json({ error: message });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
