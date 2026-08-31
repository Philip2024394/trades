-- 115_nex_knowledge_walker_providers.sql
--
-- NEX Brain Indonesia Knowledge Walkers · Phase Ka · Philip 2026-08-27.
--
-- Doctrine: project_nex_brain_indonesia_knowledge_walkers_doctrine_2026_08_27.md
--
-- Adds provider rate configs for the knowledge walker family. Wikimedia
-- allows ~200 req/s per project but we stay polite at 1 req/s and single
-- concurrency to be a good citizen. Wikidata SPARQL is bandwidth-heavy so
-- longer interval.
--
-- Also extends knowledge_inbox with a truth_class column so knowledge rows
-- carry Philip 2026-08-27 truth classification:
--   confirmed_fact | traditional_folk | spiritual_belief | academic_reference

INSERT INTO nex.provider_rate_config (provider, min_interval_ms, max_concurrent)
VALUES
  ('wikipedia_en',   1000, 1),
  ('wikipedia_id',   1000, 1),
  ('wikidata',       3000, 1),
  ('wikivoyage',     1500, 1)
ON CONFLICT (provider) DO NOTHING;

-- truth_class column (Philip 2026-08-27) · every knowledge row classified so
-- NEX presents facts as facts, folk as folk, beliefs as beliefs. Constitutional
-- per doctrine. Nullable during backfill · new writes MUST populate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='knowledge_inbox' AND column_name='truth_class'
  ) THEN
    ALTER TABLE nex.knowledge_inbox ADD COLUMN truth_class TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='knowledge_inbox' AND column_name='brain_slug'
  ) THEN
    ALTER TABLE nex.knowledge_inbox ADD COLUMN brain_slug TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='knowledge_inbox' AND column_name='topic_key'
  ) THEN
    ALTER TABLE nex.knowledge_inbox ADD COLUMN topic_key TEXT;
  END IF;
END $$;

-- CHECK constraint on truth_class (only enforced for rows that populate it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_inbox_truth_class_valid'
  ) THEN
    ALTER TABLE nex.knowledge_inbox
      ADD CONSTRAINT knowledge_inbox_truth_class_valid
      CHECK (truth_class IS NULL OR truth_class IN (
        'confirmed_fact', 'traditional_folk', 'spiritual_belief', 'academic_reference'
      ));
  END IF;
END $$;

-- Idempotent identity via (brain_slug, topic_key, source) for the resolver
-- to deduplicate re-fetches. Multiple visits of same Wikipedia article for
-- the same topic → one canonical row + merge log entries recording each visit.
CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_inbox_topic_source
  ON nex.knowledge_inbox (brain_slug, topic_key, source)
  WHERE brain_slug IS NOT NULL AND topic_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_knowledge_inbox_brain_class
  ON nex.knowledge_inbox (brain_slug, truth_class, created_at_iso DESC);

COMMENT ON COLUMN nex.knowledge_inbox.truth_class IS
  'Philip 2026-08-27 · truth classification · confirmed_fact | traditional_folk | spiritual_belief | academic_reference · constitutional bar for how NEX presents the information to users. Never fabricated. Never dismissed as false.';
