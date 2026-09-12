-- 150_nex_action_audit.sql
--
-- NEX LIVE CHAT · SAFE ACTIONABLE INTELLIGENCE · Phase 3.7 · Migration 150.
-- Founder BEGIN Phase 3.7 · Master AI Engineer · 2026-09-09.
--
-- Doctrine anchor:
--   Founder Phase 3.7 rule: "LLM NEVER EXECUTES AN ACTION WITHOUT NEX AUTHORIZATION."
--
-- Purpose (STRICT this migration):
--   1. nex.action_audit · immutable trail of every proposed action + its
--      outcome + any executor result. HQ page reads it. Investigations
--      trace it. Never mutated after write.
--
-- Every LLM proposal that traverses authorize.ts produces exactly one row.
-- No PII in args column beyond what the proposal explicitly carries. Rows
-- are append-only.

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.action_audit (
  audit_id                   uuid        PRIMARY KEY,
  emitted_at                 timestamptz NOT NULL DEFAULT now(),
  conversation_id            text        NULL,
  action_id                  text        NOT NULL,     -- registered id or "invalid_shape"
  args                       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  outcome                    text        NOT NULL,     -- executed · rejected_schema · rejected_unknown_action · rejected_permission · rejected_guardrail · pending_confirmation · rejected_no_llm_rule
  outcome_reason             text        NOT NULL,
  executed_at                timestamptz NULL,
  result                     jsonb       NULL,
  requires_user_confirmation boolean     NOT NULL DEFAULT false,
  confirmation_token         text        NULL,
  trace                      jsonb       NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_nex_action_audit_recent
  ON nex.action_audit (emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_action_audit_outcome
  ON nex.action_audit (outcome, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_action_audit_conversation
  ON nex.action_audit (conversation_id, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_action_audit_action
  ON nex.action_audit (action_id, emitted_at DESC);

COMMENT ON TABLE nex.action_audit IS
  'Founder BEGIN Phase 3.7 · immutable action audit trail. Rows are append-only.';
