-- ═══════════════════════════════════════════════════════════════════
-- nex_collection_url_queue · add `kind` column (discovery vs candidate)
--
-- Philip 2026-08-13 — two-track worker input model:
--
--   candidate (default) — an actual company website URL. The worker fetches
--                         it, extracts contact + evidence, classifies as
--                         REFACING / MANUFACTURE / BOTH / INSTALLER / SUPPLIER
--                         / NOT_RELEVANT, dedupes, and saves the company via
--                         insertDirectorySeed (or merges into an existing seed).
--
--   discovery            — a directory/search-source page (Checkatrade search,
--                         HomeRun listing, etc.) that the human operator will
--                         BROWSE to find candidate company URLs. The worker
--                         NEVER classifies these as companies. Stored as a
--                         bookmark with status = 'discovery_bookmark' so it
--                         doesn't sit in the "queued" pile awaiting fetch.
--
-- Rule: NEX does not scrape directory sites. Discovery = human step.
-- Fetch + classify = worker step. Save = worker step (after dedupe).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.nex_collection_url_queue
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'candidate';

-- Constrain the two allowed kinds.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nex_collection_url_queue_kind_check'
  ) THEN
    ALTER TABLE public.nex_collection_url_queue
      ADD CONSTRAINT nex_collection_url_queue_kind_check
      CHECK (kind IN ('candidate','discovery'));
  END IF;
END $$;

-- Expand the status enum with the discovery_bookmark terminal state.
-- We recreate the check constraint because ALTER TABLE cannot modify CHECK in-place.
ALTER TABLE public.nex_collection_url_queue
  DROP CONSTRAINT IF EXISTS nex_collection_url_queue_status_check;

ALTER TABLE public.nex_collection_url_queue
  ADD CONSTRAINT nex_collection_url_queue_status_check
  CHECK (status IN (
    'queued',
    'processing',
    'completed',
    'duplicate',
    'needs_review',
    'failed',
    'retry_scheduled',
    'discovery_bookmark'
  ));

-- Derived classification label · set by the worker after extraction.
-- Nullable while status ∈ {queued, processing} — populated on terminal outcome.
ALTER TABLE public.nex_collection_url_queue
  ADD COLUMN IF NOT EXISTS classification text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nex_collection_url_queue_classification_check'
  ) THEN
    ALTER TABLE public.nex_collection_url_queue
      ADD CONSTRAINT nex_collection_url_queue_classification_check
      CHECK (classification IS NULL OR classification IN (
        'REFACING',
        'MANUFACTURE',
        'BOTH',
        'INSTALLER',
        'SUPPLIER',
        'NOT_RELEVANT',
        'NEEDS_REVIEW'
      ));
  END IF;
END $$;

-- Index for the admin dashboard split (candidate queue vs discovery bookmarks).
CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_kind
  ON public.nex_collection_url_queue(kind);

CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_classification
  ON public.nex_collection_url_queue(classification) WHERE classification IS NOT NULL;
