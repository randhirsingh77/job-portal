import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { startTestPg } from '../scripts/pg-boot.js';

let base = ''; let pg: { url: string; stop: () => void };
let server: import('node:http').Server;

interface Res { status: number; body: Record<string, unknown> & Record<string, any>; cookie: string }
async function call(method: string, path: string, opts: { token?: string; body?: unknown; cookie?: string } = {}): Promise<Res> {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await r.text();
  let body: Record<string, unknown> = {}; try { body = JSON.parse(text) as Record<string, unknown>; } catch { /* xml/empty */ }
  const setCookie = r.headers.get('set-cookie') ?? '';
  return { status: r.status, body, cookie: setCookie.split(';')[0] };
}

beforeAll(async () => {
  pg = await startTestPg();
  process.env.DATABASE_URL = pg.url; process.env.JWT_SECRET = 'smoke-secret'; process.env.NODE_ENV = 'test';
  const { pool, q } = await import('../src/db/pool.js');
  const schema = fs.readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  const hash = await bcrypt.hash('admin-password-1', 12);
  await q("INSERT INTO users (email, password_hash, name, role) VALUES ('admin@test.dev',$1,'Admin','admin')", [hash]);
  const { createApp } = await import('../src/app.js');
  await new Promise<void>((resolve) => { server = createApp().listen(0, () => resolve()); });
  const addr = server.address(); base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
}, 120000);

afterAll(async () => { server?.close(); const { closePool } = await import('../src/db/pool.js'); await closePool(); pg?.stop(); });

describe('api smoke', () => {
  let seeker = '', recruiter = '', admin = '', seekerCookie = '';
  let liveJobId = 0;

  it('health is ok', async () => { const r = await call('GET', '/health'); expect(r.status).toBe(200); expect(r.body.ok).toBe(true); });

  it('auth: recruiter with a free email is rejected; seeker and recruiter register', async () => {
    const bad = await call('POST', '/api/auth/register', { body: { email: 'hr@gmail.com', password: 'password-123', name: 'HR', role: 'recruiter', companyName: 'Acme', companyDomain: 'acme.test', consent: true } });
    expect(bad.status).toBe(400);
    const s = await call('POST', '/api/auth/register', { body: { email: 'seeker@test.dev', password: 'password-123', name: 'Seeker', role: 'seeker', consent: true } });
    expect(s.status).toBe(201); seeker = s.body.accessToken as string; seekerCookie = s.cookie;
    const r = await call('POST', '/api/auth/register', { body: { email: 'hr@acme.test', password: 'password-123', name: 'HR Acme', role: 'recruiter', companyName: 'Acme', companyDomain: 'acme.test', consent: true } });
    expect(r.status).toBe(201); recruiter = r.body.accessToken as string;
  });

  it('auth: login uses a generic error, then succeeds; role guards hold', async () => {
    const bad = await call('POST', '/api/auth/login', { body: { email: 'seeker@test.dev', password: 'wrong-password' } });
    expect(bad.status).toBe(401); expect((bad.body.error as { message: string }).message).toBe('Invalid email or password');
    const ok = await call('POST', '/api/auth/login', { body: { email: 'admin@test.dev', password: 'admin-password-1' } });
    expect(ok.status).toBe(200); admin = ok.body.accessToken as string;
    expect((await call('POST', '/api/recruiter/jobs', { token: seeker, body: {} })).status).toBe(403);
    expect((await call('GET', '/api/admin/sources', { token: recruiter })).status).toBe(403);
    expect((await call('GET', '/api/admin/sources', { token: admin })).status).toBe(200);
  });

  it('ingestion: fixture feed publishes the real job and blocks the fee scam', async () => {
    const { q } = await import('../src/db/pool.js');
    const comp = await q<{ id: number }>("INSERT INTO companies (name, normalised_name, website_domain) VALUES ('FixtureCo','fixtureco','fixtureco.example') RETURNING id");
    const src = await q<{ id: number }>("INSERT INTO sources (company_id, kind, ats_type, slug) VALUES ($1,'ats_feed','greenhouse','fixtureco') RETURNING id", [comp.rows[0].id]);
    const { ingestPayload } = await import('../src/modules/ingestion/ingest.js');
    const payload = JSON.parse(fs.readFileSync(new URL('./fixtures/greenhouse.json', import.meta.url), 'utf8'));
    const source = { id: src.rows[0].id, company_id: comp.rows[0].id, kind: 'ats_feed', ats_type: 'greenhouse', slug: 'fixtureco', feed_url: null };
    const company = { id: comp.rows[0].id, name: 'FixtureCo', website_domain: 'fixtureco.example' };
    const out = await ingestPayload(source, company, payload);
    expect(out.fetched).toBe(2);
    const list = await call('GET', '/api/jobs?q=frontend');
    expect((list.body.jobs as unknown[]).length).toBe(1); liveJobId = Number((list.body.jobs as { id: number }[])[0].id);
    const all = await q<{ status: string }>('SELECT status FROM jobs WHERE company_id=$1 ORDER BY id', [comp.rows[0].id]);
    expect(all.rows.map((r) => r.status).sort()).toEqual(['blocked', 'live']);
    // Second and third polls without the live job -> expired after 2 misses.
    const onlyScam = { jobs: [payload.jobs[1]] };
    await ingestPayload(source, company, onlyScam); await ingestPayload(source, company, onlyScam);
    expect((await call('GET', `/api/jobs/${liveJobId}`)).status).toBe(410);
    // Store ids for later steps via fresh ingest
    const back = await ingestPayload(source, company, payload);
    expect(back.fetched).toBe(2);
    const again = await call('GET', '/api/jobs?q=frontend');
    liveJobId = Number((again.body.jobs as { id: number }[])[0].id);
    expect(liveJobId).toBeGreaterThan(0);
  });

  it('seeker flows: profile, match, prep, apply assist, save, whatsapp alert (queued, not sent), tracker, report', async () => {
    const prof = await call('PUT', '/api/users/profile', { token: seeker, body: { skills: ['react', 'typescript'], batchYear: 2026, city: 'Bengaluru', college: 'Test College', currentEmployer: 'Acme', discoverableAlumni: true, minSalary: 300000 } });
    expect(prof.status).toBe(200);
    const match = await call('GET', `/api/jobs/${liveJobId}/match`, { token: seeker });
    expect(match.status).toBe(200); expect((match.body.match as { score: number }).score).toBeGreaterThan(30);
    expect((match.body.match as { reasons: string[] }).reasons.length).toBeGreaterThan(0);
    const prep = await call('GET', `/api/jobs/${liveJobId}/prep`);
    expect(prep.status).toBe(200); expect((prep.body.checklist as unknown[]).length).toBeGreaterThan(1);
    const assist = await call('GET', `/api/jobs/${liveJobId}/apply-assist`, { token: seeker });
    expect(assist.status).toBe(200); expect((assist.body.answers as unknown[]).length).toBeGreaterThan(3);
    expect((await call('POST', `/api/saved/${liveJobId}`, { token: seeker })).status).toBe(201);
    const alert = await call('POST', '/api/alerts', { token: seeker, body: { keyword: 'react', city: 'Bengaluru', batchYear: 2026, channel: 'whatsapp' } });
    expect(alert.status).toBe(201); expect(alert.body.deliveryStatus).toBe('queued_no_provider');
    const track = await call('POST', `/api/tracker/${liveJobId}`, { token: seeker, body: { stage: 'applied', followUpAt: new Date(Date.now() + 7 * 86400000).toISOString() } });
    expect(track.status).toBe(201);
    expect((await call('POST', `/api/reports/${liveJobId}`, { token: seeker, body: { reason: 'fee_asked', detail: 'asked in call' } })).status).toBe(201);
    const jsonld = await call('GET', `/api/jobs/${liveJobId}/jsonld`);
    expect(jsonld.body['@type']).toBe('JobPosting');
  });

  it('recruiter flow: first direct job waits in review, admin approves, second goes live, other recruiter cannot close it', async () => {
    const post = { title: 'Graduate Engineer Trainee', locationText: 'Bengaluru, India', city: 'Bengaluru', remoteType: 'onsite', description: 'Structured graduate role working with React and TypeScript on real product features with mentoring.', skills: ['react', 'typescript'], batchYears: [2026], salaryMin: 500000, salaryMax: 700000, salaryPeriod: 'year' };
    const p1 = await call('POST', '/api/recruiter/jobs', { token: recruiter, body: post });
    expect(p1.status).toBe(201); expect(p1.body.job.status).toBe('review');
    const queue = await call('GET', '/api/admin/review-queue', { token: admin });
    expect((queue.body.jobs as { id: number }[]).some((j) => j.id === p1.body.job.id)).toBe(true);
    const ap = await call('POST', `/api/admin/jobs/${p1.body.job.id}/approve`, { token: admin });
    expect(ap.body.job.status).toBe('live');
    const p2 = await call('POST', '/api/recruiter/jobs', { token: recruiter, body: { ...post, title: 'Frontend Intern', description: 'Internship working with React and TypeScript on real product features with mentoring and reviews.' } });
    expect(p2.body.job.status).toBe('live');
    const other = await call('POST', '/api/auth/register', { body: { email: 'hr@other.test', password: 'password-123', name: 'HR Other', role: 'recruiter', companyName: 'OtherCo', companyDomain: 'other.test', consent: true } });
    const close = await call('POST', `/api/recruiter/jobs/${p1.body.job.id}/close`, { token: other.body.accessToken as string });
    expect(close.status).toBe(404);
    const own = await call('POST', `/api/recruiter/jobs/${p2.body.job.id}/close`, { token: recruiter });
    expect(own.status).toBe(200); expect(own.body.job.status).toBe('expired');
  });

  it('refresh rotation: reuse of a rotated token revokes the family', async () => {
    const reg = await call('POST', '/api/auth/register', { body: { email: 'rotate@test.dev', password: 'password-123', name: 'Rot', role: 'seeker', consent: true } });
    const c1 = reg.cookie;
    const r1 = await call('POST', '/api/auth/refresh', { cookie: c1 });
    expect(r1.status).toBe(200);
    const reuse = await call('POST', '/api/auth/refresh', { cookie: c1 });
    expect(reuse.status).toBe(401);
    const after = await call('POST', '/api/auth/refresh', { cookie: r1.cookie });
    expect(after.status).toBe(401);
  });

  it('sitemap lists live jobs only', async () => {
    const r = await fetch(base + '/sitemap.xml'); const xml = await r.text();
    expect(r.status).toBe(200); expect(xml).toContain('/jobs/');
  });
});
