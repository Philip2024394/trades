-- Phase Bc addition — lead status tracking on install leads.
--
-- `lead_status` — where the trade thinks the lead is in their pipeline.
--   • open       (default — new, untouched)
--   • follow_up  (they've chased, waiting on the shopper)
--   • won        (booked the job)
--   • lost       (shopper went elsewhere / didn't respond)
-- `status_updated_at` — when the trade last touched it.
-- `status_note` — freeform, capped at 500 chars, "why they went cold" etc.
--
-- Nullable status_updated_at + status_note; lead_status defaults to
-- 'open' so existing rows don't need a backfill.

ALTER TABLE hammerex_xrated_install_leads
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'open'
    CHECK (lead_status IN ('open', 'follow_up', 'won', 'lost'));

ALTER TABLE hammerex_xrated_install_leads
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;

ALTER TABLE hammerex_xrated_install_leads
  ADD COLUMN IF NOT EXISTS status_note text
    CHECK (status_note IS NULL OR char_length(status_note) BETWEEN 1 AND 500);
