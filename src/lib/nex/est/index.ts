// Nex Estimating Intelligence — public barrel.

export type {
  Estimate,
  EstimateCategory,
  EstimateContext,
  EstimateLine,
  Evidence,
  MerchantDefaults,
  TradeAdapter,
  TradeBase,
  TradeInput
} from "./types";
export { ESTIMATE_CATEGORIES, evidenceFor } from "./types";

export { ENGINE_DEFAULTS, resolveMerchantDefaults } from "./defaults";
export { assemble, buildEstimate } from "./engine";
export type { BuildEstimateInput, BuildEstimateResult } from "./engine";

export { ADAPTERS, findAdapter, listTrades } from "./registry";

export { explainLine, speakLine } from "./explain";
export {
  answerEstimate,
  classifyEstimateQuestion,
  formatEstimateSummary
} from "./answer";
export type { AnswerInput, EstimateQuestion } from "./answer";

export { persistEstimateAsQuote } from "./quote";
export type { PersistQuoteInput, PersistedQuote } from "./quote";
