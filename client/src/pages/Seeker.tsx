import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import JobCard, { type Job } from '../components/JobCard';

interface Profile { [k: string]: unknown }
export function ProfilePage() {
  const [p, setP] = useState<Profile>({}); const [msg, setMsg] = useState('');
  useEffect(() => { api<{ profile: Profile }>('GET', '/api/users/profile').then((d) => setP(d.profile)).catch(() => undefined); }, []);
  const set = (k: string, v: unknown) => setP({ ...p, [k]: v });
  const skillsText = Array.isArray(p.skills) ? (p.skills as string[]).join(', ') : '';
  const save = () => {
    const body = { city: (p.city as string) || null, batchYear: p.batch_year ? Number(p.batch_year) : null, degree: (p.degree as string) || null, branch: (p.branch as string) || null,
      percent: p.percent ? Number(p.percent) : null, backlogs: p.backlogs ? Number(p.backlogs) : 0, skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
      resumeUrl: (p.resume_url as string) || null, resumeText: (p.resume_text as string) || null, minSalary: p.min_salary ? Number(p.min_salary) : null,
      college: (p.college as string) || null, currentEmployer: (p.current_employer as string) || null, phone: (p.phone as string) || null,
      githubUrl: (p.github_url as string) || null, linkedinUrl: (p.linkedin_url as string) || null, portfolioUrl: (p.portfolio_url as string) || null,
      summary: (p.summary as string) || null, noticePeriod: (p.notice_period as string) || null, discoverableAlumni: Boolean(p.discoverable_alumni) };
    api('PUT', '/api/users/profile', body).then(() => setMsg('Profile saved. Your match scores use these fields.')).catch((e: Error) => setMsg(e.message));
  };
  const T = (k: string, label: string) => (<div><label>{label}</label><input value={(p[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} /></div>);
  return (
    <div><h1>My profile (your resume on this portal)</h1>
      <div className="grid cols2">
        {T('city', 'City')}{T('batch_year', 'Batch year (e.g. 2026)')}{T('degree', 'Degree')}{T('branch', 'Branch')}
        {T('percent', 'Percentage / CGPA marks %')}{T('backlogs', 'Active backlogs')}{T('college', 'College')}
        {T('current_employer', 'Current / past employer (for the referral finder)')}{T('phone', 'Phone')}{T('min_salary', 'Minimum expected salary (₹)')}
        {T('github_url', 'GitHub URL')}{T('linkedin_url', 'LinkedIn URL')}{T('portfolio_url', 'Portfolio URL')}{T('resume_url', 'Resume URL')}
        {T('notice_period', 'Notice period')}
      </div>
      <label>Skills (comma separated — used for match scores and the resume check)</label>
      <input value={skillsText} onChange={(e) => set('skills', e.target.value.split(',').map((s) => s.trim()))} />
      <label>Short summary</label><textarea rows={3} value={(p.summary as string) ?? ''} onChange={(e) => set('summary', e.target.value)} />
      <label>Resume text (paste it — used only for the missing-keyword check)</label><textarea rows={5} value={(p.resume_text as string) ?? ''} onChange={(e) => set('resume_text', e.target.value)} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={Boolean(p.discoverable_alumni)} onChange={(e) => set('discoverable_alumni', e.target.checked)} /> Show me in the referral finder (my name + college appear on company pages where I declare I work/worked)</label>
      <button className="btn" onClick={save}>Save profile</button>{msg && <p className="small">{msg}</p>}
    </div>
  );
}

export function SavedPage() {
  const [rows, setRows] = useState<Job[]>([]);
  useEffect(() => { api<{ saved: Job[] }>('GET', '/api/saved').then((d) => setRows(d.saved)).catch(() => undefined); }, []);
  return (<div><h1>Saved jobs</h1>{rows.map((j) => <JobCard key={j.id} job={j} />)}{!rows.length && <p className="small">Nothing saved yet. A saved job that closes at the source is marked Closed here — it never silently looks open.</p>}</div>);
}

export function AlertsPage() {
  const [rows, setRows] = useState<{ id: number; keyword: string; city: string; batch_year: number; channel: string }[]>([]);
  const [deliveries, setDeliveries] = useState<{ id: number; channel: string; status: string; detail: string }[]>([]);
  const [f, setF] = useState({ keyword: '', city: '', batchYear: '', channel: 'email' }); const [msg, setMsg] = useState('');
  const load = () => { api<{ alerts: typeof rows }>('GET', '/api/alerts').then((d) => setRows(d.alerts)).catch(() => undefined); api<{ deliveries: typeof deliveries }>('GET', '/api/alerts/deliveries/mine').then((d) => setDeliveries(d.deliveries)).catch(() => undefined); };
  useEffect(load, []);
  const create = () => { api<{ deliveryStatus: string }>('POST', '/api/alerts', { keyword: f.keyword || undefined, city: f.city || undefined, batchYear: f.batchYear ? Number(f.batchYear) : undefined, channel: f.channel })
    .then((d) => { setMsg(`Alert saved. Delivery status: ${d.deliveryStatus}${d.deliveryStatus === 'queued_no_provider' ? ' — no delivery provider is configured on this deployment, so alerts are queued and logged, never shown as sent.' : ''}`); load(); }).catch((e: Error) => setMsg(e.message)); };
  return (
    <div><h1>Job alerts</h1>
      <div className="panel"><strong>New alert — keep the filters tight (role × city × batch)</strong>
        <div className="grid cols3">
          <div><label>Keyword</label><input value={f.keyword} onChange={(e) => setF({ ...f, keyword: e.target.value })} /></div>
          <div><label>City</label><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
          <div><label>Batch year</label><input value={f.batchYear} onChange={(e) => setF({ ...f, batchYear: e.target.value })} /></div>
        </div>
        <label>Channel</label>
        <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
          <option value="email">Email</option><option value="push">Push (in-app)</option><option value="whatsapp">WhatsApp (opt-in per filter)</option>
        </select>
        <button className="btn" onClick={create}>Create alert</button>{msg && <p className="small">{msg}</p>}
      </div>
      <h2>My alerts</h2>
      {rows.map((a) => <div key={a.id} className="card">{a.keyword ?? 'Any role'} · {a.city ?? 'Any city'} · {a.batch_year ?? 'Any batch'} · via {a.channel} <button className="btn small secondary" onClick={() => { void api('DELETE', `/api/alerts/${a.id}`).then(load); }}>Delete</button></div>)}
      <h2>Delivery log</h2>
      <p className="small">Honest status: an alert is only ever marked “sent” when a configured provider actually delivered it.</p>
      {deliveries.map((d) => <div key={d.id} className="small">{d.channel} → {d.status}{d.detail ? ` (${d.detail})` : ''}</div>)}
    </div>
  );
}

interface AppRow { id: number; job_id: number; title: string; company_name: string; stage: string; job_status: string; closure_note: string | null; follow_up_at: string | null; lifecycle_stage: string | null }
const STAGES = ['saved', 'applied', 'interviewing', 'offer', 'closed'];
export function TrackerPage() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const load = () => { api<{ applications: AppRow[] }>('GET', '/api/tracker').then((d) => setRows(d.applications)).catch(() => undefined); };
  useEffect(load, []);
  const move = (jobId: number, stage: string) => { void api('POST', `/api/tracker/${jobId}`, { stage }).then(load); };
  const followUp = (jobId: number) => { const d = new Date(Date.now() + 7 * 86400000).toISOString(); void api('POST', `/api/tracker/${jobId}`, { stage: rows.find((r) => r.job_id === jobId)?.stage ?? 'applied', followUpAt: d }).then(load); };
  return (
    <div><h1>My application tracker</h1>
      <p className="small">Free, and it tracks jobs from every source — not just applies made on one portal. Clicking Apply on a job adds it here.</p>
      <div className="board">
        {STAGES.map((st) => (
          <div key={st} className="col"><strong style={{ textTransform: 'capitalize' }}>{st}</strong>
            {rows.filter((r) => r.stage === st).map((r) => (
              <div key={r.id} className="card">
                <strong>{r.title}</strong><div className="small">{r.company_name}</div>
                {r.closure_note && <span className="chip bad">This listing closed since you applied</span>}
                {r.job_status === 'expired' && !r.closure_note && <span className="chip bad">Listing closed</span>}
                {r.follow_up_at && <div className="small">Follow up by {new Date(r.follow_up_at).toLocaleDateString('en-IN')}</div>}
                <div>{STAGES.filter((x) => x !== st).map((x) => <button key={x} className="btn small secondary" style={{ margin: 2 }} onClick={() => move(r.job_id, x)}>{x}</button>)}</div>
                <button className="btn small secondary" onClick={() => followUp(r.job_id)}>Remind me in 7 days</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchesPage() {
  const [rows, setRows] = useState<(Job & { matchScore?: number })[]>([]); const [msg, setMsg] = useState('');
  useEffect(() => {
    api<{ jobs: Job[] }>('GET', '/api/jobs?limit=20').then(async (d) => {
      const out: (Job & { matchScore?: number })[] = [];
      for (const j of d.jobs) { try { const m = await api<{ match: { score: number } }>('GET', `/api/jobs/${j.id}/match`); out.push({ ...j, matchScore: m.match.score }); } catch { out.push(j); } }
      setRows(out.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)));
    }).catch((e: Error) => setMsg(e.message));
  }, []);
  return (<div><h1>My matches</h1><p className="small">Live jobs ranked by your profile match. Open a job to see the reasons and gaps behind its score.</p>{msg && <p className="error">{msg}</p>}{rows.map((j) => <div key={j.id}><span className="chip good">Match {j.matchScore ?? '—'}/100</span><JobCard job={j} /></div>)}</div>);
}
