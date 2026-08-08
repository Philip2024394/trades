-- =====================================================================
-- NEX Knowledge Inbox · Phase 3a · Object-Storage reference columns
-- =====================================================================
--
-- Additive · idempotent · zero destructive changes.
--
-- Adds object_bucket + object_key columns to nex.knowledge_inbox so
-- inbox items can reference binaries stored in NEX Object Storage
-- (nex.object_blobs) instead of a per-machine filesystem path.
--
-- Backward compatibility:
--   · file_path (existing column) STAYS · legacy items keep working
--   · new items populate object_bucket + object_key AND ALSO
--     file_path during the transition window
--   · image-analyst reads object_bucket first · falls back to file_path
--   · Phase 3b will drop file_path once all in-flight legacy items
--     are backfilled into object storage
-- =====================================================================

ALTER TABLE nex.knowledge_inbox
    ADD COLUMN IF NOT EXISTS object_bucket TEXT,
    ADD COLUMN IF NOT EXISTS object_key    TEXT;

-- Index for lookup-by-object · not required for correctness but useful
-- for backfill scripts and observability queries.
CREATE INDEX IF NOT EXISTS idx_knowledge_inbox_object
    ON nex.knowledge_inbox (object_bucket, object_key)
    WHERE object_bucket IS NOT NULL AND object_key IS NOT NULL;

COMMENT ON COLUMN nex.knowledge_inbox.object_bucket IS
    'Phase 3a · NEX Object Storage bucket name (e.g. "uploads"). NULL for pre-migration items that only have file_path. Set together with object_key.';

COMMENT ON COLUMN nex.knowledge_inbox.object_key IS
    'Phase 3a · NEX Object Storage key. Together with object_bucket forms the location-transparent binary reference. NULL for pre-migration items.';

-- =====================================================================
-- Phase 3a schema change complete.
-- Consumer wiring lives in:
--   src/lib/nex/knowledge-inbox/storage.ts::saveFileItem
--   src/lib/nex/knowledge-inbox/pg-shadow.ts (adds columns to shadow)
--   src/lib/nex/brain/workers/image-analyst.ts (prefers object over file_path)
-- =====================================================================
