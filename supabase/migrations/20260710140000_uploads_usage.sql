-- Storage-cost safety table.
--
-- Per-owner cumulative upload byte count. Every write endpoint that
-- accepts a photo/video URL runs assertUploadAllowedFromDb() BEFORE
-- persisting the row — that enforces the "Free = access, Paid =
-- upload" rule at the write path, not just the client. Cheating the
-- client tier gate no longer works.
--
-- The owner_slug is a merchant listing slug for merchant-scoped
-- uploads, and the anonymous-reviewer-cookie for review photos. That
-- way anonymous review photos count against the reviewer, not any
-- merchant.

CREATE TABLE IF NOT EXISTS hammerex_uploads_usage (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_slug       text NOT NULL,
  owner_kind       text NOT NULL CHECK (owner_kind IN ('merchant','reviewer','system')),
  upload_kind      text NOT NULL CHECK (upload_kind IN (
    'canteen-image','canteen-video','profile-image','review-photo',
    'yard-image','yard-video','trade-center-product-image','other'
  )),
  size_bytes       int NOT NULL,
  storage_url      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_uploads_usage_owner
  ON hammerex_uploads_usage (owner_slug, owner_kind);

CREATE INDEX IF NOT EXISTS hammerex_uploads_usage_kind
  ON hammerex_uploads_usage (owner_slug, upload_kind, created_at DESC);

ALTER TABLE hammerex_uploads_usage ENABLE ROW LEVEL SECURITY;
-- No public reads. Service role bypasses RLS.
