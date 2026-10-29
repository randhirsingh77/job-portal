import type { Adapter, RawJob } from './types.js';
import { stripHtml } from '../../../utils/text.js';
interface WJob { id: number | string; title: string; url?: string; application_url?: string; location_str?: string; locations?: { city?: string; country?: string }[]; employment_type?: string; published?: string; description?: string; salary_min?: number; salary_max?: number }
export const workable: Adapter = {
  atsType: 'workable',
  feedUrl: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`,
  parse(payload: unknown): RawJob[] {
    const jobs = (payload as { jobs?: WJob[] })?.jobs ?? [];
    return jobs.map((j) => ({ externalId: String(j.id), title: j.title,
      locationText: j.location_str ?? (j.locations?.map((l) => [l.city, l.country].filter(Boolean).join(', ')).join('; ') ?? ''),
      description: j.description ? stripHtml(j.description) : j.title, applyUrl: j.application_url ?? j.url ?? '',
      datePosted: j.published ? new Date(j.published) : null, deadline: null,
      employmentType: j.employment_type ?? null, salaryMin: j.salary_min ?? null, salaryMax: j.salary_max ?? null })).filter((j) => j.applyUrl);
  },
};
