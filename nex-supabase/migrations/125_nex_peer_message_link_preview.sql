-- ============================================================================
-- NEX-native Migration 125 · nex_peer_message · link_preview attachment type
-- ============================================================================
--
-- *** DRAFT · NOT YET APPLIED · AWAITING FOUNDER AUTHORISATION ***
--
-- See docs/doctrine/migration-125-link-preview-schema-review-2026-10-02.md
-- for the full schema review document reviewed before any apply.
--
-- Sealed draft 2026-10-02 · Phase 1 link previews.
--
-- Adds a 'link_preview' attachment type and five nullable text columns
-- holding server-fetched Open Graph metadata (URL / title / description
-- / image URL / source domain). Semantics mirror the WhatsApp /
-- iMessage link-card convention: a plaintext message carries both a
-- user-authored body AND, when a URL was detected AND the per-message
-- preview toggle was ON AND the chat was NOT in E2E mode, a server-
-- generated preview card rendered above the body.
--
-- Why plaintext-only (compound CHECK below):
--   OG previews are inherently server-fetched. The server cannot
--   generate a preview from ciphertext it cannot read. Doctrine
--   decision 2026-10-02: link_preview attachments are forbidden on
--   encrypted messages. The composer disables the preview toggle in
--   E2E chats; the server action re-validates; the DB CHECK is the
--   final enforcement.
--
-- Why trigger-based deletion zero-out (vs client responsibility):
--   Phase 1 schema decision (approved by schema gate 2026-10-02):
--   deletion-for-everyone clears all five preview columns, deviating
--   from the body-preserve doctrine of Migration 053 (see review doc
--   §6 for rationale). Enforcement at the DB layer via a BEFORE
--   UPDATE trigger guarantees no application code path can
--   accidentally leak retracted preview content. The trigger only
--   fires on the deleted_for_everyone transition from false → true
--   AND only for rows with attachment_type='link_preview'.
--
-- Rollback (reversible · no data mutation that cannot be undone):
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '125';
--     DROP TRIGGER IF EXISTS nex_peer_message_link_preview_delete_trigger
--       ON nex_peer_message;
--     DROP FUNCTION IF EXISTS nex_peer_message_zero_link_preview_on_delete();
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_link_preview_requires_plaintext,
--       DROP CONSTRAINT IF EXISTS nex_peer_message_link_url_len,
--       DROP CONSTRAINT IF EXISTS nex_peer_message_link_title_len,
--       DROP CONSTRAINT IF EXISTS nex_peer_message_link_description_len,
--       DROP CONSTRAINT IF EXISTS nex_peer_message_link_image_url_len,
--       DROP CONSTRAINT IF EXISTS nex_peer_message_link_source_domain_len,
--       DROP COLUMN IF EXISTS link_url,
--       DROP COLUMN IF EXISTS link_title,
--       DROP COLUMN IF EXISTS link_description,
--       DROP COLUMN IF EXISTS link_image_url,
--       DROP COLUMN IF EXISTS link_source_domain,
--       -- Restore the previous attachment_type CHECK (Migration 119)
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;
--     ALTER TABLE nex_peer_message
--       ADD CONSTRAINT nex_peer_message_attachment_type_check
--       CHECK (
--         attachment_type IS NULL
--         OR attachment_type IN (
--           'image', 'video', 'audio',
--           'product', 'menu_item', 'cart_order', 'product_share',
--           'sticker'
--         )
--       );
--   COMMIT;
-- ============================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1 · Extend the attachment_type CHECK to allow 'link_preview'
-- -------------------------------------------------------------------------
-- Mirrors the pattern used by Migration 119 (which added 'sticker'):
-- drop the old constraint, re-add it with the extra value. Existing
-- rows are unaffected because their attachment_type values remain in
-- the (now larger) allowed set.

ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN (
      'image',
      'video',
      'audio',
      'product',
      'menu_item',
      'cart_order',
      'product_share',
      'sticker',
      'link_preview'
    )
  );

-- -------------------------------------------------------------------------
-- 2 · Five nullable text columns holding server-fetched OG metadata
-- -------------------------------------------------------------------------
-- All five are nullable with no DEFAULT because:
--   · The vast majority of messages (non-link_preview) carry NULL in
--     all five · nullable + no default keeps existing rows untouched
--     (zero rewrite · fast migration)
--   · When attachment_type='link_preview' the compound CHECK (§4
--     below) requires link_url to be NOT NULL · other four may be
--     NULL (title/description/image are best-effort; source_domain
--     is populated from link_url by the server action)
--
-- Column lengths enforce caps that match the server-side slicing in
-- src/lib/nex-native/link-preview-fetcher.ts (title 300, description
-- 600). URL caps match the de-facto 2048-char web standard.

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS link_url            text,
  ADD COLUMN IF NOT EXISTS link_title          text,
  ADD COLUMN IF NOT EXISTS link_description    text,
  ADD COLUMN IF NOT EXISTS link_image_url      text,
  ADD COLUMN IF NOT EXISTS link_source_domain  text;

-- Per-column length CHECKs · defence-in-depth against oversized writes
-- that could bypass server-side slicing. Named individually so partial
-- rollback is possible (drop just one if a seed row needs to exceed).

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_link_url_len
  CHECK (link_url IS NULL OR length(link_url) <= 2048);

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_link_title_len
  CHECK (link_title IS NULL OR length(link_title) <= 300);

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_link_description_len
  CHECK (link_description IS NULL OR length(link_description) <= 600);

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_link_image_url_len
  CHECK (link_image_url IS NULL OR length(link_image_url) <= 2048);

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_link_source_domain_len
  CHECK (link_source_domain IS NULL OR length(link_source_domain) <= 128);

-- -------------------------------------------------------------------------
-- 3 · Column comments for post-apply introspection
-- -------------------------------------------------------------------------

COMMENT ON COLUMN nex_peer_message.link_url IS
  'Final URL (after any redirect resolution) that the server-side OG fetcher resolved for this message. Non-null when attachment_type=''link_preview''. Max 2048 chars. Sealed 2026-10-02 · Migration 125.';

COMMENT ON COLUMN nex_peer_message.link_title IS
  'Open Graph og:title (or <title> fallback) extracted server-side. Plain text (angle-brackets stripped, HTML entities decoded). Max 300 chars. NULL when the target page provided no title.';

COMMENT ON COLUMN nex_peer_message.link_description IS
  'Open Graph og:description extracted server-side. Plain text. Max 600 chars. NULL when the target page provided no description.';

COMMENT ON COLUMN nex_peer_message.link_image_url IS
  'Open Graph og:image URL (validated public, SSRF-checked, scheme http/https only, no userinfo, no SVG). Rendered client-side as <img> with referrerPolicy=no-referrer. NULL when no safe image URL was found.';

COMMENT ON COLUMN nex_peer_message.link_source_domain IS
  'Hostname of link_url (post-redirect). Rendered on the card chrome so buyers see the origin at a glance ("tiktok.com", "instagram.com"). Max 128 chars.';

-- -------------------------------------------------------------------------
-- 4 · Compound CHECK · link_preview rows must be plaintext + have URL
-- -------------------------------------------------------------------------
-- Composes with the existing nex_peer_message_encrypted_shape check
-- (Migration 093). For attachment_type='link_preview' rows this
-- constraint forces encrypted=false, which in turn satisfies the
-- shape check's plaintext branch (all ciphertext columns NULL).
-- Impossible to create a row that is BOTH encrypted AND carries a
-- link_preview via any application code path · DB enforces at insert.

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_link_preview_requires_plaintext
  CHECK (
    attachment_type IS DISTINCT FROM 'link_preview'
    OR (encrypted = false AND link_url IS NOT NULL)
  );

-- -------------------------------------------------------------------------
-- 5 · Trigger · zero all five link_preview columns on delete-for-everyone
-- -------------------------------------------------------------------------
-- Phase 1 schema decision (approved by schema gate 2026-10-02):
-- delete-for-everyone must clear all preview metadata (deviates from
-- the Migration 053 body-preserve doctrine; see schema review §6 for
-- rationale). Trigger scoped to UPDATE OF deleted_for_everyone + WHEN
-- condition so it is a no-op for every other UPDATE path. Zero write
-- amplification on non-link_preview messages.

CREATE OR REPLACE FUNCTION nex_peer_message_zero_link_preview_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  NEW.link_url := NULL;
  NEW.link_title := NULL;
  NEW.link_description := NULL;
  NEW.link_image_url := NULL;
  NEW.link_source_domain := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nex_peer_message_zero_link_preview_on_delete() IS
  'Fires BEFORE UPDATE OF deleted_for_everyone on nex_peer_message when a link_preview row transitions from live to deleted-for-everyone. Nulls all five link_preview columns. Sealed 2026-10-02 · Migration 125 · approved by schema gate 2026-10-02 as a Phase 1 deviation from the Migration 053 body-preserve doctrine · see docs/doctrine/migration-125-link-preview-schema-review-2026-10-02.md.';

DROP TRIGGER IF EXISTS nex_peer_message_link_preview_delete_trigger
  ON nex_peer_message;

CREATE TRIGGER nex_peer_message_link_preview_delete_trigger
  BEFORE UPDATE OF deleted_for_everyone ON nex_peer_message
  FOR EACH ROW
  WHEN (
    NEW.attachment_type = 'link_preview'
    AND NEW.deleted_for_everyone = true
    AND OLD.deleted_for_everyone = false
  )
  EXECUTE FUNCTION nex_peer_message_zero_link_preview_on_delete();

-- -------------------------------------------------------------------------
-- 6 · No new indexes in Phase 1
-- -------------------------------------------------------------------------
-- Deliberately NO index on link_source_domain. Phase 1 does not query
-- "all messages from this domain." If that becomes a feature (abuse
-- pattern analysis, per-domain filters), a partial index can be added
-- later: CREATE INDEX idx_nex_peer_message_link_source_domain
--   ON nex_peer_message (link_source_domain)
--   WHERE link_source_domain IS NOT NULL;
-- Keeping the migration lean · existing nex_peer_message indexes
-- continue to serve participant-pair lookups unchanged.

-- -------------------------------------------------------------------------
-- 7 · Migration history entry
-- -------------------------------------------------------------------------

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '125',
    'Phase 1 link previews · nex_peer_message.link_* columns + attachment_type=''link_preview'' + plaintext-only CHECK + delete-for-everyone zero-out trigger',
    'Sealed 2026-10-02 after 74/74 Phase-1 security-evidence runs (scripts/test-link-preview-safety.mjs + scripts/test-link-preview-adversarial.mjs). Encrypted-chat composer disables preview; server action re-validates; DB CHECK is final enforcement. Delete-for-everyone zero-out via BEFORE UPDATE trigger deviates from Migration 053 body-preserve doctrine, approved by schema gate 2026-10-02. See docs/doctrine/migration-125-link-preview-schema-review-2026-10-02.md.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries (run manually after any eventual apply)
-- ============================================================================
--
--   -- Columns created?
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'nex_peer_message'
--      AND column_name LIKE 'link_%'
--    ORDER BY column_name;
--
--   -- Attachment type now includes link_preview?
--   SELECT pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname = 'nex_peer_message_attachment_type_check';
--
--   -- Compound CHECK present?
--   SELECT pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname = 'nex_peer_message_link_preview_requires_plaintext';
--
--   -- Trigger wired?
--   SELECT trigger_name, event_manipulation, action_timing, action_statement
--     FROM information_schema.triggers
--    WHERE event_object_table = 'nex_peer_message'
--      AND trigger_name = 'nex_peer_message_link_preview_delete_trigger';
--
--   -- Shape check unchanged (Migration 093)?
--   SELECT pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname = 'nex_peer_message_encrypted_shape';
--
--   -- No rows mutated by the migration?
--   SELECT count(*) FROM nex_peer_message WHERE link_url IS NOT NULL;
--   -- (should be 0 immediately post-migration · columns default NULL)
