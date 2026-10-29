import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Job } from '../components/JobCard';

interface CompanyInfo { id: number; name: string; website_domain: string; verified_domain: boolean }
export function ClaimPage() {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [f, setF] = useState({ companyId: '', companyName: '', companyDomain: '', careersUrl: '' });
  const [msg, setMsg] = useState('');
  const submit = () => {
    const body = mode === 'existing' ? { companyId: Number(f.companyId) } : { companyName: f.companyName, companyDomain: f.companyDomain, careersUrl: f.careersUrl || undefined };
    api('POST', '/api/recruiter/claim', body).then(() => setMsg('Company claimed and verified — your work email domain matches the company domain.')).catch((e: Error) => setMsg(e.message));
  };
  return (
    <div className="panel"><h1>Claim your company</h1>
      <p>Your company may already be listed here from its official careers page. Claiming it lets you correct the company details, post jobs directly, and close your own listings.</p>
      <div className="banner">Verification rule: your account email must be on the <strong>same domain as the company</strong>. A claim from a free email address, or from a different company's domain, cannot be verified.</div>
      <label>How do you want to claim?</label>
      <select value={mode} onChange={(e) => setMode(e.target.value as 'existing' | 'new')}><option value="existing">My company is already listed (enter its ID from the Companies page)</option><option value="new">Add my company</option></select>
      {mode === 'existing' ? (<><label>Company ID</label><input value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })} inputMode="numeric" /></>)
      : (<><label>Company name</label><input value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} />
          <label>Company domain</label><input value={f.companyDomain} onChange={(e) => setF({ ...f, companyDomain: e.target.value })} placeholder="yourcompany.com" />
          <label>Careers page URL (optional)</label><input value={f.careersUrl} onChange={(e) => setF({ ...f, careersUrl: e.target.value })} /></>)}
      <button className="btn" onClick={submit}>Verify and claim</button>
      {msg && <p className="small">{msg}</p>}
    </div>
  );
}

export function RecruiterDashboard() {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [f, setF] = useState({ title: '', locationText: '', city: '', remoteType: 'onsite', description: '', salaryMin: '', salaryMax: '', skills: '', batchYears: '', deadline: '' });
  const [msg, setMsg] = useState('');
  const load = () => {
    api<{ company: CompanyInfo | null }>('GET', '/api/recruiter/me').then((d) => setCompany(d.company)).catch(() => undefined);
    api<{ jobs: Job[] }>('GET', '/api/recruiter/jobs').then((d) => setJobs(d.jobs)).catch(() => undefined);
  };
  useEffect(load, []);
  const post = () => {
    const body = { title: f.title, locationText: f.locationText, city: f.city || undefined, remoteType: f.remoteType, description: f.description,
      salaryMin: f.salaryMin ? Number(f.salaryMin) : undefined, salaryMax: f.salaryMax ? Number(f.salaryMax) : undefined, salaryPeriod: 'year',
      skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean), batchYears: f.batchYears.split(',').map((s) => Number(s.trim())).filter((n) => n > 2000),
      deadline: f.deadline ? new Date(f.deadline).toISOString() : undefined };
    api<{ statusNote: string }>('POST', '/api/recruiter/jobs', body).then((d) => { setMsg(d.statusNote); load(); }).catch((e: Error) => setMsg(e.message));
  };
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div><h1>Employer dashboard</h1>
      {company ? <p className="small">{company.name} · {company.website_domain} · {company.verified_domain ? 'domain verified' : 'not verified'}</p>
        : <p className="small">No company claimed yet — use “Claim company” first. You can only post and manage jobs for your own claimed company.</p>}
      <div className="panel"><strong>Post a job (structured fields — no free-form-only postings)</strong>
        <div className="grid cols2">
          <div><label>Title</label><input value={f.title} onChange={set('title')} /></div>
          <div><label>Location</label><input value={f.locationText} onChange={set('locationText')} placeholder="Bengaluru, India" /></div>
          <div><label>City</label><input value={f.city} onChange={set('city')} /></div>
          <div><label>Work type</label><select value={f.remoteType} onChange={set('remoteType')}><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></div>
          <div><label>Salary min (₹/year)</label><input value={f.salaryMin} onChange={set('salaryMin')} inputMode="numeric" /></div>
          <div><label>Salary max (₹/year)</label><input value={f.salaryMax} onChange={set('salaryMax')} inputMode="numeric" /></div>
          <div><label>Skills (comma separated)</label><input value={f.skills} onChange={set('skills')} /></div>
          <div><label>Batch years (comma separated)</label><input value={f.batchYears} onChange={set('batchYears')} placeholder="2026, 2025" /></div>
          <div><label>Deadline</label><input type="date" value={f.deadline} onChange={set('deadline')} /></div>
        </div>
        <label>Description</label><textarea rows={5} value={f.description} onChange={set('description')} />
        <p className="small">The trust rules apply to direct postings too: a posting that asks candidates for a fee, a deposit, or ID/bank details before an offer is blocked. Your first direct postings are reviewed before they go live; after that, postings publish directly.</p>
        <button className="btn" onClick={post}>Post job</button>{msg && <p className="small">{msg}</p>}
      </div>
      <h2>My company's jobs</h2>
      {jobs.map((j) => (
        <div key={j.id} className="card"><strong>{j.title}</strong> <span className="chip">{j.status}</span> <span className="small">{j.location_text}</span>
          {j.status === 'live' && <button className="btn small secondary" style={{ marginLeft: 8 }} onClick={() => { void api('POST', `/api/recruiter/jobs/${j.id}/close`).then(load); }}>Close job</button>}
        </div>
      ))}
      {!jobs.length && <p className="small">No jobs yet for your company.</p>}
    </div>
  );
}
