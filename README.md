# Job Portal — Verified, Always-Fresh Jobs

I built this portal for Indian freshers and tech job-seekers around two promises
that the big portals do not make:

1. **Every job is checked genuine.** A listing is only "verified" when it was
   fetched from the company's own careers page or its official ATS board *and*
   its apply link resolves to the company domain or a known ATS domain. The
   badge on every job states the check that was performed — never a bare
   "100% genuine".
2. **Every job is checked alive.** Listings are re-polled from the source feed.
   A job missing from the feed in two consecutive polls, or past its deadline,
   is expired here too. There is no blanket 30-day delete: most postings are
   still live at day 27, so age alone never kills a job.

Jobs are **not** scraped from Naukri, Indeed or LinkedIn — none of them offers a
legal aggregator feed. The same openings are collected upstream, from the ATS
(Greenhouse, Lever, Ashby, Workable) the recruiter actually posted them in,
plus legal aggregator APIs and JobPosting structured data. I show a snippet and
my own extracted facts, and **Apply always links out to the source**. Recruiter
names, emails and phone numbers are stripped at ingestion.

## What is in here

- **Ingestion** — per-ATS adapters, an immutable raw-posting store, and a
  collector runner that polls each source on its own schedule.
- **Pipeline** — normalise → strip recruiter PII → extract skills / salary /
  deadline / experience / batch years with rules → dedupe (URL canonicalisation
  + normalised fingerprint) → freshness stamps → trust scoring (hard blocks for
  fee/task scams, provenance and risk rules) → publish.
- **Three roles** — job seeker (profile-as-resume, saved jobs, alerts,
  application tracker, report a job), recruiter (one verified company, claim
  flow, post/edit/close my own jobs), admin (source registry, collector
  health, trust and report review queues). See `docs/auth-and-roles.md`.
- **Public site** — faceted search, job pages with a "checked today" proof box,
  company pages, collections, my own JobPosting JSON-LD and a sitemap of live
  jobs only, so expired pages return 410.

## Stack

TypeScript everywhere. Server: Express + PostgreSQL. Client: React + Vite.
Collectors run as in-process scheduled jobs behind a queue abstraction, so the
whole system runs on free tiers (Neon Postgres, Render, Vercel) with no paid
service required. Extraction is rules-based; no model key is needed for v1.

## Run it locally

```bash
cp .env.example .env            # fill in DATABASE_URL and JWT_SECRET
npm install
npm run migrate --workspace=server   # creates the schema
npm run seed --workspace=server      # company registry seed
npm run dev --workspace=server       # API on :4000
npm run dev --workspace=client       # web app on :5173
```

To pull real postings once the schema and seed are in:

```bash
npm run collect --workspace=server            # all active sources
npm run collect --workspace=server -- --source greenhouse:razorpay
```

## Tests

```bash
npm test            # server unit tests + full API smoke on embedded Postgres
npm run typecheck   # server and client
npm run build       # client production build
```

## Docs

- `docs/architecture.md` — system design, pipeline, freshness and dedupe
- `docs/auth-and-roles.md` — roles, permissions, claim and posting rules
- `docs/security.md` — auth flow, token rotation, hardening checklist
- `docs/api.md` — every endpoint
- `docs/screens.md` — every screen and what it does

## Rules I hold this project to

- No scraping of Naukri / Indeed / LinkedIn. Partnership or nothing.
- Snippet + link-out only; never republish a full third-party job description.
- No invented badges: no "urgently hiring", applicant counts or response-time
  claims unless the data behind them is mine and checkable.
- Takedown within 24 hours of an employer's request; every badge and block is
  backed by an audit row in `trust_events`.
