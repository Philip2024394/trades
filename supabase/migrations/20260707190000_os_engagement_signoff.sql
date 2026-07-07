-- Engagement sign-off — closes the operational loop.
--
-- Adds sign-off provenance columns and a bidirectional link between
-- the engagement and the final payment record it generates.

BEGIN;

-- Allow a 'signed_off' status so we can distinguish "completed" (work
-- done) from "signed_off" (owner has ratified + payment logged).
ALTER TABLE os_site_engagements
  DROP CONSTRAINT IF EXISTS os_site_engagements_status_check;

ALTER TABLE os_site_engagements
  ADD CONSTRAINT os_site_engagements_status_check
  CHECK (status IN ('pending','accepted','in_progress','completed','signed_off','disputed','cancelled'));

ALTER TABLE os_site_engagements
  ADD COLUMN IF NOT EXISTS signed_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_off_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_payment_id uuid REFERENCES os_project_payments(id) ON DELETE SET NULL;

-- Payments know which engagement they close.
ALTER TABLE os_project_payments
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES os_site_engagements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS os_project_payments_engagement_idx
  ON os_project_payments (engagement_id);

COMMIT;
