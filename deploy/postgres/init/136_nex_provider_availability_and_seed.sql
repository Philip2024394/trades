-- 136_nex_provider_availability_and_seed.sql · Philip 2026-08-29
--
-- v4 locks:
--   Lock 33 · V1 eligibility = active + city + is_available
--   Lock 34 · manual availability toggle on provider profile
--
-- Also seeds a small Yogyakarta provider bench so the mobility demo has
-- real DB rows to broadcast to.

-- ── Availability toggle · lock 33 + 34 ───────────────────────────────
ALTER TABLE nex.provider_profile
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_provider_profile_available_broadcast
  ON nex.provider_profile (city, status, is_available)
  WHERE is_available = true AND status = 'active';

COMMENT ON COLUMN nex.provider_profile.is_available IS
  'Manual toggle · provider turns on to receive broadcast requests · lock 34 · off by default · V1 eligibility uses this + city + status=active';

-- ── Seed a small Yogyakarta provider bench for the mobility demo ─────
-- Real UUIDs · idempotent via ON CONFLICT DO NOTHING keyed on learner_ref.
-- Each row references a real bike_slug from the 50-bike taxonomy so the
-- MobilityConnection component can render the exact bike + colour.

INSERT INTO nex.provider_profile
  (learner_ref, full_name, whatsapp_e164, bike_slug, bike_year, bike_color_hex,
   plate, city, secondary_language, provides_raincoat,
   status, is_available, price_per_service_idr)
VALUES
  ('device:demo-andi-yogya-2026',    'Andi',   '+6281234000001', 'honda-vario-160-red',      2023, '#111827', 'AB 4218 UY', 'Yogyakarta', 'Jawa',    true,  'active', true, 18000),
  ('device:demo-budi-yogya-2026',    'Budi',   '+6281234000002', 'honda-adv-160-yellow',     2024, '#dc2626', 'AB 8877 XY', 'Yogyakarta', 'English', false, 'active', true, 28000),
  ('device:demo-rina-yogya-2026',    'Rina',   '+6281234000003', 'yamaha-nmax-155',          2022, '#3b82f6', 'AB 1256 CC', 'Yogyakarta', 'English', true,  'active', true, 22000),
  ('device:demo-wayan-yogya-2026',   'Wayan',  '+6281234000004', 'yamaha-aerox-155',         2023, '#22c55e', 'AB 9032 KL', 'Yogyakarta', NULL,      true,  'active', true, 20000),
  ('device:demo-sari-yogya-2026',    'Sari',   '+6281234000005', 'honda-scoopy-110-turquoise', 2022, '#ec4899', 'AB 6611 PP', 'Yogyakarta', 'English', true,  'active', true, 15000),
  ('device:demo-yusuf-yogya-2026',   'Yusuf',  '+6281234000006', 'honda-beat-110-black',     2024, '#111827', 'AB 3399 WW', 'Yogyakarta', 'Jawa',    false, 'active', false, 14000),  -- OFFLINE · not eligible
  ('device:demo-made-yogya-2026',    'Made',   '+6281234000007', 'yamaha-grand-filano-125',  2024, '#94a3b8', 'AB 7788 FF', 'Yogyakarta', 'English', true,  'pending_review', true, 17000)  -- pending · not eligible
ON CONFLICT (learner_ref) DO NOTHING;

COMMENT ON TABLE nex.provider_profile IS
  'NEX Network providers · V1 eligibility = active + city + is_available · lock 33 · Philip 2026-08-29';
