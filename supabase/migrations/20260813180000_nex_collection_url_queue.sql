-- ═══════════════════════════════════════════════════════════════════
-- nex_collection_url_queue + nex_collection_fetch_errors
--
-- Path C · Semi-autonomous URL queue collector (Philip 2026-08-13).
--
-- Human/admin pastes candidate public URLs; NEX workers do the actual
-- work: fetch the site, extract public details, verify refacing evidence,
-- run duplicate detection, save qualified companies via the existing
-- insertDirectorySeed() pipeline. No paid search API.
--
-- Design notes (Philip 2026-08-13 correction):
--   · UNIQUE on candidate_url (prevents the same URL being queued twice)
--   · NO uniqueness on target_domain — companies can be represented by
--     multiple URLs (/, /contact, /refacing) which all get inspected.
--     Deduplication happens at the company level DURING processing via
--     findDuplicateCandidates() against directory_seeds.
--   · Worker MUST continue through the queue even when individual URLs
--     fail — failures are recorded to nex_collection_fetch_errors with
--     retry state and the next queued URL is processed.
--
-- Follows codebase pattern:
--   · uuid PK · gen_random_uuid() default
--   · text + CHECK (never Postgres enums)
--   · RLS enabled · no public policies · service-role access only
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. nex_collection_url_queue ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nex_collection_url_queue (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What to fetch
  collection_type         text NOT NULL DEFAULT 'staircase_refacing'
                            CHECK (collection_type IN ('staircase_refacing','staircase_manufacture','kitchens')),
  candidate_url           text NOT NULL UNIQUE,
  target_domain           text NOT NULL,

  -- Who queued it
  submitted_by            text,
  submitted_at            timestamptz NOT NULL DEFAULT now(),

  -- Processing state
  status                  text NOT NULL DEFAULT 'queued'
                            CHECK (status IN (
                              'queued',
                              'processing',
                              'completed',
                              'duplicate',
                              'needs_review',
                              'failed',
                              'retry_scheduled'
                            )),
  attempt_count           integer NOT NULL DEFAULT 0,
  processing_started_at   timestamptz,
  completed_at            timestamptz,
  retry_scheduled_at      timestamptz,

  -- Result linkage (when a seed was created)
  result_listing_id       uuid,
  result_listing_slug     text,
  result_summary          text,

  -- Extraction fingerprint (helps admin see what NEX actually pulled)
  extracted_company_name  text,
  extracted_email         text,
  extracted_phone         text,
  extracted_postcode      text,
  evidence_snippet        text,
  refacing_qualification  text CHECK (refacing_qualification IS NULL OR refacing_qualification IN ('A+','A','B','C','excluded')),

  -- Free-form worker notes / rejection reasons
  notes                   text,
  last_error              text,

  -- Metadata
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Auto-touch updated_at (single-quoted body per codebase pattern to avoid
-- SQL Editor $ dollar-quote splitting).
CREATE OR REPLACE FUNCTION public.nex_collection_url_queue_touch_updated_at()
RETURNS trigger AS
'BEGIN NEW.updated_at = now(); RETURN NEW; END;'
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_collection_url_queue_touch_updated_at ON public.nex_collection_url_queue;
CREATE TRIGGER trg_nex_collection_url_queue_touch_updated_at
  BEFORE UPDATE ON public.nex_collection_url_queue
  FOR EACH ROW EXECUTE FUNCTION public.nex_collection_url_queue_touch_updated_at();

-- Indexes for the admin dashboard + worker "pull next" query
CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_status
  ON public.nex_collection_url_queue(status);
CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_collection_type
  ON public.nex_collection_url_queue(collection_type);
CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_target_domain
  ON public.nex_collection_url_queue(target_domain);
CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_submitted_at
  ON public.nex_collection_url_queue(submitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_nex_collection_url_queue_retry_scheduled_at
  ON public.nex_collection_url_queue(retry_scheduled_at) WHERE status = 'retry_scheduled';

ALTER TABLE public.nex_collection_url_queue ENABLE ROW LEVEL SECURITY;

-- ── 2. nex_collection_fetch_errors ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.nex_collection_fetch_errors (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url              text NOT NULL,
  target_domain           text NOT NULL,
  queue_item_id           uuid REFERENCES public.nex_collection_url_queue(id) ON DELETE SET NULL,

  attempt_count           integer NOT NULL DEFAULT 1,
  error_category          text CHECK (error_category IN (
                            'connection_refused',
                            'timeout',
                            'ssl_error',
                            'http_error',
                            'dns_error',
                            'not_html',
                            'extraction_failed',
                            'other'
                          )),
  last_error              text,

  first_failed_at         timestamptz NOT NULL DEFAULT now(),
  last_failed_at          timestamptz NOT NULL DEFAULT now(),
  retry_scheduled_at      timestamptz,
  dead                    boolean NOT NULL DEFAULT false,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.nex_collection_fetch_errors_touch_updated_at()
RETURNS trigger AS
'BEGIN NEW.updated_at = now(); RETURN NEW; END;'
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_collection_fetch_errors_touch_updated_at ON public.nex_collection_fetch_errors;
CREATE TRIGGER trg_nex_collection_fetch_errors_touch_updated_at
  BEFORE UPDATE ON public.nex_collection_fetch_errors
  FOR EACH ROW EXECUTE FUNCTION public.nex_collection_fetch_errors_touch_updated_at();

CREATE INDEX IF NOT EXISTS ix_nex_collection_fetch_errors_target_domain
  ON public.nex_collection_fetch_errors(target_domain);
CREATE INDEX IF NOT EXISTS ix_nex_collection_fetch_errors_dead
  ON public.nex_collection_fetch_errors(dead);
CREATE INDEX IF NOT EXISTS ix_nex_collection_fetch_errors_retry_scheduled_at
  ON public.nex_collection_fetch_errors(retry_scheduled_at) WHERE dead = false;

ALTER TABLE public.nex_collection_fetch_errors ENABLE ROW LEVEL SECURITY;
