// WO-WORKSTATION-02 · authorization storage + chain + replay protection
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Durable persistence of signed FounderAuthorization envelopes, plus the
// two integrity checks that live at the storage layer rather than the
// crypto layer: nonce replay + chain-of-custody per trace.
//
// Contract:
//   - persistence goes through the canonical GB storage abstraction
//     (getStorage()); jsonl default, postgres/dual-write via env var.
//     NEX GB storage canonical per ADR-0319 correction. Not Supabase.
//   - saveAuthorization refuses to write an authorization whose nonce
//     has been used before — replay protection is at write time, so a
//     stolen envelope replayed later fails at ingest.
//   - the chain-of-custody link is verified by comparing each auth's
//     previous_authorization_hash against the hash of the immediately
//     prior authorization for the same trace. Tampering with any earlier
//     authorization breaks the chain and is detected.

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { hashAuthorization, verifyAuthorization, type FounderAuthorization } from "./wo2-authorization";
import type { FounderKeyManifest } from "./wo2-founder-keys";

// ── Persistence primitives ──────────────────────────────────────────────

/**
 * Persist an authorization. Refuses to save if the nonce has been used
 * before -- callers cannot replay a captured envelope.
 *
 * Returns { ok: false, reason: "NONCE_REUSED" } on replay attempts.
 * Does NOT verify the signature -- callers must call verifyAuthorization
 * before persisting; storage layer trusts that the crypto layer has been
 * exercised. This is deliberate separation of concerns.
 */
export async function saveAuthorization(
  auth: FounderAuthorization,
): Promise<{ ok: true } | { ok: false; reason: "NONCE_REUSED"; existing_authorization_id: string }> {
  const used = await findAuthorizationByNonce(auth.nonce);
  if (used) {
    // Idempotent: exact same envelope resubmitted is not a replay attack.
    if (used.authorization_id === auth.authorization_id && used.signature === auth.signature) {
      return { ok: true };
    }
    return { ok: false, reason: "NONCE_REUSED", existing_authorization_id: used.authorization_id };
  }
  const store = getStorage();
  await store.save(COLLECTIONS.nex1_founder_authorizations, auth);
  return { ok: true };
}

/**
 * Load the most recent authorization for a trace (by issued_at), or null.
 * Used by callers before signing a NEW authorization -- they need the
 * previous authorization's hash to include in the new envelope.
 */
export async function getLatestAuthorizationForTrace(trace_id: string): Promise<FounderAuthorization | null> {
  const store = getStorage();
  const rows = await store.query<FounderAuthorization>(COLLECTIONS.nex1_founder_authorizations, {
    where: { trace_id },
    limit: 10000,
    order_by: "issued_at",
    order_dir: "desc",
  });
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Every authorization for a trace, chronological.
 */
export async function listAuthorizationsForTrace(trace_id: string): Promise<FounderAuthorization[]> {
  const store = getStorage();
  return store.query<FounderAuthorization>(COLLECTIONS.nex1_founder_authorizations, {
    where: { trace_id },
    limit: 10000,
    order_by: "issued_at",
    order_dir: "asc",
  });
}

/**
 * Compute the previous_authorization_hash to embed in the NEXT
 * authorization for a trace. Returns null if this is the first.
 * Callers pass the returned value into `signAuthorization`.
 */
export async function computePreviousHashForTrace(trace_id: string): Promise<string | null> {
  const latest = await getLatestAuthorizationForTrace(trace_id);
  if (!latest) return null;
  const { signature: _sig, ...withoutSig } = latest;
  void _sig;
  return hashAuthorization(withoutSig);
}

/**
 * Check whether a nonce has been used before. Called by saveAuthorization
 * before writing. Exposed for callers that want to check without writing
 * (e.g. a dry-run auth validator).
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
  return (await findAuthorizationByNonce(nonce)) !== null;
}

async function findAuthorizationByNonce(nonce: string): Promise<FounderAuthorization | null> {
  const store = getStorage();
  const rows = await store.query<FounderAuthorization>(COLLECTIONS.nex1_founder_authorizations, {
    where: { nonce },
    limit: 2,
  });
  return rows.length > 0 ? rows[0] : null;
}

// ── Chain verification ──────────────────────────────────────────────────

export type ChainVerifyResult =
  | { ok: true }
  | { ok: false; reason: string; authorization_id?: string };

/**
 * Verify the chain-of-custody for every authorization on a trace:
 *   - first authorization must have previous_authorization_hash === null
 *   - each subsequent authorization's previous_authorization_hash must
 *     equal the hash of the preceding one
 *   - each authorization's signature must verify (crypto integrity)
 *
 * This is the storage-layer complement to `verifyAuthorization`. Both
 * must pass for an authorization stream to be trustworthy.
 */
export async function verifyAuthorizationChainForTrace(
  trace_id: string,
  manifest: FounderKeyManifest,
): Promise<ChainVerifyResult> {
  const chain = await listAuthorizationsForTrace(trace_id);
  if (chain.length === 0) return { ok: true }; // vacuously

  for (let i = 0; i < chain.length; i++) {
    const auth = chain[i];

    // Crypto integrity (verify at auth's issued_at so a since-revoked key
    // that was valid when the signature was made still passes)
    const cryptoResult = verifyAuthorization({
      authorization: auth,
      manifest,
      atTime: new Date(auth.issued_at),
    });
    if (!cryptoResult.ok) {
      return {
        ok: false,
        reason: `authorization ${auth.authorization_id} failed crypto verification: ${cryptoResult.reason}`,
        authorization_id: auth.authorization_id,
      };
    }

    // Chain integrity
    if (i === 0) {
      if (auth.previous_authorization_hash !== null) {
        return {
          ok: false,
          reason: "first authorization must have previous_authorization_hash === null",
          authorization_id: auth.authorization_id,
        };
      }
    } else {
      const prior = chain[i - 1];
      const { signature: _sig, ...priorWithoutSig } = prior;
      void _sig;
      const expectedHash = hashAuthorization(priorWithoutSig);
      if (auth.previous_authorization_hash !== expectedHash) {
        return {
          ok: false,
          reason: `authorization ${auth.authorization_id} previous_authorization_hash does not match hash of prior authorization ${prior.authorization_id}`,
          authorization_id: auth.authorization_id,
        };
      }
    }
  }
  return { ok: true };
}
