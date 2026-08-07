-- NEX Infrastructure Runtime · §5.4 extension · Contact Segments
--
-- Named audiences saved by admins from the Communications Centre
-- Audience Builder. Every future campaign · newsletter · follow-up
-- starts from a segment. Segments are FILTERS OVER the Contact
-- Registry · never materialised copies of contacts (per doctrine).
--
-- Idempotent · additive-only · safe to re-run.

CREATE TABLE IF NOT EXISTS nex.contact_segments (
  segment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  filter           JSONB NOT NULL DEFAULT '{}'::jsonb,       -- structured SegmentFilter · see types.ts
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_count       INT NOT NULL DEFAULT 0,
  last_used_at     TIMESTAMPTZ,
  archived_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS contact_segments_last_used_idx ON nex.contact_segments (last_used_at DESC NULLS LAST) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS contact_segments_name_idx      ON nex.contact_segments (name);

ALTER TABLE nex.contact_segments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'contact_segments' AND policyname = 'service_role_all_contact_segments') THEN
    CREATE POLICY "service_role_all_contact_segments" ON nex.contact_segments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.contact_segments IS 'Named audience filters · every campaign starts from a segment · filter is a JSON specification (never a copy of contacts)';
