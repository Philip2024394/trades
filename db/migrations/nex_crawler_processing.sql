-- Founder 2026-09-10 · Crawler → Lab routing pipeline.
--
-- Every extracted_record must land in either:
--   · nex_lab_{room}.harvest_raw (routed to a Lab room for verification)
--   · nex_crawler.rejection_log (why we couldn't route it)
--
-- Zero silent drops. The founder's window shows both paths.

ALTER TABLE nex_crawler.extracted_record
  ADD COLUMN IF NOT EXISTS processed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS routed_to       TEXT, -- e.g. "nex_lab_business.harvest_raw"
  ADD COLUMN IF NOT EXISTS routed_ref      TEXT, -- destination row's dedupe_hash
  ADD COLUMN IF NOT EXISTS quality_score   NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS quality_reasons TEXT[];

CREATE INDEX IF NOT EXISTS ix_extracted_unprocessed
  ON nex_crawler.extracted_record (discovered_at ASC)
  WHERE processed_at IS NULL;

-- Rejection log · why a record didn't make it into the Lab.
-- Not a "trash bin" — a first-class citizen visible in the founder window
-- so the operator can see what gaps exist.
CREATE TABLE IF NOT EXISTS nex_crawler.rejection_log (
  rejection_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id      UUID REFERENCES nex_crawler.extracted_record(record_id),
  rejected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason_code    TEXT NOT NULL, -- 'missing_name' | 'missing_geo' | 'low_quality' | 'duplicate' | 'wrong_kind' | 'blocked_host' | 'personal_data'
  reason_detail  TEXT,
  quality_score  NUMERIC(3,2),
  reference      JSONB
);
CREATE INDEX IF NOT EXISTS ix_rejection_code ON nex_crawler.rejection_log (reason_code, rejected_at DESC);

-- Quality score record on lab rows (added to each *.harvest_raw as payload keys)
-- No new table needed · quality_score + quality_reasons + quality_scored_at
-- go into payload JSON for portability.
