-- Xrated Trades — FAQ Page add-on.
--
-- Upgrades the free-tier inline FAQ accordion (faq_items JSONB on the
-- listing row) into a full visual knowledge base:
--
-- 1. hammerex_xrated_faq_items — per-listing FAQ rows. Each row carries
--    a ref_code (FAQ-001 / FAQ-002 / …), a category (general / pricing /
--    process / materials / trust / warranty / aftercare), a question
--    (5-200 chars) and an answer (5-2000 chars). Soft-archive only.
--    Capped at 50 LIVE per listing via trigger so the dedicated page
--    stays scannable.
--
-- 2. hammerex_xrated_faq_images — up to 3 images per FAQ. Each image
--    carries its own title (1-80 chars) plus optional alt_text. A trigger
--    enforces the 3-per-FAQ cap so the editor + API + manual SQL all
--    converge on the same limit.
--
-- The shared hammerex_xrated_touch_updated_at() trigger function already
-- exists (created in the Shop Mode migration) so we DROP-CREATE the
-- trigger only on hammerex_xrated_faq_items.

CREATE TABLE IF NOT EXISTS hammerex_xrated_faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  ref_code text NOT NULL,
  question text NOT NULL CHECK (char_length(question) BETWEEN 5 AND 200),
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 5 AND 2000),
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','pricing','process','materials','trust','warranty','aftercare')),
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','archived')),
  sort_order int NOT NULL DEFAULT 0,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hammerex_xrated_faq_items_ref_code_format
    CHECK (ref_code ~ '^FAQ-[0-9]{3,4}$'),
  UNIQUE (listing_id, ref_code)
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_faq_items_listing_status_sort_idx
  ON hammerex_xrated_faq_items (listing_id, status, sort_order);
CREATE INDEX IF NOT EXISTS hammerex_xrated_faq_items_listing_category_idx
  ON hammerex_xrated_faq_items (listing_id, category) WHERE status = 'live';

CREATE TABLE IF NOT EXISTS hammerex_xrated_faq_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_id uuid NOT NULL REFERENCES hammerex_xrated_faq_items(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  alt_text text CHECK (alt_text IS NULL OR char_length(alt_text) <= 200),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hammerex_xrated_faq_images_faq_sort_idx
  ON hammerex_xrated_faq_images (faq_id, sort_order);

-- Image cap trigger — 3 per FAQ. The editor caps client-side and the
-- API caps server-side, but the trigger is the final guard so manual
-- SQL inserts can't break the layout invariants.
CREATE OR REPLACE FUNCTION hammerex_xrated_faq_images_cap()
RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM hammerex_xrated_faq_images WHERE faq_id = NEW.faq_id) >= 3 THEN
    RAISE EXCEPTION 'Max 3 images per FAQ';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_xrated_faq_images_cap_trg ON hammerex_xrated_faq_images;
CREATE TRIGGER hammerex_xrated_faq_images_cap_trg
  BEFORE INSERT ON hammerex_xrated_faq_images
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_faq_images_cap();

-- 50 live FAQs cap per listing. status='live' only — a tradesperson
-- can archive old questions without losing the data.
CREATE OR REPLACE FUNCTION hammerex_xrated_faq_items_cap()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'live' AND (
    SELECT count(*) FROM hammerex_xrated_faq_items
    WHERE listing_id = NEW.listing_id AND status = 'live'
  ) >= 50 THEN
    RAISE EXCEPTION 'Max 50 live FAQs per listing';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hammerex_xrated_faq_items_cap_trg ON hammerex_xrated_faq_items;
CREATE TRIGGER hammerex_xrated_faq_items_cap_trg
  BEFORE INSERT ON hammerex_xrated_faq_items
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_faq_items_cap();

DROP TRIGGER IF EXISTS hammerex_xrated_faq_items_touch ON hammerex_xrated_faq_items;
CREATE TRIGGER hammerex_xrated_faq_items_touch
  BEFORE UPDATE ON hammerex_xrated_faq_items
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();
