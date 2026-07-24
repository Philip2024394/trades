-- Business Brain Foundation V0 — Phase 1 pending migration
--
-- Per-business knowledge system. Each business gets its own brain with
-- hard isolation via business_id FK + Postgres RLS. Complementary to
-- Trade Brains (staircase, plumbing) — Business Brains carry ONE
-- specific company's own products / prices / services / warranty.
--
-- Naming convention (permanent, from feedback_nex_business_brain_spec):
--   business_brain_businesses, business_brains, brain_*
--
-- ADR-0021 compliance: every table has business_id and RLS policies
-- so no cross-business data leakage is possible at DB level, even if
-- application logic makes a mistake.
--
-- Held in pending-migrations. Apply via Supabase migration flow.

-- ══════════════════════════════════════════════════════════════════
-- 1. business_brain_businesses — the company itself
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS business_brain_businesses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  primary_domain    TEXT NOT NULL,                    -- e.g. "stairplan.co.uk"
  owner_user_id     UUID,                             -- references auth user
  domain_verified_at TIMESTAMPTZ,                     -- when they proved they own the domain
  category_slug     TEXT,                             -- staircase_maker · parts_supplier · etc
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bb_businesses_domain_unique UNIQUE (primary_domain)
);
CREATE INDEX IF NOT EXISTS bb_businesses_owner_idx ON business_brain_businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS bb_businesses_category_idx ON business_brain_businesses(category_slug);

-- ══════════════════════════════════════════════════════════════════
-- 2. business_brains — the brain wrapper per business
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS business_brains (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'provisioning', -- provisioning · active · syncing · failed · paused
  sync_frequency    TEXT NOT NULL DEFAULT 'weekly',       -- manual · hourly · daily · weekly · monthly
  crawl_root_url    TEXT,                                 -- override seed URL (defaults to https://<primary_domain>/)
  last_synced_at    TIMESTAMPTZ,
  next_sync_due_at  TIMESTAMPTZ,
  pages_indexed     INTEGER NOT NULL DEFAULT 0,
  config_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bb_one_brain_per_business UNIQUE (business_id)
);
CREATE INDEX IF NOT EXISTS bb_brains_status_idx ON business_brains(status);
CREATE INDEX IF NOT EXISTS bb_brains_next_sync_idx ON business_brains(next_sync_due_at) WHERE status = 'active';

-- ══════════════════════════════════════════════════════════════════
-- 3. brain_pages — crawled website pages
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  url               TEXT NOT NULL,
  title             TEXT,
  description       TEXT,
  category          TEXT,                             -- home · product · service · faq · about · contact · blog · policy · downloads · other
  content_hash      TEXT NOT NULL,                    -- SHA-256 of clean_text — used for change detection
  raw_html          TEXT,
  clean_text        TEXT NOT NULL,
  word_count        INTEGER NOT NULL DEFAULT 0,
  outlinks          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  media_count       INTEGER NOT NULL DEFAULT 0,
  pdf_count         INTEGER NOT NULL DEFAULT 0,
  vector_status     TEXT NOT NULL DEFAULT 'pending',  -- pending · indexed · failed · skipped
  last_crawled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Upsert conflict key — one row per URL per brain, so a business
  -- swapping brains can keep the historical page rows around if it
  -- ever wants to (not currently exercised but keeps the door open).
  CONSTRAINT bb_pages_unique_url_per_brain UNIQUE (brain_id, url)
);
CREATE INDEX IF NOT EXISTS bb_pages_business_idx ON brain_pages(business_id);
CREATE INDEX IF NOT EXISTS bb_pages_category_idx ON brain_pages(business_id, category);
CREATE INDEX IF NOT EXISTS bb_pages_hash_idx ON brain_pages(content_hash);

-- ══════════════════════════════════════════════════════════════════
-- 4. brain_documents — uploaded PDFs, docs, images
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  source_page_id    UUID REFERENCES brain_pages(id) ON DELETE SET NULL,
  document_type     TEXT NOT NULL,                    -- pdf · doc · brochure · price_list · warranty · certificate
  url               TEXT NOT NULL,
  file_hash         TEXT NOT NULL,
  filename          TEXT,
  extracted_text    TEXT,
  page_count        INTEGER,
  indexed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bb_documents_brain_idx ON brain_documents(brain_id);
CREATE INDEX IF NOT EXISTS bb_documents_type_idx ON brain_documents(business_id, document_type);

-- ══════════════════════════════════════════════════════════════════
-- 5. brain_products — detected products
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  source_page_id    UUID REFERENCES brain_pages(id) ON DELETE SET NULL,
  slug              TEXT NOT NULL,                    -- derived from name for URL matching + upsert key
  name              TEXT NOT NULL,
  category          TEXT,
  materials         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  options           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  price_from_pence  INTEGER,                          -- may be null if no price shown
  price_display     TEXT,                             -- as shown on site: "£300 + VAT" · "POA"
  lead_time_text    TEXT,                             -- "7-10 working days"
  description       TEXT,
  detection_method  TEXT NOT NULL,                    -- heuristic_v1 · llm_v1 · manual
  confidence_pct    INTEGER NOT NULL DEFAULT 50,      -- 0-100
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bb_products_unique_slug_per_brain UNIQUE (brain_id, slug)
);
CREATE INDEX IF NOT EXISTS bb_products_business_idx ON brain_products(business_id);
CREATE INDEX IF NOT EXISTS bb_products_category_idx ON brain_products(business_id, category);

-- ══════════════════════════════════════════════════════════════════
-- 6. brain_services — services offered
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  source_page_id    UUID REFERENCES brain_pages(id) ON DELETE SET NULL,
  slug              TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  detection_method  TEXT NOT NULL,
  confidence_pct    INTEGER NOT NULL DEFAULT 50,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bb_services_unique_slug_per_brain UNIQUE (brain_id, slug)
);
CREATE INDEX IF NOT EXISTS bb_services_business_idx ON brain_services(business_id);

-- ══════════════════════════════════════════════════════════════════
-- 7. brain_faqs — FAQ items
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_faqs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  source_page_id    UUID REFERENCES brain_pages(id) ON DELETE SET NULL,
  question_hash     TEXT NOT NULL,                    -- SHA-256 (first 16) of normalised question — dedupe key
  question          TEXT NOT NULL,
  answer            TEXT NOT NULL,
  detection_method  TEXT NOT NULL,
  confidence_pct    INTEGER NOT NULL DEFAULT 50,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bb_faqs_unique_question_per_brain UNIQUE (brain_id, question_hash)
);
CREATE INDEX IF NOT EXISTS bb_faqs_business_idx ON brain_faqs(business_id);

-- ══════════════════════════════════════════════════════════════════
-- 8. brain_media — images / videos with descriptions
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_media (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  source_page_id    UUID REFERENCES brain_pages(id) ON DELETE SET NULL,
  media_type        TEXT NOT NULL,                    -- image · video
  url               TEXT NOT NULL,
  alt_text          TEXT,
  caption           TEXT,
  width_px          INTEGER,
  height_px         INTEGER,
  file_hash         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bb_media_brain_idx ON brain_media(brain_id);
CREATE INDEX IF NOT EXISTS bb_media_type_idx ON brain_media(business_id, media_type);

-- ══════════════════════════════════════════════════════════════════
-- 9. brain_quotes — structured customer quote requests
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_quotes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  customer_name     TEXT,
  customer_email    TEXT,
  customer_phone    TEXT,
  customer_postcode TEXT,
  project_address   TEXT,
  product_type      TEXT,
  materials         TEXT[],
  dimensions_text   TEXT,
  preferred_install_date DATE,
  budget_text       TEXT,
  special_notes     TEXT,
  quote_data_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'new',      -- new · viewed · responded · won · lost · abandoned
  conversation_id   UUID,                             -- links to brain_conversations if from chat
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bb_quotes_brain_idx ON brain_quotes(brain_id);
CREATE INDEX IF NOT EXISTS bb_quotes_status_idx ON brain_quotes(business_id, status);
CREATE INDEX IF NOT EXISTS bb_quotes_created_idx ON brain_quotes(created_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- 10. brain_conversations — chat conversations from customers
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  session_id        TEXT NOT NULL,                    -- client-generated session identifier
  messages_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
  quote_request_id  UUID REFERENCES brain_quotes(id) ON DELETE SET NULL,
  resolution_status TEXT NOT NULL DEFAULT 'active',   -- active · resolved · escalated · gap_recorded
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS bb_conversations_brain_idx ON brain_conversations(brain_id);
CREATE INDEX IF NOT EXISTS bb_conversations_session_idx ON brain_conversations(business_id, session_id);

-- ══════════════════════════════════════════════════════════════════
-- 11. brain_sync_jobs — sync history
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS brain_sync_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES business_brain_businesses(id) ON DELETE CASCADE,
  brain_id          UUID NOT NULL REFERENCES business_brains(id) ON DELETE CASCADE,
  triggered_by      TEXT NOT NULL,                    -- manual · cron · install · webhook
  status            TEXT NOT NULL DEFAULT 'running',  -- running · completed · partial · failed · cancelled
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  duration_ms       INTEGER,
  pages_crawled     INTEGER NOT NULL DEFAULT 0,
  pages_added       INTEGER NOT NULL DEFAULT 0,
  pages_changed     INTEGER NOT NULL DEFAULT 0,
  pages_unchanged   INTEGER NOT NULL DEFAULT 0,
  products_found    INTEGER NOT NULL DEFAULT 0,
  services_found    INTEGER NOT NULL DEFAULT 0,
  faqs_found        INTEGER NOT NULL DEFAULT 0,
  errors            JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS bb_sync_jobs_brain_idx ON brain_sync_jobs(brain_id);
CREATE INDEX IF NOT EXISTS bb_sync_jobs_status_idx ON brain_sync_jobs(business_id, status);
CREATE INDEX IF NOT EXISTS bb_sync_jobs_started_idx ON brain_sync_jobs(started_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- Row-Level Security — ADR-0021 hard isolation
-- ══════════════════════════════════════════════════════════════════
-- Every table gets RLS enabled. Business owners can only see their own
-- business's data. Service role bypasses RLS for admin operations.

ALTER TABLE business_brain_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_brains           ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_pages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_faqs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_media               ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_quotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_sync_jobs           ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT policy on businesses
CREATE POLICY bb_businesses_owner_select ON business_brain_businesses
  FOR SELECT USING (owner_user_id = auth.uid());

-- All brain_* tables scope by business_id ownership
CREATE POLICY bb_brains_owner_select ON business_brains
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_pages_owner_select ON brain_pages
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_documents_owner_select ON brain_documents
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_products_owner_select ON brain_products
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_services_owner_select ON brain_services
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_faqs_owner_select ON brain_faqs
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_media_owner_select ON brain_media
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_quotes_owner_select ON brain_quotes
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_conversations_owner_select ON brain_conversations
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));
CREATE POLICY bb_sync_jobs_owner_select ON brain_sync_jobs
  FOR SELECT USING (business_id IN (SELECT id FROM business_brain_businesses WHERE owner_user_id = auth.uid()));

-- Note: writes typically go through service_role via server APIs,
-- which bypass RLS. Owner writes (e.g. accepting a quote as "responded")
-- would need matching FOR UPDATE / FOR INSERT policies added when
-- Phase 2 wires the owner dashboard write-paths.
