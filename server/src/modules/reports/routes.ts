import { Router } from 'express';
import { z } from 'zod';
import { q } from '../../db/pool.js';
import { validate, body } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
export const reportsRouter = Router();
const schema = z.object({ reason: z.enum(['fee_asked','fake_company','whatsapp_only','expired','wrong_info','other']), detail: z.string().max(1000).optional() });
reportsRouter.post('/:jobId', requireAuth, validate(schema), async (req, res, next) => {
  try {
    const b = body<z.infer<typeof schema>>(req);
    const r = await q('INSERT INTO reports (job_id, user_id, reason, detail) VALUES ($1,$2,$3,$4) RETURNING *', [Number(req.params.jobId), req.user!.id, b.reason, b.detail ?? null]);
    const count = await q<{ n: number }>('SELECT count(*)::int AS n FROM reports WHERE job_id=$1 AND status=$2', [Number(req.params.jobId), 'open']);
    res.status(201).json({ report: r.rows[0], openReportsOnJob: count.rows[0].n });
  } catch (e) { next(e); }
});
