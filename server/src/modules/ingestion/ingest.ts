import { q } from '../../db/pool.js';
import { ADAPTERS } from './adapters/index.js';
import type { RawJob } from './adapters/types.js';
import { extractFields } from '../pipeline/extract.js';
import { makeSnippet } from '../pipeline/normalise.js';
import { canonicaliseUrl, fingerprint, SOURCE_RANK } from '../pipeline/dedupe.js';
import { normaliseTitle } from '../../utils/text.js';
import { scoreJob } from '../trust/trust.js';
import { shouldExpire } from '../pipeline/freshness.js';

export interface SourceRow { id: number; company_id: number; kind: string; ats_type: string | null; slug: string | null; feed_url: string | null }
export interface CompanyRow { id: number; name: string; website_domain: string | null }

async function logTrust(jobId: number, sourceId: number, rule: string, outcome: string, detail: string) {
  await q('INSERT INTO trust_events (job_id, source_id, rule, outcome, detail) VALUES ($1,$2,$3,$4,$5)', [jobId, sourceId, rule, outcome, detail]);
}

/** Run one parsed posting through the pipeline and upsert the canonical job. */
export async function pipelineJob(source: SourceRow, company: CompanyRow, raw: RawJob): Promise<'new' | 'updated'> {
  const applyUrl = canonicaliseUrl(raw.applyUrl);
  const extracted = extractFields(raw.description, raw.locationText);
  const fp = fingerprint(company.name, raw.title, raw.locationText);
  const trust = scoreJob({ title: raw.title, description: raw.description, applyUrl, companyDomain: company.website_domain, sourceKind: source.kind, salaryMin: raw.salaryMin ?? extracted.salaryMin }, company.name);
  const status = trust.blocked ? 'blocked' : 'live';
  const rank = SOURCE_RANK[source.kind] ?? 50;
  const existing = await q<{ id: number; canonical_source_id: number | null }>('SELECT id, canonical_source_id FROM jobs WHERE fingerprint=$1', [fp]);
  const snippet = makeSnippet(raw.description);
  if (existing.rows.length === 0) {
    const ins = await q<{ id: number }>(
      `INSERT INTO jobs (company_id,title,normalised_title,location_text,city,remote_type,experience_min,experience_max,
        salary_min,salary_max,salary_period,employment_type,skills,batch_years,snippet,apply_url,canonical_source_id,
        fingerprint,status,first_seen_at,last_seen_at,date_posted,deadline_at,trust_tier,risk_score,risk_reasons,badge_text,last_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),now(),$20,$21,$22,$23,$24,$25,now()) RETURNING id`,
      [company.id, raw.title, normaliseTitle(raw.title), raw.locationText, extracted.city, extracted.remoteType,
       extracted.experienceMin, extracted.experienceMax,
       raw.salaryMin ?? extracted.salaryMin, raw.salaryMax ?? extracted.salaryMax, extracted.salaryPeriod, raw.employmentType,
       extracted.skills, extracted.batchYears, snippet, applyUrl, source.id, fp, status,
       raw.datePosted, raw.deadline ?? extracted.deadline, trust.tier, trust.riskScore, trust.reasons, trust.badgeText]);
    const jobId = ins.rows[0].id;
    await q('INSERT INTO job_sources (job_id, source_id, source_url, source_rank) VALUES ($1,$2,$3,$4)', [jobId, source.id, applyUrl, rank]);
    await q('INSERT INTO freshness_checks (job_id, method, result, detail) VALUES ($1,$2,$3,$4)', [jobId, 'feed_poll', 'alive', 'seen in source feed']);
    await logTrust(jobId, source.id, trust.blocked ? 'hard_block' : 'provenance', trust.blocked ? 'blocked' : trust.tier, trust.reasons.join(',') || 'provenance ok');
    return 'new';
  }
  const jobId = existing.rows[0].id;
  // Keep the higher-ranked (lower number) source as canonical copy.
  const cur = await q<{ rank: number }>('SELECT source_rank AS rank FROM job_sources WHERE job_id=$1 AND source_id=$2', [jobId, existing.rows[0].canonical_source_id ?? -1]);
  const canonicalRank = cur.rows[0]?.rank ?? 99;
  const updates: string[] = ['last_seen_at=now()', 'missed_polls=0', 'last_verified_at=now()'];
  const params: unknown[] = [jobId];
  if (rank <= canonicalRank) {
    updates.push('repost_count = repost_count + CASE WHEN status=\'expired\' THEN 1 ELSE 0 END', 'last_reposted_at = CASE WHEN status=\'expired\' THEN now() ELSE last_reposted_at END', 'snippet=$2', 'skills=$3', 'apply_url=$4', 'canonical_source_id=$5', 'trust_tier=$6', 'risk_score=$7', 'risk_reasons=$8', 'badge_text=$9', "status = CASE WHEN status='blocked' THEN 'blocked' ELSE 'live' END");
    params.push(snippet, extracted.skills, applyUrl, source.id, trust.tier, trust.riskScore, trust.reasons, trust.badgeText);
  }
  await q(`UPDATE jobs SET ${updates.join(', ')} WHERE id=$1`, params);
  if (trust.blocked && rank <= canonicalRank) await q("UPDATE jobs SET status='blocked' WHERE id=$1", [jobId]);
  await q(`INSERT INTO job_sources (job_id, source_id, source_url, source_rank) VALUES ($1,$2,$3,$4)
           ON CONFLICT (job_id, source_id) DO UPDATE SET last_seen_at=now(), source_url=EXCLUDED.source_url`, [jobId, source.id, applyUrl, rank]);
  return 'updated';
}

/** Expire jobs of a source that were not seen in this finished poll. */
export async function expireMissingForSource(sourceId: number, seenFingerprints: Set<string>): Promise<number> {
  const rows = await q<{ id: number; fingerprint: string; missed_polls: number; deadline_at: Date | null }>(
    `SELECT j.id, j.fingerprint, j.missed_polls, j.deadline_at FROM jobs j
     JOIN job_sources js ON js.job_id=j.id AND js.source_id=$1 WHERE j.status='live'`, [sourceId]);
  let expired = 0;
  for (const r of rows.rows) {
    if (seenFingerprints.has(r.fingerprint)) continue;
    const missed = Number(r.missed_polls) + 1;
    await q('UPDATE jobs SET missed_polls=$2 WHERE id=$1', [r.id, missed]);
    const check = shouldExpire({ missedPolls: missed, deadlineAt: r.deadline_at ? new Date(r.deadline_at) : null, now: new Date() });
    await q('INSERT INTO freshness_checks (job_id, method, result, detail) VALUES ($1,$2,$3,$4)', [r.id, 'feed_poll', check.expire ? 'gone' : 'unknown', check.reason ?? `missed ${missed} poll`]);
    if (check.expire) { await q("UPDATE jobs SET status='expired' WHERE id=$1", [r.id]); expired++; }
  }
  return expired;
}

/** Ingest an already-fetched payload (used by the collector and by tests). */
export async function ingestPayload(source: SourceRow, company: CompanyRow, payload: unknown): Promise<{ fetched: number; created: number; expired: number }> {
  const adapter = source.ats_type ? ADAPTERS[source.ats_type] : undefined;
  if (!adapter) throw new Error(`No adapter for ats_type=${source.ats_type}`);
  const raws = adapter.parse(payload);
  const run = await q<{ id: number }>('INSERT INTO collector_runs (source_id, status) VALUES ($1,$2) RETURNING id', [source.id, 'running']);
  let created = 0; const seen = new Set<string>();
  for (const raw of raws) {
    await q('INSERT INTO raw_postings (source_id, external_id, payload) VALUES ($1,$2,$3)', [source.id, raw.externalId, JSON.stringify(raw)]);
    seen.add(fingerprint(company.name, raw.title, raw.locationText));
    if ((await pipelineJob(source, company, raw)) === 'new') created++;
  }
  const expired = await expireMissingForSource(source.id, seen);
  await q("UPDATE collector_runs SET status='ok', finished_at=now(), fetched_count=$2, new_count=$3, expired_count=$4 WHERE id=$1", [run.rows[0].id, raws.length, created, expired]);
  await q('UPDATE sources SET last_polled_at=now(), last_status=$2, missed_polls=0 WHERE id=$1', [source.id, 'ok']);
  return { fetched: raws.length, created, expired };
}

/** Fetch one source live over HTTPS and ingest it. */
export async function collectSource(sourceId: number): Promise<{ fetched: number; created: number; expired: number }> {
  const s = await q<SourceRow & CompanyRow>('SELECT s.*, c.name, c.website_domain FROM sources s JOIN companies c ON c.id=s.company_id WHERE s.id=$1', [sourceId]);
  if (!s.rows.length) throw new Error('source not found');
  const row = s.rows[0];
  const adapter = row.ats_type ? ADAPTERS[row.ats_type] : undefined;
  if (!adapter || !row.slug) throw new Error('source is not a feed source');
  const url = row.feed_url ?? adapter.feedUrl(row.slug);
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'VerifiedJobsCollector/0.1 (+contact via repo README)', accept: 'application/json' } });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const payload = await res.json();
    const etag = res.headers.get('etag'); if (etag) await q('UPDATE sources SET etag=$2 WHERE id=$1', [sourceId, etag]);
    return await ingestPayload({ id: row.id, company_id: row.company_id, kind: row.kind, ats_type: row.ats_type, slug: row.slug, feed_url: row.feed_url }, { id: row.company_id, name: row.name, website_domain: row.website_domain }, payload);
  } catch (e) {
    await q('INSERT INTO collector_runs (source_id, status, finished_at, error) VALUES ($1,$2,now(),$3)', [sourceId, 'failed', String(e).slice(0, 500)]);
    await q('UPDATE sources SET last_status=$2 WHERE id=$1', [sourceId, 'failed']);
    throw e;
  }
}
