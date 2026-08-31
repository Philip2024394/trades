-- 20260831010000_nex_whatsapp_outbox.sql
-- Stage 3.39 · Persistent WhatsApp outbox + reconciliation (Philip 2026-08-31)
--
-- CONSTITUTIONAL: this table is the durable audit trail for every
-- WhatsApp send NEX attempts. Every action-chain that reaches
-- EXECUTING for kind=contact_via_whatsapp writes a row here BEFORE
-- the provider is called. This guarantees that a crash/restart never
-- silently forgets an outbound message.
--
-- Companion to Stage 3.36 (state machine), 3.37 (authorization dance),
-- 3.38 (provider adapter shape), and the whatsapp webhook route.
--
-- Column semantics:
--   correlation_id      · action-chain correlationId · PRIMARY KEY
--                         The database rejects duplicate inserts · this
--                         IS the no-auto-retry guarantee at the storage
--                         layer. IdempotencyNotAvailableError bubbles
--                         from the driver on unique-violation.
--   provider_id         · "meta_cloud" | "twilio" | "wablas" | ...
--   target_canonical    · display name (e.g. "Gaotama Hotel")
--   to_e164             · normalised recipient phone (never raw form)
--   body_hash           · sha256 hex (first 16 chars) of the message
--                         body · proof-of-attempt WITHOUT persisting
--                         the actual message content (privacy)
--   status              · state machine · CHECK-constrained
--   provider_message_id · Meta wamid.xxx · used by webhook to find
--                         the outbox row when a status event arrives
--   attempts            · always 1 in v1 · retries require webhook
--                         reconciliation to establish canonical status
--                         before a NEW correlationId is safe to send.
--
-- Body storage policy:
--   We store ONLY sha256(body). Never the raw text. This keeps the
--   outbox as an audit trail without becoming a PII surface. If the
--   composer wants to recall what was sent (support/debug), it must
--   re-derive from the ActionAudit stored in session state instead.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_whatsapp_outbox (
  correlation_id      text PRIMARY KEY,
  provider_id         text NOT NULL,
  target_canonical    text NOT NULL,
  to_e164             text NOT NULL,
  body_hash           text NOT NULL,
  status              text NOT NULL,
  provider_message_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  resolution_reason   text,
  attempts            int NOT NULL DEFAULT 1,
  CONSTRAINT hnx_whatsapp_outbox_status_valid
    CHECK (status IN ('PENDING','ACCEPTED','CONFIRMED','REJECTED','TIMED_OUT','UNKNOWN'))
);

-- Webhook lookup: when Meta sends a status event with a wamid, we need
-- to find the outbox row that corresponds to it in O(1). Partial index
-- keeps the working set small (many rows may never get a wamid because
-- they were rejected/timed out before the provider issued one).
CREATE INDEX IF NOT EXISTS ix_hnx_whatsapp_outbox_provider_msg_id
  ON public.hammerex_nex_whatsapp_outbox (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Reconciliation sweep: find stale PENDING/ACCEPTED entries that never
-- received a webhook (e.g. process crashed between provider ack and
-- webhook arrival, or Meta lost the callback). Partial index keeps the
-- scan cheap once most rows have resolved.
CREATE INDEX IF NOT EXISTS ix_hnx_whatsapp_outbox_unresolved
  ON public.hammerex_nex_whatsapp_outbox (created_at)
  WHERE status IN ('PENDING','ACCEPTED');

COMMENT ON TABLE public.hammerex_nex_whatsapp_outbox IS
  'Stage 3.39 · durable audit trail for WhatsApp sends · one row per correlation_id · PRIMARY KEY enforces no-auto-retry';
COMMENT ON COLUMN public.hammerex_nex_whatsapp_outbox.body_hash IS
  'sha256(body).slice(0,16) · proof-of-attempt without persisting message content';
COMMENT ON COLUMN public.hammerex_nex_whatsapp_outbox.status IS
  'PENDING → ACCEPTED → CONFIRMED (via webhook) · REJECTED / TIMED_OUT / UNKNOWN are terminal · CONFIRMED never regresses';
