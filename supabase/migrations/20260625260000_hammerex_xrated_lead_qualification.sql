-- Xrated Trades — lead-qualification fields on the contact-form payload.
--
-- These columns filter time-wasters so tradies can triage incoming leads
-- on the admin dashboard instead of wading through every speculative
-- enquiry. All nullable so the bare-minimum (name/email/message) path
-- still works.
--
--   postcode         — UK postcode of the job site (validated client-side)
--   project_type     — "new_build" | "renovation" | "repair"
--   project_stage    — "ready_to_book" | "comparing_quotes" | "just_researching"
--   earliest_start   — free-text bucket label or ISO date the customer can
--                      start (e.g. "asap", "within_1_month", "2026-08-15")
--   photo_urls       — array of Supabase Storage public URLs the customer
--                      attached at lead-time
alter table public.hammerex_trade_off_messages
  add column if not exists postcode text,
  add column if not exists project_type text,
  add column if not exists project_stage text,
  add column if not exists earliest_start text,
  add column if not exists photo_urls text[] default '{}'::text[];

alter table public.hammerex_trade_off_messages
  drop constraint if exists messages_project_type_chk;
alter table public.hammerex_trade_off_messages
  add constraint messages_project_type_chk
    check (project_type is null or project_type in ('new_build','renovation','repair'));

alter table public.hammerex_trade_off_messages
  drop constraint if exists messages_project_stage_chk;
alter table public.hammerex_trade_off_messages
  add constraint messages_project_stage_chk
    check (project_stage is null or project_stage in ('ready_to_book','comparing_quotes','just_researching'));
