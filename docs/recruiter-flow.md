# Recruiter flow — Stage 2-3 recruiter layer, built in v1

The portal starts as an aggregator: jobs arrive from company career pages and
ATS feeds, so no recruiter account is needed for supply. The recruiter layer
is built on top of that, in the order a real marketplace grows:

## Stage 2 — Claim your company

1. Every company collected from a careers page already has a company page.
2. A recruiter signs up with a **work email**. Free providers are rejected.
3. They claim the company (by its listed ID) or add it (name + domain +
   careers URL).
4. **Verification rule:** the claim verifies only when the account's email
   domain equals the company domain. The claim row is stored in
   `company_claims` with `verification_method = work_email_domain_match`,
   the company is marked `verified_domain`, and the recruiter account is
   bound to that one company.
5. After claiming, the recruiter can post and manage jobs and sees the jobs
   already collected for the company.

## Stage 3 — Post a job directly

1. The post-a-job form takes **structured fields only** — title, location,
   city, work type, salary range and period, skills, batch years, experience,
   deadline, description, optional lifecycle dates. Structure is what keeps
   the freshness and eligibility rules enforceable.
2. The posting runs through the **same trust engine** as a collected job.
   Fee/deposit language, ID/bank details before an offer, or a task-scam
   pattern rejects it with the reasons shown to the recruiter.
3. **Review rule:** the first direct postings from a newly claimed company
   are created with status `review`. An admin approves (or blocks) them in
   the trust review queue. The first approval flips
   `companies.first_direct_approved`, and from then on that company's
   postings go live immediately.
4. A direct posting is stored as a source of kind `direct` with **rank 1** —
   in dedupe it outranks the ATS copy and the aggregator copy of the same
   job, and if the recruiter closes it here, it expires even if a stale
   aggregator still lists it.
5. **Manage:** the employer dashboard lists only the recruiter's own
   company's jobs, with edit and close. Closing sets the job expired at once.
   Another company's job cannot be edited or closed — the API returns 404.

## What a recruiter never gets

- Access to another company's jobs, applicants, or claims.
- A way to bypass the trust rules (no "featured" or paid skip in v1).
- Candidate contact data beyond what a candidate chose to share through an
  application on the source site — applications happen at the source.
