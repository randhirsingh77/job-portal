import { pool } from '../src/db/pool.js';
import { collectSource } from '../src/modules/ingestion/ingest.js';
const arg = process.argv.find((a) => a.startsWith('--source'));
let ids: number[] = [];
if (arg) {
  const [, spec] = arg.split('=');
  const [ats, slug] = (spec ?? '').split(':');
  const r = await pool.query('SELECT id FROM sources WHERE ats_type=$1 AND slug=$2', [ats, slug]);
  ids = r.rows.map((x: { id: number }) => x.id);
} else {
  const r = await pool.query("SELECT id FROM sources WHERE active=TRUE AND kind='ats_feed' AND slug IS NOT NULL");
  ids = r.rows.map((x: { id: number }) => x.id);
}
let total = 0, created = 0, failed = 0;
for (const id of ids) {
  try { const out = await collectSource(id); total += out.fetched; created += out.created; console.log(`source ${id}: fetched=${out.fetched} new=${out.created} expired=${out.expired}`); }
  catch (e) { failed++; console.log(`source ${id}: FAILED ${String(e).slice(0, 200)}`); }
}
console.log(`done: sources=${ids.length} fetched=${total} new=${created} failed=${failed}`);
await pool.end();
