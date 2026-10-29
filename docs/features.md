# Features — built vs roadmap

Everything below comes from a feature study of ~23 job products (LinkedIn,
Indeed, Naukri, Cutshort, Wellfound, Instahyre, Hirist, Jobright, Simplify,
Teal, Huntr, Internshala, Unstop, Apna, the Sarkari sites, and more). Each
feature is marked **Built** (working end to end: API + UI + tests) or
**Roadmap** (deliberately not built yet, with the reason). Nothing here is
faked: where a signal cannot be known honestly, the product says so instead
of inventing it.

## Built in v1

| Feature | Adoption in the study | How it works here |
|---|---|---|
| Faceted search, saved jobs, alerts, profile-as-resume, company pages, salary on the listing | Table stakes (most) | Search filters incl. batch year; salary shown only when the employer states it |
| Verified-today + official-domain apply + auto-expire | Almost none | Provenance badge states the check; feed-diff expiry (2 missed polls / deadline); expired detail returns 410 |
| Batch-year / eligibility gating | Almost none outside fresher sites | Batch filter + batch chips; match scoring checks batch eligibility |
| Match score **with reasons and gaps** | Almost none do reasons well (Jobright, LinkedIn) | Deterministic score (skills 50, experience 15, batch 15, location 10, salary 10) computed from my profile against the listing's own extracted fields; reasons and gaps listed on the job page and in My Matches |
| Resume-vs-job tailoring / missing-keyword checklist | Some (Teal, Huntr, Simplify) | Listing skills absent from my profile skills and pasted resume text, shown per job in the match panel |
| Cross-portal application tracker | Almost none among portals (Teal charges $13/week) | Free board over jobs from every source; Apply click adds the card; follow-up date per card; "listing closed since you applied" from the feed diff |
| WhatsApp alerts with tight filters | Most in the India fresher/govt niche, almost none globally | Channel `whatsapp`, opt-in per filter (role x city x batch). Sending happens only when a webhook is configured by env; otherwise the delivery is queued and logged as `queued_no_provider` — never shown as sent |
| Email alerts | Table stakes | Sent only when free SMTP env is set; otherwise queued and logged the same honest way |
| Drive / government lifecycle tracking | Almost none outside govt sites | Lifecycle dates stored per job (apply-by, fee date, exam/test, admit card, result) and shown as a lifecycle card; a tracker card can hold a lifecycle stage |
| College-alumni referral finder | Almost none (Jobright Insider, LinkedIn alumni) | Honest version: seekers may opt in and self-declare college + employer; a company page shows opted-in people whose declared employer matches, labelled self-declared |
| Interview prep for the specific job | Some, growing (Indeed Career Scout, Apna) | A study checklist generated from the listing's extracted skills using a curated topic map per skill. It is labelled as topics to prepare — never as questions the company actually asked |
| Apply Assist (autofill-style help) | Some (Simplify Copilot) | Copy-ready answers built from my own profile on the job page. The portal never submits an application for me — I paste into the official form |
| Salary estimate when the employer states none | Some (Google, LinkedIn estimates) | Only when at least 3 same-role/city listings on this portal state a salary; shown with the label "estimate from N listings on this portal". Otherwise nothing is shown |
| Freshness signals beyond a date | Some, rising | Posted X ago (first seen at source), New, Closing in N days, Checked today, Still accepting, Reposted N times (from fingerprint history) |
| Scam shield + reporting | Some | "We never charge candidates" banner, hard-block trust rules, report-a-job with an admin takedown queue |
| Hinglish job summaries | Almost none in tech portals | Rule/template summary from the job's own fields: "yeh job kya hai, kaun apply kar sakta hai" |
| Curated collections | Some | Fresher, New today, Closing this week, Remote, 2026 Batch |
| Recruiter layer (claim, post, manage) | Marketplace table stakes | See `docs/recruiter-flow.md` — Stage 2-3, built in v1 |
| JobPosting JSON-LD + sitemap | Google for Jobs model | Per-job JSON-LD endpoint; sitemap of live jobs only |

## Roadmap — not built, on purpose

| Feature | Adoption | Why it is roadmap, and the planned phase |
|---|---|---|
| Chrome extension overlay ("check this job" on other sites) | Almost none among portals | A separate client surface with its own store review and update channel; planned after the web portal has traffic (post-Phase 6) |
| Full auto-submit apply agent | Almost none (Jobright's is gated) | Submitting applications on a candidate's behalf carries account-risk on third-party ATSs and needs per-ATS form automation; Apply Assist covers the honest middle ground for now |
| Video resume | Almost none | Weak evidence of value in the study (one niche product); a 60-second optional intro is the most the evidence supports, and only if users ask |
| Standalone skill-assessment engine | Some (Foundit Skillyst, Unstop in-flow) | A credible assessment needs a question bank, proctoring decisions and employer trust in the badge — a product of its own, not a v1 add-on |
| Dedupe layers 3-4 (MinHash, embeddings) | — | Built when the duplicate rate from layers 1-2 is measured to need it (Phase 3/6 design) |
| ML scam model | — | The rules + provenance engine ships first; a model trained on the public EMSCAD data (honest F1 ~0.88) and my own report data is a later signal, never the sole gate (Phase 7 design) |
| "Urgently hiring" / applicant counts / response-time badges | Some (Indeed, LinkedIn) | **Not roadmap — refused.** Those numbers live inside other platforms' systems; showing them without the data behind them would be inventing trust signals. The honest equivalents (company actively posting, closing soon, checked today) are built instead |

## Cost note

Every built feature runs on the ₹0 stack in `docs/architecture.md`. Free
tiers limit rate and scale, not quality — no feature above is a paid tier of
anything.
