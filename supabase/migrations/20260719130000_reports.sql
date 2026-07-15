-- Content reports + user bug reports. Both feed the /admin/red-zone
-- queue. Kept in one migration because they share the same shape
-- (open → resolved workflow with admin notes) and neither has any
-- dependency on the washer tables from 20260719120000_washers.sql.

-- ─── Content reports (harmful / misleading / under-18 escalation) ─
create table if not exists public.hammerex_content_reports (
  id                uuid        primary key default gen_random_uuid(),
  content_type      text        not null
                    check (content_type in ('canteen-post', 'yard-post', 'trade-center-listing', 'canteen-reply', 'other')),
  content_id        text,
  merchant_slug     text,
  reporter_name     text,
  reporter_email    text,
  reporter_ip       text,
  reason            text        not null,
  reported_body     text,
  status            text        not null default 'pending'
                    check (status in ('pending', 'reviewed', 'removed', 'dismissed')),
  severity          text        not null default 'medium'
                    check (severity in ('critical', 'high', 'medium', 'low')),
  admin_note        text,
  resolved_by       text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_hammerex_content_reports_status
  on public.hammerex_content_reports(status, created_at desc);
create index if not exists idx_hammerex_content_reports_content
  on public.hammerex_content_reports(content_type, content_id);

comment on table public.hammerex_content_reports is
  'Public content reports (harmful, misleading, under-18 escalations, IP infringement). Feeds /admin/red-zone content category.';

-- ─── Bug reports (broken links + bugs + feature requests) ────────
create table if not exists public.hammerex_bug_reports (
  id                uuid        primary key default gen_random_uuid(),
  kind              text        not null default 'bug'
                    check (kind in ('bug', 'broken-link', 'feature-request')),
  body              text        not null,
  page_url          text,
  reporter_email    text,
  reporter_ip       text,
  user_agent        text,
  status            text        not null default 'open'
                    check (status in ('open', 'investigating', 'resolved', 'wont-fix', 'duplicate')),
  severity          text        not null default 'medium'
                    check (severity in ('critical', 'high', 'medium', 'low')),
  admin_note        text,
  resolved_by       text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_hammerex_bug_reports_status
  on public.hammerex_bug_reports(status, created_at desc);

comment on table public.hammerex_bug_reports is
  'User-submitted bugs, broken links, feature requests. Feeds /admin/red-zone user category.';

-- ─── RLS: locked to service role, same as washer tables ──────────
alter table public.hammerex_content_reports enable row level security;
alter table public.hammerex_bug_reports     enable row level security;
