import { Router } from 'express';
import { q } from '../../db/pool.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { notFound } from '../../utils/errors.js';
import { collectSource } from '../ingestion/ingest.js';
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));
adminRouter.get('/sources', async (_req, res, next) => {
  try { const r = await q('SELECT s.*, c.name AS company_name FROM sources s JOIN companies c ON c.id=s.company_id ORDER BY c.name'); res.json({ sources: r.rows }); } catch (e) { next(e); }
});
adminRouter.get('/collector-runs', async (_req, res, next) => {
  try { const r = await q('SELECT * FROM collector_runs ORDER BY started_at DESC LIMIT 100'); res.json({ runs: r.rows }); } catch (e) { next(e); }
});
adminRouter.post('/sources/:id/collect', async (req, res, next) => {
  try { const out = await collectSource(Number(req.params.id)); res.json(out); } catch (e) { next(e); }
});
adminRouter.post('/sources/:id/quarantine', async (req, res, next) => {
  try {
    const r = await q('UPDATE sources SET active=FALSE, strike_count=strike_count+1 WHERE id=$1 RETURNING *', [Number(req.params.id)]);
    if (!r.rows.length) throw notFound('Source not found');
    await q("UPDATE jobs SET status='quarantined' WHERE id IN (SELECT job_id FROM job_sources WHERE source_id=$1) AND status='live'", [Number(req.params.id)]);
    res.json({ source: r.rows[0] });
  } catch (e) { next(e); }
});
adminRouter.get('/review-queue', async (_req, res, next) => {
  try { const r = await q("SELECT j.*, c.name AS company_name FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status IN ('review','blocked') ORDER BY j.created_at DESC"); res.json({ jobs: r.rows }); } catch (e) { next(e); }
});
adminRouter.post('/jobs/:id/approve', async (req, res, next) => {
  try {
    const r = await q("UPDATE jobs SET status='live', updated_at=now() WHERE id=$1 RETURNING *", [Number(req.params.id)]);
    if (!r.rows.length) throw notFound('Job not found');
    await q('UPDATE companies SET first_direct_approved=TRUE WHERE id=$1', [r.rows[0].company_id]);
    await q('INSERT INTO trust_events (job_id, rule, outcome, detail) VALUES ($1,$2,$3,$4)', [Number(req.params.id), 'admin_review', 'approved', `by admin ${req.user!.id}`]);
    res.json({ job: r.rows[0] });
  } catch (e) { next(e); }
});
adminRouter.post('/jobs/:id/block', async (req, res, next) => {
  try { const r = await q("UPDATE jobs SET status='blocked', updated_at=now() WHERE id=$1 RETURNING *", [Number(req.params.id)]); if (!r.rows.length) throw notFound('Job not found'); res.json({ job: r.rows[0] }); } catch (e) { next(e); }
});
adminRouter.get('/reports', async (_req, res, next) => {
  try { const r = await q("SELECT r.*, j.title FROM reports r JOIN jobs j ON j.id=r.job_id WHERE r.status='open' ORDER BY r.created_at DESC"); res.json({ reports: r.rows }); } catch (e) { next(e); }
});
adminRouter.post('/reports/:id/action', async (req, res, next) => {
  try {
    const act = (req.body as { action?: string })?.action;
    const rep = await q('SELECT * FROM reports WHERE id=$1', [Number(req.params.id)]);
    if (!rep.rows.length) throw notFound('Report not found');
    if (act === 'takedown') await q("UPDATE jobs SET status='blocked', updated_at=now() WHERE id=$1", [rep.rows[0].job_id]);
    const r = await q("UPDATE reports SET status='actioned', reviewed_at=now(), reviewed_by=$2 WHERE id=$1 RETURNING *", [Number(req.params.id), req.user!.id]);
    res.json({ report: r.rows[0] });
  } catch (e) { next(e); }
});
