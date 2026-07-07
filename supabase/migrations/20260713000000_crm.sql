-- CRM — App #005.
--
-- One contact per (merchant × person) that anchors every touchpoint
-- across the OS. Activities auto-populate from AI Visualiser renders,
-- Quote Workspace events, Job Diary entries, Reviews — but we DON'T
-- duplicate storage. The activity table records lightweight pointers
-- + the CRM-specific fields (assignee, tag, follow-up-linked-to).
--
-- The 360° view is a projection built by joining pointers back to the
-- source apps at read time. This keeps storage lean and avoids drift.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Contacts — per-merchant identity
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  party_id uuid REFERENCES os_parties(id) ON DELETE SET NULL,
  -- Denormalised for quick reads; refresh via a helper if party changes.
  display_name text NOT NULL,
  email text,
  email_hash text,
  whatsapp_e164 text,
  whatsapp_hash text,
  postcode text,
  -- Lifecycle stage — a merchant's-eye view of where this contact sits.
  lifecycle_stage text NOT NULL DEFAULT 'new' CHECK (lifecycle_stage IN (
    'new','engaged','quoted','won','active','signed_off','silent','lost','archived'
  )),
  source text,                       -- 'ai_visualiser' | 'whatsapp' | 'walk-in' | 'manual' | 'gallery' | ...
  tags text[] NOT NULL DEFAULT '{}',
  owner_display_name text,            -- who at the merchant handles this contact
  notes text,                         -- free-text notes bag
  last_activity_at timestamptz,
  last_touch_at timestamptz,          -- last time the merchant reached out
  next_follow_up_at timestamptz,
  quiet_since timestamptz,            -- when the contact went 'silent'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_crm_contacts_merchant_party_uk
  ON app_crm_contacts (merchant_id, party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_crm_contacts_merchant_email_hash_idx
  ON app_crm_contacts (merchant_id, email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_crm_contacts_merchant_lifecycle_idx
  ON app_crm_contacts (merchant_id, lifecycle_stage, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS app_crm_contacts_next_follow_up_idx
  ON app_crm_contacts (merchant_id, next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL AND lifecycle_stage NOT IN ('lost','archived');

-- ---------------------------------------------------------------------
-- 2. Activities — pointers to source rows in other apps, plus manual
--    notes / calls / follow-ups the merchant logs themselves.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES app_crm_contacts(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'contact_created','render','quote_drafted','quote_sent','quote_viewed',
    'quote_accepted','quote_rejected','job_opened','job_signed_off',
    'warranty_registered','review_posted','review_responded',
    'note','call','whatsapp_sent','email_sent','meeting','manual'
  )),
  headline text NOT NULL,
  body text,
  -- Pointers back to source rows in other apps (no FK; app might change tables)
  source_app text,                    -- 'ai-visualiser' | 'quote-workspace' | 'job-diary' | 'reviews' | 'crm'
  source_id text,                     -- id of the source row
  actor_party_id uuid REFERENCES os_parties(id),
  actor_business_listing_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_crm_activities_contact_idx
  ON app_crm_activities (contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS app_crm_activities_merchant_kind_idx
  ON app_crm_activities (merchant_id, kind, occurred_at DESC);
-- Idempotency for events auto-projected from source apps
CREATE UNIQUE INDEX IF NOT EXISTS app_crm_activities_source_uk
  ON app_crm_activities (source_app, source_id, kind)
  WHERE source_app IS NOT NULL AND source_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Tasks — follow-up reminders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES app_crm_contacts(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','snoozed','completed','cancelled'
  )),
  channel_hint text CHECK (channel_hint IS NULL OR channel_hint IN (
    'whatsapp','email','sms','call','in_person'
  )),
  completed_at timestamptz,
  created_by_party_id uuid REFERENCES os_parties(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_crm_tasks_contact_idx
  ON app_crm_tasks (contact_id, due_at);
CREATE INDEX IF NOT EXISTS app_crm_tasks_merchant_open_idx
  ON app_crm_tasks (merchant_id, due_at)
  WHERE status = 'open';

-- ---------------------------------------------------------------------
-- Touch triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crm_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'app_crm_contacts',
      'app_crm_tasks'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION crm_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE app_crm_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_crm_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_crm_tasks       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_crm_contacts_merchant ON app_crm_contacts;
CREATE POLICY app_crm_contacts_merchant
  ON app_crm_contacts
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_crm_activities_merchant ON app_crm_activities;
CREATE POLICY app_crm_activities_merchant
  ON app_crm_activities
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

DROP POLICY IF EXISTS app_crm_tasks_merchant ON app_crm_tasks;
CREATE POLICY app_crm_tasks_merchant
  ON app_crm_tasks
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

COMMIT;
