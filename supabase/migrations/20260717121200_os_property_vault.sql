-- XRatedTrade OS — Property Vault (Phase 3 substrate).
--
-- The Property Passport gap. Solving what no UK competitor solves:
-- a single authoritative record of every trade hired, every material
-- ordered, every quote received, every document uploaded, every video
-- captured, every warranty registered — all tied to a property that
-- survives ownership change.
--
-- The vault is not a new data source. It is an aggregate view over
-- primitives already shipped (os_projects, os_project_participants,
-- os_project_quote_line_items, os_project_payments, os_documents,
-- os_project_warranties, os_project_reviews). This migration adds:
--
--   • Video storage as a first-class object (was untracked URLs)
--   • Storage quotas + usage tracking per party/property
--   • Share grants (video/document sharing with trades/merchants)
--   • Project bundle exports (end-of-project ZIP downloads)
--   • Dashboard notices (Sarah sees "£4.99 to keep this safe" CTA)
--   • Aggregate summary function os_project_record_summary()
--
-- Property Passport transferability is already supported via
-- os_property_role_bindings (Phase 1.5) — when Sarah sells, her role
-- ends, new owner's role begins, property + vault stays.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_project_videos — video files as first-class objects
--
-- Was: untracked URLs uploaded to storage. Now: metadata + retention
-- + sharing + quota-aware. Every video belongs to a project (or
-- property directly), owned by a party, uploaded by a party.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES os_projects(id) ON DELETE CASCADE,
  property_id uuid REFERENCES os_properties(id) ON DELETE CASCADE,
  owning_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,
  uploaded_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  uploaded_by_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,

  title text NOT NULL,
  description text,

  -- File
  storage_path text NOT NULL,              -- bucket path
  video_url text NOT NULL,                 -- signed / public URL
  thumbnail_url text,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  duration_seconds integer,
  width integer,
  height integer,

  -- Context (walkthrough at start? sign-off video? work-in-progress?)
  video_category text NOT NULL DEFAULT 'general'
    CHECK (video_category IN (
      'walkthrough',                       -- initial property walkthrough
      'quote_supporting',                  -- attached to a quote
      'work_in_progress',                  -- daily/weekly capture
      'signoff_evidence',                  -- attached to signoff
      'defect_report',
      'warranty_claim',
      'general'
    )),
  linked_project_signoff_id uuid REFERENCES os_project_signoffs(id) ON DELETE SET NULL,
  linked_quote_id uuid REFERENCES os_project_quotes(id) ON DELETE SET NULL,
  linked_dispute_id uuid REFERENCES os_project_disputes(id) ON DELETE SET NULL,
  linked_warranty_id uuid REFERENCES os_project_warranties(id) ON DELETE SET NULL,

  -- Visibility default
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','shared','public')),

  -- Retention
  retain_until date,                       -- auto-archive after this date
  archived_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT os_project_videos_has_scope
    CHECK (project_id IS NOT NULL OR property_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS os_project_videos_project_idx
  ON os_project_videos (project_id, created_at DESC)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_videos_property_idx
  ON os_project_videos (property_id, created_at DESC)
  WHERE deleted_at IS NULL AND property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_videos_party_idx
  ON os_project_videos (owning_party_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS os_project_videos_category_idx
  ON os_project_videos (video_category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS os_project_videos_retention_idx
  ON os_project_videos (retain_until)
  WHERE retain_until IS NOT NULL AND archived_at IS NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 2. os_storage_quotas — per-party storage entitlement
--
-- Included_bytes comes from active homeowner subscription (Property
-- Vault Basic gives X GB). Addon_bytes comes from paid storage
-- add-ons (video add-on tiers). Used_bytes is denormalised — updated
-- by the storage_usage_events trigger.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_storage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,

  -- Entitlement sources
  included_bytes bigint NOT NULL DEFAULT 524288000,     -- 500 MB free baseline
  addon_bytes bigint NOT NULL DEFAULT 0,                -- paid add-ons

  -- Usage
  used_document_bytes bigint NOT NULL DEFAULT 0,
  used_video_bytes bigint NOT NULL DEFAULT 0,
  used_photo_bytes bigint NOT NULL DEFAULT 0,
  used_total_bytes bigint NOT NULL DEFAULT 0,
    -- kept in-sync with above three by usage-event handler

  -- Housekeeping
  last_calculated_at timestamptz,
  overquota_since timestamptz,             -- when they first crossed the limit

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_storage_quotas_party_uk UNIQUE (party_id)
);

CREATE INDEX IF NOT EXISTS os_storage_quotas_overquota_idx
  ON os_storage_quotas (overquota_since) WHERE overquota_since IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. os_storage_usage_events — append-only change log
--
-- Every upload / delete writes a row. Nightly job aggregates → updates
-- os_storage_quotas.used_*_bytes. Also the source of truth for pricing
-- audit if a homeowner disputes their bill.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_storage_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  property_id uuid REFERENCES os_properties(id) ON DELETE SET NULL,
  project_id uuid REFERENCES os_projects(id) ON DELETE SET NULL,

  action text NOT NULL
    CHECK (action IN ('upload','delete','archive','restore','transfer_in','transfer_out')),
  object_type text NOT NULL
    CHECK (object_type IN ('document','video','photo')),
  object_id uuid,
  storage_path text,

  bytes_delta bigint NOT NULL,             -- positive on upload, negative on delete

  occurred_at timestamptz NOT NULL DEFAULT now(),
  triggered_by text                        -- 'user','system','retention_job'
);

CREATE INDEX IF NOT EXISTS os_storage_usage_events_party_time_idx
  ON os_storage_usage_events (party_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS os_storage_usage_events_property_time_idx
  ON os_storage_usage_events (property_id, occurred_at DESC)
  WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_storage_usage_events_action_idx
  ON os_storage_usage_events (action, occurred_at DESC);

-- ---------------------------------------------------------------------
-- 4. os_share_grants — video/document sharing with trades/merchants
--
-- Sarah shares a video with her kitchen fitter. Sarah shares warranty
-- docs with her insurer. Sarah generates a public link to send via
-- WhatsApp. Every grant is time-bounded, revocable, and audit-logged.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_share_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being shared
  subject_type text NOT NULL
    CHECK (subject_type IN ('video','document','bundle','project_summary')),
  subject_id uuid NOT NULL,

  -- Grantor (owner)
  granted_by_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,

  -- Grantee (one of these must be set)
  granted_to_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,
  granted_to_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  granted_to_email text,                   -- for non-platform recipients
  share_token text UNIQUE,                 -- for public/emailed links

  -- Permissions
  can_view boolean NOT NULL DEFAULT true,
  can_download boolean NOT NULL DEFAULT false,
  can_reshare boolean NOT NULL DEFAULT false,
  view_watermark boolean NOT NULL DEFAULT true,    -- brand watermark on video

  -- Lifetime
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  revocation_reason text,

  -- Audit
  first_accessed_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_share_grants_has_grantee CHECK (
    granted_to_business_id IS NOT NULL OR
    granted_to_party_id IS NOT NULL OR
    granted_to_email IS NOT NULL OR
    share_token IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS os_share_grants_subject_idx
  ON os_share_grants (subject_type, subject_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS os_share_grants_grantor_idx
  ON os_share_grants (granted_by_party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS os_share_grants_business_grantee_idx
  ON os_share_grants (granted_to_business_id) WHERE granted_to_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_share_grants_token_idx
  ON os_share_grants (share_token) WHERE share_token IS NOT NULL;
-- Note: WHERE ... expires_at > now() was removed because now() isn't
-- IMMUTABLE and Postgres rejects it in a partial-index predicate. The
-- query planner handles the expires_at > now() clause at query time
-- against the base index below with negligible cost.
CREATE INDEX IF NOT EXISTS os_share_grants_active_idx
  ON os_share_grants (subject_type, subject_id, expires_at)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- 5. os_project_bundle_exports — end-of-project ZIP records
--
-- When Sarah reaches project.status = 'closed' (or asks manually), the
-- system generates a downloadable ZIP containing every document,
-- quote, review, warranty, receipt, and (Premium) videos. Bundle is
-- signed-URL-based with expiry so we're not liable for indefinite
-- hosting.
--
-- Property Passport export happens through the same mechanism when
-- Sarah sells the property — new owner receives a bundle via signed
-- link with consent-scoped contents.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_project_bundle_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES os_projects(id) ON DELETE CASCADE,
  property_id uuid REFERENCES os_properties(id) ON DELETE CASCADE,
  exported_by_party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE RESTRICT,

  export_type text NOT NULL
    CHECK (export_type IN (
      'project_completion',                -- automatic on close
      'homeowner_manual',                  -- Sarah clicked "download all"
      'property_sale_transfer',            -- passport transfer to new owner
      'legal_disclosure',                  -- lawyer / court order
      'insurance_claim'                    -- claim submission bundle
    )),

  -- Contents
  included_document_ids uuid[] NOT NULL DEFAULT '{}',
  included_video_ids uuid[] NOT NULL DEFAULT '{}',
  included_quote_ids uuid[] NOT NULL DEFAULT '{}',
  included_review_ids uuid[] NOT NULL DEFAULT '{}',
  included_warranty_ids uuid[] NOT NULL DEFAULT '{}',
  included_payment_ids uuid[] NOT NULL DEFAULT '{}',
  included_signoff_ids uuid[] NOT NULL DEFAULT '{}',
  content_summary_json jsonb,              -- structured index for the ZIP

  -- Delivery
  bundle_storage_path text,
  bundle_download_url text,
  bundle_size_bytes bigint,
  bundle_file_count integer,

  -- Lifetime
  ready_at timestamptz,
  expires_at timestamptz,                  -- URL expiry
  download_count integer NOT NULL DEFAULT 0,
  first_downloaded_at timestamptz,
  last_downloaded_at timestamptz,

  -- Consent (for transfer types)
  consent_grant_id uuid REFERENCES os_consent_grants(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','generating','ready','expired','failed','revoked')),
  failure_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_project_bundle_exports_has_scope
    CHECK (project_id IS NOT NULL OR property_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS os_project_bundle_exports_project_idx
  ON os_project_bundle_exports (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_bundle_exports_property_idx
  ON os_project_bundle_exports (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_project_bundle_exports_party_idx
  ON os_project_bundle_exports (exported_by_party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS os_project_bundle_exports_status_idx
  ON os_project_bundle_exports (status, created_at DESC);

-- ---------------------------------------------------------------------
-- 6. os_dashboard_notices — CTAs and prompts Sarah sees on /home
--
-- Instead of hardcoding "£4.99 Property Vault" CTA in code, seed it
-- here so copy + targeting can evolve without a deploy. Server picks
-- the highest-priority notice matching the party's state.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_dashboard_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_key text NOT NULL UNIQUE,         -- 'property_vault_upgrade', etc.

  audience text NOT NULL
    CHECK (audience IN ('homeowner','merchant','all')),

  -- Targeting predicates (evaluated by app layer)
  target_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- {"tier":"free","has_project_count_gte":1,"has_video_count_gte":0}

  -- Copy
  headline text NOT NULL,
  body text NOT NULL,
  primary_cta_label text,
  primary_cta_href text,
  secondary_cta_label text,
  secondary_cta_href text,
  icon_hint text,                          -- lucide icon name

  -- Presentation
  variant text NOT NULL DEFAULT 'primary'
    CHECK (variant IN ('primary','success','warning','danger','info')),
  display_priority integer NOT NULL DEFAULT 100,
  dismissible boolean NOT NULL DEFAULT true,

  -- Lifecycle
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_dashboard_notices_audience_idx
  ON os_dashboard_notices (audience, display_priority)
  WHERE active = true;
CREATE INDEX IF NOT EXISTS os_dashboard_notices_window_idx
  ON os_dashboard_notices (starts_at, ends_at) WHERE active = true;

-- ---------------------------------------------------------------------
-- 7. os_dashboard_notice_dismissals — per-party dismissal record
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_dashboard_notice_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES os_parties(id) ON DELETE CASCADE,
  notice_key text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  dismissal_channel text,                  -- 'x_button','converted','snoozed'
  snooze_until timestamptz,

  CONSTRAINT os_dashboard_notice_dismissals_uk UNIQUE (party_id, notice_key)
);

CREATE INDEX IF NOT EXISTS os_dashboard_notice_dismissals_party_idx
  ON os_dashboard_notice_dismissals (party_id);

-- ---------------------------------------------------------------------
-- 8. Seed the primary dashboard notices
-- ---------------------------------------------------------------------
INSERT INTO os_dashboard_notices
  (notice_key, audience, target_conditions, headline, body,
   primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href,
   icon_hint, variant, display_priority)
VALUES
  ('property_vault_upgrade',
   'homeowner',
   '{"has_project_count_gte":1,"vault_tier":"none"}'::jsonb,
   'Keep every receipt, warranty and photo — for £4.99/month',
   'Property Vault stores every document, quote, warranty and receipt from every project on your home — safe, searchable, and yours forever. Download the full record when a project completes. Passes to the next owner if you sell.',
   'Start Vault — £4.99/month',
   '/home/vault/upgrade',
   'Learn more',
   '/vault',
   'ShieldCheck',
   'primary',
   100),

  ('video_addon_upgrade',
   'homeowner',
   '{"vault_tier":"basic","video_count_gte":1}'::jsonb,
   'Add video storage to your Vault',
   'Record walkthroughs, share progress videos with your trades, and keep every video safe alongside your project records.',
   'Add video storage',
   '/home/vault/video-addon',
   NULL, NULL,
   'Video',
   'info',
   90),

  ('project_bundle_ready',
   'homeowner',
   '{"has_completed_bundle":true}'::jsonb,
   'Your project record is ready to download',
   'Every quote, receipt, warranty and photo from this project has been packaged for you. Download and keep — the link is active for 30 days.',
   'Download bundle',
   '/home/vault/bundle',
   NULL, NULL,
   'Download',
   'success',
   200),

  ('property_passport_transfer',
   'homeowner',
   '{"has_pending_property_transfer":true}'::jsonb,
   'Transfer your Property Passport at sale',
   'Your buyer can pick up every renovation record, warranty, and certification you''ve accumulated — verified by XRatedTrade. This adds real value at sale.',
   'Prepare transfer',
   '/home/vault/transfer',
   'How this works',
   '/vault/property-passport',
   'KeyRound',
   'info',
   150)
ON CONFLICT (notice_key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 9. Aggregate function: os_project_record_summary()
--
-- Returns a JSON blob with every trade hired, every material ordered,
-- every quote received, every payment made, every document uploaded,
-- every warranty registered, every review left — for one project.
--
-- The vault's authoritative view. Used by /home/project/[id]/record
-- and by the bundle-export generator.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION os_project_record_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'project', to_jsonb(p),
    'property', (SELECT to_jsonb(prop) FROM os_properties prop WHERE prop.id = p.property_id),
    'participants', COALESCE(
      (SELECT jsonb_agg(to_jsonb(part))
       FROM os_project_participants part
       WHERE part.project_id = p.id),
      '[]'::jsonb),
    'quotes', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'quote', to_jsonb(q),
          'line_items', COALESCE(
            (SELECT jsonb_agg(to_jsonb(li))
             FROM os_project_quote_line_items li
             WHERE li.quote_id = q.id),
            '[]'::jsonb)
        ))
       FROM os_project_quotes q
       WHERE q.project_id = p.id),
      '[]'::jsonb),
    'milestones', COALESCE(
      (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sequence)
       FROM os_project_milestones m
       WHERE m.project_id = p.id),
      '[]'::jsonb),
    'signoffs', COALESCE(
      (SELECT jsonb_agg(to_jsonb(s))
       FROM os_project_signoffs s
       WHERE s.project_id = p.id AND s.reversed_at IS NULL),
      '[]'::jsonb),
    'payments', COALESCE(
      (SELECT jsonb_agg(to_jsonb(pay))
       FROM os_project_payments pay
       WHERE pay.project_id = p.id),
      '[]'::jsonb),
    'reviews', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r))
       FROM os_project_reviews r
       WHERE r.project_id = p.id AND r.moderation_status = 'published'),
      '[]'::jsonb),
    'warranties', COALESCE(
      (SELECT jsonb_agg(to_jsonb(w))
       FROM os_project_warranties w
       WHERE w.project_id = p.id),
      '[]'::jsonb),
    'documents', COALESCE(
      (SELECT jsonb_agg(to_jsonb(d))
       FROM os_documents d
       WHERE d.project_id = p.id),
      '[]'::jsonb),
    'videos', COALESCE(
      (SELECT jsonb_agg(to_jsonb(v))
       FROM os_project_videos v
       WHERE v.project_id = p.id AND v.deleted_at IS NULL),
      '[]'::jsonb),
    'disputes', COALESCE(
      (SELECT jsonb_agg(to_jsonb(d))
       FROM os_project_disputes d
       WHERE d.project_id = p.id),
      '[]'::jsonb),
    'specifications', COALESCE(
      (SELECT jsonb_agg(to_jsonb(spec) ORDER BY spec.version DESC)
       FROM os_specifications spec
       WHERE spec.project_id = p.id),
      '[]'::jsonb),
    'generated_at', now()
  )
  INTO v_result
  FROM os_projects p
  WHERE p.id = p_project_id;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------
-- 10. Touch triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_project_videos',
      'os_storage_quotas',
      'os_share_grants',
      'os_project_bundle_exports',
      'os_dashboard_notices'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Usage events + dismissals are append-only.

-- ---------------------------------------------------------------------
-- 11. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_project_videos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_storage_quotas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_storage_usage_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_share_grants                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_project_bundle_exports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_dashboard_notices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_dashboard_notice_dismissals  ENABLE ROW LEVEL SECURITY;

COMMIT;
