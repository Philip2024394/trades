-- 129_nex_wikimedia_commons_provider.sql · Philip 2026-08-28
--
-- Registers `wikimedia_commons` in nex.provider_rate_config so the directory
-- image walker can acquire leases through the shared Provider Rate Governor.
--
-- Cadence rationale: Commons is a MediaWiki API mirror · same politeness rules
-- as wikipedia_en/id (1000ms min interval, 1 concurrent). Same infrastructure
-- provider, no reason to be more aggressive.
--
-- Doctrine:
--   · project_nex_cc_category_placeholder_imagery_2026_08_28.md
--   · project_nex_free_infrastructure_principle_2026_08_27.md
--   · ADR-0022 amendment (CC category-placeholder imagery allowed)

INSERT INTO nex.provider_rate_config (provider, min_interval_ms, max_concurrent)
VALUES ('wikimedia_commons', 1000, 1)
ON CONFLICT (provider) DO NOTHING;
