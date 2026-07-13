-- XRatedTrade OS — Trade Circle (V2 Ecosystem Foundation, part 3/5).
--
-- Trade Circle is the merchant-to-merchant recommendation graph. Every
-- business can publicly recommend other businesses, and those
-- recommendations become the substrate for the future Verified
-- Property-Trade Graph.
--
-- Four object types:
--   os_business_endorsements           — the edges (A recommends B)
--   os_business_endorsement_categories — merchant-owned category labels
--   os_business_endorsement_invites    — invite-to-paid flow
--   os_business_reciprocity_prompts    — mutual-endorsement prompts
--
-- Auto-populated Trade Circle rendering (nearest paid businesses of
-- complementary trades, daily-seeded random rotation) is NOT stored —
-- computed at query time in the application layer. Only curated /
-- reciprocal / invited edges accumulate as first-class rows.
--
-- Every edge column includes evolution slots (endorsement_type, weight,
-- decay_state, evidence_job_ids, visibility) with safe defaults so V3
-- graph work turns them on without any schema migration.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Endorsement categories — merchant-owned labels
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_endorsement_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  label text NOT NULL,                      -- "Electricians", "Kitchen Fitters"
  display_order integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  seeded boolean NOT NULL DEFAULT false,    -- auto-created from business_type
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_endorsement_categories_business_idx
  ON os_business_endorsement_categories (business_id, display_order)
  WHERE hidden = false;

-- ---------------------------------------------------------------------
-- 2. Endorsement edges — the graph
--
-- source semantics:
--   'curated'    → merchant manually added another business
--   'reciprocal' → created via reciprocity prompt (mutual endorsement)
--   'invited'    → created when an invited business signed up on paid
--
-- Evolution slots (endorsement_type, weight, evidence_job_ids,
-- decay_state, visibility, commercial_relationship_declared,
-- declaration_text) are V3 primitives shipped with safe defaults.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_business_id uuid NOT NULL
    REFERENCES os_business_listings(id) ON DELETE CASCADE,
  endorsed_business_id uuid NOT NULL
    REFERENCES os_business_listings(id) ON DELETE CASCADE,
  category_id uuid
    REFERENCES os_business_endorsement_categories(id) ON DELETE SET NULL,

  -- Provenance
  source text NOT NULL DEFAULT 'curated'
    CHECK (source IN ('curated','reciprocal','invited')),
  reciprocal_edge_id uuid,                  -- self-ref when source=reciprocal
  invite_id uuid,                           -- FK added after invites table below
  created_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  -- Display state
  display_order integer NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,

  -- V3 evolution slots — populated later, safe defaults now
  endorsement_type text NOT NULL DEFAULT 'nominated'
    CHECK (endorsement_type IN ('nominated','certified','job_verified')),
  weight numeric(5,3) NOT NULL DEFAULT 1.000,
  evidence_job_ids uuid[] NOT NULL DEFAULT '{}',
  decay_state text NOT NULL DEFAULT 'fresh'
    CHECK (decay_state IN ('fresh','decaying','stale','expired')),
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','homeowner_only','private')),
  commercial_relationship_declared boolean NOT NULL DEFAULT false,
  declaration_text text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- No self-endorsement
  CONSTRAINT os_business_endorsements_no_self
    CHECK (endorser_business_id <> endorsed_business_id),
  -- No duplicate edge within same category
  CONSTRAINT os_business_endorsements_unique
    UNIQUE (endorser_business_id, endorsed_business_id, category_id)
);

-- Self-ref FK for reciprocal — added after the table so the reference exists
ALTER TABLE os_business_endorsements
  DROP CONSTRAINT IF EXISTS os_business_endorsements_reciprocal_fk;
ALTER TABLE os_business_endorsements
  ADD CONSTRAINT os_business_endorsements_reciprocal_fk
  FOREIGN KEY (reciprocal_edge_id) REFERENCES os_business_endorsements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS os_business_endorsements_endorser_idx
  ON os_business_endorsements (endorser_business_id, display_order)
  WHERE hidden = false;
CREATE INDEX IF NOT EXISTS os_business_endorsements_endorsed_idx
  ON os_business_endorsements (endorsed_business_id)
  WHERE hidden = false;
CREATE INDEX IF NOT EXISTS os_business_endorsements_source_idx
  ON os_business_endorsements (source);
CREATE INDEX IF NOT EXISTS os_business_endorsements_reciprocal_idx
  ON os_business_endorsements (reciprocal_edge_id)
  WHERE reciprocal_edge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_business_endorsements_visibility_idx
  ON os_business_endorsements (visibility);

-- ---------------------------------------------------------------------
-- 3. Invites — invite-a-mate-to-paid flow
--
-- When a merchant invites a friend to join the paid tier, an invite
-- row is created. On successful Stripe subscription, the webhook
-- consumes any matching open invite and creates an endorsement edge
-- with source='invited'.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_endorsement_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_business_id uuid NOT NULL
    REFERENCES os_business_listings(id) ON DELETE CASCADE,
  invited_email text,
  invited_whatsapp text,
  invited_business_id uuid                  -- populated once invitee joins
    REFERENCES os_business_listings(id) ON DELETE SET NULL,

  invite_channel text NOT NULL DEFAULT 'email'
    CHECK (invite_channel IN ('email','whatsapp','qr','link','manual')),
  invite_token text NOT NULL UNIQUE,
  invite_message text,                      -- optional personal note

  -- Flow controls
  auto_add_on_upgrade boolean NOT NULL DEFAULT true,
  target_tier_required text NOT NULL DEFAULT 'premium'
    CHECK (target_tier_required IN ('premium','verified','merchant_pro')),
  target_category_id uuid
    REFERENCES os_business_endorsement_categories(id) ON DELETE SET NULL,

  -- State machine
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','viewed','accepted','declined','expired','converted')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  converted_at timestamptz,                 -- became paid subscriber
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_endorsement_invites_endorser_idx
  ON os_business_endorsement_invites (endorser_business_id, status);
CREATE INDEX IF NOT EXISTS os_business_endorsement_invites_invited_email_idx
  ON os_business_endorsement_invites (lower(invited_email))
  WHERE invited_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_business_endorsement_invites_invited_business_idx
  ON os_business_endorsement_invites (invited_business_id)
  WHERE invited_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_business_endorsement_invites_status_idx
  ON os_business_endorsement_invites (status, expires_at);

-- Backfill FK on endorsements now that invites table exists
ALTER TABLE os_business_endorsements
  DROP CONSTRAINT IF EXISTS os_business_endorsements_invite_fk;
ALTER TABLE os_business_endorsements
  ADD CONSTRAINT os_business_endorsements_invite_fk
  FOREIGN KEY (invite_id) REFERENCES os_business_endorsement_invites(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 4. Reciprocity prompts — "add them back?"
--
-- When A endorses B, a prompt is created for B. B can reciprocate
-- (creates B→A edge), decline, or ignore. Prompts are batched into
-- daily digest notifications, not sent per-add.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_reciprocity_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by_edge_id uuid NOT NULL
    REFERENCES os_business_endorsements(id) ON DELETE CASCADE,
  target_business_id uuid NOT NULL          -- the business being prompted
    REFERENCES os_business_listings(id) ON DELETE CASCADE,

  prompted_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  response text
    CHECK (response IN ('reciprocated','declined','ignored','snoozed')),
  reciprocated_edge_id uuid                 -- FK when response=reciprocated
    REFERENCES os_business_endorsements(id) ON DELETE SET NULL,

  -- Batching for daily digest delivery
  digest_batch_id uuid,
  digest_sent_at timestamptz,
  digest_channel text,                      -- "email", "whatsapp", "in_app"

  -- Snooze
  snoozed_until timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_business_reciprocity_prompts_unique
    UNIQUE (triggered_by_edge_id)
);

CREATE INDEX IF NOT EXISTS os_business_reciprocity_prompts_target_idx
  ON os_business_reciprocity_prompts (target_business_id, prompted_at DESC)
  WHERE responded_at IS NULL;
CREATE INDEX IF NOT EXISTS os_business_reciprocity_prompts_digest_idx
  ON os_business_reciprocity_prompts (digest_batch_id)
  WHERE digest_batch_id IS NOT NULL AND digest_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS os_business_reciprocity_prompts_snooze_idx
  ON os_business_reciprocity_prompts (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_business_endorsement_categories',
      'os_business_endorsements',
      'os_business_endorsement_invites',
      'os_business_reciprocity_prompts'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 6. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_business_endorsement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_endorsements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_endorsement_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_business_reciprocity_prompts    ENABLE ROW LEVEL SECURITY;

COMMIT;
