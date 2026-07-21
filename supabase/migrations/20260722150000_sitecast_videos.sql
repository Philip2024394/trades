-- Sitecast — Networkers Video Knowledge Platform
--
-- v0.5 skeleton per the build brief. Structured metadata from Day 1
-- so the Knowledge Graph (Phase 5-6) and AI-assistant-per-video
-- (Phase 4-5) can layer on top without a table restructure.
--
-- Design principles baked into the schema:
--   • Every video connects to structured business data (trade,
--     project, products, tools, materials, regulations)
--   • Three classes with different lifecycle rules (Feed 30d /
--     Portfolio permanent / Knowledge Base admin-curated)
--   • Business metrics as first-class events (lead, quote, booking,
--     sale) — never "likes" or "follows"
--   • AI-processing pipeline fields populate async (transcript,
--     detections, chapters) — schema tolerates NULL until Phase 2
--
-- Naming: hammerex_videos prefix per the shared Supabase pattern.

-- ─── Main videos table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_videos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  merchant_slug         text        NOT NULL,
  uploaded_by_user_id   text,                    -- future auth wiring

  -- Core content
  title                 text        NOT NULL,
  description           text,
  video_url             text        NOT NULL,    -- Cloudflare Stream / Supabase Storage URL
  thumbnail_url         text,
  duration_seconds      int         CHECK (duration_seconds > 0 AND duration_seconds <= 180),  -- v0.5: 3-min max
  size_bytes            bigint,

  -- Class + lifecycle
  video_class           text        NOT NULL DEFAULT 'portfolio'
                        CHECK (video_class IN ('feed', 'portfolio', 'kb')),
  status                text        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','processing','live','flagged','removed')),

  -- Knowledge-graph slots — populated by AI in Phase 2, hand-picked
  -- until then. Categories match hammerex_video_categories.
  category_slug         text,
  trade_slug            text,                    -- FK-style to trades taxonomy
  project_type          text,                    -- kitchen-extension, bathroom-refit, etc
  difficulty            text        CHECK (difficulty IN ('beginner','intermediate','advanced','specialist') OR difficulty IS NULL),
  estimated_time_hours  numeric(6,1),
  estimated_cost_gbp    int,

  -- Regional relevance (multi-tag for cross-region videos)
  city                  text,
  regions               text[]      NOT NULL DEFAULT '{}',

  -- Structured detections (Phase 2 AI fills these; manual until then)
  products_detected     jsonb       NOT NULL DEFAULT '[]',   -- [{brand, model, sku}]
  tools_detected        jsonb       NOT NULL DEFAULT '[]',
  materials_detected    jsonb       NOT NULL DEFAULT '[]',
  regulations_cited     text[]      NOT NULL DEFAULT '{}',   -- Part L 2025, Part P, BS 7671 etc

  -- AI enrichment (Phase 2 — nullable in v0.5)
  transcript            text,
  captions_vtt          text,                    -- WebVTT subtitle track
  keywords              text[]      NOT NULL DEFAULT '{}',
  hashtags              text[]      NOT NULL DEFAULT '{}',
  chapters              jsonb       NOT NULL DEFAULT '[]',   -- [{start_s, title}]
  faqs                  jsonb       NOT NULL DEFAULT '[]',   -- [{q, a}]
  safety_notices        text[]      NOT NULL DEFAULT '{}',

  -- Aggregates (denormalised for hot-path reads; updated by triggers/cron)
  view_count            bigint      NOT NULL DEFAULT 0,
  save_count            bigint      NOT NULL DEFAULT 0,
  quote_attach_count    bigint      NOT NULL DEFAULT 0,
  lead_count            bigint      NOT NULL DEFAULT 0,
  booking_count         bigint      NOT NULL DEFAULT 0,

  -- Timestamps + lifecycle
  created_at            timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz,
  expires_at            timestamptz,             -- feed class only; portfolio + kb = NULL
  last_reviewed_at      timestamptz,

  -- Consent + rights (per legal T&C)
  consent_admin_reuse   boolean     NOT NULL DEFAULT false,
  consent_supplier_ref  boolean     NOT NULL DEFAULT false
);

-- Auto-set expires_at on feed videos
CREATE OR REPLACE FUNCTION hammerex_videos_set_feed_expiry()
RETURNS trigger AS $$
BEGIN
  IF NEW.video_class = 'feed' AND NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.published_at, NEW.created_at) + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_videos_set_feed_expiry_trg ON hammerex_videos;
CREATE TRIGGER hammerex_videos_set_feed_expiry_trg
  BEFORE INSERT OR UPDATE ON hammerex_videos
  FOR EACH ROW EXECUTE FUNCTION hammerex_videos_set_feed_expiry();

CREATE INDEX IF NOT EXISTS idx_hammerex_videos_merchant   ON hammerex_videos (merchant_slug);
CREATE INDEX IF NOT EXISTS idx_hammerex_videos_class      ON hammerex_videos (video_class);
CREATE INDEX IF NOT EXISTS idx_hammerex_videos_status     ON hammerex_videos (status);
CREATE INDEX IF NOT EXISTS idx_hammerex_videos_category   ON hammerex_videos (category_slug);
CREATE INDEX IF NOT EXISTS idx_hammerex_videos_trade      ON hammerex_videos (trade_slug);
CREATE INDEX IF NOT EXISTS idx_hammerex_videos_expires    ON hammerex_videos (expires_at) WHERE video_class = 'feed';
CREATE INDEX IF NOT EXISTS idx_hammerex_videos_published  ON hammerex_videos (published_at DESC) WHERE status = 'live';

-- ─── Category taxonomy ─────────────────────────────────────
-- Hierarchical: parent_slug NULL for top-level (kitchen, plumbing).
-- trades[] links category to which trade slugs it applies to.
CREATE TABLE IF NOT EXISTS hammerex_video_categories (
  slug           text        PRIMARY KEY,
  parent_slug    text        REFERENCES hammerex_video_categories(slug) ON DELETE SET NULL,
  display_name   text        NOT NULL,
  description    text,
  sort_order     int         NOT NULL DEFAULT 100,
  trade_slugs    text[]      NOT NULL DEFAULT '{}',
  video_count    int         NOT NULL DEFAULT 0,      -- denormalised
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hammerex_video_cats_parent ON hammerex_video_categories (parent_slug);

-- ─── Business-metric event ledger ──────────────────────────
-- Every meaningful interaction with a video. Never "likes";
-- always business-value events.
CREATE TABLE IF NOT EXISTS hammerex_video_metrics (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      uuid        NOT NULL REFERENCES hammerex_videos(id) ON DELETE CASCADE,
  event         text        NOT NULL
                CHECK (event IN (
                  'view','view_complete','save','notebook_save',
                  'quote_attach','quote_view','product_click',
                  'lead_generated','booking','sale',
                  'contact_reveal','shared','ai_assistant_query'
                )),
  actor_kind    text        CHECK (actor_kind IN ('anonymous','homeowner','trade','merchant','admin')),
  actor_slug    text,
  session_id    text,
  metadata      jsonb       NOT NULL DEFAULT '{}',   -- e.g. quote_id, notebook_id
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hammerex_video_metrics_video  ON hammerex_video_metrics (video_id);
CREATE INDEX IF NOT EXISTS idx_hammerex_video_metrics_event  ON hammerex_video_metrics (event);
CREATE INDEX IF NOT EXISTS idx_hammerex_video_metrics_created ON hammerex_video_metrics (created_at DESC);
