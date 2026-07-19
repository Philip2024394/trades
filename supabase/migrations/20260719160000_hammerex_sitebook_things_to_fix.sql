-- SiteBook Things to fix — homeowner-friendly snagging system.
-- Phase 1 · Blueprint v2.2 (2026-07-19).
--
-- Rename of "snagging" (trade jargon) — homeowners say "things to fix".
-- Each row is one issue: a photo + one line. Assigned optionally to a
-- trade for resolution. Marked fixed when the trade posts a proof
-- photo OR the homeowner manually confirms.
--
-- Lifecycle:
--   open        — captured, waiting to be assigned or resolved
--   in_progress — trade acknowledged, on the list
--   fixed       — resolved, awaiting homeowner sign-off
--   confirmed   — homeowner signed off, done
--   dismissed   — not a real issue after all

CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_things_to_fix (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id            UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  project_id              UUID          REFERENCES public.hammerex_sitebook_projects(id) ON DELETE SET NULL,

  title                   TEXT          NOT NULL,          -- one-line description
  photo_url               TEXT,                             -- Supabase storage URL

  -- Which trade the homeowner has asked to sort it
  assignee_listing_id     UUID,
  assignee_name           TEXT,

  status                  TEXT          NOT NULL DEFAULT 'open',
  -- ^ open | in_progress | fixed | confirmed | dismissed

  -- Optional links to the post it was raised from
  post_id                 UUID          REFERENCES public.hammerex_sitebook_posts(id) ON DELETE SET NULL,

  -- When the trade posted a proof photo (or homeowner uploaded one)
  fixed_photo_url         TEXT,
  fixed_at                TIMESTAMPTZ,
  confirmed_at            TIMESTAMPTZ,
  dismissed_at            TIMESTAMPTZ,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ttf_homeowner
  ON public.hammerex_sitebook_things_to_fix (homeowner_id, status);
CREATE INDEX IF NOT EXISTS idx_ttf_project
  ON public.hammerex_sitebook_things_to_fix (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ttf_assignee
  ON public.hammerex_sitebook_things_to_fix (assignee_listing_id) WHERE assignee_listing_id IS NOT NULL;

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_ttf_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ttf_touch ON public.hammerex_sitebook_things_to_fix;
CREATE TRIGGER trg_ttf_touch
  BEFORE UPDATE ON public.hammerex_sitebook_things_to_fix
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_ttf_touch();

ALTER TABLE public.hammerex_sitebook_things_to_fix ENABLE ROW LEVEL SECURITY;
