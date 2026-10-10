// src/lib/nex/discovery-intel/index.ts
//
// NEX Fresh World Discovery + Search Intelligence · public API
// Founder-authorised programme · bounded wave 2026-09-21.

export * from "./types";
export {
  readTaxonomyFile,
  seedVocabularyFromTaxonomy,
  loadVocabulary,
  loadVocabularyTree,
  recordCandidateFromCycle,
  promoteCandidateToValidated,
  type TaxonomyFile,
  type TaxonomyFileEntry,
  type VocabularyTree,
} from "./vocabulary";
export {
  recordRelationshipEvidence,
  loadRelationships,
  EVIDENCE_FLOOR_FOR_CONFIDENCE_1,
} from "./relationships";
export {
  runDiscoveryCycle,
  loadRecentCycles,
  loadDiscoveryStatus,
  DEFAULT_CADENCE_SECONDS,
  type CycleAdapter,
  type ProbeInput,
  type ProbeOutcome,
  type ObservedRelatedTerm,
  type RunCycleInput,
  type DiscoveryStatus,
} from "./cycle-service";
