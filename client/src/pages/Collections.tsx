import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import JobCard, { type Job } from '../components/JobCard';

const COLLECTIONS: { key: string; title: string; blurb: string }[] = [
  { key: 'fresher', title: 'Fresher roles (0–1 yr)', blurb: 'Roles that ask for at most 1 year of experience.' },
  { key: 'new-today', title: 'New today', blurb: 'First seen at the source today.' },
  { key: 'closing-soon', title: 'Closing this week', blurb: 'Deadline within 7 days — apply first, polish later.' },
  { key: 'remote-india', title: 'Remote', blurb: 'Remote roles collected from official boards.' },
];
export default function Collections() {
  const [active, setActive] = useState('fresher'); const [extra, setExtra] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    const query = active === 'batch2026' ? 'batch=2026' : `collection=${active}`;
    api<{ jobs: Job[] }>('GET', `/api/jobs?${query}&limit=30`).then((d) => setJobs(d.jobs)).catch(() => setJobs([]));
  }, [active]);
  return (
    <div>
      <h1>Collections</h1>
      <p>{COLLECTIONS.map((c) => <button key={c.key} className={`btn small ${active === c.key ? '' : 'secondary'}`} style={{ marginRight: 6 }} onClick={() => { setActive(c.key); setExtra(c.blurb); }}>{c.title}</button>)}
      <button className={`btn small ${active === 'batch2026' ? '' : 'secondary'}`} onClick={() => { setActive('batch2026'); setExtra('Listings open to the 2026 batch (or with no batch restriction).'); }}>2026 Batch</button></p>
      <p className="small">{extra}</p>
      {jobs.map((j) => <JobCard key={j.id} job={j} />)}
      {!jobs.length && <p className="small">Nothing live in this collection right now.</p>}
    </div>
  );
}
