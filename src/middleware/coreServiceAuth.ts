import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ZIVOPAL_SERVICE_KEY } from '../config.js';

/** Assess is an internal processor. End-user JWT authorization belongs to Core. */
export function requireCoreServiceKey(req: Request, res: Response, next: NextFunction) {
  const expected = ZIVOPAL_SERVICE_KEY?.trim();
  if (!expected) return res.status(503).json({ error: 'Core service authentication is not configured' });
  const supplied = req.get('X-Service-Key') ?? '';
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid or missing service authentication' });
  next();
}
