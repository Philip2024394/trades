-- ═══════════════════════════════════════════════════════════════════
-- directory_seeds — canonical UK trade directory table
--
-- Migrated 2026-08-13 from file-based data/directory-seeds/**/*.json
-- (per Philip 2026-08-13 · Option B: Supabase before Batch 002 collection).
--
-- Preserves every existing listing_id + slug + all metadata. The JSON
-- files remain in-repo as archive/audit history — this table becomes the
-- live source of truth for /nex-app/refacing/companies + Collector saves.
--
-- Follows the codebase pattern (audited 2026-08-13):
--   · uuid PK · gen_random_uuid() default
--   · created_at / updated_at timestamptz · updated_at auto-touched by trigger
--   · text + CHECK (never Postgres enums)
--   · RLS enabled · no public policies · all access via service-role client
--     (@/lib/supabaseAdmin) since API guards with isAdminAuthed() at layer above
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.directory_seeds (
  -- Identity · preserved from JSON on import
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text NOT NULL UNIQUE,
  business_name          text NOT NULL,
  trading_name           text,
  category               text,
  primary_trade          text,
  tags                   text[] NOT NULL DEFAULT '{}',
  enrichment_status      text CHECK (enrichment_status IN ('stub','partial','verified')) DEFAULT 'stub',
  last_verified_at       timestamptz,

  -- Address
  address_line_1         text,
  address_line_2         text,
  town                   text,
  county                 text,
  postcode               text,
  country                text NOT NULL DEFAULT 'United Kingdom',

  -- Contact
  telephone              text,
  website                text,
  email                  text,

  -- Content
  opening_hours          jsonb,
  description            text,
  services               text[] NOT NULL DEFAULT '{}',

  -- Google
  google_rating          numeric(2,1) CHECK (google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5)),
  google_review_count    integer CHECK (google_review_count IS NULL OR google_review_count >= 0),
  google_maps_url        text,

  -- Geo
  latitude               numeric,
  longitude              numeric,

  -- Legacy governance flags (preserved from JSON schema · ADR-0023)
  status                 text NOT NULL DEFAULT 'listed' CHECK (status IN ('listed')),
  claimed                boolean NOT NULL DEFAULT false,
  verified               boolean NOT NULL DEFAULT false,
  visibility             text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public')),

  -- Assets (photos + cover MUST stay empty at seed time per ADR-0022)
  photos                 text[] NOT NULL DEFAULT '{}',
  cover_image            text,

  -- Provenance
  source                 text NOT NULL DEFAULT 'refacing_discovery'
                           CHECK (source IN ('google_business_manual_paste','philip_manual_seed','refacing_discovery')),
  imported_at            timestamptz NOT NULL DEFAULT now(),

  -- ── Refacing / Collector extensions (2026-08-13) ─────────────
  capabilities           jsonb NOT NULL DEFAULT '{}'::jsonb,
  refacing_evidence      jsonb NOT NULL DEFAULT '[]'::jsonb,
  refacing_qualification text CHECK (refacing_qualification IS NULL OR refacing_qualification IN ('A+','A','B','C','excluded')),
  email_source           text CHECK (email_source IS NULL OR email_source IN (
                             'company_website','contact_page','services_page','trade_directory',
                             'checkatrade','yell','trustpilot','google_business_profile','other')),
  email_verified         boolean NOT NULL DEFAULT false,
  email_checked_at       date,
  lifecycle_status       text NOT NULL DEFAULT 'unclaimed'
                           CHECK (lifecycle_status IN (
                             'unclaimed','contacted','interested','claim_requested',
                             'claim_pending','claimed','verified_partner')),
  directory_state        text NOT NULL DEFAULT 'listed'
                           CHECK (directory_state IN ('listed','verified','claimed','paid_member')),

  -- Tri-state email verification (Philip 2026-08-13):
  --   verified                     · 🟢 public business email confirmed
  --   needs_manual_verification    · 🟡 email appears to exist but couldn't be reliably extracted
  --   not_found                    · 🔴 no public business email located after search
  email_status           text CHECK (email_status IS NULL OR email_status IN (
                             'verified','needs_manual_verification','not_found')),

  -- Supabase-native metadata
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger: auto-touch updated_at on any UPDATE ───────────────
CREATE OR REPLACE FUNCTION public.directory_seeds_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_directory_seeds_touch_updated_at ON public.directory_seeds;
CREATE TRIGGER trg_directory_seeds_touch_updated_at
  BEFORE UPDATE ON public.directory_seeds
  FOR EACH ROW EXECUTE FUNCTION public.directory_seeds_touch_updated_at();

-- ── Indexes for feed + Collector + dashboard queries ───────────
CREATE INDEX IF NOT EXISTS ix_directory_seeds_category           ON public.directory_seeds(category);
CREATE INDEX IF NOT EXISTS ix_directory_seeds_directory_state    ON public.directory_seeds(directory_state);
CREATE INDEX IF NOT EXISTS ix_directory_seeds_lifecycle_status   ON public.directory_seeds(lifecycle_status);
CREATE INDEX IF NOT EXISTS ix_directory_seeds_qualification      ON public.directory_seeds(refacing_qualification);
CREATE INDEX IF NOT EXISTS ix_directory_seeds_town               ON public.directory_seeds(lower(town));
CREATE INDEX IF NOT EXISTS ix_directory_seeds_postcode           ON public.directory_seeds(upper(regexp_replace(postcode, '\s+', '', 'g')));
CREATE INDEX IF NOT EXISTS ix_directory_seeds_email_lower        ON public.directory_seeds(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_directory_seeds_email_status       ON public.directory_seeds(email_status);
CREATE INDEX IF NOT EXISTS ix_directory_seeds_source             ON public.directory_seeds(source);
CREATE INDEX IF NOT EXISTS ix_directory_seeds_imported_at        ON public.directory_seeds(imported_at DESC);

-- Partial unique on lower(email) prevents accidental duplicate email at DB level
-- (allows many nulls, blocks two seeds with same email string).
CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_seeds_email_lower
  ON public.directory_seeds(lower(email)) WHERE email IS NOT NULL;

-- ── RLS: enable · no public policies · service-role only ────────
-- Access happens exclusively via @/lib/supabaseAdmin from Node API routes.
-- Public read policy deliberately absent — the public feed route calls
-- supabaseAdmin (bypasses RLS) after its own auth/filter logic runs.
ALTER TABLE public.directory_seeds ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.directory_seeds IS
  'UK trade directory · one canonical company record per business. Preserves listing_id across directory → claim → merchant → membership → Trade Exchange. Reference: memory project_nex_refacing_trade_exchange_directory_state_2026_08_13.md + project_nex_collector_architecture_2026_08_13.md.';

COMMENT ON COLUMN public.directory_seeds.directory_state IS
  '4-state Refacing Exchange progression · forward-only. Only paid_member + qualification in (A+,A) is routing-eligible.';

COMMENT ON COLUMN public.directory_seeds.email_status IS
  'Tri-state email verification (Philip 2026-08-13): verified=🟢 · needs_manual_verification=🟡 (visible on site but fetch masked it) · not_found=🔴. Never guessed.';
