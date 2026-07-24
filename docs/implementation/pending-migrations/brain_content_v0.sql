-- Pending migration · Trade Brain Author Tooling · Structured content storage
-- Depends on: ADR-0017 (Trade Brain Contract) · ADR-0021 (Domain Separation)
-- Status: PREPARED · not yet in supabase/migrations/ · awaiting ADR-0017 acceptance
-- Notes: Authors edit via authors.thenetworkers.app · weekly cron exports to JSON packs in git · per Trade Brain Author Tooling Spec.

BEGIN;

-- ─── Brain metadata ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brains (
  slug                  TEXT PRIMARY KEY,     -- 'electrician' · 'plumber' · 'staircase' · etc.
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN ('trade', 'business')),
  version               TEXT NOT NULL DEFAULT '0.0.1',    -- Semver
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'in_review', 'published', 'archived')),

  primary_author_id     UUID REFERENCES auth.users(id),
  primary_author_name   TEXT,                 -- Public attribution (e.g. "David Watkins")
  primary_author_creds  TEXT,                 -- "NICEIC · 18th Edition · 22 years"

  supported_countries   TEXT[] NOT NULL DEFAULT ARRAY['UK'],
  supported_regions     TEXT[],               -- Optional finer scoping

  published_at          TIMESTAMPTZ,
  last_reviewed_at      TIMESTAMPTZ,
  next_review_due_at    TIMESTAMPTZ,          -- Quarterly review cadence

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brains_status
  ON public.hammerex_nex_brains (status)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_brains_author
  ON public.hammerex_nex_brains (primary_author_id);

-- ─── Brain content per module ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_content (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug) ON DELETE CASCADE,
  module                TEXT NOT NULL
                          CHECK (module IN (
                            -- V1 required modules per ADR-0017 §1
                            'craft',
                            'regulations',
                            'materials',
                            'workflow',
                            'defects',
                            'pricing_model',
                            -- V2 deferred modules
                            'tools',
                            'business_tone',
                            'sub_specialisations',
                            'regional_variants'
                          )),

  section_id            TEXT NOT NULL,        -- Author-defined stable ID within module
  country_iso           TEXT,                 -- For country-scoped content (regulations · pricing)

  content               JSONB NOT NULL,       -- Module-specific structured content

  -- Evidence + attribution per section
  evidence              JSONB,                -- {source_urls: [], expert_claim: "..."}
  confidence            TEXT NOT NULL DEFAULT 'medium'
                          CHECK (confidence IN ('low', 'medium', 'high')),

  authored_by           UUID REFERENCES auth.users(id),
  authored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Version tracking
  version               INTEGER NOT NULL DEFAULT 1,
  is_current            BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes            UUID REFERENCES public.hammerex_nex_brain_content(id),

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brain_slug, module, section_id, country_iso, version)
);

CREATE INDEX IF NOT EXISTS idx_brain_content_scoped
  ON public.hammerex_nex_brain_content (brain_slug, module, is_current)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_brain_content_country
  ON public.hammerex_nex_brain_content (brain_slug, module, country_iso, is_current)
  WHERE is_current = TRUE AND country_iso IS NOT NULL;

-- ─── Merchant corrections chain ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_corrections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  brain_content_id      UUID REFERENCES public.hammerex_nex_brain_content(id),

  merchant_slug         TEXT NOT NULL,
  corrected_by          UUID REFERENCES auth.users(id),

  original_value        JSONB,
  proposed_value        JSONB NOT NULL,
  reason                TEXT,

  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'rejected', 'deferred')),
  author_notes          TEXT,
  reviewed_by           UUID REFERENCES auth.users(id),
  reviewed_at           TIMESTAMPTZ,

  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_corrections_pending
  ON public.hammerex_nex_brain_corrections (brain_slug, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_brain_corrections_merchant
  ON public.hammerex_nex_brain_corrections (merchant_slug, submitted_at DESC);

-- ─── Brain versions history ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  version               TEXT NOT NULL,
  changelog             TEXT,
  change_kind           TEXT NOT NULL DEFAULT 'author_edit'
                          CHECK (change_kind IN ('author_edit', 'correction_accepted', 'learning_loop', 'regulation_update')),
  approved_by           UUID REFERENCES auth.users(id),
  approved_at           TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  UNIQUE (brain_slug, version)
);

-- ─── Field Learning Loop · Prediction vs Actual outcomes ────────
-- Per ADR-0017 §8 · Every Brain prediction with an actual outcome feeds back here.
-- Aggregation gated by ADR-0016 K-anonymity before affecting Brain confidence.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_field_outcomes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  merchant_slug         TEXT NOT NULL,
  project_id            UUID,                    -- Optional Twin project reference
  region_code           TEXT NOT NULL,

  -- What the Brain predicted
  prediction_subject    TEXT NOT NULL,           -- e.g. 'staircase.install_duration_days'
  predicted_value       JSONB NOT NULL,
  prediction_context    JSONB,                   -- Scope inputs that produced the prediction
  predicted_at          TIMESTAMPTZ NOT NULL,

  -- What actually happened
  actual_value          JSONB NOT NULL,
  actual_recorded_at    TIMESTAMPTZ NOT NULL,
  deviation_reason      TEXT,                    -- e.g. 'uneven existing structure'

  delta_pct             NUMERIC,                 -- e.g. +33.3 for 3d→4d
  delta_direction       TEXT CHECK (delta_direction IN ('over', 'under', 'exact')),

  -- Consent per ADR-0016 · merchant opts in
  contributes_to_rollup BOOLEAN NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_outcomes_subject
  ON public.hammerex_nex_brain_field_outcomes (brain_slug, prediction_subject, actual_recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_brain_outcomes_merchant
  ON public.hammerex_nex_brain_field_outcomes (merchant_slug, actual_recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_brain_outcomes_region
  ON public.hammerex_nex_brain_field_outcomes (brain_slug, region_code, prediction_subject);

-- Aggregated learning signals (K-anonymity gated · Author reviews quarterly)
CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_learning_signals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  prediction_subject    TEXT NOT NULL,
  region_code           TEXT,                    -- NULL for national
  window_start          TIMESTAMPTZ NOT NULL,
  window_end            TIMESTAMPTZ NOT NULL,

  sample_size           INTEGER NOT NULL,
  min_contributor_count INTEGER NOT NULL,        -- K threshold applied per ADR-0016

  median_delta_pct      NUMERIC,
  p95_delta_pct         NUMERIC,
  trend_direction       TEXT CHECK (trend_direction IN ('improving', 'stable', 'drifting_over', 'drifting_under')),

  author_reviewed_at    TIMESTAMPTZ,
  author_action         TEXT CHECK (author_action IN ('accepted', 'rejected', 'deferred', 'investigating')),
  author_notes          TEXT,
  proposed_brain_change JSONB,                   -- Structured suggestion for Author

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brain_slug, prediction_subject, region_code, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_brain_signals_pending_review
  ON public.hammerex_nex_brain_learning_signals (brain_slug)
  WHERE author_action IS NULL;

-- ─── RLS ─────────────────────────────────────────────────────────

ALTER TABLE public.hammerex_nex_brains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_nex_brain_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_nex_brain_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_nex_brain_versions ENABLE ROW LEVEL SECURITY;

-- Published Brains readable by any authenticated user
CREATE POLICY "brains_read_published"
  ON public.hammerex_nex_brains
  FOR SELECT
  USING (status = 'published' OR primary_author_id = auth.uid());

-- Only primary Author can edit their Brain
CREATE POLICY "brains_write_by_author"
  ON public.hammerex_nex_brains
  FOR UPDATE
  USING (primary_author_id = auth.uid());

-- Brain content readable by all authenticated (for published Brains)
CREATE POLICY "brain_content_read_all"
  ON public.hammerex_nex_brain_content
  FOR SELECT
  USING (
    is_current = TRUE
    AND brain_slug IN (SELECT slug FROM public.hammerex_nex_brains WHERE status = 'published')
  );

-- Only primary Author edits content for their Brain
CREATE POLICY "brain_content_write_by_author"
  ON public.hammerex_nex_brain_content
  FOR ALL
  USING (
    authored_by = auth.uid()
    OR brain_slug IN (SELECT slug FROM public.hammerex_nex_brains WHERE primary_author_id = auth.uid())
  );

-- Merchants can submit corrections
CREATE POLICY "brain_corrections_insert_by_merchant"
  ON public.hammerex_nex_brain_corrections
  FOR INSERT
  WITH CHECK (
    merchant_slug IN (
      SELECT merchant_slug FROM public.hammerex_nex_team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Merchants can see their own corrections
CREATE POLICY "brain_corrections_read_own"
  ON public.hammerex_nex_brain_corrections
  FOR SELECT
  USING (
    merchant_slug IN (
      SELECT merchant_slug FROM public.hammerex_nex_team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR reviewed_by = auth.uid()
    OR brain_slug IN (SELECT slug FROM public.hammerex_nex_brains WHERE primary_author_id = auth.uid())
  );

-- Author can review corrections for their Brain
CREATE POLICY "brain_corrections_review_by_author"
  ON public.hammerex_nex_brain_corrections
  FOR UPDATE
  USING (
    brain_slug IN (SELECT slug FROM public.hammerex_nex_brains WHERE primary_author_id = auth.uid())
  );

COMMENT ON TABLE public.hammerex_nex_brains IS
  'Phase 0 Week 3 · Trade Brain registry · per ADR-0017 + ADR-0021.';
COMMENT ON TABLE public.hammerex_nex_brain_content IS
  'Phase 0 Week 3 · Structured Brain content editable via Author Tooling · exported to JSON packs weekly.';
COMMENT ON TABLE public.hammerex_nex_brain_corrections IS
  'Phase 0 Week 3 · Merchant correction chain · reviewed weekly by primary Author.';

COMMIT;
