-- 20260728100300_nex_brain_drafts.sql
-- Living Trade Brains · Draft Workspace · ADR-0037
--
-- Mutable per-brain-per-author working copy. Authors edit here. Drafts
-- never affect production. Publish promotes a draft to an immutable
-- hammerex_nex_brain_versions row and clears the draft.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_drafts (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug        text          NOT NULL
                                  REFERENCES public.hammerex_nex_brains(slug)
                                  ON DELETE CASCADE,
  author_id         text          NOT NULL,
  based_on_version_id uuid        NULL
                                  REFERENCES public.hammerex_nex_brain_versions(id)
                                  ON DELETE SET NULL,
  -- draft started from this base version (for diff computation)
  proposed_semver   text          NULL,
  -- e.g. "1.1.0" · what the author wants to bump to on publish
  manifest_json     jsonb         NOT NULL,
  modules_json      jsonb         NOT NULL,
  -- keyed by module name (craft · regulations · materials · workflow ·
  -- defects · pricing_model · plus any V2 modules)
  status            text          NOT NULL DEFAULT 'editing',
  -- editing · submitted_for_review · changes_requested · approved · rejected
  submitted_at      timestamptz   NULL,
  reviewed_at       timestamptz   NULL,
  reviewed_by       text          NULL,
  review_notes      text          NULL,
  metadata          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (brain_slug, author_id)
);

CREATE INDEX IF NOT EXISTS ix_brain_drafts_status
  ON public.hammerex_nex_brain_drafts (status, submitted_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS ix_brain_drafts_author
  ON public.hammerex_nex_brain_drafts (author_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_brain_drafts_slug
  ON public.hammerex_nex_brain_drafts (brain_slug, updated_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_brain_drafts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brain_drafts_touch_updated_at
  BEFORE UPDATE ON public.hammerex_nex_brain_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_brain_drafts_updated_at();

ALTER TABLE public.hammerex_nex_brain_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brain_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Author sees + edits own drafts only (ADR-0021 memory privacy pattern).
CREATE POLICY "author_own_drafts" ON public.hammerex_nex_brain_drafts
  FOR SELECT TO authenticated
  USING (author_id = auth.uid()::text OR author_id = (auth.jwt() ->> 'email'));

COMMENT ON TABLE public.hammerex_nex_brain_drafts IS
  'Living Trade Brains · Mutable per-author draft workspace · ADR-0037';
