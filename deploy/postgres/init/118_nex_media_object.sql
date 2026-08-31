-- 118_nex_media_object.sql
--
-- NEX Media Foundation · Stage 1 · Philip 2026-08-27.
--
-- Doctrine anchors:
--   · project_nex_media_foundation_roadmap_2026_08_27 (single foundation)
--   · project_nex_free_infrastructure_principle_2026_08_27 (own the software)
--   · ADR-0118 · Media Object ownership + phone-delete rule
--   · ADR-0024 · Every media asset MUST have a manifest row (already enforced
--     by ManifestWritingObjectStorage decorator on the object registry)
--
-- The canonical NEX-owned media object · polymorphic across:
--   image | video | audio | document
--
-- Every future NEX media surface (profile photo, business photo, product
-- image, product video, short video, LIVE recording, voice message, video
-- message, document, thumbnail, poster frame) references THIS ONE table.
-- Do NOT add feature-specific media tables. Extend this one.

CREATE TABLE IF NOT EXISTS nex.media_object (
  -- ── Identity ────────────────────────────────────────────────────
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic kind. All fields below are optional depending on kind.
  object_type TEXT NOT NULL CHECK (object_type IN ('image', 'video', 'audio', 'document')),

  -- ── Ownership · pure-NEX identity (matches call_record pattern) ─
  -- TEXT · not UUID · matches signalling identity strings.
  owner_id TEXT NOT NULL,

  -- ── Visibility · default PRIVATE per ADR-0118 ───────────────────
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),

  -- ── Storage refs · via NEX ObjectStorage abstraction ────────────
  -- These identify the bytes in whatever backend the object registry
  -- currently uses (filesystem in dev, postgres in Phase 3a, r2 in prod).
  storage_bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  storage_version TEXT NOT NULL,   -- version_id returned by ObjectStorage.put()

  -- ── Media metadata · optional per object_type ───────────────────
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  content_hash TEXT NOT NULL,      -- sha256 hex · dedup + integrity

  -- Video + audio only:
  duration_ms INTEGER,             -- media duration in milliseconds

  -- Image + video only:
  width_px INTEGER,
  height_px INTEGER,

  -- Video only:
  codec TEXT,                      -- e.g. 'h264', 'vp8', 'vp9', 'av1'
  poster_media_id UUID REFERENCES nex.media_object(media_id) ON DELETE SET NULL,

  -- Audio only:
  audio_codec TEXT,                -- e.g. 'opus', 'aac'
  sample_rate INTEGER,
  channels INTEGER,

  -- ── Feature attachment · optional ───────────────────────────────
  -- Which product surface does this belong to? Null = orphan / library.
  context_type TEXT
    CHECK (context_type IS NULL OR context_type IN (
      'profile', 'business', 'product', 'feed', 'live_recording',
      'call_recording', 'chat', 'document_library', 'category_library'
    )),
  context_ref TEXT,                -- e.g. public_listing_ref for business, product_id, etc.

  -- ── Provenance ──────────────────────────────────────────────────
  uploaded_via TEXT NOT NULL,      -- app path, e.g. 'nex-media/upload-url'
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_from_user_agent TEXT,   -- optional, truncated
  cycle_run_id UUID,               -- when walker-created, links to worker_cycle_run

  -- ── Lifecycle · ADR-0118 states ─────────────────────────────────
  state TEXT NOT NULL DEFAULT 'uploading'
    CHECK (state IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  -- state transitions:
  --   uploading → processing (client calls /register after PUT completes)
  --   processing → ready     (thumbnail + probe complete)
  --   processing → failed    (probe/thumbnail failure)
  --   * → deleted            (user or admin soft-delete)

  -- Grace period · ADR-0118 § 4 · 7 days between soft-delete and hard R2 delete
  deleted_at TIMESTAMPTZ,          -- set when state transitions to 'deleted'
  hard_delete_after TIMESTAMPTZ,   -- set = deleted_at + 7 days · a janitor removes bytes

  -- ── Auxiliary ───────────────────────────────────────────────────
  title TEXT,                      -- optional user-provided
  description TEXT,                -- optional user-provided
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- ── Audit ───────────────────────────────────────────────────────
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Constraints ─────────────────────────────────────────────────
  -- Kind × required fields
  CONSTRAINT media_object_video_has_duration
    CHECK (object_type <> 'video' OR duration_ms IS NULL OR duration_ms >= 0),
  CONSTRAINT media_object_visibility_owner_consistent
    CHECK (owner_id <> ''),
  -- If deleted, both deletion timestamps must be set together.
  CONSTRAINT media_object_deletion_pair
    CHECK ((state <> 'deleted') OR (deleted_at IS NOT NULL AND hard_delete_after IS NOT NULL)),
  -- Storage refs must be non-empty.
  CONSTRAINT media_object_storage_nonempty
    CHECK (length(storage_bucket) > 0 AND length(storage_key) > 0 AND length(storage_version) > 0)
);

-- ── Indexes for common query paths ────────────────────────────────

CREATE INDEX IF NOT EXISTS ix_media_object_owner_state
  ON nex.media_object (owner_id, state, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS ix_media_object_type_state
  ON nex.media_object (object_type, state, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS ix_media_object_context
  ON nex.media_object (context_type, context_ref, state, uploaded_at DESC)
  WHERE context_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_media_object_content_hash
  ON nex.media_object (content_hash)
  WHERE state = 'ready';

CREATE INDEX IF NOT EXISTS ix_media_object_hard_delete
  ON nex.media_object (hard_delete_after)
  WHERE state = 'deleted';

CREATE INDEX IF NOT EXISTS ix_media_object_visibility_public
  ON nex.media_object (visibility, uploaded_at DESC)
  WHERE visibility = 'public' AND state = 'ready';

-- ── Updated-at trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex.media_object_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_media_object_touch ON nex.media_object;
CREATE TRIGGER trg_media_object_touch
BEFORE UPDATE ON nex.media_object
FOR EACH ROW EXECUTE FUNCTION nex.media_object_touch_updated_at();

-- ── Documentation ─────────────────────────────────────────────────
COMMENT ON TABLE nex.media_object IS
  'NEX Media Foundation · Stage 1 · Philip 2026-08-27. Polymorphic media object '
  'for image/video/audio/document. Every NEX media feature (profile photo, business '
  'photo, product image/video, short video, LIVE recording, voice/video message, '
  'documents, thumbnails) references THIS ONE table. Do NOT add feature-specific '
  'media tables — extend this one. ADR-0118 governs ownership + phone-delete rule.';

COMMENT ON COLUMN nex.media_object.owner_id IS
  'Pure-NEX identity string (matches nex.call_record.caller_user_id pattern). '
  'NOT a Supabase auth UUID. NEX-native identity flow only.';

COMMENT ON COLUMN nex.media_object.state IS
  'Lifecycle state per ADR-0118: uploading → processing → ready → failed | deleted. '
  'Soft delete sets state=deleted + deleted_at=now() + hard_delete_after=now()+7d. '
  'A janitor job (deferred) hard-deletes bytes when now() > hard_delete_after.';

COMMENT ON COLUMN nex.media_object.hard_delete_after IS
  '7-day grace period per ADR-0118 § 4. Deleting from phone does NOT delete NEX copy. '
  'Deleting inside NEX starts the grace clock; bytes removed after 7 days.';
