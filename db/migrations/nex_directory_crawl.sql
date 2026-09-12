-- Founder 2026-09-10 · Universal directory + social crawler.
--
-- Best-in-industry crawler infrastructure. Every URL visited is logged
-- immutably with response code, robots.txt compliance, licence terms,
-- extractor version, and content SHA256. Zero silent failures.

CREATE SCHEMA IF NOT EXISTS nex_crawler;

-- ─── Discovery targets ────────────────────────────────────────────
-- One row per crawl target (site, directory, sitemap). Populated by
-- the seeder script + expanded automatically as sitemaps are discovered.
CREATE TABLE IF NOT EXISTS nex_crawler.target (
  target_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('sitemap','directory_page','business_profile','social_profile','news_feed','api_endpoint','rss_atom','wordpress_api','forum_thread','blog_home','review_page','seed_root')),
  host            TEXT NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  country         TEXT NOT NULL DEFAULT 'ID',
  city            TEXT,
  category_hint   TEXT,
  licence_terms   TEXT, -- e.g. 'unknown', 'permissive', 'crawlable_per_terms'
  priority        INTEGER NOT NULL DEFAULT 5, -- 1 = highest
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_crawled_at TIMESTAMPTZ,
  last_status     INTEGER, -- HTTP status of last fetch
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  discovered_by   TEXT NOT NULL DEFAULT 'seed', -- 'seed' | 'sitemap' | 'link_extraction'
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS ix_target_host ON nex_crawler.target (host);
CREATE INDEX IF NOT EXISTS ix_target_active_priority ON nex_crawler.target (active, priority, last_crawled_at NULLS FIRST);

-- ─── Fetch log (immutable) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex_crawler.fetch_log (
  fetch_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id       UUID REFERENCES nex_crawler.target(target_id),
  url             TEXT NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  http_status     INTEGER,
  content_type    TEXT,
  bytes           INTEGER,
  content_sha256  TEXT,
  robots_allowed  BOOLEAN NOT NULL DEFAULT TRUE,
  robots_reason   TEXT,
  rate_limit_hit  BOOLEAN NOT NULL DEFAULT FALSE,
  extractor       TEXT, -- 'html_generic' | 'sitemap' | 'schema_org' | 'social_meta'
  parsed_count    INTEGER, -- number of records extracted
  error           TEXT,
  duration_ms     INTEGER
);
CREATE INDEX IF NOT EXISTS ix_fetch_url ON nex_crawler.fetch_log (url, fetched_at DESC);
CREATE INDEX IF NOT EXISTS ix_fetch_target ON nex_crawler.fetch_log (target_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS ix_fetch_status ON nex_crawler.fetch_log (http_status, fetched_at DESC);

-- ─── Extracted records (raw · pre-verification) ───────────────────
CREATE TABLE IF NOT EXISTS nex_crawler.extracted_record (
  record_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetch_id        UUID REFERENCES nex_crawler.fetch_log(fetch_id),
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_url      TEXT NOT NULL,
  source_host     TEXT NOT NULL,
  record_kind     TEXT NOT NULL CHECK (record_kind IN ('business','person','event','review','image','link','social_handle')),
  payload         JSONB NOT NULL, -- extracted structured data
  dedupe_hash     TEXT NOT NULL,
  extractor       TEXT NOT NULL,
  extractor_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_extracted_dedupe ON nex_crawler.extracted_record (dedupe_hash);
CREATE INDEX IF NOT EXISTS ix_extracted_kind ON nex_crawler.extracted_record (record_kind, discovered_at DESC);
CREATE INDEX IF NOT EXISTS ix_extracted_host ON nex_crawler.extracted_record (source_host);

-- ─── Rate limit tracker ───────────────────────────────────────────
-- Per-host budget so we never hammer a source. In-memory in Node · this
-- table is for persistent budget across restarts + observability.
CREATE TABLE IF NOT EXISTS nex_crawler.host_budget (
  host            TEXT PRIMARY KEY,
  max_req_per_hour INTEGER NOT NULL DEFAULT 60,
  req_this_hour   INTEGER NOT NULL DEFAULT 0,
  hour_bucket     TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  last_backoff_at TIMESTAMPTZ,
  backoff_reason  TEXT
);
