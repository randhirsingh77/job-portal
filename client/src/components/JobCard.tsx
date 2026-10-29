import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/AuthContext';

export interface Job {
  id: number; title: string; company_name: string; company_id: number; city: string | null; location_text: string | null;
  remote_type: string; experience_min: string | null; salary_min: string | null; salary_max: string | null;
  skills: string[]; batch_years: number[]; badge_text: string | null; status: string; repost_count?: string | number; apply_url: string;
  deadline_at: string | null; snippet?: string;
  signals?: { postedLabel: string; isNew: boolean; closingSoon: boolean; daysLeft: number | null; checkedToday: boolean; stillAccepting: boolean; immediateJoinerMentioned: boolean; companyActivelyPosting: number | null };
}

export function salaryLabel(j: Job): string | null {
  if (!j.salary_min) return null;
  const fmt = (v: string) => `₹${Number(v).toLocaleString('en-IN')}`;
  return j.salary_max && j.salary_max !== j.salary_min ? `${fmt(j.salary_min)} – ${fmt(j.salary_max)}` : fmt(j.salary_min);
}

export default function JobCard({ job, onApplied }: { job: Job; onApplied?: () => void }) {
  const { user } = useAuth();
  const s = job.signals;
  const apply = async () => {
    if (user?.role === 'seeker') { await api('POST', `/api/tracker/${job.id}`, { stage: 'applied' }).catch(() => undefined); onApplied?.(); }
    window.open(job.apply_url, '_blank', 'noopener');
  };
  return (
    <div className="card">
      <div><Link to={`/jobs/${job.id}`}><strong>{job.title}</strong></Link> · <Link to={`/companies/${job.company_id}`}>{job.company_name}</Link></div>
      <div className="small">{job.location_text ?? job.city ?? ''} · {job.remote_type}{job.experience_min ? ` · ${job.experience_min}+ yrs` : ' · Fresher friendly'}</div>
      <div>
        {salaryLabel(job) && <span className="chip">{salaryLabel(job)}</span>}
        {s?.isNew && <span className="chip good">New</span>}
        {s?.closingSoon && <span className="chip warn">Closing in {s.daysLeft} days</span>}
        {s?.checkedToday && <span className="chip good">Checked today</span>}
        {s?.stillAccepting && <span className="chip good">Still accepting</span>}
        {s?.immediateJoinerMentioned && <span className="chip">Immediate joiner mentioned in the posting</span>}
        {Number(job.repost_count ?? 0) > 0 && <span className="chip warn">Reposted {job.repost_count}×</span>}
        {job.status === 'expired' && <span className="chip bad">Closed at source</span>}
      </div>
      <div>{(job.skills ?? []).slice(0, 6).map((sk) => <span key={sk} className="chip">{sk}</span>)}{(job.batch_years ?? []).map((b) => <span key={b} className="chip">{b} batch</span>)}</div>
      {job.badge_text && <div className="small">✓ {job.badge_text}</div>}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <Link className="btn small" to={`/jobs/${job.id}`}>View</Link>
        <button className="btn small secondary" onClick={() => void apply()}>Apply at source →</button>
        {s?.postedLabel && <span className="small">{s.postedLabel}</span>}
      </div>
    </div>
  );
}
