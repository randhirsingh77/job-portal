# Security

Baseline target: OWASP ASVS Level 2 for the auth and data paths.

## What is implemented

- **Passwords:** bcrypt (cost 12), minimum length 10, no composition theatre.
- **No user enumeration:** one generic login error; timing blunted with a
  dummy bcrypt compare for unknown accounts; signup does not confirm whether
  an email already exists.
- **Rate limiting** on all auth routes (`AUTH_RATE_MAX` per 15 minutes).
- **Tokens:** short-lived JWT access tokens (15 min); refresh tokens are
  random, hashed at rest, rotated on use, family-revoked on reuse, and travel
  only in an httpOnly SameSite=Lax cookie (Secure when `COOKIE_SECURE=true`).
- **Headers & CORS:** helmet defaults; CORS is an allowlist from env, with
  credentials — arbitrary origins are rejected.
- **Validation:** every request body and query is parsed with zod before it
  reaches a handler. Body size is capped.
- **Injection:** parameterised queries only (`pg` placeholders everywhere);
  there is no string-built SQL. Search uses `plainto_tsquery`, never raw
  user-built tsquery.
- **Access control / IDOR:** role middleware plus per-resource ownership
  checks (seeker data is always filtered by the caller's user id; recruiter
  job operations are always filtered by the caller's company id — a foreign
  job is a 404, not a 403, so its existence is not leaked either).
- **PII handling:** recruiter names, emails and phone numbers are stripped
  from collected job text at ingestion (DPDP). Refresh tokens and passwords
  are never stored or logged in plain text.
- **Audit logging:** `auth_events` for authentication, `trust_events` for
  every badge/block decision, `collector_runs` for ingestion.
- **Secrets:** environment only (`.env.example` lists every variable). No
  secret is committed, and the repo contains no credential of any kind.

## Operating rules

- Employer takedown requests are actioned within 24 hours from the admin
  reports queue.
- A source accumulates strikes from reports and blocks; quarantining a source
  quarantines its live jobs.
- Admin accounts are provisioned out-of-band (`seed:admin`) — there is no
  public route that can create one.
