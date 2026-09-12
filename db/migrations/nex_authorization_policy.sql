-- Founder 2026-09-10 · Authorization Policy · FOUNDATIONAL.
--
-- Governance principle (verbatim from founder):
--   "FOUNDER SETS THE RULES · NEX OPERATES WITHIN THE RULES ·
--    THE LAB SHOWS EVERYTHING · HIGH-RISK ACTIONS REQUIRE THE FOUNDER."
--
-- The HMAC system does NOT sign every record. It signs POLICIES.
-- A policy authorizes an agent class to perform an action kind under
-- explicit conditions and rate limits. Once authorized, NEX operates
-- autonomously within the policy — every action records the policy_id
-- that authorized it. The founder revokes the policy to stop autonomy.
--
-- Level 3 actions (external communication, spending, permanent deletion,
-- production deployment, security/policy changes) MUST run under an
-- active, non-expired, non-revoked authorization_policy. No policy →
-- no action. Ever.

CREATE TABLE IF NOT EXISTS nex.authorization_policy (
  policy_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   TEXT NOT NULL UNIQUE, -- 'marketing-send-indonesia-accommodation-invite'
  display_name           TEXT NOT NULL,
  description            TEXT NOT NULL,
  -- Which subsystem this policy governs
  subsystem              TEXT NOT NULL, -- 'marketing_email' | 'lab_promotion' | 'programmer' | 'external_api' | 'spending' | 'account_creation'
  -- Which agent class(es) can invoke this policy
  agent_class            TEXT NOT NULL, -- 'marketing_sender' | 'lab_promoter_accommodation' | 'lab_promoter_food' | 'programmer' etc
  -- What action kind the policy allows
  action_kind            TEXT NOT NULL, -- 'send_email' | 'promote_verified_record' | 'execute_repair' | 'call_external_api' | 'charge_stripe'
  -- Level (1 = autonomous, 2 = notify-only, 3 = founder-authorization-required)
  action_level           SMALLINT NOT NULL CHECK (action_level IN (1, 2, 3)),
  -- Conditions the policy imposes (JSONB) · agent MUST verify these before acting
  -- Example: {"segment_filter": {"country":"ID","category":"accommodation"},
  --           "template_slug":"welcome-invite-2026-09",
  --           "consent_required":"discovered_or_stronger",
  --           "quality_score_min":0.7}
  conditions             JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Rate limits · autonomy caps
  max_actions_per_hour   INTEGER,
  max_actions_per_day    INTEGER,
  max_actions_total      INTEGER, -- lifetime cap (NULL = no cap)
  -- Authorization
  authorized_by_user_id  TEXT NOT NULL,
  authorized_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  authorized_via         TEXT NOT NULL, -- 'founder_ui' | 'cli_hmac' | 'admin_migration'
  authorization_hmac     TEXT NOT NULL, -- HMAC-SHA256 signature of the policy blob
  -- Lifecycle
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at             TIMESTAMPTZ,
  revoked_at             TIMESTAMPTZ,
  revoked_by             TEXT,
  revocation_reason      TEXT,
  -- Observability
  action_count           BIGINT NOT NULL DEFAULT 0,
  last_action_at         TIMESTAMPTZ,
  action_count_last_hour INTEGER NOT NULL DEFAULT 0,
  action_count_last_day  INTEGER NOT NULL DEFAULT 0,
  hourly_bucket          TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  daily_bucket           DATE NOT NULL DEFAULT current_date
);

CREATE INDEX IF NOT EXISTS ix_policy_active
  ON nex.authorization_policy (subsystem, agent_class, action_kind)
  WHERE active = TRUE AND revoked_at IS NULL;

-- Immutable per-action log · every autonomous action recorded with policy trace
CREATE TABLE IF NOT EXISTS nex.authorized_action (
  action_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id              UUID NOT NULL REFERENCES nex.authorization_policy(policy_id),
  agent_id               TEXT NOT NULL, -- which agent instance did this
  action_kind            TEXT NOT NULL,
  target_ref             TEXT, -- e.g. contact email hash / record dedupe_hash / URL
  target_summary         TEXT, -- human-readable summary for audit
  evidence               JSONB, -- what the agent used to justify this
  executed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  result                 TEXT NOT NULL CHECK (result IN ('ok', 'skipped', 'failed', 'suppressed')),
  result_detail          TEXT,
  request_id             UUID -- cross-request tracing
);

CREATE INDEX IF NOT EXISTS ix_authorized_action_policy ON nex.authorized_action (policy_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS ix_authorized_action_target ON nex.authorized_action (target_ref, executed_at DESC) WHERE target_ref IS NOT NULL;

-- Pending Level 3 actions · anything the agent CAN'T do autonomously
-- lands here awaiting founder click. Never bypassed.
CREATE TABLE IF NOT EXISTS nex.pending_level3_action (
  pending_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent_id               TEXT NOT NULL,
  action_kind            TEXT NOT NULL,
  subsystem              TEXT NOT NULL,
  target_ref             TEXT,
  proposed_by            TEXT NOT NULL,
  justification          TEXT NOT NULL,
  evidence               JSONB,
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'authorized', 'rejected', 'cancelled', 'expired')),
  resolved_at            TIMESTAMPTZ,
  resolved_by            TEXT,
  resolution_reason      TEXT,
  authorized_policy_id   UUID REFERENCES nex.authorization_policy(policy_id)
);

CREATE INDEX IF NOT EXISTS ix_pending_l3_open
  ON nex.pending_level3_action (proposed_at DESC)
  WHERE status = 'pending';
