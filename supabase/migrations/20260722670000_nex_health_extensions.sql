-- Trade Intelligence · Health dashboard extensions.
-- Extra counts + provenance split (Official = regulation/trade-body,
-- Company = manufacturer/textbook/expert-quote/other) + growth series.

DROP VIEW IF EXISTS public.v_nex_knowledge_health;
CREATE VIEW public.v_nex_knowledge_health AS
WITH source_split AS (
  SELECT
    e.id, e.trade, e.status, e.confidence, e.updated_at, e.category, e.sources,
    -- An entry counts as "official" if any of its sources is a regulation
    -- or trade-body. Otherwise it's "company knowledge" (curated by us).
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(e.sources, '[]'::jsonb)) AS s
      WHERE s ->> 'kind' IN ('regulation', 'trade-body')
    ) AS is_official
  FROM public.hammerex_nex_knowledge_entries e
),
stats AS (
  SELECT
    trade,
    COUNT(*) FILTER (WHERE status = 'published')                                                 AS published,
    COUNT(*) FILTER (WHERE status = 'published' AND is_official)                                 AS official,
    COUNT(*) FILTER (WHERE status = 'published' AND NOT is_official)                             AS company,
    COUNT(*) FILTER (WHERE status = 'published' AND confidence >= 80)                            AS high_confidence,
    COUNT(*) FILTER (WHERE status = 'published' AND (sources::text = '[]' OR sources IS NULL))   AS unsourced,
    COUNT(*) FILTER (WHERE status = 'published' AND updated_at < NOW() - INTERVAL '365 days')    AS outdated,
    COUNT(DISTINCT category) FILTER (WHERE status = 'published')                                 AS categories,
    ROUND(AVG(confidence) FILTER (WHERE status = 'published'), 1)                                AS avg_confidence,
    MAX(updated_at)                                                                              AS last_updated
  FROM source_split
  GROUP BY trade
)
SELECT
  trade,
  published,
  official,
  company,
  high_confidence,
  unsourced,
  outdated,
  categories,
  avg_confidence,
  last_updated,
  LEAST(100, ROUND(high_confidence * 5.0))::INTEGER AS health_pct
FROM stats;

-- Growth series — new versions per trade per day (last 90 days).
CREATE OR REPLACE VIEW public.v_nex_knowledge_growth AS
SELECT
  DATE(created_at)  AS day,
  trade,
  COUNT(*)          AS versions_added
FROM public.hammerex_nex_knowledge_versions
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at), trade
ORDER BY day DESC;
