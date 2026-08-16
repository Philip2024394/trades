-- COPY-PASTE INTO Supabase Dashboard → SQL Editor → New Query → Run
-- (NEX project · ijvqdvsvwtwxzcqmoqit)
--
-- Mirror of deploy/postgres/init/053_drop_region_check.sql
-- Prepares the schema for Ireland (26 counties) and every future country
-- (Germany · USA · France · Netherlands · etc.) without repeated migrations.
--
-- Idempotent · safe to re-run.

ALTER TABLE directory_seeds DROP CONSTRAINT IF EXISTS directory_seeds_region_check;

SELECT pg_notify('pgrst', 'reload schema');

-- Verify · should return 0 rows
SELECT conname FROM pg_constraint
 WHERE conrelid = 'directory_seeds'::regclass
   AND conname LIKE '%region%';
