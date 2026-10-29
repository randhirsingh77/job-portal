import type { Adapter, RawJob } from './types.js';
import { stripHtml } from '../../../utils/text.js';
interface LeverJob { id: string; text: string; hostedUrl: string; applyUrl?: string; createdAt?: number; description?: string; descriptionPlain?: string; categories?: { location?: string; commitment?: string } }
export const lever: Adapter = {
  atsType: 'lever',
  feedUrl: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  parse(payload: unknown): RawJob[] {
    const jobs = Array.isArray(payload) ? (payload as LeverJob[]) : [];
    return jobs.map((j) => ({ externalId: j.id, title: j.text, locationText: j.categories?.location ?? '',
      description: j.descriptionPlain ?? (j.description ? stripHtml(j.description) : j.text),
      applyUrl: j.applyUrl ?? j.hostedUrl, datePosted: j.createdAt ? new Date(j.createdAt) : null, deadline: null,
      employmentType: j.categories?.commitment ?? null, salaryMin: null, salaryMax: null }));
  },
};
