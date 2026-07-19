-- SiteBook Cost Documents — attach quotes / invoices / receipts to a
-- cost row (or to a project directly when there's no cost yet).
--
-- Phase 1.5 · Blueprint v2.2 (2026-07-19).
--
-- Answers ONE question: "What did the trade quote me?" — replaces
-- WhatsApp scrolling + inbox scavenging + lost pieces of paper.
--
-- A document is either:
--   • a PDF (quote, invoice, receipt)
--   • an Excel / CSV spreadsheet (itemised quote)
--   • an image (photo of a paper quote, screenshot)
--
-- Ownership: STRICT homeowner-private. Trades never see the doc list.
-- The upload UI lives on the homeowner's cost ledger + on the post
-- card footer once a trade has replied.
--
-- Storage: bucket 'sitebook-cost-documents' (private, signed URLs).

-- ═════════════════════════════════════════════════════════════════
-- hammerex_sitebook_cost_documents
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_cost_documents (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id          UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,

  -- A doc may pre-date the cost row it belongs to (uploaded from a
  -- post before the homeowner logged the number). Nullable so we can
  -- attach later without losing the file.
  cost_id               UUID          REFERENCES public.hammerex_sitebook_costs(id) ON DELETE SET NULL,

  -- Which post it was uploaded from (helpful for reverse lookup).
  post_id               UUID          REFERENCES public.hammerex_sitebook_posts(id) ON DELETE SET NULL,

  -- quote · invoice · receipt · spreadsheet · photo · other
  kind                  TEXT          NOT NULL DEFAULT 'quote',

  file_name             TEXT          NOT NULL,
  storage_path          TEXT          NOT NULL,      -- object path in bucket
  storage_url           TEXT          NOT NULL,      -- public URL (bucket is public, path is opaque)
  mime_type             TEXT          NOT NULL,
  size_bytes            INTEGER       NOT NULL DEFAULT 0,

  -- Optional human note ("plumber's revised quote after variation")
  note                  TEXT,

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_docs_project
  ON public.hammerex_sitebook_cost_documents (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_docs_cost
  ON public.hammerex_sitebook_cost_documents (cost_id) WHERE cost_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cost_docs_post
  ON public.hammerex_sitebook_cost_documents (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cost_docs_homeowner
  ON public.hammerex_sitebook_cost_documents (homeowner_id, created_at DESC);

ALTER TABLE public.hammerex_sitebook_cost_documents ENABLE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════
-- Storage bucket — public URL, opaque path (uuid file names).
-- Access enforced at API layer via homeowner cookie.
-- ═════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('sitebook-cost-documents', 'sitebook-cost-documents', true)
ON CONFLICT (id) DO NOTHING;
