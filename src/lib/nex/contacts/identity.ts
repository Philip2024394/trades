// NEX Contact Intelligence · canonical identity resolution
//
// Pure functions. Normalize email + phone so different literal strings
// that represent the same person collapse to one dedup key.

/**
 * Canonicalize an email:
 *   · lowercase
 *   · trim
 *   · reject empty/malformed
 *   · does NOT strip plus-suffix (Gmail-style "user+tag@") — that's a
 *     provider-specific behaviour and applying it globally would collapse
 *     distinct real identities on non-Gmail providers.
 */
export function canonicalEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Canonicalize a phone number:
 *   · strip all non-digit chars except a leading "+"
 *   · reject if < 6 digits after normalization
 *   · does NOT infer country code — the caller supplies E.164 or nothing.
 *
 * This is deliberately conservative. A real E.164 normalizer (libphonenumber)
 * is Phase 3d work; today's version dedupes exact repeats and typographic
 * variants only.
 */
export function canonicalPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return hasPlus ? `+${digits}` : digits;
}

/**
 * A stable-ish name key for fuzzy dedup:
 *   · lowercase
 *   · strip punctuation
 *   · collapse whitespace
 *   · drop common titles (mr · mrs · ms · dr)
 *
 * Used only as a WEAK signal · never as a primary match key.
 */
export function nameKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name
    .toLowerCase()
    .replace(/[.,'"()\-]/g, " ")
    .replace(/\b(mr|mrs|ms|miss|dr|prof|sir|dame)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

/**
 * Company key · same shape as nameKey but with legal-form suffixes stripped
 * (ltd · limited · llc · inc · plc · gmbh · srl).
 */
export function companyKey(name: string | null | undefined): string | null {
  const base = nameKey(name);
  if (!base) return null;
  return base
    .replace(/\b(ltd|limited|llc|inc|incorporated|plc|gmbh|srl|s\.a\.|pty|corp|corporation|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}
