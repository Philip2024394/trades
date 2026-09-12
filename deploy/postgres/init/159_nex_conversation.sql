-- 159_nex_conversation.sql
--
-- Founder Phase 13 · P13-1 · Conversation persistence.
-- 2026-09-10.
--
-- Three tables:
--   1. nex.conversation             · one row per conversation
--   2. nex.conversation_message     · one row per turn (ordered)
--   3. nex.conversation_share       · one row per public share link
--
-- Doctrine anchors:
--   #4 · Conversations scope by user_id · deletion cascades.
--   General · share links carry a doctrine banner in the rendered page.

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- conversation
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.conversation (
  conversation_id   text        PRIMARY KEY,
  user_id           text        NULL,                    -- null = anonymous
  title             text        NOT NULL DEFAULT 'New conversation',
  branched_from     text        NULL,                    -- parent conversation_id if forked
  branched_at_msg   text        NULL,                    -- fork point (message_id)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_nex_conv_user_active
  ON nex.conversation (user_id, updated_at DESC)
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_conv_updated
  ON nex.conversation (updated_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE nex.conversation IS
  'Founder Phase 13 · P13-1 · one row per conversation · owns messages.';

-- ═══════════════════════════════════════════════════════════════════
-- conversation_message
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.conversation_message (
  message_id        text        PRIMARY KEY,
  conversation_id   text        NOT NULL,
  role              text        NOT NULL,               -- 'user' | 'assistant' | 'system' | 'tool'
  content           text        NOT NULL,
  ord               integer     NOT NULL,               -- monotonic per conversation
  created_at        timestamptz NOT NULL DEFAULT now(),
  meta              jsonb       NULL,
  CONSTRAINT ck_conv_msg_role CHECK (role IN ('user', 'assistant', 'system', 'tool'))
);

CREATE INDEX IF NOT EXISTS idx_nex_conv_msg_conv_ord
  ON nex.conversation_message (conversation_id, ord);
CREATE INDEX IF NOT EXISTS idx_nex_conv_msg_fts
  ON nex.conversation_message USING gin (to_tsvector('simple', content));

COMMENT ON TABLE nex.conversation_message IS
  'Founder Phase 13 · P13-1 · one row per turn · ord monotonic per conversation.';

-- ═══════════════════════════════════════════════════════════════════
-- conversation_share
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.conversation_share (
  share_token       text        PRIMARY KEY,           -- 32-hex opaque
  conversation_id   text        NOT NULL,
  created_by        text        NULL,                  -- user_id of sharer
  created_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz NULL,
  view_count        integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nex_conv_share_conv
  ON nex.conversation_share (conversation_id, created_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE nex.conversation_share IS
  'Founder Phase 13 · P13-4 · public read-only share links · revocable.';
