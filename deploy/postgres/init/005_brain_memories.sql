-- NEX Infrastructure Runtime · §5.3 · brain_memories
-- Retention: forever. Partitionable by brain_slug when volume warrants.

CREATE TABLE IF NOT EXISTS nex.brain_memories (
  memory_id            UUID PRIMARY KEY,
  brain_name           TEXT NOT NULL,
  brain_slug           TEXT NOT NULL,
  source_job_id        TEXT,
  source_kind          TEXT,
  source_owner         TEXT,
  knowledge_type       TEXT,
  title                TEXT,
  content_length       INTEGER,
  inbox_item_id        TEXT,
  added_at             TIMESTAMPTZ NOT NULL,
  business_id          UUID,
  inserted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bm_slug_added_idx          ON nex.brain_memories (brain_slug, added_at DESC);
CREATE INDEX IF NOT EXISTS bm_source_job_id_idx       ON nex.brain_memories (source_job_id) WHERE source_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bm_source_owner_added_idx  ON nex.brain_memories (source_owner, added_at DESC) WHERE source_owner IS NOT NULL;
CREATE INDEX IF NOT EXISTS bm_business_id_idx         ON nex.brain_memories (business_id, added_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE nex.brain_memories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'brain_memories' AND policyname = 'service_role_all_bm') THEN
    CREATE POLICY "service_role_all_bm" ON nex.brain_memories FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE nex.brain_memories IS 'Infrastructure Runtime §5.3 · Brain Router memories · retention forever';
