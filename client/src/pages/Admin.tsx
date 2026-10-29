import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Source { id: number; company_name: string; kind: string; ats_type: string | null; slug: string | null; last_status: string | null; last_polled_at: string | null; strike_count: string; active: boolean; detection_status: string }
interface Run { id: number; source_id: number; status: string; fetched_count: string; new_count: string; expired_count: string; error: string | null; started_at: string }
interface QueueJob { id: number; title: string; company_name: string; status: string }
interface Report { id: number; job_id: number; title: string; reason: string; detail: string | null }

export default function Admin() {
  const [sources, setSources] = useState<Source[]>([]); const [runs, setRuns] = useState<Run[]>([]);
  const [queue, setQueue] = useState<QueueJob[]>([]); const [reports, setReports] = useState<Report[]>([]); const [msg, setMsg] = useState('');
  const load = () => {
    api<{ sources: Source[] }>('GET', '/api/admin/sources').then((d) => setSources(d.sources)).catch((e: Error) => setMsg(e.message));
    api<{ runs: Run[] }>('GET', '/api/admin/collector-runs').then((d) => setRuns(d.runs)).catch(() => undefined);
    api<{ jobs: QueueJob[] }>('GET', '/api/admin/review-queue').then((d) => setQueue(d.jobs)).catch(() => undefined);
    api<{ reports: Report[] }>('GET', '/api/admin/reports').then((d) => setReports(d.reports)).catch(() => undefined);
  };
  useEffect(load, []);
  const act = (p: string, label: string) => { void api('POST', p).then(() => { setMsg(label); load(); }).catch((e: Error) => setMsg(e.message)); };
  return (
    <div><h1>Admin</h1>{msg && <p className="small">{msg}</p>}
      <h2>Source registry & collector health</h2>
      <table><thead><tr><th>Company</th><th>Kind</th><th>Feed</th><th>Last status</th><th>Strikes</th><th>Active</th><th></th></tr></thead>
      <tbody>{sources.map((s) => <tr key={s.id}><td>{s.company_name}</td><td>{s.kind}</td><td>{s.ats_type ?? ''} {s.slug ?? ''}<div className="small">{s.detection_status}</div></td><td>{s.last_status ?? 'never'}</td><td>{s.strike_count}</td><td>{s.active ? 'yes' : 'no'}</td>
        <td>{s.kind === 'ats_feed' && <button className="btn small secondary" onClick={() => act(`/api/admin/sources/${s.id}/collect`, 'Collection run finished')}>Collect now</button>}{' '}
        <button className="btn small secondary" onClick={() => act(`/api/admin/sources/${s.id}/quarantine`, 'Source quarantined')}>Quarantine</button></td></tr>)}</tbody></table>
      <h2>Recent collector runs</h2>
      <table><thead><tr><th>When</th><th>Source</th><th>Status</th><th>Fetched</th><th>New</th><th>Expired</th><th>Error</th></tr></thead>
      <tbody>{runs.slice(0, 20).map((r) => <tr key={r.id}><td>{new Date(r.started_at).toLocaleString('en-IN')}</td><td>{r.source_id}</td><td>{r.status}</td><td>{r.fetched_count}</td><td>{r.new_count}</td><td>{r.expired_count}</td><td>{r.error ?? ''}</td></tr>)}</tbody></table>
      <h2>Trust review queue (in review / blocked)</h2>
      {queue.map((j) => <div key={j.id} className="card"><strong>{j.title}</strong> · {j.company_name} <span className="chip">{j.status}</span>
        <button className="btn small" style={{ marginLeft: 8 }} onClick={() => act(`/api/admin/jobs/${j.id}/approve`, 'Job approved and live')}>Approve</button>{' '}
        <button className="btn small secondary" onClick={() => act(`/api/admin/jobs/${j.id}/block`, 'Job blocked')}>Block</button></div>)}
      <h2>Reports queue</h2>
      {reports.map((r) => <div key={r.id} className="card"><strong>{r.title}</strong> — {r.reason}<div className="small">{r.detail ?? ''}</div>
        <button className="btn small" onClick={() => act(`/api/admin/reports/${r.id}/action`, 'Report actioned (takedown)')}>Take down job</button></div>)}
      {!reports.length && <p className="small">No open reports.</p>}
    </div>
  );
}
