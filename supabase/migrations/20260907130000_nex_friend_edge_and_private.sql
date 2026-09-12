-- 20260907130000_nex_friend_edge_and_private.sql
-- NEX Y-P3 · Friend Edge + Private Data Foundation (Philip 2026-09-07)
--
-- Introduces:
--   · nex_friend_invite   — server-authoritative invitation state machine
--   · nex_friend_edge     — accepted mutual friendship (canonical pair)
--   · nex_private_object  — user-owned ciphertext (server never sees plaintext)
--   · nex_user_keyring    — per-user KEK-wrapped DEK (server never sees DEK plaintext)
--
-- Authority: Project B (ijvqdvsvwtwxzcqmoqit) ONLY. All schemas assume
-- Supabase auth · every table receives RLS with default deny + service_role
-- override + a narrow authenticated-read policy scoped to the caller.
--
-- Encryption doctrine (see report + client-side crypto.ts):
--   plaintext content is never written to any column here. Only opaque
--   ciphertext + IV + non-sensitive metadata is persisted.
--   The DEK is generated client-side, wrapped with a KEK derived from the
--   user's password (PBKDF2-HMAC-SHA256, >= 600000 iterations), and only
--   the wrapped_dek + kdf_salt is stored server-side. The raw DEK and the
--   password never leave the client.
--
-- Idempotent. Safe to re-run.

-- =========================================================================
-- nex_friend_invite · invitation state machine
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.nex_friend_invite (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id     uuid          NOT NULL,
  recipient_user_id  uuid          NOT NULL,
  meeting_pref       text          NULL,
  status             text          NOT NULL DEFAULT 'PENDING',
  responded_at       timestamptz   NULL,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT nex_friend_invite_no_self CHECK (sender_user_id <> recipient_user_id),
  CONSTRAINT nex_friend_invite_status  CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED')),
  CONSTRAINT nex_friend_invite_meeting_pref_len CHECK (meeting_pref IS NULL OR char_length(meeting_pref) BETWEEN 1 AND 64)
);

-- Prevent duplicate PENDING invites from the same sender to the same
-- recipient. A previously-declined/revoked invite may be superseded by a
-- new PENDING one.
CREATE UNIQUE INDEX IF NOT EXISTS nex_friend_invite_unique_pending
  ON public.nex_friend_invite (sender_user_id, recipient_user_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS nex_friend_invite_recipient_status_idx
  ON public.nex_friend_invite (recipient_user_id, status);
CREATE INDEX IF NOT EXISTS nex_friend_invite_sender_status_idx
  ON public.nex_friend_invite (sender_user_id, status);

-- =========================================================================
-- nex_friend_edge · accepted mutual friendship (canonical ordered pair)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.nex_friend_edge (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low          uuid          NOT NULL,
  user_high         uuid          NOT NULL,
  origin_invite_id  uuid          NOT NULL REFERENCES public.nex_friend_invite(id) ON DELETE RESTRICT,
  meeting_pref      text          NULL,
  connected_at      timestamptz   NOT NULL DEFAULT now(),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT nex_friend_edge_canonical CHECK (user_low < user_high),
  CONSTRAINT nex_friend_edge_unique_pair UNIQUE (user_low, user_high)
);

CREATE INDEX IF NOT EXISTS nex_friend_edge_low_idx  ON public.nex_friend_edge (user_low);
CREATE INDEX IF NOT EXISTS nex_friend_edge_high_idx ON public.nex_friend_edge (user_high);
CREATE INDEX IF NOT EXISTS nex_friend_edge_origin_idx ON public.nex_friend_edge (origin_invite_id);

-- =========================================================================
-- nex_private_object · user-owned ciphertext
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.nex_private_object (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid          NOT NULL,
  object_type    text          NOT NULL,
  ciphertext     bytea         NOT NULL,
  iv             bytea         NOT NULL,
  key_version    smallint      NOT NULL DEFAULT 1,
  metadata       jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT nex_private_object_iv_length   CHECK (octet_length(iv) = 12),
  CONSTRAINT nex_private_object_type_len    CHECK (char_length(object_type) BETWEEN 1 AND 64),
  CONSTRAINT nex_private_object_ct_min      CHECK (octet_length(ciphertext) >= 16),
  CONSTRAINT nex_private_object_ct_max      CHECK (octet_length(ciphertext) <= 1048576),
  CONSTRAINT nex_private_object_kv_positive CHECK (key_version >= 1)
);

CREATE INDEX IF NOT EXISTS nex_private_object_owner_type_idx
  ON public.nex_private_object (owner_user_id, object_type);
CREATE INDEX IF NOT EXISTS nex_private_object_owner_updated_idx
  ON public.nex_private_object (owner_user_id, updated_at DESC);

-- =========================================================================
-- nex_user_keyring · per-user KEK-wrapped DEK (server never holds plaintext DEK)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.nex_user_keyring (
  owner_user_id   uuid          PRIMARY KEY,
  kdf_algo        text          NOT NULL DEFAULT 'PBKDF2-SHA256',
  kdf_iterations  integer       NOT NULL DEFAULT 600000,
  kdf_salt        bytea         NOT NULL,
  wrapped_dek     bytea         NOT NULL,
  wrap_iv         bytea         NOT NULL,
  key_version     smallint      NOT NULL DEFAULT 1,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT nex_user_keyring_iv_length     CHECK (octet_length(wrap_iv) = 12),
  CONSTRAINT nex_user_keyring_salt_length   CHECK (octet_length(kdf_salt) >= 16),
  CONSTRAINT nex_user_keyring_iterations    CHECK (kdf_iterations >= 100000),
  CONSTRAINT nex_user_keyring_wrapped_min   CHECK (octet_length(wrapped_dek) >= 16),
  CONSTRAINT nex_user_keyring_algo_known    CHECK (kdf_algo IN ('PBKDF2-SHA256'))
);

-- =========================================================================
-- Shared touch trigger for updated_at
-- =========================================================================

CREATE OR REPLACE FUNCTION public.touch_nex_yp3_updated_at()
RETURNS TRIGGER AS $body$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_friend_invite_touch  ON public.nex_friend_invite;
CREATE TRIGGER trg_nex_friend_invite_touch
  BEFORE UPDATE ON public.nex_friend_invite
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_yp3_updated_at();

DROP TRIGGER IF EXISTS trg_nex_friend_edge_touch    ON public.nex_friend_edge;
CREATE TRIGGER trg_nex_friend_edge_touch
  BEFORE UPDATE ON public.nex_friend_edge
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_yp3_updated_at();

DROP TRIGGER IF EXISTS trg_nex_private_object_touch ON public.nex_private_object;
CREATE TRIGGER trg_nex_private_object_touch
  BEFORE UPDATE ON public.nex_private_object
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_yp3_updated_at();

DROP TRIGGER IF EXISTS trg_nex_user_keyring_touch   ON public.nex_user_keyring;
CREATE TRIGGER trg_nex_user_keyring_touch
  BEFORE UPDATE ON public.nex_user_keyring
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_yp3_updated_at();

-- =========================================================================
-- RLS · default deny + service_role_all + narrow authenticated-read
-- =========================================================================

ALTER TABLE public.nex_friend_invite  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_friend_edge    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_private_object ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_user_keyring   ENABLE ROW LEVEL SECURITY;

-- Friend invites · service_role does everything · participants read own
DROP POLICY IF EXISTS "service_role_all"     ON public.nex_friend_invite;
CREATE POLICY "service_role_all"
  ON public.nex_friend_invite FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "participant_reads_own" ON public.nex_friend_invite;
CREATE POLICY "participant_reads_own"
  ON public.nex_friend_invite FOR SELECT TO authenticated
  USING (sender_user_id = auth.uid() OR recipient_user_id = auth.uid());

-- Friend edges · service_role + participants read own
DROP POLICY IF EXISTS "service_role_all"     ON public.nex_friend_edge;
CREATE POLICY "service_role_all"
  ON public.nex_friend_edge FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "participant_reads_own" ON public.nex_friend_edge;
CREATE POLICY "participant_reads_own"
  ON public.nex_friend_edge FOR SELECT TO authenticated
  USING (user_low = auth.uid() OR user_high = auth.uid());

-- Private objects · owner reads own only
DROP POLICY IF EXISTS "service_role_all"     ON public.nex_private_object;
CREATE POLICY "service_role_all"
  ON public.nex_private_object FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_reads_own"      ON public.nex_private_object;
CREATE POLICY "owner_reads_own"
  ON public.nex_private_object FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- Keyring · owner reads own only
DROP POLICY IF EXISTS "service_role_all"     ON public.nex_user_keyring;
CREATE POLICY "service_role_all"
  ON public.nex_user_keyring FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_reads_own"      ON public.nex_user_keyring;
CREATE POLICY "owner_reads_own"
  ON public.nex_user_keyring FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- =========================================================================
-- Comments for future reviewers
-- =========================================================================

COMMENT ON TABLE public.nex_friend_invite IS
  'NEX Y-P3 · pending + resolved invitations. State transitions server-side via /api/nex-social/invite/[id]/respond. Only the recipient can accept/decline.';
COMMENT ON TABLE public.nex_friend_edge IS
  'NEX Y-P3 · accepted mutual friendships. Canonical ordered pair prevents duplicates. Prerequisite for Y-P4 Friends Chat authorization.';
COMMENT ON TABLE public.nex_private_object IS
  'NEX Y-P3 · user-owned ciphertext. The server NEVER sees plaintext. AES-GCM 256-bit ciphertext + 12-byte IV. Client encrypts with a DEK the server does not hold.';
COMMENT ON TABLE public.nex_user_keyring IS
  'NEX Y-P3 · per-user KEK-wrapped DEK. Client derives KEK from password via PBKDF2-HMAC-SHA256 with kdf_salt + kdf_iterations, then unwraps the DEK. Server holds only wrapped_dek + wrap_iv + salt + kdf params. Raw DEK and password never leave the client.';
