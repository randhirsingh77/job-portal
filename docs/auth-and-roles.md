# Auth and roles

Three roles, no shortcuts between them. Permissions are enforced on the server
on every request (`requireAuth` + `requireRole` + an ownership check inside
each handler); the client only hides what a role cannot use.

## Seeker

- Profile-as-resume: batch year, degree, branch, percentage, backlogs, skills,
  resume URL and resume text, college, current/past employer, contact links,
  summary, notice period, salary expectation, and an opt-in flag for the
  referral finder.
- Saved jobs (a saved job that closes shows as Closed, never as open).
- Alerts with tight filters (keyword x city x batch) over email, push, or
  WhatsApp (opt-in per filter).
- Application tracker: Saved -> Applied -> Interviewing -> Offer / Closed,
  with a follow-up date per card and a "listing closed since you applied"
  state.
- Match score with reasons and gaps, resume-vs-job keyword check, Apply
  Assist, and reporting jobs.

## Recruiter — bound to ONE company

- Signup requires a **work email on the company domain**: free providers
  (Gmail, Yahoo, Outlook, ...) are rejected, and the email domain must equal
  the company domain given at signup.
- **Claim flow:** the same domain rule verifies a claim on an existing or new
  company (`company_claims`, verification method `work_email_domain_match`).
- Post / edit / close **only my own company's** jobs. Every handler loads the
  job with `company_id = my company`, so another recruiter's job returns 404 —
  there is no IDOR path.
- A direct posting is a source of kind `direct` and **outranks** collected
  copies of the same job in dedupe.
- **Review rule:** the first direct postings from a newly claimed company are
  created in `review` status and only go live after an admin approves one in
  the review queue; after that first approval, the company's postings publish
  directly. The trust hard-blocks apply to direct postings exactly as they do
  to collected ones — a fee-asking direct posting is rejected with its reasons.

## Admin

- Cannot self-register. An admin is created only by `npm run seed:admin`
  from environment variables.
- Source registry and collector health (collect now, quarantine a source),
  trust review queue (approve / block), reports queue (takedown), strike
  counts on sources.

## Session model

- Passwords: bcrypt, cost 12, minimum length 10. Login errors are generic
  ("Invalid email or password") and a dummy hash is compared when the account
  does not exist, so neither the message nor the timing enumerates users.
- Access token: JWT, 15 minutes, sent as a Bearer token.
- Refresh token: random 48 bytes, stored **hashed** (SHA-256) in
  `refresh_tokens`, sent as an httpOnly, SameSite=Lax cookie. Rotation on
  every refresh; presenting an already-rotated token revokes the whole token
  family and logs `refresh_reuse_detected_family_revoked`.
- Every register / login / failed login / logout / reuse event is written to
  `auth_events`.
