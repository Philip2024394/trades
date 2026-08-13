-- Nex Themes · v1 migration · Philip 2026-08-03.
--
-- Applies to the DEDICATED NEX SUPABASE PROJECT (ijvqdvsvwtwxzcqmoqit),
-- NOT the trades/hammerex project. Apply manually via the Supabase SQL
-- editor for the Nex project.
--
-- SCOPE (v1):
--   · nex_themes_active     — the theme (+ optional variant) currently applied for a session
--   · nex_themes_ownership  — themes this session/user has acquired (built-in / purchase / etc.)
--   · nex_themes_previews   — 24-hour previews (Six Sharpening Rules #4)
--   · nex_themes_saved      — user's saved library (future UX · "Saved Themes")
--   · nex_themes_history    — audit trail of every theme change
--
-- OUT OF SCOPE (later migrations):
--   · nex_themes_generated  — AI-generated theme storage (arrives with AI Theme Engine)
--   · nex_themes_business   — business-branded themes
--   · nex_themes_community  — community-published themes
--
-- Built-in themes (Original Nex · Blossom · Staircase Light Cream) live
-- in code (src/lib/nex/themes/registry.ts) as versioned artefacts. The
-- DB stores per-user state ABOUT those themes, not the themes themselves.
--
-- Ownership model: v1 is pre-auth. session_id (localStorage UUID) is
-- the primary owner. owner_user_id is prepared for v2.5 auth.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.nex_themes_history;
--   DROP TABLE IF EXISTS public.nex_themes_saved;
--   DROP TABLE IF EXISTS public.nex_themes_previews;
--   DROP TABLE IF EXISTS public.nex_themes_ownership;
--   DROP TABLE IF EXISTS public.nex_themes_active;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Active theme (one row per session) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_themes_active (
  session_id     text        PRIMARY KEY,
  owner_user_id  uuid        NULL,

  theme_id       text        NOT NULL,
  variant_id     text        NULL,

  -- Where the current apply CAME from — supports the Restore rule
  -- (returns to last permanent theme · previews never count as permanent).
  source         text        NOT NULL DEFAULT 'user_choice'
    CHECK (source IN ('user_choice','preview_grant','reset','system_fallback')),

  applied_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_themes_active_updated
  ON public.nex_themes_active (updated_at DESC);

-- ─── Ownership (lifetime purchases · account-scoped) ─────────────────

CREATE TABLE IF NOT EXISTS public.nex_themes_ownership (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     text        NOT NULL,
  owner_user_id  uuid        NULL,

  theme_id       text        NOT NULL,

  source         text        NOT NULL DEFAULT 'built-in'
    CHECK (source IN ('built-in','purchase','subscription','preview_converted','gift')),

  -- Discontinuation-guarantee (Six Sharpening Rules #1): discontinued
  -- themes stay usable for existing owners. This flag records ownership
  -- at the moment of acquisition · never expires.
  acquired_at    timestamptz NOT NULL DEFAULT now(),

  -- Optional link back to the purchase / subscription / gift event.
  provenance     jsonb       NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (session_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_nex_themes_ownership_session
  ON public.nex_themes_ownership (session_id, acquired_at DESC);

-- ─── Previews (24-hour grace · Six Sharpening Rules #4) ─────────────

CREATE TABLE IF NOT EXISTS public.nex_themes_previews (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     text        NOT NULL,
  owner_user_id  uuid        NULL,

  theme_id       text        NOT NULL,
  variant_id     text        NULL,

  granted_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,

  -- Outcome enum (Six Sharpening Rules #4 · verbatim state model):
  --   active               — preview is live · still inside the 24h window
  --   unlocked             — user converted to permanent ownership
  --   restored             — user chose to return to their last permanent theme
  --   explored_another     — user requested a different preview instead
  --   dismissed            — expired without user action (offline-grace applied)
  outcome        text        NOT NULL DEFAULT 'active'
    CHECK (outcome IN ('active','unlocked','restored','explored_another','dismissed')),

  session_expired_prompt_shown_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_nex_themes_previews_session_active
  ON public.nex_themes_previews (session_id, outcome, expires_at DESC);

-- Concurrency rule (Six Sharpening Rules #4): only ONE active preview
-- at a time per session. Enforced by a partial unique index rather than
-- an application-layer check so the DB can never disagree.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_themes_previews_session_one_active
  ON public.nex_themes_previews (session_id)
  WHERE outcome = 'active';

-- ─── Saved themes library (future UX) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_themes_saved (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     text        NOT NULL,
  owner_user_id  uuid        NULL,

  theme_id       text        NOT NULL,
  display_name   text        NOT NULL,
  icon           text        NULL, -- emoji or icon slug for the Saved Themes list

  is_pinned      boolean     NOT NULL DEFAULT false,
  saved_at       timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz NULL,

  UNIQUE (session_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_nex_themes_saved_session_last_used
  ON public.nex_themes_saved (session_id, is_pinned DESC, last_used_at DESC NULLS LAST);

-- ─── History / audit trail ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_themes_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     text        NOT NULL,
  owner_user_id  uuid        NULL,

  from_theme_id  text        NULL,
  to_theme_id    text        NOT NULL,
  from_variant_id text       NULL,
  to_variant_id  text        NULL,

  -- Every theme change records the source so we can trace Restore
  -- behaviour and detect abuse patterns (e.g. rapid preview-flip).
  source         text        NOT NULL
    CHECK (source IN ('user_choice','preview_grant','reset','system_fallback','modification')),

  -- Free-form context (validator report · intent phrase · etc.) but no
  -- PII by convention. Enforced by ADR rather than schema.
  context        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  changed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_themes_history_session_changed
  ON public.nex_themes_history (session_id, changed_at DESC);

-- ─── updated_at trigger ──────────────────────────────────────────────
-- Re-uses the nex_touch_updated_at() function from the Projects
-- migration if it already exists; creates it defensively otherwise so
-- this migration can be applied standalone.

CREATE OR REPLACE FUNCTION public.nex_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nex_themes_active_touch_updated ON public.nex_themes_active;
CREATE TRIGGER nex_themes_active_touch_updated
BEFORE UPDATE ON public.nex_themes_active
FOR EACH ROW
EXECUTE FUNCTION public.nex_touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────
--
-- v1 · RLS DISABLED · every read/write is server-side via /api/nex/themes/*
-- with session_id filtering. When v2.5 auth arrives, enable RLS with
-- policies keyed on auth.uid() = owner_user_id.
--
-- ALTER TABLE public.nex_themes_active     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nex_themes_ownership  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nex_themes_previews   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nex_themes_saved      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nex_themes_history    ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.nex_themes_active IS
  'Nex Theme Engine v1 · current applied theme per session. Philip 2026-08-03.';
COMMENT ON TABLE public.nex_themes_ownership IS
  'Nex Theme Engine v1 · lifetime ownership · account-scoped. Philip 2026-08-03.';
COMMENT ON TABLE public.nex_themes_previews IS
  'Nex Theme Engine v1 · 24h preview grants · one active per session. Philip 2026-08-03.';
COMMENT ON TABLE public.nex_themes_saved IS
  'Nex Theme Engine v1 · user Saved Themes library. Philip 2026-08-03.';
COMMENT ON TABLE public.nex_themes_history IS
  'Nex Theme Engine v1 · every theme change · audit trail. Philip 2026-08-03.';
