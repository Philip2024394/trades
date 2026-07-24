// Nex Business Operating System — public barrel.

export type {
  ActionKind,
  ActionSuggestion,
  DecisionInput,
  DecisionSuggestion,
  Evidence,
  GrowthOpportunity,
  GrowthOpportunityKind,
  IndustrySignal,
  IndustrySignalKind,
  MorningReport,
  RiskCategory,
  RiskSeverity,
  RiskSignal
} from "./types";
export { evidenceFor } from "./types";

export { predictRisks } from "./predict";
export type { PredictInput } from "./predict";

export { detectIndustrySignals, formatIndustrySignal } from "./industry";
export type { DetectIndustrySignalsInput, IndustryObservation } from "./industry";

export { suggestGrowth } from "./growth";
export type {
  CompletedProjectTally,
  FiveStarCustomer,
  NearbySearch,
  StaleQuote,
  SuggestGrowthInput
} from "./growth";

export { makeDecision } from "./decision";
export type { MakeDecisionInput } from "./decision";

export { findTradesMatching, getTradeNode, knownTrades } from "./graph";
export type { TradeGraphNode } from "./graph";

export { buildMorningReport, formatMorningReport } from "./advisor";
export type { BuildMorningReportInput } from "./advisor";

export { suggestActions } from "./actions";
export type {
  OverdueInvoice,
  ProjectUpdateToPrepare,
  QuoteToPrepare,
  ReportToPrepare,
  StaleFollowUp,
  SuggestActionsInput,
  SupplierRecommendation
} from "./actions";

export { answerBOS, classifyBOSQuestion } from "./answer";
export type { AnswerBOSInput, AnswerBOSResult, BOSQuestion } from "./answer";
