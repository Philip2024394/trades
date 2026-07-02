// Migration — creates hammerex_plant_hire_bookings + hammerex_plant_hire_reports.
// Idempotent (uses CREATE IF NOT EXISTS).

import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return txt;
}

const sql = `
CREATE TABLE IF NOT EXISTS public.hammerex_plant_hire_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL,
  reference TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  machine_slug TEXT NOT NULL,
  machine_label TEXT,
  duration TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  wet_hire BOOLEAN NOT NULL DEFAULT FALSE,
  date_from DATE,
  date_to DATE,
  delivery_postcode TEXT,
  site_address TEXT,
  attachments TEXT,
  notes TEXT,
  subtotal_pence INT,
  deposit_pence INT,
  deposit_status TEXT NOT NULL DEFAULT 'pending',
  hire_status TEXT NOT NULL DEFAULT 'requested',
  stripe_payment_intent_id TEXT,
  stripe_client_secret TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plant_bookings_listing_id ON public.hammerex_plant_hire_bookings (listing_id);
CREATE INDEX IF NOT EXISTS idx_plant_bookings_phone ON public.hammerex_plant_hire_bookings (customer_phone);
CREATE INDEX IF NOT EXISTS idx_plant_bookings_reference ON public.hammerex_plant_hire_bookings (reference);

CREATE TABLE IF NOT EXISTS public.hammerex_plant_hire_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.hammerex_plant_hire_bookings(id) ON DELETE SET NULL,
  listing_id UUID NOT NULL,
  kind TEXT NOT NULL,
  hire_reference TEXT,
  machine_slug TEXT,
  machine_label TEXT,
  photo_urls TEXT[],
  signature_url TEXT,
  hour_meter NUMERIC,
  fuel_percent INT,
  damage_location TEXT,
  damage_severity TEXT,
  damage_description TEXT,
  phase TEXT,
  reporter_name TEXT NOT NULL,
  reporter_phone TEXT NOT NULL,
  reporter_email TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plant_reports_listing_id ON public.hammerex_plant_hire_reports (listing_id);
CREATE INDEX IF NOT EXISTS idx_plant_reports_booking_id ON public.hammerex_plant_hire_reports (booking_id);
CREATE INDEX IF NOT EXISTS idx_plant_reports_phone ON public.hammerex_plant_hire_reports (reporter_phone);

DROP TRIGGER IF EXISTS trg_plant_bookings_updated_at ON public.hammerex_plant_hire_bookings;

CREATE OR REPLACE FUNCTION public.hammerex_plant_bookings_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plant_bookings_updated_at
BEFORE UPDATE ON public.hammerex_plant_hire_bookings
FOR EACH ROW EXECUTE FUNCTION public.hammerex_plant_bookings_touch();
`;

const res = await q(sql);
console.log("Migration applied:", res);
`;`;
