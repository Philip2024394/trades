// Material Genome Library · public exports.
//
// Doctrine: docs/brains/nex-material-genome-tenth-library-philip-2026-08-04.md

export {
  get, all, count, reset, reinforce,
  materialsForTrade, materialsForPremiumLevel, pairsWith, materialsCompatibleWithFinish,
  mostRepairable, mostSustainable, query, detectPairingClashes,
  substitutionsFor, substitute, explainRecommendation,
} from "./store";
export type {
  MaterialDNA, MaterialTrade, MaterialCategory, MachiningEase,
  MoistureMovementClass, Suitability, StainResponseTag,
  ApplicationRecommendation, MaterialQuery,
  Substitution, SubstitutionKind,
} from "./types";
export type { ExplainInput, Explanation } from "./store";
