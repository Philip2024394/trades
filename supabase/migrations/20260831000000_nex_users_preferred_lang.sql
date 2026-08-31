-- 20260831000000_nex_users_preferred_lang.sql
-- Stage 3.33 · Phase 26 · Preferred language on user profile (Philip 2026-08-31)
--
-- Adds a durable server-side source of truth for the user's preferred
-- app language. The sign-on prefix picker (Stage 3.31.a) writes the
-- initial value to localStorage.nex_user_lang the moment a user picks
-- a phone prefix (+62 → id · +44 → en · etc.); this column is where
-- that preference migrates to once the auth backend lands and the user
-- becomes a real hammerex_nex_users row.
--
-- Nullable on purpose: NULL means "we haven't captured a preference
-- yet, fall back to client detection (URL/localStorage/default)". A
-- non-NULL value means "server has authoritative preference · client
-- MUST honour it". No default value at the column level — the
-- application layer explicitly writes on account creation.
--
-- Constraint accepts exactly the codes the app supports today. Grow
-- the CHECK list in a follow-on migration when a new language ships;
-- doing so requires the string packs (src/lib/nex/i18n/packs/) and
-- the SUPPORTED_LANGS array (src/lib/nex/i18n/lang.ts) to grow in
-- lockstep so a user can't be assigned a lang the app can't render.

ALTER TABLE public.hammerex_nex_users
  ADD COLUMN IF NOT EXISTS preferred_lang text NULL;

-- Bounded value gate. Loosen this constraint in the follow-on migration
-- that ships the next language pack.
ALTER TABLE public.hammerex_nex_users
  DROP CONSTRAINT IF EXISTS preferred_lang_valid;
ALTER TABLE public.hammerex_nex_users
  ADD CONSTRAINT preferred_lang_valid
  CHECK (preferred_lang IS NULL OR preferred_lang IN ('en', 'id'));

-- Sparse index: only rows that DO have a preference. A partial index
-- keeps the working set small (early on, most rows will be NULL) while
-- still speeding up "SELECT users WHERE preferred_lang = 'id'" for
-- targeted campaigns / analytics later.
CREATE INDEX IF NOT EXISTS ix_nex_users_preferred_lang
  ON public.hammerex_nex_users(preferred_lang)
  WHERE preferred_lang IS NOT NULL;

COMMENT ON COLUMN public.hammerex_nex_users.preferred_lang IS
  'App language preference · en | id (Stage 3.33) · NULL means fall back to client detection · written by the sign-on prefix picker at account creation.';
