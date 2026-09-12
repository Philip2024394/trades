// WO-WORKSTATION-02 · founder authorization envelope
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Signed Ed25519 authorization that binds a founder key to a specific
// (trace_id, work_order_id) pair with expiry, nonce, and chain-of-custody.
// Replaces the spoofable `FA-WORKSTATION-<timestamp>` plain-text tokens
// identified as CRITICAL SECURITY GAP by ADR-0318 G15.
//
// Contract:
//   - the signed payload is a canonical UTF-8 JSON of every field except
//     `signature` itself
//   - canonical means keys in a fixed order (see canonicalisePayload)
//   - verifyAuthorization returns { ok: true } only when ALL of:
//       * key_id resolves in manifest and is within its validity window
//       * signature bytes verify against the resolved public key
//       * atTime falls within [issued_at, expires_at]
//       * expires_at > issued_at
//   - callers layer replay protection + chain integrity separately via
//     wo2-authorization-store (nonce uniqueness + previous_hash lookup)
//   - verify never throws on unexpected data; it returns a specific
//     rejection reason so audit records the WHY

import { createHash, randomBytes, randomUUID, type KeyObject } from "node:crypto";
import { signBytes, verifyBytes, type KeyPair } from "@/lib/nex-controlled-hands/ed25519";
import { findFounderKeyById, type FounderKeyManifest } from "./wo2-founder-keys";

export interface FounderAuthorization {
  readonly record_type: "NEX1_FOUNDER_AUTHORIZATION";
  readonly authorization_id: string;
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly founder_key_id: string;
  /** Capability scope: the specific actions this authorization admits.
   *  Empty array = no actions; must be explicit. Broker/Controlled Hands
   *  will enforce this when they consume the authorization. */
  readonly authorised_actions: readonly string[];
  readonly issued_at: string;
  readonly expires_at: string;
  /** Unique per authorization. Base64. 24 random bytes (192 bits). */
  readonly nonce: string;
  /** Hash of the immediately preceding authorization for this trace, or
   *  null if this is the first. Chain-of-custody per trace. */
  readonly previous_authorization_hash: string | null;
  /** Ed25519 signature over the canonical payload, hex-encoded. */
  readonly signature: string;
}

// ── Canonical serialisation ─────────────────────────────────────────────

/**
 * Produce the exact bytes that get signed. Ordered fields, stable JSON,
 * no whitespace variance. Must never include the signature field itself.
 */
export function canonicalisePayload(auth: Omit<FounderAuthorization, "signature">): Buffer {
  const ordered = {
    record_type: auth.record_type,
    authorization_id: auth.authorization_id,
    trace_id: auth.trace_id,
    work_order_id: auth.work_order_id,
    founder_key_id: auth.founder_key_id,
    authorised_actions: [...auth.authorised_actions],
    issued_at: auth.issued_at,
    expires_at: auth.expires_at,
    nonce: auth.nonce,
    previous_authorization_hash: auth.previous_authorization_hash,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

/**
 * SHA-256 of the canonical payload. Used both as the "hash of this
 * authorization" (for the next one's previous_authorization_hash) AND
 * as an integrity check independent of the signature.
 */
export function hashAuthorization(auth: Omit<FounderAuthorization, "signature">): string {
  return createHash("sha256").update(canonicalisePayload(auth)).digest("hex");
}

// ── Sign ────────────────────────────────────────────────────────────────

/**
 * Produce a signed FounderAuthorization. The private key stays in the
 * KeyPair object (typically the founder's local machine); this function
 * never returns the private key or writes it anywhere.
 *
 * Callers control `authorised_actions` -- pass ONLY the actions the
 * founder explicitly approved. No wildcards. No implicit escalation.
 */
export function signAuthorization(input: {
  readonly trace_id: string;
  readonly work_order_id: string;
  readonly founder_key: KeyPair;
  readonly authorised_actions: readonly string[];
  readonly issued_at?: string;
  readonly expires_at: string;
  readonly nonce?: string;
  readonly previous_authorization_hash: string | null;
  readonly authorization_id?: string;
}): FounderAuthorization {
  const now = new Date().toISOString();
  const base: Omit<FounderAuthorization, "signature"> = {
    record_type: "NEX1_FOUNDER_AUTHORIZATION",
    authorization_id: input.authorization_id ?? `wo2-auth-${randomUUID()}`,
    trace_id: input.trace_id,
    work_order_id: input.work_order_id,
    founder_key_id: input.founder_key.key_id,
    authorised_actions: [...input.authorised_actions],
    issued_at: input.issued_at ?? now,
    expires_at: input.expires_at,
    nonce: input.nonce ?? randomBytes(24).toString("base64"),
    previous_authorization_hash: input.previous_authorization_hash,
  };
  const signature = signBytes(input.founder_key, canonicalisePayload(base));
  return { ...base, signature };
}

// ── Verify ──────────────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string; reason_code: VerifyRejectionCode };

export type VerifyRejectionCode =
  | "KEY_NOT_FOUND"
  | "KEY_REVOKED"
  | "KEY_NOT_YET_VALID"
  | "KEY_EXPIRED"
  | "SIGNATURE_INVALID"
  | "PAYLOAD_INVALID"
  | "EXPIRY_BEFORE_ISSUE"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "PUBLIC_KEY_LOAD_FAILED";

/**
 * Cryptographic verification only. Does NOT check:
 *   - nonce replay (handled by wo2-authorization-store.isNonceUsed)
 *   - previous_authorization_hash chain (handled by store.verifyChain)
 *   - cross-trace nonce reuse (handled at store level)
 * Those are transport/storage-layer concerns. This function handles the
 * signature + timing + key-validity concerns only.
 */
export function verifyAuthorization(input: {
  readonly authorization: FounderAuthorization;
  readonly manifest: FounderKeyManifest;
  readonly atTime?: Date;
}): VerifyResult {
  const auth = input.authorization;
  const atTime = input.atTime ?? new Date();

  // Structural sanity — dates must parse
  const issued = Date.parse(auth.issued_at);
  const expires = Date.parse(auth.expires_at);
  if (Number.isNaN(issued) || Number.isNaN(expires)) {
    return { ok: false, reason: "issued_at or expires_at not a valid ISO timestamp", reason_code: "PAYLOAD_INVALID" };
  }
  if (expires <= issued) {
    return { ok: false, reason: `expires_at (${auth.expires_at}) must be strictly after issued_at (${auth.issued_at})`, reason_code: "EXPIRY_BEFORE_ISSUE" };
  }
  if (atTime.getTime() < issued) {
    return { ok: false, reason: `authorization not yet valid (issued_at ${auth.issued_at})`, reason_code: "NOT_YET_VALID" };
  }
  if (atTime.getTime() > expires) {
    return { ok: false, reason: `authorization expired at ${auth.expires_at}`, reason_code: "EXPIRED" };
  }

  // Resolve public key with validity window enforcement
  const keyResult = findFounderKeyById(input.manifest, auth.founder_key_id, atTime);
  if (!keyResult.ok) {
    const code: VerifyRejectionCode =
      keyResult.reason.includes("revoked") ? "KEY_REVOKED"
      : keyResult.reason.includes("not yet valid") ? "KEY_NOT_YET_VALID"
      : keyResult.reason.includes("expired at") ? "KEY_EXPIRED"
      : keyResult.reason.includes("failed to load") ? "PUBLIC_KEY_LOAD_FAILED"
      : "KEY_NOT_FOUND";
    return { ok: false, reason: keyResult.reason, reason_code: code };
  }

  // Recompute canonical bytes + verify signature
  const canonical = canonicalisePayload(auth);
  let sigOk: boolean;
  try {
    sigOk = verifyBytes(keyResult.publicKey, canonical, auth.signature);
  } catch (err) {
    return { ok: false, reason: `signature verification threw: ${(err as Error).message}`, reason_code: "SIGNATURE_INVALID" };
  }
  if (!sigOk) {
    return { ok: false, reason: "signature does not verify against key_id's public key", reason_code: "SIGNATURE_INVALID" };
  }

  return { ok: true };
}

/**
 * Convenience: verify then also check the authorised_actions set contains
 * the requested action. Callers that need to know "can this auth do X"
 * use this. Rejection reason distinguishes crypto/timing failure from
 * capability-scope failure.
 */
export function verifyAuthorizationForAction(input: {
  readonly authorization: FounderAuthorization;
  readonly manifest: FounderKeyManifest;
  readonly requested_action: string;
  readonly atTime?: Date;
}): VerifyResult | { ok: false; reason: string; reason_code: "ACTION_NOT_AUTHORISED" } {
  const base = verifyAuthorization(input);
  if (!base.ok) return base;
  if (!input.authorization.authorised_actions.includes(input.requested_action)) {
    return {
      ok: false,
      reason: `authorization does not include action '${input.requested_action}'. Authorised actions: [${input.authorization.authorised_actions.join(", ")}]`,
      reason_code: "ACTION_NOT_AUTHORISED",
    };
  }
  return { ok: true };
}
