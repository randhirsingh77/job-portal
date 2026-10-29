import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { validate, body } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { register, login, rotateRefresh, logout } from './service.js';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: env.authRateMax, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } } });
authRouter.use(limiter);

export const REFRESH_COOKIE = 'jp_refresh';
function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/api/auth', maxAge: env.refreshTtlDays * 86400000 });
}
const ipOf = (req: Request) => req.ip ?? null;
const uaOf = (req: Request) => req.header('user-agent') ?? null;

const registerSchema = z.object({
  email: z.string().email().max(254), password: z.string().min(10).max(200), name: z.string().min(1).max(120),
  role: z.enum(['seeker', 'recruiter']), companyName: z.string().max(160).optional(), companyDomain: z.string().max(160).optional(),
  consent: z.boolean(),
});
authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try { const out = await register(body(req), ipOf(req), uaOf(req)); setRefreshCookie(res, out.refresh); res.status(201).json({ user: out.user, accessToken: out.access }); } catch (e) { next(e); }
});
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try { const b = body<{ email: string; password: string }>(req); const out = await login(b.email, b.password, ipOf(req), uaOf(req)); setRefreshCookie(res, out.refresh); res.json({ user: out.user, accessToken: out.access }); } catch (e) { next(e); }
});
authRouter.post('/refresh', async (req, res, next) => {
  try { const out = await rotateRefresh((req.cookies?.[REFRESH_COOKIE] as string) ?? '', ipOf(req), uaOf(req)); setRefreshCookie(res, out.refresh); res.json({ user: out.user, accessToken: out.access }); } catch (e) { next(e); }
});
authRouter.post('/logout', async (req, res) => {
  await logout(req.cookies?.[REFRESH_COOKIE] as string | undefined, null, ipOf(req));
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' }); res.status(204).end();
});
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { q } = await import('../../db/pool.js');
    const r = await q('SELECT id, email, name, role, company_id FROM users WHERE id=$1', [req.user!.id]);
    res.json({ user: r.rows[0] ?? null });
  } catch (e) { next(e); }
});
