-- NEX Managed Email Marketing · Stage 5.5 · AUTO Lane Integration
-- Founder-authorised programme (three-lane operating doctrine · §10-§14).
--
-- Smallest durable primitive required for AUTO policy enforcement (§12).
-- No campaign schema redesign · reuses nex.marketing_campaign with metadata.lane='auto'.
-- No new executor · reuses shared send-executor with lane-routing branch.

BEGIN;

-- ─── AUTO campaign policy · smallest primitive required by §12 ────────
CREATE TABLE IF NOT EXISTS nex.marketing_auto_policy (
  policy_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name           TEXT NOT NULL,
  country                TEXT NOT NULL,               -- ISO-3166-1 alpha-2 · must be recognised by eligibility rule set
  category               TEXT,                        -- category_slug filter (optional)
  language               TEXT,                        -- language filter (optional)
  min_contact_confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (min_contact_confidence >= 0 AND min_contact_confidence <= 1),
  max_daily_sends        INTEGER NOT NULL DEFAULT 100 CHECK (max_daily_sends > 0),
  budget_id              UUID NOT NULL REFERENCES nex.marketing_operating_budget(budget_id) ON DELETE RESTRICT,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  approved_content_hash  TEXT,                        -- present when a content review record exists · nullable
  last_activated_at      TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_auto_policy_active
  ON nex.marketing_auto_policy (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ix_auto_policy_country_category
  ON nex.marketing_auto_policy (country, category);

-- ─── Idempotency lookup by auto_idempotency_key (search key in metadata) ─
-- Speeds up createAutoCampaign() replay-detection query.
CREATE INDEX IF NOT EXISTS ix_campaign_auto_idempotency
  ON nex.marketing_campaign ((metadata->>'auto_idempotency_key'))
  WHERE metadata->>'auto_idempotency_key' IS NOT NULL;

-- ─── Fast lane-scoped campaign lookup ────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_campaign_lane
  ON nex.marketing_campaign ((metadata->>'lane'));

COMMIT;
