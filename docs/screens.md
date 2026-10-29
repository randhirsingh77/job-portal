# Screens

Mobile-first, plain design. Fifteen routes:

## Public

1. **Home** (`/`) — search box (keyword + city), the "We never charge
   candidates" banner, collection chips, newest live jobs.
2. **Search / Results** (`/search`) — filter panel (keyword, city, work type,
   batch year, max experience, min salary, posted-within) and the reusable
   **JobCard**: title, company, location, salary when the employer states it,
   skill and batch chips, derived signals (New, Closing in N days, Checked
   today, Still accepting, Immediate joiner mentioned in the posting,
   Reposted N times, Closed at source), the provenance badge line, and
   Apply-at-source (which also adds the job to the seeker's tracker).
3. **Job Detail** (`/jobs/:id`) — snippet and extracted skills, deadline with
   days left, lifecycle card when dates exist, "Why we verified this" panel
   with the trust events behind it, Hinglish summary ("yeh job kya hai, kaun
   apply kar sakta hai", generated from the job's own fields), salary or a
   clearly labelled estimate, match panel (score, reasons, gaps, missing
   keywords), Apply Assist panel, interview-prep checklist, Save and
   Report actions.
4. **Companies** (`/companies`) and **Company** (`/companies/:id`) — live
   jobs plus the referral finder panel (opted-in, self-declared profiles
   only, labelled as such).
5. **Collections** (`/collections`) — Fresher (0-1 yr), New today, Closing
   this week, Remote, and 2026 Batch.
6. **Login** (`/login`) and **Signup** (`/signup`) — role choice up front;
   the recruiter form explains and enforces the work-email domain rule.

## Seeker

7. **Profile** (`/profile`) — profile-as-resume incl. college, employer,
   links, resume text (used only for the keyword check), and the referral
   finder opt-in.
8. **Saved Jobs** (`/saved`) — saved jobs; closed ones show as Closed.
9. **Alerts** (`/alerts`) — create/list alerts (role x city x batch, channel
   email/push/WhatsApp) and the delivery log with honest statuses.
10. **Tracker** (`/tracker`) — five-column board (Saved, Applied,
    Interviewing, Offer, Closed), follow-up dates with a "remind me in 7
    days" action, and "This listing closed since you applied" flags.
11. **My Matches** (`/matches`) — live jobs ranked by my match score.

## Recruiter

12. **Employer Dashboard** (`/recruiter`) — my company and claim status, the
    structured post-a-job form, and my company's jobs with close actions.
13. **Claim Company** (`/recruiter/claim`) — claim by listed company ID or
    add a company, with the domain verification rule stated on the page.

## Admin

14. **Admin** (`/admin`) — source registry with detection status, Collect
    now and Quarantine per source, recent collector runs, the trust review
    queue (approve/block), and the reports queue (takedown).
15. **Report-a-job modal** — available on every job detail: fee asked, fake
    company, WhatsApp/Telegram only, expired, wrong info, other.
