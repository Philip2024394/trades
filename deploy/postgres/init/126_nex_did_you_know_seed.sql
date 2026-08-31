-- 126_nex_did_you_know_seed.sql
--
-- Seed the 20 hand-curated Philip-brainstormed Indonesia facts · 2026-08-28.
-- Categorized · regioned · sourced. All verifiable public knowledge.

BEGIN;

INSERT INTO nex.brain_did_you_know_indonesia
  (slug, title, body, category, region_slug, region_label, difficulty, priority)
VALUES
  ('rafflesia-arnoldii', 'The World''s Largest Flower',
    'Indonesia is home to the Rafflesia arnoldii, which produces individual flowers growing up to three feet wide and weighing up to 15 pounds. It emits a rotting meat odor to attract flies.',
    'nature', 'sumatra', 'Sumatra', 3, 9),

  ('extreme-wildlife-scales', 'Extreme Wildlife Scales',
    'The country hosts extreme wildlife contrasts, including the pygmy tarsier — one of the world''s smallest primates — alongside the massive Komodo dragon, the world''s largest lizard.',
    'nature', 'national', 'Sulawesi & Komodo Island', 2, 8),

  ('daily-seismic-activity', 'Daily Seismic Activity',
    'Due to its position on multiple crashing tectonic plates along the Pacific Ring of Fire, Indonesia experiences small seismic vibrations and minor earthquakes almost daily.',
    'geology', 'national', 'National', 2, 8),

  ('kelimutu-changing-lakes', 'The Changing Volcanic Lakes',
    'Mount Kelimutu on Flores Island features three crater lakes that periodically change colors — shifting from blue and green to black or red — due to volcanic gas mineral reactions.',
    'geology', 'flores', 'Flores · East Nusa Tenggara', 4, 9),

  ('multilingual-superpower', 'A Multilingual Superpower',
    'While Bahasa Indonesia is the official language, over 700 local indigenous languages are spoken across the archipelago, making the vast majority of citizens naturally multilingual.',
    'language', 'national', 'National', 2, 9),

  ('global-frog-leg-exporter', 'Global Frog Leg Exporter',
    'Indonesia is the world''s largest exporter of culinary frog legs, shipping thousands of tons of them to European countries like France, Belgium, and the Netherlands every year.',
    'food', 'national', 'National', 3, 7),

  ('long-fingernail-status', 'Long Fingernail Status Symbol',
    'In certain traditional Indonesian professional environments, some men grow one pinky fingernail long as a social indicator that they do not engage in heavy manual agricultural labor.',
    'culture', 'java', 'Java', 3, 6),

  ('indomie-obsession', 'Instant Noodle Obsession',
    'Indonesia is the world''s second-largest consumer of instant noodles. Its iconic homegrown brand, Indomie, is deeply woven into the country''s culinary identity and daily survival.',
    'food', 'national', 'National', 1, 8),

  ('lake-toba-supervolcano', 'The Largest Volcanic Lake',
    'Lake Toba in Sumatra is the site of a supervolcanic eruption that occurred 74,000 years ago, creating the world''s largest volcanic lake and causing a global volcanic winter.',
    'geology', 'sumatra', 'North Sumatra', 4, 10),

  ('wallace-line', 'The Wallace Line Division',
    'An invisible deep-water trench line running between Bali and Lombok separates Asian-origin wildlife — like tigers and elephants — from Australasian-origin wildlife like marsupials.',
    'nature', 'bali-lombok', 'Bali & Lombok', 4, 10),

  ('spice-islands-manhattan', 'The Spice Islands Manhattan Trade',
    'The Maluku Islands were once the world''s only source of nutmeg. In 1667, the Dutch traded the island of Manhattan to the British just to secure a monopoly over these spice islands.',
    'history', 'maluku', 'Maluku Islands', 5, 10),

  ('borobudur-temple-miracle', 'The Borobudur Temple Miracle',
    'Located in Central Java, Borobudur is the world''s largest Buddhist temple. Built in the 9th century without any mortar or cement, it resembles a giant interlocking puzzle.',
    'history', 'central-java', 'Central Java', 4, 10),

  ('torajan-death-rituals', 'The Torajan Death Rituals',
    'In Tana Toraja, Sulawesi, deceased relatives are kept in the family home for months or years, treated as if they are merely sick, until a massive expensive funeral can be held.',
    'rituals', 'south-sulawesi', 'Tana Toraja · South Sulawesi', 5, 10),

  ('lusi-mud-volcano', 'The Mud Volcano of Sidoarjo',
    'Indonesia is home to Lusi, the world''s largest active mud volcano, which began eruptively in East Java in 2006 and continues to spew hot mud over entire villages.',
    'geology', 'east-java', 'Sidoarjo · East Java', 4, 8),

  ('sinking-jakarta', 'Sinking Capital City',
    'Jakarta is one of the fastest-sinking capitals in the world, with some areas sinking up to 10 inches per year, forcing the country to build a brand new capital city named Nusantara.',
    'geology', 'jakarta', 'Jakarta', 3, 9),

  ('ijen-blue-flame-miners', 'The Death-Defying Sulfur Miners',
    'Miners at the Ijen crater in East Java hike into an active volcano at night to extract solid yellow sulfur under toxic gases, illuminated by rare, natural blue volcanic flames.',
    'culture', 'east-java', 'Ijen Crater · East Java', 5, 10),

  ('bajau-sea-nomads', 'The Bajau Sea Nomads',
    'The Bajau people live their entire lives on stilt houses over the ocean or on boats. Generations of free-diving have genetically adapted them to hold their breath underwater for over 10 minutes.',
    'culture', 'sulawesi', 'Sulawesi / Sulu Sea', 4, 10),

  ('kujang-sacred-weapon', 'The Kujang Sacred Weapon',
    'The Kujang is a traditional blade-shaped weapon from West Java believed to hold spiritual energy. Its distinct curved shape is inspired by the paw or claw of a tiger.',
    'culture', 'west-java', 'West Java · Sundanese', 4, 7),

  ('javan-hawk-eagle-garuda', 'The Javan Hawk-Eagle Inspiration',
    'The endangered Javan hawk-eagle is the physical inspiration behind the Garuda, the mythical bird-like creature that serves as Indonesia''s national symbol and coat of arms.',
    'nature', 'java', 'Java', 3, 8),

  ('gamelan-asmr-shimmers', 'The ASMR of Gamelan Music',
    'Traditional Indonesian gamelan music uses bronze gongs and metallophones tuned to specific scales that intentionally create acoustic beats — shimmers — when struck together.',
    'culture', 'java-bali', 'Java & Bali', 3, 8)

ON CONFLICT (slug) DO NOTHING;

COMMIT;
