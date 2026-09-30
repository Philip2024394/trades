// src/lib/nex-native/first-conversation/provisional-account-service.ts
//
// Bridge 99 · Stage 6 · provisional account + first-message wrapper.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7B Create paragraph · Founder-sealed 2026-09-30 · baseline 6566ace3.
//   Stage 6 DB primitive: Migration 104 · commit 4b9ff5a6.
//
// This is a thin TypeScript wrapper around the sealed Migration 104
// stored function `nex_bridge99_create_first_message`. It does one
// thing: invoke that stored function via supabase-admin.rpc() with
// the caller-supplied inputs and return the resulting ids.
//
// The stored function is the AUTHORITATIVE atomic primitive for the
// sealed §7B six-insert transaction. This wrapper does NOT reimplement
// any of those inserts in TypeScript. If atomicity were split across
// separate app-level inserts, sealed §7B rollback semantics would be
// violated.
//
// Doctrinal boundaries this module MUST NEVER cross:
//   · No identity resolution. Callers must have already run the Stage
//     4d resolver and confirmed session.kind === 'none' before calling
//     this wrapper. The wrapper trusts the input.
//   · No account_id derivation from fingerprint. The caller supplies
//     the fingerprint as a signal to record; the wrapper never queries
//     for a matching account.
//   · No calls to nex_account / nex_account_device_key /
//     nex_peer_conversation / nex_peer_message / nex_account_risk_signal
//     / nex_welcome_outbox outside the single RPC invocation.
//   · No session-registry side effects. Cookie/session issuance is the
//     orchestrator's responsibility (post-commit), not this module's.
//   · No plaintext message body ever passes through this module. The
//     caller has already E2E-encrypted the body via Bridge 76 and
//     supplies base64 ciphertext rows.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

// ---------------------------------------------------------------------------
// Input / result shapes
// ---------------------------------------------------------------------------

/** One ciphertext row per recipient device · fan-out per Bridge 76. */
export interface CiphertextRowInput {
  recipient_device_id: string;
  /** base64-encoded ciphertext produced by nacl.box on the client. */
  ciphertext_b64: string;
  /** base64-encoded 24-byte nonce paired with the ciphertext. */
  nonce_b64: string;
}

export interface CreateProvisionalAccountInput {
  /** Display name for the new nex_account row · sealed default 'New visitor'. */
  display_name: string;
  /** Client-generated stable device_id from IndexedDB (Bridge 74 pattern). */
  device_id: string;
  /** base64-encoded 32-byte Curve25519 public key. */
  device_public_key_b64: string;
  /** The owner (recipient) nex_account.id. */
  owner_account_id: string;
  /** Optional cover attribution · null for non-cover conversations. */
  owner_business_id: string | null;
  /** Client-generated UUID for send idempotency (sealed §7B send_intent_id). */
  send_intent_id: string;
  /** UUID grouping every fan-out row of the same logical send (Bridge 76). */
  message_group_id: string;
  /** Non-empty array of ciphertext rows, one per recipient device. */
  ciphertext_rows: CiphertextRowInput[];
  /** Salted fingerprint hash from Stage 5a. NEVER the raw signals. */
  provisional_fingerprint: string;
}

export interface CreateProvisionalAccountResult {
  account_id: string;
  conversation_id: string;
  first_message_id: string;
  /** True when the atomic function returned a cached result for a prior
   *  same-send_intent_id call (Migration 105 dedup). False when this
   *  call performed the create. */
  deduplicated: boolean;
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

/**
 * Invoke the Migration 104 atomic stored function. The six sealed §7B
 * mutations happen inside one PostgreSQL transaction; either all
 * succeed or all roll back. On success, returns the created ids so
 * the orchestrator can issue the session cookie and redirect.
 *
 * Never called for existing sessions. If a caller passes a resolver
 * result whose kind is not 'none', that is a bug in the caller.
 */
export async function createProvisionalAccountWithFirstMessage(
  input: CreateProvisionalAccountInput,
): Promise<CreateProvisionalAccountResult> {
  // Local shape validation (belt-and-braces · the stored function also
  // rejects invalid inputs).
  if (!input.display_name || input.display_name.length === 0) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: display_name required",
    );
  }
  if (!input.device_id || input.device_id.length < 8) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: device_id must be at least 8 characters",
    );
  }
  if (!input.device_public_key_b64 || input.device_public_key_b64.length < 40) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: device_public_key_b64 must be at least 40 characters",
    );
  }
  if (!input.owner_account_id) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: owner_account_id required",
    );
  }
  if (!input.send_intent_id) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: send_intent_id required",
    );
  }
  if (!input.message_group_id) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: message_group_id required",
    );
  }
  if (
    !Array.isArray(input.ciphertext_rows) ||
    input.ciphertext_rows.length === 0
  ) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: ciphertext_rows must be a non-empty array",
    );
  }
  for (const row of input.ciphertext_rows) {
    if (
      !row.recipient_device_id ||
      !row.ciphertext_b64 ||
      !row.nonce_b64
    ) {
      throw new Error(
        "provisional-account-service.createProvisionalAccountWithFirstMessage: every ciphertext row must have recipient_device_id + ciphertext_b64 + nonce_b64",
      );
    }
  }
  if (!input.provisional_fingerprint || input.provisional_fingerprint.length === 0) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: provisional_fingerprint required",
    );
  }

  // Marshal ciphertext rows for the stored function · the SQL side
  // expects an array of {recipient_device_id, ciphertext, nonce} where
  // ciphertext + nonce are the base64-encoded strings.
  const rpcCiphertextRows = input.ciphertext_rows.map((r) => ({
    recipient_device_id: r.recipient_device_id,
    ciphertext: r.ciphertext_b64,
    nonce: r.nonce_b64,
  }));

  const { data, error } = await nexSupabaseAdmin.rpc(
    "nex_bridge99_create_first_message",
    {
      p_display_name: input.display_name,
      p_device_id: input.device_id,
      p_device_public_key: input.device_public_key_b64,
      p_owner_account_id: input.owner_account_id,
      p_owner_business_id: input.owner_business_id,
      p_send_intent_id: input.send_intent_id,
      p_message_group_id: input.message_group_id,
      p_ciphertext_rows: rpcCiphertextRows,
      p_provisional_fingerprint: input.provisional_fingerprint,
    },
  );

  if (error) {
    // Note: the error message from the stored function is passed
    // through here. It contains argument-validation messages ONLY ·
    // never plaintext message content (which the wrapper never
    // possesses in the first place).
    throw new Error(
      `provisional-account-service.createProvisionalAccountWithFirstMessage: ${error.message}`,
    );
  }
  if (!data || typeof data !== "object") {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: RPC returned no data",
    );
  }

  const result = data as {
    account_id?: unknown;
    conversation_id?: unknown;
    first_message_id?: unknown;
    deduplicated?: unknown;
  };
  if (
    typeof result.account_id !== "string" ||
    typeof result.conversation_id !== "string" ||
    typeof result.first_message_id !== "string"
  ) {
    throw new Error(
      "provisional-account-service.createProvisionalAccountWithFirstMessage: RPC returned unexpected shape",
    );
  }
  return {
    account_id: result.account_id,
    conversation_id: result.conversation_id,
    first_message_id: result.first_message_id,
    // Migration 105 introduced this flag. Migration 104-era responses
    // (before M105 replaced the function) had no field · default false
    // for that historical scenario, but M105 always returns it.
    deduplicated: result.deduplicated === true,
  };
}
