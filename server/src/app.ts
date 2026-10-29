import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { q } from './db/pool.js';
import { HttpError } from './utils/errors.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { jobsRouter } from './modules/jobs/routes.js';
import { companiesRouter } from './modules/companies/routes.js';
import { savedRouter } from './modules/saved/routes.js';
import { alertsRouter } from './modules/alerts/routes.js';
import { trackerRouter } from './modules/tracker/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { recruiterRouter } from './modules/recruiter/routes.js';
import { adminRouter } from './modules/admin/routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => { if (!origin || env.corsOrigins.includes(origin)) cb(null, true); else cb(new Error('CORS origin not allowed')); }, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    try { await q('SELECT 1'); res.json({ ok: true, service: 'job-portal-api' }); }
    catch { res.status(503).json({ ok: false, error: 'database unavailable' }); }
  });
  app.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const r = await q<{ id: number; updated_at: Date }>("SELECT id, updated_at FROM jobs WHERE status='live' ORDER BY updated_at DESC LIMIT 5000");
      const urls = r.rows.map((j) => `  <url><loc>${env.publicBaseUrl}/jobs/${j.id}</loc><lastmod>${new Date(j.updated_at).toISOString()}</lastmod></url>`).join('\n');
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
    } catch (e) { next(e); }
  });
  app.get('/robots.txt', (_req, res) => { res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${env.publicBaseUrl}/sitemap.xml\n`); });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/saved', savedRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/tracker', trackerRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/recruiter', recruiterRouter);
  app.use('/api/admin', adminRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) { res.status(err.status).json({ error: { code: err.code, message: err.message } }); return; }
    console.error(err);
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
  });
  return app;
}
