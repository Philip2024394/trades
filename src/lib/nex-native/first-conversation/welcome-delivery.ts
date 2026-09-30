// src/lib/nex-native/first-conversation/welcome-delivery.ts
//
// Bridge 99 · Stage 10 · welcome delivery adapter.
// -----------------------------------------------------------------------------
// Wires the runtime-independent worker CORE (runWelcomeOutboxOnce) to
// the authoritative NEX1 peer-message delivery mechanism.
//
// Reuses:
//   · nex-official-welcome.ts       · shared welcome-body renderer
//     (same helper Bridge 62 uses)
//   · peer-conversation-service.ts  · Bridge 3 canonical pair get-or-create
//   · peer-message-service.ts       · Bridge 3 send (with Bridge 99
//     send_intent_id extension for UNIQUE idempotency)
//   · nex-official.ts               · NEX1 constants
//
// Does NOT create a second encryption implementation. Bridge 62's inline
// welcome sends via sendPeerMessage (plaintext body column · NEX1 is a
// system account that owns its own messages, so E2E encryption between
// user and NEX1 is not applicable). This adapter follows the same
// pattern for parity.
//
// Exactly-once message-insert effect:
//   The adapter passes outbox.id as send_intent_id. Migration 102 Part C's
//   UNIQUE (sender_account_id, send_intent_id) constraint rejects
//   duplicate inserts. When the caller (worker CORE) retries after a
//   crash-window, the second attempt hits the constraint, this adapter
//   catches the Postgres duplicate-key error, and returns
//   effect: 'already_delivered' · which the worker interprets as
//   successful delivery so it marks the outbox processed. No duplicate
//   welcome message reaches the recipient.
//
// Privacy:
//   The welcome body is system-generated boilerplate, not user content.
//   It appears in the nex_peer_message.body column (plaintext by design
//   for NEX1 system messages) and in NOTHING else · no logs, no error
//   messages, no telemetry. Errors thrown here are stringified via
//   safeErrorLabel() which strips the body and returns only structural
//   information.
//
// Doctrinal boundaries:
//   · No account creation or mutation (uses caller-supplied account_id).
//   · No session/identity resolution.
//   · No fingerprint / risk signals.
//   · No Bridge 62 behaviour changes (shared helper preserves output).

import "server-only";
import { NEX_OFFICIAL_ACCOUNT_ID } from "../nex-official";
import { renderNex1WelcomeBody } from "../nex-official-welcome";
import { getOrCreatePeerConversation } from "../peer-conversation-service";
import { sendPeerMessage } from "../peer-message-service";
import * as accountService from "../account-service";
import type {
  DeliverWelcomeFn,
  DeliverWelcomeInput,
  DeliverWelcomeResult,
} from "./welcome-outbox-worker";

// ---------------------------------------------------------------------------
// Adapter · injectable into runWelcomeOutboxOnce.deps.deliverWelcome
// ---------------------------------------------------------------------------

/**
 * Production delivery adapter for Bridge 99's welcome-outbox worker.
 *
 * Flow:
 *   1. Look up the recipient account (fail if missing).
 *   2. Get-or-create the (NEX1 ↔ recipient) peer conversation.
 *   3. Render the welcome body via the shared helper.
 *   4. Insert the message via sendPeerMessage with send_intent_id
 *      = outbox.id.
 *   5. Duplicate-key from the UNIQUE constraint → 'already_delivered'.
 *
 * Contract: returns { effect: 'inserted' | 'already_delivered' } on
 * success. Any other error is thrown for the worker's errorPolicy to
 * classify (transient vs permanent).
 */
export const deliverNex1WelcomeToAccount: DeliverWelcomeFn = async (
  input: DeliverWelcomeInput,
): Promise<DeliverWelcomeResult> => {
  const { account_id, outbox_id } = input;

  // Guard · fail loudly for missing accounts (permanent failure via
  // worker errorPolicy). Never resolves identity from any other signal.
  const account = await accountService.getAccountById(account_id);
  if (!account) {
    throw new Error(`welcome-delivery.account_missing:${account_id}`);
  }

  // Bridge 3 canonical get-or-create · idempotent · returns the same
  // conversation for repeated calls.
  const conv = await getOrCreatePeerConversation(
    NEX_OFFICIAL_ACCOUNT_ID,
    account_id,
  );

  // Shared body helper · Bridge 62 uses the same one.
  const body = renderNex1WelcomeBody({ first_name: account.display_name });

  try {
    await sendPeerMessage({
      conversation_id: conv.id,
      sender_account_id: NEX_OFFICIAL_ACCOUNT_ID,
      body,
      send_intent_id: outbox_id, // Bridge 99 idempotency (Migration 102 Part C)
    });
    return { effect: "inserted" };
  } catch (e) {
    if (isUniqueSendIntentViolation(e)) {
      // A prior worker attempt already inserted this message. Return
      // 'already_delivered' so the worker marks the outbox processed.
      return { effect: "already_delivered" };
    }
    // Re-throw with a safe label (no body content).
    throw new Error(
      `welcome-delivery.send_failed:${safeErrorLabel(e)}`,
    );
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recognise a Postgres duplicate-key error whose constraint name matches
 * the sealed UNIQUE (sender_account_id, send_intent_id) index from
 * Migration 102 Part C.
 *
 * Supabase's supabase-js surfaces PostgREST errors as objects with a
 * message string that includes the constraint name for 23505 violations.
 * We match the constraint name only · robust across error-object shape
 * differences.
 */
export function isUniqueSendIntentViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /uq_nex_peer_message_send_intent/i.test(msg);
}

/**
 * Reduce an error to a structural label without leaking body/plaintext.
 * We keep only the error's constructor name and a short (<= 120 char)
 * cleaned message with any obvious PII patterns stripped defensively.
 */
export function safeErrorLabel(err: unknown): string {
  if (!err) return "unknown";
  if (err instanceof Error) {
    const ctor = err.constructor?.name ?? "Error";
    const msg = err.message
      // Strip anything that looks like an email
      .replace(/\b\S+@\S+\b/g, "[email-redacted]")
      // Strip UUID-shaped strings (they're identifiers not secrets, but
      // easier to keep labels stable)
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[uuid]")
      // Cap length
      .slice(0, 120);
    return `${ctor}:${msg}`;
  }
  return String(err).slice(0, 120);
}

// ---------------------------------------------------------------------------
// Convenience for the worker's errorPolicy
// ---------------------------------------------------------------------------

/**
 * Suggested errorPolicy for production. Classifies:
 *   · account_missing → permanent (cannot deliver to a deleted account)
 *   · anything else   → transient with 5s backoff
 *
 * Callers may substitute their own policy.
 */
export function defaultWelcomeDeliveryErrorPolicy(err: unknown): {
  kind: "transient" | "permanent";
  reason: string;
  next_attempt_delay_ms?: number;
} {
  const label = safeErrorLabel(err);
  if (/account_missing/i.test(label)) {
    return { kind: "permanent", reason: "account_missing" };
  }
  return {
    kind: "transient",
    reason: label,
    next_attempt_delay_ms: 5_000,
  };
}
