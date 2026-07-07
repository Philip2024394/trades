-- Chat / conversation model.
--
-- A CONVERSATION is a thread bound to a scope (currently: an
-- engagement). Participants are parties (either wearing an entity hat
-- or a trade hat). Messages fan into it. Read receipts are per-
-- participant (last_read_at) — a message's green tick appears when the
-- other side's last_read_at has advanced past it.

BEGIN;

CREATE TABLE IF NOT EXISTS os_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  kind text NOT NULL DEFAULT 'engagement_1to1'
    CHECK (kind IN ('engagement_1to1','site_announcement','entity_1to1')),

  -- Scoping: at least one of these must be set.
  entity_id uuid REFERENCES os_entities(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES os_site_engagements(id) ON DELETE CASCADE,
  site_id uuid REFERENCES os_sites(id) ON DELETE CASCADE,
  business_id uuid REFERENCES os_business_listings(id) ON DELETE CASCADE,

  subject text,
  created_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,

  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- One engagement gets one thread; enforced by partial unique index below.
  CONSTRAINT os_conversations_scope_check
    CHECK (
      engagement_id IS NOT NULL
      OR site_id IS NOT NULL
      OR business_id IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS os_conversations_engagement_unique
  ON os_conversations (engagement_id)
  WHERE engagement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS os_conversations_entity_idx
  ON os_conversations (entity_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS os_conversations_business_idx
  ON os_conversations (business_id, last_message_at DESC NULLS LAST);


CREATE TABLE IF NOT EXISTS os_conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES os_conversations(id) ON DELETE CASCADE,

  party_id uuid REFERENCES os_parties(id) ON DELETE CASCADE,
  business_id uuid REFERENCES os_business_listings(id) ON DELETE CASCADE,

  side text NOT NULL CHECK (side IN ('entity_member','trade','observer')),

  last_read_at timestamptz,
  muted_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_conversation_participants_who_check
    CHECK (party_id IS NOT NULL OR business_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS os_conversation_participants_party_idx
  ON os_conversation_participants (party_id, conversation_id);
CREATE INDEX IF NOT EXISTS os_conversation_participants_business_idx
  ON os_conversation_participants (business_id, conversation_id);


CREATE TABLE IF NOT EXISTS os_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES os_conversations(id) ON DELETE CASCADE,

  sender_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE SET NULL,
  sender_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,
  sender_side text NOT NULL CHECK (sender_side IN ('entity_member','trade','system')),

  body text NOT NULL,
  attachment_url text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_messages_conversation_idx
  ON os_messages (conversation_id, created_at);


-- Advance the conversation's last_message_at whenever a message lands
-- so we can order the inbox cheaply.
CREATE OR REPLACE FUNCTION os_touch_conversation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE os_conversations
     SET last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS os_messages_touch_conv ON os_messages;
CREATE TRIGGER os_messages_touch_conv
  AFTER INSERT ON os_messages
  FOR EACH ROW EXECUTE FUNCTION os_touch_conversation();

COMMIT;
