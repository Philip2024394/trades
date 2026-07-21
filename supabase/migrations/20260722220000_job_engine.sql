-- Job Engine — trade-agnostic schema.
--
-- ONE Job, many actors, event-sourced, permission-scoped.
-- Every construction trade becomes a job_type — concrete first,
-- then decking, roofing, kitchen, staircase, plumbing, electrical.
--
-- Adding a new trade = insert a job_template row + KB pack + calculator
-- function. Zero application code changes.
--
-- The Job is the primitive. Every other plugin (AI, calculator,
-- recommender, videos, weather, quotes, photos, warranty, delivery,
-- invoices) attaches via job_id foreign key.

-- ─── 1. Job templates (data-driven job_type registry) ─────────────
create table if not exists hammerex_job_templates (
  slug                          text primary key,               -- concrete, decking, roofing, ...
  display_name                  text not null,
  description                   text,
  trade_slug                    text references hammerex_knowledge_trades(slug) on delete set null,
  icon_slug                     text,
  presets_json                  jsonb not null default '[]',    -- 12 preset job subtypes with default dims/qualifiers
  qualifiers_json               jsonb not null default '[]',    -- questions to ask (5-6 per template)
  calculator_ref                text,                           -- e.g. 'concrete' → src/lib/jobCalculators/concrete.ts
  default_plugin_slugs          text[] not null default '{}',   -- which plugins auto-attach
  default_merchant_categories   text[] not null default '{}',   -- recommender seeds
  default_trade_categories      text[] not null default '{}',
  requires_structural_engineer  boolean not null default false, -- forces specialist for load-bearing
  sort_order                    int not null default 0,
  created_at                    timestamptz not null default now()
);

comment on table hammerex_job_templates is 'One row per job_type. Adding a trade = insert here + KB pack + calculator function.';

-- ─── 2. Jobs (the central primitive) ──────────────────────────────
create table if not exists hammerex_jobs (
  id                       uuid primary key default gen_random_uuid(),
  parent_job_id            uuid references hammerex_jobs(id) on delete set null,  -- sub-jobs (Kitchen inside House Reno)
  job_type_slug            text not null references hammerex_job_templates(slug) on delete restrict,
  preset_slug              text,                                                  -- 'driveway', 'patio', etc
  title                    text not null,                                         -- 'Smith Driveway'
  country_code             text not null default 'GB',                            -- ISO 3166-1 alpha-2
  region_slug              text,                                                  -- 'ENG', 'SCT', 'WLS', 'NIR'
  postcode                 text,
  site_json                jsonb not null default '{}',                           -- {address, coords, access, notes}
  dimensions_json          jsonb not null default '{}',                           -- {length, width, thickness, unit}
  qualifiers_json          jsonb not null default '{}',                           -- answers to template qualifiers
  calculated_json          jsonb not null default '{}',                           -- materials, cost, spec — from calculator
  ai_report_json           jsonb,                                                 -- structured AI-generated report
  budget_pence             bigint,
  spent_pence              bigint not null default 0,
  status                   text not null default 'planning' check (status in (
    'planning','quoted','scheduled','in_progress','on_hold','complete','abandoned'
  )),
  difficulty               text check (difficulty in ('beginner','intermediate','advanced','specialist')),
  diy_friendly             boolean,
  building_control_required boolean,
  estimated_duration_hours numeric(6,1),
  linked_video_ids         uuid[] not null default '{}',
  cited_kb_entry_ids       uuid[] not null default '{}',
  share_token              text unique,                                           -- for /job/[token] public view
  fork_of_job_id           uuid references hammerex_jobs(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  completed_at             timestamptz,
  abandoned_at             timestamptz
);
create index if not exists idx_jobs_parent      on hammerex_jobs(parent_job_id);
create index if not exists idx_jobs_type        on hammerex_jobs(job_type_slug);
create index if not exists idx_jobs_status      on hammerex_jobs(status);
create index if not exists idx_jobs_share_token on hammerex_jobs(share_token) where share_token is not null;
create index if not exists idx_jobs_country     on hammerex_jobs(country_code);

-- ─── 3. Job actors (who has access + role) ────────────────────────
-- The unlock. ONE Job, many actors. Same record, different dashboards.
create table if not exists hammerex_job_actors (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references hammerex_jobs(id) on delete cascade,
  actor_kind     text not null check (actor_kind in ('homeowner','trade','merchant','driver','admin','anonymous')),
  actor_id       text,                                                            -- homeowner uuid, trade slug, merchant slug, driver id
  role           text not null check (role in (
    'owner','client','main_contractor','subcontractor','supplier','driver','viewer','quoting'
  )),
  permissions    text[] not null default '{}',                                    -- view_budget, edit_materials, add_quote, mark_delivered, ...
  invited_by     text,                                                            -- actor_id who added them
  invited_at     timestamptz not null default now(),
  accepted_at    timestamptz,
  removed_at     timestamptz,
  unique (job_id, actor_kind, actor_id, role)
);
create index if not exists idx_job_actors_job        on hammerex_job_actors(job_id);
create index if not exists idx_job_actors_actor      on hammerex_job_actors(actor_kind, actor_id);
create index if not exists idx_job_actors_role       on hammerex_job_actors(role);
create index if not exists idx_job_actors_active     on hammerex_job_actors(job_id) where removed_at is null;

-- ─── 4. Job events (the timeline / event stream) ──────────────────
create table if not exists hammerex_job_events (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references hammerex_jobs(id) on delete cascade,
  event_kind          text not null check (event_kind in (
    'created','updated','dimensions_set','materials_calculated','ai_report_generated',
    'quote_requested','quote_received','quote_accepted','trade_engaged',
    'material_ordered','delivery_scheduled','delivery_completed',
    'photo_uploaded','note_added','message_sent',
    'milestone_completed','health_changed','journal_generated',
    'weather_alert','warranty_registered','shared','forked','completed','abandoned'
  )),
  actor_kind          text,
  actor_id            text,
  metadata_json       jsonb not null default '{}',
  renderable_summary  text,                                                       -- AI-written prose for the timeline UI
  created_at          timestamptz not null default now()
);
create index if not exists idx_job_events_job on hammerex_job_events(job_id, created_at desc);
create index if not exists idx_job_events_kind on hammerex_job_events(event_kind);

-- ─── 5. Job memory (per-job AI brain via pgvector) ────────────────
-- Everything the AI needs to know ABOUT THIS JOB. Photos captioned by
-- vision, messages, quotes, invoices, calculations, notes — all
-- embedded and scoped by job_id. Ask AI on Job 237 retrieves from
-- Job 237's memory + global KB.
create table if not exists hammerex_job_memory (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references hammerex_jobs(id) on delete cascade,
  source_kind   text not null check (source_kind in (
    'message','photo','quote','invoice','calc','note','delivery','kb-snapshot','event-summary'
  )),
  source_ref    text,                                                             -- id of the source row (photo id, quote id, etc)
  content_text  text not null,
  embedding     vector(1536),
  created_at    timestamptz not null default now()
);
create index if not exists idx_job_memory_job on hammerex_job_memory(job_id);
create index if not exists idx_job_memory_embedding on hammerex_job_memory using hnsw (embedding vector_cosine_ops) where embedding is not null;

-- ─── 6. Job health (derived live state) ───────────────────────────
-- Rewritten on every event by the health aggregator. Plugins
-- contribute signals; aggregator computes level + next actions.
create table if not exists hammerex_job_health (
  job_id            uuid primary key references hammerex_jobs(id) on delete cascade,
  level             text not null default 'green' check (level in ('green','amber','red')),
  score             numeric(4,2) not null default 100.00,
  signals_json      jsonb not null default '{}',                                  -- {weather_ok: true, materials_ordered: false, ...}
  next_actions      text[] not null default '{}',
  summary           text,
  updated_at        timestamptz not null default now()
);

-- ─── 7. Job shares (public tokens for quote requests etc) ─────────
create table if not exists hammerex_job_shares (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references hammerex_jobs(id) on delete cascade,
  share_token       text not null unique,
  purpose           text not null check (purpose in ('quote','portfolio','warranty','delivery','handoff')),
  created_by        text,
  expires_at        timestamptz,
  view_count        int not null default 0,
  last_viewed_at    timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_job_shares_job on hammerex_job_shares(job_id);

-- ─── 8. Job journal (AI-written site notes) ───────────────────────
create table if not exists hammerex_job_journal (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references hammerex_jobs(id) on delete cascade,
  entry_date        date not null,
  summary_markdown  text not null,
  generated_by      text not null default 'ai' check (generated_by in ('ai','human')),
  created_at        timestamptz not null default now(),
  unique (job_id, entry_date, generated_by)
);
create index if not exists idx_job_journal_job on hammerex_job_journal(job_id, entry_date desc);

-- ─── Housekeeping ─────────────────────────────────────────────────

-- updated_at trigger on jobs
create or replace function jobs_touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists jobs_touch_trg on hammerex_jobs;
create trigger jobs_touch_trg
  before update on hammerex_jobs
  for each row execute function jobs_touch_updated_at();

-- Auto-generate share_token on job insert if not provided
create or replace function jobs_default_share_token()
returns trigger as $$
begin
  if new.share_token is null then
    new.share_token := encode(gen_random_bytes(12), 'hex');
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists jobs_share_token_trg on hammerex_jobs;
create trigger jobs_share_token_trg
  before insert on hammerex_jobs
  for each row execute function jobs_default_share_token();
