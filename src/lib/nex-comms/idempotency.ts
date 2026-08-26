// src/lib/nex-comms/idempotency.ts
//
// IDEMPOTENCY · pure key validation + duplicate detection.
//
// Doctrine: retries must NEVER send the same message twice. The caller
// supplies a deterministic idempotencyKey (e.g. `driver-recruitment:{candidate_id}:{campaign_id}`)
// and the engine checks whether that key already exists in nex.comms_message.

export interface IdempotencyCheckInput {
  idempotencyKey: string;
  existingMessageForKey: {
    messageId: string;
    createdAt: Date;
    status: string;
  } | null;
}

export interface IdempotencyAllowed {
  status: "NEW";
  idempotencyKey: string;
}

export interface IdempotencyExisting {
  status: "DUPLICATE";
  idempotencyKey: string;
  existingMessageId: string;
  existingStatus: string;
  reason: string;
}

export interface IdempotencyRefused {
  status: "REFUSED";
  reason: "INVALID_KEY_FORMAT" | "KEY_TOO_SHORT";
  detail: string;
}

export type IdempotencyResult = IdempotencyAllowed | IdempotencyExisting | IdempotencyRefused;

/**
 * Idempotency keys must be at least 8 characters + include a domain prefix
 * to prevent accidental collision across NEX subsystems.
 * Recommended shape: `{domain}:{entity_id}:{event_id}` e.g.
 * `driver-recruitment:{candidate_id}:{campaign_id}`.
 */
const KEY_REGEX = /^[a-z0-9._-]+:[a-z0-9._-]+(:[a-z0-9._-]+)*$/i;

export function checkIdempotency(input: IdempotencyCheckInput): IdempotencyResult {
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    return {
      status: "REFUSED",
      reason: "KEY_TOO_SHORT",
      detail: `idempotencyKey must be >= 8 characters · got '${input.idempotencyKey}'`,
    };
  }
  if (!KEY_REGEX.test(input.idempotencyKey)) {
    return {
      status: "REFUSED",
      reason: "INVALID_KEY_FORMAT",
      detail: `idempotencyKey must match pattern 'domain:entity[:event][:...]' with only [a-z0-9._-] segments · got '${input.idempotencyKey}'`,
    };
  }

  if (input.existingMessageForKey) {
    return {
      status: "DUPLICATE",
      idempotencyKey: input.idempotencyKey,
      existingMessageId: input.existingMessageForKey.messageId,
      existingStatus: input.existingMessageForKey.status,
      reason: `A message with this idempotency key was created at ${input.existingMessageForKey.createdAt.toISOString()} · returning existing message rather than double-sending.`,
    };
  }

  return { status: "NEW", idempotencyKey: input.idempotencyKey };
}

/**
 * Compose a deterministic idempotency key from a domain + parts. Used by
 * callers so they don't have to construct the key string manually.
 */
export function composeIdempotencyKey(domain: string, ...parts: string[]): string {
  const clean = [domain, ...parts].map((p) =>
    p.toString().toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
  );
  return clean.join(":");
}
