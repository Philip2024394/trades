-- 20260728100800_nex_brain_review_actions.sql
-- Living Trade Brains · Review Actions · ADR-0037
--
-- One row per action a reviewer takes on a draft: approve, reject,
-- request_changes, comment. Enables the review queue UI + audit
-- trail of every review decision.
--
-- Reject and approve both propagate an event to hammerex_nex_events.
-- This table is the durable per-draft trail; events are the cross-
-- domain audit log.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_review_actions (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug     text          NOT NULL
                               REFERENCES public.hammerex_nex_brains(slug)
                               ON DELETE RESTRICT,
  draft_id       uuid          NULL
                               REFERENCES public.hammerex_nex_brain_drafts(id)
                               ON DELETE SET NULL,
  -- Draft ID nullable because drafts can be deleted after publish
  -- (though ADR-0037 says nothing is truly deleted — draft rows are
  -- retained but their content becomes historical after publish)
  action         text          NOT NULL,
  -- approve · reject · request_changes · comment · assign · reassign
  reviewer_id    text          NOT NULL,
  reviewer_role  text          NOT NULL DEFAULT 'admin',
  -- admin · advisory_panel · peer_author · automated_regression
  notes          text          NULL,
  -- rationale · reject reason · requested changes text
  ref_version_id uuid          NULL
                               REFERENCES public.hammerex_nex_brain_versions(id)
                               ON DELETE SET NULL,
  -- if the action approves + publishes a draft as a new version,
  -- this points at the resulting immutable version row
  occurred_at    timestamptz   NOT NULL DEFAULT now(),
  metadata       jsonb         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_brain_review_actions_brain
  ON public.hammerex_nex_brain_review_actions (brain_slug, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_brain_review_actions_draft
  ON public.hammerex_nex_brain_review_actions (draft_id, occurred_at DESC)
  WHERE draft_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_brain_review_actions_reviewer
  ON public.hammerex_nex_brain_review_actions (reviewer_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_brain_review_actions_action
  ON public.hammerex_nex_brain_review_actions (action, occurred_at DESC);

ALTER TABLE public.hammerex_nex_brain_review_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brain_review_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_all" ON public.hammerex_nex_brain_review_actions
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.hammerex_nex_brain_review_actions IS
  'Living Trade Brains · Review Actions · ADR-0037 · per-draft reviewer decisions';
