-- Business Evidence Framework — M3 B8 Phase 2.
--
-- Persistent side of the Evidence Engine:
--   • studio_evidence_findings   — Stage 1 raw findings + review trail
--   • studio_evidence_patterns   — Stage 2 aggregated patterns
--   • studio_measured_outcomes   — Stage 4 anonymised outcome data
--
-- Registrable data (evidenceRegistry + patternRegistry seeds) lives
-- in code. These tables capture PLATFORM-GENERATED findings collected
-- during operation (merchant interviews, A/B test results, live
-- measured outcomes).

set search_path = public;

-- ─── studio_evidence_findings ─────────────────────────────────
create table if not exists studio_evidence_findings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  observation text not null,
  version text not null default '1.0.0',
  source_kind text not null check (source_kind in (
    'competitor-research','merchant-interview','a-b-test','measured-outcome',
    'industry-report','academic-study','expert-opinion','internal-analysis'
  )),
  source_citation text not null,
  source_collected_by text not null,
  source_collected_at timestamptz not null default now(),
  source_reproducible boolean not null default false,
  scope_trades text[] not null,
  scope_countries text[] not null,
  scope_goals text[],
  scope_profile_flags text[],
  page_context text,
  informs_facet_kinds text[],
  supports_playbooks text[],
  measurement jsonb,
  validation_state text not null default 'draft' check (validation_state in (
    'draft','reviewed','approved','a-b-tested','measured','proven'
  )),
  corroboration_count integer not null default 0,
  reviews jsonb not null default '[]'::jsonb,
  last_state_change_at timestamptz not null default now(),
  next_step text,
  tags text[],
  publisher_name text,
  publisher_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_studio_evidence_state on studio_evidence_findings(validation_state);
create index if not exists idx_studio_evidence_source_kind on studio_evidence_findings(source_kind);
create index if not exists idx_studio_evidence_scope_trades on studio_evidence_findings using gin(scope_trades);

-- ─── studio_evidence_patterns ─────────────────────────────────
create table if not exists studio_evidence_patterns (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  statement text not null,
  version text not null default '1.0.0',
  scope_trades text[] not null,
  scope_countries text[] not null,
  scope_goals text[],
  scope_profile_flags text[],
  informs_facet_kinds text[],
  supporting_evidence text[] not null,           -- evidence finding slugs
  candidacy_status text not null default 'proposed' check (candidacy_status in (
    'proposed','adopted','rejected','superseded'
  )),
  adopted_by_playbooks text[],
  superseded_by text,
  candidacy_notes text,
  quantification jsonb,
  tags text[],
  publisher_name text,
  publisher_verified boolean not null default false,
  last_state_change_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_studio_patterns_status on studio_evidence_patterns(candidacy_status);
create index if not exists idx_studio_patterns_scope_trades on studio_evidence_patterns using gin(scope_trades);

-- ─── studio_measured_outcomes ─────────────────────────────────
-- Anonymised per-merchant outcome measurements. Merchant consent
-- required at publish time (merchant_consented boolean = true) before
-- these can feed evidence promotion.
create table if not exists studio_measured_outcomes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  merchant_consented boolean not null default false,
  playbook_slug text,
  pattern_slug text,
  facet_kind text,
  metric_slug text not null,
  metric_value numeric not null,
  metric_unit text,
  sample_size integer,
  time_window_start timestamptz not null,
  time_window_end timestamptz not null,
  variant_key text,                              -- for A/B tests
  variant_label text,
  strategy_snapshot jsonb,
  notes text,
  created_at timestamptz not null default now(),
  check (time_window_end > time_window_start)
);
create index if not exists idx_studio_outcomes_merchant on studio_measured_outcomes(merchant_id);
create index if not exists idx_studio_outcomes_playbook on studio_measured_outcomes(playbook_slug) where playbook_slug is not null;
create index if not exists idx_studio_outcomes_pattern on studio_measured_outcomes(pattern_slug) where pattern_slug is not null;
create index if not exists idx_studio_outcomes_metric on studio_measured_outcomes(metric_slug);

-- ─── RLS ──────────────────────────────────────────────────────
alter table studio_evidence_findings enable row level security;
alter table studio_evidence_patterns enable row level security;
alter table studio_measured_outcomes enable row level security;

-- Findings + patterns are platform-authored; readable by any
-- authenticated user, writable only by service role.
drop policy if exists "evidence_findings_read" on studio_evidence_findings;
create policy "evidence_findings_read"
  on studio_evidence_findings
  for select using (true);
drop policy if exists "evidence_patterns_read" on studio_evidence_patterns;
create policy "evidence_patterns_read"
  on studio_evidence_patterns
  for select using (true);

-- Outcomes are private to each merchant unless they've consented.
drop policy if exists "outcomes_owner_read" on studio_measured_outcomes;
create policy "outcomes_owner_read"
  on studio_measured_outcomes
  for select using (merchant_id = auth.uid());
drop policy if exists "outcomes_consented_platform_read" on studio_measured_outcomes;
create policy "outcomes_consented_platform_read"
  on studio_measured_outcomes
  for select using (merchant_consented = true);
drop policy if exists "outcomes_owner_write" on studio_measured_outcomes;
create policy "outcomes_owner_write"
  on studio_measured_outcomes
  for insert with check (merchant_id = auth.uid());
drop policy if exists "outcomes_owner_update" on studio_measured_outcomes;
create policy "outcomes_owner_update"
  on studio_measured_outcomes
  for update using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());
