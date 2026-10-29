import { Router } from 'express';
import { z } from 'zod';
import { q } from '../../db/pool.js';
import { validate, body } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';
import { domainOf, emailDomain, FREE_EMAIL_DOMAINS } from '../../utils/text.js';
import { fingerprint, SOURCE_RANK } from '../pipeline/dedupe.js';
import { extractFields } from '../pipeline/extract.js';
import { makeSnippet } from '../pipeline/normalise.js';
import { scoreJob } from '../trust/trust.js';
import { normaliseTitle } from '../../utils/text.js';

export const recruiterRouter = Router();
recruiterRouter.use(requireAuth, requireRole('recruiter'));

recruiterRouter.get('/me', async (req, res, next) => {
  try {
    const u = await q('SELECT u.company_id, c.* FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=$1', [req.user!.id]);
    const claims = await q('SELECT * FROM company_claims WHERE user_id=$1 ORDER BY created_at DESC', [req.user!.id]);
    res.json({ company: u.rows[0]?.id ? u.rows[0] : null, claims: claims.rows });
  } catch (e) { next(e); }
});

const claimSchema = z.object({ companyId: z.number().optional(), companyName: z.string().max(160).optional(), companyDomain: z.string().max(160).optional(), careersUrl: z.string().url().max(500).optional() });
/** Claim flow: the recruiter's work-email domain must equal the company domain. */
recruiterRouter.post('/claim', validate(claimSchema), async (req, res, next) => {
  try {
    const b = body<z.infer<typeof claimSchema>>(req);
    const me = await q<{ email: string }>('SELECT email FROM users WHERE id=$1', [req.user!.id]);
    const myDomain = emailDomain(me.rows[0].email);
    if (FREE_EMAIL_DOMAINS.has(myDomain)) throw badRequest('Claims require a work email on the company domain');
    let company: { id: number; name: string; website_domain: string | null } | undefined;
    if (b.companyId) { const r = await q<{ id: number; name: string; website_domain: string | null }>('SELECT id, name, website_domain FROM companies WHERE id=$1', [b.companyId]); company = r.rows[0]; }
    else if (b.companyName && b.companyDomain) {
      const { normaliseName } = await import('../../utils/text.js');
      const r = await q(`INSERT INTO companies (name, normalised_name, website_domain, careers_url) VALUES ($1,$2,$3,$4)
        ON CONFLICT (normalised_name) DO UPDATE SET website_domain=COALESCE(companies.website_domain, EXCLUDED.website_domain) RETURNING id, name, website_domain`,
        [b.companyName, normaliseName(b.companyName), domainOf(b.companyDomain), b.careersUrl ?? null]);
      company = r.rows[0] as { id: number; name: string; website_domain: string | null };
    }
    if (!company) throw badRequest('Provide companyId, or companyName + companyDomain');
    const cd = domainOf(company.website_domain ?? b.companyDomain ?? '');
    if (!cd || cd !== myDomain) throw badRequest('Your work email domain does not match this company domain, so the claim cannot be verified');
    await q("UPDATE companies SET verified_domain=TRUE WHERE id=$1", [company.id]);
    await q('UPDATE users SET company_id=$2 WHERE id=$1', [req.user!.id, company.id]);
    const claim = await q(`INSERT INTO company_claims (company_id, user_id, email_domain, company_domain, status, verification_method)
      VALUES ($1,$2,$3,$4,'verified','work_email_domain_match') RETURNING *`, [company.id, req.user!.id, myDomain, cd]);
    res.status(201).json({ claim: claim.rows[0], company });
  } catch (e) { next(e); }
});

const postSchema = z.object({
  title: z.string().min(3).max(200), locationText: z.string().max(200).default(''), city: z.string().max(80).optional(),
  remoteType: z.enum(['remote','hybrid','onsite','unknown']).default('unknown'),
  employmentType: z.string().max(60).optional(), salaryMin: z.number().min(0).optional(), salaryMax: z.number().min(0).optional(),
  salaryPeriod: z.enum(['month','year']).optional(), experienceMin: z.number().min(0).max(50).optional(), experienceMax: z.number().min(0).max(50).optional(),
  skills: z.array(z.string().max(60)).max(30).default([]), batchYears: z.array(z.number().min(2000).max(2100)).max(8).default([]),
  description: z.string().min(30).max(8000), deadline: z.string().datetime().optional(),
  applyUrl: z.string().url().max(500).optional(),
  lifecycle: z.record(z.string(), z.string()).optional(),
});
async function ownCompany(req: { user?: { companyId: number | null } }) {
  if (!req.user?.companyId) throw forbidden('Claim a company before posting jobs');
  const r = await q<{ id: number; name: string; website_domain: string | null; first_direct_approved: boolean }>('SELECT id, name, website_domain, first_direct_approved FROM companies WHERE id=$1', [req.user.companyId]);
  if (!r.rows.length) throw forbidden('Claim a company before posting jobs');
  return r.rows[0];
}
recruiterRouter.post('/jobs', validate(postSchema), async (req, res, next) => {
  try {
    const company = await ownCompany(req);
    const b = body<z.infer<typeof postSchema>>(req);
    const claim = await q("SELECT id FROM company_claims WHERE company_id=$1 AND user_id=$2 AND status='verified'", [company.id, req.user!.id]);
    if (!claim.rows.length) throw forbidden('Your company claim is not verified yet');
    const applyUrl = b.applyUrl ?? `https://${company.website_domain ?? ''}/careers`;
    const trust = scoreJob({ title: b.title, description: b.description, applyUrl, companyDomain: company.website_domain, sourceKind: 'direct', salaryMin: b.salaryMin ?? null }, company.name);
    if (trust.blocked) { res.status(422).json({ error: { code: 'trust_blocked', message: 'This posting was blocked by the trust rules', reasons: trust.reasons } }); return; }
    const src = await q("SELECT id FROM sources WHERE company_id=$1 AND kind='direct'", [company.id]);
    let sourceId = src.rows[0]?.id as number | undefined;
    if (!sourceId) { const s = await q("INSERT INTO sources (company_id, kind, detection_status) VALUES ($1,'direct','recruiter_registered') RETURNING id", [company.id]); sourceId = s.rows[0].id; }
    // First direct jobs from a newly claimed company wait in review; later ones publish directly.
    const status = company.first_direct_approved ? 'live' : 'review';
    const fp = fingerprint(company.name, b.title, b.locationText);
    const extracted = extractFields(b.description, b.locationText);
    const ins = await q(`INSERT INTO jobs (company_id,title,normalised_title,location_text,city,remote_type,experience_min,experience_max,
      salary_min,salary_max,salary_period,employment_type,skills,batch_years,snippet,description_text,apply_url,canonical_source_id,
      fingerprint,status,date_posted,deadline_at,trust_tier,risk_score,risk_reasons,badge_text,last_verified_at,lifecycle)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,now(),$21,$22,$23,$24,$25,now(),$26) RETURNING *`,
      [company.id, b.title, normaliseTitle(b.title), b.locationText, b.city ?? extracted.city, b.remoteType, b.experienceMin ?? extracted.experienceMin, b.experienceMax ?? extracted.experienceMax,
       b.salaryMin ?? null, b.salaryMax ?? null, b.salaryPeriod ?? null, b.employmentType ?? null, b.skills.length ? b.skills : extracted.skills,
       b.batchYears.length ? b.batchYears : extracted.batchYears, makeSnippet(b.description), b.description, applyUrl, sourceId, fp, status,
       b.deadline ?? null, trust.tier, trust.riskScore, trust.reasons, trust.badgeText, JSON.stringify(b.lifecycle ?? {})]);
    await q('INSERT INTO job_sources (job_id, source_id, source_url, source_rank) VALUES ($1,$2,$3,$4)', [ins.rows[0].id, sourceId, applyUrl, SOURCE_RANK.direct]);
    await q('INSERT INTO trust_events (job_id, source_id, rule, outcome, detail) VALUES ($1,$2,$3,$4,$5)', [ins.rows[0].id, sourceId, 'direct_posting', status, trust.reasons.join(',') || 'trust checks passed']);
    res.status(201).json({ job: ins.rows[0], statusNote: status === 'review' ? 'Your first direct postings are reviewed before they go live.' : 'Live now.' });
  } catch (e) { next(e); }
});
recruiterRouter.get('/jobs', async (req, res, next) => {
  try { const company = await ownCompany(req); const r = await q('SELECT * FROM jobs WHERE company_id=$1 ORDER BY created_at DESC', [company.id]); res.json({ jobs: r.rows }); } catch (e) { next(e); }
});
recruiterRouter.patch('/jobs/:id', validate(postSchema.partial()), async (req, res, next) => {
  try {
    const company = await ownCompany(req);
    const job = await q('SELECT * FROM jobs WHERE id=$1 AND company_id=$2', [Number(req.params.id), company.id]);
    if (!job.rows.length) throw notFound('Job not found for your company');
    const b = body<Partial<z.infer<typeof postSchema>>>(req);
    const r = await q(`UPDATE jobs SET title=COALESCE($2,title), location_text=COALESCE($3,location_text), salary_min=COALESCE($4,salary_min),
      salary_max=COALESCE($5,salary_max), deadline_at=COALESCE($6,deadline_at), updated_at=now() WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.title ?? null, b.locationText ?? null, b.salaryMin ?? null, b.salaryMax ?? null, b.deadline ?? null]);
    res.json({ job: r.rows[0] });
  } catch (e) { next(e); }
});
recruiterRouter.post('/jobs/:id/close', async (req, res, next) => {
  try {
    const company = await ownCompany(req);
    const r = await q("UPDATE jobs SET status='expired', updated_at=now() WHERE id=$1 AND company_id=$2 RETURNING *", [Number(req.params.id), company.id]);
    if (!r.rows.length) throw notFound('Job not found for your company');
    res.json({ job: r.rows[0] });
  } catch (e) { next(e); }
});
