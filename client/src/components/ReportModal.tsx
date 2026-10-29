import { useState } from 'react';
import { api } from '../lib/api';

export default function ReportModal({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const [reason, setReason] = useState('fee_asked'); const [detail, setDetail] = useState(''); const [done, setDone] = useState(''); const [err, setErr] = useState('');
  const submit = async () => {
    try { await api('POST', `/api/reports/${jobId}`, { reason, detail }); setDone('Reported. Reports are reviewed and can take the listing down.'); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Sign in to report a job'); }
  };
  return (
    <div className="panel" role="dialog" aria-label="Report this job">
      <strong>Report this job</strong>
      {done ? <p>{done}</p> : (<>
        <label>Reason</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="fee_asked">They asked for a fee / deposit</option>
          <option value="fake_company">Fake company</option>
          <option value="whatsapp_only">WhatsApp / Telegram only contact</option>
          <option value="expired">Job is expired</option>
          <option value="wrong_info">Wrong information</option>
          <option value="other">Other</option>
        </select>
        <label>Details (optional)</label>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
        {err && <p className="error">{err}</p>}
        <button className="btn small" onClick={() => void submit()}>Submit report</button>{' '}
      </>)}
      <button className="btn small secondary" onClick={onClose}>Close</button>
    </div>
  );
}
