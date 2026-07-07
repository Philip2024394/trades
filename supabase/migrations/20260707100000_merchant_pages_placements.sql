-- Extend merchant_pages with slot placement state.
--
-- The reorder + snap + variant-aware system needs to persist which
-- slot each section lives in and what layout variant it renders with.
-- Sections themselves are stored in draft_sections / published_sections;
-- placements are a parallel map so we can move sections between slots
-- without touching the section's own config.
--
-- Shape: JSONB object keyed by section_id, values = { slot_id, variant }.

BEGIN;

ALTER TABLE merchant_pages
  ADD COLUMN IF NOT EXISTS draft_placements jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE merchant_pages
  ADD COLUMN IF NOT EXISTS published_placements jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Extend the existing draft-updated-at trigger so placement changes
-- also bump the timestamp.
CREATE OR REPLACE FUNCTION merchant_pages_touch_draft_updated_at()
  RETURNS trigger AS $$
BEGIN
  IF NEW.draft_sections IS DISTINCT FROM OLD.draft_sections
     OR NEW.draft_placements IS DISTINCT FROM OLD.draft_placements THEN
    NEW.draft_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
