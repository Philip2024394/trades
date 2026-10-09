-- NEX World Discovery · Global Country Registry + Live Crawler Map + Country Intelligence
-- Founder-authorised programme · bounded wave · 2026-09-21
--
-- FIVE additive tables · idempotent · zero touch of prior discovery-intel or
-- marketing_contact substrate. Enables the Founder to see the whole world
-- at a glance and drill from country → crawler → category → business → evidence.
--
-- DESIGN INVARIANTS:
--   * Canonical country registry is UNIVERSAL · programme-agnostic. Asia-last
--     is a per-PROGRAMME policy (nex.discovery_programme_country.policy_json)
--     NOT a property of the country row.
--   * Country state must reflect REAL crawler activity. Never a fake pulse.
--   * Founder-only surfaces MAY display individual business + email evidence;
--     member-facing surfaces remain aggregate-only (application-layer gate).
--   * SOURCE_UNAVAILABLE and ZERO_RESULTS remain distinct states.

BEGIN;

-- ─── 1 · Canonical country registry (independent of any programme) ─────
CREATE TABLE IF NOT EXISTS nex.world_country (
  iso_alpha_2       CHAR(2) PRIMARY KEY,
  iso_alpha_3       CHAR(3),
  numeric_code      TEXT,
  name              TEXT NOT NULL,
  official_name     TEXT,
  region            TEXT NOT NULL,                    -- 'Americas' | 'Europe' | 'Africa' | 'Middle East' | 'Asia' | 'Oceania' | 'Antarctica'
  subregion         TEXT,                             -- e.g. 'Northern America' · 'Southern Europe'
  un_member         BOOLEAN NOT NULL DEFAULT FALSE,
  sovereign         BOOLEAN NOT NULL DEFAULT TRUE,
  currency          TEXT,
  languages         TEXT[],
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_in_nex     BOOLEAN NOT NULL DEFAULT TRUE,    -- Founder-controlled toggle
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_world_country_region ON nex.world_country (region, iso_alpha_2);
CREATE INDEX IF NOT EXISTS ix_world_country_un_member ON nex.world_country (un_member) WHERE un_member = TRUE;

-- ─── 2 · Discovery programme registry ────────────────────────────────
--   A programme is a named subject-scope (e.g. 'scaffolding'), each with
--   its own search vocabulary + country policy. Enables per-programme
--   Asia-last configuration + future subject expansion without redesigning
--   the country registry.
CREATE TABLE IF NOT EXISTS nex.discovery_programme (
  programme_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,             -- 'scaffolding' · 'staircase' · 'toolbelts'
  display_name      TEXT NOT NULL,
  topic             TEXT NOT NULL,                    -- links to nex.discovery_search_term.topic
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','archived')),
  cadence_seconds   INTEGER NOT NULL DEFAULT 300,     -- 5-min default
  policy_json       JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "asia_last": true, "priority_regions": [...] }
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3 · Per-programme country scope (many-to-many + policy) ─────────
CREATE TABLE IF NOT EXISTS nex.discovery_programme_country (
  programme_id      UUID NOT NULL REFERENCES nex.discovery_programme(programme_id) ON DELETE CASCADE,
  iso_alpha_2       CHAR(2) NOT NULL REFERENCES nex.world_country(iso_alpha_2) ON DELETE CASCADE,
  included          BOOLEAN NOT NULL DEFAULT TRUE,
  priority          INTEGER NOT NULL DEFAULT 100,     -- lower = higher priority in scheduling
  policy_json       JSONB NOT NULL DEFAULT '{}'::jsonb, -- per-country per-programme override
  PRIMARY KEY (programme_id, iso_alpha_2)
);

CREATE INDEX IF NOT EXISTS ix_programme_country_prio ON nex.discovery_programme_country (programme_id, priority) WHERE included = TRUE;

-- ─── 4 · Live per-country crawler state ──────────────────────────────
--   ONE row per (programme, country). Updated only when a real cycle
--   claims/completes work. Never animated arbitrarily.
CREATE TABLE IF NOT EXISTS nex.discovery_country_state (
  programme_id      UUID NOT NULL REFERENCES nex.discovery_programme(programme_id) ON DELETE CASCADE,
  iso_alpha_2       CHAR(2) NOT NULL REFERENCES nex.world_country(iso_alpha_2) ON DELETE CASCADE,

  status            TEXT NOT NULL DEFAULT 'idle'
                    CHECK (status IN (
                      'idle',                -- not scheduled · no recent activity
                      'queued',              -- scheduled but not yet claimed
                      'crawling',            -- worker actively fetching sources
                      'processing',          -- sources returned · resolving entities
                      'new_data',            -- new businesses/emails observed
                      'partial',             -- some sources responded, some failed
                      'zero_results',        -- source responded successfully · zero elements
                      'source_unavailable',  -- source could not be reached
                      'blocked',             -- governance/source restriction
                      'completed'            -- cycle finished · resting until next
                    )),
  current_cycle_id  UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,
  last_cycle_id     UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,
  claimed_at        TIMESTAMPTZ,                     -- when worker claimed the slot
  claimed_by        TEXT,                             -- worker id (never faked)
  activity_expires_at TIMESTAMPTZ,                    -- claim self-expires · dead workers don't hold state
  last_completed_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,

  -- Rolling metrics (updated only from real cycle outcomes)
  businesses_discovered_today  INTEGER NOT NULL DEFAULT 0,
  new_emails_today             INTEGER NOT NULL DEFAULT 0,
  existing_matched_today       INTEGER NOT NULL DEFAULT 0,
  rejected_today               INTEGER NOT NULL DEFAULT 0,
  websites_resolved_today      INTEGER NOT NULL DEFAULT 0,
  sources_responded_today      INTEGER NOT NULL DEFAULT 0,
  sources_unavailable_today    INTEGER NOT NULL DEFAULT 0,
  metrics_day                  DATE NOT NULL DEFAULT current_date,

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (programme_id, iso_alpha_2)
);

CREATE INDEX IF NOT EXISTS ix_country_state_status ON nex.discovery_country_state (programme_id, status);
CREATE INDEX IF NOT EXISTS ix_country_state_active ON nex.discovery_country_state (activity_expires_at) WHERE activity_expires_at IS NOT NULL;

-- ─── 5 · Per-business evidence (Founder-only surface layer) ──────────
--   One row per resolved business. Contains public evidence + optional
--   discovered_email. Founder UI may display this in full; member routes
--   never join this table into a member-facing response.
CREATE TABLE IF NOT EXISTS nex.discovery_business_evidence (
  evidence_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id      UUID NOT NULL REFERENCES nex.discovery_programme(programme_id) ON DELETE CASCADE,
  iso_alpha_2       CHAR(2) NOT NULL REFERENCES nex.world_country(iso_alpha_2) ON DELETE CASCADE,
  cycle_id          UUID REFERENCES nex.discovery_cycle(cycle_id) ON DELETE SET NULL,

  business_name     TEXT NOT NULL,
  website_url       TEXT,
  contact_page_url  TEXT,
  services          TEXT[] NOT NULL DEFAULT '{}',
  category          TEXT,
  discovered_via_term TEXT NOT NULL,                  -- e.g. 'scaffolding contractors'
  discovered_via_source TEXT NOT NULL,                -- e.g. 'osm_overpass' · 'directory:yell.com'
  discovered_via_evidence_url TEXT,                   -- the actual public URL

  -- Optional discovered email · Founder-only surface
  discovered_email  TEXT,                             -- normalised lowercase · nullable
  email_source_url  TEXT,                             -- page URL where the email appeared
  email_extraction_confidence NUMERIC(4,3),

  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Idempotency · one row per (programme, country, business_name-normalised, website)
  UNIQUE (programme_id, iso_alpha_2, business_name, website_url)
);

CREATE INDEX IF NOT EXISTS ix_business_evidence_country ON nex.discovery_business_evidence (iso_alpha_2, programme_id);
CREATE INDEX IF NOT EXISTS ix_business_evidence_cycle  ON nex.discovery_business_evidence (cycle_id);
CREATE INDEX IF NOT EXISTS ix_business_evidence_email  ON nex.discovery_business_evidence (LOWER(discovered_email)) WHERE discovered_email IS NOT NULL;

COMMIT;
