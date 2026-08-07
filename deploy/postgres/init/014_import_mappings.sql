-- NEX Infrastructure Runtime · §5.4 extension · Import Mapping Profiles
--
-- Saved column mappings the Import Wizard can reuse (e.g. "Mailchimp
-- Export", "HubSpot Export", "Our Monthly Trades CSV"). Every profile
-- captures the mapping decisions an admin made in a prior wizard run so
-- the next import of a similarly-shaped file can auto-apply them.
--
-- Idempotent · additive-only · safe to re-run.

CREATE TABLE IF NOT EXISTS nex.import_mappings (
  profile_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label              TEXT NOT NULL,
  description        TEXT,
  header_signature   TEXT NOT NULL,                              -- normalized header hash · used to auto-suggest this profile for matching files
  mapping            JSONB NOT NULL DEFAULT '{}'::jsonb,          -- { source_column: target_field } · e.g. { "Email Address": "email" }
  format_hint        TEXT,                                        -- "csv" | "tsv" | "xlsx" | "json" | null (any)
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_count         INT NOT NULL DEFAULT 0,
  last_used_at       TIMESTAMPTZ,
  archived_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS import_mappings_header_sig_idx  ON nex.import_mappings (header_signature)              WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS import_mappings_label_idx       ON nex.import_mappings (label);
CREATE INDEX IF NOT EXISTS import_mappings_last_used_idx   ON nex.import_mappings (last_used_at DESC NULLS LAST)  WHERE archived_at IS NULL;

ALTER TABLE nex.import_mappings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'import_mappings' AND policyname = 'service_role_all_import_mappings') THEN
    CREATE POLICY "service_role_all_import_mappings" ON nex.import_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.import_mappings IS 'Import Wizard · saved column-mapping profiles · reused across similar-shaped uploads';
