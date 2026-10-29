export interface RawJob {
  externalId: string; title: string; locationText: string; description: string; applyUrl: string;
  datePosted: Date | null; deadline: Date | null; employmentType: string | null;
  salaryMin: number | null; salaryMax: number | null;
}
export interface Adapter { atsType: string; feedUrl: (slug: string) => string; parse: (payload: unknown) => RawJob[]; }
