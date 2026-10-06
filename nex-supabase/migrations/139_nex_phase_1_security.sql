-- nex-supabase/migrations/139_nex_phase_1_security.sql
--
-- NEX Phase 1.0 · Security surface + World Intro toggle + Custom Intro
-- entitlement + session-tracking + sign-in audit log.
-- Founder-authorised 2026-10-06.
--
-- WHAT THIS DOES
--
-- 1. ALTER nex_account
--      · sessions_invalidated_at timestamptz · nullable · bumped by the
--        "sign out all other sessions" action. The session resolver
--        rejects any session issued before this timestamp.
--      · world_intro_enabled boolean · default TRUE · owner-controlled
--        toggle. The peer-chat mount gate checks this before playing the
--        theme intro to a visitor. Default TRUE preserves current
--        behaviour (all accounts show their intro until they opt out).
--
-- 2. CREATE TABLE nex_session
--      Companion layer to Supabase auth.sessions · one row per
--      user-visible session. Keyed by sha256(access_token) so we have a
--      stable per-session identity without reaching into Supabase
--      internals. Owner RLS SELECT · service-role writes.
--
-- 3. CREATE TABLE nex_sign_in_event
--      Append-only audit log of sign-in attempts (success + failure).
--      Keyed by account_id. Owner RLS SELECT · service-role writes.
--      No UPDATE / DELETE policy · events are immutable.
--
-- 4. CREATE TABLE nex_account_custom_intro
--      Per-account entitlement row for the paid Custom Intro feature
--      (Rp 500,000 one-off). Admin inserts the entitlement row after
--      confirming NEX1-chat payment (per the sealed "NEX never handles
--      payments" doctrine). Owner then uploads a video via the Phase 1
--      self-serve surface · video_url references the NEX-owned MinIO
--      bucket (object-storage adapter sealed 2026-10-06). Owner RLS
--      SELECT + UPDATE (toggle enabled / clear video) · no INSERT policy
--      because entitlement must be admin-granted post-payment.
--
-- WHAT THIS DOES NOT DO
--   · No TOTP / backup codes / app-lock / recovery-contact / push-alert
--     columns. Those are future Phase 1.1 - 1.5 scopes.
--   · No new-device email trigger. Phase 1.4 ships that once Notifications
--     infrastructure exists.
--   · No data migration · all existing nex_account rows acquire the two
--     new columns with their defaults · all three new tables start empty.
--   · No seeded Custom Intro entitlements · admin flow lands when the
--     first customer pays.
--
-- WHAT HAPPENS AT APPLY TIME
--   · All existing accounts: sessions_invalidated_at = NULL (no sessions
--     invalidated), world_intro_enabled = TRUE (default · intros play as
--     before).
--   · nex_session: empty. The session resolver begins writing rows on
--     the first authenticated request after apply.
--   · nex_sign_in_event: empty. Begins populating on the next sign-in.
--   · nex_account_custom_intro: empty.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · nex_account additive columns
-- ---------------------------------------------------------------------------
ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS sessions_invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS world_intro_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN nex_account.sessions_invalidated_at IS
  'Phase 1.0 · bumped by "sign out all other sessions" (POST '
  '/api/nex-native/security/sessions/revoke-all). The session resolver '
  'rejects sessions whose issuance predates this timestamp. NULL = no '
  'forced-signout has occurred. See migration 139.';

COMMENT ON COLUMN nex_account.world_intro_enabled IS
  'Phase 1.0 · owner toggle · when FALSE the peer-chat mount gate skips '
  'the theme intro for visitors arriving at this account''s chat. Default '
  'TRUE preserves prior behaviour. See migration 139 and the resolver at '
  'src/app/nex-native/chat/peer/[accountId]/page.tsx.';

-- ---------------------------------------------------------------------------
-- 2 · nex_session · companion session-tracking layer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_session (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  supabase_session_key   text NOT NULL,
  device_label           text,
  user_agent             text,
  ip_address             inet,
  approx_city            text,
  approx_country         text,
  trusted                boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  last_seen_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at             timestamptz,
  CONSTRAINT nex_session_supabase_key_length
    CHECK (char_length(supabase_session_key) BETWEEN 16 AND 128),
  CONSTRAINT nex_session_device_label_length
    CHECK (device_label IS NULL OR char_length(device_label) <= 120),
  CONSTRAINT nex_session_user_agent_length
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 1024),
  CONSTRAINT nex_session_city_length
    CHECK (approx_city IS NULL OR char_length(approx_city) <= 120),
  CONSTRAINT nex_session_country_length
    CHECK (approx_country IS NULL OR char_length(approx_country) <= 120),
  UNIQUE (account_id, supabase_session_key)
);

CREATE INDEX IF NOT EXISTS nex_session_account_last_seen_idx
  ON nex_session (account_id, last_seen_at DESC);

COMMENT ON TABLE nex_session IS
  'Phase 1.0 · companion layer to Supabase auth.sessions · one row per '
  'user-visible authenticated session. The session resolver writes '
  'last_seen_at on every valid request. "Sign out all other sessions" '
  'bumps nex_account.sessions_invalidated_at · the resolver rejects '
  'sessions issued before that timestamp.';

COMMENT ON COLUMN nex_session.supabase_session_key IS
  'sha256 hash of the Supabase session access_token · stable per session · '
  'rotates on refresh (which is desirable for last_seen tracking · we see '
  'each refreshed session as a fresh row). NEVER store the raw token.';

COMMENT ON COLUMN nex_session.trusted IS
  'Phase 1.0 UI · owner can mark a session as trusted. Enforcement '
  '(e.g. require 2FA on untrusted) is Phase 1.1 scope. Default false.';

ALTER TABLE nex_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_session_owner_read
  ON nex_session
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- Writes happen via service-role (session resolver hook + API routes
-- that use nexSupabaseAdmin). No authenticated INSERT/UPDATE/DELETE
-- policies · the surface is deliberately server-managed.

-- ---------------------------------------------------------------------------
-- 3 · nex_sign_in_event · append-only audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_sign_in_event (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  event_type             text NOT NULL,
  success                boolean NOT NULL,
  device_label           text,
  user_agent             text,
  ip_address             inet,
  approx_city            text,
  approx_country         text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_sign_in_event_type_values
    CHECK (event_type IN (
      'password', 'webauthn', 'magic_link', 'remote_sign_out', 'password_change', 'failure'
    )),
  CONSTRAINT nex_sign_in_event_device_label_length
    CHECK (device_label IS NULL OR char_length(device_label) <= 120),
  CONSTRAINT nex_sign_in_event_user_agent_length
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 1024),
  CONSTRAINT nex_sign_in_event_city_length
    CHECK (approx_city IS NULL OR char_length(approx_city) <= 120),
  CONSTRAINT nex_sign_in_event_country_length
    CHECK (approx_country IS NULL OR char_length(approx_country) <= 120)
);

CREATE INDEX IF NOT EXISTS nex_sign_in_event_account_created_idx
  ON nex_sign_in_event (account_id, created_at DESC);

COMMENT ON TABLE nex_sign_in_event IS
  'Phase 1.0 · append-only sign-in audit log · one row per sign-in '
  'attempt (success and failure) + password-change + remote-sign-out. '
  'Owner RLS SELECT only · no UPDATE / DELETE policy (events are '
  'immutable). The Security activity page reads this.';

COMMENT ON COLUMN nex_sign_in_event.event_type IS
  'One of: password · webauthn · magic_link · remote_sign_out · '
  'password_change · failure. CHECK-constrained · adding a new type '
  'requires a migration.';

ALTER TABLE nex_sign_in_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_sign_in_event_owner_read
  ON nex_sign_in_event
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- No INSERT / UPDATE / DELETE policies · writes happen via service-role
-- only. The log is append-only and immutable from the owner's side.

-- ---------------------------------------------------------------------------
-- 4 · nex_account_custom_intro · paid-feature entitlement + upload
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nex_account_custom_intro (
  account_id             uuid PRIMARY KEY REFERENCES nex_account(id) ON DELETE CASCADE,
  entitlement_at         timestamptz NOT NULL,
  entitlement_source     text NOT NULL DEFAULT 'nex1_support_manual',
  video_url              text,
  video_duration_ms      integer,
  video_width            integer,
  video_height           integer,
  video_size_bytes       bigint,
  uploaded_at            timestamptz,
  enabled                boolean NOT NULL DEFAULT true,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_account_custom_intro_entitlement_source_values
    CHECK (entitlement_source IN ('nex1_support_manual','admin_grant','promo')),
  CONSTRAINT nex_account_custom_intro_video_url_length
    CHECK (video_url IS NULL OR char_length(video_url) <= 2048),
  CONSTRAINT nex_account_custom_intro_video_duration_range
    CHECK (video_duration_ms IS NULL OR (video_duration_ms BETWEEN 3000 AND 10000)),
  CONSTRAINT nex_account_custom_intro_video_size_range
    CHECK (video_size_bytes IS NULL OR (video_size_bytes BETWEEN 1 AND 20971520)),
  CONSTRAINT nex_account_custom_intro_video_dimensions
    CHECK (
      (video_width IS NULL AND video_height IS NULL)
      OR (video_width > 0 AND video_height > 0 AND video_width <= 3840 AND video_height <= 2160)
    )
);

COMMENT ON TABLE nex_account_custom_intro IS
  'Phase 1.0 · per-account entitlement row for the paid Custom Intro '
  'feature (Rp 500,000 one-off). Row EXISTENCE = entitled. Row INSERT '
  'is admin-only (post-payment via NEX1 support chat); owner reads + '
  'updates the video_url/enabled fields through server actions. The '
  'video itself lives in the NEX-owned MinIO bucket · video_url points '
  'at the object-storage key via a signed URL served through NEX routes.';

COMMENT ON COLUMN nex_account_custom_intro.entitlement_at IS
  'Timestamp when admin confirmed payment and granted the entitlement. '
  'Required · the row never exists before payment confirmation.';

COMMENT ON COLUMN nex_account_custom_intro.entitlement_source IS
  'How the entitlement was granted. nex1_support_manual = standard '
  'post-payment admin action. admin_grant = ops bypass for support '
  'cases. promo = free grant for a promotional campaign.';

COMMENT ON COLUMN nex_account_custom_intro.enabled IS
  'Owner toggle · when FALSE the custom intro is dormant and the '
  'standard theme intro plays instead. Does NOT revoke the '
  'entitlement · the video_url is preserved so the owner can turn it '
  'back on later. Setting enabled = TRUE requires video_url IS NOT NULL '
  '(enforced in the server action, not SQL · to keep migrations simple).';

ALTER TABLE nex_account_custom_intro ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_account_custom_intro_owner_read
  ON nex_account_custom_intro
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY nex_account_custom_intro_owner_update
  ON nex_account_custom_intro
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())
  );

-- No INSERT policy · entitlement is admin-only via service-role.
-- No DELETE policy · if an entitlement needs reversal, ops updates the
-- row (set entitlement_at = NULL or similar) rather than deleting. The
-- audit trail stays intact.

-- ---------------------------------------------------------------------------
-- 5 · migration ledger
-- ---------------------------------------------------------------------------
INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '139',
    'Phase 1.0 Security + World Intro + Custom Intro schema',
    'Phase 1.0 founder-authorised 2026-10-06. Adds nex_account.sessions_invalidated_at + nex_account.world_intro_enabled (default true · preserves existing behaviour). Creates nex_session (companion session tracking · keyed by sha256(access_token)) · nex_sign_in_event (append-only audit log) · nex_account_custom_intro (paid entitlement + MinIO-backed video). All three new tables ENABLE ROW LEVEL SECURITY · owner SELECT policies on all three · owner UPDATE policy on nex_account_custom_intro for enabled-toggle · writes otherwise service-role only. No TOTP / backup codes / app-lock / recovery (Phase 1.1-1.5 scope).'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification queries (run manually against the live DB):
--
-- 1 · nex_account acquired both columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'nex_account'
--   AND column_name IN ('sessions_invalidated_at','world_intro_enabled');
-- -- expected: sessions_invalidated_at (timestamptz, NULL default),
-- --           world_intro_enabled (boolean, true default)
--
-- 2 · All existing accounts default to world_intro_enabled = true:
-- SELECT COUNT(*) FROM nex_account WHERE world_intro_enabled IS NOT TRUE;
-- -- expected: 0
--
-- 3 · Three new tables exist with correct RLS:
-- SELECT polname FROM pg_policy
--  WHERE polrelid IN (
--    'nex_session'::regclass,
--    'nex_sign_in_event'::regclass,
--    'nex_account_custom_intro'::regclass
--  )
--  ORDER BY polname;
-- -- expected rows (minimum):
-- --   nex_account_custom_intro_owner_read
-- --   nex_account_custom_intro_owner_update
-- --   nex_session_owner_read
-- --   nex_sign_in_event_owner_read
--
-- 4 · Anon cannot read any of the three:
-- SET ROLE anon;
-- SELECT COUNT(*) FROM nex_session;
-- SELECT COUNT(*) FROM nex_sign_in_event;
-- SELECT COUNT(*) FROM nex_account_custom_intro;
-- RESET ROLE;
-- -- expected: 0 for all three (no public read policy)
--
-- 5 · Custom intro CHECK constraints work:
-- INSERT INTO nex_account_custom_intro (account_id, entitlement_at, video_duration_ms)
-- VALUES ('<fake>', now(), 2000); -- should FAIL (below 3000ms minimum)
-- ============================================================================
