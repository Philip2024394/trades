// Universal Intent library — public exports.
//
// Doctrine: docs/brains/nex-master-intent-library-v1-philip-2026-08-03.md

export { classifyUniversalIntent } from "./classify";
export { loadPhrasings, appendPhrasing, resetPhrasingsCache } from "./phrasings";
export { UNIVERSAL_VERBS } from "./types";
export type {
  UniversalVerb,
  Domain,
  Capability,
  IntentRoute,
  IntentClassification,
  PhrasingRow,
} from "./types";
