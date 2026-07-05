-- Strategy-aware form submissions.
-- ADR-017. B5 · Forms Framework.

create table if not exists studio_form_submissions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references studio_brands(id) on delete cascade,
  form_slug text not null,
  purpose text not null,
  values jsonb not null default '{}'::jsonb,
  strategy_snapshot jsonb,        -- provenance for audit
  submitted_at timestamptz not null default now(),
  followup_status text default 'pending', -- pending | dispatched | completed | error
  ip_hash text
);

create index if not exists idx_studio_form_submissions_brand
  on studio_form_submissions (brand_id, submitted_at desc);

create index if not exists idx_studio_form_submissions_slug
  on studio_form_submissions (form_slug, submitted_at desc);

alter table studio_form_submissions enable row level security;
