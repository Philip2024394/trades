-- Studio Assembly Decisions — the merchant's audit trail of "here's
-- what the platform proposed, here's what I accepted".
--
-- The Assembly Rule Runtime resolves plans on the server; when a
-- merchant installs a module the API previews the plan and the merchant
-- accepts/dismisses each proposal. We persist the decision so:
--   1. Actions can be fired idempotently (re-install won't re-propose
--      the same accepted proposal).
--   2. Future audit / "undo my install" surfaces have a source of truth.
--   3. The AI Brain can retrieve "the merchant already dismissed the
--      'add-nav-item' from job-diary — don't re-propose".
--
-- One row per (brand, proposal_id). proposal_id is the stable
-- `<moduleId>::<ruleId>` string emitted by the resolver, so schema stays
-- inert when new rules are added or renamed.
--
-- RLS off — matches the rest of the studio_* namespace. All writes go
-- through supabaseAdmin from server routes with session-checked bearer.

create table if not exists public.studio_assembly_decisions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  brand_id uuid not null references public.studio_brands(id) on delete cascade,

  -- Stable proposal identity from the resolver.
  proposal_id text not null,
  module_id text not null,
  rule_id text not null,

  -- What the merchant chose.
  decision text not null check (decision in ('accepted', 'dismissed')),

  -- Cache of the action + rationale AS SHOWN to the merchant at
  -- decision time. Rules can be renamed later; keeping a snapshot means
  -- the audit trail stays honest.
  action_json jsonb not null,
  rationale_snapshot text not null,

  decided_at timestamptz not null default now(),
  decided_by text,

  -- Applied — action actually executed. Split from `decision` because
  -- some actions (wire-to, suggest-module) need a separate resolver +
  -- may fail after acceptance.
  applied_at timestamptz,
  apply_error text,

  unique (brand_id, proposal_id)
);

create index if not exists studio_assembly_decisions_brand_idx
  on public.studio_assembly_decisions (brand_id);

create index if not exists studio_assembly_decisions_module_idx
  on public.studio_assembly_decisions (brand_id, module_id);

create index if not exists studio_assembly_decisions_pending_apply_idx
  on public.studio_assembly_decisions (brand_id, applied_at)
  where decision = 'accepted' and applied_at is null;
