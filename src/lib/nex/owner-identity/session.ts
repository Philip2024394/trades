// src/lib/nex/owner-identity/session.ts
//
// FOUNDER MASTER ACCESS · 30-minute Owner session state machine
// Philip 2026-09-08 · AUTHORIZE Founder Master Access mission
//
// Hard rules per doctrine:
//   · Maximum lifetime = 30 minutes · NEVER silently permanent
//   · Optional inactivity subcap (default 15 min · additional control)
//   · Founder must re-authenticate after expiry
//   · Continuing to talk does NOT extend the 30-min ceiling
//   · Session data contains identity + expiry ONLY · never the credential

import { randomBytes, randomUUID } from "node:crypto";

export const SESSION_MAX_LIFETIME_MS = 30 * 60 * 1000;   // 30 minutes hard ceiling
export const SESSION_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes since last activity

export type OwnerSession = {
  session_id: string;                   // opaque · UUID
  session_token: string;                // opaque token · what the client presents
  founder_identity: "Phil";             // canonical
  created_at_ms: number;                // absolute anchor for max-lifetime cap
  expires_at_ms: number;                // = created_at_ms + SESSION_MAX_LIFETIME_MS
  last_activity_at_ms: number;          // for inactivity subcap
  device_fingerprint_hash?: string;     // hashed device id (never plaintext)
  network_hint_hash?: string;           // hashed IP (never plaintext)
};

export type SessionValidity =
  | { valid: true; session: OwnerSession }
  | { valid: false; reason: "not_found" | "expired_max_lifetime" | "expired_inactivity" | "malformed" };

/** Create a new Owner session. `credential_verified` MUST already be true.
 *  This function never sees the credential itself · only the "verified"
 *  boolean from the verification step. */
export function createOwnerSession(input: {
  credential_verified: true;
  device_fingerprint_hash?: string;
  network_hint_hash?: string;
  now_ms?: number;
}): OwnerSession {
  if (input.credential_verified !== true) {
    throw new Error("createOwnerSession refused: credential_verified must be true (typed literal)");
  }
  const now = input.now_ms ?? Date.now();
  return {
    session_id: randomUUID(),
    session_token: randomBytes(32).toString("hex"),
    founder_identity: "Phil",
    created_at_ms: now,
    expires_at_ms: now + SESSION_MAX_LIFETIME_MS,
    last_activity_at_ms: now,
    device_fingerprint_hash: input.device_fingerprint_hash,
    network_hint_hash: input.network_hint_hash,
  };
}

/** Check whether a session is still valid at time `now_ms`. Both the max
 *  lifetime cap AND the inactivity subcap must hold. */
export function checkSessionValidity(session: OwnerSession | null | undefined, now_ms?: number): SessionValidity {
  const now = now_ms ?? Date.now();
  if (!session) return { valid: false, reason: "not_found" };
  if (typeof session.expires_at_ms !== "number" || typeof session.created_at_ms !== "number") {
    return { valid: false, reason: "malformed" };
  }
  // Hard 30-minute ceiling · non-negotiable
  if (now >= session.expires_at_ms) return { valid: false, reason: "expired_max_lifetime" };
  // Inactivity subcap
  if (now - session.last_activity_at_ms >= SESSION_INACTIVITY_TIMEOUT_MS) {
    return { valid: false, reason: "expired_inactivity" };
  }
  return { valid: true, session };
}

/** Touch the last-activity timestamp WITHOUT extending the max-lifetime cap.
 *  The 30-minute ceiling is anchored to `created_at_ms` · continuing to
 *  talk cannot push it out. */
export function recordActivity(session: OwnerSession, now_ms?: number): OwnerSession {
  const now = now_ms ?? Date.now();
  // Inactivity is reset · but expires_at_ms IS NEVER MOVED
  return { ...session, last_activity_at_ms: now };
}

/** Explicit logout · returns a "closed" marker to the audit ledger. The
 *  actual session store is expected to delete the record on logout. */
export function closeOwnerSession(session: OwnerSession, reason: "founder_logout" | "expired_max_lifetime" | "expired_inactivity" | "admin_revoke" | "device_change"): {
  session_id: string;
  closed_at_ms: number;
  reason: string;
} {
  return {
    session_id: session.session_id,
    closed_at_ms: Date.now(),
    reason,
  };
}
