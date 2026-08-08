-- =====================================================================
-- NEX Object Storage · Phase 3a · Postgres-backed binary blob storage
-- =====================================================================
--
-- Additive · idempotent · zero destructive changes.
--
-- Implements the "ObjectStorage" contract from
-- src/lib/nex/storage/object-types.ts using our own Postgres as the
-- authoritative binary store. First production ObjectStorage adapter.
--
-- Why Postgres · not S3/R2/ImageKit/Supabase Storage:
--   1. NEX-owned end-to-end · no external SaaS dependency
--   2. Cross-machine transparent · every worker connects to the same
--      Postgres, so image-analyst on Fly reads the same bytes the
--      dev laptop wrote
--   3. Zero perpetuation of Supabase (per Philip's mandate: "NEX
--      Postgres = authoritative structured NEX data · Supabase must
--      not remain a hidden NEX storage dependency")
--   4. Size profile fits: inbox uploads are typically 10 KB – 5 MB.
--      For future large-file needs (videos, CAD dumps > 50 MB) we
--      can add a second adapter (R2 · S3 · MinIO) selected by
--      capability, without touching consumers.
--   5. Backups + PITR come free with Postgres backup posture.
--
-- SCHEMA
--   nex.object_blobs
--     bucket + key + version_id form the composite identity.
--     bytes stored as BYTEA (Postgres TOAST handles compression up to
--     ~1 GB per row, though we soft-cap at 50 MB in the adapter).
--     content_hash (sha256) enables content-based deduplication.
--     is_delete_marker replaces the filesystem `.current` pointer's
--     "DELETED:" convention.
--
-- MANIFEST
--   The registry-level ManifestWritingObjectStorage decorator
--   continues to write to nex.object_manifest per put/delete. This
--   table is the STORAGE. object_manifest is the INDEX. Two-writes,
--   one truth per plane.
--
-- =====================================================================

CREATE TABLE IF NOT EXISTS nex.object_blobs (
    bucket             TEXT        NOT NULL,
    key                TEXT        NOT NULL,
    version_id         TEXT        NOT NULL,
    content_hash       TEXT        NOT NULL,      -- sha256 hex
    size_bytes         BIGINT      NOT NULL CHECK (size_bytes >= 0),
    mime_type          TEXT        NOT NULL DEFAULT 'application/octet-stream',
    body               BYTEA,                     -- NULL when is_delete_marker=true
    is_delete_marker   BOOLEAN     NOT NULL DEFAULT FALSE,
    uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by        TEXT,
    business_id        TEXT,
    source_ref         TEXT,
    custom             JSONB       NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (bucket, key, version_id)
);

-- Current-live-version pointer table · replaces the filesystem
-- `.current` file. One row per (bucket, key). Updates are atomic via
-- UPDATE; readers see either the old or the new pointer but never a
-- partial state.
CREATE TABLE IF NOT EXISTS nex.object_blob_current (
    bucket             TEXT        NOT NULL,
    key                TEXT        NOT NULL,
    version_id         TEXT        NOT NULL,      -- points into object_blobs
    is_delete_marker   BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bucket, key)
);

-- Indexes: list-by-prefix + list-versions + content-hash dedup.
CREATE INDEX IF NOT EXISTS idx_object_blobs_bucket_key
    ON nex.object_blobs (bucket, key, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_object_blobs_uploaded_at
    ON nex.object_blobs (uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_object_blobs_hash
    ON nex.object_blobs (content_hash);

ALTER TABLE nex.object_blobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.object_blob_current ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Grants + RLS policies · nex_brain_app has full CRUD
-- =====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
    nex.object_blobs,
    nex.object_blob_current
    TO nex_brain_app;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['object_blobs', 'object_blob_current']) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_brain_app_all ON nex.%I', t, t);
        EXECUTE format(
            'CREATE POLICY %I_brain_app_all ON nex.%I FOR ALL TO nex_brain_app USING (true) WITH CHECK (true)',
            t, t
        );
    END LOOP;
END $$;

-- =====================================================================
-- Documentation
-- =====================================================================

COMMENT ON TABLE nex.object_blobs IS
    'Phase 3a · NEX Object Storage · Postgres-backed binary blob storage. Implements the ObjectStorage contract from src/lib/nex/storage/object-types.ts. Every put/get/delete goes through PostgresObjectStorage adapter · never direct SQL from services. Body stored as BYTEA. Registry-level manifest decorator continues to write nex.object_manifest.';

COMMENT ON TABLE nex.object_blob_current IS
    'Phase 3a · pointer to the current-live version of each (bucket, key). Analogous to the .current file in the filesystem adapter. Updates are atomic. Soft delete leaves a delete-marker version in object_blobs and flips this pointer to is_delete_marker=true.';

-- =====================================================================
-- Phase 3a migration complete. Two new tables + two RLS policies.
-- Adapter code lives in src/lib/nex/storage/adapters/object-postgres.ts.
-- Registered in src/lib/nex/storage/object-registry.ts as "postgres".
-- Enable with: NEX_OBJECT_BACKEND=postgres
-- =====================================================================
