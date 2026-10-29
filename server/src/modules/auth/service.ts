import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { q } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { sha256, uuid, emailDomain, FREE_EMAIL_DOMAINS, domainOf, normaliseName } from '../../utils/text.js';
import { badRequest, unauthorised } from '../../utils/errors.js';
import { signAccess, type AuthedUser } from '../../middleware/auth.js';

export interface PublicUser { id: number; email: string; name: string; role: string; companyId: number | null }

export async function logAuthEvent(userId: number | null, email: string | null, event: string, ip: string | null, detail = ''): Promise<void> {
  await q('INSERT INTO auth_events (user_id, email, event, ip, detail) VALUES ($1,$2,$3,$4,$5)', [userId, email, event, ip, detail]).catch(() => undefined);
}

async function issueRefresh(userId: number, familyId: string, ip: string | null, ua: string | null): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const expires = new Date(Date.now() + env.refreshTtlDays * 86400000);
  await q('INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [userId, sha256(token), familyId, expires, ua, ip]);
  return token;
}

export async function register(input: { email: string; password: string; name: string; role: 'seeker' | 'recruiter'; companyName?: string; companyDomain?: string; consent: boolean }, ip: string | null, ua: string | null): Promise<{ user: PublicUser; access: string; refresh: string }> {
  if (!input.consent) throw badRequest('Consent is required to create an account');
  const email = input.email.toLowerCase().trim();
  const domain = emailDomain(email);
  let companyId: number | null = null;
  if (input.role === 'recruiter') {
    if (FREE_EMAIL_DOMAINS.has(domain)) throw badRequest('Recruiters must sign up with a work email on the company domain, not a free email provider');
    if (!input.companyDomain || !input.companyName) throw badRequest('Recruiter signup needs company name and company domain');
    const cd = domainOf(input.companyDomain);
    if (!cd || cd !== domain) throw badRequest('Your work email domain must match your company domain');
    const comp = await q<{ id: number }>(
      `INSERT INTO companies (name, normalised_name, website_domain, verified_domain) VALUES ($1,$2,$3,TRUE)
       ON CONFLICT (normalised_name) DO UPDATE SET website_domain = COALESCE(companies.website_domain, EXCLUDED.website_domain), verified_domain = TRUE RETURNING id`,
      [input.companyName, normaliseName(input.companyName), cd]);
    companyId = comp.rows[0].id;
  }
  const existing = await q('SELECT id FROM users WHERE LOWER(email)=$1', [email]);
  if (existing.rows.length) {
    // Generic message: do not reveal whether the email exists beyond this signup attempt context.
    throw badRequest('Could not create the account with those details');
  }
  const hash = await bcrypt.hash(input.password, 12);
  const ins = await q<{ id: number }>(
    'INSERT INTO users (email, password_hash, name, role, company_id, consent_terms_at) VALUES ($1,$2,$3,$4,$5,now()) RETURNING id',
    [email, hash, input.name, input.role, companyId]);
  const userId = ins.rows[0].id;
  if (input.role === 'seeker') await q('INSERT INTO seeker_profiles (user_id) VALUES ($1)', [userId]);
  if (input.role === 'recruiter' && companyId) {
    await q(`INSERT INTO company_claims (company_id, user_id, email_domain, company_domain, status, verification_method)
             VALUES ($1,$2,$3,$4,'verified','work_email_domain_match')`, [companyId, userId, domain, domain]);
    await q(`INSERT INTO sources (company_id, kind, detection_status) VALUES ($1,'direct','recruiter_registered') ON CONFLICT DO NOTHING`, [companyId]);
  }
  await logAuthEvent(userId, email, 'register', ip);
  const u: AuthedUser = { id: userId, role: input.role, companyId };
  return { user: { id: userId, email, name: input.name, role: input.role, companyId }, access: signAccess(u), refresh: await issueRefresh(userId, uuid(), ip, ua) };
}

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);
export async function login(emailRaw: string, password: string, ip: string | null, ua: string | null): Promise<{ user: PublicUser; access: string; refresh: string }> {
  const email = emailRaw.toLowerCase().trim();
  const r = await q<{ id: number; password_hash: string; name: string; role: AuthedUser['role']; company_id: number | null; status: string }>(
    'SELECT id, password_hash, name, role, company_id, status FROM users WHERE LOWER(email)=$1', [email]);
  const row = r.rows[0];
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok || row.status !== 'active') {
    await logAuthEvent(row?.id ?? null, email, 'login_failed', ip);
    throw unauthorised('Invalid email or password');
  }
  await logAuthEvent(row.id, email, 'login', ip);
  const u: AuthedUser = { id: row.id, role: row.role, companyId: row.company_id };
  return { user: { id: row.id, email, name: row.name, role: row.role, companyId: row.company_id }, access: signAccess(u), refresh: await issueRefresh(row.id, uuid(), ip, ua) };
}

export async function rotateRefresh(token: string, ip: string | null, ua: string | null): Promise<{ user: PublicUser; access: string; refresh: string }> {
  if (!token) throw unauthorised('No refresh session');
  const hash = sha256(token);
  const r = await q<{ id: number; user_id: number; family_id: string; expires_at: Date; revoked_at: Date | null }>(
    'SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash=$1', [hash]);
  const row = r.rows[0];
  if (!row) throw unauthorised('Session not recognised');
  if (row.revoked_at) {
    // Reuse of a rotated/revoked token: treat as theft, revoke the whole family.
    await q('UPDATE refresh_tokens SET revoked_at=now() WHERE family_id=$1 AND revoked_at IS NULL', [row.family_id]);
    await logAuthEvent(row.user_id, null, 'refresh_reuse_detected_family_revoked', ip);
    throw unauthorised('Session revoked, sign in again');
  }
  if (new Date(row.expires_at).getTime() < Date.now()) throw unauthorised('Session expired, sign in again');
  const u = await q<{ id: number; email: string; name: string; role: AuthedUser['role']; company_id: number | null }>(
    'SELECT id, email, name, role, company_id FROM users WHERE id=$1', [row.user_id]);
  if (!u.rows.length) throw unauthorised('Session not recognised');
  const refresh = await issueRefresh(row.user_id, row.family_id, ip, ua);
  const newest = await q<{ id: number }>('SELECT id FROM refresh_tokens WHERE token_hash=$1', [sha256(refresh)]);
  await q('UPDATE refresh_tokens SET revoked_at=now(), replaced_by=$2 WHERE id=$1', [row.id, newest.rows[0].id]);
  const usr = u.rows[0];
  const au: AuthedUser = { id: usr.id, role: usr.role, companyId: usr.company_id };
  return { user: { id: usr.id, email: usr.email, name: usr.name, role: usr.role, companyId: usr.company_id }, access: signAccess(au), refresh };
}

export async function logout(token: string | undefined, userId: number | null, ip: string | null): Promise<void> {
  if (token) await q('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1', [sha256(token)]);
  await logAuthEvent(userId, null, 'logout', ip);
}
