-- 133_nex_rental_airport_pickup.sql · Philip 2026-08-29
--
-- Add airport-pickup-on-arrival flag to bike rental listings. Big
-- differentiator for tourists arriving at DPS/CGK/JOG/SUB — they can
-- book a bike waiting for them at arrivals instead of scrambling for
-- Grab + then a rental shop the next day.

ALTER TABLE nex.bike_rental_listing
  ADD COLUMN IF NOT EXISTS airport_pickup_on_arrival boolean NOT NULL DEFAULT false;

-- Give the seeded rentals a mix so the demo shows the badge in action
UPDATE nex.bike_rental_listing SET airport_pickup_on_arrival = true
  WHERE slug IN ('bali-scooter-rent-canggu','lombok-two-wheels','gili-adventure-bikes','sanur-electric-mobility');
