// src/lib/nex-native/first-conversation/provisional-fingerprint.ts
//
// Bridge 99 · Stage 5a · provisional fingerprint compute (pure).
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7A · Fingerprint mechanism · privacy-hardened bounds.
//   Founder-sealed 2026-09-30 · baseline 6566ace3.
//
// This module is the SOLE authority for computing the provisional
// fingerprint. Per sealed §7A:
//
//   "The pure function computeProvisionalFingerprint() is the sole
//    authority. It ships with an inline whitelist of its own inputs;
//    adding an argument to the function requires founder sign-off
//    and a doctrine amendment."
//
// Whitelist (all five signals · nothing more · nothing derived from
// broader identity-revealing sources):
//
//   1. device_id                · client-generated IndexedDB token
//                                  (Bridge 74 pattern · cooperating input,
//                                  not passively harvested)
//   2. ua_class                 · coarse browser family only
//                                  (chromium | webkit | gecko | unknown)
//                                  Full UA string is doctrinally forbidden.
//   3. ip_24_bucket             · IP address bucketed to /24
//                                  ("203.0.113"). Full IP is forbidden.
//   4. tz_offset_minutes        · UTC offset in minutes (e.g. -480 for PST)
//                                  IANA zone names are forbidden.
//   5. accept_language_primary  · primary two-letter language tag only
//                                  ("en", "id"). Region subtags, quality
//                                  values and secondary lists forbidden.
//
// Explicitly OUT of scope (per §7A · MUST NEVER be added):
//   · canvas / WebGL / AudioContext fingerprinting
//   · screen resolution / pixel ratio / colour depth / orientation
//   · font enumeration
//   · battery / hardwareConcurrency / deviceMemory / GPU
//   · full IP
//   · full UA
//   · precise geolocation, IP-geo city/country
//   · media device enumeration, Bluetooth, sensor APIs
//   · anything passively harvestable that meaningfully narrows identity
//
// Salt handling:
//   · Server-side salt · rotated every 30 days with 7-day overlap window
//     (sealed §7A).
//   · activeSalt signs all NEW fingerprints. acceptedSalts contains
//     activeSalt + any old salts still within the rotation overlap;
//     verifyProvisionalFingerprint() tries every accepted salt so a
//     recently-rotated stored hash can still be matched against fresh
//     inputs.
//
// Doctrinal boundary this module MUST NEVER cross:
//   · This function returns a HASH. It NEVER returns an account_id.
//   · No DB access. No I/O. No side effects. Pure computation only.
//   · Any caller trying to use the fingerprint hash as an identity
//     resolver is violating §7A (see risk-service.ts for the exact
//     "false positives" clause).
//
// Cryptographic properties:
//   · SHA-256 via Node built-in crypto (same pattern as session-crypto).
//   · Deterministic serialisation of input (sorted keys · \0-separated
//     to avoid injection).
//   · Timing-safe compare in verifyProvisionalFingerprint.

import { createHash, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Whitelisted signal inputs · adding a field here is a doctrinal violation
// ---------------------------------------------------------------------------

export type NexUaClass = "chromium" | "webkit" | "gecko" | "unknown";

/**
 * The FIVE and ONLY FIVE signals permitted. Do not add fields.
 * Adding a field requires founder sign-off + a doctrine amendment
 * per sealed §7A.
 */
export interface ProvisionalFingerprintInput {
  device_id: string;
  ua_class: NexUaClass;
  ip_24_bucket: string;
  tz_offset_minutes: number;
  accept_language_primary: string;
}

/**
 * Runtime-authoritative allow-list of input keys. Kept in sync with
 * the type above. `validateInputShape()` uses this to reject inputs
 * with extra fields at runtime, since TypeScript alone cannot catch
 * excess properties on values that flow through `unknown`.
 */
const ALLOWED_KEYS = new Set<keyof ProvisionalFingerprintInput>([
  "device_id",
  "ua_class",
  "ip_24_bucket",
  "tz_offset_minutes",
  "accept_language_primary",
]);

const ALLOWED_UA_CLASSES: readonly NexUaClass[] = [
  "chromium",
  "webkit",
  "gecko",
  "unknown",
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ProvisionalFingerprintConfig {
  /** Salt used to compute new hashes. */
  activeSalt: string;
  /** Salts accepted at verify time. Enables rotation with an overlap
   *  window · activeSalt MUST be in this list. */
  acceptedSalts: readonly string[];
}

/** Throws on unsafe config · call once at module load. */
export function assertProvisionalFingerprintConfig(
  cfg: ProvisionalFingerprintConfig,
): void {
  if (!cfg.activeSalt || cfg.activeSalt.length < 32) {
    throw new Error(
      "provisional-fingerprint: activeSalt must be at least 32 characters (opaque high-entropy secret)",
    );
  }
  if (!Array.isArray(cfg.acceptedSalts) || cfg.acceptedSalts.length === 0) {
    throw new Error(
      "provisional-fingerprint: acceptedSalts must be a non-empty array",
    );
  }
  if (!cfg.acceptedSalts.includes(cfg.activeSalt)) {
    throw new Error(
      "provisional-fingerprint: activeSalt must be present in acceptedSalts (self-verify sanity)",
    );
  }
  for (const s of cfg.acceptedSalts) {
    if (!s || s.length < 32) {
      throw new Error(
        "provisional-fingerprint: every acceptedSalts entry must be at least 32 characters",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * Compute the provisional fingerprint hash for the given input under
 * the active salt. Throws if the input violates the whitelist.
 */
export function computeProvisionalFingerprint(
  input: ProvisionalFingerprintInput,
  cfg: ProvisionalFingerprintConfig,
): string {
  validateInputShape(input);
  return hashWith(cfg.activeSalt, input);
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Return true if the given input could have produced `hash` under any
 * currently-accepted salt (active or rotation-overlap). Enables
 * matching a stored fingerprint against fresh inputs without
 * remembering which salt was active when the hash was written.
 *
 * Timing behaviour: iterates every accepted salt and does a timing-safe
 * compare each iteration; does not short-circuit on match. Total time
 * is independent of which salt (if any) matched.
 */
export function verifyProvisionalFingerprint(
  hash: string,
  input: ProvisionalFingerprintInput,
  cfg: ProvisionalFingerprintConfig,
): boolean {
  validateInputShape(input);
  let matched = false;
  for (const salt of cfg.acceptedSalts) {
    const candidate = hashWith(salt, input);
    if (constantTimeStringEqual(hash, candidate)) {
      matched = true;
      // Do NOT break — keep total time independent of matching salt.
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Env loader (production runtime · tests pass config directly)
// ---------------------------------------------------------------------------

/**
 * Load salt config from env. Fail-fast on missing or unsafe values so
 * production cannot boot with a fallback salt.
 *
 * Required env vars:
 *   NEX_FINGERPRINT_SALT_ACTIVE    · salt for new hashes
 *   NEX_FINGERPRINT_SALT_ACCEPTED  · comma-separated · include ACTIVE
 */
export function loadProvisionalFingerprintConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ProvisionalFingerprintConfig {
  const activeSalt = env.NEX_FINGERPRINT_SALT_ACTIVE;
  const acceptedRaw = env.NEX_FINGERPRINT_SALT_ACCEPTED;
  if (!activeSalt) {
    throw new Error(
      "provisional-fingerprint: NEX_FINGERPRINT_SALT_ACTIVE is required",
    );
  }
  if (!acceptedRaw) {
    throw new Error(
      "provisional-fingerprint: NEX_FINGERPRINT_SALT_ACCEPTED is required (comma-separated · include ACTIVE)",
    );
  }
  const acceptedSalts = acceptedRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { activeSalt, acceptedSalts };
}

// ---------------------------------------------------------------------------
// Internal · shape validation
// ---------------------------------------------------------------------------

function validateInputShape(
  input: unknown,
): asserts input is ProvisionalFingerprintInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("provisional-fingerprint: input must be a plain object");
  }
  const keys = Object.keys(input as object);
  // Reject extra keys — signal-whitelist enforcement per §7A.
  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k as keyof ProvisionalFingerprintInput)) {
      throw new Error(
        `provisional-fingerprint: unknown input key '${k}' — signal whitelist violation per §7A. Adding a signal requires founder sign-off + doctrine amendment.`,
      );
    }
  }
  // Require every whitelisted key.
  for (const k of ALLOWED_KEYS) {
    if (!(k in (input as object))) {
      throw new Error(
        `provisional-fingerprint: missing required signal '${k}'`,
      );
    }
  }
  const p = input as Record<string, unknown>;
  if (typeof p.device_id !== "string" || p.device_id.length === 0) {
    throw new Error(
      "provisional-fingerprint: device_id must be a non-empty string",
    );
  }
  if (
    typeof p.ua_class !== "string" ||
    !ALLOWED_UA_CLASSES.includes(p.ua_class as NexUaClass)
  ) {
    throw new Error(
      `provisional-fingerprint: ua_class must be one of ${ALLOWED_UA_CLASSES.join(", ")}`,
    );
  }
  if (
    typeof p.ip_24_bucket !== "string" ||
    !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p.ip_24_bucket)
  ) {
    throw new Error(
      "provisional-fingerprint: ip_24_bucket must be a three-octet dotted string (e.g. '203.0.113')",
    );
  }
  if (
    typeof p.tz_offset_minutes !== "number" ||
    !Number.isInteger(p.tz_offset_minutes)
  ) {
    throw new Error(
      "provisional-fingerprint: tz_offset_minutes must be an integer",
    );
  }
  if (
    typeof p.accept_language_primary !== "string" ||
    !/^[a-z]{2}$/i.test(p.accept_language_primary)
  ) {
    throw new Error(
      "provisional-fingerprint: accept_language_primary must be a 2-letter primary language tag (e.g. 'en', 'id')",
    );
  }
}

// ---------------------------------------------------------------------------
// Internal · deterministic serialisation + hash
// ---------------------------------------------------------------------------

function hashWith(
  salt: string,
  input: ProvisionalFingerprintInput,
): string {
  // Sorted key=value pairs joined with a byte that cannot appear in any
  // individual field. The \0 separator prevents boundary collisions
  // (e.g. two inputs with device_id "a|b" vs device_id "a" and
  // ip_24_bucket "b" cannot produce the same serialisation).
  const stable = [
    `accept_language_primary=${input.accept_language_primary.toLowerCase()}`,
    `device_id=${input.device_id}`,
    `ip_24_bucket=${input.ip_24_bucket}`,
    `tz_offset_minutes=${input.tz_offset_minutes}`,
    `ua_class=${input.ua_class}`,
  ].join("\0");
  const digest = createHash("sha256")
    .update(`${salt}\0${stable}`, "utf8")
    .digest();
  return base64urlEncode(digest);
}

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    const dummy = Buffer.alloc(aBuf.length);
    timingSafeEqual(aBuf, dummy);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

// ---------------------------------------------------------------------------
// Test-only export · lets structural tests introspect the whitelist
// without duplicating the source of truth.
// ---------------------------------------------------------------------------

/** Returns a frozen copy of the whitelisted input keys. Test-only use. */
export function __ALLOWED_KEYS_FOR_TESTS(): readonly string[] {
  return Array.from(ALLOWED_KEYS).sort();
}
