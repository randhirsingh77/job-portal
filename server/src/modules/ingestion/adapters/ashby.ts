import type { Adapter, RawJob } from './types.js';
interface AshbyJob { id: string; title: string; location: string; jobUrl: string; applyUrl?: string; publishedAt?: string; isRemote?: boolean; isListed?: boolean; descriptionPlain?: string; employmentType?: string; compensation?: { summaryComponents?: { fixedRange?: { minValue?: number; maxValue?: number } }[] } }
export const ashby: Adapter = {
  atsType: 'ashby',
  feedUrl: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
  parse(payload: unknown): RawJob[] {
    const jobs = (payload as { jobs?: AshbyJob[] })?.jobs ?? [];
    return jobs.filter((j) => j.isListed !== false).map((j) => {
      const fixed = j.compensation?.summaryComponents?.map((c) => c.fixedRange).find((r) => r && (r.minValue || r.maxValue));
      return { externalId: j.id, title: j.title, locationText: j.isRemote ? `${j.location} (Remote)` : j.location,
        description: j.descriptionPlain ?? j.title, applyUrl: j.applyUrl ?? j.jobUrl,
        datePosted: j.publishedAt ? new Date(j.publishedAt) : null, deadline: null,
        employmentType: j.employmentType ?? null, salaryMin: fixed?.minValue ?? null, salaryMax: fixed?.maxValue ?? null };
    });
  },
};
