-- Business Operating Coach — M3 B8 Phase 4.
--
-- Persists coach state:
--   • studio_coach_assessments   — snapshots of the Business Health Score
--   • studio_coach_backlog_items — persistent backlog with progress tracking
--   • studio_coach_actions       — audit trail of every fix taken

set search_path = public;

-- ─── studio_coach_assessments ─────────────────────────────────
create table if not exists studio_coach_assessments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  overall_score smallint not null check (overall_score between 0 and 100),
  dimensions jsonb not null,                       -- array of HealthScoreEntry
  strategy_snapshot jsonb not null,
  generated_at timestamptz not null default now(),
  triggered_by text not null default 'scheduled',  -- 'scheduled' / 'merchant' / 'strategy-change'
  created_at timestamptz not null default now()
);
create index if not exists idx_coach_assessments_merchant on studio_coach_assessments(merchant_id, generated_at desc);

-- ─── studio_coach_backlog_items ───────────────────────────────
-- Persists backlog items so completion state survives across sessions.
create table if not exists studio_coach_backlog_items (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  recommendation_slug text not null,
  title text not null,
  dimension text not null,
  priority smallint not null check (priority between 1 and 5),
  estimated_impact text not null check (estimated_impact in ('high','medium','low')),
  detail text not null,
  action_label text not null,
  auto_fix_handler text,
  cited_playbooks text[],
  cited_patterns text[],
  cited_evidence text[],
  why_it_matters text not null,
  expected_outcome text not null,
  status text not null default 'open' check (status in ('open','in-progress','done','snoozed','dismissed')),
  snoozed_until timestamptz,
  completed_at timestamptz,
  dismissed_reason text,
  first_seen_at timestamptz not null default now(),
  last_reasserted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, recommendation_slug)
);
create index if not exists idx_coach_backlog_merchant on studio_coach_backlog_items(merchant_id, status);
create index if not exists idx_coach_backlog_priority on studio_coach_backlog_items(merchant_id, priority desc, estimated_impact) where status = 'open';

-- ─── studio_coach_actions ─────────────────────────────────────
-- Audit trail: every time a merchant triggered a fix, what happened.
create table if not exists studio_coach_actions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  recommendation_slug text not null,
  handler text not null,
  triggered_at timestamptz not null default now(),
  outcome text not null default 'started' check (outcome in ('started','completed','failed','abandoned')),
  outcome_notes text,
  strategy_snapshot jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_coach_actions_merchant on studio_coach_actions(merchant_id, triggered_at desc);

-- ─── RLS ──────────────────────────────────────────────────────
alter table studio_coach_assessments enable row level security;
alter table studio_coach_backlog_items enable row level security;
alter table studio_coach_actions enable row level security;

drop policy if exists "coach_assessments_owner" on studio_coach_assessments;
create policy "coach_assessments_owner"
  on studio_coach_assessments
  for all
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());

drop policy if exists "coach_backlog_owner" on studio_coach_backlog_items;
create policy "coach_backlog_owner"
  on studio_coach_backlog_items
  for all
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());

drop policy if exists "coach_actions_owner" on studio_coach_actions;
create policy "coach_actions_owner"
  on studio_coach_actions
  for all
  using (merchant_id = auth.uid())
  with check (merchant_id = auth.uid());
