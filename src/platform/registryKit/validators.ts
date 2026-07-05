// registryKit · validators.
//
// Slug + semver validation used by every registry factory. Extracted
// from the 5+ hand-rolled copies across the codebase (sectionRegistry,
// blueprintRegistry, appRegistry, packRegistry, designSystemRegistry,
// knowledgePackageRegistry) so all future registries agree on one set
// of rules.
//
// Rules chosen to match the strictest existing usage:
//   • Slug: lowercase kebab, must start + end with alphanumeric,
//     hyphen-only separators. `hero.trust_minimal_1` fails the kebab
//     rule on purpose — that convention is a section id, not a slug.
//   • Namespaced id: `<category>.<name>` where <category> is kebab
//     and <name> may include kebab + underscore + digits — matches
//     the design system id regex verbatim so we don't break it.
//   • Semver: MAJOR.MINOR.PATCH with optional pre-release tag.

/** Kebab-case slug — `plumbing`, `plant-hire-bold`. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** Namespaced id — `hero.trust_minimal_1`, `buttons.primary`. Enforced
 *  by `sectionRegistry`, `buttonRegistry`, `designSystemRegistry`. */
export const NAMESPACED_ID_RE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_-]*$/;

/** Strict semver, optionally with a pre-release tag. Matches the
 *  regex used by `appRegistry` + `packRegistry` + `blueprintRegistry`. */
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** True if the string is a valid kebab-case slug. Single-character
 *  slugs (e.g. `a`) are rejected on purpose — every real slug in the
 *  codebase is at least 2 chars. */
export function isSlug(v: unknown): v is string {
  return typeof v === "string" && SLUG_RE.test(v);
}

/** True if the string is a valid namespaced id (`<cat>.<name>`). */
export function isNamespacedId(v: unknown): v is string {
  return typeof v === "string" && NAMESPACED_ID_RE.test(v);
}

/** True if the string is a valid semver. */
export function isSemver(v: unknown): v is string {
  return typeof v === "string" && SEMVER_RE.test(v);
}

/** Compare two semver strings. Returns:
 *   -1 if a < b,   0 if equal,   +1 if a > b.
 *  Pre-release tags are compared lexicographically after the numeric
 *  parts match, matching npm's coarse behaviour (not the full SemVer
 *  spec) — good enough for registry alias resolution. */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  if (!isSemver(a) || !isSemver(b)) {
    throw new Error(`compareSemver: invalid semver in "${a}" or "${b}"`);
  }
  const [ac, ap] = a.split("-", 2);
  const [bc, bp] = b.split("-", 2);
  const an = ac.split(".").map(Number);
  const bn = bc.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (an[i] < bn[i]) return -1;
    if (an[i] > bn[i]) return 1;
  }
  // Numeric parts equal — pre-release comparison.
  if (!ap && !bp) return 0;
  if (!ap) return 1; // release > pre-release
  if (!bp) return -1;
  return ap < bp ? -1 : ap > bp ? 1 : 0;
}
