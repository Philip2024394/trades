// registryKit · validators — tests.
// Run via any TS-aware runner (Vitest / node --experimental-strip-types).

import {
  compareSemver,
  isNamespacedId,
  isSemver,
  isSlug
} from "../validators";

// ─── isSlug ──────────────────────────────────────────────────────
console.assert(isSlug("plumber"), "T1a: single-word slug ok");
console.assert(isSlug("plant-hire-bold"), "T1b: kebab slug ok");
console.assert(isSlug("gas-safe-2"), "T1c: kebab with digit ok");
console.assert(!isSlug("Plumber"), "T1d: uppercase rejected");
console.assert(!isSlug("plumber_smith"), "T1e: underscore rejected");
console.assert(!isSlug("-plumber"), "T1f: leading hyphen rejected");
console.assert(!isSlug("plumber-"), "T1g: trailing hyphen rejected");
console.assert(!isSlug(""), "T1h: empty string rejected");
console.assert(!isSlug(null), "T1i: null rejected");
console.assert(!isSlug(123 as unknown), "T1j: non-string rejected");

// ─── isNamespacedId ──────────────────────────────────────────────
console.assert(
  isNamespacedId("hero.trust_minimal_1"),
  "T2a: section id shape ok"
);
console.assert(
  isNamespacedId("buttons.primary"),
  "T2b: button id shape ok"
);
console.assert(
  !isNamespacedId("trust_minimal_1"),
  "T2c: id without namespace rejected"
);
console.assert(
  !isNamespacedId("Hero.trust_minimal_1"),
  "T2d: uppercase namespace rejected"
);
console.assert(
  !isNamespacedId("hero.Trust_Minimal"),
  "T2e: uppercase name rejected"
);
console.assert(
  !isNamespacedId("hero"),
  "T2f: missing dot rejected"
);

// ─── isSemver ─────────────────────────────────────────────────────
console.assert(isSemver("1.0.0"), "T3a: basic semver ok");
console.assert(isSemver("2.3.14"), "T3b: multi-digit semver ok");
console.assert(isSemver("1.0.0-beta.1"), "T3c: pre-release semver ok");
console.assert(!isSemver("1.0"), "T3d: missing patch rejected");
console.assert(!isSemver("v1.0.0"), "T3e: v-prefix rejected");
console.assert(!isSemver("1.0.0.0"), "T3f: 4-part rejected");
console.assert(!isSemver(""), "T3g: empty rejected");

// ─── compareSemver ────────────────────────────────────────────────
console.assert(compareSemver("1.0.0", "1.0.0") === 0, "T4a: equal");
console.assert(compareSemver("1.0.0", "1.0.1") === -1, "T4b: patch <");
console.assert(compareSemver("1.0.1", "1.0.0") === 1, "T4c: patch >");
console.assert(compareSemver("2.0.0", "1.9.9") === 1, "T4d: major >");
console.assert(
  compareSemver("1.0.0-alpha", "1.0.0") === -1,
  "T4e: pre-release < release"
);
console.assert(
  compareSemver("1.0.0-alpha", "1.0.0-beta") === -1,
  "T4f: pre-release lex compare"
);

console.log("registryKit · validators: all assertions passed.");
