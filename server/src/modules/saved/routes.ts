import { Router } from 'express';
import { q } from '../../db/pool.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
export const savedRouter = Router();
savedRouter.get('/', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try {
    const r = await q(`SELECT j.*, c.name AS company_name FROM saved_jobs s JOIN jobs j ON j.id=s.job_id JOIN companies c ON c.id=j.company_id WHERE s.user_id=$1 ORDER BY s.created_at DESC`, [req.user!.id]);
    res.json({ saved: r.rows });
  } catch (e) { next(e); }
});
savedRouter.post('/:jobId', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try { await q('INSERT INTO saved_jobs (user_id, job_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user!.id, Number(req.params.jobId)]); res.status(201).json({ saved: true }); } catch (e) { next(e); }
});
savedRouter.delete('/:jobId', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try { await q('DELETE FROM saved_jobs WHERE user_id=$1 AND job_id=$2', [req.user!.id, Number(req.params.jobId)]); res.status(204).end(); } catch (e) { next(e); }
});
