export interface SignalJob { first_seen_at: Date | string; date_posted: Date | string | null; deadline_at: Date | string | null; last_seen_at: Date | string; status: string; description_text?: string | null; snippet?: string | null; immediate?: boolean }
export function derivedSignals(j: SignalJob & { company_active_count?: number }, now = new Date()) {
  const firstSeen = j.date_posted ? new Date(j.date_posted) : new Date(j.first_seen_at);
  const ageMs = now.getTime() - firstSeen.getTime();
  const days = Math.floor(ageMs / 86400000);
  const postedLabel = ageMs < 3600000 ? 'Posted under an hour ago' : ageMs < 86400000 ? `Posted ${Math.floor(ageMs / 3600000)}h ago` : days === 1 ? 'Posted 1 day ago' : `Posted ${days} days ago`;
  const deadline = j.deadline_at ? new Date(j.deadline_at) : null;
  const closingSoon = !!deadline && deadline.getTime() - now.getTime() <= 7 * 86400000 && deadline.getTime() > now.getTime();
  const text = `${j.snippet ?? ''} ${j.description_text ?? ''}`.toLowerCase();
  return {
    postedLabel,
    isNew: ageMs <= 86400000,
    closingSoon,
    daysLeft: deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 86400000) : null,
    checkedToday: new Date(j.last_seen_at).toDateString() === now.toDateString(),
    stillAccepting: j.status === 'live',
    immediateJoinerMentioned: /immediate joiner|join immediately/.test(text),
    companyActivelyPosting: j.company_active_count ?? null,
  };
}
export function hinglishSummary(job: { title: string; company_name: string; city: string | null; experience_min: number | null; skills: string[]; batch_years: number[]; deadline_at: Date | string | null }): string {
  const exp = job.experience_min === null || job.experience_min === 0 ? 'freshers bhi apply kar sakte hain' : `kam se kam ${job.experience_min} saal experience chahiye`;
  const batch = job.batch_years?.length ? ` Yeh ${job.batch_years.join('/')} batch ke liye hai.` : '';
  const skills = job.skills?.length ? ` Skills chahiye: ${job.skills.join(', ')}.` : '';
  const dl = job.deadline_at ? ` Last date: ${new Date(job.deadline_at).toLocaleDateString('en-IN')}.` : '';
  return `Yeh job kya hai: ${job.company_name} me ${job.title} ki opening hai${job.city ? `, jagah ${job.city}` : ''}. Kaun apply kar sakta hai: ${exp}.${batch}${skills}${dl} Apply hamesha official page se hi karein — koi fee mange to woh scam hai.`;
}
