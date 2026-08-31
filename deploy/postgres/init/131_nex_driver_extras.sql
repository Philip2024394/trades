-- 131_nex_driver_extras.sql · Philip 2026-08-29
--
-- Additional driver profile fields:
--   · secondary_language · one language they speak besides Bahasa Indonesia
--     (useful for tourists · e.g. English, Mandarin, Japanese, Korean, Arabic)
--   · provides_raincoat · whether they carry a passenger raincoat (huge
--     signal during rainy season · Java + Bali monsoon Oct-Apr)

ALTER TABLE nex.driver_profile
  ADD COLUMN IF NOT EXISTS secondary_language text,
  ADD COLUMN IF NOT EXISTS provides_raincoat  boolean NOT NULL DEFAULT false;

-- Common secondary language values (constrained loosely · store lowercase ISO-ish)
-- Free-text kept so drivers can enter regional languages (jawa, sunda, batak) too.
