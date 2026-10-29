import { Router } from 'express';
import { z } from 'zod';
import { q } from '../../db/pool.js';
import { validate, body } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { forbidden } from '../../utils/errors.js';
export const trackerRouter = Router();
trackerRouter.get('/', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try {
    const r = await q(`SELECT a.*, j.title, j.status AS job_status, j.company_id, c.name AS company_name,
      CASE WHEN j.status='expired' AND a.applied_at IS NOT NULL THEN 'listing_closed_since_you_applied' ELSE NULL END AS closure_note
      FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.user_id=$1 ORDER BY a.updated_at DESC`, [req.user!.id]);
    res.json({ applications: r.rows });
  } catch (e) { next(e); }
});
const upsertSchema = z.object({ stage: z.enum(['saved','applied','interviewing','offer','closed']), followUpAt: z.string().datetime().nullable().optional(), lifecycleStage: z.string().max(80).nullable().optional(), notes: z.string().max(2000).nullable().optional() });
trackerRouter.post('/:jobId', requireAuth, requireRole('seeker'), validate(upsertSchema), async (req, res, next) => {
  try {
    const b = body<z.infer<typeof upsertSchema>>(req);
    const r = await q(`INSERT INTO applications (user_id, job_id, stage, applied_at, follow_up_at, lifecycle_stage, notes)
      VALUES ($1,$2,$3, CASE WHEN $3='applied' THEN now() ELSE NULL END, $4,$5,$6)
      ON CONFLICT (user_id, job_id) DO UPDATE SET stage=EXCLUDED.stage,
        applied_at = CASE WHEN EXCLUDED.stage='applied' AND applications.applied_at IS NULL THEN now() ELSE applications.applied_at END,
        follow_up_at=COALESCE(EXCLUDED.follow_up_at, applications.follow_up_at),
        lifecycle_stage=COALESCE(EXCLUDED.lifecycle_stage, applications.lifecycle_stage),
        notes=COALESCE(EXCLUDED.notes, applications.notes), updated_at=now() RETURNING *`,
      [req.user!.id, Number(req.params.jobId), b.stage, b.followUpAt ?? null, b.lifecycleStage ?? null, b.notes ?? null]);
    res.status(201).json({ application: r.rows[0] });
  } catch (e) { next(e); }
});
trackerRouter.delete('/:jobId', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try { await q('DELETE FROM applications WHERE user_id=$1 AND job_id=$2', [req.user!.id, Number(req.params.jobId)]); res.status(204).end(); } catch (e) { next(e); }
});
export { forbidden };
