-- Design Operating System · Foundation migration.
--
-- Adds the persistent state for the branding OS layer:
--   • hammerex_brand_identity  (mutable master brand DNA per merchant / homeowner)
--   • hammerex_brand_snapshots (immutable per-project snapshot for reproducibility)
--   • hammerex_van_sessions    (paid session, tracks washer credit spent)
--   • hammerex_van_generations (each generation history, cost, prompt)
-- Plus extends homeowners with the platform-wide washer wallet so the same
-- currency works across merchants + homeowners + guests.

-- ─── Homeowner washer wallet ───────────────────────────────────────
-- Homeowners now share the platform-wide washer economy per Philip's
-- "one wallet, spendable everywhere" direction. Defaults mirror the
-- merchant scheme (10 free washers on signup).

ALTER TABLE public.hammerex_homeowners
  ADD COLUMN IF NOT EXISTS washer_balance         INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS washer_monthly_credit  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS washer_credit_last_replenished_at TIMESTAMPTZ;

-- ─── Master Brand Identity ─────────────────────────────────────────
-- One row per merchant OR homeowner. Editable forever. All downstream
-- design surfaces (van, logo, business card, workwear, invoice) read
-- from this. Populated by the Discovery + Strategy + Director agents.

CREATE TABLE IF NOT EXISTS public.hammerex_brand_identity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Owner: merchant_slug OR homeowner_id (mutually exclusive)
  merchant_slug TEXT,
  homeowner_id  UUID REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  -- Deterministic uniqueness hash from src/lib/design/brand/fingerprint.ts
  fingerprint   TEXT NOT NULL,
  -- Structured brand shape per BrandRecord schema (verbatim from ChatGPT
  -- design-brief architecture).
  brand_json    JSONB NOT NULL,
  -- Provenance
  created_via   TEXT,   -- 'discovery-agent' | 'manual' | 'import'
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT one_owner CHECK (
    (merchant_slug IS NOT NULL AND homeowner_id IS NULL) OR
    (merchant_slug IS NULL AND homeowner_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_brand_identity_merchant
  ON public.hammerex_brand_identity (merchant_slug)
  WHERE merchant_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_brand_identity_homeowner
  ON public.hammerex_brand_identity (homeowner_id)
  WHERE homeowner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_identity_fingerprint
  ON public.hammerex_brand_identity (fingerprint);

-- Auto-touch updated_at + bump version on any brand_json edit
CREATE OR REPLACE FUNCTION public.fn_brand_identity_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.brand_json::text <> OLD.brand_json::text THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_brand_identity_touch ON public.hammerex_brand_identity;
CREATE TRIGGER trg_brand_identity_touch
  BEFORE UPDATE ON public.hammerex_brand_identity
  FOR EACH ROW EXECUTE FUNCTION public.fn_brand_identity_touch();

ALTER TABLE public.hammerex_brand_identity ENABLE ROW LEVEL SECURITY;

-- ─── Brand Snapshots ──────────────────────────────────────────────
-- Immutable copy of the brand DNA at the moment a design project ran.
-- Guarantees historic outputs remain reproducible even if the master
-- brand later changes. Every van_session / logo_order references one.

CREATE TABLE IF NOT EXISTS public.hammerex_brand_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_identity_id  UUID NOT NULL REFERENCES public.hammerex_brand_identity(id) ON DELETE CASCADE,
  brand_json         JSONB NOT NULL,       -- frozen copy
  fingerprint        TEXT NOT NULL,        -- frozen copy
  brand_version      INTEGER NOT NULL,     -- version at snapshot time
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_snapshots_identity
  ON public.hammerex_brand_snapshots (brand_identity_id, created_at DESC);

ALTER TABLE public.hammerex_brand_snapshots ENABLE ROW LEVEL SECURITY;

-- ─── Van Sessions ─────────────────────────────────────────────────
-- One row per paid van design session. Tracks washer credit consumed,
-- generations produced, brand snapshot in effect, final download.

CREATE TABLE IF NOT EXISTS public.hammerex_van_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Owner
  merchant_slug         TEXT,
  homeowner_id          UUID REFERENCES public.hammerex_homeowners(id) ON DELETE SET NULL,
  guest_email           TEXT,
  brand_snapshot_id     UUID REFERENCES public.hammerex_brand_snapshots(id) ON DELETE SET NULL,
  -- Session state
  status                TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'exhausted' | 'completed' | 'refunded'
  washers_reserved      INTEGER NOT NULL DEFAULT 50,      -- max spend for this session
  washers_spent         INTEGER NOT NULL DEFAULT 0,
  hd_final_generated    BOOLEAN NOT NULL DEFAULT FALSE,
  final_image_urls      JSONB,                            -- { side, front, rear, board } after final HD
  -- Session inputs
  business_name         TEXT NOT NULL,
  trade                 TEXT NOT NULL,
  van_slug              TEXT NOT NULL,
  van_colour            TEXT NOT NULL,
  starter_logo_url      TEXT,
  design_mode           TEXT NOT NULL DEFAULT 'best-shot', -- 'best-shot' | 'print-ready'
  -- Timing
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,

  CONSTRAINT one_van_owner CHECK (
    merchant_slug IS NOT NULL OR homeowner_id IS NOT NULL OR guest_email IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_van_sessions_merchant
  ON public.hammerex_van_sessions (merchant_slug, started_at DESC)
  WHERE merchant_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_van_sessions_homeowner
  ON public.hammerex_van_sessions (homeowner_id, started_at DESC)
  WHERE homeowner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_van_sessions_status
  ON public.hammerex_van_sessions (status, last_activity_at DESC);

ALTER TABLE public.hammerex_van_sessions ENABLE ROW LEVEL SECURITY;

-- ─── Van Generations ──────────────────────────────────────────────
-- Every generation attempt inside a session. Full SDS + prompt +
-- image URLs + cost logged for debugging, replay, and QA.

CREATE TABLE IF NOT EXISTS public.hammerex_van_generations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES public.hammerex_van_sessions(id) ON DELETE CASCADE,
  -- Turn kind
  kind              TEXT NOT NULL,       -- 'initial' | 'refine' | 'hd_final'
  -- Structured Design Specification passed to the compiler
  sds_json          JSONB NOT NULL,
  -- Compiled prompt sent to GPT Image 1
  prompt_text       TEXT NOT NULL,
  -- Optional user prompt (for refine turns)
  user_prompt       TEXT,
  -- Image outputs (three views: side, front, rear as separate URLs)
  image_urls        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Cost + timing
  washers_charged   INTEGER NOT NULL,
  usd_cost          NUMERIC(6,4),
  latency_ms        INTEGER,
  model_used        TEXT,                -- 'gpt-image-1' etc
  quality_tier      TEXT NOT NULL DEFAULT 'medium', -- 'medium' | 'high' | 'hd'
  -- QA
  quality_score     INTEGER,             -- 0-100 from scoring engine
  score_breakdown   JSONB,                -- per-axis scores
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_van_generations_session
  ON public.hammerex_van_generations (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_van_generations_kind
  ON public.hammerex_van_generations (kind, created_at DESC);

ALTER TABLE public.hammerex_van_generations ENABLE ROW LEVEL SECURITY;
