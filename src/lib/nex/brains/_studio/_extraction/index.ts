// Extraction pipeline · public barrel.

export type {
  CandidateStatus,
  CandidateAdminStatus,
  AdminReviewAction,
  CandidateReviewEvent,
  CandidateKind,
  ExtractionCandidate,
  ExtractionRun,
  ExtractionResult
} from "./types";

export {
  saveRun,
  loadRun,
  listRuns,
  updateCandidate,
  listAdminPending,
  listAdminApproved
} from "./_queue";

export {
  structureAuthorKnowledge,
  type StructureInput
} from "./_llm_structure";

export {
  mergeCandidate,
  type MergeInput,
  type MergeResult
} from "./_merge";

export { PROMPT_VERSION, EXTRACTION_SYSTEM, buildExtractionUserPrompt } from "./_prompt";
