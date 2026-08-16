-- 053 · Drop region CHECK constraint · international-ready Trade Centre
-- ─────────────────────────────────────────────────────────────────────
-- Philip 2026-08-16: "Do NOT keep the UK-only region constraint. Make region
-- international. Country-specific validation handled by the application layer."
--
-- Migration 051 added a CHECK constraint limiting `region` to 12 UK values.
-- That doesn't scale to Ireland (26 counties), Germany (16 Länder), USA (50
-- states), France (18 regions), etc.
--
-- Solution: drop the CHECK constraint. Region becomes a plain text field.
-- Country-specific validation lives in the app layer (per country, the app
-- knows its valid region list).
--
-- Applies to the NEX Supabase project (ijvqdvsvwtwxzcqmoqit).
-- Run via Supabase Dashboard → SQL Editor. Idempotent.
--
-- Note: existing 471 UK records with region='NW', 'London', etc. remain
-- unaffected · we're only removing the enum check, not the values.

ALTER TABLE directory_seeds DROP CONSTRAINT IF EXISTS directory_seeds_region_check;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');

-- Verify · the check constraint should no longer appear
SELECT conname FROM pg_constraint
 WHERE conrelid = 'directory_seeds'::regclass
   AND conname LIKE '%region%';
