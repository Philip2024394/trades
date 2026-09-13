// WO-WORKSTATION-13 · substrate attestation trust root
//
// Founder-authorised 2026-09-13 per the substrate-hardening WO ("Configuration
// & endpoint substitution must never create, expand, or bypass NEX authority").
//
// This module is the FROZEN, COMPILED-IN trust root for two things:
//   1. The founder-key manifest (wo2-founder-keys.ts) — its `meta_signature`
//      must verify against one of the keys below.
//   2. The substrate integrity table (wo13-integrity.ts) — its
//      `attestation_signature_hex` must verify against one of the keys below.
//
// The public keys below are the ONLY trust anchors. Changing them requires
// modifying THIS FILE — which is itself in the substrate integrity scope
// (see wo13-integrity.ts). So a tampering attempt hits the integrity check.
//
// PRIVATE KEYS for these public keys MUST NEVER enter the repository.
// Regenerate with:  npx tsx scripts/nex-attestation-generate.mts
// The private key stays offline (USB / HSM / encrypted vault).
//
// P-Q applies: this module does NOT create authority. It is one of the
// things authority is measured against.

import { verifyBytes, loadPublicKeyFromDerHex } from "@/lib/nex-controlled-hands/ed25519";

/**
 * The frozen list of DER-hex-encoded Ed25519 public keys trusted to sign
 * NEX's substrate-critical artefacts. Any signature that does not verify
 * against ONE of these keys is rejected.
 *
 * Sensible default = a single production key. Multiple entries only when
 * rotating (old + new coexist during the migration window).
 */
export const TRUSTED_ATTESTATION_PUBLIC_KEYS_DER_HEX: readonly string[] = Object.freeze([
  // Generated 2026-09-13 by scripts/nex-attestation-generate.mts.
  // Private half held OFFLINE by the founder.
  "302a300506032b6570032100bffd21003fdbb41b21ffe0007f062cf76d254ae8f1da89b622603bfbf7cc93a1",
]);

/**
 * Verify a detached signature over `canonicalBytes` against the compiled-in
 * trust anchor set (or a caller-supplied set — tests use this to sign with
 * a fresh test keypair without touching the production trust root).
 *
 * Returns `true` iff signature_hex is a valid Ed25519 signature over
 * canonicalBytes by AT LEAST ONE key in `trustedKeys`. Returns `false`
 * for every failure mode — no exceptions, no side effects.
 */
export function verifyAttestationSignature(
  canonicalBytes: Buffer,
  signature_hex: string,
  trustedKeys: readonly string[] = TRUSTED_ATTESTATION_PUBLIC_KEYS_DER_HEX,
): boolean {
  if (typeof signature_hex !== "string" || !/^[0-9a-fA-F]+$/.test(signature_hex)) return false;
  if (trustedKeys.length === 0) return false;
  for (const derHex of trustedKeys) {
    let publicKey;
    try { publicKey = loadPublicKeyFromDerHex(derHex); }
    catch { continue; }
    if (verifyBytes(publicKey, canonicalBytes, signature_hex)) return true;
  }
  return false;
}
