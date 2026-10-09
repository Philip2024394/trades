-- NEX Managed Email Marketing · Stage 4 · marketing_campaign.metadata column
-- Founder-authorised programme.
--
-- Adds the JSONB `metadata` column that Stage 4 (member campaigns), the
-- Founder Control Centre, and Stage 5.5 AUTO lane routing all depend on.
-- Historically added by the Stage 4 wave but not captured as a durable
-- migration file · now materialised so it can be applied deterministically.
--
-- Additive · backward-compatible · idempotent.

BEGIN;

ALTER TABLE nex.marketing_campaign
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Stage 4 also introduced these lifecycle columns · add-if-missing
ALTER TABLE nex.marketing_campaign
  ADD COLUMN IF NOT EXISTS opened_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complained_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsubscribed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

-- Fast lookup for Stage 5.5 lane-scoped queries + Founder Control Centre.
CREATE INDEX IF NOT EXISTS ix_campaign_metadata_lane
  ON nex.marketing_campaign ((metadata->>'lane'));

CREATE INDEX IF NOT EXISTS ix_campaign_metadata_member
  ON nex.marketing_campaign ((metadata->>'member_id'));

COMMIT;
