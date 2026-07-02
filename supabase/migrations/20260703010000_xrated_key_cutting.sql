-- Key Cutting service add-on.
--
-- Stored as a single JSONB column on the listing so the merchant can
-- flip categories on/off, adjust prices, toggle fulfilment modes and
-- update the banner without a schema migration.
--
-- Shape:
--   {
--     "categories": {
--       "cylinder":         { "enabled": true, "price_from_pence": 600,  "note": "" },
--       "mortice":          { "enabled": true, "price_from_pence": 800,  "note": "" },
--       "padlock":          { "enabled": true, "price_from_pence": 600,  "note": "" },
--       "dimple":           { "enabled": false,"price_from_pence": 1800, "note": "" },
--       "restricted":       { "enabled": false,"price_from_pence": 2500, "note": "Mul-T-Lock, EVVA, ASSA" },
--       "car_mechanical":   { "enabled": false,"price_from_pence": 2000, "note": "" },
--       "car_transponder":  { "enabled": false,"price_from_pence": 9000, "note": "Bring the vehicle" },
--       "car_remote":       { "enabled": false,"price_from_pence": 18000,"note": "Book in advance" }
--     },
--     "modes": { "walk_in": true, "photo_scan": true, "postal": false },
--     "machine_brand": "Silca",
--     "years_cutting": 22,
--     "restricted_brands": ["Mul-T-Lock"],
--     "postal_address": "Stuart Kingsley Building Merchant, ...",
--     "postal_turnaround_hours": 48,
--     "banner_image_url": "https://ik.imagekit.io/...",
--     "custom_note": "In-store cutting during counter hours (7am–5pm Mon–Fri, 7am–1pm Sat)."
--   }

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS key_cutting jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN hammerex_trade_off_listings.key_cutting IS
  'Key Cutting add-on config. See migration file for full JSONB shape.';
