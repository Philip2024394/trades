-- Watermark registry — the ground truth for image provenance +
-- perceptual-hash monitoring.
--
-- Two tables:
--   watermark_images     — canonical row per image with original hash,
--                          license status, and current tier
--   watermark_incidents  — every time we detect a repost via
--                          reverse-image or user report we log it
--                          here for the admin DMCA dashboard

BEGIN;

CREATE TABLE IF NOT EXISTS watermark_images (
  image_id text PRIMARY KEY,
  -- The image's original aHash. Used to match reposts even when
  -- watermarks are stripped.
  original_ahash char(16) NOT NULL,
  -- The most recent output aHash (post-watermark).
  latest_output_ahash char(16),
  -- Which tier is CURRENTLY served for this image. When a full
  -- buyout completes we flip to "clean".
  current_tier text NOT NULL DEFAULT 'preview',
  -- Free-form JSONB of applied watermark layers per tier — helps us
  -- reproduce the exact processing that produced the served bytes.
  applied_layers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_tier IN ('preview', 'standard', 'clean'))
);

CREATE INDEX IF NOT EXISTS watermark_images_ahash_idx
  ON watermark_images (original_ahash);

CREATE TABLE IF NOT EXISTS watermark_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id text NOT NULL REFERENCES watermark_images(image_id) ON DELETE CASCADE,
  -- Where we found it (URL).
  found_at_url text NOT NULL,
  -- How we found it (reverse_image / user_report / referrer_traffic).
  detection_method text NOT NULL,
  -- Hamming distance between our aHash and the found image.
  distance int NOT NULL DEFAULT 0,
  -- Status of the incident (open / dmca_sent / resolved / ignored).
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS watermark_incidents_image_status_idx
  ON watermark_incidents (image_id, status);

-- Auto-touch updated_at on watermark_images.
CREATE OR REPLACE FUNCTION watermark_images_touch_updated()
  RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS watermark_images_touch_updated ON watermark_images;
CREATE TRIGGER watermark_images_touch_updated
  BEFORE UPDATE ON watermark_images
  FOR EACH ROW
  EXECUTE FUNCTION watermark_images_touch_updated();

ALTER TABLE watermark_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE watermark_incidents ENABLE ROW LEVEL SECURITY;

-- Public read on watermark_images so the redirect landing can look
-- up provenance for any imageId (no PII).
DROP POLICY IF EXISTS watermark_images_public_read ON watermark_images;
CREATE POLICY watermark_images_public_read
  ON watermark_images
  FOR SELECT
  USING (true);

-- Incidents are admin-only.
DROP POLICY IF EXISTS watermark_incidents_admin ON watermark_incidents;
CREATE POLICY watermark_incidents_admin
  ON watermark_incidents
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
