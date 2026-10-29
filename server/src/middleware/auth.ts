import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorised } from '../utils/errors.js';

export interface AuthedUser { id: number; role: 'seeker' | 'recruiter' | 'admin'; companyId: number | null }
declare global { namespace Express { interface Request { user?: AuthedUser } } }

export function signAccess(u: AuthedUser): string {
  return jwt.sign({ role: u.role, companyId: u.companyId }, env.jwtSecret, { subject: String(u.id), expiresIn: `${env.accessTtlMin}m` });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const h = req.header('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return next(unauthorised('Sign in required'));
  try {
    const p = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    req.user = { id: Number(p.sub), role: p.role as AuthedUser['role'], companyId: (p.companyId as number | null) ?? null };
    next();
  } catch { next(unauthorised('Session expired, sign in again')); }
}

export function requireRole(...roles: AuthedUser['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorised());
    if (!roles.includes(req.user.role)) return next(forbidden(`Requires role: ${roles.join(' or ')}`));
    next();
  };
}
