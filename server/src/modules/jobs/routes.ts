import { Router, type Request } from 'express';
import { z } from 'zod';
import { q } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { validate, body } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { derivedSignals, hinglishSummary } from './signals.js';
import { computeMatch, type ProfileForMatch } from './match.js';
import { prepChecklist } from './prep.js';

export const jobsRouter = Router();

const JOB_COLS = `j.*, c.name AS company_name, c.website_domain, c.id AS company_id,
  (SELECT count(*) FROM jobs j2 WHERE j2.company_id=j.company_id AND j2.status='live' AND j2.first_seen_at > now() - interval '7 days')::int AS company_active_count`;

async function shape(row: Record<string, unknown>) {
  return { ...row, signals: derivedSignals(row as never) };
}

const searchSchema = z.object({
  q: z.string().max(200).optional(), city: z.string().max(80).optional(), remote: z.enum(['remote','hybrid','onsite']).optional(),
  expMax: z.coerce.number().min(0).max(50).optional(), salaryMin: z.coerce.number().min(0).optional(),
  postedDays: z.coerce.number().min(1).max(90).optional(), batch: z.coerce.number().min(2000).max(2100).optional(),
  collection: z.enum(['closing-soon','new-today','fresher','remote-india']).optional(),
  page: z.coerce.number().min(1).default(1), limit: z.coerce.number().min(1).max(50).default(20),
});
jobsRouter.get('/', validate(searchSchema, 'query'), async (req, res, next) => {
  try {
    const s = req.validatedQuery as z.infer<typeof searchSchema>;
    const where: string[] = ["j.status='live'"]; const params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (s.q) add(`j.search_doc @@ plainto_tsquery('english', ?)`, s.q);
    if (s.city) add('LOWER(j.city)=LOWER(?)', s.city);
    if (s.remote) add('j.remote_type=?', s.remote);
    if (s.expMax !== undefined) add('(j.experience_min IS NULL OR j.experience_min <= ?)', s.expMax);
    if (s.salaryMin !== undefined) add('(j.salary_max IS NULL OR j.salary_max >= ?)', s.salaryMin);
    if (s.postedDays) add('j.first_seen_at > now() - (? * interval \'1 day\')', s.postedDays);
    if (s.batch) add('(? = ANY(j.batch_years) OR cardinality(j.batch_years)=0)', s.batch);
    if (s.collection === 'closing-soon') where.push("j.deadline_at IS NOT NULL AND j.deadline_at BETWEEN now() AND now() + interval '7 days'");
    if (s.collection === 'new-today') where.push('j.first_seen_at::date = now()::date');
    if (s.collection === 'fresher') where.push('(j.experience_min IS NULL OR j.experience_min <= 1)');
    if (s.collection === 'remote-india') where.push("j.remote_type='remote'");
    params.push(s.limit, (s.page - 1) * s.limit);
    const r = await q(`SELECT ${JOB_COLS} FROM jobs j JOIN companies c ON c.id=j.company_id WHERE ${where.join(' AND ')} ORDER BY j.first_seen_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ jobs: await Promise.all(r.rows.map(shape)), page: s.page, limit: s.limit });
  } catch (e) { next(e); }
});

async function getJob(id: number) {
  const r = await q(`SELECT ${JOB_COLS} FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=$1`, [id]);
  return r.rows[0] as Record<string, unknown> | undefined;
}

jobsRouter.get('/:id', async (req, res, next) => {
  try {
    const job = await getJob(Number(req.params.id));
    if (!job) throw notFound('Job not found');
    if (job.status === 'expired') throw new HttpError(410, 'gone', 'This listing has closed at the source and is no longer available');
    const sal = await q<{ med: string | null; n: number }>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY salary_min) AS med, count(*)::int AS n FROM jobs
       WHERE status='live' AND normalised_title=$1 AND city IS NOT DISTINCT FROM $2 AND salary_min IS NOT NULL AND id <> $3`,
      [job.normalised_title, job.city, job.id]);
    const estimate = !job.salary_min && sal.rows[0]?.med && Number(sal.rows[0].n) >= 3
      ? { value: Math.round(Number(sal.rows[0].med)), basis: `estimate from ${sal.rows[0].n} listings on this portal` } : null;
    const trust = await q('SELECT rule, outcome, detail, created_at FROM trust_events WHERE job_id=$1 ORDER BY created_at DESC LIMIT 20', [job.id]);
    res.json({ job: await shape(job), salaryEstimate: estimate, trustEvents: trust.rows, hinglishSummary: hinglishSummary(job as never) });
  } catch (e) { next(e); }
});

jobsRouter.get('/:id/jsonld', async (req, res, next) => {
  try {
    const job = await getJob(Number(req.params.id));
    if (!job) throw notFound('Job not found');
    if (job.status === 'expired') throw new HttpError(410, 'gone', 'This listing has closed');
    res.json({ '@context': 'https://schema.org', '@type': 'JobPosting', title: job.title,
      description: job.snippet, datePosted: (job.date_posted as Date ?? job.first_seen_at as Date)?.toISOString?.() ?? job.date_posted ?? job.first_seen_at,
      validThrough: job.deadline_at ?? undefined, employmentType: job.employment_type ?? undefined,
      hiringOrganization: { '@type': 'Organization', name: job.company_name },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.city ?? job.location_text ?? 'India' } },
      url: `${env.publicBaseUrl}/jobs/${job.id}` });
  } catch (e) { next(e); }
});

async function profileFor(userId: number): Promise<ProfileForMatch> {
  const r = await q<{ skills: string[]; batch_year: number | null; city: string | null; min_salary: string | null; resume_text: string | null }>(
    'SELECT skills, batch_year, city, min_salary, resume_text FROM seeker_profiles WHERE user_id=$1', [userId]);
  const p = r.rows[0];
  return { skills: p?.skills ?? [], batchYear: p?.batch_year ?? null, city: p?.city ?? null, minSalary: p?.min_salary ? Number(p.min_salary) : null, resumeText: p?.resume_text ?? null, experienceYears: 0 };
}
export async function jobForMatch(id: number) {
  const job = await getJob(id); if (!job) throw notFound('Job not found');
  return { title: String(job.title), skills: (job.skills as string[]) ?? [], experienceMin: job.experience_min ? Number(job.experience_min) : null, experienceMax: job.experience_max ? Number(job.experience_max) : null, batchYears: (job.batch_years as number[]) ?? [], city: (job.city as string) ?? null, remoteType: String(job.remote_type), salaryMin: job.salary_min ? Number(job.salary_min) : null, salaryMax: job.salary_max ? Number(job.salary_max) : null };
}

jobsRouter.get('/:id/match', requireAuth, async (req, res, next) => {
  try { res.json({ match: computeMatch(await profileFor(req.user!.id), await jobForMatch(Number(req.params.id))) }); } catch (e) { next(e); }
});
jobsRouter.get('/:id/prep', async (req, res, next) => {
  try {
    const job = await getJob(Number(req.params.id)); if (!job) throw notFound('Job not found');
    res.json({ jobTitle: job.title, company: job.company_name, checklist: prepChecklist((job.skills as string[]) ?? []),
      note: 'A study checklist generated from the skills in this listing. These are topics to prepare, not questions shared by the company.' });
  } catch (e) { next(e); }
});
jobsRouter.get('/:id/apply-assist', requireAuth, async (req, res, next) => {
  try {
    const job = await getJob(Number(req.params.id)); if (!job) throw notFound('Job not found');
    const u = await q('SELECT u.name, u.email, p.phone, p.github_url, p.linkedin_url, p.portfolio_url, p.summary, p.notice_period, p.resume_url, p.city FROM users u LEFT JOIN seeker_profiles p ON p.user_id=u.id WHERE u.id=$1', [req.user!.id]);
    const p = u.rows[0] ?? {};
    const answers = [
      { label: 'Full name', value: p.name ?? '' }, { label: 'Email', value: p.email ?? '' }, { label: 'Phone', value: p.phone ?? '' },
      { label: 'Current location', value: p.city ?? '' }, { label: 'GitHub', value: p.github_url ?? '' },
      { label: 'LinkedIn', value: p.linkedin_url ?? '' }, { label: 'Portfolio', value: p.portfolio_url ?? '' },
      { label: 'Resume link', value: p.resume_url ?? '' }, { label: 'Notice period', value: p.notice_period ?? '' },
      { label: 'Short summary', value: p.summary ?? '' },
      { label: 'Why this role', value: `I am applying for ${job.title} at ${job.company_name}. My profile lists these matching skills: ${((job.skills as string[]) ?? []).join(', ') || 'see my resume'}.` },
    ];
    res.json({ answers, note: 'Copy-ready answers from your own profile. Paste them into the official application form — this portal never submits an application for you.' });
  } catch (e) { next(e); }
});
