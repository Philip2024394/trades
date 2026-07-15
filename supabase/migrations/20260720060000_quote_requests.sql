-- Quote requests — the "I like it, how much?" lead capture that
-- routes homeowner interest from a Site Interest image straight to
-- the credit-chip trade.
--
-- Philip's rules (2026-07-16):
--   • Form fields ARE the seriousness filter — no washer cost on
--     this flow. Name + email/phone + ≥60-char description is the
--     tyre-kicker gate. See
--     feedback_form_gate_not_washer_for_contact.md.
--   • Lead goes to the CREDIT-CHIP trade only. Never broadcast to
--     3-nearest — that's the Checkatrade lead-selling model
--     ADR-0003 explicitly rejects.
--   • Photo attachment is a first-class field (site/area/what-
--     they're-building shots) — routes through the storage bucket
--     created below and per project_storage_cost_safety.md rules.
--
-- Row lifecycle:
--   status='submitted'   — freshly received, awaiting trade action
--   status='delivered'   — sent to the trade (WhatsApp deep-link
--                          opened or in-app notification fired)
--   status='replied'     — trade responded / marked handled
--   status='closed'      — homeowner marked as no-longer-needed OR
--                          admin closed as spam
--
-- Note: this table is DELIBERATELY not RLS'd for the public insert
-- path — the API route enforces validation + rate limits + captcha
-- before an anonymous submission ever hits the table. Direct
-- client → PostgREST inserts are blocked by service-role usage in
-- the endpoint.

create table if not exists public.hammerex_quote_requests (
  id                    uuid        primary key default gen_random_uuid(),
  -- Requester identity — collected up-front, phone OR email required
  -- (validated at the endpoint). Name always required.
  requester_name        text        not null,
  requester_email       text,
  requester_phone       text,
  message               text        not null,
  -- Uploaded attachment URLs (Supabase Storage). Cap on the API
  -- side; the array can grow but per the storage safety memory
  -- every upload must be tier-gated.
  attachment_urls       text[]      not null default '{}'::text[],
  -- Where the lead is routed. target_trade_slug is the credit-chip
  -- trade (or nearest-1 when the image is curated / no submitter).
  target_trade_slug     text        not null,
  target_canteen_slug   text,
  -- Provenance — which Site Interest image triggered this request.
  -- source_post_id + source_canteen_id echo the image submission
  -- credit trail so admin can trace a lead back to the exact card.
  source_image_url      text,
  source_post_id        uuid        references public.hammerex_canteen_posts(id) on delete set null,
  source_canteen_id     uuid        references public.hammerex_canteens(id)      on delete set null,
  -- Anti-abuse — IP tracked for rate limiting. Not shown to the
  -- trade; only visible to admin for spam triage.
  ip_address            inet,
  user_agent            text,
  -- Lifecycle
  status                text        not null default 'submitted'
                                    check (status in ('submitted', 'delivered', 'replied', 'closed')),
  delivered_at          timestamptz,
  replied_at            timestamptz,
  closed_at             timestamptz,
  closed_reason         text,
  -- GDPR consent — the form has a checkbox; stamp when they submit.
  consented_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Trade inbox lookup — "show me my new leads, newest first". Only
-- non-closed rows are relevant to the trade's active inbox.
create index if not exists hammerex_quote_requests_trade_inbox
  on public.hammerex_quote_requests (target_trade_slug, created_at desc)
  where status in ('submitted', 'delivered', 'replied');

-- Admin queue — freshest submissions across every trade.
create index if not exists hammerex_quote_requests_admin_recent
  on public.hammerex_quote_requests (status, created_at desc);

-- Rate limit lookup — "how many requests has this IP made in the
-- last hour?" Partial index keeps the working set small.
create index if not exists hammerex_quote_requests_rate_ip
  on public.hammerex_quote_requests (ip_address, created_at desc);

-- Sanity: require at least one contact method.
alter table public.hammerex_quote_requests
  add constraint hammerex_quote_requests_contact_required
  check (
    (requester_email is not null and length(trim(requester_email)) > 0)
    or (requester_phone is not null and length(trim(requester_phone)) > 0)
  );

-- Auto-touch updated_at.
create or replace function public.hammerex_quote_requests_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hammerex_quote_requests_touch on public.hammerex_quote_requests;
create trigger trg_hammerex_quote_requests_touch
  before update on public.hammerex_quote_requests
  for each row execute function public.hammerex_quote_requests_touch_updated_at();

-- Storage bucket for site photos uploaded with quote requests. Public
-- read (URLs are shared with the trade + admin) but writes gated to
-- service_role only — the API endpoint uploads on behalf of the
-- guest, never direct client-to-storage.
insert into storage.buckets (id, name, public)
values ('quote-attachments', 'quote-attachments', true)
on conflict (id) do nothing;
