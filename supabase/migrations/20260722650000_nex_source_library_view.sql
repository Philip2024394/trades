-- Source Library — one row per unique source across every entry.
-- Sources live inline on entries as JSONB. This view unnests them so
-- staff can browse a proper library and see which entries cite each.

CREATE OR REPLACE VIEW public.v_nex_source_library AS
SELECT
  COALESCE(
    LOWER(BTRIM(src ->> 'title')),
    'unknown'
  )                                                              AS source_key,
  MIN(src ->> 'title')                                           AS title,
  MIN(src ->> 'url')                                             AS url,
  MIN(src ->> 'kind')                                            AS kind,
  COUNT(DISTINCT e.id)                                           AS entry_count,
  ARRAY_AGG(DISTINCT e.trade)                                    AS trades,
  ARRAY_AGG(DISTINCT e.id ORDER BY e.id)                         AS entry_ids,
  MAX(e.updated_at)                                              AS last_cited_at
FROM public.hammerex_nex_knowledge_entries e,
     jsonb_array_elements(COALESCE(e.sources, '[]'::jsonb)) AS src
WHERE e.status = 'published'
GROUP BY LOWER(BTRIM(src ->> 'title'));

COMMENT ON VIEW public.v_nex_source_library IS
  'One row per unique source title across all published entries. entry_count reveals how load-bearing each source is.';
