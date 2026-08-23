// NEX User Identity · ID generators.
//
// Implements the pinned `project_nex_user_identity_id_model_2026_08_21`
// two-ID model:
//   · internalId  = UUID v4 · private account primary key · NEVER exposed
//   · publicNexId = shareable identifier · format `NEX-XXXX-XXXX` using
//                   Crockford Base32 without confusable chars (I/L/O/U)
//
// Both are generated at first-time onboarding, persisted in
// `localStorage["nex.identity"]`, and (on the future server-backed
// account) migrated to a Postgres row with internalId as PK and
// publicNexId as an indexed unique column.
//
// Cryptographic quality: both generators use crypto.getRandomValues
// (or crypto.randomUUID for the internal ID). NEVER Math.random —
// predictability + brute-force risks are real once publicNexId is
// used for user lookup.

// Crockford Base32 alphabet · excludes I, L, O, U to avoid confusable
// characters when a user speaks or types their ID.
// https://www.crockford.com/base32.html
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Generate the private internal account ID.
 *
 * UUID v4 via crypto.randomUUID. This is the technical primary key for
 * every subsystem (conversation ownership, session correlation,
 * analytics, billing). It is NEVER exposed to any user-visible surface.
 */
export function generateInternalId(): string {
  // crypto.randomUUID is available in all modern browsers (2022+) and
  // Node 19+. If running in an ancient environment, fall back to the
  // getRandomValues implementation below (unlikely in Next 16, but safe).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 via getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Per RFC 4122: version (0100) in byte 6 high nibble; variant (10) in byte 8 high bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate the shareable public NEX ID.
 *
 * Format: `NEX-XXXX-XXXX` where each X is a random character from the
 * Crockford Base32 alphabet (no I, L, O, U). 8 random chars gives
 * 32⁸ ≈ 1.1 trillion combinations — negligible collision probability
 * at any realistic user count for the foreseeable future. Server-side
 * uniqueness check happens when the account moves server-side; for the
 * localStorage-only V1 it's not needed.
 */
export function generatePublicNexId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  // Map each random byte to an alphabet index by modulo 32. Modulo bias
  // is negligible for 32 into 256 (256 = 8 × 32 exactly), so no rejection
  // sampling needed.
  const chars = Array.from(buf, (b) => CROCKFORD_ALPHABET[b % 32]).join("");
  return `NEX-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

/**
 * Normalise user-typed publicNexId for lookup: strip whitespace and
 * hyphens, uppercase, and reject any character outside the Crockford
 * alphabet (also treat `I`→`1`, `L`→`1`, `O`→`0` as common typos per
 * Crockford's spec). Returns null if the input can't be resolved to a
 * valid ID shape.
 *
 * Not used by the current onboarding path — kept here so the future
 * `Find NEX user` surface has one canonical function to call.
 */
export function normalisePublicNexId(input: string): string | null {
  if (!input) return null;
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/^NEX/, "")
    // Crockford typo remapping
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/O/g, "0");
  if (cleaned.length !== 8) return null;
  for (const ch of cleaned) {
    if (!CROCKFORD_ALPHABET.includes(ch)) return null;
  }
  return `NEX-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}
