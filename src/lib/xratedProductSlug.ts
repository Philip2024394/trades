// Shop Mode Phase 3 — per-product slug utilities.
//
// One canonical place to convert a product name into a URL handle. The
// migration backfill SQL uses the exact same lowercase+hyphenate rule
// (regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) so a row created
// in either path always lands on the same handle for the same name.
//
// Collision strategy: try the bare base slug first; on a UNIQUE-index
// violation the caller appends "-2", "-3" etc. The upsert route owns the
// retry loop because we can't pre-flight check the index without two
// round-trips per save.

const MAX_SLUG_LEN = 80;

/** Convert a product name to the canonical slug. Returns an empty string
 *  when the name has no alphanumeric content (e.g. "🛠️" alone) — caller
 *  decides whether to bounce or fall back to a UUID-derived slug. */
export function slugifyProductName(name: string): string {
  const lowered = (name ?? "").toLowerCase();
  // Replace any run of non a-z0-9 with a single hyphen, then trim
  // leading/trailing hyphens. Matches the SQL backfill exactly.
  const slug = lowered
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN);
  return slug;
}

/** True when the slug satisfies the DB CHECK constraint. Use before
 *  passing a user-supplied slug straight through to the API. */
export function isValidProductSlug(slug: string): boolean {
  if (typeof slug !== "string") return false;
  if (slug.length < 1 || slug.length > MAX_SLUG_LEN) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** Build the candidate slug for the n-th collision attempt — bare slug
 *  on attempt 0, then "<base>-2", "<base>-3" etc. We start the suffix at
 *  2 because attempt 0 already consumes the bare form. */
export function slugCandidate(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const suffix = `-${attempt + 1}`;
  // Trim the base to keep the final string within MAX_SLUG_LEN.
  const room = MAX_SLUG_LEN - suffix.length;
  if (room <= 0) return base.slice(0, MAX_SLUG_LEN);
  return `${base.slice(0, room).replace(/-+$/g, "")}${suffix}`;
}
