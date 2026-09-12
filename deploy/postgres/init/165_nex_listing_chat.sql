-- 165_nex_listing_chat.sql
--
-- Founder Phase 31 · P31-1 · NEX Listing Chat foundation.
-- 2026-09-10.
--
-- DOCTRINE #7 · PRIVATE MESSAGES.
-- Every row in nex.listing_message and nex.friends_message (Phase 32) is
-- a private two-party envelope. NEX never trains on this data, never
-- embeds it, never surfaces it beyond the two parties. Every query that
-- touches these tables MUST scope by from_user_id OR to_owner_ref.
--
-- Four tables:
--   1. listing_thread         — one row per (listing, first-sender) pair
--   2. listing_message        — every message in a thread
--   3. listing_owner_invite   — email invite token so an owner can reply
--                                without an account (converts on first login)
--   4. outbound_email         — queue for outbound emails (SMTP honest
--                                fallback · exactly the OAuth pattern)

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- listing_thread — one thread per (listing_ref, sender_user_id)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.listing_thread (
  thread_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_ref          text        NOT NULL,               -- e.g. accom:AC-2026-...
  sender_user_id       text        NOT NULL,               -- the visitor who started the thread
  owner_user_id        text        NULL,                   -- populated when owner converts + links
  owner_email_hint     text        NULL,                   -- sha16 of email · Doctrine #7 keeps raw hash-only
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_message_at      timestamptz NOT NULL DEFAULT now(),
  sender_unread_count  integer     NOT NULL DEFAULT 0,
  owner_unread_count   integer     NOT NULL DEFAULT 0,
  status               text        NOT NULL DEFAULT 'open',
  CONSTRAINT ck_listing_thread_status CHECK (status IN ('open','archived_by_sender','archived_by_owner','closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_lt_uniq
  ON nex.listing_thread (listing_ref, sender_user_id);
CREATE INDEX IF NOT EXISTS idx_nex_lt_sender_recent
  ON nex.listing_thread (sender_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_lt_owner_recent
  ON nex.listing_thread (owner_user_id, last_message_at DESC) WHERE owner_user_id IS NOT NULL;

COMMENT ON TABLE nex.listing_thread IS
  'Founder Phase 31 · Doctrine #7 · two-party listing chat thread. NEVER train on this data.';

-- ═══════════════════════════════════════════════════════════════════
-- listing_message — one row per turn
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.listing_message (
  message_id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id            uuid        NOT NULL REFERENCES nex.listing_thread(thread_id) ON DELETE CASCADE,
  from_role            text        NOT NULL,               -- 'sender' | 'owner' | 'system'
  from_user_id         text        NULL,                   -- null for owner-via-invite before conversion
  body                 text        NOT NULL,
  sent_at              timestamptz NOT NULL DEFAULT now(),
  delivered_at         timestamptz NULL,
  read_at              timestamptz NULL,
  sanitiser_neutralised integer    NOT NULL DEFAULT 0,
  meta                 jsonb       NULL,
  CONSTRAINT ck_listing_message_role CHECK (from_role IN ('sender','owner','system')),
  CONSTRAINT ck_listing_message_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_nex_lm_thread_time
  ON nex.listing_message (thread_id, sent_at ASC);

COMMENT ON TABLE nex.listing_message IS
  'Founder Phase 31 · Doctrine #7 · private message rows. NEVER train, embed, or aggregate across users.';

-- ═══════════════════════════════════════════════════════════════════
-- listing_owner_invite — opaque token → owner reply page
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.listing_owner_invite (
  invite_token         text        PRIMARY KEY,           -- 32-hex opaque
  thread_id            uuid        NOT NULL REFERENCES nex.listing_thread(thread_id) ON DELETE CASCADE,
  listing_ref          text        NOT NULL,
  owner_email_hash_16  text        NOT NULL,              -- sha256 first-16 hex, no raw email
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL DEFAULT now() + interval '30 days',
  converted_at         timestamptz NULL,                   -- set when owner opens the link
  converted_user_id    text        NULL,
  first_used_at        timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_nex_loi_email_hash
  ON nex.listing_owner_invite (owner_email_hash_16);
CREATE INDEX IF NOT EXISTS idx_nex_loi_thread
  ON nex.listing_owner_invite (thread_id);

COMMENT ON TABLE nex.listing_owner_invite IS
  'Founder Phase 31 · owner-onboarding invite tokens. Opaque, single-thread-scoped, 30-day TTL.';

-- ═══════════════════════════════════════════════════════════════════
-- outbound_email — SMTP honest-fallback queue
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.outbound_email (
  email_id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose              text        NOT NULL,               -- 'owner_invite' | 'marketing_intro' | 'transactional'
  to_email             text        NOT NULL,
  to_email_hash_16     text        NOT NULL,
  subject              text        NOT NULL,
  body_text            text        NOT NULL,
  body_html            text        NULL,
  status               text        NOT NULL DEFAULT 'queued_pending_smtp',
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz NULL,
  attempts             integer     NOT NULL DEFAULT 0,
  last_error           text        NULL,
  provider             text        NULL,                   -- 'resend','postmark','ses','smtp-generic'
  provider_message_id  text        NULL,
  related_thread_id    uuid        NULL REFERENCES nex.listing_thread(thread_id) ON DELETE SET NULL,
  CONSTRAINT ck_outbound_email_status CHECK (
    status IN ('queued_pending_smtp','queued','sending','sent','failed','bounced')
  ),
  CONSTRAINT ck_outbound_email_purpose CHECK (
    purpose IN ('owner_invite','marketing_intro','transactional','claim_reminder')
  )
);

CREATE INDEX IF NOT EXISTS idx_nex_oe_status_time
  ON nex.outbound_email (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_nex_oe_email_hash
  ON nex.outbound_email (to_email_hash_16, created_at DESC);

COMMENT ON TABLE nex.outbound_email IS
  'Founder Phase 31 · outbound email queue. Honest-fallback pattern: if NEX_SMTP_* env vars not set, rows stay queued_pending_smtp until configured. Never fabricates delivery.';
