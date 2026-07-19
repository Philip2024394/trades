-- SiteBook App Store — per-homeowner installed apps.
-- Phase 2 · Blueprint v2.2 (2026-07-19).
--
-- SiteBook has three tiers of surfaces:
--   1. Core (never removable) — Feed / Composer / Trades / Profile
--   2. Default-installed — Photo Library (universal value)
--   3. App Store — everything else (Cost, Ledger, Docs, Home Care, etc.)
--
-- This table tracks which App Store items each homeowner has
-- installed. A missing row = un-installed = tile not rendered.
-- Existing data (costs, photos, warranties, snags) survives an
-- un-install; re-installing brings the tile back with settings intact.

CREATE TABLE IF NOT EXISTS public.hammerex_homeowner_apps (
  homeowner_id   UUID NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  app_slug       TEXT NOT NULL,
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings       JSONB,                       -- per-app UI prefs (rail order, colours, cadence overrides)
  PRIMARY KEY (homeowner_id, app_slug)
);

CREATE INDEX IF NOT EXISTS idx_homeowner_apps_slug
  ON public.hammerex_homeowner_apps (app_slug);

ALTER TABLE public.hammerex_homeowner_apps ENABLE ROW LEVEL SECURITY;
-- Service-role only; access enforced via API layer + homeowner cookie.
