-- NEX Infrastructure Runtime · §5.4 extension · Contact source sync status
--
-- Extends nex.contact_sources with per-touch sync status fields · required
-- by the Connectors framework (Phase 3b). Each source row now records
-- whether the sync attempt succeeded and what error was seen (if any).
--
-- Also adds a compound uniqueness index on (source_type, source_ref)
-- WHERE source_ref IS NOT NULL so connectors can safely upsert without
-- creating a fresh source row on every re-run.
--
-- Idempotent · additive-only · safe to re-run.

ALTER TABLE nex.contact_sources ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE nex.contact_sources ADD COLUMN IF NOT EXISTS sync_error  TEXT;
ALTER TABLE nex.contact_sources ADD COLUMN IF NOT EXISTS synchronised_at TIMESTAMPTZ;

-- One (source_type, source_ref) → one row. Re-syncs UPDATE the row instead
-- of creating a new one. Only applies when source_ref is set.
CREATE UNIQUE INDEX IF NOT EXISTS contact_sources_unique_ref_idx
  ON nex.contact_sources (source_type, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS contact_sources_synchronised_idx
  ON nex.contact_sources (source_type, synchronised_at DESC)
  WHERE synchronised_at IS NOT NULL;
