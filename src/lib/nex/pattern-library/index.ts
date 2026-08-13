// Visual Pattern Library · public exports.
//
// Doctrine: docs/brains/nex-visual-pattern-library-and-design-genome-philip-2026-08-04.md

export {
  register, upsertVersion, reinforce, get, count, all, byFamily, findMatches, similarity, applyPattern, clear,
} from "./store";
export { seedPremiumTradeBanner } from "./seeds";
export type {
  PatternDNA, PatternFamily, PatternLayout, SafeZone, TypographyRole,
  ObjectSlotBinding, PatternVersionEntry, ConversionRecord, PatternApplication,
} from "./types";
