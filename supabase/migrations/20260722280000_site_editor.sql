-- The Site Editor — Konva-canvas photo composer (Phase 6+).
--
-- Two tables:
--   1. hammerex_site_editor_drafts — the user's in-progress + saved
--      compositions. Layer state is a JSON blob (font size, positions,
--      overlays, shapes, etc.) so we can evolve the layer schema
--      without an ALTER TABLE per new feature.
--   2. hammerex_site_editor_ai_captions — every AI-description call
--      logged with the prompt + response + user edit + destination.
--      Feeds the AI brain (Phase 9) via a nightly cron; also gates
--      the 1-washer charge.

-- =====================================================================
-- hammerex_site_editor_drafts
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_site_editor_drafts (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner identity — merchant slug (signed-in) OR buyer email
  -- (anonymous). Same shape as hammerex_site_subscriptions.
  owner_merchant_slug TEXT,
  owner_email         TEXT,

  -- Optional starting image (from The Site wall). null when the user
  -- uploads their own base image only.
  source_image_id    TEXT,

  -- Selected export frame (e.g. "ig-feed"). Defaults to Instagram
  -- feed square — most common.
  frame_slug         TEXT          NOT NULL DEFAULT 'ig-feed',

  -- Layer state — { base_image: {...}, layers: [{kind, x, y, ...}] }
  -- Kept as JSONB so we can query into it for analytics (e.g. count
  -- overlays used, average layer count per frame).
  state              JSONB         NOT NULL DEFAULT '{}'::jsonb,

  -- Optional user-facing name (defaults to "Untitled draft").
  title              TEXT          NOT NULL DEFAULT 'Untitled draft',

  -- Autosaved vs explicitly saved. Autosaves rotate — the client
  -- overwrites the same draft id on every heartbeat.
  is_autosave        BOOLEAN       NOT NULL DEFAULT TRUE,

  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_site_editor_drafts_owner_check CHECK (
    owner_merchant_slug IS NOT NULL OR owner_email IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_hammerex_site_editor_drafts_merchant
  ON public.hammerex_site_editor_drafts (owner_merchant_slug, updated_at DESC)
  WHERE owner_merchant_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hammerex_site_editor_drafts_email
  ON public.hammerex_site_editor_drafts (owner_email, updated_at DESC)
  WHERE owner_email IS NOT NULL;

ALTER TABLE public.hammerex_site_editor_drafts ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- hammerex_site_editor_ai_captions
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_site_editor_ai_captions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  requester_merchant_slug TEXT,
  requester_email         TEXT,

  -- What we sent to the model — the image subject, trade slug, and
  -- destination network. Kept verbatim so the training pipeline can
  -- rebuild the prompt.
  prompt_json         JSONB         NOT NULL,

  -- What we got back (raw), and what the user actually posted after
  -- edits. Diff of the two is the training signal.
  ai_caption          TEXT          NOT NULL,
  final_caption       TEXT,

  network_slug        TEXT,
  frame_slug          TEXT,
  source_image_id     TEXT,

  -- Washer accounting — one row = one washer debited.
  washer_debit        INTEGER       NOT NULL DEFAULT 1,

  -- Optional engagement signal populated later by an ingest job
  -- (likes, replies, shares from the destination network).
  engagement_score    NUMERIC,
  engagement_snapshot_at TIMESTAMPTZ,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_site_editor_ai_captions_requester_check CHECK (
    requester_merchant_slug IS NOT NULL OR requester_email IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_hammerex_site_editor_ai_captions_merchant
  ON public.hammerex_site_editor_ai_captions (requester_merchant_slug, created_at DESC)
  WHERE requester_merchant_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hammerex_site_editor_ai_captions_network
  ON public.hammerex_site_editor_ai_captions (network_slug, created_at DESC);

ALTER TABLE public.hammerex_site_editor_ai_captions ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- hammerex_site_editor_social_tokens — per-user OAuth tokens for
-- auto-posting (Meta / TikTok). One row per (owner, network). Tokens
-- encrypted at rest via pgsodium in later migrations if enabled.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_site_editor_social_tokens (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_merchant_slug TEXT          NOT NULL,
  network_slug        TEXT          NOT NULL,          -- 'instagram' | 'facebook' | 'tiktok' | 'snapchat'

  access_token        TEXT          NOT NULL,
  refresh_token       TEXT,
  scope               TEXT,
  expires_at          TIMESTAMPTZ,

  -- Network-specific identifier (IG business account id, FB page id,
  -- TikTok open_id, Snap user id). Needed at post time.
  network_account_id  TEXT,
  network_username    TEXT,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_site_editor_social_tokens_owner_network_unique
    UNIQUE (owner_merchant_slug, network_slug)
);

ALTER TABLE public.hammerex_site_editor_social_tokens ENABLE ROW LEVEL SECURITY;
