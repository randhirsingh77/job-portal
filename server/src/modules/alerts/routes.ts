import { Router } from 'express';
import { z } from 'zod';
import { q } from '../../db/pool.js';
import { validate, body } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { deliverAlert } from './deliver.js';
export const alertsRouter = Router();
const schema = z.object({ keyword: z.string().max(120).optional(), city: z.string().max(80).optional(), batchYear: z.number().min(2000).max(2100).optional(), channel: z.enum(['email','push','whatsapp']).default('email') });
alertsRouter.get('/', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try { const r = await q('SELECT * FROM alerts WHERE user_id=$1 ORDER BY created_at DESC', [req.user!.id]); res.json({ alerts: r.rows }); } catch (e) { next(e); }
});
alertsRouter.post('/', requireAuth, requireRole('seeker'), validate(schema), async (req, res, next) => {
  try {
    const b = body<z.infer<typeof schema>>(req);
    const r = await q('INSERT INTO alerts (user_id, keyword, city, batch_year, channel) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.user!.id, b.keyword ?? null, b.city ?? null, b.batchYear ?? null, b.channel]);
    const delivery = await deliverAlert(req.user!.id, r.rows[0].id, b.channel, `Alert created: ${b.keyword ?? 'jobs'} ${b.city ?? ''} ${b.batchYear ?? ''}`.trim());
    res.status(201).json({ alert: r.rows[0], deliveryStatus: delivery });
  } catch (e) { next(e); }
});
alertsRouter.delete('/:id', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try { await q('DELETE FROM alerts WHERE id=$1 AND user_id=$2', [Number(req.params.id), req.user!.id]); res.status(204).end(); } catch (e) { next(e); }
});
alertsRouter.get('/deliveries/mine', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try { const r = await q('SELECT * FROM alert_deliveries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user!.id]); res.json({ deliveries: r.rows }); } catch (e) { next(e); }
});
