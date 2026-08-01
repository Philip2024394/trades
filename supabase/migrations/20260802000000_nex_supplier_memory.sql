-- ============================================================================
-- NEX Supplier Communication Memory · Phase 1 Schema
--
--   "Nex should not only connect customers with suppliers. Nex should learn
--    which suppliers are suitable for which projects."
--     — Philip O'Farrell · 2026-08-02
--
-- ----------------------------------------------------------------------------
-- Priority · Business Brain intelligence layer (Opportunity 2). Follows the
-- Supplier Preparation Workflow v1 (in-memory today) + Visual Brain → Supplier
-- Bridge v1 (shipped 2026-08-02). Moves supplier interaction from in-memory
-- Maps to persistent evidence so the matching layer can learn over time.
--
-- Three governance decisions from Philip 2026-08-02 encoded at the schema level:
--   1. PII masking · brief_record is stored PII-masked (email/phone stripped
--      before insert · conversation_id is the only linkage back to the customer)
--   2. Trust-first · source_of_signal is REQUIRED on every response · only
--      real recorded events can influence matching · AI assumption / model
--      inference / guessed supplier quality is explicitly disallowed
--   3. Human confirmation remains final · workflow prepares the brief · admin
--      records the response · nothing auto-submits, nothing auto-invented
--
-- NOT YET APPLIED. This file is a reviewable artefact. Run only after Philip
-- has reviewed the schema shape and confirmed the three decisions are correctly
-- encoded.
-- ============================================================================

-- ─── 1. nex_suppliers ────────────────────────────────────────────────
-- Canonical supplier registry · migrated from data/nex-suppliers.json.
-- JSON retained as read-only fallback for one release cycle per Philip.
create table if not exists nex_suppliers (
  supplier_id       text primary key,                     -- NEX-SUPPLIER-000001
  name              text not null,
  trade             text[] not null default '{}',          -- ["staircase_manufacturer",…]
  countries         text[] not null default '{}',          -- ["UK","IE"]
  capabilities      text[] not null default '{}',          -- ["oak","glass_balustrade",…]
  handoff_message   text,
  notes             text,                                   -- internal only · never surfaced to customer
  active            boolean not null default false,
  verified          boolean not null default false,         -- unverified never surfaces in customer handoff (Step 5 trust rule)
  priority          text not null default 'listed'
    check (priority in ('primary','partner','listed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists nex_suppliers_active_verified_idx
  on nex_suppliers (active, verified) where active = true and verified = true;

create index if not exists nex_suppliers_countries_gin
  on nex_suppliers using gin (countries);

create index if not exists nex_suppliers_capabilities_gin
  on nex_suppliers using gin (capabilities);

-- ─── 2. nex_supplier_enquiries ───────────────────────────────────────
-- One row per brief the workflow assembles. brief_record is PII-masked
-- BEFORE insertion (see src/lib/nex/business-brain/pii-mask.ts). Never
-- store customer email · phone · full postcode inside brief_record.
create table if not exists nex_supplier_enquiries (
  enquiry_id             text primary key,                    -- NEX-ENQUIRY-<opaque>
  conversation_id        text not null,
  customer_country       text,                                 -- from Regional Layer
  brief_record           jsonb not null,                       -- PII-masked payload
  design_references      jsonb,                                -- from Visual Brain Bridge v1
  matched_supplier_ids   text[] not null default '{}',
  status                 text not null default 'prepared'
    check (status in ('prepared','delivered','responded','closed','cancelled')),
  prepared_at            timestamptz not null default now(),
  delivered_at           timestamptz,                          -- admin marks when brief sent to supplier
  responded_at           timestamptz,                          -- earliest response recorded
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists nex_supplier_enquiries_status_idx
  on nex_supplier_enquiries (status, prepared_at desc);

create index if not exists nex_supplier_enquiries_conversation_idx
  on nex_supplier_enquiries (conversation_id);

create index if not exists nex_supplier_enquiries_country_idx
  on nex_supplier_enquiries (customer_country) where customer_country is not null;

-- ─── 3. nex_supplier_responses ───────────────────────────────────────
-- One row per admin-recorded supplier response. source_of_signal is
-- REQUIRED and constrained · Philip 2026-08-02 rule: only real recorded
-- events can influence matching. AI inference / model guess / assumption
-- MUST NEVER write to this table.
create table if not exists nex_supplier_responses (
  response_id           uuid primary key default gen_random_uuid(),
  enquiry_id            text not null references nex_supplier_enquiries(enquiry_id) on delete cascade,
  supplier_id           text not null references nex_suppliers(supplier_id) on delete restrict,
  response_type         text not null
    check (response_type in ('accepted','declined','quoted','completed','no_response')),
  response_time_hours   numeric,                              -- from delivered_at to first response
  decline_reason        text,                                  -- optional free text (internal only)
  outcome               text
    check (outcome is null or outcome in ('quoted','booked','completed','cancelled')),
  admin_notes           text,                                  -- internal only · never surfaced
  training_data_valid   boolean not null default true,         -- admin override · exclude from metrics without deleting

  -- Trust provenance · Philip 2026-08-02
  -- REQUIRED · every response must declare where the signal came from.
  -- Only 'admin_recorded_response' and 'supplier_portal_response' are
  -- valid intelligence sources. AI inference or model guess is banned.
  source_of_signal      text not null default 'admin_recorded_response'
    check (source_of_signal in ('admin_recorded_response','supplier_portal_response','webhook_verified')),

  recorded_by           text not null default 'admin',         -- admin | supplier_portal | api
  recorded_at           timestamptz not null default now()
);

create index if not exists nex_supplier_responses_enquiry_idx
  on nex_supplier_responses (enquiry_id);

create index if not exists nex_supplier_responses_supplier_valid_idx
  on nex_supplier_responses (supplier_id, training_data_valid, recorded_at desc);

-- ─── 4. updated_at triggers ──────────────────────────────────────────
create or replace function nex_supplier_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists nex_suppliers_touch on nex_suppliers;
create trigger nex_suppliers_touch
  before update on nex_suppliers
  for each row execute function nex_supplier_touch_updated_at();

drop trigger if exists nex_supplier_enquiries_touch on nex_supplier_enquiries;
create trigger nex_supplier_enquiries_touch
  before update on nex_supplier_enquiries
  for each row execute function nex_supplier_touch_updated_at();

-- ─── 5. Row-level security ──────────────────────────────────────────
-- All tables locked to service role only. All admin access goes through
-- the /admin/(authed)/* session gate + supabaseAdmin client which
-- bypasses RLS with the service-role key. No public read access.
alter table nex_suppliers            enable row level security;
alter table nex_supplier_enquiries   enable row level security;
alter table nex_supplier_responses   enable row level security;

-- No policies added · service role bypasses RLS · anon/authenticated blocked by default.

-- ─── 6. Comments ────────────────────────────────────────────────────
comment on table nex_suppliers is
  'Canonical supplier registry (Philip 2026-08-02). Migrated from data/nex-suppliers.json which remains read-only fallback for one release cycle.';

comment on table nex_supplier_enquiries is
  'Every brief the Supplier Preparation Workflow assembles. brief_record is PII-masked before insert (see pii-mask.ts). Conversation_id is the only linkage back to the customer.';

comment on table nex_supplier_responses is
  'Admin-recorded supplier responses. source_of_signal is REQUIRED · only real recorded events can influence matching. AI inference / model guess / assumption MUST NEVER write here.';

comment on column nex_supplier_responses.source_of_signal is
  'Trust provenance (Philip 2026-08-02). Values: admin_recorded_response · supplier_portal_response · webhook_verified. AI/model inference is explicitly banned by the CHECK constraint.';

comment on column nex_supplier_responses.training_data_valid is
  'Admin override to exclude a response from performance metrics without deleting the row. Preserves the audit trail while filtering bad data from the matching signal.';
