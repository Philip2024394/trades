-- 196_nex_emergency_trusted_contact_channels.sql
--
-- NEX Emergency Help · trusted-contact multi-channel extension
-- (L3 · 2026-10-10).
--
-- SAFE ON POPULATED DB · idempotent · additive · session-identity gated.
--
-- ═══════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION DOES
-- ═══════════════════════════════════════════════════════════════════
--
-- Extends `nex.trusted_contact` (migration 193) so that a trusted
-- contact can be identified by ANY of:
--
--   · a NEX account id          · contact_account_id (existing)
--   · an email address          · contact_email      (NEW · nullable)
--   · a phone number            · contact_phone      (NEW · nullable)
--
-- Rationale (attacker-removes-phone threat model · multi-channel
-- fan-out doctrine):
--   · In the old model every trusted contact had to be a NEX account
--     holder. Most people's actual trusted contacts (parent, partner,
--     neighbour) are NOT on NEX. The alert that most needs to leave
--     the device never had anywhere to go.
--   · In the new model the owner can pre-select ANY reachable identity
--     per channel. The multi-channel fan-out service picks the best
--     available channel per contact at alert time.
--   · Email is working end-to-end via the sealed SMTP adapter
--     (`sendOwnerInviteEmail` is the sealed shape in `src/lib/nex`).
--   · SMS/WhatsApp are HONEST-BLOCKED in v1 (no provider wired yet) ·
--     the adapter stub returns ok=false with a reason the audit log
--     records faithfully. We NEVER fabricate SMS delivery.
--
-- Primary-key repack:
--   · Old PK was (owner_account_id, contact_account_id).
--   · With contact_account_id now nullable we need a surrogate PK
--     (`trusted_contact_id uuid`) plus three partial unique indexes
--     so each identifier is unique per owner where present.
--
-- Doctrine (sealed with this migration):
--   · AT LEAST ONE of (contact_account_id, contact_email, contact_phone)
--     MUST be set. The CHECK constraint enforces this.
--   · Email format is permissive: must contain '@' at position > 1. The
--     service layer applies the tighter regex.
--   · Phone format is permissive: length 5..20. Country code and
--     dialing conventions vary too much to validate at the DB layer.
--   · Idempotence: all CREATE INDEX and ADD COLUMN use IF NOT EXISTS;
--     constraint drops use IF EXISTS; the surrogate PK is added with
--     DEFAULT gen_random_uuid() so existing rows get an id in the same
--     ALTER.
--
-- ═══════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. nex.trusted_contact · ALTER
--      · DROP NOT NULL   contact_account_id
--      · ADD COLUMN      contact_email text NULL (CHECK '@' present)
--      · ADD COLUMN      contact_phone text NULL (CHECK length 5..20)
--      · DROP PK         (owner_account_id, contact_account_id)
--      · ADD COLUMN      trusted_contact_id uuid
--      · ADD PK          (trusted_contact_id)
--      · ADD UNIQUE idx  per-owner-per-account-id (partial)
--      · ADD UNIQUE idx  per-owner-per-email      (partial, lower-cased)
--      · ADD UNIQUE idx  per-owner-per-phone      (partial)
--      · ADD CHECK       at least one identifier present
--
-- ═══════════════════════════════════════════════════════════════════
-- IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════
--
-- Every DDL uses IF (NOT) EXISTS where supported. Constraint operations
-- use DROP IF EXISTS + ADD. Safe to re-run.
--
-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
--
--   ALTER TABLE nex.trusted_contact
--     DROP CONSTRAINT IF EXISTS trusted_contact_at_least_one_identifier,
--     DROP CONSTRAINT IF EXISTS trusted_contact_pkey,
--     DROP COLUMN IF EXISTS trusted_contact_id,
--     DROP COLUMN IF EXISTS contact_email,
--     DROP COLUMN IF EXISTS contact_phone;
--   DROP INDEX IF EXISTS nex.trusted_contact_owner_account_uq;
--   DROP INDEX IF EXISTS nex.trusted_contact_owner_email_uq;
--   DROP INDEX IF EXISTS nex.trusted_contact_owner_phone_uq;
--   -- restore 193's PK (fails if any row has NULL contact_account_id)
--   ALTER TABLE nex.trusted_contact
--     ALTER COLUMN contact_account_id SET NOT NULL,
--     ADD CONSTRAINT pk_tc_owner_contact
--       PRIMARY KEY (owner_account_id, contact_account_id);
--
-- ═══════════════════════════════════════════════════════════════════
-- DEPLOYMENT PREREQUISITES
-- ═══════════════════════════════════════════════════════════════════
--
-- · migration 193 applied (nex.trusted_contact must exist).
-- · pgcrypto · gen_random_uuid().
--
-- ═══════════════════════════════════════════════════════════════════
-- NOT APPLIED
-- ═══════════════════════════════════════════════════════════════════
--
-- Must only be applied via
-- `scripts/nex-canonical/_apply-migration-196.mjs` with the
-- session-identity gate (current_database() = 'nex_dev').

BEGIN;

-- 1 · drop the old composite PK first · otherwise step 2 cannot
--     relax NOT NULL on contact_account_id (PG blocks dropping NOT
--     NULL on a column still in the primary key).
--     The 193-era PK name was `pk_tc_owner_contact`; some environments
--     may have stored it as the Postgres-default `trusted_contact_pkey`.
--     Drop both guarded.
ALTER TABLE nex.trusted_contact
  DROP CONSTRAINT IF EXISTS pk_tc_owner_contact;
ALTER TABLE nex.trusted_contact
  DROP CONSTRAINT IF EXISTS trusted_contact_pkey CASCADE;

-- 2 · relax NOT NULL on contact_account_id so email-only / phone-only
--     contacts are legal.
ALTER TABLE nex.trusted_contact
  ALTER COLUMN contact_account_id DROP NOT NULL;

-- 3 · add the two new channel columns with permissive CHECKs.
ALTER TABLE nex.trusted_contact
  ADD COLUMN IF NOT EXISTS contact_email text NULL,
  ADD COLUMN IF NOT EXISTS contact_phone text NULL;

ALTER TABLE nex.trusted_contact
  DROP CONSTRAINT IF EXISTS trusted_contact_email_shape,
  DROP CONSTRAINT IF EXISTS trusted_contact_phone_shape;

ALTER TABLE nex.trusted_contact
  ADD CONSTRAINT trusted_contact_email_shape
    CHECK (contact_email IS NULL OR position('@' in contact_email) > 1),
  ADD CONSTRAINT trusted_contact_phone_shape
    CHECK (contact_phone IS NULL OR length(contact_phone) BETWEEN 5 AND 20);

-- 4 · add the surrogate PK on trusted_contact_id.
ALTER TABLE nex.trusted_contact
  ADD COLUMN IF NOT EXISTS trusted_contact_id uuid
    NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE nex.trusted_contact
  ADD CONSTRAINT trusted_contact_pkey PRIMARY KEY (trusted_contact_id);

-- 5 · partial unique indexes so each identifier type is unique per
--     owner where present (NULLs don't collide).
CREATE UNIQUE INDEX IF NOT EXISTS trusted_contact_owner_account_uq
  ON nex.trusted_contact (owner_account_id, contact_account_id)
  WHERE contact_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trusted_contact_owner_email_uq
  ON nex.trusted_contact (owner_account_id, lower(contact_email))
  WHERE contact_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trusted_contact_owner_phone_uq
  ON nex.trusted_contact (owner_account_id, contact_phone)
  WHERE contact_phone IS NOT NULL;

-- 6 · at least one identifier must be present (anti-ghost-row seal).
ALTER TABLE nex.trusted_contact
  DROP CONSTRAINT IF EXISTS trusted_contact_at_least_one_identifier;

ALTER TABLE nex.trusted_contact
  ADD CONSTRAINT trusted_contact_at_least_one_identifier
  CHECK (
    contact_account_id IS NOT NULL
    OR contact_email   IS NOT NULL
    OR contact_phone   IS NOT NULL
  );

COMMIT;

COMMENT ON COLUMN nex.trusted_contact.contact_email IS
  'Optional email identity for a non-NEX trusted contact. The multi-channel fan-out uses the sealed SMTP adapter to send alerts to this address.';

COMMENT ON COLUMN nex.trusted_contact.contact_phone IS
  'Optional phone identity for a non-NEX trusted contact. v1 PILOT the SMS adapter is HONEST-BLOCKED (returns ok=false) · never fabricates delivery.';

COMMENT ON COLUMN nex.trusted_contact.trusted_contact_id IS
  'Surrogate primary key (uuid). Replaced the composite PK after email/phone-only identities became legal in migration 196.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 196.
-- Downstream:
--   · src/lib/nex-native/emergency/trusted-contacts-service.ts
--   · src/lib/nex-native/emergency/emergency-notification-service.ts
--   · migration 197 · nex.emergency_fanout_log (dedicated audit table)
-- ═══════════════════════════════════════════════════════════════════
