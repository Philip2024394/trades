// Knowledge Layer · public exports.
//
// Doctrine: docs/brains/nex-knowledge-layer-extraction-philip-2026-08-03.md
//
// The extraction rule: every Brain reads knowledge exclusively via retrieve().
// Zero hardcoded knowledge in Brain docs.

export { retrieve } from "./retrieve";
export type {
  MaturityLevel,
  KnowledgeItem,
  KnowledgeItemType,
  RetrieveFilters,
  RetrieveRequest,
  RetrieveResult,
  KnowledgeYamlDeclaration,
} from "./types";
