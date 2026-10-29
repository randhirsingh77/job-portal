import { Router } from 'express';
import { q } from '../../db/pool.js';
import { notFound } from '../../utils/errors.js';
export const companiesRouter = Router();
companiesRouter.get('/', async (_req, res, next) => {
  try {
    const r = await q(`SELECT c.*, (SELECT count(*)::int FROM jobs j WHERE j.company_id=c.id AND j.status='live') AS live_jobs FROM companies c ORDER BY c.name`);
    res.json({ companies: r.rows });
  } catch (e) { next(e); }
});
companiesRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await q('SELECT * FROM companies WHERE id=$1', [Number(req.params.id)]);
    if (!c.rows.length) throw notFound('Company not found');
    const jobs = await q("SELECT * FROM jobs WHERE company_id=$1 AND status='live' ORDER BY first_seen_at DESC", [Number(req.params.id)]);
    // Honest referral view: only seekers who opted in, self-declared college/employer.
    const alumni = await q(
      `SELECT p.college, p.current_employer, u.name FROM seeker_profiles p JOIN users u ON u.id=p.user_id
       WHERE p.discoverable_alumni=TRUE AND p.college IS NOT NULL AND LOWER(COALESCE(p.current_employer,'')) = LOWER($1)`,
      [String(c.rows[0].name)]);
    res.json({ company: c.rows[0], jobs: jobs.rows, peopleFromYourCollegeNote: 'Self-declared, opted-in profiles only. This list is people whose declared current employer matches this company; compare the college with your own profile.', alumniAtCompany: alumni.rows });
  } catch (e) { next(e); }
});
