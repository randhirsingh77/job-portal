import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { type Job, salaryLabel } from '../components/JobCard';
import ReportModal from '../components/ReportModal';
import LifecycleCard, { type Lifecycle } from '../components/LifecycleCard';
import { useAuth } from '../store/AuthContext';

interface Match { score: number; reasons: string[]; gaps: string[]; missingKeywords: string[] }
interface Answer { label: string; value: string }

export default function JobDetail() {
  const { id } = useParams(); const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null); const [err, setErr] = useState('');
  const [hinglish, setHinglish] = useState(''); const [estimate, setEstimate] = useState<{ value: number; basis: string } | null>(null);
  const [trustEvents, setTrustEvents] = useState<{ rule: string; outcome: string; detail: string; created_at: string }[]>([]);
  const [match, setMatch] = useState<Match | null>(null); const [prep, setPrep] = useState<{ skill: string; topics: string[] }[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]); const [showReport, setShowReport] = useState(false); const [savedMsg, setSavedMsg] = useState('');
  useEffect(() => {
    api<{ job: Job; hinglishSummary: string; salaryEstimate: { value: number; basis: string } | null; trustEvents: typeof trustEvents }>('GET', `/api/jobs/${id}`)
      .then((d) => { setJob(d.job); setHinglish(d.hinglishSummary); setEstimate(d.salaryEstimate); setTrustEvents(d.trustEvents); })
      .catch((e: Error) => setErr(e.message));
    api<{ checklist: { skill: string; topics: string[] }[] }>('GET', `/api/jobs/${id}/prep`).then((d) => setPrep(d.checklist)).catch(() => undefined);
  }, [id]);
  useEffect(() => {
    if (user?.role !== 'seeker') return;
    api<{ match: Match }>('GET', `/api/jobs/${id}/match`).then((d) => setMatch(d.match)).catch(() => undefined);
    api<{ answers: Answer[] }>('GET', `/api/jobs/${id}/apply-assist`).then((d) => setAnswers(d.answers)).catch(() => undefined);
  }, [id, user]);
  if (err) return <p className="error">{err}</p>;
  if (!job) return <p>Loading…</p>;
  const lifecycle = (job as unknown as { lifecycle?: Lifecycle }).lifecycle ?? {};
  const apply = async () => {
    if (user?.role === 'seeker') await api('POST', `/api/tracker/${job.id}`, { stage: 'applied' }).catch(() => undefined);
    window.open(job.apply_url, '_blank', 'noopener');
  };
  return (
    <div>
      <h1>{job.title}</h1>
      <p><Link to={`/companies/${job.company_id}`}>{job.company_name}</Link> · {job.location_text} · {job.remote_type}</p>
      <div className="banner"><strong>We never charge candidates.</strong> A real employer never asks for a fee, a deposit, or your Aadhaar/bank details before an offer.</div>
      <div className="panel">
        <strong>Why we verified this</strong>
        <p>{job.badge_text ?? 'Collected from a partner source — apply at the source and check the company page.'}</p>
        <p className="small">Source: official careers page / ATS board of {job.company_name}. Checked today: {job.signals?.checkedToday ? 'yes' : 'see last checked on the listing'}. The badge states the check performed; no portal can promise a job is 100% genuine.</p>
        <details><summary>See the checks behind this</summary>
          <ul>{trustEvents.map((t, i) => <li key={i} className="small">{t.rule} → {t.outcome}{t.detail ? ` (${t.detail})` : ''}</li>)}</ul>
        </details>
      </div>
      <p>{job.snippet}</p>
      <p>{(job.skills ?? []).map((s) => <span key={s} className="chip">{s}</span>)}{(job.batch_years ?? []).map((b) => <span key={b} className="chip">{b} batch</span>)}</p>
      <p>{salaryLabel(job) ? <>Salary (from the employer): <strong>{salaryLabel(job)}</strong></> : estimate ? <>Salary: not stated by the employer. <strong>₹{estimate.value.toLocaleString('en-IN')}</strong> <span className="small">({estimate.basis})</span></> : <>Salary: not stated in the listing.</>}</p>
      {job.deadline_at && <p>Deadline: <strong>{new Date(job.deadline_at).toLocaleDateString('en-IN')}</strong>{job.signals?.daysLeft !== null && job.signals ? ` (${job.signals.daysLeft} days left)` : ''}</p>}
      <LifecycleCard lifecycle={lifecycle} />
      <details><summary>Hinglish me samjho — yeh job kya hai, kaun apply kar sakta hai</summary><p>{hinglish}</p></details>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => void apply()}>Apply at source →</button>
        {user?.role === 'seeker' && <button className="btn secondary" onClick={() => { void api('POST', `/api/saved/${job.id}`).then(() => setSavedMsg('Saved.')); }}>Save job</button>}
        <button className="btn secondary" onClick={() => setShowReport(!showReport)}>Report this job</button>
      </div>
      {savedMsg && <p className="small">{savedMsg}</p>}
      {showReport && <ReportModal jobId={job.id} onClose={() => setShowReport(false)} />}
      {match && (
        <div className="panel"><strong>Your match: {match.score}/100</strong>
          <p className="small">Scored from your profile against this listing's own fields — skills, experience, batch, city and salary.</p>
          <strong>Why you match</strong><ul>{match.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <strong>Gaps</strong><ul>{match.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
          <strong>Resume check — keywords in this listing missing from your profile/resume</strong>
          <p>{match.missingKeywords.length ? match.missingKeywords.join(', ') : 'None — every listed skill appears in your profile or resume.'}</p>
        </div>
      )}
      {answers.length > 0 && (
        <div className="panel"><strong>Apply Assist — copy-ready answers from your profile</strong>
          <p className="small">This portal never submits an application for you. Copy these into the official form.</p>
          {answers.map((a) => <div key={a.label}><label>{a.label}</label><input readOnly value={a.value} onFocus={(e) => e.target.select()} /></div>)}
        </div>
      )}
      <div className="panel"><strong>Interview prep for this job</strong>
        <p className="small">A study checklist generated from the skills in this listing — topics to prepare, not questions shared by the company.</p>
        {prep.map((c) => <div key={c.skill}><strong>{c.skill}</strong><ul>{c.topics.map((t) => <li key={t}>{t}</li>)}</ul></div>)}
      </div>
    </div>
  );
}
