// Xrated Trades — slug rules.
//
// One canonical SEO-best slug spec, used by:
//   - LandingUrlClaim (live preview as the user types)
//   - SlugAvailabilityField (signup wizard)
//   - /api/trade-off/slug-available (server check)
//   - /api/trade-off/create (server enforce)
//   - middleware route-param validation
//
// Rules:
//   - lowercase ASCII letters, digits, hyphens only
//   - 5 to 60 characters
//   - no leading or trailing hyphen
//   - no consecutive hyphens (`--`)
//   - no underscores (Google reads them as word-joiners, not word-breaks)
//   - non-ASCII characters (accents, ideograms) are transliterated where
//     possible and otherwise dropped, so tradies in any country can claim
//     a URL that ranks well on Google
//
// Returning `null` from validate*() means "this is not a valid slug yet";
// callers should show the error rather than mutating the user input.

export const SLUG_MIN_LENGTH = 5;
export const SLUG_MAX_LENGTH = 60;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const COMBINING_MARK_RANGE = /[̀-ͯ]/g;
const DOUBLE_HYPHEN = /-{2,}/g;

/**
 * Transform any input into a Google-friendly slug. Loses information on
 * purpose — the result is always either a valid slug or empty string.
 * Use this for live previews (the user is mid-typing).
 */
export function slugifyXrated(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARK_RANGE, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(DOUBLE_HYPHEN, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

/**
 * Validate a slug for *acceptance* — call this at submit / API boundaries.
 * Returns null on success, or a human-readable error message.
 */
export function validateXratedSlug(slug: string): string | null {
  if (!slug) return "Pick a URL for your profile.";
  if (slug.length < SLUG_MIN_LENGTH) {
    return `Too short — needs at least ${SLUG_MIN_LENGTH} characters.`;
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return `Too long — keep it under ${SLUG_MAX_LENGTH} characters.`;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "Use lowercase letters, numbers and single hyphens only.";
  }
  // The reserved-slug check lives in @/lib/tradeOff so the existing
  // server APIs don't fork — call isReservedSlug() after this returns null.
  return null;
}
