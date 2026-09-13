// WO-WORKSTATION-02 · founder key manifest
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Trust root for founder authorization signatures. Composes with the existing
// Ed25519 primitive at src/lib/nex-controlled-hands/ed25519.ts -- no
// reimplementation. Not a parallel security architecture; this is upstream
// of the Broker (which has its OWN signing key for its OWN event log).
//
// Contract:
//   - a FounderKeyManifest lists trusted Ed25519 public keys with metadata
//     (key_id, algorithm, valid_from, optional valid_until, optional
//     revoked_at, human-readable purpose + notes)
//   - manifests can be loaded from a JSON file or a JSON string (env var)
//   - the SECURE DEFAULT is empty: with no keys configured, every
//     verification fails closed
//   - findFounderKeyById enforces the validity window and revocation at a
//     supplied `atTime` -- callers pass "now" for real use, a fixed instant
//     for tests
//
// Not scope for WO-02: DPAPI-backed private-key storage (that is Phase 8
// T3-E). Not scope: hardware token / YubiKey (later capability). Not scope:
// automatic key rotation (later capability). What we get here is the
// trust root and the crypto -- rotation is manual (edit the manifest file).

import { promises as fs } from "node:fs";
import { createPublicKey, sign as ed25519Sign, createPrivateKey, type KeyObject } from "node:crypto";
import { loadPublicKeyFromDerHex } from "@/lib/nex-controlled-hands/ed25519";
import { verifyAttestationSignature } from "./wo13-attestation";

export interface FounderKeyRecord {
  readonly key_id: string;
  readonly algorithm: "ed25519";
  /** DER-encoded SPKI public key as hex. Matches the format produced by
   *  the existing Ed25519 primitive's `public_der_hex`. */
  readonly public_key_der_hex: string;
  readonly purpose: "workstation_authorization";
  readonly valid_from: string;    // ISO timestamp
  readonly valid_until?: string;  // ISO timestamp; undefined = unbounded
  readonly revoked_at?: string;   // ISO timestamp; presence = revoked
  readonly notes?: string;
}

export interface FounderKeyManifest {
  readonly version: "wo2.v0.1";
  readonly keys: readonly FounderKeyRecord[];
  /**
   * WO-13 attestation signature over the canonical form of `keys`
   * (see canonicalizeFounderKeys). MUST verify against a key trusted in
   * wo13-attestation.ts. Absent on the EMPTY_FOUNDER_KEY_MANIFEST (which
   * is the fail-closed sentinel — no keys means no trust needed). Every
   * non-empty manifest MUST carry a valid signature; unsigned or
   * badly-signed manifests are rejected at load time.
   */
  readonly attestation_signature_hex?: string;
}

/** The secure default: no keys configured, every verification fails closed. */
export const EMPTY_FOUNDER_KEY_MANIFEST: FounderKeyManifest = Object.freeze({
  version: "wo2.v0.1",
  keys: Object.freeze([] as FounderKeyRecord[]),
}) as FounderKeyManifest;

// ── Loaders ─────────────────────────────────────────────────────────────

/**
 * Parse a manifest from a JSON string. Validates structure but does not
 * verify keys can actually be loaded by node:crypto -- that is deferred to
 * `resolvePublicKey`, where a bad key surfaces as a specific rejection at
 * verification time.
 */
export function loadFounderKeyManifestFromJson(
  jsonText: string,
  /**
   * Optional trusted-attestation-key override. Production callers omit
   * this; tests supply their own attestation public key(s) after signing
   * the manifest with a matching test private key. Not a bypass — the
   * signature check ALWAYS runs; this parameter only decides which
   * key(s) count as valid attesters.
   */
  trustedAttestationKeys?: readonly string[],
): FounderKeyManifest {
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); }
  catch (err) {
    throw new Error(`[wo2-founder-keys] manifest JSON parse failed: ${(err as Error).message}`);
  }
  const manifest = validateManifest(parsed);
  // WO-13: a non-empty manifest MUST carry a valid attestation signature.
  // The empty manifest is exempt (fail-closed anyway — nothing to trust).
  if (manifest.keys.length > 0) {
    if (!verifyFounderKeyManifestAttestation(manifest, trustedAttestationKeys)) {
      throw new Error(`[wo2-founder-keys] manifest attestation signature invalid or missing (WO-13)`);
    }
  }
  return manifest;
}

/**
 * Load a manifest from disk. The file must be UTF-8 JSON matching
 * FounderKeyManifest. Missing file throws with a specific error code so
 * callers can distinguish "no manifest configured" (fail closed) from
 * "manifest broken" (fail loud).
 */
export async function loadFounderKeyManifestFromFile(filePath: string): Promise<FounderKeyManifest> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      const e = new Error(`[wo2-founder-keys] manifest file not found: ${filePath}`);
      (e as NodeJS.ErrnoException).code = "MANIFEST_NOT_FOUND";
      throw e;
    }
    throw err;
  }
  return loadFounderKeyManifestFromJson(raw);
}

/**
 * Validate a parsed manifest object. Rejects malformed records rather
 * than skipping them silently -- silent skips are exactly how trust
 * roots erode.
 */
function validateManifest(parsed: unknown): FounderKeyManifest {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`[wo2-founder-keys] manifest must be a JSON object`);
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== "wo2.v0.1") {
    throw new Error(`[wo2-founder-keys] manifest.version must be 'wo2.v0.1', got ${JSON.stringify(obj.version)}`);
  }
  if (!Array.isArray(obj.keys)) {
    throw new Error(`[wo2-founder-keys] manifest.keys must be an array`);
  }
  const keys: FounderKeyRecord[] = [];
  for (let i = 0; i < obj.keys.length; i++) {
    const raw = obj.keys[i] as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}] must be an object`);
    }
    if (typeof raw.key_id !== "string" || raw.key_id.length === 0) {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].key_id must be a non-empty string`);
    }
    if (raw.algorithm !== "ed25519") {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].algorithm must be 'ed25519'`);
    }
    if (typeof raw.public_key_der_hex !== "string" || !/^[0-9a-fA-F]+$/.test(raw.public_key_der_hex)) {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].public_key_der_hex must be hex`);
    }
    if (raw.purpose !== "workstation_authorization") {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].purpose must be 'workstation_authorization'`);
    }
    if (typeof raw.valid_from !== "string" || Number.isNaN(Date.parse(raw.valid_from))) {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].valid_from must be an ISO timestamp`);
    }
    if (raw.valid_until !== undefined && (typeof raw.valid_until !== "string" || Number.isNaN(Date.parse(raw.valid_until)))) {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].valid_until, if present, must be an ISO timestamp`);
    }
    if (raw.revoked_at !== undefined && (typeof raw.revoked_at !== "string" || Number.isNaN(Date.parse(raw.revoked_at)))) {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].revoked_at, if present, must be an ISO timestamp`);
    }
    if (raw.notes !== undefined && typeof raw.notes !== "string") {
      throw new Error(`[wo2-founder-keys] manifest.keys[${i}].notes, if present, must be a string`);
    }
    keys.push({
      key_id: raw.key_id,
      algorithm: "ed25519",
      public_key_der_hex: raw.public_key_der_hex,
      purpose: "workstation_authorization",
      valid_from: raw.valid_from,
      valid_until: raw.valid_until as string | undefined,
      revoked_at: raw.revoked_at as string | undefined,
      notes: raw.notes as string | undefined,
    });
  }
  const attestation_signature_hex = typeof obj.attestation_signature_hex === "string"
    ? obj.attestation_signature_hex : undefined;
  return { version: "wo2.v0.1", keys, attestation_signature_hex };
}

// ── Lookup + validity ───────────────────────────────────────────────────

export type FounderKeyLookupResult =
  | { ok: true; key: FounderKeyRecord; publicKey: KeyObject }
  | { ok: false; reason: string };

/**
 * Find a key by key_id, enforce the validity window and revocation, and
 * materialise the public key into a node:crypto KeyObject ready for use
 * with `verifyBytes`. If any check fails, returns a specific reason
 * string rather than throwing -- the caller decides how to report.
 */
export function findFounderKeyById(
  manifest: FounderKeyManifest,
  key_id: string,
  atTime: Date,
): FounderKeyLookupResult {
  const record = manifest.keys.find((k) => k.key_id === key_id);
  if (!record) {
    return { ok: false, reason: `founder key not found in manifest: ${key_id}` };
  }
  if (record.revoked_at) {
    return { ok: false, reason: `founder key revoked at ${record.revoked_at}: ${key_id}` };
  }
  const from = Date.parse(record.valid_from);
  if (atTime.getTime() < from) {
    return { ok: false, reason: `founder key not yet valid (valid_from ${record.valid_from}): ${key_id}` };
  }
  if (record.valid_until) {
    const until = Date.parse(record.valid_until);
    if (atTime.getTime() > until) {
      return { ok: false, reason: `founder key expired at ${record.valid_until}: ${key_id}` };
    }
  }
  let publicKey: KeyObject;
  try {
    publicKey = loadPublicKeyFromDerHex(record.public_key_der_hex);
  } catch (err) {
    return { ok: false, reason: `founder public key failed to load: ${(err as Error).message}` };
  }
  return { ok: true, key: record, publicKey };
}

// ── Optional: env-driven convenience ────────────────────────────────────

/**
 * Convenience loader used by production code paths that want to source
 * the manifest from the environment. Checks two env vars in order:
 *   NEX_FOUNDER_KEY_MANIFEST_JSON  -- inline JSON, takes precedence
 *   NEX_FOUNDER_KEY_MANIFEST_PATH  -- filesystem path
 * If neither is set, returns EMPTY_FOUNDER_KEY_MANIFEST (fail closed).
 * Callers may prefer to load the manifest explicitly for tests.
 */
export async function loadFounderKeyManifestFromEnv(): Promise<FounderKeyManifest> {
  const inline = process.env.NEX_FOUNDER_KEY_MANIFEST_JSON;
  if (typeof inline === "string" && inline.trim().length > 0) {
    // WO-13: production mode refuses inline JSON. In production we require
    // the manifest to be a file on disk (path only), so the manifest file
    // itself can be independently reviewed / permissioned / signed. Inline
    // JSON is fine for tests, dev, and CI — everywhere except real prod.
    if (isProductionEnv()) {
      throw new Error(
        `[wo2-founder-keys] NEX_FOUNDER_KEY_MANIFEST_JSON is rejected in production (WO-13) — use NEX_FOUNDER_KEY_MANIFEST_PATH`,
      );
    }
    return loadFounderKeyManifestFromJson(inline);
  }
  const filePath = process.env.NEX_FOUNDER_KEY_MANIFEST_PATH;
  if (typeof filePath === "string" && filePath.trim().length > 0) {
    return loadFounderKeyManifestFromFile(filePath);
  }
  return EMPTY_FOUNDER_KEY_MANIFEST;
}

/**
 * Production-mode gate. NEX_ENV is preferred; falls back to NODE_ENV.
 * "production" (case-insensitive) is the only production trigger.
 */
function isProductionEnv(): boolean {
  const nex = (process.env.NEX_ENV ?? "").toLowerCase();
  if (nex === "production") return true;
  if (nex.length > 0) return false;
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

// ── WO-13 · attestation signature over the founder-key list ─────────────

/**
 * Canonical bytes over which the founder-key manifest attestation
 * signature is computed. Sorted by key_id, one line per record,
 * tab-separated `key_id<TAB>public_key_der_hex<TAB>valid_from`, joined
 * with `\n`, no trailing newline. Deterministic across platforms.
 *
 * This function MUST match exactly what `signFounderKeyManifest` signs.
 * Any drift causes every load to reject the manifest.
 */
export function canonicalizeFounderKeys(keys: readonly FounderKeyRecord[]): Buffer {
  const sorted = [...keys].sort((a, b) => a.key_id.localeCompare(b.key_id));
  const lines = sorted.map(k =>
    [
      k.key_id,
      k.public_key_der_hex,
      k.valid_from,
      k.valid_until ?? "",
      k.revoked_at ?? "",
    ].join("\t"),
  );
  return Buffer.from(lines.join("\n"), "utf8");
}

/**
 * Verify the manifest's attestation signature against wo13-attestation.ts's
 * trust anchors (or a caller-supplied set — tests only). Returns `true`
 * iff the signature verifies against AT LEAST ONE trusted attestation key.
 * `false` for missing/malformed signatures — never throws.
 */
export function verifyFounderKeyManifestAttestation(
  manifest: FounderKeyManifest,
  trustedKeys?: readonly string[],
): boolean {
  if (typeof manifest.attestation_signature_hex !== "string" || manifest.attestation_signature_hex.length === 0) {
    return false;
  }
  const canonical = canonicalizeFounderKeys(manifest.keys);
  return verifyAttestationSignature(canonical, manifest.attestation_signature_hex, trustedKeys);
}

/**
 * Sign a founder-key manifest with an Ed25519 private key. Used by the
 * founder (offline, with the attestation private key) and by tests (with
 * a fresh keypair).
 *
 * The `attestationPrivateKeyPkcs8Hex` parameter is the PKCS8 DER hex of
 * the private key. In production, this key never enters the repo — the
 * founder runs this from a signing station.
 */
export function signFounderKeyManifest(
  attestationPrivateKeyPkcs8Hex: string,
  keys: readonly FounderKeyRecord[],
): FounderKeyManifest {
  const privateKey = createPrivateKey({
    key: Buffer.from(attestationPrivateKeyPkcs8Hex, "hex"),
    format: "der",
    type: "pkcs8",
  });
  const canonical = canonicalizeFounderKeys(keys);
  const signature = ed25519Sign(null, canonical, privateKey);
  return { version: "wo2.v0.1", keys, attestation_signature_hex: signature.toString("hex") };
}

// ── Utility: build a manifest record from a KeyPair ─────────────────────

/**
 * Build a FounderKeyRecord from an existing KeyPair (typically produced
 * for tests via generateKeyPair() from the ed25519 primitive). Not for
 * production key generation -- founder private keys should never be
 * generated inside NEX itself; they come in from outside.
 *
 * Test-only usage pattern:
 *   const kp = generateKeyPair("founder-test");
 *   const record = buildFounderKeyRecordForTest(kp, { validFrom: "..." });
 *   const manifest: FounderKeyManifest = { version: "wo2.v0.1", keys: [record] };
 */
export function buildFounderKeyRecordForTest(
  keypair: { key_id: string; public_der_hex: string },
  opts: { validFrom: string; validUntil?: string; revokedAt?: string; notes?: string },
): FounderKeyRecord {
  return {
    key_id: keypair.key_id,
    algorithm: "ed25519",
    public_key_der_hex: keypair.public_der_hex,
    purpose: "workstation_authorization",
    valid_from: opts.validFrom,
    valid_until: opts.validUntil,
    revoked_at: opts.revokedAt,
    notes: opts.notes,
  };
}

// Re-export the primitive types callers commonly want alongside this module.
export { createPublicKey };
