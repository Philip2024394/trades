-- Xrated Trades — Downloads add-on.
--
-- 1. hammerex_xrated_downloads — per-listing file library. Stores PDFs,
--    Word/Excel docs and images that the tradesperson wants customers
--    to download — brochures, catalogues, trade-account application
--    forms, RAMS / method statements, qualification certs, insurance
--    certs. file_url points at a public Supabase Storage object inside
--    the shared product-images bucket (under the downloads/ prefix).
--
-- 2. hammerex_xrated_download_leads — captured email leads. Populated
--    only when a download has requires_email=true; one row per download
--    event. ip_hash lets us spot abusive scrapers without storing raw
--    IPs.
--
-- Both tables ON DELETE CASCADE from the listing row. The shared
-- hammerex_xrated_touch_updated_at() trigger function already exists
-- (created in the Shop Mode migration) so we DROP-CREATE the trigger
-- only.

CREATE TABLE IF NOT EXISTS hammerex_xrated_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf','doc','docx','xls','xlsx','jpg','jpeg','png','other')),
  file_size_bytes int CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('brochure','form','compliance','catalogue','qualification','other')),
  requires_email boolean NOT NULL DEFAULT false,
  cover_image_url text,
  download_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','archived')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_downloads_listing_idx
  ON hammerex_xrated_downloads (listing_id, status, sort_order);

CREATE TABLE IF NOT EXISTS hammerex_xrated_download_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  download_id uuid NOT NULL REFERENCES hammerex_xrated_downloads(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text,
  ip_hash text,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_download_leads_download_idx
  ON hammerex_xrated_download_leads (download_id, downloaded_at DESC);

DROP TRIGGER IF EXISTS hammerex_xrated_downloads_touch ON hammerex_xrated_downloads;
CREATE TRIGGER hammerex_xrated_downloads_touch
  BEFORE UPDATE ON hammerex_xrated_downloads
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();
