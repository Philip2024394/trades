-- 162_nex_enterprise.sql
--
-- Founder Phase 16 · P16-1 · Enterprise foundations.
-- 2026-09-10.
--
-- Three tables:
--   nex.team          · workspaces / organisations
--   nex.team_member   · users in teams · role: owner|admin|member
--   nex.audit_event   · every enterprise-relevant action (SIEM export)

CREATE SCHEMA IF NOT EXISTS nex;

-- ═══════════════════════════════════════════════════════════════════
-- team
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.team (
  team_id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text        NOT NULL UNIQUE,       -- URL slug
  name          text        NOT NULL,
  created_by    text        NOT NULL,               -- user_id of creator
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL,
  tier          text        NOT NULL DEFAULT 'starter',
  CONSTRAINT ck_team_tier CHECK (tier IN ('starter','pro','enterprise'))
);

CREATE INDEX IF NOT EXISTS idx_nex_team_active
  ON nex.team (created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE nex.team IS
  'Founder Phase 16 · P16-1 · team workspace · owns members + audit events.';

-- ═══════════════════════════════════════════════════════════════════
-- team_member
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.team_member (
  team_id       uuid        NOT NULL REFERENCES nex.team(team_id) ON DELETE CASCADE,
  user_id       text        NOT NULL,
  role          text        NOT NULL,               -- owner | admin | member
  joined_at     timestamptz NOT NULL DEFAULT now(),
  invited_by    text        NULL,
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT ck_team_member_role CHECK (role IN ('owner','admin','member'))
);

CREATE INDEX IF NOT EXISTS idx_nex_team_member_user
  ON nex.team_member (user_id, joined_at DESC);

COMMENT ON TABLE nex.team_member IS
  'Founder Phase 16 · P16-1 · users in a team · role gates enterprise ops.';

-- ═══════════════════════════════════════════════════════════════════
-- audit_event
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nex.audit_event (
  audit_event_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid        NULL REFERENCES nex.team(team_id) ON DELETE SET NULL,
  actor_user_id   text        NULL,
  action          text        NOT NULL,               -- e.g. team.create · member.add · audit.export
  target          text        NULL,                   -- e.g. user_id being added
  meta            jsonb       NULL,
  ip_hash_16      text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_audit_event_team_time
  ON nex.audit_event (team_id, created_at DESC) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_audit_event_actor_time
  ON nex.audit_event (actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nex_audit_event_action_time
  ON nex.audit_event (action, created_at DESC);

COMMENT ON TABLE nex.audit_event IS
  'Founder Phase 16 · P16-1 · immutable audit log · SIEM-exportable via NDJSON.';
