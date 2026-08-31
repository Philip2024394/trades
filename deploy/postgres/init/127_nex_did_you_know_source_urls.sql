-- 127_nex_did_you_know_source_urls.sql
--
-- Philip 2026-08-28 · every NEX FACT MUST cite its primary source per
-- ADR-0028 (Intelligence Constitution). Update the 20 seed rows with
-- authoritative Wikipedia URLs as primary sources. Blog sources that
-- inspired the topic discovery (Hello Flores, Indotravelteam, One Life
-- Adventures, indonesia.d) are recorded in verified_source for provenance
-- but source_url points to the CITABLE authoritative reference.
--
-- Rationale:
--   · Wikipedia entries are CC BY-SA 4.0 licensed
--   · Wikipedia has factual editorial review
--   · Blog attribution recorded but not linked as primary source (copyright)
--   · Facts themselves are not copyrightable · expression is
--
-- The walker (build in follow-up) enriches each row with additional
-- academic references and government-data references as they become
-- available.

BEGIN;

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Rafflesia_arnoldii',
  verified_source = 'wikipedia_en · cross-ref: helloflores.com/mind-blowing-facts',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'rafflesia-arnoldii';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Fauna_of_Indonesia',
  verified_source = 'wikipedia_en · cross-ref: onelifeadventures.co.uk/indonesia-guide'
WHERE slug = 'extreme-wildlife-scales';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Geology_of_Indonesia',
  verified_source = 'wikipedia_en · cross-ref: indotravelteam.com/22-facts'
WHERE slug = 'daily-seismic-activity';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Kelimutu',
  verified_source = 'wikipedia_en · cross-ref: helloflores.com/mind-blowing-facts'
WHERE slug = 'kelimutu-changing-lakes';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Languages_of_Indonesia',
  verified_source = 'wikipedia_en · cross-ref: indotravelteam.com/22-facts'
WHERE slug = 'multilingual-superpower';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Frog_legs',
  verified_source = 'wikipedia_en · cross-ref: indonesia.d/20-fun-facts'
WHERE slug = 'global-frog-leg-exporter';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Culture_of_Indonesia',
  verified_source = 'wikipedia_en · cross-ref: helloflores.com/mind-blowing-facts'
WHERE slug = 'long-fingernail-status';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Indomie',
  verified_source = 'wikipedia_en · cross-ref: indotravelteam.com/22-facts'
WHERE slug = 'indomie-obsession';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Lake_Toba',
  verified_source = 'wikipedia_en · cross-ref: onelifeadventures.co.uk/indonesia-guide',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'lake-toba-supervolcano';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Wallace_Line',
  verified_source = 'wikipedia_en · cross-ref: onelifeadventures.co.uk/indonesia-guide',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'wallace-line';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Treaty_of_Breda_(1667)',
  verified_source = 'wikipedia_en · cross-ref: onelifeadventures.co.uk/indonesia-guide',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'spice-islands-manhattan';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Borobudur',
  verified_source = 'wikipedia_en · UNESCO listing · cross-ref: onelifeadventures.co.uk/indonesia-guide',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'borobudur-temple-miracle';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Toraja',
  verified_source = 'wikipedia_en · cross-ref: helloflores.com/mind-blowing-facts',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'torajan-death-rituals';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Sidoarjo_mud_flow',
  verified_source = 'wikipedia_en · Lusi Lapindo mudflow'
WHERE slug = 'lusi-mud-volcano';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Nusantara_(planned_city)',
  verified_source = 'wikipedia_en · Government of Indonesia announcement'
WHERE slug = 'sinking-jakarta';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Ijen',
  verified_source = 'wikipedia_en · cross-ref: helloflores.com/mind-blowing-facts',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'ijen-blue-flame-miners';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Sama-Bajau',
  verified_source = 'wikipedia_en · Nature Ecology 2018 (Ilardo et al · Bajau spleen study)'
WHERE slug = 'bajau-sea-nomads';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Kujang_(weapon)',
  verified_source = 'wikipedia_en · Sundanese cultural reference',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'kujang-sacred-weapon';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Javan_hawk-eagle',
  verified_source = 'wikipedia_en · Indonesian Coat of Arms · Garuda Pancasila'
WHERE slug = 'javan-hawk-eagle-garuda';

UPDATE nex.brain_did_you_know_indonesia SET
  source_url = 'https://en.wikipedia.org/wiki/Gamelan',
  verified_source = 'wikipedia_en · UNESCO Intangible Cultural Heritage 2021',
  licence_terms = 'Wikipedia · CC BY-SA 4.0'
WHERE slug = 'gamelan-asmr-shimmers';

COMMIT;
