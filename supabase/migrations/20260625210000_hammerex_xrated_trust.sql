-- Xrated Trades — "Trust & logistics" fields.
-- Adds the trust signals, logistics flags, quote-process descriptors and
-- current-business-status columns surfaced on the premium profile page
-- and editable from the Premium Customisation Panel.
--
-- All columns are nullable / safe-defaulted so existing rows continue to
-- render. The booleans are the only NOT NULL columns and default to
-- FALSE so an unconfigured tradie defaults to "Not confirmed" on the
-- public page (handled in the renderer).

alter table public.hammerex_trade_off_listings
  -- Trust signals
  add column if not exists is_insured boolean not null default false,
  add column if not exists insurance_cover_gbp integer,
  add column if not exists qualifications text[] not null default '{}',
  add column if not exists trade_memberships text[] not null default '{}',
  add column if not exists dbs_checked boolean not null default false,
  -- Logistics
  add column if not exists has_own_transport boolean not null default false,
  add column if not exists has_own_tools boolean not null default false,
  add column if not exists minimum_job_gbp integer,
  -- Quote process
  add column if not exists free_site_visits boolean not null default false,
  add column if not exists quote_availability text,
  add column if not exists quote_turnaround_hours integer,
  -- Current state of business
  add column if not exists current_status_note text,
  add column if not exists ready_date date;
