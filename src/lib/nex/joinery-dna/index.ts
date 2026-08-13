// Joinery DNA Library · public exports.
//
// Doctrine: docs/brains/nex-joinery-dna-library-ninth-genome-philip-2026-08-04.md

export {
  get, all, count, reset, reinforce,
  familiesForTrade, familiesForDesignLanguage, sharedFamiliesAcross, query, detectClashes,
} from "./store";
export type { JoineryDNAFamily, JoineryTrade, CrossTradeQuery } from "./types";
