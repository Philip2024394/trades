// src/lib/nex-native/first-conversation/welcome-outbox-worker.ts
//
// Bridge 99 · Stage 10 · welcome outbox worker CORE (runtime-independent).
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §Q8 (welcome outbox) · §7B Create (welcome outbox event) ·
//   Founder-sealed 2026-09-30 · baseline 6566ace3.
//   Migration 103 defines the nex_welcome_outbox schema.
//   Migration 103 header defines the claim SQL contract this module implements.
//
// Delivery semantics (verbatim sealed):
//   AT-LEAST-ONCE processing with EXACTLY-ONCE message-insert effect.
//
// Runtime boundary (founder-required):
//   This module exposes runWelcomeOutboxOnce(deps) · a single call that
//   claims + processes at most one outbox row. Whether to poll it via
//   setInterval, Vercel Cron, a separate Node process, or another
//   production scheduler is an architecture decision the founder has
//   NOT made yet. This module is written so any of those choices can
//   drive it without changes here.
//
// Delivery function (deps.deliverWelcome) is injected so the CORE can
// be unit-tested without pulling in Bridge 62's actual welcome-body
// renderer or the Bridge 76 encryption path. Production wires it to
// those authoritative implementations at deployment time.
//
// Uses pg directly (not supabase-admin) because the atomic claim
// requires FOR UPDATE SKIP LOCKED, which PostgREST does not expose.
// This is the only production Bridge 99 code path that uses pg
// directly · it is a background-worker concern, not a request-time
// concern, so no shared pool contract is imposed.

import "server-only";

// ---------------------------------------------------------------------------
// Minimal pg client contract (accept anything that quacks like it · lets
// tests inject a fake without importing pg types).
// ---------------------------------------------------------------------------

export interface MinimalPgClient {
  query(text: string): Promise<{ rows: unknown[] }>;
  query(
    text: string,
    values: unknown[],
  ): Promise<{ rows: unknown[] }>;
}

// ---------------------------------------------------------------------------
// Delivery contract · what the worker does to actually send the welcome
// ---------------------------------------------------------------------------

/**
 * The injected function performs the encrypted-message insert into
 * nex_peer_message with send_intent_id = outbox_id, and returns whether
 * the insert actually happened (inserted) or was a no-op because a
 * prior worker attempt already delivered it (already_delivered · the
 * exactly-once-message-insert effect via migration 102 Part C's UNIQUE
 * (sender_account_id, send_intent_id) constraint).
 *
 * Any error thrown from this function is interpreted per the errorPolicy
 * decision (see runWelcomeOutboxOnce below).
 */
export interface DeliverWelcomeInput {
  account_id: string;
  outbox_id: string;
}
export interface DeliverWelcomeResult {
  effect: "inserted" | "already_delivered";
}
export type DeliverWelcomeFn = (
  input: DeliverWelcomeInput,
) => Promise<DeliverWelcomeResult>;

/**
 * Interprets an error thrown by deliverWelcome. Callers supply this
 * so runWelcomeOutboxOnce doesn't have to know which errors are
 * transient (retry later) vs permanent (mark failed).
 */
export type ErrorPolicy = (err: unknown) => {
  kind: "transient" | "permanent";
  reason: string;
  next_attempt_delay_ms?: number;
};

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export interface WelcomeOutboxWorkerDeps {
  pgClient: MinimalPgClient;
  /** Opaque worker identifier for observability. */
  worker_id: string;
  /** Lease duration in ms · outbox row is claimed for this long. If the
   *  worker crashes, another worker reclaims after the lease expires. */
  lease_ms: number;
  /** Injected delivery · production wires this to Bridge 62 welcome-body
   *  renderer + Bridge 76 encryption + peer-message-service insert with
   *  send_intent_id = outbox_id. */
  deliverWelcome: DeliverWelcomeFn;
  /** How to classify errors thrown by deliverWelcome. */
  errorPolicy: ErrorPolicy;
  /** Injectable clock. */
  now_ms?: number;
}

// ---------------------------------------------------------------------------
// Result of one run
// ---------------------------------------------------------------------------

export type RunWelcomeOutboxOnceResult =
  | { status: "no_work" }
  | {
      status: "processed";
      outbox_id: string;
      account_id: string;
      attempts: number;
      /** How the delivery actually resolved · inserted vs already-delivered. */
      delivery: "inserted" | "already_delivered";
    }
  | {
      status: "transient_failure";
      outbox_id: string;
      account_id: string;
      attempts: number;
      reason: string;
      next_attempt_after_ms: number;
    }
  | {
      status: "permanent_failure";
      outbox_id: string;
      account_id: string;
      attempts: number;
      reason: string;
    };

// ---------------------------------------------------------------------------
// runWelcomeOutboxOnce · the sole public entry
// ---------------------------------------------------------------------------

/**
 * Claim + process one outbox row (if any).
 *
 * Order of operations:
 *   1. Atomic claim (UPDATE...WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)).
 *      · Sets claimed_at, lease_expires_at, claimed_by, increments attempts.
 *      · Returns the claimed row (id, account_id, attempts) or nothing.
 *   2. If nothing claimed → { status: 'no_work' }.
 *   3. Call deliverWelcome. Interpret result:
 *      · 'inserted' or 'already_delivered' → mark processed.
 *      · Error → dispatch to errorPolicy:
 *        - 'transient' → clear lease + set next_attempt_after.
 *        - 'permanent' → mark failed with reason.
 *
 * Crash-window handling:
 *   If the worker crashes after deliverWelcome returns 'inserted' but
 *   BEFORE mark-processed, another worker will reclaim after lease
 *   expiry. On second-attempt delivery, the UNIQUE constraint in
 *   nex_peer_message rejects the duplicate insert · deliverWelcome
 *   returns 'already_delivered' · we mark processed. No duplicate
 *   welcome message reaches the recipient.
 */
export async function runWelcomeOutboxOnce(
  deps: WelcomeOutboxWorkerDeps,
): Promise<RunWelcomeOutboxOnceResult> {
  const now = deps.now_ms ?? Date.now();
  const leaseExpiryIso = new Date(now + deps.lease_ms).toISOString();

  // Step 1 · atomic claim
  const claimResult = await deps.pgClient.query(
    `
    UPDATE nex_welcome_outbox
       SET claimed_at       = to_timestamp($1 / 1000.0),
           claimed_by       = $2,
           lease_expires_at = to_timestamp(($1 + $3) / 1000.0),
           attempts         = attempts + 1
     WHERE id = (
       SELECT id FROM nex_welcome_outbox
        WHERE processed_at IS NULL
          AND failed_at IS NULL
          AND (claimed_at IS NULL OR lease_expires_at < to_timestamp($1 / 1000.0))
          AND (next_attempt_after IS NULL OR next_attempt_after < to_timestamp($1 / 1000.0))
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, account_id, attempts
    `,
    [now, deps.worker_id, deps.lease_ms],
  );

  if (claimResult.rows.length === 0) {
    void leaseExpiryIso; // no-op reference to keep the variable alive
    return { status: "no_work" };
  }
  const claimed = claimResult.rows[0] as {
    id: string;
    account_id: string;
    attempts: number;
  };

  // Step 2 · deliver
  let deliveryResult: DeliverWelcomeResult | null = null;
  let deliveryError: unknown = null;
  try {
    deliveryResult = await deps.deliverWelcome({
      account_id: claimed.account_id,
      outbox_id: claimed.id,
    });
  } catch (e) {
    deliveryError = e;
  }

  // Step 3 · mark
  if (deliveryResult) {
    await deps.pgClient.query(
      `
      UPDATE nex_welcome_outbox
         SET processed_at    = to_timestamp($1 / 1000.0),
             claimed_at      = NULL,
             lease_expires_at = NULL,
             claimed_by      = NULL,
             last_attempt_error = NULL
       WHERE id = $2
      `,
      [Date.now(), claimed.id],
    );
    return {
      status: "processed",
      outbox_id: claimed.id,
      account_id: claimed.account_id,
      attempts: claimed.attempts,
      delivery: deliveryResult.effect,
    };
  }

  // Delivery threw · classify.
  const classification = deps.errorPolicy(deliveryError);
  if (classification.kind === "permanent") {
    await deps.pgClient.query(
      `
      UPDATE nex_welcome_outbox
         SET failed_at   = to_timestamp($1 / 1000.0),
             fail_reason = $2,
             claimed_at  = NULL,
             lease_expires_at = NULL,
             claimed_by  = NULL,
             last_attempt_error = $2
       WHERE id = $3
      `,
      [Date.now(), classification.reason.slice(0, 500), claimed.id],
    );
    return {
      status: "permanent_failure",
      outbox_id: claimed.id,
      account_id: claimed.account_id,
      attempts: claimed.attempts,
      reason: classification.reason,
    };
  }

  // Transient · release the lease + schedule retry.
  const backoffMs = classification.next_attempt_delay_ms ?? 5000;
  await deps.pgClient.query(
    `
    UPDATE nex_welcome_outbox
       SET next_attempt_after = to_timestamp($1 / 1000.0),
           last_attempt_error = $2,
           claimed_at         = NULL,
           lease_expires_at   = NULL,
           claimed_by         = NULL
     WHERE id = $3
    `,
    [Date.now() + backoffMs, classification.reason.slice(0, 500), claimed.id],
  );
  return {
    status: "transient_failure",
    outbox_id: claimed.id,
    account_id: claimed.account_id,
    attempts: claimed.attempts,
    reason: classification.reason,
    next_attempt_after_ms: Date.now() + backoffMs,
  };
}
