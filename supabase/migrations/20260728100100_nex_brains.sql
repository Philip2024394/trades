-- 20260728100100_nex_brains.sql
-- Living Trade Brains · Brain Registry · ADR-0037
--
-- Renamed from hammerex_nex_brain_registry → hammerex_nex_brains
-- per Philip 2026-07-28 · shorter, cleaner, first-class table name.
--
-- Every Brain has a permanent identity here. This table is designed to
-- scale to THOUSANDS of Trade Brains across multiple countries,
-- multiple languages, multiple authors, with signed portable
-- Brain Package distribution — without requiring future database
-- redesign. Every schema decision is evaluated against long-term
-- ecosystem scalability, not just today's Staircase Brain.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brains (
  -- ─── Identity ───
  slug                   text          PRIMARY KEY,
  namespace              text          NOT NULL,
  -- globally-unique identifier · e.g. "nex-official/staircase" ·
  -- "australia-guild/staircase-au" · "uk-electrical-board/17th-edition"
  display_name           text          NOT NULL,
  description            text          NULL,
  -- one-paragraph human-readable summary for registry cards
  category               text          NOT NULL,
  -- trade · business · regulatory · product · industry · specialist
  trade                  text          NULL,
  -- carpentry · plumbing · electrical · roofing · joinery · staircase · etc.

  -- ─── Ownership ───
  owner_id               text          NULL,
  origin_org             text          NULL,
  -- who originally published this brain · used when packages are
  -- imported from another org's Nex installation
  primary_author_id      text          NULL,
  primary_author_name    text          NULL,
  primary_author_creds   text          NULL,
  maintainers            text[]        NOT NULL DEFAULT '{}',

  -- ─── Localisation ───
  primary_country        text          NULL,
  supported_countries    text[]        NOT NULL DEFAULT '{}',
  supported_regions      text[]        NULL,
  primary_language       text          NOT NULL DEFAULT 'en-GB',
  languages              text[]        NOT NULL DEFAULT '{en-GB}',

  -- ─── Workflow status (per-ADR-0017 authoring pipeline) ───
  status                 text          NOT NULL DEFAULT 'draft',
  -- draft · author_review · advisory_panel · published · retired

  -- ─── Product lifecycle stage (per-Philip · 2026-07-28) ───
  lifecycle_stage        text          NOT NULL DEFAULT 'draft',
  -- draft · internal · beta · production · deprecated · archived
  -- Orthogonal to `status` — a brain can be `published` but still `beta`.

  -- ─── Certification ───
  certification_level    text          NOT NULL DEFAULT 'uncertified',
  -- uncertified · self_certified · peer_reviewed · board_certified · industry_body_certified

  -- ─── Current version pointer (FK added later after versions table exists) ───
  current_version_id     uuid          NULL,

  -- ─── Capability flags (per-Philip · 2026-07-28) ───
  -- Structured JSON blob so new capabilities can be added without
  -- schema changes. Every capability defaults false. Runtime + UI
  -- gate feature exposure per brain from these flags.
  capabilities           jsonb         NOT NULL DEFAULT jsonb_build_object(
    'supports_chat',        false,
    'supports_vision',      false,
    'supports_voice',       false,
    'supports_estimates',   false,
    'supports_projects',    false,
    'supports_marketplace', false,
    'supports_memory',      false,
    'supports_simulation',  false
  ),

  -- ─── Health / quality (nightly-computed) ───
  quality_score          numeric(5,2)  NULL,
  readiness_score_json   jsonb         NULL,
  -- {knowledge, coverage, testing, author_review, freshness, confidence, overall}
  confidence             numeric(5,4)  NULL,
  coverage               numeric(5,2)  NULL,
  last_review_at         timestamptz   NULL,
  review_frequency_days  integer       NOT NULL DEFAULT 90,

  -- ─── Brain Package portability (future — schema laid now) ───
  package_id             uuid          NULL,
  -- If this brain was installed from an external portable package,
  -- the source package's globally-unique id.
  installed_from_source  text          NULL,
  -- URL / registry entry the brain was installed from.
  exportable             boolean       NOT NULL DEFAULT true,
  -- Whether this brain can be exported as a signed portable package.

  -- ─── Free-form metadata ───
  metadata               jsonb         NOT NULL DEFAULT '{}'::jsonb,

  -- ─── Timestamps ───
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),

  -- ─── Constraints ───
  UNIQUE (namespace)
);

CREATE INDEX IF NOT EXISTS ix_brains_status
  ON public.hammerex_nex_brains (status);
CREATE INDEX IF NOT EXISTS ix_brains_lifecycle
  ON public.hammerex_nex_brains (lifecycle_stage);
CREATE INDEX IF NOT EXISTS ix_brains_category
  ON public.hammerex_nex_brains (category);
CREATE INDEX IF NOT EXISTS ix_brains_trade
  ON public.hammerex_nex_brains (trade) WHERE trade IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_brains_country
  ON public.hammerex_nex_brains (primary_country) WHERE primary_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_brains_language
  ON public.hammerex_nex_brains (primary_language);
CREATE INDEX IF NOT EXISTS ix_brains_namespace
  ON public.hammerex_nex_brains (namespace);
CREATE INDEX IF NOT EXISTS ix_brains_certification
  ON public.hammerex_nex_brains (certification_level);
CREATE INDEX IF NOT EXISTS ix_brains_package_source
  ON public.hammerex_nex_brains (package_id) WHERE package_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_brains_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brains_touch_updated_at
  BEFORE UPDATE ON public.hammerex_nex_brains
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_brains_updated_at();

ALTER TABLE public.hammerex_nex_brains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brains
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_production" ON public.hammerex_nex_brains
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND lifecycle_stage IN ('beta', 'production'));

CREATE POLICY "authenticated_read_all" ON public.hammerex_nex_brains
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.hammerex_nex_brains IS
  'Living Trade Brains · Brain Registry · ADR-0037 · designed to scale to thousands of brains across countries, languages, authors, with signed portable Brain Package distribution';
