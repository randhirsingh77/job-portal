import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import JobCard, { type Job } from '../components/JobCard';

interface CompanyRow { id: number; name: string; website_domain: string | null; industry: string | null; hq_city: string | null; verified_domain: boolean; live_jobs?: number }
export function Companies() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  useEffect(() => { api<{ companies: CompanyRow[] }>('GET', '/api/companies').then((d) => setRows(d.companies)).catch(() => undefined); }, []);
  return (<div><h1>Companies</h1>{rows.map((c) => <div key={c.id} className="card"><Link to={`/companies/${c.id}`}><strong>{c.name}</strong></Link> <span className="small">{c.industry ?? ''} · {c.hq_city ?? ''} · {c.live_jobs ?? 0} live jobs{c.verified_domain ? ' · domain verified' : ''}</span></div>)}</div>);
}
export default function Company() {
  const { id } = useParams();
  const [data, setData] = useState<{ company: CompanyRow; jobs: Job[]; alumniAtCompany: { name: string; college: string; current_employer: string }[]; peopleFromYourCollegeNote: string } | null>(null);
  useEffect(() => { api<typeof data>('GET', `/api/companies/${id}`).then(setData).catch(() => undefined); }, [id]);
  if (!data) return <p>Loading…</p>;
  return (
    <div>
      <h1>{data.company.name}</h1>
      <p className="small">{data.company.industry ?? ''} · {data.company.hq_city ?? ''} · {data.company.website_domain ?? ''}{data.company.verified_domain ? ' · domain verified' : ''}</p>
      <h2>Live jobs</h2>
      {data.jobs.map((j) => <JobCard key={j.id} job={{ ...j, company_name: data.company.name }} />)}
      <div className="panel"><strong>People at this company (referral finder)</strong>
        <p className="small">{data.peopleFromYourCollegeNote} Names below are self-declared and shown only because those users opted in — check whether the college matches yours.</p>
        {data.alumniAtCompany.length ? <ul>{data.alumniAtCompany.map((a, i) => <li key={i}>{a.name} — {a.college}</li>)}</ul> : <p className="small">No opted-in profiles declare this company yet.</p>}
      </div>
    </div>
  );
}
