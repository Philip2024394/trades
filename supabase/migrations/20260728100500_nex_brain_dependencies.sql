-- 20260728100500_nex_brain_dependencies.sql
-- Living Trade Brains · Dependencies · ADR-0037
--
-- DAG edges. A parent Brain depends on a child Brain. Enables
-- specialist Brains to reference shared Brains (Roofing → Building
-- Code, Weather, Material). Runtime resolves dependency chains for
-- richer reasoning without duplicating knowledge.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_dependencies (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_brain_slug    text          NOT NULL
                                     REFERENCES public.hammerex_nex_brains(slug)
                                     ON DELETE CASCADE,
  child_brain_slug     text          NOT NULL
                                     REFERENCES public.hammerex_nex_brains(slug)
                                     ON DELETE RESTRICT,
  relationship         text          NOT NULL DEFAULT 'depends_on',
  -- depends_on · extends · references · shares_regulations · shares_materials
  min_child_semver     text          NULL,
  -- e.g. "1.0.0" · minimum version of child brain this dependency requires
  added_at             timestamptz   NOT NULL DEFAULT now(),
  added_by             text          NULL,
  removed_at           timestamptz   NULL,
  removed_by           text          NULL,
  metadata             jsonb         NOT NULL DEFAULT '{}'::jsonb,

  CHECK (parent_brain_slug <> child_brain_slug),
  UNIQUE (parent_brain_slug, child_brain_slug, relationship)
);

CREATE INDEX IF NOT EXISTS ix_brain_deps_parent_active
  ON public.hammerex_nex_brain_dependencies (parent_brain_slug)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_brain_deps_child_active
  ON public.hammerex_nex_brain_dependencies (child_brain_slug)
  WHERE removed_at IS NULL;

ALTER TABLE public.hammerex_nex_brain_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brain_dependencies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_active" ON public.hammerex_nex_brain_dependencies
  FOR SELECT TO anon, authenticated
  USING (removed_at IS NULL);

COMMENT ON TABLE public.hammerex_nex_brain_dependencies IS
  'Living Trade Brains · Dependency DAG · ADR-0037 · brains reference brains';
