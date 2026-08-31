-- 132_nex_bike_rental_listing.sql · Philip 2026-08-29
--
-- Bike rental company listings for /nex-bike-rental directory.
-- Each row = one rental business with:
--   · included amenities (helmets, raincoats, drop-off, tank-full)
--   · pricing tiers (per day / week / month)
--   · optional buy-out price (rent-or-buy option)
--
-- Rental listings are DISCOVERY-side entities (mp_seller cousin) · they
-- serve the "browse bike rentals" surface, not the identity/live-ride
-- system. Each rental may reference a preferred bike_slug or leave null
-- (deterministic rotation picks one from taxonomy).

CREATE TABLE IF NOT EXISTS nex.bike_rental_listing (
  rental_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text UNIQUE NOT NULL,
  name                  text NOT NULL,
  city                  text NOT NULL,
  neighbourhood         text,
  whatsapp_e164         text,
  photo_url             text,
  preferred_bike_slug   text REFERENCES nex.bike_model(slug),   -- null → rotation picks
  preferred_categories  text[] NOT NULL DEFAULT '{}',           -- for rotation filter

  -- Amenities · Philip 2026-08-29
  helmets_included      integer NOT NULL DEFAULT 1 CHECK (helmets_included >= 0),
  raincoats_included    integer NOT NULL DEFAULT 0 CHECK (raincoats_included >= 0),
  hotel_villa_dropoff   boolean NOT NULL DEFAULT false,
  tank_full_on_rental   boolean NOT NULL DEFAULT false,

  -- Pricing · IDR (Indonesian Rupiah) · integers (no cents in IDR)
  price_per_day_idr     integer,
  price_per_week_idr    integer,
  price_per_month_idr   integer,

  -- Buy option · rent-or-buy
  has_buy_option        boolean NOT NULL DEFAULT false,
  buy_price_idr         integer,

  -- Standard flags
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','paused','removed')),
  rating_avg            numeric(3,2),
  rating_count          integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bike_rental_city_status  ON nex.bike_rental_listing (city, status);
CREATE INDEX IF NOT EXISTS idx_bike_rental_buy_option   ON nex.bike_rental_listing (has_buy_option) WHERE has_buy_option = true;

-- Seed a handful so the demo has real data · Philip 2026-08-29
INSERT INTO nex.bike_rental_listing
  (slug, name, city, preferred_categories, helmets_included, raincoats_included,
   hotel_villa_dropoff, tank_full_on_rental,
   price_per_day_idr, price_per_week_idr, price_per_month_idr,
   has_buy_option, buy_price_idr)
VALUES
  ('bali-scooter-rent-canggu', 'Bali Scooter Rent · Canggu', 'Canggu',
   ARRAY['matic','maxi'], 2, 2, true, true, 70000, 400000, 1400000, false, NULL),
  ('ubud-motorbike-rental', 'Ubud Motorbike Rental', 'Ubud',
   ARRAY['matic','adventure'], 2, 1, true, false, 80000, 450000, 1500000, false, NULL),
  ('jogja-easy-ride', 'Jogja Easy Ride', 'Yogyakarta',
   ARRAY['matic','bebek'], 2, 2, false, true, 65000, 380000, 1300000, true, 18500000),
  ('lombok-two-wheels', 'Lombok Two Wheels', 'Lombok',
   ARRAY['sport','adventure'], 2, 1, true, false, 120000, 700000, 2500000, false, NULL),
  ('jakarta-express-rental', 'Jakarta Express Rental', 'Jakarta',
   ARRAY['maxi','sport'], 1, 0, false, false, 110000, 650000, 2300000, false, NULL),
  ('bandung-vintage-scooter-co', 'Bandung Vintage Scooter Co.', 'Bandung',
   ARRAY['retro'], 2, 1, false, true, 150000, 900000, 3200000, true, 42000000),
  ('gili-adventure-bikes', 'Gili Adventure Bikes', 'Gili Trawangan',
   ARRAY['adventure'], 2, 0, true, true, 140000, 850000, 3000000, false, NULL),
  ('sanur-electric-mobility', 'Sanur Electric Mobility', 'Sanur',
   ARRAY['electric'], 2, 1, true, false, 90000, 500000, 1800000, true, 22000000),
  ('malang-bike-house', 'Malang Bike House', 'Malang',
   ARRAY['matic'], 1, 1, false, false, 60000, 350000, 1200000, false, NULL)
ON CONFLICT (slug) DO NOTHING;
