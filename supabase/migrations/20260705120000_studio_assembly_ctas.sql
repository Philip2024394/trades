-- Studio Assembly CTAs — assembly-driven call-to-action overrides.
--
-- The assembly executor writes one row here per `add-cta` proposal the
-- merchant accepted. Blueprint / hero renderers query this table via
-- getAssemblyCta(brandId, slotId) and override their own default CTA
-- when a winning row exists.
--
-- Design:
--   • Keyed by (brand_id, source_proposal_id) unique — the executor is
--     idempotent per proposal.
--   • Multiple rows can target the same slot (each from a different
--     module); consumers pick the highest-priority non-hidden one at
--     read time. Priority ties broken by source_proposal_id ASC.
--   • slot_id examples: "home.primary-cta", "home.secondary-cta". The
--     assembly resolver has already run its conflict-detection so the
--     rows written here are the merchant's chosen intent — but keeping
--     the read-side tiebreak means concurrent multi-install still
--     produces deterministic output.
--   • hidden_at is the merchant's soft-hide.
--
-- RLS off — matches the studio_* convention. Writes go through
-- supabaseAdmin from the assembly executor.

create table if not exists public.studio_assembly_ctas (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.hammerex_trade_off_listings(id) on delete cascade,
  brand_id uuid not null references public.studio_brands(id) on delete cascade,

  slot_id text not null,
  label text not null,
  href text not null,
  priority integer not null default 0,

  source_module_id text not null,
  source_proposal_id text not null,
  rationale_snapshot text not null,

  inserted_at timestamptz not null default now(),
  hidden_at timestamptz,

  unique (brand_id, source_proposal_id)
);

create index if not exists studio_assembly_ctas_brand_slot_idx
  on public.studio_assembly_ctas (brand_id, slot_id, priority desc)
  where hidden_at is null;

create index if not exists studio_assembly_ctas_module_idx
  on public.studio_assembly_ctas (brand_id, source_module_id);
