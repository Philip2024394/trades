-- XRatedTrade OS — Abuse Detection (Phase 1.5, gap 3/4).
--
-- Trade Circle graph value is 100% determined by trust. One publicised
-- gaming ring damages the whole network. This migration ships the
-- primitives for four abuse vectors we know exist:
--
--   1. Ring-of-friends reciprocity (closed clusters gaming visibility)
--   2. Sybil / sockpuppet businesses (same operator, multiple accounts)
--   3. Endorsement rate abuse (spam-endorsing to look connected)
--   4. Referral chain manipulation (fake banner-click chains)
--
-- Enforcement runs as scheduled jobs reading these tables. This
-- migration only creates the DB primitives + the ring/sybil report
-- tables the jobs write to. Detection queries + enforcement logic
-- live in server-side jobs, not in migrations.
--
-- Design principle: detection surfaces issues to human review, not to
-- automatic suspension. False positives on cluster centrality analysis
-- are certain. Governance action must be reviewable and reversible.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Sybil clusters — businesses suspected of shared operation
--
-- A cluster is created when two or more businesses share sensitive
-- signals (director, address, IP, payment method, WhatsApp number).
-- Row is created by scheduled job; human moderator reviews and either
-- confirms (marks businesses as linked, restricts self-endorsement)
-- or dismisses.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_sybil_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key text NOT NULL UNIQUE,        -- deterministic hash of member ids
  business_ids uuid[] NOT NULL,            -- members of the cluster
  member_count integer NOT NULL,

  -- Signals that formed the cluster
  signal_types text[] NOT NULL DEFAULT '{}',
    -- 'shared_director','shared_address','shared_ip','shared_payment',
    -- 'shared_whatsapp','shared_email_domain','shared_companies_house_officer'
  signal_details jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- structured evidence for review

  -- Review state
  status text NOT NULL DEFAULT 'detected'
    CHECK (status IN (
      'detected',                          -- job just found it
      'in_review',                         -- moderator looking
      'confirmed_linked',                  -- same operator, apply restrictions
      'dismissed_false_positive',          -- coincidence
      'confirmed_independent'              -- linked-but-independent (franchise)
    )),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Restrictions applied when confirmed
  restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- {"no_intra_cluster_endorsements": true,
    --  "no_intra_cluster_banner_promotion": true,
    --  "single_directory_slot": true}

  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_sybil_clusters_status_idx
  ON os_business_sybil_clusters (status, first_detected_at DESC);
CREATE INDEX IF NOT EXISTS os_business_sybil_clusters_members_idx
  ON os_business_sybil_clusters USING gin (business_ids);

-- ---------------------------------------------------------------------
-- 2. Sybil signals — raw evidence per business
--
-- Written by the detection job as it processes signals. Multiple rows
-- per business accumulate over time; cluster formation reads recent
-- signals + groups by shared identifiers.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_sybil_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,

  signal_type text NOT NULL
    CHECK (signal_type IN (
      'shared_director',
      'shared_registered_address',
      'shared_ip_at_signup',
      'shared_ip_recent',
      'shared_payment_fingerprint',
      'shared_whatsapp_number',
      'shared_email_domain',
      'shared_companies_house_officer',
      'shared_bank_account_masked'
    )),

  -- The hash of the shared value (never the value itself)
  signal_value_hash text NOT NULL,
  related_business_ids uuid[] NOT NULL DEFAULT '{}',

  observed_at timestamptz NOT NULL DEFAULT now(),
  detected_by text                          -- job name that emitted this
);

CREATE INDEX IF NOT EXISTS os_business_sybil_signals_business_idx
  ON os_business_sybil_signals (business_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS os_business_sybil_signals_hash_idx
  ON os_business_sybil_signals (signal_type, signal_value_hash);

-- ---------------------------------------------------------------------
-- 3. Endorsement ring reports — cluster centrality detection
--
-- Written by a scheduled job that computes centrality metrics over
-- os_business_endorsements. Flags clusters with high internal
-- reciprocity and low external referral ratio for human review.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_endorsement_ring_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_business_ids uuid[] NOT NULL,
  member_count integer NOT NULL,

  -- Structural metrics
  internal_edge_count integer NOT NULL,     -- edges among cluster members
  external_edge_count integer NOT NULL,     -- edges out of cluster
  internal_reciprocity_ratio numeric(5,4) NOT NULL,
    -- proportion of internal edges that are mutual
  external_referral_ratio numeric(5,4) NOT NULL,
    -- external_edge_count / (internal + external)
  suspicion_score numeric(5,4) NOT NULL,
    -- composite score derived from above; higher = more suspicious

  -- Review
  status text NOT NULL DEFAULT 'detected'
    CHECK (status IN (
      'detected',
      'in_review',
      'confirmed_healthy',                  -- real local network, dismiss
      'confirmed_ring',                     -- gaming, apply weight penalty
      'action_taken'                        -- edges downweighted / hidden
    )),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  action_applied jsonb,
    -- {"edge_weight_multiplier": 0.3, "hide_from_auto_populate": true}

  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_endorsement_ring_reports_status_idx
  ON os_endorsement_ring_reports (status, suspicion_score DESC);
CREATE INDEX IF NOT EXISTS os_endorsement_ring_reports_members_idx
  ON os_endorsement_ring_reports USING gin (cluster_business_ids);

-- ---------------------------------------------------------------------
-- 4. Rate limit windows — enforcement primitive
--
-- Every rate-limited action (endorsement create, invite send, banner
-- toggle) writes to this table. Server routes count rows within the
-- window to decide whether to allow the next action.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL
    CHECK (actor_type IN ('business','party','ip','session')),
  actor_key text NOT NULL,                 -- business_id / party_id / ip_hash / session_id

  action text NOT NULL
    CHECK (action IN (
      'endorsement.create',
      'endorsement.remove',
      'invite.send',
      'reciprocity.reciprocate',
      'banner.toggle',
      'ecosystem_participation.toggle',
      'business.report',
      'business.claim',
      'search.query'
    )),

  window_key text NOT NULL,                -- 'session', '5m', '1h', '24h', '30d'
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS os_rate_limit_events_actor_action_time_idx
  ON os_rate_limit_events (actor_type, actor_key, action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS os_rate_limit_events_action_time_idx
  ON os_rate_limit_events (action, occurred_at DESC);

-- ---------------------------------------------------------------------
-- 5. Governance actions — moderator + automated actions taken
--
-- Anything the platform does to restrict, remove, or downweight a
-- business or edge writes here. Regulator-visible. Reversible.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_governance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  target_type text NOT NULL
    CHECK (target_type IN (
      'business',
      'endorsement',
      'invite',
      'banner',
      'party',
      'cluster'
    )),
  target_id uuid NOT NULL,

  action text NOT NULL
    CHECK (action IN (
      'warn',
      'downweight',
      'hide_from_display',
      'hide_from_auto_populate',
      'suspend',
      'ban',
      'require_reverification',
      'remove_content',
      'restore',
      'reinstate',
      'note_only'
    )),

  -- Justification
  reason_code text NOT NULL,               -- 'sybil_confirmed', 'ring_confirmed',
                                            -- 'ttos_violation', 'legal_request', ...
  reason_notes text,
  linked_report_id uuid,                   -- to sybil_cluster / ring_report / erasure_request
  linked_report_type text,

  -- Who + when
  actor_type text NOT NULL
    CHECK (actor_type IN ('moderator','automated_job','regulator','system')),
  actor_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),

  -- Reversal
  reversed_at timestamptz,
  reversed_by uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  reversal_reason text,

  -- Structured effect data
  effect jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- action-specific payload, e.g. {"downweight_multiplier": 0.3, "duration_days": 90}

  expires_at timestamptz                   -- auto-reversal timestamp if set
);

CREATE INDEX IF NOT EXISTS os_governance_actions_target_idx
  ON os_governance_actions (target_type, target_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS os_governance_actions_actor_idx
  ON os_governance_actions (actor_type, actor_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS os_governance_actions_active_idx
  ON os_governance_actions (target_type, target_id)
  WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS os_governance_actions_expires_idx
  ON os_governance_actions (expires_at)
  WHERE expires_at IS NOT NULL AND reversed_at IS NULL;

-- ---------------------------------------------------------------------
-- 6. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_business_sybil_clusters',
      'os_endorsement_ring_reports'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch_%I ON %I;', t, 'last_updated', t);
  END LOOP;
END $$;

-- These tables use custom last_updated / last_evaluated_at columns
-- rather than the generic updated_at pattern, since detection jobs
-- write to them, not user actions. Update semantics handled by
-- server-side helpers.

-- ---------------------------------------------------------------------
-- 7. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_business_sybil_clusters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_sybil_signals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_endorsement_ring_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_rate_limit_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_governance_actions        ENABLE ROW LEVEL SECURITY;

COMMIT;
