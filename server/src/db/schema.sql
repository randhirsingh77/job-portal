-- Job Portal schema. Conventions: BIGINT identity PKs, TEXT for strings,
-- TIMESTAMPTZ for instants, NUMERIC for money, FK columns always indexed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  normalised_name TEXT NOT NULL,
  website_domain TEXT,
  careers_url TEXT,
  logo_url TEXT,
  industry TEXT,
  hq_city TEXT,
  verified_domain BOOLEAN NOT NULL DEFAULT FALSE,
  first_direct_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS companies_normalised_name_key ON companies (normalised_name);

CREATE TABLE IF NOT EXISTS sources (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ats_feed','aggregator_api','jsonld','govt_pdf','html','direct')),
  ats_type TEXT,
  slug TEXT,
  feed_url TEXT,
  poll_interval_min BIGINT NOT NULL DEFAULT 1440,
  etag TEXT,
  last_polled_at TIMESTAMPTZ,
  last_status TEXT,
  missed_polls BIGINT NOT NULL DEFAULT 0,
  strike_count BIGINT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  detection_status TEXT NOT NULL DEFAULT 'seed_unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sources_company_idx ON sources (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS sources_company_kind_slug_key ON sources (company_id, kind, ats_type, slug);

CREATE TABLE IF NOT EXISTS raw_postings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id TEXT,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raw_postings_source_idx ON raw_postings (source_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS raw_postings_external_idx ON raw_postings (source_id, external_id);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('seeker','recruiter','admin')),
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  consent_terms_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS users_company_idx ON users (company_id);

CREATE TABLE IF NOT EXISTS seeker_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city TEXT,
  batch_year BIGINT,
  degree TEXT,
  branch TEXT,
  percent NUMERIC(5,2),
  backlogs BIGINT NOT NULL DEFAULT 0,
  skills TEXT[] NOT NULL DEFAULT '{}',
  resume_url TEXT,
  preferred_roles TEXT[] NOT NULL DEFAULT '{}',
  preferred_cities TEXT[] NOT NULL DEFAULT '{}',
  min_salary NUMERIC(12,2),
  college TEXT,
  current_employer TEXT,
  phone TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  summary TEXT,
  resume_text TEXT,
  notice_period TEXT,
  discoverable_alumni BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  normalised_title TEXT NOT NULL,
  location_text TEXT,
  city TEXT,
  remote_type TEXT NOT NULL DEFAULT 'unknown' CHECK (remote_type IN ('remote','hybrid','onsite','unknown')),
  experience_min NUMERIC(4,1),
  experience_max NUMERIC(4,1),
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  salary_currency TEXT NOT NULL DEFAULT 'INR',
  salary_period TEXT,
  employment_type TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  batch_years BIGINT[] NOT NULL DEFAULT '{}',
  snippet TEXT NOT NULL DEFAULT '',
  description_text TEXT,
  apply_url TEXT NOT NULL,
  canonical_source_id BIGINT REFERENCES sources(id) ON DELETE SET NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','expired','blocked','quarantined','review')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_posted TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  trust_tier TEXT NOT NULL DEFAULT 'unverified' CHECK (trust_tier IN ('verified_source','direct','aggregator','unverified')),
  risk_score BIGINT NOT NULL DEFAULT 0,
  risk_reasons TEXT[] NOT NULL DEFAULT '{}',
  badge_text TEXT,
  last_verified_at TIMESTAMPTZ,
  missed_polls BIGINT NOT NULL DEFAULT 0,
  repost_count BIGINT NOT NULL DEFAULT 0,
  last_reposted_at TIMESTAMPTZ,
  lifecycle JSONB NOT NULL DEFAULT '{}',
  search_doc TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(array_to_string(skills,' '),'') || ' ' || coalesce(location_text,''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_fingerprint_key ON jobs (fingerprint);
CREATE INDEX IF NOT EXISTS jobs_status_city_deadline_idx ON jobs (status, city, deadline_at);
CREATE INDEX IF NOT EXISTS jobs_company_idx ON jobs (company_id);
CREATE INDEX IF NOT EXISTS jobs_search_doc_gin ON jobs USING GIN (search_doc);
CREATE INDEX IF NOT EXISTS jobs_skills_gin ON jobs USING GIN (skills);
CREATE INDEX IF NOT EXISTS jobs_first_seen_idx ON jobs (first_seen_at DESC);

CREATE TABLE IF NOT EXISTS job_sources (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_rank BIGINT NOT NULL DEFAULT 50,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, source_id)
);
CREATE INDEX IF NOT EXISTS job_sources_source_idx ON job_sources (source_id);
CREATE INDEX IF NOT EXISTS job_sources_job_idx ON job_sources (job_id);

CREATE TABLE IF NOT EXISTS freshness_checks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT NOT NULL CHECK (method IN ('feed_poll','http_check','deadline','manual')),
  result TEXT NOT NULL CHECK (result IN ('alive','gone','unknown')),
  http_status BIGINT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS freshness_checks_job_idx ON freshness_checks (job_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS trust_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  source_id BIGINT REFERENCES sources(id) ON DELETE SET NULL,
  rule TEXT NOT NULL,
  outcome TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trust_events_job_idx ON trust_events (job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('fee_asked','fake_company','whatsapp_only','expired','wrong_info','other')),
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_job_idx ON reports (job_id);

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS saved_jobs_job_idx ON saved_jobs (job_id);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword TEXT,
  city TEXT,
  batch_year BIGINT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','push','whatsapp')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alerts_user_idx ON alerts (user_id);

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'saved' CHECK (stage IN ('saved','applied','interviewing','offer','closed')),
  applied_at TIMESTAMPTZ,
  listing_closed_notified BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_at TIMESTAMPTZ,
  lifecycle_stage TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS applications_user_idx ON applications (user_id, stage);
CREATE INDEX IF NOT EXISTS applications_job_idx ON applications (job_id);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id BIGINT REFERENCES alerts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued_no_provider','queued','sent','failed')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alert_deliveries_user_idx ON alert_deliveries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  family_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by BIGINT REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_key ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens (family_id);

CREATE TABLE IF NOT EXISTS company_claims (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_domain TEXT NOT NULL,
  company_domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verification_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS company_claims_company_idx ON company_claims (company_id);
CREATE INDEX IF NOT EXISTS company_claims_user_idx ON company_claims (user_id);

CREATE TABLE IF NOT EXISTS auth_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  event TEXT NOT NULL,
  ip TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_events_user_idx ON auth_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS collector_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id BIGINT REFERENCES sources(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','failed')),
  fetched_count BIGINT NOT NULL DEFAULT 0,
  new_count BIGINT NOT NULL DEFAULT 0,
  expired_count BIGINT NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS collector_runs_source_idx ON collector_runs (source_id, started_at DESC);
