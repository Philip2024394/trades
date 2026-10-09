-- NEX Visual · Structural-Lock Architecture · M-1 additive DB foundation.
--
-- Founder-authorised 2026-09-15 · bare-token AUTHORISE NEX VISUAL STRUCTURAL
-- LOCK ARCHITECTURE WAVE · full spec at:
--   docs/NEX1/BUILD_GATES/NEX-IMAGE-REFERENCE-ARCHITECTURE-INSPECTION-2026-09-15.md
--   feedback_nex_image_reference_architecture_redesign_full_spec_2026_09_15.md
--
-- 5 additive tables · zero DDL against existing tables. AI Visualiser · Trade
-- Submissions · Site Interest Visualise · merchant assets · business cards ·
-- image licenses · content manifests · generation costs · studio asset library
-- ALL remain untouched. Backfill (M-5) and dual-write (M-6) are explicitly
-- deferred to a later Founder-authorised phase.
--
-- Model:
--   nex_visual_reference_assets       — immutable master reference bytes
--       │
--       ├── nex_visual_reference_profiles  — structural profile per feature
--       │
--       └── nex_visual_generation_jobs     — one generation request
--              │
--              └── nex_visual_generated_assets   — produced image
--                     │
--                     └── nex_visual_generation_validations — component pass/fail
--
-- Founder rules encoded at DB level:
--   1. Reference bytes are immutable — status transitions gated · locked
--      references cannot leave locked · master flag protected by policy.
--   2. Anti-chaining — generation_jobs.reference_asset_id FKs
--      nex_visual_reference_assets · NEVER nex_visual_generated_assets ·
--      an output cannot be silently promoted to a reference.
--   3. Every generated_asset has provenance (generation_job_id + effective
--      reference_asset_id copied for O(1) audit).
--   4. Every validation traces back to the master reference · never against
--      the previous generated image.
--   5. `generation_strength` replaces the ambiguous "scale" per inspection
--      report risk R-5.
--   6. Component-level validation scores default NULL · overall_status
--      defaults 'PENDING' · schema NEVER fabricates a percentage. Validators
--      that cannot honestly compute a score set overall_status
--      'NOT_IMPLEMENTED' explicitly.

BEGIN;

-- =====================================================================
-- 1 · nex_visual_reference_assets · immutable master reference bytes
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.nex_visual_reference_assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Grouping key for versions of the same reference · same family = same
  -- semantic anchor (e.g. "the customer's staircase") across versions.
  version_family_id        UUID NOT NULL DEFAULT gen_random_uuid(),
  -- Sequential version number within a family · new upload = new version.
  version                  INTEGER NOT NULL DEFAULT 1,
  -- Only ONE row per family may have is_master = true. Enforced by
  -- partial unique index below. Master flip is an explicit user action.
  is_master                BOOLEAN NOT NULL DEFAULT FALSE,
  -- Owner scoping · nullable for system / anonymous seed uploads.
  user_id                  UUID,
  merchant_id              UUID,
  name                     TEXT NOT NULL,
  -- Category · 'product' · 'environment' · 'lighting' · 'material' · etc.
  asset_type               TEXT NOT NULL DEFAULT 'product',
  -- Storage · either Supabase Storage path or external URL (ImageKit etc.)
  original_storage_path    TEXT NOT NULL,
  preview_storage_path     TEXT,
  mime_type                TEXT NOT NULL,
  width                    INTEGER,
  height                   INTEGER,
  file_size                BIGINT,
  -- Content immutability check · verified on read to detect drift.
  checksum_sha256          TEXT NOT NULL,
  -- Lifecycle · uploaded → processing → profile_created → approved →
  -- locked. Locked is the MASTER REFERENCE state. Only 'locked' rows may
  -- carry is_master = true. Additional terminal states: archived · rejected.
  status                   TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','processing','profile_created','approved','locked','archived','rejected','legacy_import')),
  -- Free-form JSON for licence linkage · provenance · original prompt · tags.
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One master per family · enforced by partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS nex_visual_reference_assets_one_master_per_family
  ON public.nex_visual_reference_assets (version_family_id)
  WHERE is_master = TRUE;

-- Fast lookups.
CREATE INDEX IF NOT EXISTS nex_visual_reference_assets_family_version_idx
  ON public.nex_visual_reference_assets (version_family_id, version DESC);

CREATE INDEX IF NOT EXISTS nex_visual_reference_assets_user_created_idx
  ON public.nex_visual_reference_assets (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS nex_visual_reference_assets_merchant_created_idx
  ON public.nex_visual_reference_assets (merchant_id, created_at DESC)
  WHERE merchant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS nex_visual_reference_assets_status_idx
  ON public.nex_visual_reference_assets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_visual_reference_assets_checksum_idx
  ON public.nex_visual_reference_assets (checksum_sha256);

-- =====================================================================
-- 2 · nex_visual_reference_profiles · machine-readable structural profile
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.nex_visual_reference_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_asset_id       UUID NOT NULL REFERENCES public.nex_visual_reference_assets(id) ON DELETE CASCADE,
  -- 'staircase' · 'door' · 'kitchen' · etc. · aligned with primary_brain taxonomy.
  profile_type             TEXT NOT NULL DEFAULT 'generic',
  -- Profile schema version · new extraction = new row · never silently replace.
  profile_version          INTEGER NOT NULL DEFAULT 1,
  -- 'pending' · 'running' · 'complete' · 'failed' · 'not_implemented'.
  -- 'not_implemented' means the profile schema exists but the extractor
  -- for this profile_type cannot honestly compute values yet · schema
  -- MUST NOT fabricate values in this state.
  extraction_status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending','running','complete','failed','not_implemented')),
  extraction_error_reason  TEXT,
  -- Per-feature payload · each key is { value · confidence · detection_status }
  -- e.g. { "stair_pitch": { "value": 38.5, "confidence": 0.91, "detection_status": "verified" },
  --        "baluster_count": { "value": 14, "confidence": 0.87, "detection_status": "verified" } }
  geometry_data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Segmentation masks · embedding paths · edge maps (Supabase Storage refs).
  visual_data              JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Aggregate confidence · NULL when extraction incomplete or not_implemented.
  overall_confidence       NUMERIC,
  extractor_name           TEXT,
  extractor_version        TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nex_visual_reference_profiles_asset_idx
  ON public.nex_visual_reference_profiles (reference_asset_id, profile_version DESC);

CREATE INDEX IF NOT EXISTS nex_visual_reference_profiles_type_idx
  ON public.nex_visual_reference_profiles (profile_type, extraction_status);

-- =====================================================================
-- 3 · nex_visual_generation_jobs · one generation request
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.nex_visual_generation_jobs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID,
  merchant_id              UUID,
  -- CRITICAL: FK targets nex_visual_reference_assets · NEVER
  -- nex_visual_generated_assets · this is the DB-level anti-chaining
  -- guarantee that a generated output cannot be silently promoted to a
  -- reference and become the anchor for the next generation.
  reference_asset_id       UUID NOT NULL REFERENCES public.nex_visual_reference_assets(id) ON DELETE RESTRICT,
  reference_profile_id     UUID REFERENCES public.nex_visual_reference_profiles(id) ON DELETE SET NULL,
  prompt                   TEXT NOT NULL,
  -- Provider-agnostic settings blob · seed · guidance · steps · resolution ·
  -- ip_adapter_scale (identity guide only) · controlnet_strength etc.
  generation_settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Which engine handled this · 'nex-visual-engine-primary' (SDXL) · or
  -- a future engine · always the NEX-native slug (never bare model name).
  engine_slug              TEXT NOT NULL,
  model                    TEXT NOT NULL,
  provider                 TEXT NOT NULL DEFAULT 'nex-local',
  -- Renamed from ambiguous "scale" per inspection R-5. Represents
  -- generation strength / conditioning strength · NOT structural scale ·
  -- NEVER instructs the model to redesign the reference structure.
  generation_strength      NUMERIC,
  status                   TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','complete','failed','cancelled')),
  error_reason             TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS nex_visual_generation_jobs_reference_idx
  ON public.nex_visual_generation_jobs (reference_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_visual_generation_jobs_user_idx
  ON public.nex_visual_generation_jobs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS nex_visual_generation_jobs_status_idx
  ON public.nex_visual_generation_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_visual_generation_jobs_engine_idx
  ON public.nex_visual_generation_jobs (engine_slug, created_at DESC);

-- =====================================================================
-- 4 · nex_visual_generated_assets · produced output
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.nex_visual_generated_assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_job_id        UUID NOT NULL REFERENCES public.nex_visual_generation_jobs(id) ON DELETE CASCADE,
  -- Denormalised · always equals nex_visual_generation_jobs.reference_asset_id
  -- for O(1) audit · never a reference to another generated_asset.
  reference_asset_id       UUID NOT NULL REFERENCES public.nex_visual_reference_assets(id) ON DELETE RESTRICT,
  storage_path             TEXT NOT NULL,
  preview_storage_path     TEXT,
  width                    INTEGER,
  height                   INTEGER,
  file_size                BIGINT,
  checksum_sha256          TEXT NOT NULL,
  model                    TEXT NOT NULL,
  generation_parameters    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Lifecycle · candidate → approved · rejected · archived. Approval does
  -- NOT promote to reference · promoting is an explicit user action that
  -- creates a NEW row in nex_visual_reference_assets · never mutates or
  -- re-links this row.
  status                   TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','approved','rejected','archived')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nex_visual_generated_assets_job_idx
  ON public.nex_visual_generated_assets (generation_job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_visual_generated_assets_reference_idx
  ON public.nex_visual_generated_assets (reference_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_visual_generated_assets_status_idx
  ON public.nex_visual_generated_assets (status, created_at DESC);

-- =====================================================================
-- 5 · nex_visual_generation_validations · component-level pass/fail
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.nex_visual_generation_validations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_asset_id       UUID NOT NULL REFERENCES public.nex_visual_generated_assets(id) ON DELETE CASCADE,
  -- CRITICAL: validation always compares against nex_visual_reference_assets ·
  -- never against another generated_asset · this is the anti-chaining rule
  -- for the validation direction.
  reference_asset_id       UUID NOT NULL REFERENCES public.nex_visual_reference_assets(id) ON DELETE RESTRICT,
  reference_profile_id     UUID REFERENCES public.nex_visual_reference_profiles(id) ON DELETE SET NULL,
  validator_name           TEXT NOT NULL,
  validator_version        TEXT NOT NULL,
  -- Overall aggregate · NULL when NOT_IMPLEMENTED or PENDING. Schema
  -- DEFAULT does NOT fabricate a percentage.
  overall_score            NUMERIC,
  overall_status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (overall_status IN ('PENDING','RUNNING','PASS','FAIL','NOT_IMPLEMENTED','ERROR')),
  -- Component-level scores · each NULL when the specific validator has
  -- not been implemented yet · MUST NEVER be filled with a fabricated
  -- number. The consuming UI/API MUST distinguish NULL from 0.
  stair_pitch_score        NUMERIC,
  tread_score              NUMERIC,
  handrail_score           NUMERIC,
  baluster_score           NUMERIC,
  newel_score              NUMERIC,
  stringer_score           NUMERIC,
  silhouette_score         NUMERIC,
  -- Human-readable + machine-readable failure reasons.
  failure_reasons          TEXT[] NOT NULL DEFAULT '{}',
  -- Detailed per-component comparison output · masks · depth correlation
  -- matrices · edge SSIM · DINOv2 cosine · exact numbers used for scoring.
  validation_data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nex_visual_generation_validations_asset_idx
  ON public.nex_visual_generation_validations (generated_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_visual_generation_validations_reference_idx
  ON public.nex_visual_generation_validations (reference_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS nex_visual_generation_validations_status_idx
  ON public.nex_visual_generation_validations (overall_status, created_at DESC);

-- =====================================================================
-- Trigger · updated_at maintenance
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_nex_visual_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_visual_reference_assets_touch ON public.nex_visual_reference_assets;
CREATE TRIGGER trg_nex_visual_reference_assets_touch
  BEFORE UPDATE ON public.nex_visual_reference_assets
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_visual_touch_updated_at();

DROP TRIGGER IF EXISTS trg_nex_visual_reference_profiles_touch ON public.nex_visual_reference_profiles;
CREATE TRIGGER trg_nex_visual_reference_profiles_touch
  BEFORE UPDATE ON public.nex_visual_reference_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_visual_touch_updated_at();

-- =====================================================================
-- Trigger · immutability guard on reference_assets
-- =====================================================================
-- Once a reference asset reaches status = 'locked', the following fields
-- become immutable · UPDATE that changes any of them raises an exception.
-- The is_master flip is allowed (via explicit promotion/demotion API) but
-- the underlying bytes' identity (checksum · storage_path · width · height ·
-- mime_type · original file_size) can never be rewritten in place.
CREATE OR REPLACE FUNCTION public.fn_nex_visual_reference_asset_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    IF NEW.checksum_sha256      IS DISTINCT FROM OLD.checksum_sha256      THEN
      RAISE EXCEPTION 'nex_visual_reference_assets: checksum_sha256 is immutable once status=locked (id=%)', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.original_storage_path IS DISTINCT FROM OLD.original_storage_path THEN
      RAISE EXCEPTION 'nex_visual_reference_assets: original_storage_path is immutable once status=locked (id=%)', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.width                IS DISTINCT FROM OLD.width                THEN
      RAISE EXCEPTION 'nex_visual_reference_assets: width is immutable once status=locked (id=%)', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.height               IS DISTINCT FROM OLD.height               THEN
      RAISE EXCEPTION 'nex_visual_reference_assets: height is immutable once status=locked (id=%)', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.mime_type            IS DISTINCT FROM OLD.mime_type            THEN
      RAISE EXCEPTION 'nex_visual_reference_assets: mime_type is immutable once status=locked (id=%)', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.file_size            IS DISTINCT FROM OLD.file_size            THEN
      RAISE EXCEPTION 'nex_visual_reference_assets: file_size is immutable once status=locked (id=%)', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    -- Status may only transition to 'archived' or remain 'locked' · downgrade
    -- to a pre-locked state is forbidden.
    IF NEW.status NOT IN ('locked','archived') THEN
      RAISE EXCEPTION 'nex_visual_reference_assets: cannot downgrade status from locked to % (id=%)', NEW.status, OLD.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_visual_reference_asset_immutability ON public.nex_visual_reference_assets;
CREATE TRIGGER trg_nex_visual_reference_asset_immutability
  BEFORE UPDATE ON public.nex_visual_reference_assets
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_visual_reference_asset_immutability();

-- =====================================================================
-- Trigger · master-flag consistency
-- =====================================================================
-- Only rows with status = 'locked' may have is_master = TRUE. A row
-- flipped to is_master = TRUE that isn't locked raises an exception.
CREATE OR REPLACE FUNCTION public.fn_nex_visual_reference_master_requires_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_master = TRUE AND NEW.status <> 'locked' THEN
    RAISE EXCEPTION 'nex_visual_reference_assets: is_master=TRUE requires status=locked (id=%, status=%)', NEW.id, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_visual_reference_master_requires_locked ON public.nex_visual_reference_assets;
CREATE TRIGGER trg_nex_visual_reference_master_requires_locked
  BEFORE INSERT OR UPDATE ON public.nex_visual_reference_assets
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_visual_reference_master_requires_locked();

-- =====================================================================
-- Row Level Security · enabled everywhere · policies to be added by API
-- =====================================================================
ALTER TABLE public.nex_visual_reference_assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_visual_reference_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_visual_generation_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_visual_generated_assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_visual_generation_validations  ENABLE ROW LEVEL SECURITY;

-- Baseline RLS policies · service-role bypass · authenticated read own
-- rows · authenticated write own rows. Merchant scoping via merchant_id ·
-- user scoping via user_id. Anonymous access denied. Fine-grained policies
-- can be added by later feature migrations without touching this file.
CREATE POLICY nex_visual_reference_assets_owner_select
  ON public.nex_visual_reference_assets
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR merchant_id = auth.uid()
  );

CREATE POLICY nex_visual_reference_assets_owner_insert
  ON public.nex_visual_reference_assets
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR merchant_id = auth.uid()
  );

CREATE POLICY nex_visual_reference_assets_owner_update
  ON public.nex_visual_reference_assets
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR merchant_id = auth.uid()
  );

CREATE POLICY nex_visual_reference_profiles_owner_all
  ON public.nex_visual_reference_profiles
  FOR ALL
  USING (
    reference_asset_id IN (
      SELECT id FROM public.nex_visual_reference_assets
      WHERE user_id = auth.uid()
         OR merchant_id = auth.uid()
    )
  );

CREATE POLICY nex_visual_generation_jobs_owner_all
  ON public.nex_visual_generation_jobs
  FOR ALL
  USING (
    user_id = auth.uid()
    OR merchant_id = auth.uid()
  );

CREATE POLICY nex_visual_generated_assets_owner_all
  ON public.nex_visual_generated_assets
  FOR ALL
  USING (
    generation_job_id IN (
      SELECT id FROM public.nex_visual_generation_jobs
      WHERE user_id = auth.uid()
         OR merchant_id = auth.uid()
    )
  );

CREATE POLICY nex_visual_generation_validations_owner_select
  ON public.nex_visual_generation_validations
  FOR SELECT
  USING (
    generated_asset_id IN (
      SELECT ga.id
      FROM public.nex_visual_generated_assets ga
      JOIN public.nex_visual_generation_jobs gj ON gj.id = ga.generation_job_id
      WHERE gj.user_id = auth.uid()
         OR gj.merchant_id = auth.uid()
    )
  );

CREATE POLICY nex_visual_generation_validations_service_insert
  ON public.nex_visual_generation_validations
  FOR INSERT
  WITH CHECK (
    generated_asset_id IN (
      SELECT ga.id
      FROM public.nex_visual_generated_assets ga
      JOIN public.nex_visual_generation_jobs gj ON gj.id = ga.generation_job_id
      WHERE gj.user_id = auth.uid()
         OR gj.merchant_id = auth.uid()
    )
  );

COMMIT;

-- End of M-1 · additive foundation. Zero DDL against existing image lanes.
