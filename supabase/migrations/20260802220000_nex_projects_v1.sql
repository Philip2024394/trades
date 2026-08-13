-- Nex Projects · v1 migration · Philip 2026-08-02.
--
-- This migration lives in the trades repo's migrations folder for source-
-- control convenience but MUST be applied to the DEDICATED NEX SUPABASE
-- PROJECT (ijvqdvsvwtwxzcqmoqit), NOT the trades/hammerex project. Apply
-- manually via the Supabase SQL editor for the Nex project.
--
-- Ownership model: v1 is pre-auth. Each browser generates a random UUID
-- (session_id) stored in localStorage. Every row carries that session_id
-- and all reads/writes filter server-side by it. When real auth lands
-- (v2.5), an `owner_user_id` column joins the session_id and a migration
-- backfills. RLS is deliberately deferred to v2.5 — v1 relies on server-
-- side enforcement via the /api/nex/projects/* routes.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.nex_projects_messages;
--   DROP TABLE IF EXISTS public.nex_projects;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Projects ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_projects (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner (session-scoped in v1 · user-scoped in v2.5)
  session_id             text        NOT NULL,
  owner_user_id          uuid        NULL,

  -- Merchant snapshot at creation time (denormalised for offline reads)
  merchant_id            text        NOT NULL,
  merchant_name          text        NOT NULL,
  merchant_avatar_url    text        NULL,

  -- Project shape
  title                  text        NOT NULL,
  -- Philip 2026-08-02 · single-line project purpose. Nullable · auto-
  -- composed on create when possible (intent-based for chip flows · first
  -- customer message for free-text flows) · editable later. Every future
  -- AI action should reference this to stop conversations drifting.
  purpose                text        NULL,
  status                 text        NOT NULL DEFAULT 'waiting_for_quotation'
    CHECK (status IN (
      'planning',
      'waiting_for_quotation',
      'quotation_received',
      'agreed',
      'in_progress',
      'completed',
      'reviewed'
    )),
  intent                 text        NULL
    CHECK (intent IS NULL OR intent IN ('quote','survey','question','order','advice')),
  conversation_id        text        NULL,

  -- Members payload (array of {role,display_name,merchant_id?,avatar_url?})
  members                jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_projects_session_updated
  ON public.nex_projects (session_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_projects_session_merchant_status
  ON public.nex_projects (session_id, merchant_id, status);

-- ─── Project messages ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_projects_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES public.nex_projects(id) ON DELETE CASCADE,
  role         text        NOT NULL
    CHECK (role IN ('customer','nex','merchant')),
  text         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_projects_messages_project_created
  ON public.nex_projects_messages (project_id, created_at);

-- ─── updated_at trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.nex_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nex_projects_touch_updated ON public.nex_projects;
CREATE TRIGGER nex_projects_touch_updated
BEFORE UPDATE ON public.nex_projects
FOR EACH ROW
EXECUTE FUNCTION public.nex_touch_updated_at();

-- Bump the parent project's updated_at whenever a new message lands so
-- the Projects list can order by "most recent activity" without extra
-- joins in the read path.
CREATE OR REPLACE FUNCTION public.nex_projects_touch_from_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.nex_projects
  SET updated_at = now()
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nex_projects_messages_touch_parent ON public.nex_projects_messages;
CREATE TRIGGER nex_projects_messages_touch_parent
AFTER INSERT ON public.nex_projects_messages
FOR EACH ROW
EXECUTE FUNCTION public.nex_projects_touch_from_message();

-- ─── RLS policy ────────────────────────────────────────────────────────
--
-- v1 · RLS DISABLED. All access is via server-side /api/nex/projects/*
-- routes that filter by session_id. When real auth lands (v2.5), RLS is
-- turned on with a policy that reads auth.uid() and joins to owner_user_id.
--
-- ALTER TABLE public.nex_projects        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nex_projects_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.nex_projects IS
  'Nex Project Object v1 · one row per customer↔merchant project. Philip 2026-08-02.';
COMMENT ON TABLE public.nex_projects_messages IS
  'Nex Project message thread · one row per turn. Philip 2026-08-02.';
