-- =============================================================
-- Pending migration · Nex Brain Vision Examples + Estimate Rules · V0
-- =============================================================
--
-- Per NEX_BRAIN_PLATFORM_AND_ENGINE_V1.md Gap 3.
-- Held in docs/implementation/pending-migrations/ · NOT applied to
-- production until:
--   • ADR-0017 (Trade Brain Contract) signoff
--   • ADR-0021 (Intelligence Domain Separation) signoff
--   • brain_content_v0.sql applied first (registry FK dependency)
--
-- Vision examples are Author-labelled ground truth for retraining the
-- Vision engine per-Brain. Estimate rules are Author-authored pricing
-- rules per Brain scoped by region.

-- ─── Brain vision examples (Author-labelled ground truth) ───────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_vision_examples (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  category              TEXT NOT NULL,           -- 'staircase.tread_wear', 'staircase.baluster_defect'
  image_url             TEXT NOT NULL,           -- Supabase Storage domain-prefixed path per ADR-0021
  ground_truth          JSONB NOT NULL,          -- Author-labelled measurements/labels
  vision_model_version  TEXT,                    -- Model version used at label time
  author_id             UUID REFERENCES auth.users(id),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'author_approved', 'published', 'retired')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_examples_brain_category
  ON public.hammerex_nex_brain_vision_examples (brain_slug, category, status);

CREATE INDEX IF NOT EXISTS idx_vision_examples_author
  ON public.hammerex_nex_brain_vision_examples (author_id)
  WHERE author_id IS NOT NULL;

COMMENT ON TABLE public.hammerex_nex_brain_vision_examples IS
  'Author-labelled ground truth per Brain per category. Feeds quarterly Vision model retraining. Storage paths must follow ADR-0021 domain prefix /trade-brains/<slug>/images/.';

-- ─── Brain estimate rules (Author-authored pricing model rules) ─

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_estimate_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  rule_key              TEXT NOT NULL,           -- 'labour.per_riser.oak'
  applies_when          JSONB NOT NULL,          -- Predicate over EstimatorScope
  formula               JSONB NOT NULL,          -- Structured expression (no arbitrary code)
  unit                  TEXT NOT NULL
                          CHECK (unit IN ('hours', 'gbp_pence', 'metres', 'each', 'square_metres', 'cubic_metres')),
  base_value            NUMERIC NOT NULL,
  region_code           TEXT,                    -- NULL for national default
  confidence_tier       TEXT NOT NULL
                          CHECK (confidence_tier IN ('low', 'medium', 'high')),
  authored_by           UUID REFERENCES auth.users(id),
  version               TEXT NOT NULL,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  evidence              JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brain_slug, rule_key, region_code, version)
);

CREATE INDEX IF NOT EXISTS idx_estimate_rules_lookup
  ON public.hammerex_nex_brain_estimate_rules (brain_slug, rule_key, region_code)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_estimate_rules_authored_by
  ON public.hammerex_nex_brain_estimate_rules (authored_by)
  WHERE authored_by IS NOT NULL;

COMMENT ON TABLE public.hammerex_nex_brain_estimate_rules IS
  'Author-authored pricing rules per Brain. Structured formula only, no arbitrary code. Phase 28 Estimator composes multiple lines and adds the waste/overhead/profit/VAT policy stack.';

-- =============================================================
-- End of pending migration brain_vision_and_estimate_rules_v0.sql
-- =============================================================
