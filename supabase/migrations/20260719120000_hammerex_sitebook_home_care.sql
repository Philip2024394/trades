-- SiteBook Home Care — maintenance reminders per homeowner.
-- Phase 1 · Blueprint v2.2 (2026-07-19).
--
-- Every fitted item / seasonal chore that comes due (boiler service,
-- gutter clean, chimney sweep, smoke alarm batteries, gas safety
-- check, EICR, roof inspection, drain rod). SiteBook silently pings
-- the homeowner + suggests rebooking the trade who did it last.
--
-- MVP: manual seed + auto-populate from job-complete posts. Later:
-- IoT hooks (smart boiler reports service status directly).

CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_home_care_items (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id         UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,

  -- Canonical maintenance kinds. Loose text so we can add more
  -- without a migration; UI groups by kind for the icon + copy.
  --   boiler_service · gutter_clean · chimney_sweep · smoke_alarm_battery
  --   gas_safety · eicr · roof_inspection · drain_rod · window_clean
  --   septic_empty · pat_test · alarm_service · other
  kind                 TEXT          NOT NULL,

  title                TEXT          NOT NULL,           -- e.g. "Boiler service"
  description          TEXT,                             -- e.g. "Annual service — Worcester Bosch 30i"

  cadence_days         INTEGER,                          -- typical recurrence (365 for boiler)
  last_done_at         TIMESTAMPTZ,
  next_due_at          TIMESTAMPTZ   NOT NULL,           -- when this reminder becomes "due"

  -- Who did it last — one-tap rebook link. Nullable when the homeowner
  -- has never booked this before (they'd need to pick a fresh trade).
  previous_trade_listing_id  UUID,
  previous_trade_slug        TEXT,
  previous_trade_name        TEXT,

  -- Homeowner controls: snooze pushes next_due_at forward without
  -- losing history; dismiss marks it done without booking (they did
  -- it themselves / no longer relevant).
  snoozed_until        TIMESTAMPTZ,
  dismissed_at         TIMESTAMPTZ,

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Fastest read: "what's due for this homeowner, soonest first?"
CREATE INDEX IF NOT EXISTS idx_home_care_upcoming
  ON public.hammerex_sitebook_home_care_items (homeowner_id, next_due_at ASC)
  WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_home_care_kind
  ON public.hammerex_sitebook_home_care_items (kind);

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_home_care_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_home_care_touch ON public.hammerex_sitebook_home_care_items;
CREATE TRIGGER trg_home_care_touch
  BEFORE UPDATE ON public.hammerex_sitebook_home_care_items
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_home_care_touch();

ALTER TABLE public.hammerex_sitebook_home_care_items ENABLE ROW LEVEL SECURITY;
