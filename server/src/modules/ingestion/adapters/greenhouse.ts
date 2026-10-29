import type { Adapter, RawJob } from './types.js';
import { stripHtml } from '../../../utils/text.js';
interface GhJob { id: number; title: string; absolute_url: string; location?: { name?: string }; first_published?: string; application_deadline?: string | null; content?: string }
export const greenhouse: Adapter = {
  atsType: 'greenhouse',
  feedUrl: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
  parse(payload: unknown): RawJob[] {
    const jobs = (payload as { jobs?: GhJob[] })?.jobs ?? [];
    return jobs.map((j) => ({ externalId: String(j.id), title: j.title, locationText: j.location?.name ?? '',
      description: j.content ? stripHtml(j.content) : j.title, applyUrl: j.absolute_url,
      datePosted: j.first_published ? new Date(j.first_published) : null,
      deadline: j.application_deadline ? new Date(j.application_deadline) : null,
      employmentType: null, salaryMin: null, salaryMax: null }));
  },
};
