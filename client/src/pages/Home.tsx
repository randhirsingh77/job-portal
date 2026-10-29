import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import JobCard, { type Job } from '../components/JobCard';

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]); const [q, setQ] = useState(''); const [city, setCity] = useState(''); const nav = useNavigate();
  useEffect(() => { api<{ jobs: Job[] }>('GET', '/api/jobs?limit=10').then((d) => setJobs(d.jobs)).catch(() => undefined); }, []);
  return (
    <div>
      <h1>Jobs that are checked genuine and checked alive</h1>
      <p>Every listing here comes from the company's own careers page or its official ATS board. The apply link points at that source, and a listing disappears here the moment it closes there.</p>
      <div className="banner"><strong>We never charge candidates.</strong> If anyone asks you for a fee, a deposit, or your Aadhaar/bank details for a job, it is a scam — report the listing.</div>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`); }}>
        <div className="grid cols2">
          <div><label>Role, skill or company keyword</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. react, data analyst" /></div>
          <div><label>City</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bengaluru" /></div>
        </div>
        <button className="btn" type="submit">Search live jobs</button>
      </form>
      <p>{['Fresher', 'Remote', '2026 Batch', 'Closing this week'].map((c) => <Link key={c} className="chip" to="/collections">{c}</Link>)}</p>
      <h2>New and recent</h2>
      {jobs.map((j) => <JobCard key={j.id} job={j} />)}
      {!jobs.length && <p className="small">No live jobs loaded yet. Run the collectors, or check the search page.</p>}
    </div>
  );
}
