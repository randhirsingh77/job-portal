# API

Base: the API serves JSON under `/api`. Errors are
`{ "error": { "code": "...", "message": "..." } }`. An expired job detail
returns **410 Gone**. Auth uses a Bearer access token (15 min) plus an
httpOnly refresh cookie on `/api/auth/*`.

## Public

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Service + database health |
| GET | `/sitemap.xml` | Live jobs only (max 5,000) |
| GET | `/api/jobs` | Faceted search: `q, city, remote, expMax, salaryMin, postedDays, batch, collection (closing-soon/new-today/fresher/remote-india), page, limit`. Cards carry derived signals (posted label, new, closing soon, checked today, still accepting, immediate-joiner-mentioned, company actively posting, repost count) |
| GET | `/api/jobs/:id` | Job detail: snippet, skills, proof data, trust events, Hinglish summary, and a labelled salary estimate only when computed from at least 3 same-role/city listings on this portal |
| GET | `/api/jobs/:id/jsonld` | schema.org JobPosting for the job |
| GET | `/api/jobs/:id/prep` | Interview-prep study checklist generated from the listing's skills |
| GET | `/api/companies` | Companies with live-job counts |
| GET | `/api/companies/:id` | Company, its live jobs, and opted-in self-declared people at the company (referral finder) |

## Auth

| Method | Path | What it does |
|---|---|---|
| POST | `/api/auth/register` | Seeker or recruiter signup (recruiter: work-email domain must equal company domain; consent required) |
| POST | `/api/auth/login` | Generic errors; sets the refresh cookie |
| POST | `/api/auth/refresh` | Rotates the refresh token; reuse of a rotated token revokes the family |
| POST | `/api/auth/logout` | Revokes the refresh token and clears the cookie |
| GET | `/api/auth/me` | Current user |

## Seeker (role: seeker)

| Method | Path | What it does |
|---|---|---|
| GET/PUT | `/api/users/profile` | Profile-as-resume incl. college, employer, links, resume text, alumni opt-in |
| GET | `/api/jobs/:id/match` | Match score with reasons, gaps and missing keywords for my profile |
| GET | `/api/jobs/:id/apply-assist` | Copy-ready application answers built from my profile |
| GET/POST/DELETE | `/api/saved`, `/api/saved/:jobId` | Saved jobs (closed ones stay visible as Closed) |
| GET/POST/DELETE | `/api/alerts`, `/api/alerts/:id` | Alerts (keyword x city x batch; channel email/push/whatsapp) |
| GET | `/api/alerts/deliveries/mine` | My delivery log with honest statuses |
| GET/POST/DELETE | `/api/tracker`, `/api/tracker/:jobId` | Tracker board; stage, follow-up date, lifecycle stage; closed listings are flagged |
| POST | `/api/reports/:jobId` | Report a job (fee asked, fake company, WhatsApp-only, expired, wrong info, other) |

## Recruiter (role: recruiter, one verified company)

| Method | Path | What it does |
|---|---|---|
| GET | `/api/recruiter/me` | My company + my claims |
| POST | `/api/recruiter/claim` | Claim a company; verified only on work-email domain match |
| POST | `/api/recruiter/jobs` | Post a job (structured fields; trust rules apply; first postings go to review) |
| GET | `/api/recruiter/jobs` | My company's jobs |
| PATCH | `/api/recruiter/jobs/:id` | Edit my job (foreign job = 404) |
| POST | `/api/recruiter/jobs/:id/close` | Close my job (foreign job = 404) |

## Admin (role: admin)

| Method | Path | What it does |
|---|---|---|
| GET | `/api/admin/sources` | Source registry |
| GET | `/api/admin/collector-runs` | Collector health |
| POST | `/api/admin/sources/:id/collect` | Run one collector now |
| POST | `/api/admin/sources/:id/quarantine` | Quarantine a source and its live jobs; adds a strike |
| GET | `/api/admin/review-queue` | Jobs in review or blocked |
| POST | `/api/admin/jobs/:id/approve` / `/block` | Approve (also marks the company first-direct-approved) / block |
| GET | `/api/admin/reports` | Open user reports |
| POST | `/api/admin/reports/:id/action` | Action a report (`action: "takedown"` blocks the job) |
