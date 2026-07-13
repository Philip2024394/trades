-- Merchant recovery status — admin-awarded badge for merchants who
-- demonstrably resolved a low-review dispute. Public trust signal
-- rendered on merchant reviews + profile focus.

CREATE TABLE IF NOT EXISTS hammerex_merchant_recovery (
  merchant_slug     text PRIMARY KEY,
  awarded_at        timestamptz NOT NULL DEFAULT now(),
  awarded_by        text NOT NULL,
  reason            text NOT NULL
);

ALTER TABLE hammerex_merchant_recovery ENABLE ROW LEVEL SECURITY;

-- Public read — the whole point of the badge is trust visibility.
DROP POLICY IF EXISTS merchant_recovery_read_all ON hammerex_merchant_recovery;
CREATE POLICY merchant_recovery_read_all ON hammerex_merchant_recovery FOR SELECT USING (true);
