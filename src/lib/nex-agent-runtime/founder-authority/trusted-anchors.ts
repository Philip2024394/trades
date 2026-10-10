// WO-NEX-RUNTIME-12 · trusted-founder-key anchor (server-side).
//
// Founder-locked 2026-09-14. The incoming delegation contains
// `founder_public_key_der_hex`, but that value is DATA to verify against
// · NEVER the trust anchor. This module is the trust anchor:
//
//   incoming delegation
//         ↓
//   extract claimed founder public key
//         ↓
//   is claimed key in server trusted-key set?
//         ↓  NO
//   403 founder_key_not_trusted
//         ↓  YES
//   verify delegation signature using THAT trusted key
//
// Configuration is via a single env var:
//   NEX_TRUSTED_FOUNDER_KEYS_HEX=<hex>,<hex>,...
// Each entry is an Ed25519 SPKI DER hex-encoded public key.
//
// Missing env var / empty value → EMPTY TRUST SET → ALL /execute REFUSED
// (fail-closed doctrine).

const ENV_VAR = "NEX_TRUSTED_FOUNDER_KEYS_HEX" as const;

/** Load the trusted-founder-key set from the environment. Deterministic ·
 *  never throws · returns an empty array when the env var is missing/blank
 *  (which is the fail-closed configuration that refuses all /execute). */
export function loadTrustedFounderKeys(): readonly string[] {
  const raw = process.env[ENV_VAR];
  if (raw === undefined || raw === null) return Object.freeze([]);
  const trimmed = raw.trim();
  if (trimmed.length === 0) return Object.freeze([]);
  return Object.freeze(
    trimmed
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[0-9a-f]+$/.test(s) && s.length >= 32 && s.length % 2 === 0),
  );
}

export type TrustAnchorCheck =
  | { readonly ok: true; readonly trusted_key_hex: string }
  | { readonly ok: false; readonly reason: "trust_set_empty" | "founder_key_not_trusted"; readonly detail: string };

/** Check whether the claimed founder key from an incoming delegation is
 *  in the server trust anchor. Never verifies signatures — that's the
 *  next step. This is a pure membership check, and it fails closed on
 *  an empty trust set. */
export function checkFounderKeyTrusted(claimed_founder_public_key_der_hex: string): TrustAnchorCheck {
  const trusted = loadTrustedFounderKeys();
  if (trusted.length === 0) {
    return {
      ok: false,
      reason: "trust_set_empty",
      detail: `${ENV_VAR} is missing or empty · server refuses ALL /execute requests until trust set is configured (fail-closed doctrine)`,
    };
  }
  const claimed = claimed_founder_public_key_der_hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(claimed) || claimed.length === 0) {
    return {
      ok: false,
      reason: "founder_key_not_trusted",
      detail: "delegation.founder_public_key_der_hex is not a valid hex string",
    };
  }
  if (!trusted.includes(claimed)) {
    return {
      ok: false,
      reason: "founder_key_not_trusted",
      detail: `claimed founder key ${claimed.slice(0, 24)}… is not in the server trusted-founder-key set (${trusted.length} key(s) configured)`,
    };
  }
  return { ok: true, trusted_key_hex: claimed };
}

/** For diagnostic and tests: read the env-var-configured set as
 *  hex prefixes (never full keys · avoids logging secrets). */
export function trustedFounderKeyPreview(): { readonly count: number; readonly previews: readonly string[] } {
  const trusted = loadTrustedFounderKeys();
  return {
    count: trusted.length,
    previews: Object.freeze(trusted.map((k) => k.slice(0, 24) + "…")),
  };
}

export const TRUSTED_FOUNDER_KEYS_ENV_VAR = ENV_VAR;
