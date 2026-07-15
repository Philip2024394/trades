-- Networkers support ticket system + content moderation flags.
--
-- Single ticket table for every user-facing report path — DMCA
-- takedown, IP infringement, content report (CSAM / sexual /
-- defamation), privacy request, account/billing question,
-- general enquiry. One admin queue, one SLA policy, one storage
-- bucket for attachments.
--
-- Everything routes here: /support/ticket, /legal/takedown,
-- Flag button on Site Interest cards + canteen posts + images.
--
-- Rationale (Philip 2026-07-16): rock-solid defence against IP
-- claims (Higbee/PicRights/Getty), Stripe payment freezes,
-- Vercel/Supabase DMCA takedowns, and CSAM safeguarding
-- obligations under UK Online Safety Act 2023 + US 18 USC 2258A.

create table if not exists public.networkers_support_tickets (
  id                    uuid        primary key default gen_random_uuid(),
  -- Categorisation
  kind                  text        not null
                        check (kind in (
                          'dmca_takedown', 'ip_infringement',
                          'content_report', 'csam_report',
                          'sexual_content', 'defamation',
                          'privacy_request', 'account', 'billing',
                          'general'
                        )),
  severity              text        not null default 'normal'
                        check (severity in ('urgent', 'high', 'normal', 'low')),
  status                text        not null default 'open'
                        check (status in (
                          'open', 'reviewing', 'action_required',
                          'resolved', 'closed', 'spam'
                        )),
  -- Reporter identity (required — even anonymous reports need
  -- a contact email for follow-up + fraud attribution).
  reporter_name         text        not null,
  reporter_email        text        not null,
  reporter_phone        text,
  -- If reporter was signed in, capture their merchant slug.
  reporter_slug         text,
  reporter_ip           inet,
  reporter_user_agent   text,
  -- The report itself
  subject               text        not null,
  description           text        not null,
  -- What's being reported (may be null for general enquiries).
  target_kind           text
                        check (target_kind is null or target_kind in (
                          'canteen_post', 'image', 'canteen', 'trade',
                          'submission', 'product', 'quote_request', 'other'
                        )),
  target_id             text,   -- uuid string or slug
  target_url            text,   -- link to what's being reported
  -- DMCA / IP-specific fields
  claimed_ownership     text,   -- who owns the copyright
  sworn_statement       boolean not null default false,   -- "under penalty of perjury"
  -- Attachments (screenshots, proof of ownership, etc.)
  attachment_urls       text[]  not null default '{}'::text[],
  -- Moderation
  moderator_slug        text,
  moderator_note        text,
  resolution            text,
  resolved_at           timestamptz,
  sla_deadline_at       timestamptz not null,
  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Admin queue lookup — open + high-priority first, then by SLA
-- deadline so overdue tickets rise to the top.
create index if not exists networkers_support_tickets_admin_queue
  on public.networkers_support_tickets (status, severity, sla_deadline_at)
  where status in ('open', 'reviewing', 'action_required');

-- Fast lookup by target — "show me every ticket about this canteen"
create index if not exists networkers_support_tickets_target
  on public.networkers_support_tickets (target_kind, target_id)
  where target_id is not null;

-- Rate-limit lookup — how many tickets has this IP filed in the
-- last hour? Blocks form-flood spam.
create index if not exists networkers_support_tickets_rate_ip
  on public.networkers_support_tickets (reporter_ip, created_at desc);

-- Auto-touch updated_at
create or replace function public.networkers_support_tickets_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_networkers_support_tickets_touch on public.networkers_support_tickets;
create trigger trg_networkers_support_tickets_touch
  before update on public.networkers_support_tickets
  for each row execute function public.networkers_support_tickets_touch();

-- Moderation-hidden flags on user-content tables that Flag button
-- can auto-hide. Adds a nullable timestamp so admin can restore.
alter table if exists public.hammerex_canteen_posts
  add column if not exists moderation_hidden_at timestamptz,
  add column if not exists moderation_hidden_reason text;

alter table if exists public.networkers_image_submissions
  add column if not exists moderation_hidden_at timestamptz,
  add column if not exists moderation_hidden_reason text;

-- Storage bucket for attachments — public read (URLs shared with
-- reporter/admin), service_role writes only via /api/support/tickets.
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', true)
on conflict (id) do nothing;
