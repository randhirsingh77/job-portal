import { Router } from 'express';
import { z } from 'zod';
import { q } from '../../db/pool.js';
import { validate, body } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { notFound } from '../../utils/errors.js';

export const usersRouter = Router();
const profileSchema = z.object({
  city: z.string().max(80).nullable().optional(), batchYear: z.number().min(2000).max(2100).nullable().optional(),
  degree: z.string().max(120).nullable().optional(), branch: z.string().max(120).nullable().optional(),
  percent: z.number().min(0).max(100).nullable().optional(), backlogs: z.number().min(0).max(50).optional(),
  skills: z.array(z.string().max(60)).max(50).optional(), resumeUrl: z.string().url().max(500).nullable().optional(),
  resumeText: z.string().max(20000).nullable().optional(),
  preferredRoles: z.array(z.string().max(80)).max(20).optional(), preferredCities: z.array(z.string().max(80)).max(20).optional(),
  minSalary: z.number().min(0).nullable().optional(), college: z.string().max(200).nullable().optional(),
  currentEmployer: z.string().max(200).nullable().optional(), phone: z.string().max(20).nullable().optional(),
  githubUrl: z.string().url().max(500).nullable().optional(), linkedinUrl: z.string().url().max(500).nullable().optional(),
  portfolioUrl: z.string().url().max(500).nullable().optional(), summary: z.string().max(2000).nullable().optional(),
  noticePeriod: z.string().max(80).nullable().optional(), discoverableAlumni: z.boolean().optional(),
});
usersRouter.get('/profile', requireAuth, requireRole('seeker'), async (req, res, next) => {
  try {
    const r = await q('SELECT * FROM seeker_profiles WHERE user_id=$1', [req.user!.id]);
    if (!r.rows.length) throw notFound('Profile not found');
    res.json({ profile: r.rows[0] });
  } catch (e) { next(e); }
});
usersRouter.put('/profile', requireAuth, requireRole('seeker'), validate(profileSchema), async (req, res, next) => {
  try {
    const b = body<z.infer<typeof profileSchema>>(req);
    const r = await q(
      `UPDATE seeker_profiles SET city=$2, batch_year=$3, degree=$4, branch=$5, percent=$6, backlogs=COALESCE($7, backlogs),
       skills=COALESCE($8, skills), resume_url=$9, resume_text=$10, preferred_roles=COALESCE($11, preferred_roles),
       preferred_cities=COALESCE($12, preferred_cities), min_salary=$13, college=$14, current_employer=$15, phone=$16,
       github_url=$17, linkedin_url=$18, portfolio_url=$19, summary=$20, notice_period=$21,
       discoverable_alumni=COALESCE($22, discoverable_alumni), updated_at=now() WHERE user_id=$1 RETURNING *`,
      [req.user!.id, b.city ?? null, b.batchYear ?? null, b.degree ?? null, b.branch ?? null, b.percent ?? null, b.backlogs ?? null,
       b.skills ?? null, b.resumeUrl ?? null, b.resumeText ?? null, b.preferredRoles ?? null, b.preferredCities ?? null,
       b.minSalary ?? null, b.college ?? null, b.currentEmployer ?? null, b.phone ?? null, b.githubUrl ?? null,
       b.linkedinUrl ?? null, b.portfolioUrl ?? null, b.summary ?? null, b.noticePeriod ?? null, b.discoverableAlumni ?? null]);
    res.json({ profile: r.rows[0] });
  } catch (e) { next(e); }
});
