import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { canonicaliseUrl, fingerprint } from '../src/modules/pipeline/dedupe.js';
import { extractFields } from '../src/modules/pipeline/extract.js';
import { stripPii, makeSnippet } from '../src/modules/pipeline/normalise.js';
import { shouldExpire } from '../src/modules/pipeline/freshness.js';
import { scoreJob } from '../src/modules/trust/trust.js';
import { ADAPTERS } from '../src/modules/ingestion/adapters/index.js';
import { computeMatch, missingKeywordsFor } from '../src/modules/jobs/match.js';
import { prepChecklist } from '../src/modules/jobs/prep.js';
import { derivedSignals, hinglishSummary } from '../src/modules/jobs/signals.js';

const fx = (n: string) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));

describe('dedupe', () => {
  it('canonicalises tracking params away', () => {
    expect(canonicaliseUrl('https://Boards.Greenhouse.io/acme/jobs/1?utm_source=x&gh_src=y#top')).toBe('https://boards.greenhouse.io/acme/jobs/1');
  });
  it('same job from two sources gets the same fingerprint', () => {
    expect(fingerprint('Acme Pvt Ltd', 'React Developer!', 'Bengaluru')).toBe(fingerprint('Acme', 'react developer', 'bengaluru'));
    expect(fingerprint('Acme', 'React Developer', 'Bengaluru')).not.toBe(fingerprint('Acme', 'React Developer', 'Pune'));
  });
});

describe('extraction', () => {
  const x = extractFields('React and TypeScript role, 1-3 years, 2026 batch, apply by 15 Nov 2026, salary Rs 40000 - 60000 per month, contact me@acme.com', 'Bengaluru');
  it('finds skills, experience, batch, deadline, salary, city', () => {
    expect(x.skills).toContain('react'); expect(x.skills).toContain('typescript');
    expect(x.experienceMin).toBe(1); expect(x.experienceMax).toBe(3);
    expect(x.batchYears).toEqual([2026]); expect(x.salaryMin).toBe(40000); expect(x.salaryPeriod).toBe('month');
    expect(x.deadline?.getUTCFullYear()).toBe(2026); expect(x.city).toBe('bengaluru');
  });
  it('strips recruiter PII', () => {
    expect(stripPii('call 9876543210 or mail a@b.com')).not.toContain('9876543210');
    expect(makeSnippet('mail a@b.com for details')).not.toContain('a@b.com');
  });
});

describe('trust rules', () => {
  it('hard-blocks fee scams', () => {
    const r = scoreJob({ title: 'Data entry', description: 'Pay a refundable registration fee of Rs 999 to apply', applyUrl: 'https://boards.greenhouse.io/x/1', companyDomain: 'x.com', sourceKind: 'ats_feed' }, 'X');
    expect(r.blocked).toBe(true); expect(r.reasons.join()).toContain('fee');
  });
  it('hard-blocks identity details before offer and task scams', () => {
    expect(scoreJob({ title: 'Clerk', description: 'Share your Aadhaar and bank details before to apply', applyUrl: 'https://x.com/a', companyDomain: 'x.com', sourceKind: 'ats_feed' }, 'X').blocked).toBe(true);
    expect(scoreJob({ title: 'Earn', description: 'Like videos and earn Rs 30000 daily', applyUrl: 'https://x.com/a', companyDomain: 'x.com', sourceKind: 'ats_feed' }, 'X').blocked).toBe(true);
  });
  it('verified badge states the check for an official ATS apply link', () => {
    const r = scoreJob({ title: 'Dev', description: 'Normal role', applyUrl: 'https://boards.greenhouse.io/acme/1', companyDomain: 'acme.com', sourceKind: 'ats_feed' }, 'Acme');
    expect(r.blocked).toBe(false); expect(r.tier).toBe('verified_source'); expect(r.badgeText).toContain('official ATS board');
  });
  it('demotes shortener apply links', () => {
    const r = scoreJob({ title: 'Dev', description: 'role', applyUrl: 'https://bit.ly/abc', companyDomain: 'acme.com', sourceKind: 'aggregator_api' }, 'Acme');
    expect(r.riskScore).toBeGreaterThanOrEqual(40);
  });
});

describe('freshness', () => {
  it('expires after 2 missed polls or a passed deadline, never on age alone', () => {
    expect(shouldExpire({ missedPolls: 2, deadlineAt: null, now: new Date() }).expire).toBe(true);
    expect(shouldExpire({ missedPolls: 1, deadlineAt: null, now: new Date() }).expire).toBe(false);
    expect(shouldExpire({ missedPolls: 0, deadlineAt: new Date(Date.now() - 1000), now: new Date() }).expire).toBe(true);
  });
});

describe('adapters', () => {
  it('greenhouse parses jobs with apply urls', () => {
    const jobs = ADAPTERS.greenhouse.parse(fx('greenhouse.json'));
    expect(jobs).toHaveLength(2); expect(jobs[0].applyUrl).toContain('greenhouse.io');
  });
  it('lever, ashby (skips unlisted, reads salary), workable parse', () => {
    expect(ADAPTERS.lever.parse(fx('lever.json'))[0].employmentType).toBe('Full-time');
    const a = ADAPTERS.ashby.parse(fx('ashby.json')); expect(a).toHaveLength(1); expect(a[0].salaryMax).toBe(1400000);
    expect(ADAPTERS.workable.parse(fx('workable.json'))[0].title).toBe('QA Engineer');
  });
});

describe('match score with reasons', () => {
  const job = { title: 'Frontend Dev', skills: ['react','typescript','docker'], experienceMin: 1, experienceMax: 3, batchYears: [2026], city: 'bengaluru', remoteType: 'onsite', salaryMin: 400000, salaryMax: 700000 };
  const me = { skills: ['react','typescript'], experienceYears: 2, batchYear: 2026, city: 'bengaluru', minSalary: 500000, resumeText: 'built react apps' };
  it('scores and explains, listing gaps and missing keywords', () => {
    const m = computeMatch(me, job);
    expect(m.score).toBeGreaterThan(50);
    expect(m.reasons.join(' ')).toContain('skills in this listing');
    expect(m.missingKeywords).toEqual(['docker']);
    expect(missingKeywordsFor(me, job)).toEqual(['docker']);
  });
  it('prep checklist maps known skills and adds general topics', () => {
    const c = prepChecklist(['react','unknownskill']);
    expect(c[0].topics.length).toBeGreaterThan(2); expect(c[c.length - 1].skill).toBe('General');
  });
  it('signals and hinglish summary are derived, not invented', () => {
    const s = derivedSignals({ first_seen_at: new Date(), date_posted: new Date(), deadline_at: new Date(Date.now() + 3 * 86400000), last_seen_at: new Date(), status: 'live', snippet: 'Immediate joiner preferred' });
    expect(s.isNew).toBe(true); expect(s.closingSoon).toBe(true); expect(s.immediateJoinerMentioned).toBe(true);
    expect(hinglishSummary({ title: 'Dev', company_name: 'Acme', city: 'Pune', experience_min: 0, skills: ['react'], batch_years: [2026], deadline_at: null })).toContain('apply kar sakta hai');
  });
});
