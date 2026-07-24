// Nex Construction Memory Engine — public barrel (Phase 26 V0).

export type {
  Evidence,
  MemoryConfidence,
  MemoryLayer,
  MemoryPredicate,
  MemoryRow,
  MemoryVisibility,
  ReadMemoryInput,
  RetrieveResult,
  ViewerScope,
  WriteCompanyMemoryInput,
  WriteMemoryInput,
  WriteProjectMemoryInput,
  WriteUserMemoryInput,
  CorrectionInput
} from "./types";
export { V0_VISIBILITIES, computeConfidence, defaultDecayFor, evidenceFor } from "./types";

export { writeMemory } from "./writer";
export type { WriteMemoryResult } from "./writer";

export { retrieveMemory } from "./reader";

export { appendCorrection } from "./correction";
export type { AppendCorrectionResult } from "./correction";

export {
  fromFinancialSnapshot,
  fromPaymentObserved,
  fromProjectCompletion,
  fromQuoteIssued
} from "./adapters";
export type {
  FinancialSnapshotEvent,
  PaymentObservedEvent,
  ProjectCompletionEvent,
  QuoteIssuedEvent
} from "./adapters";

export { answerMemory, classifyMemoryQuestion } from "./answer";
export type { AnswerMemoryInput, AnswerMemoryResult, MemoryQuestion } from "./answer";
