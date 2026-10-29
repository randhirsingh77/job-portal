# Architecture

## The shape of the system

```
DISCOVERY   company registry (seed/companies.json) · ATS/slug detection via
            Careers -> Apply links · re-probing (companies migrate ATSs)
    |
COLLECTORS  per-ATS adapters (Greenhouse, Lever, Ashby, Workable) running as
            scheduled in-process jobs behind a queue abstraction
    |       raw postings stored exactly as fetched (raw_postings, immutable)
PIPELINE    normalise -> strip recruiter PII -> extract skills/salary/deadline/
            experience/batch -> dedupe -> freshness stamps -> trust scoring
            -> publish
    |
PostgreSQL -- API (Express + TypeScript) -- React web app
    ^
LIVENESS    re-polls feeds, expires jobs (2 missed polls / deadline), publishes
            JobPosting JSON-LD + sitemap.xml of live jobs only (expired = 410)
```

## Why these choices

- **PostgreSQL (Neon free tier), not MongoDB.** Jobs are relational
  (company - jobs - sources - checks), freshness is set-based SQL, and
  full-text search plus pgvector live in the same database. The schema uses
  BIGINT identity keys, TEXT strings, TIMESTAMPTZ instants, NUMERIC money,
  indexed foreign keys, a trigger-maintained `tsvector` search document, and a
  unique fingerprint per canonical job.
- **Queue abstraction, in-process by default.** Collectors are plain scheduled
  jobs (`server/src/jobs/`). No external queue is required to run the system;
  if I later set a Redis URL (Upstash free tier), the same job functions can be
  backed by a real queue without changing callers. One dead source never
  blocks the others: each collector run is recorded in `collector_runs` with
  its own status.
- **HTTP first, browser never (for v1).** The ATS feeds are the same JSON the
  company's own careers page loads, so no rendering is needed. That keeps
  collection fast, cheap and polite.
- **Diff-based polling is the product.** Fast boards poll more often, dormant
  boards less. New IDs in a feed are new jobs; IDs missing in two consecutive
  polls are closed jobs. That diff powers "new today", "still accepting",
  "company actively posting", and the tracker state "this listing closed
  since you applied".

## Dedupe (layers 1-2 in v1)

1. **URL canonicalisation** — strip tracking parameters (`utm_*`, `gh_src`,
   `lever-source`, fragments) and normalise the host. On its own this removes
   roughly half of all duplicates in aggregator data.
2. **Normalised fingerprint** — SHA-256 of normalised company + title +
   location (legal suffixes like "Pvt Ltd" removed). Unique index on
   `jobs.fingerprint`; every source that carries the job is kept in
   `job_sources` with a rank (direct 1, ATS feed 2, JSON-LD/government 3,
   aggregator API 4, HTML 5). The highest-ranked source provides the canonical
   copy, and when the canonical source expires the job, the merged record
   expires too. A job that returns after expiring is counted in
   `jobs.repost_count` ("Reposted N times" on the card).

Layers 3-4 (MinHash near-duplicates, embedding similarity) are designed in the
research notes and stay roadmap items until the duplicate rate from layers 1-2
proves it needs them — see `docs/features.md`.

## Freshness rules (as implemented)

1. Missing from the source feed in **2 consecutive polls** -> expired.
2. **Deadline passed** -> expired (hourly deadline job + check at ingest).
3. A timeout or a partial feed never expires a job on its own.
4. **No blanket 30-day delete.** Research on direct-employer postings shows
   56-69% are still live at day 27, so age alone never kills a listing.
5. Every check is written to `freshness_checks`; every card can show
   "Checked today".

## Trust rules (as implemented)

- **Hard blocks (auto-reject):** fee/deposit/"refundable charge" language;
  Aadhaar/PAN/bank details asked before an offer; task-scam patterns
  ("like videos, earn ...").
- **Provenance:** the verified tier requires the apply link to resolve to the
  company domain or a known ATS domain. Shorteners, Google Forms and
  messaging links add risk and demote the job.
- **Risk reasons are stored** on the job and every decision is logged in
  `trust_events`, which powers the "Why we verified this" panel.
- **User reports** go to the admin reports queue; an admin takedown blocks the
  job, and a source can be quarantined (its live jobs are quarantined with it).

## Stage 2-3 recruiter layer (built in v1)

See `docs/recruiter-flow.md`. In architecture terms: a direct posting is a new
source kind (`direct`, rank 1 — it outranks every collected copy in dedupe),
bound to exactly one verified company per recruiter account.

## Cost: ₹0

| Need | What I use | Tier |
|---|---|---|
| Database | PostgreSQL on Neon (local/embedded Postgres for dev and tests) | Free |
| Queue / scheduling | In-process scheduler behind a queue abstraction (Upstash free Redis is an optional drop-in) | Free |
| API hosting | Render | Free |
| Web hosting | Vercel | Free |
| Nightly jobs | GitHub Actions | Free |
| Data sources | Public ATS feeds; Adzuna with its **free** key only; Careerjet free affiliate API | Free |
| Optional extras | JSearch / Jooble / Firecrawl / Gemini — env-gated only, never required, never the default path, and the system runs fully with no key at all | Free tier, optional |
| Email alerts | Plain SMTP env (for example a free Gmail app password); unset = queued and logged | Free |
| WhatsApp alerts | Only via a webhook I provide through env; unset = queued and logged, never marked sent | Free |

Free tiers limit rate and scale, not quality. Nothing in the required path
needs a paid plan, a paid API tier, or a card-required signup.
