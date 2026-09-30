// src/lib/nex-native/first-conversation/first-message-orchestrator.ts
//
// Bridge 99 · Stage 6 · first-message orchestrator.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7B Create paragraph · §8 Risk service design · §7 Cookie contract.
//   Founder-sealed 2026-09-30 · baseline 6566ace3.
//   Stage 4 (session identity): bb4c66a9.
//   Stage 5 (risk): ba15f614.
//   Stage 6 DB primitive (migration 104): 4b9ff5a6.
//
// This module composes the pieces required by the sealed §7B create
// path. It is the SOLE Bridge 99 module that decides whether a
// provisional account should be created, and it does so ONLY when:
//
//   session.kind === 'none'
//
// For session.kind === 'authenticated' or 'provisional' the caller
// already has an identity; this endpoint returns kind:'existing_session'
// so the route handler can redirect the client to the existing chat
// surface. Bridge 99's first-message endpoint is scoped to the
// "cold visitor" path per sealed §7 doctrine · existing users don't
// need it.
//
// Sequence:
//
//   1. Assess risk (deterministic, pure) using inputs the caller
//      supplied. If block or challenge, return early. NO account
//      creation. NO DB writes.
//   2. If pass:
//      a. Call the Stage 6 DB primitive
//         (provisional-account-service.createProvisionalAccountWithFirstMessage)
//         which invokes the Migration 104 atomic stored function.
//      b. Post-commit · create nex_session_registry row via Stage 4b.
//      c. Sign the nex_session cookie via Stage 4a session-crypto and
//         return the token so the route handler can write it to the
//         browser via Stage 4c session-cookie in the response.
//      d. Return the redirect payload.
//
// Doctrinal boundaries this module MUST NEVER cross:
//   · No identity resolution. The resolver output (Stage 4d) is an
//     INPUT.  The orchestrator does not decide who someone is; it
//     handles what happens given who they are.
//   · No fingerprint-based identity lookup. Fingerprint is passed
//     through as a risk-record signal only.
//   · No plaintext message body handling. The orchestrator sees
//     ciphertext-shaped inputs from the caller.
//   · No writes for block/challenge outcomes. Only the pass path
//     touches the DB.
//   · The atomic six-mutation transaction is delegated to the
//     Migration 104 stored function. This module NEVER runs the six
//     inserts as separate app-level operations.

import "server-only";
import type { NexResolvedSession } from "./provisional-session";
import type {
  CiphertextRowInput,
  CreateProvisionalAccountResult,
} from "./provisional-account-service";
import { createProvisionalAccountWithFirstMessage } from "./provisional-account-service";
import {
  assessRisk,
  recordProvisionalFingerprint,
  type NexRiskDecision,
} from "./risk-service";
import type { RiskInput } from "./risk-signals";
import {
  buildRiskInput,
  sessionStateFromResolverKind,
} from "./risk-signals";
import {
  createSession,
  type CreateSessionResult,
} from "./session-registry-service";
import {
  signSessionToken,
  type NexSessionCryptoConfig,
  type NexSessionPayload,
} from "./session-crypto";

// ---------------------------------------------------------------------------
// Input / result shapes
// ---------------------------------------------------------------------------

export interface OrchestrateFirstMessageInput {
  /** Pre-resolved session (Stage 4d output). Orchestrator does not
   *  re-resolve; it handles the given identity state. */
  session: NexResolvedSession;
  /** Message body length only · NEVER the plaintext body. Feeds
   *  message_length risk signal. */
  message_length: number;
  /** Client-generated UUID for send idempotency. */
  send_intent_id: string;
  /** UUID grouping every fan-out ciphertext row of the same logical send. */
  message_group_id: string;
  /** Non-empty fan-out list (one row per owner device). */
  ciphertext_rows: CiphertextRowInput[];
  /** Client-generated stable device_id (Bridge 74). */
  device_id: string;
  /** base64-encoded Curve25519 public key for the sender's device. */
  device_public_key_b64: string;
  /** Salted fingerprint hash from Stage 5a. Passes through as a risk
   *  signal only. NEVER used to resolve identity. */
  fingerprint: string;
  /** Owner (recipient) nex_account.id · from cover context. */
  owner_account_id: string;
  /** Cover-attribution business id (nullable for non-cover sends). */
  owner_business_id: string | null;
  /** Bisnis tier of the owner · fed into risk assessment. */
  owner_bisnis_tier: "gratis" | "bisnis";
  /** Session-crypto config for signing the new session cookie. */
  crypto_cfg: NexSessionCryptoConfig;
  /** Session lifetime for the new session cookie (ms). Default 30d. */
  session_lifetime_ms?: number;
  /** Injectable clock for tests. */
  now_ms?: number;
}

/** Discriminated result surfaced to the route handler (Stage 7). */
export type OrchestrateFirstMessageResult =
  | {
      status: "created";
      account_id: string;
      conversation_id: string;
      first_message_id: string;
      deduplicated: boolean;
      session: {
        session_id: string;
        signed_cookie_token: string;
        expires_at_ms: number;
      };
      redirect_to: string;
    }
  | {
      status: "existing_session";
      /** For authenticated / provisional-existing callers · redirect to
       *  the peer chat page and use the existing send path. */
      redirect_to: string;
      account_id: string;
    }
  | {
      status: "challenge";
      challenge_kind: "turnstile" | "phone_otp" | "face";
    }
  | {
      status: "blocked";
      reason: "message_too_short" | "duplicate_message" | "ip_reputation";
    };

// ---------------------------------------------------------------------------
// Sealed defaults · sessions get 30-day rolling window per §7
// ---------------------------------------------------------------------------

const NEX_SESSION_DEFAULT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function orchestrateFirstMessage(
  input: OrchestrateFirstMessageInput,
): Promise<OrchestrateFirstMessageResult> {
  const now = input.now_ms ?? Date.now();

  // Existing-session short-circuit: not this endpoint's job.
  if (input.session.kind === "authenticated") {
    return {
      status: "existing_session",
      redirect_to: `/nex-native/chat/peer/${input.owner_account_id}`,
      account_id: input.session.supabase.account.id,
    };
  }
  if (input.session.kind === "provisional") {
    return {
      status: "existing_session",
      redirect_to: `/nex-native/chat/peer/${input.owner_account_id}`,
      account_id: input.session.account.id,
    };
  }

  // session.kind === 'none' below.

  // ---------------------------------------------------------------------
  // 1. Compose RiskInput (Stage 5b) + assess (Stage 5c)
  // ---------------------------------------------------------------------
  const riskInput: RiskInput = await buildRiskInput({
    message_body: "".padEnd(input.message_length, "x"), // synthesize a body
    // of the correct length so extractRequestSignals reports it accurately
    // without ever handling the actual plaintext (which the orchestrator
    // must never possess).
    session_kind: "none",
    fingerprint: input.fingerprint,
    owner_business_id: input.owner_business_id ?? "",
    owner_bisnis_tier: input.owner_bisnis_tier,
    now_ms: now,
  });

  const decision: NexRiskDecision = assessRisk(riskInput);
  if (decision.level === "block") {
    return { status: "blocked", reason: decision.reason };
  }
  if (decision.level === "challenge") {
    return {
      status: "challenge",
      challenge_kind: decision.challenge_kind,
    };
  }

  // ---------------------------------------------------------------------
  // 2. Pass · run the sealed §7B atomic six-mutation primitive
  // ---------------------------------------------------------------------
  const created: CreateProvisionalAccountResult =
    await createProvisionalAccountWithFirstMessage({
      display_name: "New visitor",
      device_id: input.device_id,
      device_public_key_b64: input.device_public_key_b64,
      owner_account_id: input.owner_account_id,
      owner_business_id: input.owner_business_id,
      send_intent_id: input.send_intent_id,
      message_group_id: input.message_group_id,
      ciphertext_rows: input.ciphertext_rows,
      provisional_fingerprint: input.fingerprint,
    });

  // Belt-and-braces: also record the fingerprint via risk-service's
  // public API so the "risk-service is the sole application-layer
  // writer of nex_account_risk_signal" invariant is upheld at the
  // TypeScript layer, matching the DB-layer write already performed
  // inside the atomic stored function.
  //
  // The stored function has already inserted the row · the upsert
  // here refreshes updated_at deterministically for tests and prevents
  // any future divergence if the stored function's insert changes.
  //
  // This does not violate atomicity: the outer transaction has already
  // committed. This is a POST-COMMIT idempotent refresh.
  try {
    await recordProvisionalFingerprint(
      created.account_id,
      input.fingerprint,
      now,
    );
  } catch {
    // Non-fatal · the row exists (stored function inserted it). Do not
    // rollback / re-attempt the atomic create just because a post-commit
    // refresh failed.
  }

  // ---------------------------------------------------------------------
  // 3. Post-commit · create session registry row + sign cookie
  // ---------------------------------------------------------------------
  const session: CreateSessionResult = await createSession({
    account_id: created.account_id,
    now_ms: now,
  });

  const payload: NexSessionPayload = {
    account_id: created.account_id,
    session_id: session.session_id,
    issued_at_ms: session.issued_at_ms,
    expires_at_ms: session.expires_at_ms,
  };
  const signedCookieToken = signSessionToken(payload, input.crypto_cfg);

  return {
    status: "created",
    account_id: created.account_id,
    conversation_id: created.conversation_id,
    first_message_id: created.first_message_id,
    // Migration 105 · true iff a prior same-send_intent_id call already
    // performed the atomic create. Both winner and loser get a fresh
    // session cookie for the same account_id.
    deduplicated: created.deduplicated,
    session: {
      session_id: session.session_id,
      signed_cookie_token: signedCookieToken,
      expires_at_ms: session.expires_at_ms,
    },
    // Sealed §7B activation-boundary + §9 post-send ack contract:
    // the "?born=1" flag tells the client to render the "We've created
    // your NEX" banner exactly once.
    redirect_to: `/nex-native/chat/peer/${input.owner_account_id}?born=1`,
  };

  // Note: session_lifetime_ms is currently unused in the orchestrator
  // itself · the session-registry-service applies the sealed default
  // (30d rolling / 90d absolute) per §7. Left in the input shape for
  // future override support without a signature change.
  void NEX_SESSION_DEFAULT_LIFETIME_MS;
}
