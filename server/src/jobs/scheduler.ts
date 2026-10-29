import { q } from '../db/pool.js';
import { collectSource } from '../modules/ingestion/ingest.js';
import { shouldExpire } from '../modules/pipeline/freshness.js';
import { scheduleEvery } from './queue.js';

export async function pollDueSources(): Promise<void> {
  const due = await q<{ id: number }>(
    `SELECT id FROM sources WHERE active=TRUE AND kind='ats_feed' AND slug IS NOT NULL
     AND (last_polled_at IS NULL OR last_polled_at < now() - (poll_interval_min * interval '1 minute')) LIMIT 25`);
  for (const s of due.rows) { await collectSource(s.id).catch((e) => console.error('collect failed', s.id, e)); }
}
export async function expireByDeadline(): Promise<void> {
  const rows = await q<{ id: number; deadline_at: Date }>("SELECT id, deadline_at FROM jobs WHERE status='live' AND deadline_at IS NOT NULL AND deadline_at < now()");
  for (const r of rows.rows) {
    if (shouldExpire({ missedPolls: 0, deadlineAt: new Date(r.deadline_at), now: new Date() }).expire) {
      await q("UPDATE jobs SET status='expired' WHERE id=$1", [r.id]);
      await q('INSERT INTO freshness_checks (job_id, method, result, detail) VALUES ($1,$2,$3,$4)', [r.id, 'deadline', 'gone', 'deadline passed']);
    }
  }
}
export function startScheduler(): void {
  scheduleEvery('poll-due-sources', 30, pollDueSources);
  scheduleEvery('deadline-expiry', 60, expireByDeadline);
}
