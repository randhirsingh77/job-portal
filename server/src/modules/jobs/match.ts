export interface ProfileForMatch {
  skills: string[]; experienceYears?: number | null; batchYear?: number | null;
  city?: string | null; minSalary?: number | null; resumeText?: string | null;
}
export interface JobForMatch {
  title: string; skills: string[]; experienceMin: number | null; experienceMax: number | null;
  batchYears: number[]; city: string | null; remoteType: string; salaryMin: number | null; salaryMax: number | null;
}
export interface MatchResult { score: number; reasons: string[]; gaps: string[]; missingKeywords: string[] }

const norm = (s: string) => s.toLowerCase().trim();

/** Deterministic match: skills 50, experience 15, batch 15, location 10, salary 10. */
export function computeMatch(profile: ProfileForMatch, job: JobForMatch): MatchResult {
  const reasons: string[] = []; const gaps: string[] = [];
  const mySkills = new Set((profile.skills ?? []).map(norm));
  const jobSkills = (job.skills ?? []).map(norm);
  const matched = jobSkills.filter((s) => mySkills.has(s));
  const missingKeywords = jobSkills.filter((s) => !mySkills.has(s) && !(profile.resumeText ?? '').toLowerCase().includes(s));
  let score = 0;
  if (jobSkills.length === 0) { score += 25; reasons.push('This listing lists no specific skills, so the skill match cannot be scored fully'); }
  else {
    score += Math.round((matched.length / jobSkills.length) * 50);
    if (matched.length) reasons.push(`You have ${matched.length} of the ${jobSkills.length} skills in this listing: ${matched.join(', ')}`);
    if (missingKeywords.length) gaps.push(`Skills in the listing that are not in your profile or resume: ${missingKeywords.join(', ')}`);
  }
  if (job.experienceMin === null || job.experienceMin === undefined) score += 8;
  else if ((profile.experienceYears ?? 0) >= job.experienceMin) { score += 15; reasons.push(`Your experience (${profile.experienceYears ?? 0} yrs) meets the ${job.experienceMin} yr minimum`); }
  else gaps.push(`Listing asks for ${job.experienceMin}+ yrs experience`);
  if (!job.batchYears?.length) score += 8;
  else if (profile.batchYear && job.batchYears.includes(profile.batchYear)) { score += 15; reasons.push(`Your ${profile.batchYear} batch is eligible for this listing`); }
  else if (profile.batchYear) gaps.push(`Listing is for batch ${job.batchYears.join('/')}; your profile says ${profile.batchYear}`);
  else gaps.push('Add your batch year to your profile to check batch eligibility');
  if (job.remoteType === 'remote') { score += 10; reasons.push('Remote role, so location is not a barrier'); }
  else if (profile.city && job.city && norm(profile.city) === norm(job.city)) { score += 10; reasons.push(`Role is in your city (${job.city})`); }
  else if (job.city) gaps.push(`Role is in ${job.city}`);
  if (!job.salaryMin) score += 5;
  else if (!profile.minSalary) score += 5;
  else if (job.salaryMax !== null && job.salaryMax !== undefined ? job.salaryMax >= profile.minSalary : job.salaryMin >= profile.minSalary) { score += 10; reasons.push('Salary range meets your minimum expectation'); }
  else gaps.push('Salary range is below your stated minimum');
  return { score: Math.max(0, Math.min(100, score)), reasons, gaps, missingKeywords };
}

/** Resume-vs-job check: listing keywords absent from profile skills + resume text. */
export function missingKeywordsFor(profile: ProfileForMatch, job: JobForMatch): string[] {
  return computeMatch(profile, job).missingKeywords;
}
