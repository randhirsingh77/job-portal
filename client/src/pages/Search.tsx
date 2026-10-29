import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import JobCard, { type Job } from '../components/JobCard';

export default function Search() {
  const [params] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]); const [f, setF] = useState({ q: params.get('q') ?? '', city: params.get('city') ?? '', remote: '', batch: '', expMax: '', salaryMin: '', postedDays: '' });
  const [err, setErr] = useState('');
  const load = () => {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
    api<{ jobs: Job[] }>('GET', `/api/jobs?${qs.toString()}&limit=30`).then((d) => setJobs(d.jobs)).catch((e: Error) => setErr(e.message));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="layout">
      <aside className="panel">
        <strong>Filters</strong>
        <label>Keyword</label><input value={f.q} onChange={set('q')} />
        <label>City</label><input value={f.city} onChange={set('city')} />
        <label>Work type</label><select value={f.remote} onChange={set('remote')}><option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option></select>
        <label>Batch year</label><input value={f.batch} onChange={set('batch')} placeholder="2026" inputMode="numeric" />
        <label>Max experience required (yrs)</label><input value={f.expMax} onChange={set('expMax')} inputMode="numeric" />
        <label>Min salary</label><input value={f.salaryMin} onChange={set('salaryMin')} inputMode="numeric" />
        <label>Posted within (days)</label><input value={f.postedDays} onChange={set('postedDays')} inputMode="numeric" />
        <button className="btn" onClick={load}>Apply filters</button>
      </aside>
      <section>
        <h1>Live jobs</h1>
        {err && <p className="error">{err}</p>}
        {jobs.map((j) => <JobCard key={j.id} job={j} />)}
        {!jobs.length && !err && <p className="small">No live jobs match. Closed jobs are expired here on purpose — try widening the city or batch.</p>}
      </section>
    </div>
  );
}
