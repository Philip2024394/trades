-- 20260728100000_nex_events.sql
-- Generic append-only event log · ADR-0037 · Living Trade Brains
--
-- Reusable across every Nex domain (Trade Brains, Projects, CRM,
-- Marketplace, Digital Twin, Memory). Every mutation to a Living
-- surface writes a row here.
--
-- Never mutated. Never deleted. The Trust Ledger + audit history +
-- rollback trail are all queries over this one table.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_events (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text          NOT NULL,
  -- e.g. brain_draft_saved · brain_submitted_for_review · brain_approved
  --      · brain_rejected · brain_published · brain_rolled_back
  --      · brain_dependency_added · brain_certification_renewed
  entity_type   text          NOT NULL,
  -- brain · brain_draft · brain_version · brain_dependency
  -- brain_certification · project · twin · crm_contact · marketplace_listing
  entity_id     text          NOT NULL,
  -- primary key of the entity (uuid or slug)
  actor_id      text          NULL,
  -- who caused the event (author uuid · admin email · system)
  actor_role    text          NULL,
  -- author · reviewer · admin · system · runtime
  before_json   jsonb         NULL,
  -- entity state before the event (for diffable mutations)
  after_json    jsonb         NULL,
  -- entity state after the event
  metadata      jsonb         NULL DEFAULT '{}'::jsonb,
  -- free-form context (rationale · reject_reason · target_version_id · etc.)
  occurred_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_nex_events_entity
  ON public.hammerex_nex_events (entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_nex_events_event_type
  ON public.hammerex_nex_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_nex_events_actor
  ON public.hammerex_nex_events (actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_nex_events_occurred_at
  ON public.hammerex_nex_events (occurred_at DESC);

ALTER TABLE public.hammerex_nex_events ENABLE ROW LEVEL SECURITY;

-- Service role writes everything · authenticated reads events for
-- entities they own (enforced at query layer per-domain — this table
-- is generic).
CREATE POLICY "service_role_all" ON public.hammerex_nex_events
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_all" ON public.hammerex_nex_events
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.hammerex_nex_events IS
  'Generic append-only event log · ADR-0037 · reusable across every Nex domain. Never mutated. Never deleted.';
