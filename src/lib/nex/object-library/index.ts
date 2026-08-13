// Object Library · public exports.
//
// Doctrine: docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md

export {
  register, upsertVersion, reinforce, merge, get, count, all, byFamily, findMatches, similarity, nextId, clear,
} from "./store";
export type {
  ObjectDNA, ObjectFamily, ObjectDimensions, ObjectShapeSignature,
  ObjectVariant, ObjectVersionEntry, SupplierLink, ConstructionRule,
  SubcomponentEntry,
} from "./types";
export { getSubcomponent, walkSubcomponents, flattenSubcomponents, hasSubcomponent, subcomponentSlots } from "./subcomponents";
