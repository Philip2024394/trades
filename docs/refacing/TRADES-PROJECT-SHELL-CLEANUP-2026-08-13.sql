-- ═══════════════════════════════════════════════════════════════════════
-- TRADES-PROJECT SHELL CLEANUP · 2026-08-13
--
-- Run this in the SUPABASE STUDIO for the TRADES project · (msdonk...)
-- ↑↑↑  DO NOT RUN THIS IN THE NEX PROJECT (ijvqdv...) — IT WOULD WIPE THE DATA
--
-- Context (audit 2026-08-13):
--   The 13 NEX-owned tables listed below exist as EMPTY SHELLS in the trades
--   project. The audit confirmed all rowcounts = 0 in trades. All live NEX
--   data (302 seeds + 301 queue rows + 170 fetch errors) is in the NEX
--   project only. Dropping these shells prevents any future misrouted write
--   from silently landing in the wrong project.
--
--   Zero data loss · every table verified empty before this SQL was produced.
--
-- Safety:
--   · Idempotent (IF EXISTS) — safe to re-run.
--   · SELECT COUNT(*) preamble aborts if any table unexpectedly has rows.
--   · If ANY table returns non-zero rows, the DO block RAISES and no DROPs run.
-- ═══════════════════════════════════════════════════════════════════════

-- Safety preamble: prove every table is still empty · abort if any has data.
-- If this fails, STOP and re-audit before dropping anything.
DO $$
DECLARE
  t text;
  n bigint;
  tables text[] := ARRAY[
    'directory_seeds',
    'nex_collection_url_queue',
    'nex_collection_fetch_errors',
    'nex_materials_hardwood_boards',
    'nex_materials_hardwood_packs',
    'nex_materials_sheets',
    'nex_materials_hardware',
    'nex_events',
    'nex_contacts',
    'nex_refacing_cases',
    'nex_reference_images',
    'nex_membership_activations',
    'nex_chat_threads'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION
          'ABORT · table public.% has % row(s) in this project · NOT dropping · re-audit before running this SQL',
          t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

-- All tables confirmed empty (or absent). Safe to drop.
DROP TABLE IF EXISTS public.nex_chat_threads             CASCADE;
DROP TABLE IF EXISTS public.nex_membership_activations   CASCADE;
DROP TABLE IF EXISTS public.nex_reference_images         CASCADE;
DROP TABLE IF EXISTS public.nex_refacing_cases           CASCADE;
DROP TABLE IF EXISTS public.nex_contacts                 CASCADE;
DROP TABLE IF EXISTS public.nex_events                   CASCADE;
DROP TABLE IF EXISTS public.nex_materials_hardware       CASCADE;
DROP TABLE IF EXISTS public.nex_materials_sheets         CASCADE;
DROP TABLE IF EXISTS public.nex_materials_hardwood_packs CASCADE;
DROP TABLE IF EXISTS public.nex_materials_hardwood_boards CASCADE;
DROP TABLE IF EXISTS public.nex_collection_fetch_errors  CASCADE;
DROP TABLE IF EXISTS public.nex_collection_url_queue     CASCADE;
DROP TABLE IF EXISTS public.directory_seeds              CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- Verification (optional · run in the same session)
-- Every row below should read `absent` after the drops above.
-- ═══════════════════════════════════════════════════════════════════════
SELECT
  t.table_name,
  CASE WHEN i.table_name IS NULL THEN 'absent' ELSE 'STILL PRESENT' END AS status
FROM (
  VALUES
    ('directory_seeds'),
    ('nex_collection_url_queue'),
    ('nex_collection_fetch_errors'),
    ('nex_materials_hardwood_boards'),
    ('nex_materials_hardwood_packs'),
    ('nex_materials_sheets'),
    ('nex_materials_hardware'),
    ('nex_events'),
    ('nex_contacts'),
    ('nex_refacing_cases'),
    ('nex_reference_images'),
    ('nex_membership_activations'),
    ('nex_chat_threads')
) AS t(table_name)
LEFT JOIN information_schema.tables i
  ON i.table_schema = 'public' AND i.table_name = t.table_name
ORDER BY t.table_name;
