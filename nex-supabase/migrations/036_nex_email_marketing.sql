-- ============================================================================
-- NEX-native Migration 036 · Email Marketing backend (Wave C Slice 11a)
-- ============================================================================
-- Opens the 7th sealed keypad capability. This migration is BACKEND ONLY.
-- Compose UI, send infrastructure, and analytics come in follow-up slices
-- (11b compose · 11c send · 11d log/tracking · 11e unsubscribe page).
--
-- Schema:
--
-- nex_email_list
--   · id             uuid PK
--   · business_id    FK nex_business ON DELETE CASCADE
--   · name           text 1..100 · unique per business (case-insensitive)
--   · description    text 0..500 nullable
--   · created_at + updated_at (touch trigger)
--
-- nex_email_subscriber
--   · id                     uuid PK
--   · list_id                FK nex_email_list ON DELETE CASCADE
--   · email                  text · CHECK pattern + max 320 · stored lower
--   · unsubscribe_token      text 32 chars · unique · generated app-side
--   · subscribed_at          timestamptz NOT NULL DEFAULT now()
--   · unsubscribed_at        timestamptz nullable · null means active
--   · created_at + updated_at (touch trigger)
--   · unique(list_id, lower(email)) prevents dup subscribers in same list
--
-- Doctrine:
--   · Merchant owns their list · CASCADE with business
--   · One-list-per-subscriber-per-business (via list_id, no cross-list dedup)
--   · Unsubscribe is soft (row stays, unsubscribed_at set) so we can honour
--     the token later + preserve history · doctrine has NO right-to-erasure
--     complication here yet · future privacy slice may hard-delete on request.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '036';
--     DROP TABLE IF EXISTS nex_email_subscriber;
--     DROP TABLE IF EXISTS nex_email_list;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_email_list (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_email_list_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT nex_email_list_description_length CHECK (description IS NULL OR char_length(description) <= 500)
);

COMMENT ON TABLE nex_email_list IS
  'Email marketing list · owned by one business · CASCADE with business · name unique per business (case-insensitive).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_email_list_business_name
  ON nex_email_list (business_id, lower(name));

DROP TRIGGER IF EXISTS nex_email_list_touch ON nex_email_list;
CREATE TRIGGER nex_email_list_touch
  BEFORE UPDATE ON nex_email_list
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_email_list ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS nex_email_subscriber (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id             uuid NOT NULL REFERENCES nex_email_list(id) ON DELETE CASCADE,
  email               text NOT NULL,
  unsubscribe_token   text NOT NULL,
  subscribed_at       timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_email_subscriber_email_shape CHECK (
    email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    AND char_length(email) BETWEEN 3 AND 320
  ),
  CONSTRAINT nex_email_subscriber_token_length CHECK (char_length(unsubscribe_token) = 32)
);

COMMENT ON TABLE nex_email_subscriber IS
  'Subscriber row on an nex_email_list · CASCADE with list · email stored lower-case · shape-checked · unsubscribe is SOFT (unsubscribed_at set).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_email_subscriber_list_email
  ON nex_email_subscriber (list_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_email_subscriber_token
  ON nex_email_subscriber (unsubscribe_token);

CREATE INDEX IF NOT EXISTS idx_nex_email_subscriber_list_active
  ON nex_email_subscriber (list_id, subscribed_at DESC)
  WHERE unsubscribed_at IS NULL;

DROP TRIGGER IF EXISTS nex_email_subscriber_touch ON nex_email_subscriber;
CREATE TRIGGER nex_email_subscriber_touch
  BEFORE UPDATE ON nex_email_subscriber
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_email_subscriber ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '036',
    'Wave C Slice 11a · Email Marketing backend · nex_email_list + nex_email_subscriber',
    'Opens 7th sealed keypad capability · backend only · compose/send in follow-up slices.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
