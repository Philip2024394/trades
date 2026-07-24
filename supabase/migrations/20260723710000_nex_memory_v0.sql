-- Phase 26 — Nex Construction Memory Engine, V0 substrate.
--
-- Three tables: user memory, company memory, project memory. Each row
-- carries a structured (subject, predicate, value) triple + evidence
-- chain + confidence + optional decay + correction pointer.
--
-- Cross-tenant layers (trade / region / industry / market) are OUT of
-- scope for V0 — they arrive in V1 (rollup crons + K-anonymity gate).
--
-- Every write records `visible_to`. Every read filters on the caller's
-- viewer scope. Corrections chain via `correction_of` (never destructive).
--
-- All three tables share the same envelope so retrieval + adapter code
-- stays uniform.

-- ─── Enums (typed strings via CHECK) ─────────────────────────────

-- We use text + CHECK rather than Postgres ENUM types so
-- forward-additions (new sources, new predicates) don't need enum
-- migrations. Every existing Nex phase (Phase 5 BI onwards) already
-- follows this pattern.

-- ─── User memory ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_memory_user (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     UUID NOT NULL,                                  -- the user this memory is about
  subject           TEXT NOT NULL,                                  -- 'preference.day_rate_gbp' | 'pref.tools.van_kit' | ...
  predicate         TEXT NOT NULL CHECK (predicate IN ('=', '>', '<', 'avg', 'median', 'p50', 'p95', 'has', 'not', 'like')),
  value_json        JSONB NOT NULL,
  unit              TEXT,                                           -- 'gbp' | 'days' | '%' | null

  observed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_start      TIMESTAMPTZ,
  window_end        TIMESTAMPTZ,
  sample_size       INTEGER NOT NULL DEFAULT 1 CHECK (sample_size >= 1),

  confidence        TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  is_official       BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,

  visible_to        TEXT NOT NULL DEFAULT 'owner_only'
                       CHECK (visible_to IN ('owner_only', 'owner_and_delegates')),

  source_engine     TEXT NOT NULL,                                  -- 'ops' | 'orch' | 'chat' | ...
  evidence_tables   TEXT[] NOT NULL DEFAULT '{}',
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decays_at         TIMESTAMPTZ,

  correction_of     UUID REFERENCES public.hammerex_nex_memory_user(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nmem_user_owner_subject
  ON public.hammerex_nex_memory_user (owner_user_id, subject);
CREATE INDEX IF NOT EXISTS idx_nmem_user_observed
  ON public.hammerex_nex_memory_user (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nmem_user_correction
  ON public.hammerex_nex_memory_user (correction_of)
  WHERE correction_of IS NOT NULL;

-- ─── Company memory ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_memory_company (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug     TEXT NOT NULL,
  subject           TEXT NOT NULL,                                  -- 'pricing.kitchen.gbp_per_m2' | 'customer.payment.days_median'
  predicate         TEXT NOT NULL CHECK (predicate IN ('=', '>', '<', 'avg', 'median', 'p50', 'p95', 'has', 'not', 'like')),
  value_json        JSONB NOT NULL,
  unit              TEXT,

  observed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_start      TIMESTAMPTZ,
  window_end        TIMESTAMPTZ,
  sample_size       INTEGER NOT NULL DEFAULT 1 CHECK (sample_size >= 1),

  confidence        TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  is_official       BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,

  visible_to        TEXT NOT NULL DEFAULT 'owner_only'
                       CHECK (visible_to IN ('owner_only', 'owner_and_delegates')),

  source_engine     TEXT NOT NULL,
  evidence_tables   TEXT[] NOT NULL DEFAULT '{}',
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decays_at         TIMESTAMPTZ,

  correction_of     UUID REFERENCES public.hammerex_nex_memory_company(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nmem_company_owner_subject
  ON public.hammerex_nex_memory_company (merchant_slug, subject);
CREATE INDEX IF NOT EXISTS idx_nmem_company_observed
  ON public.hammerex_nex_memory_company (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nmem_company_correction
  ON public.hammerex_nex_memory_company (correction_of)
  WHERE correction_of IS NOT NULL;

-- ─── Project memory ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_memory_project (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug     TEXT NOT NULL,
  project_id        UUID NOT NULL,
  subject           TEXT NOT NULL,                                  -- 'duration.days' | 'labour.hours' | 'snags.count' | 'review.score'
  predicate         TEXT NOT NULL CHECK (predicate IN ('=', '>', '<', 'avg', 'median', 'p50', 'p95', 'has', 'not', 'like')),
  value_json        JSONB NOT NULL,
  unit              TEXT,

  observed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_start      TIMESTAMPTZ,
  window_end        TIMESTAMPTZ,
  sample_size       INTEGER NOT NULL DEFAULT 1 CHECK (sample_size >= 1),

  confidence        TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  is_official       BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,

  visible_to        TEXT NOT NULL DEFAULT 'owner_only'
                       CHECK (visible_to IN ('owner_only', 'owner_and_delegates', 'project_participants')),

  source_engine     TEXT NOT NULL,
  evidence_tables   TEXT[] NOT NULL DEFAULT '{}',
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decays_at         TIMESTAMPTZ,

  correction_of     UUID REFERENCES public.hammerex_nex_memory_project(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nmem_project_owner_subject
  ON public.hammerex_nex_memory_project (project_id, subject);
CREATE INDEX IF NOT EXISTS idx_nmem_project_merchant_subject
  ON public.hammerex_nex_memory_project (merchant_slug, subject);
CREATE INDEX IF NOT EXISTS idx_nmem_project_observed
  ON public.hammerex_nex_memory_project (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nmem_project_correction
  ON public.hammerex_nex_memory_project (correction_of)
  WHERE correction_of IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────
-- Row Level Security is enforced. The service role (used by the
-- writer/reader server code) bypasses RLS; direct client access is
-- blocked. All read/write paths go through supabaseAdmin.

ALTER TABLE public.hammerex_nex_memory_user    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_nex_memory_company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_nex_memory_project ENABLE ROW LEVEL SECURITY;

-- Default deny — no client-side policies. Any client-side read must
-- ship its own policy in a follow-up migration.

-- ─── Comment metadata for DB_SCHEMA scan ─────────────────────────

COMMENT ON TABLE public.hammerex_nex_memory_user IS
  'Phase 26 · User memory · owner-only. Preferences, personal decisions, feedback.';
COMMENT ON TABLE public.hammerex_nex_memory_company IS
  'Phase 26 · Company memory · owner-only in V0. Pricing history, supplier patterns, customer patterns.';
COMMENT ON TABLE public.hammerex_nex_memory_project IS
  'Phase 26 · Project memory · owner-only in V0. Per-project outcomes: duration, labour hours, snags, reviews.';
