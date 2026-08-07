-- NEX Infrastructure Runtime · §5.9 · object_manifest
--
-- Queryable metadata index for the ObjectStorage layer (§12). Every
-- put() through getObjectStorage() writes a row here automatically via
-- the manifest-writing decorator in src/lib/nex/storage/object-registry.ts.
--
-- The object itself (bytes) lives in whatever ObjectStorage adapter is
-- active — filesystem, Cloudflare R2, ImageKit, Supabase Storage, S3,
-- MinIO. This table is the SEARCHABLE metadata: "every image belonging
-- to business X uploaded in Q4" is a Postgres query, not a bucket scan.

CREATE TABLE IF NOT EXISTS nex.object_manifest (
  manifest_id          UUID PRIMARY KEY,
  bucket               TEXT NOT NULL,
  key                  TEXT NOT NULL,
  version_id           TEXT NOT NULL,
  content_hash         TEXT NOT NULL,
  size_bytes           BIGINT NOT NULL,
  mime_type            TEXT NOT NULL,
  uploaded_at          TIMESTAMPTZ NOT NULL,
  uploaded_by          TEXT,
  business_id          UUID,
  source_ref           TEXT,
  is_delete_marker     BOOLEAN NOT NULL DEFAULT FALSE,
  custom               JSONB NOT NULL DEFAULT '{}'::jsonb,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket, key, version_id)
);

CREATE INDEX IF NOT EXISTS object_manifest_bucket_key_uploaded_idx
  ON nex.object_manifest (bucket, key, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS object_manifest_content_hash_idx
  ON nex.object_manifest (content_hash);
CREATE INDEX IF NOT EXISTS object_manifest_business_id_idx
  ON nex.object_manifest (business_id, uploaded_at DESC) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS object_manifest_source_ref_idx
  ON nex.object_manifest (source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS object_manifest_bucket_uploaded_idx
  ON nex.object_manifest (bucket, uploaded_at DESC);

ALTER TABLE nex.object_manifest ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'object_manifest' AND policyname = 'service_role_all_object_manifest') THEN
    CREATE POLICY "service_role_all_object_manifest" ON nex.object_manifest FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.object_manifest IS 'Infrastructure Runtime §5.9 · ObjectStorage metadata index · retention forever · rows written by ObjectStorage registry after every put/delete';
